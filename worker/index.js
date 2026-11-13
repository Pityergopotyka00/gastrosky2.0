// GastroSky 2.0 stock API: conservative, feed-first integration.
// No stock data is invented. A database without verified records returns "unknown".
import products from '../data/maxima-products.json';
import {parseMaximaAvailability} from './availability.js';

const known = new Map(products.filter(p=>p.manufacturer==='Maxima').map(p=>[p.sku,p]));
const allowed = new Set(['in_stock','out_of_stock','low_stock','expected','unknown']);
const hours24=86400000;
const minutes30=1800000;
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers});
const unknown=(reason='not_checked')=>({kind:'unknown',quantity:null,expected_date:null,reason});

function sanitizeRecord(value) {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_record');
 const sku=String(value.sku||'').trim();
 if(!known.has(sku))throw Error('unknown_sku:'+sku);
 const kind=String(value.kind||'');
 if(!allowed.has(kind))throw Error('invalid_kind:'+sku);
 const quantity=kind==='low_stock'||kind==='out_of_stock'?Number(value.quantity):null;
 if(kind==='low_stock'&&(!Number.isSafeInteger(quantity)||quantity<1))throw Error('invalid_quantity:'+sku);
 if(kind==='out_of_stock'&&quantity!==0)throw Error('invalid_quantity:'+sku);
 const expected_date=kind==='expected'?String(value.expected_date||'').trim():null;
 if(kind==='expected'&&(!expected_date||expected_date.length>70))throw Error('invalid_expected_date:'+sku);
 return {sku,kind,quantity,expected_date,reason:kind==='unknown'?'supplier_unknown':null};
}

async function writeRecords(env,records,source,observedAt) {
 if(!env.DB)throw Error('D1_not_configured');
 if(!Array.isArray(records)||records.length<1||records.length>known.size)throw Error('invalid_record_count');
 const items=records.map(sanitizeRecord);
 if(new Set(items.map(x=>x.sku)).size!==items.length)throw Error('duplicate_sku');
 const seenDate=Date.parse(observedAt);
 if(!Number.isFinite(seenDate)||seenDate>Date.now()+60000||Date.now()-seenDate>hours24)throw Error('invalid_source_timestamp');
 const checks=items.map(x=>env.DB.prepare('INSERT INTO stock_checks (sku,kind,quantity,expected_date,reason,checked_at) VALUES (?1,?2,?3,?4,?5,?6)')
   .bind(x.sku,x.kind,x.quantity,x.expected_date,x.reason,observedAt));
 const current=items.map(x=>env.DB.prepare('INSERT INTO stock_current (sku,kind,quantity,expected_date,reason,checked_at) VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(sku) DO UPDATE SET kind=excluded.kind,quantity=excluded.quantity,expected_date=excluded.expected_date,reason=excluded.reason,checked_at=excluded.checked_at WHERE stock_current.checked_at <= excluded.checked_at')
   .bind(x.sku,x.kind,x.quantity,x.expected_date,x.reason,observedAt));
 // Transactions are atomic, so a partially failed feed cannot corrupt current statuses.
 await env.DB.batch([...checks,...current]);
 return {accepted:items.length,source,observed_at:observedAt};
}

async function fetchAuthorizedFeed(env){
 if(env.ENABLE_STOCK_SYNC!=='true'||!env.MAXIMA_FEED_URL||!env.MAXIMA_FEED_TOKEN||!env.DB) return {skipped:true,reason:'feed_not_configured'};
 const url=new URL(env.MAXIMA_FEED_URL);
 if(url.protocol!=='https:'||url.username||url.password)throw Error('invalid_feed_url');
 const response=await fetch(url.href,{headers:{Authorization:'Bearer '+env.MAXIMA_FEED_TOKEN,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('supplier_feed_http_'+response.status);
 // Provider-specific feed adapter is needed if Maxima supplies CSV/XML rather than normalized JSON.
 const data=await response.json();
 if(data.provider!=='maxima'||!Array.isArray(data.items))throw Error('invalid_supplier_feed');
 return writeRecords(env,data.items,'maxima_authorized_feed',data.observed_at);
}

function publicStatus(rows) {
 const map=new Map(rows.map(r=>[r.sku,r]));
 return [...known.keys()].map(sku=>{
  const record=map.get(sku);
  const fresh=record&&Date.now()-Date.parse(record.checked_at)<minutes30&&Date.parse(record.checked_at)<=Date.now()+60000;
  if(!fresh)return {sku,...unknown(record?'stale':'not_checked'),checked_at:record?.checked_at||null};
  return {sku,kind:record.kind,quantity:record.quantity,expected_date:record.expected_date,checked_at:record.checked_at,reason:record.reason};
 });
}
export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/stock'&&request.method==='GET'){
   if(!env.DB)return json({enabled:false,items:[...known.keys()].map(sku=>({sku,...unknown('not_deployed')}))});
   const rows=await env.DB.prepare('SELECT sku,kind,quantity,expected_date,reason,checked_at FROM stock_current').all();
   return json({enabled:true,items:publicStatus(rows.results||[])});
  }
  if(path==='/api/health')return json({ok:true,stock_feed_configured:!!(env.ENABLE_STOCK_SYNC==='true'&&env.MAXIMA_FEED_URL&&env.MAXIMA_FEED_TOKEN&&env.DB)});
  if(path==='/api/admin/stock-import'&&request.method==='POST'){
   if(!env.ADMIN_IMPORT_TOKEN)return json({error:'import_disabled'},503);
   if(request.headers.get('authorization')!=='Bearer '+env.ADMIN_IMPORT_TOKEN)return json({error:'unauthorized'},401);
   if(!env.DB)return json({error:'database_missing'},503);
   const contentLength=Number(request.headers.get('content-length')||0);
   if(contentLength>100000)return json({error:'payload_too_large'},413);
   let data;try{const body=await request.text();if(body.length>100000)return json({error:'payload_too_large'},413);data=JSON.parse(body)}catch{return json({error:'invalid_json'},400)}
   if(data.provider!=='maxima')return json({error:'invalid_provider'},400);
   try{return json(await writeRecords(env,data.items,'authorized_manual_import',data.observed_at))}
   catch(e){return json({error:String(e.message||e)},400)}
  }
  if(env.ASSETS)return env.ASSETS.fetch(request);
  return new Response('Not found',{status:404});
 },
 async scheduled(_,env,ctx){
  if(env.ENABLE_STOCK_SYNC!=='true')return;
  ctx.waitUntil(fetchAuthorizedFeed(env).catch(error=>console.error('Stock sync failed; existing records expire after 30 min:',String(error))));
 }
};
