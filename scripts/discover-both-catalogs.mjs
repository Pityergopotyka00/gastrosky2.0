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

const PRODUCT_PATH='data/catalog-products.json';
const STATE_PATH='data/catalog-discovery-state.json';
const MAX_PAGES=Math.min(120,Math.max(1,Number(process.env.PUBLIC_DISCOVERY_PAGES||45)));
const USER_AGENT='GastroSkyCatalogCheck/1.0';
const STOP_AFTER_CONSECUTIVE_FAILURES=8;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const readJson=async(path,fallback)=>JSON.parse(await readFile(path,'utf8').catch(()=>JSON.stringify(fallback)));
const oldProducts=await readJson(PRODUCT_PATH,[]);
const existing=new Map(oldProducts.map(p=>[p.id,p]));
const state=await readJson(STATE_PATH,{version:1,Maxima:{queue:[],seen:[]},HENDI:{queue:[],seen:[]}});
const vendors=[
  {name:'Maxima',origin:'https://maxima.com',prefix:'/hu/',seeds:['https://maxima.com/hu/','https://maxima.com/hu/hutes/','https://maxima.com/hu/fozoberendezes/','https://maxima.com/hu/elelmiszer-feldolgozas/']},
  {name:'HENDI',origin:'https://www.hendi.eu',prefix:'/en/',seeds:['https://www.hendi.eu/en/','https://www.hendi.eu/en/new/','https://www.hendi.eu/en/kitchen-appliances.html','https://www.hendi.eu/en/cooling.html']}
];
function normalizeUrl(raw,vendor){
  try{
    const u=new URL(raw,vendor.origin);
    if(u.protocol!=='https:')return null;
    const hostname=u.hostname.toLowerCase();
    if(vendor.name==='Maxima'&&hostname!=='maxima.com')return null;
    if(vendor.name==='HENDI'&&!['www.hendi.eu','hendi.eu'].includes(hostname))return null;
    if(!u.pathname.startsWith(vendor.prefix))return null;
    if(/\.(?:pdf|jpe?g|gif|png|webp|svg|xml|css|js|woff\d?|zip)$/i.test(u.pathname))return null;
    u.search='';u.hash='';
    return u.href;
  }catch{return null}
}
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
function photoLink(url,sku,vendor){
  try{
    const u=new URL(url,vendor.origin);
    if(u.protocol!=='https:')return null;
    const host=u.hostname.toLowerCase();
    if(vendor.name==='Maxima'&&host==='maxima.com'&&/\/(?:media|img)\//.test(u.pathname))return u.href;
    if(vendor.name==='HENDI'&&['hendi.xcdn.nl','www.hendi.eu','hendi.eu'].includes(host)&&
      u.pathname.toLowerCase().includes(sku.toLowerCase())&&/\.(?:jpe?g|png|webp)$/i.test(u.pathname))return u.href;
  }catch{}
  return null;
}
function parseProducts(html,url,vendor){
  const $=load(html);
  const title=$('h1').first().text().replace(/\s+/g,' ').trim();
  if(!title||title.length>250)return [];
  // This public commercial kitchen catalog excludes sharp/weapon-like goods.
  if(/\b(?:knife|knives|blade|dagger|machete|k[eé]s|peng[eé])\b/i.test(title))return [];
  const body=$('body').text().replace(/\s+/g,' ');
  const description=$('meta[name="description"]').attr('content')?.trim()||'';
  const category=$('nav[aria-label*=breadcrumb] a, .breadcrumbs a').last().text().trim()||
     (vendor.name==='Maxima'?'Maxima berendezések':'HENDI berendezések');
  const result=[];
  if(vendor.name==='Maxima'){
    const sku=body.match(/(?:Cikkszám|Article number|Artikelnummer)\s*:?\s*(0\d{7})\b/i)?.[1];
    if(!sku)return [];
    const image=$('meta[property="og:image"]').attr('content')||$('meta[name="twitter:image"]').attr('content')||'';
    const photo=photoLink(image,sku,vendor);
    if(!photo)return [];
    const ean=body.match(/(?:Vonalkód\s*\(EAN\)|EAN)\s*:?\s*(\d{8,14})\b/i)?.[1]||'';
    result.push({sku,image_url:photo,ean});
  }else{
    // HENDI pages may show more than one SKU in a variants table.
    // Pair each six-digit variant SKU to a *matching* image filename.
    const variants=new Set();
    $('tr').each((_,el)=>{
      const row=$(el).text().replace(/\s+/g,' ');
      for(const match of row.matchAll(/\b(\d{6})\b/g))variants.add(match[1]);
    });
    const primary=body.match(/\bSKU\s+(\d{6})\b/i)?.[1];
    if(primary)variants.add(primary);
    const images=[];
    $('img[src],img[data-src],a[href],meta[property="og:image"]').each((_,el)=>{
      const raw=$(el).attr('src')||$(el).attr('data-src')||$(el).attr('href')||$(el).attr('content');
      if(raw)images.push(raw);
    });
    for(const sku of variants){
      const image=images.map(u=>photoLink(u,sku,vendor)).find(Boolean);
      if(!image)continue;
      // Exact SKU must also be part of a visible product variant or the main SKU.
      result.push({sku,image_url:image,ean:sku});
    }
  }
  return result.map(({sku,image_url,ean})=>{
    const id=vendor.name.toLowerCase()+':'+sku;
    const before=existing.get(id)||{};
    return {...before,id,sku,name:title,manufacturer:vendor.name,supplier:vendor.name,
      description:description.slice(0,1300)||before.description||'',
      category:before.category||category,ean:ean||before.ean||'',
      specifications:before.specifications||{},
      source_url:url,image_url,image_source:'manufacturer_public_page',
      source_type:'manufacturer_public_catalog',record_status:'sku_and_image_verified',
      price:null,availability:null
    };
  });
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
  if(!policy){console.warn('Skipping',vendor.name,'until robots policy is available');continue}
  state[vendor.name]??={queue:[],seen:[]};
  const queue=state[vendor.name].queue,seen=new Set(state[vendor.name].seen);
  const pending=new Set(queue);
  const enqueue=url=>{
    if(!seen.has(url)&&!pending.has(url)&&policy.allowed(new URL(url).pathname)){
      queue.push(url);pending.add(url);
    }
  };
  // Revisit category and new-product hubs on every run so launches are discovered
  // even after the initial full traversal.
  for(const seed of vendor.seeds){
    const normalized=normalizeUrl(seed,vendor);
    if(normalized&&policy.allowed(new URL(normalized).pathname)){
      seen.delete(normalized);
      enqueue(normalized);
    }
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
    const found=parseProducts(html,url,vendor);
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
  console.log(vendor.name,{checked,added,updated,pending:queue.length,seen:seen.size});
}
const all=[...existing.values()].sort((a,b)=>a.manufacturer.localeCompare(b.manufacturer)||a.sku.localeCompare(b.sku));
await writeFile(PRODUCT_PATH,JSON.stringify(all,null,2)+'\n');
await writeFile(STATE_PATH,JSON.stringify(state,null,2)+'\n');
console.log('Combined public catalog',all.length,'new',finalAdded,'updated',finalUpdated,'photos',all.filter(p=>p.image_url).length);
