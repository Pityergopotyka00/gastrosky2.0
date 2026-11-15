// Add real HENDI models from manufacturer category cards, where SKU is
// in the official manufacturer-hosted image filename.
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const path='data/catalog-products.json';
const products=JSON.parse(await readFile(path,'utf8'));
const vendor='HENDI',target=101;
const categories=[
 ['https://www.hendi.eu/en/kitchen-appliances/grills-and-griddles/','Kontaktgrillek és sütőlapok'],
 ['https://www.hendi.eu/en/kitchen-appliances/deep-fryers/','Ipari olajsütők'],
 ['https://www.hendi.eu/en/kitchen-appliances/cookers/','Ipari főzőberendezések'],
 ['https://www.hendi.eu/en/kitchen-appliances/induction-cookers/','Indukciós főzőberendezések'],
 ['https://www.hendi.eu/en/kitchen-appliances/ovens/','Sütőberendezések'],
 ['https://www.hendi.eu/en/kitchen-appliances/microwaves/','Mikrohullámú sütők'],
 ['https://www.hendi.eu/en/kitchen-appliances/pizza/','Pizzakészítés'],
 ['https://www.hendi.eu/en/kitchen-appliances/dough-and-pasta-preparation/','Tésztakészítés']
];
const slp=ms=>new Promise(r=>setTimeout(r,ms));
const seenIds=new Set(products.map(p=>p.id));
const seenUrls=new Set(products.filter(p=>p.manufacturer===vendor).map(p=>p.source_url));
const report={checked_at:new Date().toISOString(),goal:target,before:products.filter(p=>p.manufacturer===vendor).length,pages:[],added:[],rejected:[]};
for(const [url,category] of categories){
 if(products.filter(p=>p.manufacturer===vendor).length>=target)break;
 const entry={url,category,found:0,added:0};
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{Accept:'text/html','User-Agent':'GastroSkyManufacturerCatalog/1.0'}});
  entry.status=r.status;
  if(!r.ok||new URL(r.url).hostname!=='www.hendi.eu')throw Error('manufacturer_category_unavailable');
  const $=load(await r.text());
  const cards=$('li.product-item').toArray();entry.found=cards.length;
  for(const el of cards){
   if(products.filter(p=>p.manufacturer===vendor).length>=target)break;
   const card=$(el);
   const anchor=card.find('strong.product-item-name a,a.product-item-link').first();
   const link=(anchor.attr('href')||card.find('a.product-item-info').first().attr('href')||'').trim();
   const title=(anchor.text()||card.find('strong.product-item-name').text()).replace(/\s+/g,' ').trim();
   const img=card.find('img.product-image-photo').first();
   const imgLink=(img.attr('data-src')||img.attr('src')||'').trim();
   const skuMatch=imgLink.match(/\/([0-9]{6,8})[_-][^/]+\.(?:jpe?g|png|webp)(?:[?#]|$)/i);
   if(!skuMatch||!title||title.length<4||!link){report.rejected.push({reason:'missing_official_product_sku_or_image',title:title.slice(0,90)});continue;}
   const sku=skuMatch[1],id='hendi:'+sku;
   if(seenIds.has(id)||seenUrls.has(link))continue;
   const linkUrl=new URL(link,url),photoUrl=new URL(imgLink,url);
   if(linkUrl.protocol!=='https:'||linkUrl.hostname!=='www.hendi.eu'||!/^\/en\/[^?]+\.html$/.test(linkUrl.pathname))continue;
   if(photoUrl.protocol!=='https:'||photoUrl.hostname!=='hendi.xcdn.nl')continue;
   if(/knife|blade|cutlery|weapon|spare.?part/i.test(title+' '+linkUrl.pathname))continue;
   products.push({id,manufacturer:vendor,supplier:vendor,sku,name:title,category,ean:'',
    description:'HENDI '+title+' – ellenőrzött gyártói katalógustermék. A pontos műszaki adatokat a gyártói termékoldal tartalmazza.',
    specifications:{'Gyártói cikkszám':sku},source_url:linkUrl.href,image_url:photoUrl.href,
    image_source:'manufacturer_sku_named_product_photo',photo_match_type:'sku_in_manufacturer_image_filename',
    photo_status:'official_manufacturer_product_photo',
    manufacturer_status:'official_product_page_linked_from_category',
    record_status:'sku_image_filename_verified',source_type:'official_manufacturer_product_category',stock_source_status:'not_verified',price:null,availability:null});
   seenIds.add(id);seenUrls.add(linkUrl.href);
   entry.added++;report.added.push({sku,name:title,category,source_url:linkUrl.href,image_url:photoUrl.href});
  }
 }catch(e){entry.error=String(e.message||e)}
 report.pages.push(entry);
 await slp(400);
}
report.after=products.filter(p=>p.manufacturer===vendor).length;
if(report.added.length){
 await writeFile(path,JSON.stringify(products,null,2)+'\n');
 let html=await readFile('index.html','utf8');
 const start=html.indexOf('let products='),end=html.indexOf(';\nconst categoryGroup=',start);
 if(start<0||end<0)throw Error('embedded_catalog_missing');
 html=html.slice(0,start)+'let products='+JSON.stringify(products).replace(/</g,'\\u003c')+html.slice(end);
 await writeFile('index.html',html);
}
await writeFile('data/hendi-101-expansion-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({before:report.before,after:report.after,added:report.added.length,categoryPages:report.pages}));
