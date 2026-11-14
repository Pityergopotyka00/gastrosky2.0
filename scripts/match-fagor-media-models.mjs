// Attach official Fagor images only when the photo file name contains
// the full exact manufacturer model code. No generic range substitutions.
import {readFile,writeFile} from 'node:fs/promises';
const apply=process.argv.includes('--apply');
const catalog='data/catalog-products.json',reportPath='data/fagor-model-filename-matches.json';
const products=JSON.parse(await readFile(catalog,'utf8'));
const media=JSON.parse(await readFile('data/fagor-official-media-index.json','utf8')).images;
const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
function nameFromUrl(u){
 try{
  const url=new URL(u);
  const seg=decodeURIComponent(url.pathname).split('/').find(s=>/\.(?:jpe?g|png|webp)(?:$|[/?])/i.test(s));
  return seg||decodeURIComponent(url.pathname.split('/').at(-1));
 }catch{return ''}
}
const photos=media.filter(x=>x.is_image).map(x=>({...x,file:nameFromUrl(x.image_url)}));
const report={checked_at:new Date().toISOString(),mode:apply?'applied':'dry_run',scanned:0,matched:[],unmatched:[]};
for(const p of products.filter(x=>x.manufacturer==='Fagor'&&!x.image_url)){
 report.scanned++;
 const model=normalize(p.model);
 if(model.length<7){report.unmatched.push({id:p.id,reason:'model_too_short_or_not_set'});continue}
 const matched=photos.filter(x=>normalize(x.file).includes(model));
 const unique=[...new Map(matched.map(x=>[x.image_url,x])).values()];
 if(unique.length!==1){report.unmatched.push({id:p.id,reason:unique.length?'multiple_model_filename_images':'no_matching_official_filename'});continue}
 const m=unique[0];
 if(apply){
  p.image_url=m.image_url;
  p.image_source='official_fagor_exact_model_in_image_filename';
  p.photo_match_type='exact_manufacturer_model_filename';
  p.photo_status='manufacturer_product_photo_http_verified';
 }
 report.matched.push({id:p.id,model:p.model,image_url:m.image_url,source_pages:m.source_pages});
}
report.added=apply?report.matched.length:0;
if(apply&&report.matched.length){
 await writeFile(catalog,JSON.stringify(products,null,2)+'\n');
 let html=await readFile('index.html','utf8');
 const start=html.indexOf('let products='),end=html.indexOf(';\nconst categoryGroup=',start);
 if(start<0||end<0)throw Error('embedded_catalog_not_found');
 html=html.slice(0,start)+'let products='+JSON.stringify(products).replace(/</g,'\\u003c')+html.slice(end);
 await writeFile('index.html',html);
}
await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({scanned:report.scanned,matched:report.matched.length,applied:report.added,reason_counts:report.unmatched.reduce((x,y)=>(x[y.reason]=(x[y.reason]||0)+1,x),{})}));
