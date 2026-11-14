// Only exact GastroSky product-title matches from the company's own site.
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const products=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const targets=products.filter(p=>p.manufacturer==='GastroSky'&&!p.image_url);
const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
const trusted=s=>{try{const u=new URL(s);return u.protocol==='https:'&&['gastrosky.hu','www.gastrosky.hu'].includes(u.hostname)}catch{return false}};
const bad=/logo|banner|header|footer|favicon|placeholder|noimage|spinner|sprite|icon|social|facebook|default/i;
const cache=new Map();
async function page(url){
 if(!trusted(url))throw Error('non_manufacturer_link');
 if(cache.has(url))return cache.get(url);
 const res=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogMedia/1.0'}});
 if(!res.ok||!trusted(res.url))throw Error('page_unavailable');
 const html=await res.text();if(html.length>2000000)throw Error('page_too_large');
 const parsed={doc:load(html),url:res.url};cache.set(url,parsed);return parsed;
}
function imageOf($,el,base){
 const node=$(el);
 for(const attr of ['data-src','data-original','data-lazy-src','src']){
  const raw=node.attr(attr);if(!raw||raw.startsWith('data:'))continue;
  try{const url=new URL(raw,base).href;if(trusted(url)&&!bad.test(url)&&/\.(jpe?g|webp|png)(\?|$)/i.test(url))return url}catch{}
 }return null;
}
function categoryLinks($,base,name){
 const key=normalize(name),found=[];
 $('a[href*="/termekek/reszletek/"]').each((_,el)=>{
  const link=$(el);let parent=link;
  for(let depth=0;depth<7;depth++){
   parent=parent.parent();if(!parent.length)break;
   const headings=parent.find('h1,h2,h3,h4,h5,.title,.name,.product-title').toArray().map(e=>normalize($(e).text()));
   if(headings.includes(key)){
    const url=new URL(link.attr('href'),base).href;
    if(trusted(url))found.push(url);break;
   }
  }
 });
 return [...new Set(found)];
}
function exactTitle($,name){
 const key=normalize(name);
 return $('h1,h2,h3,h4,h5,.product-title,.product-name').toArray().some(el=>normalize($(el).text())===key) ||
  normalize($('body').text().split(/TERMÉK MEGNEVEZÉSE:/i)[1]?.split(/TERMÉKLEÍRÁS:/i)[0])===key;
}
function productImage($,base){
 const selectors=['.product-detail img','.product_detail img','.product-gallery img','.product_gallery img','.termek-kep img','.termek_kep img','.termekfotok img','.product-image img','.product_image img','[class*="product-photo"] img','[class*="termek-kep"] img'];
 const images=[];
 for(const selector of selectors)$(selector).each((_,el)=>{const url=imageOf($,el,base);if(url)images.push(url)});
 const unique=[...new Set(images)];
 if(unique.length===1)return unique[0];
 const hero=$('meta[property="og:image"]').attr('content');
 if(hero)try{const src=new URL(hero,base).href;if(unique.includes(src))return src}catch{}
 return null;
}
async function validImage(url){
 const r=await fetch(url,{headers:{Range:'bytes=0-128','User-Agent':'GastroSkyCatalogMedia/1.0'},signal:AbortSignal.timeout(8500)});
 const ok=r.ok&&trusted(r.url)&&(r.headers.get('content-type')||'').startsWith('image/');
 await r.body?.cancel();return ok;
}
const result={checked_at:new Date().toISOString(),checked:0,new_photos:0,matched:[],unmatched:[]};
for(const p of targets){
 result.checked++;
 try{
  const category=await page(p.source_url);
  const links=categoryLinks(category.doc,category.url,p.name);
  if(links.length!==1){result.unmatched.push({id:p.id,reason:'unique_product_link_not_found'});continue}
  const detail=await page(links[0]);
  if(!exactTitle(detail.doc,p.name)){result.unmatched.push({id:p.id,reason:'exact_title_not_confirmed'});continue}
  const url=productImage(detail.doc,detail.url);
  if(!url||!(await validImage(url))){result.unmatched.push({id:p.id,reason:'specific_photo_not_verified'});continue}
  p.image_url=url;p.image_source='gastrosky_own_exact_product_detail';p.photo_match_type='official_gastrosky_exact_title';p.photo_status='manufacturer_product_photo_http_verified';
  result.new_photos++;result.matched.push({id:p.id,url,product_url:detail.url});
 }catch(e){result.unmatched.push({id:p.id,reason:String(e.message||e).slice(0,120)})}
}
if(result.new_photos){
 await writeFile('data/catalog-products.json',JSON.stringify(products,null,2)+'\n');
 let html=await readFile('index.html','utf8');
 const start=html.indexOf('let products='),end=html.indexOf(';\nconst categoryGroup=',start);
 if(start<0||end<0)throw Error('embedded_catalog_not_found');
 html=html.slice(0,start)+'let products='+JSON.stringify(products).replace(/</g,'\\u003c')+html.slice(end);
 await writeFile('index.html',html);
}
await writeFile('data/gastrosky-photo-match-report.json',JSON.stringify(result,null,2)+'\n');
console.log('GastroSky own site:',JSON.stringify({checked:result.checked,found:result.new_photos,unmatched:result.unmatched.length}));
