// Exact manufacturer product-panel photo import for Coldline model listings.
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const file='data/catalog-products.json';
const products=JSON.parse(await readFile(file,'utf8'));
const target=products.filter(x=>x.manufacturer==='Coldline'&&!x.image_url);
const clean=s=>String(s||'').normalize('NFKC').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
const official=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['coldline.it','www.coldline.it'].includes(u.hostname)}catch{return false}};
const cache=new Map(),policy=new Map(),used=new Map();
for(const p of products)if(p.image_url){try{const k=new URL(p.image_url).origin+new URL(p.image_url).pathname;used.set(k,[...(used.get(k)||[]),clean(p.model||p.sku)]);}catch{}}
async function allowedByRobots(url){
 const u=new URL(url);
 if(!policy.has(u.origin)){
  try{const r=await fetch(u.origin+'/robots.txt',{signal:AbortSignal.timeout(10000),headers:{'User-Agent':'GastroSkyCatalogMedia/1.0'}});
  policy.set(u.origin,r.status===404?'':r.ok?(await r.text()).slice(0,90000):null);}catch{policy.set(u.origin,null)}
 }
 const txt=policy.get(u.origin);if(txt===null)return false;
 const rules=[];let agent=false;
 for(const line of txt.split(/\r?\n/)){
  const t=line.split('#')[0].trim(),i=t.indexOf(':');if(i<0)continue;
  const key=t.slice(0,i).trim().toLowerCase(),value=t.slice(i+1).trim();
  if(key==='user-agent'){agent=value==='*';continue}
  if(agent&&(key==='allow'||key==='disallow')&&value)rules.push({key,path:value.split('*')[0]});
 }
 const selected=rules.filter(r=>u.pathname.startsWith(r.path)).sort((a,b)=>b.path.length-a.path.length);
 return !selected.length||selected[0].key==='allow';
}
async function loadPage(src){
 if(cache.has(src))return cache.get(src);
 if(!official(src)||!(await allowedByRobots(src)))throw Error('untrusted_or_robots_disallowed_page');
 const res=await fetch(src,{signal:AbortSignal.timeout(14000),headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogMedia/1.0'}});
 if(!res.ok||!official(res.url)||(res.headers.get('content-type')||'').indexOf('text/html')<0)throw Error('invalid_product_page');
 const html=await res.text();if(html.length>2300000)throw Error('large_product_page');
 const result={html,url:res.url};cache.set(src,result);return result;
}
function photo(html,base,sku){
 const $=load(html),name=clean(sku),found=[];
 // The original manufacturer markup has exactly one machine photo in a tab-pane
 // containing its unique <h3 class="product-tab-detail">MODEL</h3>.
 $('.tab-pane').each((_,node)=>{
  const panel=$(node),codes=panel.find('.product-tab-detail').toArray().map(e=>clean($(e).text())).filter(Boolean);
  if(!codes.includes(name))return;
  const img=panel.find('.product-image img');
  if(img.length!==1)return;
  const raw=img.attr('data-src')||img.attr('src');
  if(!raw)return;
  try{
   const u=new URL(raw,base);u.hash='';
   if(official(u.href)&&/\/catalogo\/prodotti\/immagini\//i.test(u.pathname)&&/\.(png|jpe?g|webp)$/i.test(u.pathname))found.push(u.href);
  }catch{}
 });
 const unique=[...new Set(found)];
 return unique.length===1?unique[0]:null;
}
const report={checked_at:new Date().toISOString(),missing:target.length,checked:0,added:0,matched:[],unmatched:[]};
for(const p of target){
 report.checked++;
 try{
  const pg=await loadPage(p.source_url);
  const img=photo(pg.html,pg.url,p.model||p.sku);
  if(!img)throw Error('exact_model_panel_photo_missing');
  const key=new URL(img).origin+new URL(img).pathname;
  if((used.get(key)||[]).some(model=>model!==clean(p.model||p.sku)))throw Error('image_used_for_another_model');
  if(!(await allowedByRobots(img)))throw Error('image_robots_disallow_or_unknown');
  const res=await fetch(img,{method:'GET',headers:{Range:'bytes=0-128','User-Agent':'GastroSkyCatalogMedia/1.0'},signal:AbortSignal.timeout(13000)});
  const valid=res.ok&&official(res.url)&&(res.headers.get('content-type')||'').toLowerCase().startsWith('image/');
  await res.body?.cancel();
  if(!valid)throw Error('image_http_unverified');
  p.image_url=img;p.image_source='official_coldline_exact_model_tab';p.photo_match_type='official_exact_model_tab_single_photo';
  p.photo_status='manufacturer_product_photo_http_verified';
  used.set(key,[...(used.get(key)||[]),clean(p.model||p.sku)]);
  report.added++;report.matched.push({id:p.id,model:p.model||p.sku,image_url:img});
 }catch(e){report.unmatched.push({id:p.id,reason:String(e.message||e).slice(0,120)})}
 await new Promise(r=>setTimeout(r,200));
}
if(report.added){
 await writeFile(file,JSON.stringify(products,null,2)+'\n');
 let html=await readFile('index.html','utf8');
 const start=html.indexOf('let products='),end=html.indexOf(';\nconst categoryGroup=',start);
 if(start<0||end<0)throw Error('embedded_catalog_not_found');
 html=html.slice(0,start)+'let products='+JSON.stringify(products).replace(/</g,'\\u003c')+html.slice(end);
 await writeFile('index.html',html);
}
await writeFile('data/coldline-photo-match-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checked:report.checked,added:report.added,unmatched:report.unmatched.length}));
