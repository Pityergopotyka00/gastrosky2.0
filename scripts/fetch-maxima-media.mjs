// Refresh product photo links from the manufacturers' public metadata.
// Use only if GastroSky has distribution/display rights for supplier media.
import {readFile,writeFile} from 'node:fs/promises';
const path='data/maxima-products.json';
const products=JSON.parse(await readFile(path,'utf8'));
const unescape=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"');
const originAllowed=url=>{try{const u=new URL(url);return u.protocol==='https:' && (u.hostname==='maxima.com'||u.hostname.endsWith('.maxima.com'))}catch{return false}};
const parseMeta=(html)=>{
 const tags=[...html.matchAll(/<meta\b[^>]+>/gi)].map(m=>m[0]);
 const tag=tags.find(t=>/\b(?:property|name)=["'](?:og:image|twitter:image)["']/i.test(t));
 const image=tag?.match(/\bcontent=["']([^"']+)["']/i)?.[1];
 if(!image)return null;
 return unescape(image);
};
let found=0;
for(const p of products){
 if(!originAllowed(p.source_url)){console.warn('Skipping invalid supplier source',p.sku);continue}
 try{
  const res=await fetch(p.source_url,{headers:{Accept:'text/html'}});
  if(!res.ok){console.warn('HTTP',res.status,p.sku);continue}
  const image=parseMeta(await res.text());
  if(image&&originAllowed(image)){p.image_url=image;p.image_source='manufacturer_og_image';found++;console.log('Image',p.sku,image)}
  else console.log('No usable supplier image',p.sku);
 }catch(e){console.warn('Could not fetch',p.sku,String(e))}
 await new Promise(r=>setTimeout(r,800));
}
await writeFile(path,JSON.stringify(products,null,2)+'\n');
console.log('Refreshed',found,'images. Verify permissions and each image visually before publication.');
