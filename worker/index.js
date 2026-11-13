// GastroSky 2.0 – live, on-demand Maxima product-page availability.
// The check never fabricates stock. Supplier access must be permitted;
// if blocked, mismatched, dynamic-only, or ambiguous we return "unknown".
import products from '../data/maxima-products.json';
import {parseMaximaAvailability} from './availability.js';

const catalog = new Map(products.filter(p => p.manufacturer === 'Maxima').map(p => [p.sku, p]));
const TTL_SECONDS = 900; // maximum one page request per SKU per cache location / 15 min
const UNKNOWN_TTL = 120;
const responseHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const json = (data, status=200) => new Response(JSON.stringify(data), {status,headers:responseHeaders});
const unknown = (reason, sku, checked_at=null) => ({sku,kind:'unknown',quantity:null,expected_date:null,checked_at,reason});

async function checkSupplier(sku, product) {
 const checked_at=new Date().toISOString();
 if(!product?.source_url) return unknown('source_not_verified',sku,checked_at);
 let url;
 try {url=new URL(product.source_url)} catch {return unknown('invalid_supplier_url',sku,checked_at)}
 if(url.protocol!=='https:'||url.hostname!=='maxima.com'||!url.pathname.startsWith('/hu/'))
   return unknown('requires_hungarian_supplier_page',sku,checked_at);
 try {
  const res=await fetch(url.href,{
   headers: { 'Accept':'text/html', 'Accept-Language':'hu-HU,hu;q=0.9' },
   redirect:'follow',
   signal:AbortSignal.timeout(12000)
  });
  if(!res.ok) return unknown('supplier_http_'+res.status,sku,checked_at);
  const final=new URL(res.url);
  if(final.hostname!=='maxima.com'||!final.pathname.startsWith('/hu/'))
    return unknown('supplier_redirected',sku,checked_at);
  const type=res.headers.get('content-type')||'';
  if(!type.includes('text/html'))return unknown('unexpected_content_type',sku,checked_at);
  const body=await res.text();
  if(body.length>2000000)return unknown('supplier_page_too_large',sku,checked_at);
  const result=parseMaximaAvailability(body,sku);
  return {sku,kind:result.kind,quantity:result.quantity,expected_date:result.expected_date,reason:result.reason||null,checked_at};
 } catch(e) {return unknown(e.name==='TimeoutError'?'timeout':'supplier_unreachable',sku,checked_at)}
}

async function getStock(request, env) {
 const params=new URL(request.url).searchParams;
 const sku=params.get('sku')||'';
 if(!catalog.has(sku))return json({error:'unknown_sku'},404);
 const cacheUrl=new URL('/__maxima_stock_cache/'+encodeURIComponent(sku),request.url);
 const cacheKey=new Request(cacheUrl.toString(),{method:'GET'});
 const cache=caches.default;
 const cached=await cache.match(cacheKey);
 if(cached){const data=await cached.json();return json({...data,cached:true})}
 const data=await checkSupplier(sku,catalog.get(sku));
 // Cache both real and unknown results to avoid overwhelming the supplier.
 const ttl=data.kind==='unknown'?UNKNOWN_TTL:TTL_SECONDS;
 const storage=new Response(JSON.stringify(data),{headers:{'content-type':'application/json','cache-control':'public, max-age='+ttl}});
 await cache.put(cacheKey,storage);
 return json({...data,cached:false});
}

export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/stock'&&request.method==='GET') return getStock(request,env);
  if(path==='/api/health'&&request.method==='GET') return json({ok:true,mode:'on_demand_supplier_page_checks',source:'maxima.com/hu',cache_seconds:TTL_SECONDS,d1_required:false});
  if(env.ASSETS) return env.ASSETS.fetch(request);
  return new Response('Not found',{status:404});
 }
};
