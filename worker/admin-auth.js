import {scryptSync} from 'node:crypto';
// GastroSky private admin authentication API (Cloudflare Workers + D1).
// No public signup, bootstrap endpoint, password reset or admin dashboard.
// Fails CLOSED until ADMIN_DB and ADMIN_TOTP_KEY are configured. Provision
// accounts using an out-of-band, owner-approved workflow only.
const encoder=new TextEncoder();
const COOKIE='__Host-gs_admin';
const SESSION_IDLE_MS=30*60*1000;
const SESSION_MAX_MS=8*60*60*1000;
const MAX_FAILURES=5;
const LOCK_MS=15*60*1000;
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{
 status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','pragma':'no-cache','x-robots-tag':'noindex, nofollow','vary':'Cookie',...extra}
});
const fail=(status=401)=>json({error:status===503?'admin_not_configured':'invalid_credentials'},status);
export const isAdminPath=path=>path==='/admin'||path.startsWith('/admin/')||path==='/api/admin'||path.startsWith('/api/admin/');
const hex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
const bytesFromHex=hexString=>{
 if(!/^(?:[0-9a-f]{2})+$/i.test(hexString))throw Error('bad_hex');
 return Uint8Array.from(hexString.match(/.{2}/g),x=>parseInt(x,16));
};
function randomHex(size){const bytes=new Uint8Array(size);crypto.getRandomValues(bytes);return hex(bytes)}
async function sha256(input){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(input))))}
// A supported memory-hard password verifier. Do not run legacy PBKDF2 hashes
// in Cloudflare Workers: even node:crypto is subject to the 100k-round limit.
export async function passwordDigest(password,saltHex,algorithm='scrypt-v1'){
 if(typeof password!=='string'||password.length<14||password.length>256||
    typeof saltHex!=='string'||saltHex.length!==64||algorithm!=='scrypt-v1')
   throw Error('invalid_password_parameters');
 return scryptSync(password,bytesFromHex(saltHex),32,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex');
}

function equalHex(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length||!/^[\da-f]+$/i.test(a)||!/^[\da-f]+$/i.test(b))return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
function decodeBase64(s){
 if(typeof s!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))throw Error('invalid_base64');
 return Uint8Array.from(atob(s),c=>c.charCodeAt(0));
}
async function getTotpSecret(encrypted,env){
 const master=decodeBase64(env.ADMIN_TOTP_KEY);
 if(master.byteLength!==32)throw Error('invalid_totp_key');
 const packed=decodeBase64(encrypted);
 if(packed.byteLength<29)throw Error('invalid_encrypted_secret');
 const key=await crypto.subtle.importKey('raw',master,'AES-GCM',false,['decrypt']);
 const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:packed.slice(0,12)},key,packed.slice(12));
 const secret=decodeBase64(new TextDecoder().decode(plaintext));
 if(secret.byteLength<20)throw Error('invalid_totp_secret');
 return secret;
}
export async function totpAt(secret,step){
 if(!Number.isSafeInteger(step)||step<0)throw Error('invalid_totp_step');
 const counter=new Uint8Array(8);let n=BigInt(step);
 for(let i=7;i>=0;i--){counter[i]=Number(n&255n);n>>=8n}
 const key=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const hash=new Uint8Array(await crypto.subtle.sign('HMAC',key,counter));
 const offset=hash[hash.length-1]&15;
 const number=((hash[offset]&127)<<24)|(hash[offset+1]<<16)|(hash[offset+2]<<8)|hash[offset+3];
 return String(number%1000000).padStart(6,'0');
}
async function validateTotp(encrypted,code,lastStep,env,now){
 if(!/^\d{6}$/.test(code))return null;
 const secret=await getTotpSecret(encrypted,env);
 const current=Math.floor(now/30000);
 for(const step of [current-1,current,current+1]){
  if(step<=Number(lastStep??-1)||step<0)continue;
  if(equalHex(hex(encoder.encode(await totpAt(secret,step))),hex(encoder.encode(code))))return step;
 }
 return null;
}
function hasConfig(env){return Boolean(env.ADMIN_DB?.prepare&&env.ADMIN_TOTP_KEY&&env.ADMIN_AUTH_RATE_LIMITER?.limit)}
function safeOrigin(request){
 const origin=request.headers.get('Origin');
 if(!origin)return false;
 try{return new URL(origin).origin===new URL(request.url).origin}catch{return false}
}
function tokenFromCookie(request){
 const cookie=request.headers.get('cookie')||'';
 const matches=cookie.match(/(?:^|;\s*)__Host-gs_admin=([0-9a-f]{64})(?:;|$)/i);
 return matches?.[1]||null;
}
const clearCookie=()=>COOKIE+'=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0';
function sessionCookie(token){return COOKIE+'='+token+'; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'}
async function rateLimit(request,env){
 // Fail closed if the native Cloudflare limiter is missing or fails.
 try{
  const ip=request.headers.get('cf-connecting-ip')||'unknown';
  const result=await env.ADMIN_AUTH_RATE_LIMITER.limit({key:'admin:'+ip});
  return result.success;
 }catch{return false}
}
async function session(request,env){
 const token=tokenFromCookie(request);
 if(!token)return null;
 const now=Date.now();
 const tokenHash=await sha256(token);
 const row=await env.ADMIN_DB.prepare(
  'SELECT s.id,s.user_id,s.csrf_hash,s.created_at,s.last_seen,u.email,u.role,u.disabled FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND s.last_seen>?'
 ).bind(tokenHash,now,now-SESSION_IDLE_MS).first();
 if(!row||row.disabled)return null;
 // Sliding idle timeout, but never extend the session's absolute expiry.
 await env.ADMIN_DB.prepare('UPDATE admin_sessions SET last_seen=? WHERE id=? AND revoked_at IS NULL').bind(now,row.id).run();
 return row;
}
function secureHeaders(resp,adminPage=false){const headers=new Headers(resp.headers);headers.set('cache-control','no-store');headers.set('x-robots-tag','noindex, nofollow');headers.set('content-security-policy',adminPage?"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'":"default-src 'none'; frame-ancestors 'none'; base-uri 'none'");return new Response(resp.body,{status:resp.status,headers})}
export async function handleAdminRequest(request,env){
 const url=new URL(request.url);
 // Serve only the deliberately public login shell and its exact two assets.
 // Authentication, authorization and secrets stay on the API server.
 const assetName={
  '/admin':'index.html','/admin/':'index.html','/admin/index.html':'index.html',
  '/admin/admin.css':'admin.css','/admin/admin.js':'admin.js'
 }[url.pathname];
 if(assetName){
  if(request.method!=='GET'&&request.method!=='HEAD')return secureHeaders(json({error:'method_not_allowed'},405));
  if(!env.ASSETS?.fetch)return secureHeaders(json({error:'not_found'},404));
  const assetUrl=new URL('/admin/'+assetName,url);
  const asset=await env.ASSETS.fetch(new Request(assetUrl.toString(),{method:request.method}));
  if(!asset.ok)return secureHeaders(json({error:'not_found'},404));
  return secureHeaders(asset,assetName==='index.html');
 }
 // No other admin HTML or admin API is served without deliberate routing.
 if(!url.pathname.startsWith('/api/admin/'))return secureHeaders(json({error:'not_found'},404));
 if(!hasConfig(env))return secureHeaders(fail(503));
 if(request.method!=='GET'&&!safeOrigin(request))return secureHeaders(json({error:'forbidden'},403));
 let phase='route';
 try{
  if(url.pathname==='/api/admin/login'&&request.method==='POST'){
   if(!await rateLimit(request,env))return secureHeaders(json({error:'too_many_attempts'},429,{'retry-after':'60'}));
   if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return secureHeaders(json({error:'unsupported_media_type'},415));
   const body=await request.text();
   if(body.length>2048)return secureHeaders(json({error:'payload_too_large'},413));
   let input;try{input=JSON.parse(body)}catch{return secureHeaders(fail())}
   const email=typeof input?.email==='string'?input.email.trim().toLowerCase():'';
   const password=input?.password,code=input?.code;
   if(email.length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<14||password.length>256||typeof code!=='string')return secureHeaders(fail());
   phase='load_user';
   const user=await env.ADMIN_DB.prepare('SELECT id,email,role,password_salt,password_hash,password_iterations,password_algo,totp_encrypted,last_totp_step,disabled,failed_attempts,locked_until FROM admin_users WHERE email=?').bind(email).first();
   if(!user||user.disabled)return secureHeaders(fail());
   const now=Date.now();
   if(user.locked_until>now)return secureHeaders(fail());
   phase='verify_password';
   // Legacy accounts require an offline password-hash migration. Fail
   // closed instead of executing unsupported PBKDF2 in production.
   if(user.password_algo!=='scrypt-v1')return secureHeaders(json({error:'password_migration_required'},409));
   const hash=await passwordDigest(password,user.password_salt,user.password_algo);
   const passwordOK=equalHex(hash,user.password_hash);
   let step=null;
   if(passwordOK){phase='verify_totp';step=await validateTotp(user.totp_encrypted,code,user.last_totp_step,env,now);}
   if(!passwordOK||step===null){
    phase='record_failed_login';
    await env.ADMIN_DB.prepare('UPDATE admin_users SET failed_attempts=failed_attempts+1,locked_until=CASE WHEN failed_attempts+1>=? THEN ? ELSE locked_until END WHERE id=?').bind(MAX_FAILURES,now+LOCK_MS,user.id).run();
    await env.ADMIN_DB.prepare('INSERT INTO admin_audit_log (actor_id,event,occurred_at) VALUES (?,?,?)').bind(user.id,'login_failed',now).run();
    return secureHeaders(fail());
   }
   // Consume TOTP once, even across competing requests; prevents code replay.
   phase='consume_totp';
   const update=await env.ADMIN_DB.prepare('UPDATE admin_users SET last_totp_step=?,failed_attempts=0,locked_until=0 WHERE id=? AND (last_totp_step IS NULL OR last_totp_step<?)').bind(step,user.id,step).run();
   if(update.meta?.changes!==1)return secureHeaders(fail());
   phase='create_session';
   const token=randomHex(32),csrf=randomHex(32);
   await env.ADMIN_DB.prepare('INSERT INTO admin_sessions (id,user_id,token_hash,csrf_hash,created_at,last_seen,expires_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),user.id,await sha256(token),await sha256(csrf),now,now,now+SESSION_MAX_MS).run();
   await env.ADMIN_DB.prepare('INSERT INTO admin_audit_log (actor_id,event,occurred_at) VALUES (?,?,?)').bind(user.id,'login_success',now).run();
   const response=json({ok:true,email:user.email,role:user.role,csrfToken:csrf},200,{'set-cookie':sessionCookie(token)});
   return secureHeaders(response);
  }
  if(url.pathname==='/api/admin/session'&&request.method==='GET'){
   phase='load_session';
   const current=await session(request,env);
   if(!current)return secureHeaders(json({authenticated:false},401,{'set-cookie':clearCookie()}));
   // Reissue a CSRF token to the same-origin authenticated browser after reload.
   // No CSRF token is ever placed in a cookie or URL.
   const csrf=randomHex(32);
   await env.ADMIN_DB.prepare('UPDATE admin_sessions SET csrf_hash=? WHERE id=? AND revoked_at IS NULL').bind(await sha256(csrf),current.id).run();
   return secureHeaders(json({authenticated:true,email:current.email,role:current.role,csrfToken:csrf}));
  }
  if(url.pathname==='/api/admin/logout'&&request.method==='POST'){
   const current=await session(request,env);
   if(!current)return secureHeaders(json({authenticated:false},401,{'set-cookie':clearCookie()}));
   const csrf=request.headers.get('x-csrf-token')||'';
   if(!/^[0-9a-f]{64}$/i.test(csrf)||!equalHex(await sha256(csrf),current.csrf_hash))return secureHeaders(json({error:'forbidden'},403));
   const now=Date.now();
   await env.ADMIN_DB.prepare('UPDATE admin_sessions SET revoked_at=? WHERE id=?').bind(now,current.id).run();
   await env.ADMIN_DB.prepare('INSERT INTO admin_audit_log (actor_id,event,occurred_at) VALUES (?,?,?)').bind(current.user_id,'logout',now).run();
   return secureHeaders(json({ok:true},200,{'set-cookie':clearCookie()}));
  }
  // No open CRUD API until each operation has permission tests and auditing.
  return secureHeaders(json({error:'not_found'},404));
 }catch(error){
  // Log only the failing phase: never log passwords, TOTP values, secrets, email or tokens.
  console.error('Admin authentication unavailable at phase:',phase,'type:',error?.name||'unknown');
  return secureHeaders(json({error:'admin_unavailable'},503));
 }
}
