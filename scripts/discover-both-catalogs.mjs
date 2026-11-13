/**
 * Public Maxima + HENDI catalog discovery.
 *
 * Source: the suppliers' publicly accessible pages / sitemaps only.
 * Follows robots.txt, never logs in, and only saves a product with a
 * matching manufacturer SKU and an actual manufacturer-hosted image URL.
 *
 * Discovery state is persistent across GitHub Action runs, so a large catalog
 * is processed in bounded, respectful batches without repeating page one.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
import {normalizeSupplierUrl} from './catalog-url.mjs';
import {parseProducts} from './catalog-parse.mjs';

const PRODUCT_PATH='data/catalog-products.json';
const STATE_PATH='data/catalog-discovery-state.json';
const REPORT_PATH='data/catalog-discovery-report.json';
const report={checked_at:new Date().toISOString(),suppliers:{}};
const MAX_PAGES=Math.min(120,Math.max(1,Number(process.env.PUBLIC_DISCOVERY_PAGES||45)));
const USER_AGENT='GastroSkyCatalogCheck/1.0';
const STOP_AFTER_CONSECUTIVE_FAILURES=8;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const readJson=async(path,fallback)=>JSON.parse(await readFile(path,'utf8').catch(()=>JSON.stringify(fallback)));
const oldProducts=await readJson(PRODUCT_PATH,[]);
const existing=new Map(oldProducts.map(p=>[p.id,p]));
const state=await readJson(STATE_PATH,{version:1,Maxima:{queue:[],seen:[]},HENDI:{queue:[],seen:[]}});
const vendors=[
  {name:'Maxima',origin:'https://maxima.com',prefix:'/hu/',seeds:['https://maxima.com/hu/','https://maxima.com/hu/uj-termekek/',''https://maxima.com/hu/etterem-es-szalloda/','https://maxima.com/hu/hutes/','https://maxima.com/hu/fozoberendezes/','https://maxima.com/hu/elelmiszer-feldolgozas/']},
  {name:'HENDI',origin:'https://www.hendi.eu',prefix:'/en/',seeds:['https://www.hendi.eu/en/','https://www.hendi.eu/en/new/','https://www.hendi.eu/en/kitchen-appliances/','https://www.hendi.eu/en/cooling/']}
];
const normalizeUrl=normalizeSupplierUrl;
function parseRobots(raw,vendorAgent='GastroSkyCatalogCheck'){
  const groups=[];let agents=[],rules=[],begun=false;
  function flush(){if(agents.length)groups.push({agents:[...agents],rules:[...rules]});agents=[];rules=[];begun=false}
  const sitemaps=[];
  for(const fullLine of raw.split(/\r?\n/)){
    const line=fullLine.split('#')[0].trim();
    const i=line.indexOf(':');if(i<0)continue;
    const key=line.slice(0,i).toLowerCase().trim(),value=line.slice(i+1).trim();
    if(key==='sitemap'){sitemaps.push(value);continue}
    if(key==='user-agent'){if(begun)flush();agents.push(value.toLowerCase());continue}
    if((key==='allow'||key==='disallow')&&agents.length){rules.push({type:key,path:value});begun=true}
  }
  flush();
  const specific=groups.filter(g=>g.agents.includes(vendorAgent.toLowerCase()));
  const selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
  function allowed(path){
    const matches=selected.flatMap(g=>g.rules)
      .filter(r=>r.path&&path.startsWith(r.path.split('*')[0]))
      .sort((a,b)=>b.path.length-a.path.length||(a.type==='allow'?-1:1));
    return !matches.length||matches[0].type==='allow';
  }
  return {allowed,sitemaps};
}
async function readRobots(vendor){
  try{
    const response=await fetch(vendor.origin+'/robots.txt',{
      headers:{'User-Agent':USER_AGENT},
      signal:AbortSignal.timeout(14000),redirect:'error'
    });
    if(!response.ok)throw Error('HTTP '+response.status);
    return parseRobots(await response.text());
  }catch(e){console.warn(vendor.name+' robots policy unavailable: '+String(e));return null}
}
async function getHtml(url,vendor,policy){
  if(!policy?.allowed(new URL(url).pathname))return null;
  try{
    const response=await fetch(url,{
      headers:{Accept:'text/html','User-Agent':USER_AGENT},
      signal:AbortSignal.timeout(15000),
      redirect:'follow'
    });
    if(!response.ok)throw Error('HTTP '+response.status);
    const end=normalizeUrl(response.url,vendor);
    if(!end||!policy.allowed(new URL(end).pathname))throw Error('redirect restricted');
    if(!(response.headers.get('content-type')||'').includes('text/html'))throw Error('not HTML');
    const text=await response.text();
    if(text.length>2800000)throw Error('page too large');
    return text;
  }catch(e){console.warn('Fetch failed',url,String(e));return null}
}
function discoverLinks(html,url,vendor,enqueue){
  const $=load(html);
  const links=$('a[href]').toArray().map(e=>$(e).attr('href'));
  for(const raw of links){
    const u=normalizeUrl(raw,vendor);
    if(u)enqueue(u);
  }
}
// Try publicly declared sitemaps. Only URLs in the manufacturer's permitted
// language directory are added. Recursion is bounded.
async function discoverSitemaps(vendor,policy,enqueue){
  const queue=(policy.sitemaps||[]).filter(x=>x.startsWith(vendor.origin));
  const visited=new Set();
  while(queue.length&&visited.size<12){
    const raw=queue.shift();
    if(visited.has(raw))continue;visited.add(raw);
    let u;try{u=new URL(raw)}catch{continue}
    if(u.origin!==vendor.origin||!policy.allowed(u.pathname))continue;
    try{
      const response=await fetch(u.href,{headers:{'User-Agent':USER_AGENT,Accept:'application/xml,text/xml'},signal:AbortSignal.timeout(12000)});
      if(!response.ok)continue;
      const xml=await response.text();if(xml.length>5000000)continue;
      const $=load(xml,{xmlMode:true});
      $('loc').each((_,el)=>{
        const value=$(el).text().trim();
        if(/\.xml(?:\?|$)/i.test(value)){if(value.startsWith(vendor.origin))queue.push(value)}
        else{const normalized=normalizeUrl(value,vendor);if(normalized)enqueue(normalized)}
      });
      console.log(vendor.name,'sitemap parsed',u.pathname);
    }catch(e){console.warn(vendor.name,'sitemap unavailable',String(e))}
    await sleep(1100);
  }
}
let finalAdded=0,finalUpdated=0;
for(const vendor of vendors){
  const policy=await readRobots(vendor);
  if(!policy){
    console.warn('Skipping',vendor.name,'until robots policy is available');
    report.suppliers[vendor.name]={status:'robots_unavailable',checked:0,added:0,updated:0};
    continue;
  }
  state[vendor.name]??={queue:[],seen:[]};
  const queue=state[vendor.name].queue,seen=new Set(state[vendor.name].seen);
  const pending=new Set(queue);
  const enqueue=url=>{
    if(!seen.has(url)&&!pending.has(url)&&policy.allowed(new URL(url).pathname)){
      queue.push(url);pending.add(url);
    }
  };
  // Revisit category and new-product hubs first on every run, rather than
  // placing them behind thousands of previously discovered product URLs.
  for(const seed of [...vendor.seeds].reverse()){
    const normalized=normalizeUrl(seed,vendor);
    if(!normalized||!policy.allowed(new URL(normalized).pathname))continue;
    seen.delete(normalized);
    if(pending.has(normalized)){
      const idx=queue.indexOf(normalized);
      if(idx>=0)queue.splice(idx,1);
    }
    queue.unshift(normalized);
    pending.add(normalized);
  }
  if(!queue.length)await discoverSitemaps(vendor,policy,enqueue);
  // Bootstrap sitemaps on first run even if homepage is in the queue.
  if(!seen.size)await discoverSitemaps(vendor,policy,enqueue);
  let checked=0,failedInARow=0,added=0,updated=0;
  while(queue.length&&checked<MAX_PAGES&&failedInARow<STOP_AFTER_CONSECUTIVE_FAILURES){
    const url=queue.shift();pending.delete(url);
    if(seen.has(url)||!policy.allowed(new URL(url).pathname))continue;
    const html=await getHtml(url,vendor,policy);
    checked++;
    if(!html){
      failedInARow++;
      // Network errors are retryable; do not permanently mark pages visited.
      enqueue(url);
      await sleep(1200);continue;
    }
    seen.add(url);failedInARow=0;
    const found=parseProducts(html,url,vendor,existing);
    for(const p of found){
      if(existing.has(p.id))updated++;else added++;
      existing.set(p.id,p);
    }
    discoverLinks(html,url,vendor,enqueue);
    await sleep(1200);
  }
  state[vendor.name].queue=queue.slice(0,25000);
  state[vendor.name].seen=[...seen].slice(-50000);
  finalAdded+=added;finalUpdated+=updated;
  report.suppliers[vendor.name]={status:checked?'pages_checked':'no_permitted_pages',checked,added,updated,pending:queue.length,seen:seen.size};
  console.log(vendor.name,report.suppliers[vendor.name]);
}
const all=[...existing.values()].sort((a,b)=>a.manufacturer.localeCompare(b.manufacturer)||a.sku.localeCompare(b.sku));
await writeFile(PRODUCT_PATH,JSON.stringify(all,null,2)+'\n');
await writeFile(STATE_PATH,JSON.stringify(state,null,2)+'\n');
report.catalog_count=all.length;
report.new_products=finalAdded;
report.updated_products=finalUpdated;
report.products_with_image_url=all.filter(p=>p.image_url).length;
await writeFile(REPORT_PATH,JSON.stringify(report,null,2)+'\n');
console.log('Combined public catalog',all.length,'new',finalAdded,'updated',finalUpdated,'photos',all.filter(p=>p.image_url).length);
