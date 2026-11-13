// Discover Maxima products from public Hungarian catalog/sitemap pages.
// Respects robots.txt, validates SKU + official image, and doesn't invent stock.
// This is a limited public-page fallback, not a promise to import the entire catalog.
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
import {parseMaximaAvailability} from '../worker/availability.js';

const catalogPath='data/catalog-products.json';
const stockPath='data/supplier-stock-snapshot.json';
const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
const stock=JSON.parse(await readFile(stockPath,'utf8').catch(()=>'{}'));
const byId=new Map(catalog.map(p=>[p.id,p]));
const origin='https://maxima.com';
const agent='GastroSkyCatalogCheck';
const MAX=Math.max(1,Math.min(80,Number(process.env.MAXIMA_DISCOVER_LIMIT||24)));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const candidates=new Set();
const accepted=new Set();
const wait=()=>delay(1500);
function robotDecision(raw){
 let groups=[],current=[],rules=[],hasRules=false;
 const flush=()=>{if(current.length)groups.push({agents:current,rules});current=[];rules=[];hasRules=false};
 for(const line of raw.split(/\r?\n/)){
  const clean=line.split('#')[0].trim();const ix=clean.indexOf(':');if(ix<0)continue;
  const key=clean.slice(0,ix).trim().toLowerCase(),value=clean.slice(ix+1).trim();
  if(key==='user-agent'){if(hasRules)flush();current.push(value.toLowerCase())}
  else if((key==='allow'||key==='disallow')&&current.length){rules.push({key,path:value});hasRules=true}
 }
 flush();
 const specific=groups.filter(g=>g.agents.includes(agent.toLowerCase()));
 const applicable=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
 return path=>{
  const r=applicable.flatMap(g=>g.rules).filter(x=>x.path&&path.startsWith(x.path.split('*')[0]))
    .sort((a,b)=>b.path.length-a.path.length);
  return !r.length||r[0].key==='allow';
 };
}
let mayCrawl=()=>false;
try{
 const response=await fetch(origin+'/robots.txt',{headers:{'User-Agent':agent+'/1.0'},signal:AbortSignal.timeout(12000),redirect:'error'});
 if(response.ok)mayCrawl=robotDecision(await response.text());
 else throw Error('robots HTTP '+response.status);
}catch(e){console.warn('Cannot validate robots.txt; crawl skipped',e.message)}
function normalizeUrl(raw){
 try {
  const u=new URL(raw,origin);
  if(u.protocol!=='https:'||u.hostname!=='maxima.com'||!u.pathname.startsWith('/hu/'))return null;
  u.hash='';u.search='';
  return u;
 }catch{return null}
}
function addCandidate(raw){
 const url=normalizeUrl(raw);
 if(url&&url.pathname.endsWith('.html')&&mayCrawl(url.pathname))candidates.add(url.href);
}
async function loadPage(url){
 if(!mayCrawl(url.pathname))return null;
 try{
  const res=await fetch(url.href,{headers:{Accept:'text/html','Accept-Language':'hu-HU,hu;q=0.9','User-Agent':agent+'/1.0'},redirect:'follow',signal:AbortSignal.timeout(16000)});
  if(!res.ok)throw Error('HTTP '+res.status);
  const end=new URL(res.url);
  if(end.hostname!=='maxima.com'||!mayCrawl(end.pathname))throw Error('redirect not allowed');
  const html=await res.text();if(html.length>3000000)throw Error('oversized page');
  return html;
 }catch(e){console.warn(url.pathname,e.message);return null}
}
function getPhoto($,url,sku){
 const tags=$('meta[property="og:image"],meta[name="twitter:image"]');
 const images=tags.map((_,el)=>$(el).attr('content')).get();
 for(const img of images){
  try{
   const u=new URL(img,url);
   if(u.protocol==='https:'&&u.hostname==='maxima.com'&&/\/img\/|\/media\//.test(u.pathname))return u.href;
  }catch{}
 }
 return null;
}
function getProduct(html,url){
 const $=load(html);
 const title=$('h1').first().text().trim().replace(/\s+/g,' ');
 const text=$('body').text().replace(/\s+/g,' ');
 // SKU occurs in Maxima's own technical specifications: "Cikkszám 09100000".
 const sku=text.match(/(?:Cikkszám|Article number)\s*:?\s*(0\d{7})\b/i)?.[1];
 if(!sku||!title||title.length>300)return null;
 const image=getPhoto($,url,sku);if(!image)return null;
 const ean=text.match(/(?:Vonalkód\s*\(EAN\)|EAN)\s*:?\s*(\d{8,14})\b/i)?.[1]||'';
 const desc=$('meta[name="description"]').attr('content')?.trim()||'';
 const crumb=$('nav[aria-label*=breadcrumb] a, .breadcrumbs a').last().text().trim();
 const original=byId.get('maxima:'+sku);
 const product={
  ...original,id:'maxima:'+sku,manufacturer:'Maxima',supplier:'Maxima',
  name:title,sku,ean:ean||original?.ean||'',
  category:original?.category||crumb||'Maxima berendezések',
  description:desc.slice(0,1200)||original?.description||'',
  specifications:original?.specifications||{},
  source_url:url.href,image_url:image,image_source:'maxima_public_page',
  source_type:'public_supplier_product_page',record_status:'public_sku_verified',
  price:null,availability:null
 };
 const parsed=parseMaximaAvailability(html,sku);
 // Only explicit stock statements are accepted. Shipping promises are NOT stock.
 const allowed=['in_stock','out_of_stock','low_stock'];
 const kind=allowed.includes(parsed.kind)?parsed.kind:'unknown';
 const record={id:product.id,sku,kind,quantity:kind==='low_stock'?parsed.quantity:kind==='out_of_stock'?0:null,
  expected_date:null,reason:kind==='unknown'?(parsed.reason||'not_explicit_stock'):null,
  source:'public_supplier_product_page',checked_at:new Date().toISOString()};
 return {product,record};
}
// The category URL paths were verified against Maxima's public Hungarian menus.
const seed=[
 origin+'/hu/',
 origin+'/hu/hutes/',
 origin+'/hu/hutes/fagyaszto/',
 origin+'/hu/fozoberendezes/',
 origin+'/hu/elelmiszer-feldolgozas/',
 origin+'/hu/barfelszereles/eszpresszogep/',
 origin+'/hu/mosogatogepek/'
];
for(const item of catalog.filter(p=>p.manufacturer==='Maxima'&&p.source_url))addCandidate(item.source_url);
for(const raw of seed){
 const url=normalizeUrl(raw);if(!url||!mayCrawl(url.pathname))continue;
 const html=await loadPage(url);
 if(html){
  const $=load(html);
  // Product cards link to /hu/....html, whereas categories are directories.
  $('a[href]').each((_,element)=>addCandidate($(element).attr('href')));
  console.log('Discovered from',url.pathname,'candidate pages:',candidates.size);
 }
 await wait();
}
let checked=0,added=0,updated=0,verified=0;
for(const raw of candidates){
 if(checked>=MAX)break;
 const url=new URL(raw);
 const html=await loadPage(url);checked++;
 if(!html){await wait();continue}
 const entry=getProduct(html,url);
 if(!entry){console.log('Not a verified product:',url.pathname);await wait();continue}
 const {product,record}=entry;
 if(byId.has(product.id))updated++;else added++;
 byId.set(product.id,product);
 // Official dealer feed takes precedence over public HTML.
 if(stock[product.id]?.source!=='authorized_supplier_feed')stock[product.id]=record;
 if(record.kind!=='unknown')verified++;
 console.log(product.sku,record.kind,product.name.slice(0,70));
 await wait();
}
if(!checked){console.log('No permitted Maxima product pages discovered. No files changed.');process.exit(0)}
await writeFile(catalogPath,JSON.stringify([...byId.values()].sort((a,b)=>a.manufacturer.localeCompare(b.manufacturer)||a.sku.localeCompare(b.sku)),null,2)+'\n');
await writeFile(stockPath,JSON.stringify(stock,null,2)+'\n');
console.log(JSON.stringify({checked,added,updated,verified,catalogSize:byId.size}));
