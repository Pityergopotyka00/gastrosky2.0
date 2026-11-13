// GastroSky 2.0 — read supplier product pages ONLY when the visitor opens a product.
// Manufacturer data is never treated as a guaranteed warehouse balance.
import products from '../data/catalog-products.json';
import {parseMaximaAvailability} from './availability.js';

const catalog = new Map(products.map(p=>[p.id,p]));
const headers = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(payload,status=200)=>new Response(JSON.stringify(payload),{status,headers});
const missing=(p,reason,checkedAt=null)=>({id:p.id,sku:p.sku,supplier:p.manufacturer,kind:'unknown',quantity:null,expected_date:null,reason,checked_at:checkedAt});
const ALLOWED={'Maxima':new Set(['maxima.com']),'HENDI':new Set(['hendi.eu','www.hendi.eu'])};
async function verifySupplierPage(p){
 const now=new Date().toISOString();
 if(!p.source_url)return missing(p,'supplier_url_unverified',now);
 let u;try{u=new URL(p.source_url)}catch{return missing(p,'bad_source_url',now)}
 if(u.protocol!=='https:'||!ALLOWED[p.manufacturer]?.has(u.hostname))return missing(p,'untrusted_source_url',now);
 // Live supplier-stock checking is opt-in: do not start automated requests until
 // the seller has permission and a verified availability extraction method.
 if(p.manufacturer==='Maxima'&&p.stock_source_status==='needs_correct_product_url')return missing(p,'supplier_sku_mismatch',now);
 if(p.manufacturer==='HENDI')return missing(p,'manufacturer_stock_not_publicly_verified',now);
 try{
  const res=await fetch(u.toString(),{headers:{Accept:'text/html','Accept-Language':'hu-HU,hu;q=0.9'},redirect:'follow',signal:AbortSignal.timeout(12000)});
  if(!res.ok)return missing(p,'supplier_http_'+res.status,now);
  const redirect=new URL(res.url);
  if(!ALLOWED[p.manufacturer].has(redirect.hostname))return missing(p,'unexpected_redirect',now);
  const contentType=res.headers.get('content-type')||'';
  if(!contentType.includes('text/html'))return missing(p,'non_html_supplier_page',now);
  const html=await res.text();
  if(html.length>2500000)return missing(p,'oversized_page',now);
  const result=parseMaximaAvailability(html,p.sku);
  return {id:p.id,sku:p.sku,supplier:p.manufacturer,kind:result.kind,quantity:result.quantity,expected_date:result.expected_date,delivery_days:result.delivery_days??null,reason:result.reason,checked_at:now};
 }catch(e){return missing(p,e.name==='TimeoutError'?'timeout':'supplier_request_failed',now)}
}
async function stockRequest(req,env){
 const url=new URL(req.url);
 const id=url.searchParams.get('id')||'';
 const p=catalog.get(id);
 if(!p)return json({error:'unknown_product'},404);
 if(env.ENABLE_SITE_CHECKS!=='true')return json(missing(p,'checks_not_enabled'));
 const key=new Request(new URL('/__stockcache/'+encodeURIComponent(id),url).toString());
 const cached=await caches.default.match(key);
 if(cached)return json({...await cached.json(),cached:true});
 const value=await verifySupplierPage(p);
 // Cap load on manufacturer sites. For unknown results, retry later.
 const ttl=value.kind==='unknown'?600:900;
 await caches.default.put(key,new Response(JSON.stringify(value),{headers:{'content-type':'application/json','cache-control':'public, max-age='+ttl}}));
 return json({...value,cached:false});
}
export default {
 async fetch(req,env){
  const path=new URL(req.url).pathname;
  if(path==='/api/stock'&&req.method==='GET')return stockRequest(req,env);
  if(path==='/api/health')return json({ok:true,products:catalog.size,mode:'per_product_page_checks',site_checks_enabled:env.ENABLE_SITE_CHECKS==='true',database_required:false});
  return env.ASSETS?env.ASSETS.fetch(req):new Response('Not found',{status:404});
 }
};
