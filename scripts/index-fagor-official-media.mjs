// Index public manufacturer-hosted Fagor kitchen equipment imagery without
// claiming a range photograph depicts a particular SKU.
import {writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const origin='https://www.fagorprofessional.com';
const paths=[
 '/en/kitchen-appliances',
 '/en/kitchen-appliances/commercial-kitchen',
 '/en/kitchen-appliances/commercial-kitchen/kore',
 '/en/kitchen-appliances/commercial-kitchen/independent-cooking',
 '/en/kitchen-appliances/commercial-kitchen/high-production-equipment',
 '/en/kitchen-appliances/industrial-ovens',
 '/en/kitchen-appliances/industrial-ovens/ikore',
 '/en/kitchen-appliances/industrial-ovens/compact',
 '/en/kitchen-appliances/industrial-ovens/accelerated-cooking-oven',
 '/en/kitchen-appliances/industrial-ovens/accessories',
 '/en/kitchen-appliances/commercial-refrigeration',
 '/en/kitchen-appliances/commercial-refrigeration/refrigeration-cabinets',
 '/en/kitchen-appliances/commercial-refrigeration/refrigeration-counters',
 '/en/kitchen-appliances/commercial-refrigeration/preparation-counters',
 '/en/kitchen-appliances/commercial-refrigeration/blast-chillers',
 '/en/kitchen-appliances/commercial-refrigeration/coolers',
 '/en/kitchen-appliances/preparation-distribution',
 '/en/kitchen-appliances/dynamic-preparation',
 '/en/kitchen-appliances/dynamic-preparation/industrial-hand-blenders'
];
const banned=/logo|icon|flag|favicon|arrow|header|footer|facebook|instagram|whatsapp|social|testimon|client|portrait|banner|home-carousel|brand|ico-/i;
const result={checked_at:new Date().toISOString(),pages:[],images:[]};
const found=new Map();
const official=(raw,base)=>{try{const u=new URL(raw,base);return u.protocol==='https:'&&u.hostname==='www.fagorprofessional.com'?u.href:null}catch{return null}};
for(const path of paths){
 const url=origin+path;
 const entry={url,photos:0};
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(14000),headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogMedia/1.0'}});
  entry.http=r.status;if(!r.ok)throw Error('page_unavailable');
  const $=load(await r.text());
  for(const node of $('img').toArray()){
   const img=$(node);
   if(img.closest('nav,header,footer').length)continue;
   const raw=img.attr('data-src')||img.attr('data-lazy-src')||img.attr('src')||'';
   const src=official(raw,r.url);
   if(!src||banned.test(new URL(src).pathname)||!new URL(src).pathname.includes('/documents/'))continue;
   const parent=img.parent().parent();
   const title=parent.find('h2,h3,h4,h5').first().text().trim().slice(0,150)
     ||img.attr('alt')||$('h1').first().text().trim().slice(0,120)||null;
   const item=found.get(src)||{image_url:src,source_pages:[],category:path,title};
   if(!item.source_pages.includes(url))item.source_pages.push(url);
   found.set(src,item);entry.photos++;
  }
 }catch(e){entry.error=String(e.message||e).slice(0,110)}
 result.pages.push(entry);
 await new Promise(r=>setTimeout(r,200));
}
const images=[...found.values()];
for(const item of images.slice(0,100)){
 try{
  const r=await fetch(item.image_url,{method:'GET',signal:AbortSignal.timeout(8000),headers:{Range:'bytes=0-100','User-Agent':'GastroSkyCatalogMedia/1.0'}});
  item.is_image=r.ok&&(r.headers.get('content-type')||'').toLowerCase().startsWith('image/');
  item.mime=r.headers.get('content-type')||null;
  await r.body?.cancel();
 }catch(e){item.is_image=false;item.error=String(e.message||e).slice(0,80)}
}
result.images=images.filter(x=>x.is_image);
result.unknown=images.length-result.images.length;
await writeFile('data/fagor-official-media-index.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({pages:result.pages.length,candidates:images.length,verified_image_links:result.images.length,unverified:result.unknown}));
