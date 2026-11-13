// Scheduled supplier availability checks. Public requests never query suppliers.
import products from '../data/catalog-products.json';
import {parseMaximaAvailability} from './availability.js';
import {parseHendiAvailability} from './hendi-availability.js';
const catalog=new Map(products.map(p=>[p.id,p]));
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
const empty=(p,reason,checked_at=null)=>({id:p.id,sku:p.sku,kind:'unknown',quantity:null,reason,checked_at});
const allowed={Maxima:new Set(['maxima.com']),HENDI:new Set(['hendi.eu','www.hendi.eu'])};
async function inspect(p){
 const now=new Date().toISOString();
 if(!p.source_url||p.stock_source_status==='needs_correct_product_url')return empty(p,'source_not_verified',now);
 let url;try{url=new URL(p.source_url)}catch{return empty(p,'invalid_source_url',now)}
 if(url.protocol!=='https:'||!allowed[p.manufacturer]?.has(url.hostname))return empty(p,'invalid_supplier_domain',now);
 try{
  const response=await fetch(url.href,{headers:{Accept:'text/html','Accept-Language':'hu-HU,hu;q=0.9'},redirect:'follow',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return empty(p,'supplier_http_'+response.status,now);
  if(!allowed[p.manufacturer].has(new URL(response.url).hostname))return empty(p,'unexpected_redirect',now);
  if(!(response.headers.get('content-type')||'').includes('text/html'))return empty(p,'not_html',now);
  const html=await response.text();if(html.length>2500000)return empty(p,'page_too_large',now);
  const status=p.manufacturer==='Maxima'?parseMaximaAvailability(html,p.sku):parseHendiAvailability(html,p.sku);
  // An orderable / shipping promise is never a verified warehouse balance.
  if(status.kind==='orderable')return empty(p,'no_verified_warehouse_stock',now);
  return {id:p.id,sku:p.sku,kind:status.kind,quantity:status.quantity??null,reason:status.reason??null,expected_date:status.expected_date??null,checked_at:now};
 }catch(e){return empty(p,e.name==='TimeoutError'?'timeout':'supplier_unreachable',now)}
}
async function scheduledSync(env){
 if(env.ENABLE_SCHEDULED_SYNC!=='true'||!env.DB)return;
 const all=[...catalog.values()];
 // Rotate in bounded batches; avoids uncontrolled supplier fetches.
 const offset=(Math.floor(Date.now()/300000)*3)%all.length;
 for(let i=0;i<Math.min(3,all.length);i++){
  const p=all[(offset+i)%all.length];
  const status=await inspect(p);
  await env.DB.prepare('INSERT INTO supplier_stock (id,kind,quantity,expected_date,reason,checked_at) VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,quantity=excluded.quantity,expected_date=excluded.expected_date,reason=excluded.reason,checked_at=excluded.checked_at')
   .bind(p.id,status.kind,status.quantity??null,status.expected_date??null,status.reason??null,status.checked_at).run();
  if(i<2)await new Promise(resolve=>setTimeout(resolve,800));
 }
}
function snapshot(p,row){
 if(!row)return empty(p,'not_checked');
 const timestamp=Date.parse(row.checked_at);
 if(!Number.isFinite(timestamp)||timestamp>Date.now()+60000||Date.now()-timestamp>3600000)return empty(p,'stale',row.checked_at);
 return {id:p.id,sku:p.sku,kind:row.kind,quantity:row.quantity,expected_date:row.expected_date,reason:row.reason,checked_at:row.checked_at};
}
export default{
 async fetch(req,env){
  const url=new URL(req.url);
  if(url.pathname==='/api/stock'&&req.method==='GET'){
   const p=catalog.get(url.searchParams.get('id')||'');
   if(!p)return json({error:'unknown_product'},404);
   if(!env.DB)return json(empty(p,'database_not_configured'));
   try{
    const row=await env.DB.prepare('SELECT kind,quantity,expected_date,reason,checked_at FROM supplier_stock WHERE id=?1').bind(p.id).first();
    return json(snapshot(p,row));
   }catch{return json(empty(p,'database_not_initialized'),503)}
  }
  if(url.pathname==='/api/products'&&req.method==='GET'){
   const limit=Math.min(50,Math.max(1,Number(url.searchParams.get('limit'))||25));
   const offset=Math.min(catalog.size,Math.max(0,Number(url.searchParams.get('offset'))||0));
   return json({items:[...catalog.values()].slice(offset,offset+limit).map(p=>({id:p.id,sku:p.sku,name:p.name,manufacturer:p.manufacturer,category:p.category})),total:catalog.size,offset,limit});
  }
  if(url.pathname==='/api/health')return json({ok:true,mode:'scheduled_d1_snapshot',database_configured:!!env.DB,scheduled_sync_enabled:env.ENABLE_SCHEDULED_SYNC==='true'});
  return env.ASSETS?env.ASSETS.fetch(req):new Response('Not found',{status:404});
 },
 async scheduled(event,env,ctx){if(env.ENABLE_SCHEDULED_SYNC==='true'&&env.DB)ctx.waitUntil(scheduledSync(env).catch(e=>console.error('Scheduled supplier check failed',String(e))));}
};
