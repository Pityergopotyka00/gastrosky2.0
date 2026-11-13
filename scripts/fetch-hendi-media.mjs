// Discover HENDI product photographs from their own publicly accessible metadata.
// Does not bypass login, scrape restricted services, or download images.
// Only accepts a photo when the correct HENDI SKU is present in the product page.
// Confirm image reuse permissions before making the catalog public.
import {readFile,writeFile} from 'node:fs/promises';
const file='data/catalog-products.json', htmlPath='index.html';
const products=JSON.parse(await readFile(file,'utf8'));
const isSupplier=(value)=>{try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='hendi.eu'||u.hostname.endsWith('.hendi.eu'))}catch{return false}};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function tags(html){return html.match(/<meta\b[^>]*>/gi)||[]}
function attr(tag,name){return tag.match(new RegExp('\\b'+name+'\\s*=\\s*["\x27]([^"\x27]+)["\x27]','i'))?.[1]||null}
function photo(html,base){
 for(const t of tags(html)){
  const name=attr(t,'property')||attr(t,'name');
  if(!['og:image','twitter:image'].includes(name))continue;
  const raw=attr(t,'content')?.replace(/&amp;/g,'&');
  if(!raw)continue;
  try{const url=new URL(raw,base).href;if(isSupplier(url))return url}catch{}
 }
 return null;
}
let successes=0;
for(const p of products.filter(p=>p.manufacturer==='HENDI')){
 try{
  if(!isSupplier(p.source_url))throw Error('invalid product source');
  const response=await fetch(p.source_url,{headers:{Accept:'text/html'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  const html=await response.text();
  const foundSku=new RegExp('(?:^|\\D)'+p.sku+'(?:\\D|$)').test(html);
  if(!foundSku)throw Error('SKU is not present on the manufacturer page');
  const url=photo(html,response.url||p.source_url);
  if(!url)throw Error('No verified manufacturer photo URL');
  p.image_url=url;p.image_source='manufacturer_og_image';successes++;
  console.log('OK',p.sku,url);
 }catch(e){console.warn('UNVERIFIED',p.sku,e.message)}
 await sleep(1100);
}
await writeFile(file,JSON.stringify(products,null,2)+'\n');
let index=await readFile(htmlPath,'utf8');
const start=index.indexOf('const products='),end=index.indexOf(';\nconst search=',start);
if(start<0||end<0)throw Error('Embedded catalog not found');
index=index.slice(0,start)+'const products='+JSON.stringify(products).replaceAll('<','\\u003c')+index.slice(end);
await writeFile(htmlPath,index);
console.log('HENDI image URLs verified:',successes,'/',products.filter(p=>p.manufacturer==='HENDI').length);
