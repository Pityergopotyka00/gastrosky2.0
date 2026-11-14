// Find correct product photos on official Gastro Haal / Tecnodom product pages.
// Only accept exact model captions or product-page metadata, never category banners.
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const path='data/catalog-products.json';
const products=JSON.parse(await readFile(path,'utf8'));
const target=products.filter(p=>!p.image_url&&['Gastro Haal','Tecnodom'].includes(p.manufacturer));
const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
const origins={
 'Gastro Haal':['gastrohaal.sk','www.gastrohaal.sk'],
 'Tecnodom':['tecnodomspa.com','www.tecnodomspa.com']
};
const trusted=(u,brand)=>{try{const x=new URL(u);return x.protocol==='https:'&&origins[brand].includes(x.hostname)}catch{return false}};
const cache=new Map(),reports={checked:0,added:0,matched:[],unmatched:[]},used=new Map();
for(const p of products)if(p.image_url){try{used.set(new URL(p.image_url).origin+new URL(p.image_url).pathname,(used.get(new URL(p.image_url).origin+new URL(p.image_url).pathname)||[]).concat({model:normalize(p.model||p.sku),id:p.id}));}catch{}}
async function page(url,brand){
 if(cache.has(url))return cache.get(url);
 if(!trusted(url,brand))throw Error('non_official_url');
 const resp=await fetch(url,{signal:AbortSignal.timeout(16000),headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogMedia/1.0'}});
 if(!resp.ok||!trusted(resp.url,brand))throw Error('source_http_'+resp.status);
 const html=await resp.text();if(html.length>2500000)throw Error('oversize');
 const out={url:resp.url,$:load(html)};cache.set(url,out);return out;
}
function officialImage(src,base,brand){
 try{
  const url=new URL(src,base);
  url.hash='';
  if(!trusted(url.href,brand)||!/\\.(jpe?g|png|webp)$/i.test(url.pathname)||/logo|banner|placeholder|icon|sprite/i.test(url.pathname))return null;
  return url.href;
 }catch{return null}
}
function pickImage(item,doc){
 const $=doc.$,model=normalize(item.model||item.sku),brand=item.manufacturer;
 if(brand==='Gastro Haal'){
  // Every individual /<id>_<slug> product page has one OpenGraph product photo.
  const last=new URL(doc.url).pathname.split('/').at(-1)||'';
  if(!last.startsWith(String(item.sku).trim()+'_'))return null;
  const title=normalize($('title').text());
  if(!title.includes(model))return null;
  const raw=$('meta[property="og:image"]').attr('content');
  const uri=officialImage(raw,doc.url,brand);
  if(!uri||!/\/userfiles\/products\/(?:zoom|thumb)\//i.test(new URL(uri).pathname))return null;
  return {url:uri,proof:'official_detail_page_id_title_and_og_product_photo'};
 }
 const images=[];
 $('img[alt]').each((_,node)=>{
  const n=$(node),label=normalize(n.attr('alt'));
  if(label!==model)return;
  const src=officialImage(n.attr('src')||n.attr('data-src'),doc.url,brand);
  if(src&&/\/images\/prodotti\//i.test(new URL(src).pathname))images.push(src);
 });
 const unique=[...new Set(images)];
 return unique.length===1?{url:unique[0],proof:'official_exact_model_alt_caption'}:null;
}
for(const p of target){
 reports.checked++;
 try{
  const doc=await page(p.source_url,p.manufacturer);
  const found=pickImage(p,doc);
  if(!found)throw Error('no_unambiguous_exact_model_photo');
  const key=new URL(found.url).origin+new URL(found.url).pathname;
  if((used.get(key)||[]).some(v=>v.model!==normalize(p.model||p.sku)))throw Error('photo_already_assigned_to_other_model');
  const res=await fetch(found.url,{method:'GET',headers:{Range:'bytes=0-128','User-Agent':'GastroSkyCatalogMedia/1.0'},signal:AbortSignal.timeout(11000)});
  const valid=res.ok&&trusted(res.url,p.manufacturer)&&(res.headers.get('content-type')||'').startsWith('image/');
  await res.body?.cancel();
  if(!valid)throw Error('photo_http_or_type_invalid');
  p.image_url=found.url;p.image_source=found.proof;p.photo_match_type=found.proof;
  p.photo_status='official_photo_http_verified';
  used.set(key,[...(used.get(key)||[]),{model:normalize(p.model||p.sku),id:p.id}]);
  reports.added++;reports.matched.push({id:p.id,url:found.url,proof:found.proof});
 }catch(e){reports.unmatched.push({id:p.id,reason:String(e.message||e).slice(0,110)})}
 await new Promise(r=>setTimeout(r,280));
}
if(reports.added){
 await writeFile(path,JSON.stringify(products,null,2)+'\n');
 let html=await readFile('index.html','utf8');
 const start=html.indexOf('let products='),end=html.indexOf(';\nconst categoryGroup=',start);
 if(start<0||end<0)throw Error('embedded_catalog_not_found');
 html=html.slice(0,start)+'let products='+JSON.stringify(products).replace(/</g,'\\u003c')+html.slice(end);
 await writeFile('index.html',html);
}
reports.checked_at=new Date().toISOString();
await writeFile('data/haal-tecnodom-photo-report.json',JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify({checked:reports.checked,added:reports.added,unmatched:reports.unmatched.length}));
