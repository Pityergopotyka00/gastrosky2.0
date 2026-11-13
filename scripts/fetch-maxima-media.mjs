// Retrieves each product's own OG image metadata. Updates JSON and standalone HTML.
// Automated downloading/redistribution of supplier images requires dealer permission.
import {readFile,writeFile} from 'node:fs/promises';
const dataFile='data/maxima-products.json';
const htmlFile='index.html';
const products=JSON.parse(await readFile(dataFile,'utf8'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function isMaxima(url) {
 try {const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='maxima.com'||u.hostname.endsWith('.maxima.com'));}catch{return false}
}
function decode(s){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'")}
function imageFrom(html,source){
 // Magento's SEO metadata is normally in the initial HTML response.
 const tags=html.match(/<meta\b[^>]*>/gi)||[];
 for(const tag of tags){
  if(!/\b(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["']/i.test(tag))continue;
  const match=tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
  if(match){const image=new URL(decode(match[1]),source).href;if(isMaxima(image))return image;}
 }
 return null;
}
let updated=0,failed=0;
for(const p of products){
 try{
  if(!isMaxima(p.source_url))throw new Error('invalid product source');
  const response=await fetch(p.source_url,{headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogMedia/0.2 (merchant catalog migration)'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const html=await response.text();
  if(!html.includes(p.sku))throw new Error('SKU not found in supplier product page');
  const photo=imageFrom(html,response.url||p.source_url);
  if(!photo)throw new Error('No usable official og:image');
  p.image_url=photo;p.image_source='manufacturer_og_image';updated++;
  console.log('OK',p.sku,photo);
 }catch(e){failed++;console.warn('FAILED',p.sku,e.message)}
 await sleep(900);
}
await writeFile(dataFile,JSON.stringify(products,null,2)+'\n');
let index=await readFile(htmlFile,'utf8');
const start=index.indexOf('const products=');
const end=index.indexOf(';\nconst search=',start);
if(start<0||end<0)throw new Error('Cannot find embedded product data in HTML');
index=index.slice(0,start)+'const products='+JSON.stringify(products).replace(/</g,'\\u003c')+index.slice(end);
await writeFile(htmlFile,index);
console.log('Updated',updated,'official image links;',failed,'unresolved. Review photo licensing and visuals.');
