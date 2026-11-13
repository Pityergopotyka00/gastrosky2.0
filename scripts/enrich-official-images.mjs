// Best-effort official manufacturer photo enrichment for every missing catalog image.
// Does not guess a photo, copy media, or turn a category image into a product photo.
// Run from GitHub Actions with network access; only public pages with permitted robots policy.
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';

const file='data/catalog-products.json', htmlFile='index.html', reportFile='data/image-coverage-report.json';
const products=JSON.parse(await readFile(file,'utf8'));
const allowed={
 Aristarco:['aristarco.it'],Fagor:['fagorprofessional.com'],
 Modular:['modular.it','thenicekitchen.com'],Coldline:['coldline.it'],
 Krupps:['krupps.com'],HENDI:['hendi.eu','hendi.xcdn.nl'],
 Maxima:['maxima.com']
};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const norm=s=>String(s||'').normalize('NFKC').replace(/[\s\u00a0]+/g,' ').toUpperCase().trim();
const goodUrl=(u,brand)=>{try{const x=new URL(u);return x.protocol==='https:'&&allowed[brand]?.some(d=>x.hostname===d||x.hostname.endsWith('.'+d))&&/\.(jpg|jpeg|png|webp)(?:$|\?)/i.test(x.pathname+x.search)?x.href:null}catch{return null}};
const sourceUrl=(u,brand)=>{try{const x=new URL(u);return x.protocol==='https:'&&allowed[brand]?.some(d=>x.hostname===d||x.hostname.endsWith('.'+d))?x.href:null}catch{return null}};
const imageTags=['data-src','data-lazy-src','data-original','src','data-srcset','srcset'];
function imageOf($,elem,base,brand){
 const el=$(elem);for(const a of imageTags){let raw=el.attr(a)||'';if(a.includes('srcset'))raw=raw.split(',')[0]?.trim().split(/\s+/)[0]||'';if(!raw||raw.startsWith('data:'))continue;
  try{const url=goodUrl(new URL(raw,base).href,brand);if(url)return url}catch{}
 }
 return null;
}
function extractedMeta($,base,brand){
 for(const selector of ['meta[property="og:image"]','meta[name="twitter:image"]']){
  const raw=$(selector).attr('content');if(raw){const url=goodUrl(new URL(raw,base).href,brand);if(url)return url}
 }return null;
}
const robotsCache=new Map();
async function robotsPermits(url){
 const u=new URL(url),key=u.origin;if(!robotsCache.has(key)){
  try{const res=await fetch(key+'/robots.txt',{signal:AbortSignal.timeout(9000),headers:{'User-Agent':'GastroSkyCatalogMedia/1.0'}});
   if(res.status===404){robotsCache.set(key,'');}else if(res.ok){robotsCache.set(key,(await res.text()).slice(0,200000));}else{robotsCache.set(key,null);}
  }catch{robotsCache.set(key,null)}
 }
 const txt=robotsCache.get(key);if(txt===null)return false;
 // Conservative rules for wildcard user-agent; deny requested path on any matching rule.
 let active=false;
 for(const line of txt.split(/\r?\n/)){
  const s=line.split('#')[0].trim();if(!s)continue;
  const m=s.match(/^([\w-]+)\s*:\s*(.*)$/i);if(!m)continue;
  if(m[1].toLowerCase()==='user-agent'){active=m[2]==='*';continue}
  if(active&&m[1].toLowerCase()==='disallow'&&m[2].trim()){
   const pattern=m[2].trim().split('*')[0];if(pattern&&u.pathname.startsWith(pattern))return false;
  }
 }return true;
}
const pageCache=new Map();
async function page(url,brand){
 if(!sourceUrl(url,brand))throw Error('untrusted_source');
 if(pageCache.has(url))return pageCache.get(url);
 if(!(await robotsPermits(url)))throw Error('robots_disallow_or_unknown');
 const res=await fetch(url,{signal:AbortSignal.timeout(17000),headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogMedia/1.0 (+product-photo verification)'}});
 if(!res.ok)throw Error('HTTP_'+res.status);
 if(!sourceUrl(res.url,brand))throw Error('redirected_outside_supplier');
 const body=await res.text();if(body.length>3000000)throw Error('large_page');
 const doc=load(body);const obj={doc,url:res.url,body};pageCache.set(url,obj);return obj;
}
function aristarcoPhoto($,model,base){
 const code=norm(model);
 // Aristarco categories show product name immediately next to the associated image.
 // Search anchors and headings first; avoid accidental matches in navigation.
 let best=null,bestScore=Infinity;
 $('img').each((_,img)=>{
  const el=$(img);const image=imageOf($,img,base,'Aristarco');if(!image)return;
  let current=el;
  for(let depth=1;depth<=5;depth++){
   current=current.parent();if(!current.length)break;
   const texts=current.find('h2,h3,h4,h5,a,span,p').map((_,node)=>norm($(node).text())).get();
   const exact=texts.some(t=>t===code);
   if(!exact)continue;
   const text=norm(current.text()),score=depth*100+Math.min(text.length,999);
   if(score<bestScore){best={url:image,kind:'official_category_card',score};bestScore=score}
   break;
  }
 });
 if(best)return best;
 // If a model has an individual detail link, look there rather than using unrelated art.
 const link=$('a').filter((_,el)=>norm($(el).text())===code).first();
 if(link.length){const href=link.attr('href');if(href){try{return {detailUrl:new URL(href,base).href}}catch{}}}
 return null;
}
let filled=0,missed=[],byBrand={};const MAX=Number(process.env.PHOTO_CHECK_LIMIT||200);
let attempted=0;
for(const p of products){
 if(p.image_url)continue;
 if(attempted++>=MAX){missed.push({id:p.id,reason:'run_limit'});continue}
 const brand=p.manufacturer,src=p.source_url;
 let reason='unavailable';
 try{
  if(!sourceUrl(src,brand))throw Error('no_official_page');
  const {doc:$,url,body}=await page(src,brand);
  let found=null;
  if(brand==='Aristarco'){
   const result=aristarcoPhoto($,p.sku,url);
   if(result?.url)found=result.url;
   if(!found&&result?.detailUrl&&sourceUrl(result.detailUrl,brand)){
    const detail=await page(result.detailUrl,brand);
    if(norm(detail.doc('body').text()).includes(norm(p.sku)))
     found=extractedMeta(detail.doc,detail.url,brand);
   }
  }else{
   // Only exact SKU evidence on an individual product page qualifies.
   if(norm($('body').text()).includes(norm(p.sku))){
    found=extractedMeta($,url,brand);
    if(!found){
     const images=$('main img,article img,.product img').toArray();
     if(images.length===1)found=imageOf($,images[0],url,brand);
    }
   }else{reason='model_not_on_page'}
  }
  if(found){
   // Check that image actually serves image content before publishing.
   if(!(await robotsPermits(found)))throw Error('image_robots_unavailable');
   const res=await fetch(found,{method:'GET',signal:AbortSignal.timeout(16000),headers:{Range:'bytes=0-100','User-Agent':'GastroSkyCatalogMedia/1.0'}});
   if(!res.ok||!(res.headers.get('content-type')||'').toLowerCase().startsWith('image/'))throw Error('image_not_served');
   await res.body?.cancel();
   p.image_url=found;p.image_source=brand==='Aristarco'?'official_manufacturer_model_card':'official_manufacturer_product_page';
   p.photo_status='manufacturer_photo_url_found_permission_to_confirm';
   filled++;byBrand[brand]=(byBrand[brand]||0)+1;
  }else{missed.push({id:p.id,reason});}
 }catch(e){missed.push({id:p.id,reason:String(e.message||e).slice(0,100)})}
 if(attempted%10===0)console.log('Checked',attempted,'new photos',filled,'unresolved',missed.length);
 await delay(250);
}
await writeFile(file,JSON.stringify(products,null,2)+'\n');
let html=await readFile(htmlFile,'utf8');
const start=html.indexOf('let products='),end=html.indexOf(';\nconst search=',start);
if(start<0||end<0)throw Error('Cannot find embedded catalog');
html=html.slice(0,start)+'let products='+JSON.stringify(products).replace(/</g,'\\u003c')+html.slice(end);
await writeFile(htmlFile,html);
const report={checked_at:new Date().toISOString(),total:products.length,existing_images:products.filter(p=>p.image_url).length,new_photos:filled,by_brand:byBrand,unresolved:missed};
await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
console.log('Official image enrichment:',JSON.stringify({checked:attempted,new_photos:filled,unresolved:missed.length,byBrand}));
