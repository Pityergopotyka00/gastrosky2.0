// Match exact Modular model photographs from official manufacturer's product cards.
// Do not attach series photos, logo images, or a neighboring model's picture.
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const CATALOG='data/catalog-products.json';
const products=JSON.parse(await readFile(CATALOG,'utf8'));
const candidates=products.filter(p=>p.manufacturer==='Modular'&&!p.image_url&&p.source_url);
const allowedHosts=new Set(['www.modular.it','modular.it']);
const clean=s=>String(s??'').normalize('NFKC').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function officialUrl(raw,base){
 try{const url=new URL(raw,base);return url.protocol==='https:'&&allowedHosts.has(url.hostname)?url.href:null}catch{return null}
}
const bad=/logo|placeholder|banner|favicon|sprite|megamenu|certificate|drawing|footer/i;
const cache=new Map();
const policyCache=new Map();
async function allowedByRobots(url){
 const u=new URL(url),host=u.origin;
 if(!policyCache.has(host)){
  try{
   const r=await fetch(host+'/robots.txt',{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'GastroSkyCatalogMedia/1.0'}});
   policyCache.set(host,r.status===404?'':r.ok?(await r.text()).slice(0,100000):null);
  }catch{policyCache.set(host,null)}
 }
 const text=policyCache.get(host);if(text===null)return false;
 let active=false;const rules=[];
 for(const line of text.split(/\r?\n/)){
  const raw=line.split('#')[0].trim();const i=raw.indexOf(':');if(i<0)continue;
  const key=raw.slice(0,i).trim().toLowerCase(),value=raw.slice(i+1).trim();
  if(key==='user-agent'){active=value==='*';continue;}
  if(active&&(key==='allow'||key==='disallow')&&value)rules.push({key,path:value.split('*')[0]});
 }
 const matching=rules.filter(r=>u.pathname.startsWith(r.path)).sort((a,b)=>b.path.length-a.path.length);
 return !matching.length||matching[0].key==='allow';
}
async function loadPage(url){
 if(cache.has(url))return cache.get(url);
 if(!officialUrl(url)||!(await allowedByRobots(url)))throw Error('disallowed_official_product_page');
 const r=await fetch(url,{signal:AbortSignal.timeout(14000),headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogMedia/1.0'}});
 if(!r.ok||!officialUrl(r.url))throw Error('official_product_page_http_'+r.status);
 if(!(r.headers.get('content-type')||'').includes('text/html'))throw Error('non_html_product_page');
 const html=await r.text();if(html.length>2500000)throw Error('oversized_page');
 const record={html,url:r.url};cache.set(url,record);return record;
}
function imageFromElement($,el,base){
 const node=$(el),raw=node.attr('data-src')||node.attr('data-original')||node.attr('src')||node.attr('data-lazy-src')||node.attr('srcset')?.split(',')[0].trim().split(/\s+/)[0];
 if(!raw)return null;
 const uri=officialUrl(raw,base);
 if(!uri||bad.test(uri)||!/\.(png|jpe?g|webp)$/i.test(new URL(uri).pathname))return null;
 return uri;
}
function findExactPhoto(html,url,p){
 const $=load(html), code=clean(p.sku),model=clean(p.model||p.sku);
 const matches=[];
 const headings=$('h2,h3,h4,h5,.product-tab-detail').toArray().filter(el=>clean($(el).text())===model||clean($(el).text())===code);
 for(const heading of headings){
  let node=$(heading);
  for(let depth=0;depth<9;depth++){
   node=node.parent();if(!node.length)break;
   // Do not select from a large grid with several different product codes.
   const labels=node.find('.product-tab-detail').toArray().map(el=>clean($(el).text())).filter(Boolean);
   if(labels.some(label=>label!==model&&label!==code))break;
   const photos=node.find('.product-image img').toArray().map(el=>imageFromElement($,el,url)).filter(Boolean);
   if(photos.length===1){matches.push({url:photos[0],evidence:'exact_model_card'});break;}
   const specific=photos.filter(src=>code.length>=6&&clean(new URL(src).pathname).includes(code));
   if(specific.length===1){matches.push({url:specific[0],evidence:'exact_order_code_filename'});break;}
  }
 }
 // Manufacturer images often carry the exact order code MPxxxxx in filenames.
 // Match this only when the same product page names the model exactly.
 if(!matches.length&&code.length>=8&&headings.length){
  const imgs=$('.product-image img').toArray().map(el=>imageFromElement($,el,url)).filter(Boolean);
  const specific=imgs.filter(uri=>clean(decodeURIComponent(new URL(uri).pathname)).includes(code));
  if(specific.length===1)matches.push({url:specific[0],evidence:'model_heading_and_sku_filename'});
 }
 const unique=[...new Map(matches.map(x=>[x.url,x])).values()];
 return unique.length===1?unique[0]:null;
}
const existing=new Map();
for(const p of products)if(p.image_url){const key=new URL(p.image_url).origin+new URL(p.image_url).pathname;const arr=existing.get(key)||[];arr.push({id:p.id,model:clean(p.model||p.sku)});existing.set(key,arr);}
const report={checked_at:new Date().toISOString(),total_missing:candidates.length,checked:0,added:0,matched:[],unmatched:[]};
for(const p of candidates){
 report.checked++;
 try{
  const link=officialUrl(p.source_url);
  if(!link||/\.pdf(?:$|\?)/i.test(link))throw Error('source_not_html_product');
  const pg=await loadPage(link);
  const match=findExactPhoto(pg.html,pg.url,p);
  if(!match)throw Error('exact_model_card_photo_not_found');
  const img=match.url;
  const key=new URL(img).origin+new URL(img).pathname;
  const used=existing.get(key)||[];
  if(used.some(x=>x.model!==clean(p.model||p.sku)))throw Error('image_belongs_to_different_model');
  if(!(await allowedByRobots(img)))throw Error('image_robots_disallow_or_unknown');
  const res=await fetch(img,{method:'GET',signal:AbortSignal.timeout(13000),headers:{Range:'bytes=0-128','User-Agent':'GastroSkyCatalogMedia/1.0'}});
  const valid=res.ok&&(res.headers.get('content-type')||'').toLowerCase().startsWith('image/')&&officialUrl(res.url);
  await res.body?.cancel();
  if(!valid)throw Error('image_http_or_type_not_verified');
  p.image_url=img;p.image_source='official_modular_exact_model_card';
  p.photo_match_type=match.evidence;p.photo_status='manufacturer_product_photo_http_verified';
  existing.set(key,[...used,{id:p.id,model:clean(p.model||p.sku)}]);
  report.added++;report.matched.push({id:p.id,model:p.model||p.sku,image_url:img,proof:match.evidence});
 }catch(error){report.unmatched.push({id:p.id,model:p.model||p.sku,reason:String(error.message||error).slice(0,110)})}
 if(report.checked%10===0)console.log('Modular checked',report.checked,'matched',report.added);
 await sleep(280);
}
if(report.added){
 await writeFile(CATALOG,JSON.stringify(products,null,2)+'\n');
 let html=await readFile('index.html','utf8');
 const start=html.indexOf('let products='),end=html.indexOf(';\nconst categoryGroup=',start);
 if(start<0||end<0)throw Error('embedded_catalog_not_found');
 html=html.slice(0,start)+'let products='+JSON.stringify(products).replace(/</g,'\\u003c')+html.slice(end);
 await writeFile('index.html',html);
}
await writeFile('data/modular-photo-match-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checked:report.checked,photos_added:report.added,still_missing:report.unmatched.length}));
