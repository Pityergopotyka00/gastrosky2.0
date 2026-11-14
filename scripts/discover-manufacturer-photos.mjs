// Discover exact manufacturer photographs for catalog entries with missing images.
// Usage:
//   npm run media:discover -- --limit=30
//   npm run media:discover -- --manufacturer=Maxima --limit=30 --apply
// NEVER use photos from a category page just because the brand matches.
import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';

const args=process.argv.slice(2);
const option=(name,fallback)=>args.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const limit=Math.min(1000,Math.max(1,Number(option('limit','30'))||30));
const manufacturer=option('manufacturer','');
const apply=args.includes('--apply');
const file='data/catalog-products.json';
const products=JSON.parse(await fs.readFile(file,'utf8'));
const currentImages=new Set(products.filter(p=>p.image_url).map(p=>p.image_url));
const candidates=products.filter(p=>!p.image_url&&(!manufacturer||p.manufacturer.toLowerCase()===manufacturer.toLowerCase())&&p.source_url).slice(0,limit);
const allowedHosts={
 Maxima:['maxima.com'],HENDI:['www.hendi.eu','hendi.eu'],
 Fagor:['www.fagorprofessional.com','fagorprofessional.com'],
 Modular:['www.modular.it','modular.it','www.thenicekitchen.com','thenicekitchen.com'],
 Coldline:['coldline.it','www.coldline.it'],Krupps:['www.krupps.com','krupps.com'],
 Aristarco:['www.aristarco.it','aristarco.it'],
 'Sistema Project Italia':['www.projectsystems.it','projectsystems.it'],
 Tecnodom:['www.tecnodomspa.com','tecnodomspa.com'],
 'Gastro Haal':['gastrohaal.sk','www.gastrohaal.sk'],
 GastroSky:['gastrosky.hu','www.gastrosky.hu']
};
const normalize=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const allowedPage=(p,u)=>allowedHosts[p.manufacturer]?.includes(u.hostname)&&!u.pathname.toLowerCase().endsWith('.pdf');
const validImage=(url,base,brand)=>{
 try{
  const u=new URL(url,base);
  if(u.protocol!=='https:'||u.hostname===new URL(base).hostname&&/logo|placeholder|fallback|default|no-image|icon/i.test(u.pathname))return null;
  if(!/^https?:$/.test(u.protocol)||/\.(svg|gif|pdf)(?:$|\?)/i.test(u.pathname)||/logo|placeholder|no-image/i.test(u.pathname))return null;
  // Accept only manufacturer-owned hosts, plus known official image CDN.
  const known=allowedHosts[brand]||[];
  const owned=known.some(h=>u.hostname===h||u.hostname.endsWith('.'+h));
  const cdn=brand==='HENDI'&&u.hostname==='hendi.xcdn.nl';
  if(!owned&&!cdn)return null;
  return u.href;
 }catch{return null}
};
async function get(url){
 const c=new AbortController();const timeout=setTimeout(()=>c.abort(),12000);
 try{const r=await fetch(url,{signal:c.signal,headers:{'User-Agent':'Mozilla/5.0 GastroSky catalog media research (contact: info@gastrosky.hu)','Accept':'text/html,application/xhtml+xml'}});if(!r.ok||!(r.headers.get('content-type')||'').includes('text/html'))return null;return await r.text()}
 finally{clearTimeout(timeout)}
}
function productsInJsonLd($){
 const found=[];
 for(const item of $('script[type="application/ld+json"]').toArray()){
  try{
   const obj=JSON.parse($(item).html()||'null');
   const visit=v=>{
    if(Array.isArray(v)){v.forEach(visit);return}
    if(!v||typeof v!=='object')return;
    if(String(v['@type']||'').toLowerCase().includes('product'))found.push(v);
    if(v['@graph'])visit(v['@graph']);
   };visit(obj)
  }catch{}
 }
 return found;
}
function getImageFromPage(html,p){
 const $=cheerio.load(html);const sku=normalize(p.sku);
 const ld=productsInJsonLd($);
 const matched=ld.filter(product=>[product.sku,product.mpn,product.productID].some(code=>normalize(code)===sku));
 let image=null,proof='';
 if(matched.length===1){
  const imgs=matched[0].image;
  image=typeof imgs==='string'?imgs:Array.isArray(imgs)?(typeof imgs[0]==='string'?imgs[0]:imgs[0]?.url):imgs?.url;
  proof='matching_product_json_ld_sku';
 }
 if(!image){
  // Only use the primary open-graph image for an *individual* product page.
  // The page must show SKU and explicit product-page metadata.
  const type=$('meta[property="og:type"]').attr('content')||'';
  const bodyText=$('body').text();
  const skusOnPage=bodyText.match(/(?:cikkszám|article number|item number|art\. ?no\.?|sku)\s*:?\s*([0-9]{6,12})/gi)||[];
  const exact=skusOnPage.some(text=>normalize(text).endsWith(sku));
  if(!/^product(?:$|\.)/i.test(type)||!exact)return null;
  image=$('meta[property="og:image"]').attr('content')||$('meta[name="twitter:image"]').attr('content');
  proof='product_metadata_and_visible_exact_sku';
 }
 if(!image)return null;
 const url=validImage(image,p.source_url,p.manufacturer);
 return url?{url,proof}:null;
}
const report={checked:0,matched:[],skipped:[],failed:[]};
for(let i=0;i<candidates.length;i+=3){
 await Promise.all(candidates.slice(i,i+3).map(async p=>{
  report.checked++;
  try{
   const page=new URL(p.source_url);
   if(!allowedPage(p,page)){report.skipped.push({id:p.id,reason:'non-manufacturer-or-PDF'});return}
   const html=await get(page);
   if(!html){report.skipped.push({id:p.id,reason:'page-unavailable'});return}
   const photo=getImageFromPage(html,p);
   if(!photo){report.skipped.push({id:p.id,reason:'no-exact-SKU-photo'});return}
   if(currentImages.has(photo.url)){report.skipped.push({id:p.id,reason:'already-used-photo-url'});return}
   // Content-type check rejects HTML error pages and unsupported formats.
   const c=new AbortController();const timeout=setTimeout(()=>c.abort(),8000);
   try{
    const response=await fetch(photo.url,{method:'HEAD',signal:c.signal});
    const contentType=response.headers.get('content-type')||'';
    if(!response.ok||!contentType.startsWith('image/')){report.skipped.push({id:p.id,reason:'image-url-not-verified'});return}
   }finally{clearTimeout(timeout)}
   currentImages.add(photo.url);
   report.matched.push({id:p.id,sku:p.sku,image_url:photo.url,proof:photo.proof});
   if(apply){p.image_url=photo.url;p.image_source='official_manufacturer_exact_sku';p.photo_status='manufacturer_product_photo_http_verified';}
  }catch(e){report.failed.push({id:p.id,reason:String(e.message||e).slice(0,150)})}
 }))
}
if(apply&&report.matched.length)await fs.writeFile(file,JSON.stringify(products,null,2)+'\n');
console.log(JSON.stringify({mode:apply?'applied':'dry-run',...report},null,2));
