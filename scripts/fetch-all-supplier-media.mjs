// Discover public product images from the matching manufacturers' product pages.
// Run after confirming reseller image usage rights, do not bypass restricted URLs.
// Only accept official media links and supplier-SKU-validated product pages.
import {readFile,writeFile} from 'node:fs/promises';
const file='data/catalog-products.json';
const products=JSON.parse(await readFile(file,'utf8'));
const domainOk=(url,p)=>{
 try{
  const u=new URL(url);
  const base=p.manufacturer==='Maxima'?'maxima.com':'hendi.eu';
  return u.protocol==='https:'&&(u.hostname===base||u.hostname.endsWith('.'+base));
 }catch{return false}
};
function attr(tag,name){
 const reg=new RegExp('\\b'+name+'\\s*=\\s*["\x27]([^"\x27]+)["\x27]','i');
 return tag.match(reg)?.[1]||null;
}
function imageFrom(html,base,p){
 for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){
  const name=attr(tag,'name')||attr(tag,'property');
  if(!['og:image','twitter:image'].includes(name))continue;
  const raw=attr(tag,'content')?.replace(/&amp;/g,'&');
  if(!raw)continue;
  try{const url=new URL(raw,base).href;if(domainOk(url,p))return url}catch{}
 }
 return null;
}
let found=0,failed=0;
for(const p of products){
 if(p.image_url)continue;
 try{
  if(!p.source_url||!domainOk(p.source_url,p))throw Error('no verified product URL');
  const response=await fetch(p.source_url,{headers:{Accept:'text/html'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  const html=await response.text();
  // Only trust the photo when the product identifier appears on the destination page.
  if(!html.includes(p.sku))throw Error('SKU absent from product page');
  const image=imageFrom(html,response.url||p.source_url,p);
  if(!image)throw Error('no matching official product image');
  p.image_url=image;p.image_source='manufacturer_og_image';found++;
  console.log(p.manufacturer,p.sku,'image found');
 }catch(e){failed++;console.warn(p.manufacturer,p.sku,String(e.message||e))}
 await new Promise(resolve=>setTimeout(resolve,900));
}
await writeFile(file,JSON.stringify(products,null,2)+'\n');
let html=await readFile('index.html','utf8');
const start=html.indexOf('const products='),end=html.indexOf(';\nconst search=',start);
if(start<0||end<0)throw Error('Catalog embedding not found');
html=html.slice(0,start)+'const products='+JSON.stringify(products).replaceAll('<','\\u003c')+html.slice(end);
await writeFile('index.html',html);
console.log('New photo URLs:',found,'Unresolved:',failed);
