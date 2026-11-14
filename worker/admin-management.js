// GastroSky authenticated management endpoints. No client-supplied SQL.
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const reply=(payload,status=200)=>new Response(JSON.stringify(payload),{status,headers});
const idPattern=/^[a-z][a-z0-9_-]{1,35}:[a-z0-9_.\/-]{1,100}$/i;
const text=(s,max)=>typeof s==='string'&&s.length<=max?s.trim():null;
const now=()=>Date.now();
async function assetCatalog(env,url){
 const r=await env.ASSETS.fetch(new Request(new URL('/data/catalog-products.json',url).toString()));
 if(!r.ok)throw Error('catalog_missing');
 const result=await r.json();
 if(!Array.isArray(result))throw Error('catalog_invalid');
 return result;
}
export async function getCatalogWithOverrides(env,url,{includeHidden=false}={}){
 const items=await assetCatalog(env,url);
 if(!env.ADMIN_DB?.prepare)return items;
 try{
  const result=await env.ADMIN_DB.prepare('SELECT product_id,custom_name,custom_description,image_url,hidden,featured FROM admin_product_overrides').all();
  const edits=new Map((result.results||[]).map(x=>[x.product_id,x]));
  return items.filter(p=>includeHidden||!edits.get(p.id)?.hidden).map(p=>{
   const x=edits.get(p.id);
   if(!x)return p;
   return {...p,name:x.custom_name||p.name,description:x.custom_description||p.description,image_url:x.image_url||p.image_url,admin_featured:x.featured===1,admin_hidden:x.hidden===1};
  });
 }catch{
  // Unapplied optional migrations must never take the public catalog offline.
  return items;
 }
}
async function log(env,actor,event,detail){
 await env.ADMIN_DB.prepare('INSERT INTO admin_audit_log(actor_id,event,occurred_at,detail) VALUES(?,?,?,?)').bind(actor,event,now(),detail).run();
}
function ownerOnly(user){return user.role==='owner'}
async function parseBody(request){
 if((request.headers.get('content-type')||'').split(';')[0].trim()!=='application/json')return null;
 if(Number(request.headers.get('content-length')||0)>10000)return null;
 const raw=await request.text();
 if(raw.length>10000)return null;
 try{const body=JSON.parse(raw);return body&&typeof body==='object'&&!Array.isArray(body)?body:null}catch{return null}
}
export async function handleAdminManagement(request,env,user){
 const path=new URL(request.url).pathname;
 const method=request.method;
 if(path==='/api/admin/dashboard'&&method==='GET'){
  const catalog=await getCatalogWithOverrides(env,request.url);
  const [users,overrides,notes,audits]=await Promise.all([
   env.ADMIN_DB.prepare('SELECT COUNT(*) AS n FROM admin_users WHERE disabled=0').first(),
   env.ADMIN_DB.prepare('SELECT COUNT(*) AS n FROM admin_product_overrides').first(),
   env.ADMIN_DB.prepare('SELECT COUNT(*) AS n FROM admin_quote_notes WHERE status<>?').bind('done').first(),
   env.ADMIN_DB.prepare('SELECT event,occurred_at FROM admin_audit_log ORDER BY id DESC LIMIT 15').all()
  ]);
  const brands=[...new Set(catalog.map(p=>p.manufacturer))].sort();
  return reply({products:catalog.length,brands,accounts:users?.n||0,edits:overrides?.n||0,openNotes:notes?.n||0,audit:(audits.results||[])});
 }
 if(path==='/api/admin/products'&&method==='GET'){
  const catalog=await getCatalogWithOverrides(env,request.url,{includeHidden:true});
  const q=(new URL(request.url).searchParams.get('q')||'').slice(0,80).toLocaleLowerCase('hu');
  const manufacturer=(new URL(request.url).searchParams.get('manufacturer')||'').slice(0,80);
  const start=Math.max(0,Math.min(100000,Number.parseInt(new URL(request.url).searchParams.get('offset')||'0',10)||0));
  const found=catalog.filter(p=>(!manufacturer||p.manufacturer===manufacturer)&&(!q||(p.name+' '+p.sku+' '+p.id).toLocaleLowerCase('hu').includes(q)));
  return reply({items:found.slice(start,start+30).map(p=>({id:p.id,name:p.name,sku:p.sku,manufacturer:p.manufacturer,description:p.description||'',image_url:p.image_url||null,featured:Boolean(p.admin_featured),hidden:Boolean(p.admin_hidden)})),total:found.length,offset:start});
 }
 if(path==='/api/admin/product'&&method==='PUT'){
  if(!ownerOnly(user))return reply({error:'owner_required'},403);
  const body=await parseBody(request);
  if(!body||!idPattern.test(body.id||''))return reply({error:'invalid_input'},400);
  const catalog=await assetCatalog(env,request.url);
  if(!catalog.some(p=>p.id===body.id))return reply({error:'unknown_product'},404);
  const name=body.name==null?null:text(body.name,180),desc=body.description==null?null:text(body.description,1800);
  if((name!==null&&!name)||(desc!==null&&!desc))return reply({error:'invalid_text'},400);
  const img=body.image_url==null||body.image_url===''?null:text(body.image_url,1400);
  if(img!==null){
   try{const u=new URL(img);if(u.protocol!=='https:'||u.username||u.password)throw Error('url');}
   catch{return reply({error:'invalid_image_url'},400)}
  }
  if(typeof body.hidden!=='boolean'||typeof body.featured!=='boolean')return reply({error:'invalid_flags'},400);
  await env.ADMIN_DB.prepare(`INSERT INTO admin_product_overrides(product_id,custom_name,custom_description,image_url,hidden,featured,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?)
   ON CONFLICT(product_id) DO UPDATE SET custom_name=excluded.custom_name,custom_description=excluded.custom_description,image_url=excluded.image_url,hidden=excluded.hidden,featured=excluded.featured,updated_at=excluded.updated_at,updated_by=excluded.updated_by`)
   .bind(body.id,name,desc,img,body.hidden?1:0,body.featured?1:0,now(),user.user_id).run();
  await log(env,user.user_id,'product_updated',body.id);
  return reply({ok:true});
 }
 if(path==='/api/admin/overrides'&&method==='GET'){
  const r=await env.ADMIN_DB.prepare('SELECT product_id,custom_name,custom_description,image_url,hidden,featured,updated_at FROM admin_product_overrides ORDER BY updated_at DESC LIMIT 200').all();
  return reply({items:r.results||[]});
 }
 if(path==='/api/admin/quotes'&&method==='GET'){
  const r=await env.ADMIN_DB.prepare('SELECT id,customer_name,customer_email,note,status,created_at,updated_at FROM admin_quote_notes ORDER BY updated_at DESC LIMIT 100').all();
  return reply({items:r.results||[],source:'manual_followups_only'});
 }
 if(path==='/api/admin/quotes'&&method==='POST'){
  if(!ownerOnly(user))return reply({error:'owner_required'},403);
  const body=await parseBody(request);
  const name=text(body?.name,120),email=text(body?.email,160),note=text(body?.note,1400);
  if(!name||!email||!/^\S+@\S+\.\S+$/.test(email)||note===null)return reply({error:'invalid_input'},400);
  const id=crypto.randomUUID(),t=now();
  await env.ADMIN_DB.prepare('INSERT INTO admin_quote_notes(id,customer_name,customer_email,note,status,created_at,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?)')
   .bind(id,name,email,note,'new',t,t,user.user_id).run();
  await log(env,user.user_id,'quote_note_added',id);
  return reply({ok:true,id},201);
 }
 if(path.startsWith('/api/admin/quotes/')&&method==='PATCH'){
  if(!ownerOnly(user))return reply({error:'owner_required'},403);
  const id=path.slice('/api/admin/quotes/'.length);
  if(!/^[a-f0-9-]{36}$/i.test(id))return reply({error:'invalid_id'},400);
  const body=await parseBody(request);
  if(!['new','in_progress','done'].includes(body?.status))return reply({error:'invalid_status'},400);
  const r=await env.ADMIN_DB.prepare('UPDATE admin_quote_notes SET status=?,updated_at=?,updated_by=? WHERE id=?').bind(body.status,now(),user.user_id,id).run();
  if(!r.meta?.changes)return reply({error:'not_found'},404);
  await log(env,user.user_id,'quote_status_updated',id);
  return reply({ok:true});
 }
 if(path==='/api/admin/staff'&&method==='GET'){
  if(!ownerOnly(user))return reply({error:'owner_required'},403);
  const result=await env.ADMIN_DB.prepare('SELECT email,role,disabled,created_at FROM admin_users ORDER BY created_at').all();
  return reply({items:result.results||[]});
 }
 if(path==='/api/admin/audit'&&method==='GET'){
  if(!ownerOnly(user))return reply({error:'owner_required'},403);
  const result=await env.ADMIN_DB.prepare('SELECT event,occurred_at,detail FROM admin_audit_log ORDER BY id DESC LIMIT 100').all();
  return reply({items:result.results||[]});
 }
 return reply({error:'not_found'},404);
}
