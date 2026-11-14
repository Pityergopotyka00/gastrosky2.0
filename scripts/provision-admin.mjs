// OFFLINE account enrollment; never expose this script via an HTTP endpoint.
// Run only on a trusted administrator's device. Output files contain secrets:
// use them once, never commit or upload, and securely delete afterward.
import {randomBytes,randomUUID,pbkdf2Sync,createCipheriv} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const email=(process.env.ADMIN_SETUP_EMAIL||'').trim().toLowerCase();
const password=process.env.ADMIN_SETUP_PASSWORD;
const role=process.env.ADMIN_SETUP_ROLE||'owner';
const keyText=process.env.ADMIN_TOTP_KEY;
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>160||
   typeof password!=='string'||password.length<14||password.length>256||
   !['owner','editor'].includes(role)||
   !keyText||Buffer.from(keyText,'base64').length!==32){
 console.error('Missing or invalid ADMIN_SETUP_EMAIL, ADMIN_SETUP_PASSWORD, ADMIN_SETUP_ROLE or ADMIN_TOTP_KEY.');
 process.exitCode=1;
}else{
 const master=Buffer.from(keyText,'base64');
 const salt=randomBytes(32);
 const passwordHash=pbkdf2Sync(password,salt,600000,32,'sha256').toString('hex');
 const secret=randomBytes(20);
 const iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',master,iv);
 const encrypted=Buffer.concat([iv,cipher.update(secret.toString('base64'),'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
 function base32(buffer){
  let bits=0,value=0,result='';
  for(const byte of buffer){
   value=(value<<8)|byte;bits+=8;
   while(bits>=5){result+=alphabet[(value>>>(bits-5))&31];bits-=5}
   value&=(1<<bits)-1;
  }
  if(bits>0)result+=alphabet[(value<<(5-bits))&31];
  return result;
 }
 const url='otpauth://totp/'+encodeURIComponent('GastroSky:'+email)+'?secret='+base32(secret)+'&issuer=GastroSky&algorithm=SHA1&digits=6&period=30';
 const sqlQuote=v=>"'"+String(v).replaceAll("'","''")+"'";
 const created=Date.now();
 const values=[randomUUID(),email,role,salt.toString('hex'),passwordHash,600000,encrypted,created].map(v=>typeof v==='number'?String(v):sqlQuote(v));
 const sql='INSERT INTO admin_users (id,email,role,password_salt,password_hash,password_iterations,totp_encrypted,created_at) VALUES ('+values.join(',')+');\n';
 const basename='.admin-enrollment-'+created;
 await writeFile(basename+'.sql',sql,{mode:0o600,flag:'wx'});
 await writeFile(basename+'.txt','GastroSky authenticator enrollment (CONFIDENTIAL)\n'+url+'\n',{mode:0o600,flag:'wx'});
 console.log('Local enrollment files created: '+basename+'.sql and '+basename+'.txt');
 console.log('Import the SQL via a trusted Wrangler D1 command, enroll the authenticator with the private URI, then securely dispose of these files.');
 console.log('No account has been created remotely by this script.');
}
