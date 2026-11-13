// Public supplier page availability verification for the starter catalog.
// No authentication, anti-bot bypass or invented stock. Honors robots.txt.
// Full supplier catalogs are imported separately via authorized feeds.
import {readFile,writeFile} from 'node:fs/promises';
import {parseMaximaAvailability} from '../worker/availability.js';
import {parseHendiAvailability} from '../worker/hendi-availability.js';

const products=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const file='data/supplier-stock-snapshot.json';
const snapshot=JSON.parse(await readFile(file,'utf8').catch(()=>'{}'));
const hosts={Maxima:new Set(['maxima.com']),HENDI:new Set(['hendi.eu','www.hendi.eu'])};
const allowedKinds=new Set(['low_stock','in_stock','out_of_stock','out_of_assortment']);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const now=()=>new Date().toISOString();
const MAX_CHECKS=Number(process.env.PUBLIC_CHECK_LIMIT||20);
if(!Number.isSafeInteger(MAX_CHECKS)||MAX_CHECKS<1||MAX_CHECKS>30)throw Error('Invalid PUBLIC_CHECK_LIMIT');

function robotsPolicy(text,userAgent='GastroSkyCatalogCheck'){
  const blocks=[];let agents=[],rules=[],sawRule=false;
  const push=()=>{if(agents.length)blocks.push({agents,rules});agents=[];rules=[];sawRule=false;};
  for(const raw of text.split(/\r?\n/)){
    const line=raw.split('#')[0].trim(),idx=line.indexOf(':');
    if(idx<0)continue;
    const key=line.slice(0,idx).trim().toLowerCase(),value=line.slice(idx+1).trim();
    if(key==='user-agent'){
      if(sawRule)push();
      agents.push(value.toLowerCase());
    }else if((key==='disallow'||key==='allow')&&agents.length){
      rules.push({type:key,path:value});sawRule=true;
    }
  }
  push();
  const exact=blocks.filter(b=>b.agents.some(x=>x===userAgent.toLowerCase()));
  const selected=exact.length?exact:blocks.filter(b=>b.agents.includes('*'));
  return urlPath=>{
    const matches=selected.flatMap(b=>b.rules)
      .filter(r=>r.path&&urlPath.startsWith(r.path.replace(/\*.*$/,'')))
      .sort((a,b)=>b.path.length-a.path.length);
    return !matches.length||matches[0].type==='allow';
  };
}
const robots=new Map();
async function permits(url) {
  const origin=url.origin;
  if(!robots.has(origin)){
    try{
      const response=await fetch(origin+'/robots.txt',{
        headers:{'User-Agent':'GastroSkyCatalogCheck/1.0'},
        signal:AbortSignal.timeout(10000),
        redirect:'error'
      });
      // If robots policy is inaccessible, err on the safe side.
      robots.set(origin,response.ok?{permitted:robotsPolicy(await response.text()),reason:'supplier_robots_disallows'}:{permitted:()=>false,reason:'supplier_robots_http_'+response.status});
    }catch(error){robots.set(origin,{permitted:()=>false,reason:'supplier_robots_unreachable'});console.warn('Cannot read robots policy for',origin,String(error?.message||error))}
  }
  const policy=robots.get(origin);
  return {allowed:policy.permitted(url.pathname),reason:policy.reason};
}
async function check(p){
  if(!p.source_url)return {id:p.id,kind:'unknown',reason:'supplier_page_missing'};
  let url;
  try{url=new URL(p.source_url)}catch{return {id:p.id,kind:'unknown',reason:'invalid_supplier_url'}}
  if(url.protocol!=='https:'||!hosts[p.manufacturer]?.has(url.hostname))return {id:p.id,kind:'unknown',reason:'wrong_supplier_host'};
  const policy=await permits(url);
  if(!policy.allowed)return {id:p.id,kind:'unknown',reason:policy.reason};
  try{
    const response=await fetch(url.href,{
      headers:{Accept:'text/html','Accept-Language':'hu-HU,hu;q=0.9','User-Agent':'GastroSkyCatalogCheck/1.0 (public product availability)'},
      signal:AbortSignal.timeout(14000),
      redirect:'follow'
    });
    if(!response.ok)return {id:p.id,kind:'unknown',reason:'supplier_http_'+response.status};
    const redirected=new URL(response.url);
    if(!hosts[p.manufacturer].has(redirected.hostname))return {id:p.id,kind:'unknown',reason:'unexpected_redirect'};
    if(!(response.headers.get('content-type')||'').includes('text/html'))return {id:p.id,kind:'unknown',reason:'unexpected_content'};
    const html=await response.text();
    if(html.length>2500000)return {id:p.id,kind:'unknown',reason:'oversized_page'};
    const parsed=p.manufacturer==='Maxima'?parseMaximaAvailability(html,p.sku):parseHendiAvailability(html,p.sku);
    if(!allowedKinds.has(parsed.kind))return {id:p.id,kind:'unknown',reason:parsed.reason||'not_explicit_stock'};
    return {id:p.id,kind:parsed.kind,quantity:parsed.quantity??null,reason:null};
  }catch(e){return {id:p.id,kind:'unknown',reason:e?.name==='TimeoutError'?'supplier_timeout':'supplier_request_failed'}}
}
// Respect official feeds if connected: public webpage checks are only fallback.
let checked=0,confirmed=0,skipped=0;
for(const p of products){
  if(checked>=MAX_CHECKS)break;
  const previous=snapshot[p.id];
  if(previous?.source==='authorized_supplier_feed'){skipped++;continue}
  const result=await check(p);
  checked++;
  const record={
    id:p.id,sku:p.sku,kind:result.kind,
    quantity:result.quantity??null,expected_date:null,
    reason:result.reason??null,checked_at:now(),source:'public_supplier_product_page'
  };
  snapshot[p.id]=record;
  if(allowedKinds.has(record.kind))confirmed++;
  console.log(p.id,record.kind,record.reason||'verified');
  await sleep(1500);
}
await writeFile(file,JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify({checked,confirmed,unknown:checked-confirmed,preferred_feed_records:skipped}));
