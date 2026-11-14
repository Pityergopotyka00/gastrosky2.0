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
 Maxima:['maxima.com'],
 'Sistema Project Italia':['projectsystems.it'],Tecnodom:['tecnodomspa.com']
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
  try{const res=await fetch(key+'/robots.txt',{signal:AbortSignal.timeout(6500),headers:{'User-Agent':'GastroSkyCatalogMedia/1.0'}});
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
 const res=await fetch(url,{signal:AbortSignal.timeout(7500),headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogMedia/1.0 (+product-photo verification)'}});
 if(!res.ok)throw Error('HTTP_'+res.status);
 if(!sourceUrl(res.url,brand))throw Error('redirected_outside_supplier');
 const body=await res.text();if(body.length>3000000)throw Error('large_page');
 const doc=load(body);const obj={doc,url:res.url,body};pageCache.set(url,obj);return obj;
}
function aristarcoPhoto($,model,base){
 const code=norm(model), matches=[];
 // Search for exact model labels in each product tile, then use an image from
 // that tile only. A common shared image is acceptable when the maker assigns
 // it to the exact model card.
 $('img').each((_,img)=>{
  const url=imageOf($,img,base,'Aristarco');
  if(!url)return;
  let node=$(img);
  for(let depth=1;depth<=5;depth++){
   node=node.parent();if(!node.length)break;
   const labels=node.find('h2,h3,h4,h5,a,span,strong').toArray()
    .map(el=>norm($(el).text())).filter(t=>t.length<90);
   const exact=labels.some(t=>t===code);
   if(exact){
    const siblings=node.find('img').length,words=norm(node.text()).length;
    matches.push({url,score:depth*20+Math.min(words,300)+Math.max(0,siblings-1)*30});
    break;
   }
  }
 });
 matches.sort((a,b)=>a.score-b.score);
 return matches.length?{url:matches[0].url,kind:'official_category_card'}:null;
}

function possibleProductImage($,base,brand){
 const meta=extractedMeta($,base,brand);
 const candidates=[];
 if(meta&&!/(logo|icon|banner|placeholder|favicon)/i.test(meta))candidates.push(meta);
 $('main img,article img,.product img,.item-page img,.product-detail img,.content img').each((_,el)=>{
  const img=$(el),alt=norm(img.attr('alt')),src=imageOf($,el,base,brand);
  if(!src||/(logo|icon|flag|badge|thumb|sprite)/i.test(src))return;
  candidates.push(src);
 });
 return [...new Set(candidates)][0]||null;
}
async function officialRangePhoto($,url,p){
 const brand=p.manufacturer,model=norm(p.model||p.sku);
 const links=$('a[href]').toArray().map(el=>({label:norm($(el).text()),href:$(el).attr('href')}))
  .filter(x=>x.href&&x.label&&model&&x.label===model);
 for(const link of links.slice(0,4)){
  try{
   const target=new URL(link.href,url).href;
   if(!sourceUrl(target,brand)||target===url)continue;
   const detail=await page(target,brand);
   if(norm(detail.doc('body').text()).includes(model)){
    const img=possibleProductImage(detail.doc,detail.url,brand);
    if(img)return {url:img,type:'official_manufacturer_product_detail'};
   }
  }catch{}
 }
 if(brand==='Tecnodom'){
  // The public Horizontal/Vertical directory contains many models.
  // A generic directory image is not suitable for an individual product card.
  return null;
 }
 if(brand==='Sistema Project Italia'){
  // The linked page identifies the series, but does not necessarily distinguish
  // each model's appearance. Mark any shared series image clearly.
  const series=(p.sku||'').split(/[- _]/)[0];
  if(!norm($('body').text()).includes(norm(series)))return null;
  const image=possibleProductImage($,url,brand);
  return image?{url:image,type:'official_manufacturer_series_photo_not_specific_sku'}:null;
 }
 return null;
}

let filled=0,missed=[],byBrand={};const MAX=Number(process.env.PHOTO_CHECK_LIMIT||200);
// A generic or reused category photo should not masquerade as a new product photo.
const existingImages=new Map();
for(const product of products){if(product.image_url){const key=product.image_url.split('?')[0];existingImages.set(key,(existingImages.get(key)||0)+1);}}

let attempted=0;
const queue=products.filter(p=>!p.image_url).sort((a,b)=>{
 const priority=p=>p.manufacturer==='Tecnodom'?0:p.manufacturer==='Sistema Project Italia'?1:p.manufacturer==='Coldline'?2:p.manufacturer==='Krupps'?3:p.manufacturer==='Maxima'?4:p.manufacturer==='Modular'&&p.record_status!=='official_model_index_only'?5:6;
 return priority(a)-priority(b);
});
for(const p of queue){
 if(p.image_url)continue;
 // Manufacturer brochures require image-to-SKU page mapping; do not mislabel PDF graphics.
 if(/\.pdf(?:[/?#]|$)|\/documents\//i.test(p.source_url||'')){missed.push({id:p.id,reason:'manufacturer_pdf_manual_photo_matching_required'});continue;}
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
  }else if(brand==='Tecnodom'||brand==='Sistema Project Italia'){
   const matched=await officialRangePhoto($,url,p);
   if(matched){found=matched.url;p.photo_match_type=matched.type;}
   else reason='exact_range_photo_not_found';
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
   if(existingImages.has(found.split('?')[0])){
    missed.push({id:p.id,reason:'photo_url_already_assigned_to_another_product'});
    continue;
   }
   // Check that image actually serves image content before publishing.
   if(!(await robotsPermits(found)))throw Error('image_robots_unavailable');
   const res=await fetch(found,{method:'GET',signal:AbortSignal.timeout(7000),headers:{Range:'bytes=0-100','User-Agent':'GastroSkyCatalogMedia/1.0'}});
   if(!res.ok||!(res.headers.get('content-type')||'').toLowerCase().startsWith('image/'))throw Error('image_not_served');
   await res.body?.cancel();
   p.image_url=found;existingImages.set(found.split('?')[0],1);p.image_source=p.photo_match_type|| (brand==='Aristarco'?'official_manufacturer_model_card':'official_manufacturer_product_page');
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
