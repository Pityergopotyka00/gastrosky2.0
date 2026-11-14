// One-time diagnostic: public manufacturer product media and missing-photo inventory.
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const products=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const brands={};
for(const p of products){
 const b=brands[p.manufacturer]??={total:0,with_photo:0,missing:0,source_examples:[],missing_examples:[],status_counts:{}};
 b.total++;if(p.image_url)b.with_photo++;else b.missing++;
 b.status_counts[p.record_status||'unknown']=(b.status_counts[p.record_status||'unknown']||0)+1;
 const sample={id:p.id,sku:p.sku,model:p.model,source_url:p.source_url,source_type:p.source_type,record_status:p.record_status,image_url:p.image_url};
 if(b.source_examples.length<3&&p.image_url)b.source_examples.push(sample);
 if(b.missing_examples.length<7&&!p.image_url)b.missing_examples.push(sample);
}
const probes=[
 {brand:'Modular',url:'https://www.modular.it/en/products/fun-600'},
 {brand:'Modular',url:'https://www.modular.it/en/catalog/modul-30-cm-9'},
 {brand:'Modular',url:'https://www.modular.it/en/catalog/modul-30-cm-3'},
 {brand:'Fagor',url:'https://www.fagorprofessional.com/en/kitchen-appliances/industrial-ovens/ikore'},
 {brand:'Fagor',url:'https://www.fagorprofessional.com/documents/d/global/catalogue-foodservice-en-export-1'},
 {brand:'Coldline',url:'https://coldline.it/en'},
 {brand:'Coldline',url:'https://coldline.it/en/catalog/1400-lt-5'},
 {brand:'Krupps',url:'https://www.krupps.com/en/catalogue/advance-range/'},
 {brand:'Gastro Haal',url:'https://gastrohaal.sk/hu/termekek/72_burgonyakoptatok/308_skz-25-burgonyakoptato-25kg-adag-ciklus'},
 {brand:'Gastro Haal',url:'https://gastrohaal.sk/hu/termekek/72_burgonyakoptatok/320_lo-1-hulladekfogo-a-burgonyakoptatohoz'},
 {brand:'Sistema Project Italia',url:'https://www.projectsystems.it/en/projects/a-series/'},
 {brand:'Tecnodom',url:'https://www.tecnodomspa.com/en/verticale.html'},
];
const results=[];
for(const {brand,url} of probes){
 const record={brand,url};
 try{
  const r=await fetch(url,{headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogMedia/1.0'},signal:AbortSignal.timeout(15000)});
  record.status=r.status;record.content_type=r.headers.get('content-type');record.redirect=r.url;
  if(record.content_type?.includes('text/html')){
   const html=await r.text();const $=load(html);
   record.body_codes=$('body').text().replace(/\\s+/g,' ').slice(0,800);
   record.title=$('title').text().slice(0,150);
   record.images=$('img').slice(0,16).map((_,el)=>{const x=$(el);return{src:x.attr('src'),lazy:x.attr('data-src'),alt:x.attr('alt'),parent:x.parent().attr('class')}}).get();
   record.meta_image=$('meta[property="og:image"]').attr('content');
   record.product_images=$('main img,.product-image img,.product-photo img,.woocommerce-product-gallery img,article img').slice(0,18).map((_,el)=>{const x=$(el);return{src:x.attr('src'),lazy:x.attr('data-src'),alt:x.attr('alt'),parent:x.parent().attr('class')}}).get();
   record.photo_links=$('a').toArray().filter(el=>/photo|image|fotografia/i.test($(el).text())).slice(0,12).map(el=>({title:$(el).text().trim().slice(0,50),href:$(el).attr('href')}));
   record.model_matches=$('h1,h2,h3,h4').toArray().filter(el=>/F60\/30PCG\/T|F60\/30FRESE\/1V10\/T/i.test($(el).text())).slice(0,4).map(el=>$(el).parent().html()?.slice(0,1000));
  }else{await r.body?.cancel();}
 }catch(e){record.error=String(e).slice(0,200)}
 results.push(record);
}
const report={checked_at:new Date().toISOString(),brands,probes:results};
await writeFile('data/supplier-image-layout.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({brands:Object.fromEntries(Object.entries(brands).map(([k,v])=>[k,{total:v.total,missing:v.missing}])),probes:results.map(v=>({brand:v.brand,status:v.status,images:v.images?.length,error:v.error}))}));
