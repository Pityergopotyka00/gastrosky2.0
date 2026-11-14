// Only exact GastroSky product-title matches from the company's own site.
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const products=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const targets=products.filter(p=>p.manufacturer==='GastroSky'&&!p.image_url);
const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
const trusted=s=>{try{const u=new URL(s);return u.protocol==='https:'&&['gastrosky.hu','www.gastrosky.hu'].includes(u.hostname)}catch{return false}};
const bad=/logo|banner|header|footer|favicon|placeholder|noimage|spinner|sprite|icon|social|facebook|default|\/assets\/images\/partners\/|\/static_content_images\//i;
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
 const key=normalize(name), links=[];
 // Some legacy product URLs are relative, so inspect ALL anchors and resolve them.
 $('a[href]').each((_,el)=>{
  const raw=$(el).attr('href');if(!raw)return;
  try{
   const url=new URL(raw,base);
   if(!trusted(url.href)||!url.pathname.startsWith('/termekek/reszletek/'))return;
   const slug=decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1)||'');
   const node=$(el), surrounding=node.parent().text().replace(/\s+/g,' ').trim();
   const bySlug=normalize(slug)===key;
   const byText=normalize(node.text())===key||normalize(surrounding)===key;
   let byHeading=false,container=node;
   for(let i=0;i<5;i++){
    container=container.parent();if(!container.length)break;
    if(container.find('h2,h3,h4,h5,.product-title,.product-name').toArray().some(e=>normalize($(e).text())===key)){byHeading=true;break}
   }
   links.push({url:url.href,match:bySlug||byText||byHeading});
  }catch{}
 });
 const unique=a=>[...new Set(a)];
 const matches=unique(links.filter(x=>x.match).map(x=>x.url));
 if(matches.length===1)return matches;
 const all=unique(links.map(x=>x.url));
 // If a category contains a single product there is no ambiguity.
 if(all.length===1)return all;
 return [];
}
function exactTitle($,name){
 const key=normalize(name);
 return $('h1,h2,h3,h4,h5,.product-title,.product-name').toArray().some(el=>normalize($(el).text())===key) ||
  normalize($('body').text().split(/TERMÉK MEGNEVEZÉSE:/i)[1]?.split(/TERMÉKLEÍRÁS:/i)[0])===key;
}
function productImage($,base,productName){
 const found=new Map(),key=normalize(productName);
 function add(raw,el,source){
  if(!raw||/^data:/i.test(raw))return;
  try{
   // srcset consists of image-url/width pairs; use its highest-quality first entry.
   const url=new URL(String(raw).trim().split(/\s+\d+(?:w|x)(?:,|$)/)[0],base).href;
   if(!trusted(url)||bad.test(url))return;
   const node=el?$(el):null;
   if(node?.closest('header,footer,nav,aside').length)return;
   const lineage=node?node.parents().toArray().slice(0,6).map(e=>String($(e).attr('class')||'')+' '+String($(e).attr('id')||'')).join(' '):'';
   const desc=node?String(node.attr('alt')||''):'';
   const path=new URL(url).pathname;
   let score=0;
   if(/product|termek|galer|gallery|photo|fot[oó]|kep|k[eé]p|carousel/i.test(lineage))score+=6;
   if(/product|termek|fot[oó]|kep|k[eé]p|image/i.test(path))score+=2;
   // Original site embeds the real product photo as an inline CSS background.
   // It is distinguishable from footer partner logos by its /product_images/<id>/ path.
   if(/\/product_images\/\d+\/[^/]+\.(?:jpe?g|png|webp)$/i.test(path))score+=12;
   if(key&&normalize(desc)===key)score+=7;
   if(key&&normalize(path).includes(key))score+=5;
   if(node&&Number.parseInt(node.attr('width')||'0',10)>=180)score+=1;
   if(source==='detail-selector')score+=6;
   if(source==='og-image')score-=2;
   const prev=found.get(url);
   if(!prev||prev.score<score)found.set(url,{url,score,source});
  }catch{}
 }
 const detailSelectors='.product-detail img,.product_detail img,.product-gallery img,.product_gallery img,.termek-kep img,.termek_kep img,.termekfotok img,.product-image img,.product_image img,[class*="product-photo"] img,[class*="termek-kep"] img';
 $('img').each((_,el)=>{
  const node=$(el),specific=node.is(detailSelectors);
  for(const attr of ['data-src','data-original','data-lazy-src','data-large','data-zoom-image','src']){
   const raw=node.attr(attr);if(raw)add(raw,el,specific?'detail-selector':'img');
  }
  const srcset=node.attr('srcset')||node.attr('data-srcset');
  if(srcset){const first=srcset.split(',')[0]?.trim().split(/\s+/)[0];if(first)add(first,el,specific?'detail-selector':'srcset')}
 });
 $('[style*="url("]').each((_,el)=>{
  const style=$(el).attr('style')||'';
  for(const match of style.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi))add(match[1],el,'inline-background');
 });
 for(const prop of ['og:image','twitter:image']){
  const raw=$('meta[property="'+prop+'"],meta[name="'+prop+'"]').first().attr('content');
  if(raw)add(raw,null,'og-image');
 }
 const candidates=[...found.values()].sort((a,b)=>b.score-a.score);
 if(candidates.length===1&&candidates[0].source!=='og-image')return candidates[0].url;
 if(candidates.length&&!candidates[1]&&candidates[0].score>=4)return candidates[0].url;
 if(candidates.length&&candidates[0].score>=4&&candidates[0].score>candidates[1]?.score)return candidates[0].url;
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
  let links=categoryLinks(category.doc,category.url,p.name);
  if(!links.length){
   // The old store consistently uses /termekek/reszletek/<name-slug>.
   // We still require an EXACT product title from this derived detail URL.
   const slug=String(p.name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
   if(slug)links=['https://gastrosky.hu/termekek/reszletek/'+slug];
  }
  if(links.length!==1){result.unmatched.push({id:p.id,reason:'unique_product_link_not_found'});continue}
  const detail=await page(links[0]);
  if(!exactTitle(detail.doc,p.name)){result.unmatched.push({id:p.id,reason:'exact_title_not_confirmed',detail_url:links[0]});continue}
  const url=productImage(detail.doc,detail.url,p.name);
  if(!url||!(await validImage(url))){result.unmatched.push({id:p.id,reason:'specific_photo_not_verified',detail_url:links[0]});continue}
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
