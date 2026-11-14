// Official public Fagor site: attach manufacturer photos ONLY for exact model labels.
// Other product families stay unresolved (never use generic hero banners).
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const data='data/catalog-products.json';
const products=JSON.parse(await readFile(data,'utf8'));
const target=products.filter(p=>p.manufacturer==='Fagor'&&!p.image_url&&p.model);
const host='www.fagorprofessional.com';
const root='https://'+host;
const pages=[
 '/en/kitchen-appliances/commercial-kitchen/independent-cooking',
 '/en/kitchen-appliances/commercial-kitchen/kore',
 '/en/kitchen-appliances/commercial-kitchen/high-production-equipment',
 '/en/kitchen-appliances/industrial-ovens/ikore',
 '/en/kitchen-appliances/industrial-ovens/compact',
 '/en/kitchen-appliances/industrial-ovens/accelerated-cooking-oven',
 '/en/kitchen-appliances/commercial-refrigeration/refrigeration-counters',
 '/en/kitchen-appliances/commercial-refrigeration/blast-chillers',
 '/en/kitchen-appliances/dynamic-preparation/industrial-hand-blenders',
 '/en/kitchen-appliances/dynamic-preparation/cutters-kitchen',
 '/en/kitchen-appliances/dynamic-preparation/professional-vegetable-cutter',
 '/en/kitchen-appliances/dynamic-preparation/professional-meat-mincers',
 '/en/kitchen-appliances/dynamic-preparation/potato-peelers'
];
const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
const legit=u=>{try{const x=new URL(u);return x.protocol==='https:'&&x.hostname===host}catch{return false}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const bad=/logo|flag|icon|placeholder|arrow|favicon|sprite|menu|banner|testimonio|portrait|clients|personal|social/i;
function photoSrc($,img,base){
 const el=$(img);
 for(const attr of ['data-src','data-original','data-lazy-src','src']){
  const raw=el.attr(attr);if(!raw||raw.startsWith('data:'))continue;
  try{const url=new URL(raw,base).href;
   if(legit(url)&&!bad.test(url)&&/\/documents\//i.test(new URL(url).pathname))return url;
  }catch{}
 }
 return null;
}
function scanPage(html,url){
 const $=load(html),matches=[];
 $('h2,h3,h4,h5').each((_,heading)=>{
  const raw=$(heading).text().replace(/\s+/g,' ').trim();
  if(!raw||raw.length>130)return;
  const label=normalize(raw);
  if(label.length<4)return;
  for(const p of target){
   const model=normalize(p.model);
   if(model.length<4||!label.endsWith(model)||label.length-model.length>40)continue;
   let container=$(heading),candidates=[];
   for(let depth=0;depth<7;depth++){
    container=container.parent();if(!container.length||container.is('body'))break;
    if(container.is('nav,header,footer'))break;
    const allImgs=container.find('img').toArray().map(img=>photoSrc($,img,url)).filter(Boolean);
    const uniq=[...new Set(allImgs)];
    if(uniq.length!==1)continue;
    const other=container.find('h2,h3,h4,h5').toArray().filter(h=>h!==heading && /YCV|iKORE|FAGOR|GRILL|SLICER|CHOPPER|MIXER|PEELER|CUTTER/i.test($(h).text())).length;
    if(other>2)continue;
    candidates.push({url:uniq[0],depth});break;
   }
   if(candidates.length===1)matches.push({id:p.id,model:p.model,photo:candidates[0].url,evidence:'manufacturer_exact_model_heading_plus_single_nearby_photo',page:url});
  }
 });
 return matches;
}
const report={checked_at:new Date().toISOString(),pages_checked:0,models_considered:target.length,confirmed:[],unresolved:[],pages:[]};
const candidates=new Map();
for(const raw of pages){
 const url=root+raw;const entry={url};
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogMedia/1.0'}});
  entry.status=r.status;
  if(!r.ok||!legit(r.url))throw Error('source_not_available');
  const html=await r.text();if(html.length>3000000)throw Error('large_page');
  const items=scanPage(html,r.url);
  entry.candidates=items.length;
  for(const item of items){const a=candidates.get(item.id)||[];a.push(item);candidates.set(item.id,a)}
 }catch(e){entry.error=String(e.message||e).slice(0,90)}
 report.pages.push(entry);report.pages_checked++;
 await sleep(360);
}
let added=0;
for(const p of target){
 const options=[...new Map((candidates.get(p.id)||[]).map(x=>[x.photo,x])).values()];
 if(options.length!==1){report.unresolved.push({id:p.id,reason:options.length?'ambiguous_multiple_official_photos':'no_exact_model_and_photo'});continue;}
 const c=options[0];
 try{
  const r=await fetch(c.photo,{method:'GET',signal:AbortSignal.timeout(13000),headers:{Range:'bytes=0-128','User-Agent':'GastroSkyCatalogMedia/1.0'}});
  const ok=r.ok&&legit(r.url)&&(r.headers.get('content-type')||'').toLowerCase().startsWith('image/');
  await r.body?.cancel();if(!ok)throw Error('photo_http_or_mime_not_verified');
  p.image_url=c.photo;p.image_source='fagor_official_public_model_page';p.photo_match_type='exact_model_heading_and_product_photo';
  p.photo_status='manufacturer_product_photo_http_verified';
  added++;report.confirmed.push({id:p.id,model:p.model,url:c.photo,source_page:c.page});
 }catch(e){report.unresolved.push({id:p.id,reason:String(e.message||e).slice(0,90)})}
 await sleep(150);
}
report.added=added;report.still_missing=products.filter(p=>p.manufacturer==='Fagor'&&!p.image_url).length;
if(added){
 await writeFile(data,JSON.stringify(products,null,2)+'\n');
 let html=await readFile('index.html','utf8');
 const start=html.indexOf('let products='),end=html.indexOf(';\nconst categoryGroup=',start);
 if(start<0||end<0)throw Error('embedded_catalog_not_found');
 html=html.slice(0,start)+'let products='+JSON.stringify(products).replace(/</g,'\\u003c')+html.slice(end);
 await writeFile('index.html',html);
}
await writeFile('data/fagor-official-photo-match-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pages:report.pages_checked,matched:added,still_missing:report.still_missing,errors:report.pages.filter(x=>x.error)}));
