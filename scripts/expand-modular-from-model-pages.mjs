// Expand Modular only from actual manufacturer product pages that expose the SKU in a model heading.
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const file='data/catalog-products.json';
const products=JSON.parse(await readFile(file,'utf8'));
const name='Modular',target=101;
const modelCanon=x=>String(x||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const exists=new Set(products.filter(x=>x.manufacturer===name).map(x=>modelCanon(x.sku)));
const idExists=new Set(products.map(x=>x.id));
const report={checked_at:new Date().toISOString(),before:products.filter(x=>x.manufacturer===name).length,target,checked:[],added:[],errors:[]};
const end=105;
for(let n=1;n<=end;n++){
 if(products.filter(x=>x.manufacturer===name).length>=target)break;
 const url='https://www.modular.it/en/products/fun-600'+(n===1?'':'-'+n);
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(11000),headers:{'User-Agent':'GastroSkyVerifiedPublicCatalog/1.0',Accept:'text/html'}});
  if(!r.ok||new URL(r.url).hostname!=='www.modular.it')throw Error('HTTP '+r.status);
  const $=load(await r.text());
  const raw=$('h3').toArray().map(el=>$(el).text().replace(/\s+/g,' ').trim());
  const models=raw.filter(x=>/^[A-Z][0-9]{2}\/[A-Z0-9/._+%-]{3,42}$/i.test(x));
  if(models.length!==1){report.checked.push({url,reason:'no_unique_manufacturer_model_heading',models:models.slice(0,3)});continue}
  const sku=models[0],id='modular:'+sku;
  if(exists.has(modelCanon(sku))||idExists.has(id)){report.checked.push({url,reason:'already_in_catalog',sku});continue}
  const hs=$('h2').toArray().map(x=>$(x).text().replace(/\s+/g,' ').trim()).filter(x=>x&&!/^FUN\s*\d+/i.test(x)&&x.length>14&&x.length<140&&!/newsletter|subscribe|contact/i.test(x));
  const description=hs[0]||'Professional modular cooking unit';
  const isFryer=/fryer|fry\b/i.test(description),
   isGriddle=/griddle|fry top|fry-top/i.test(description),
   isPasta=/pasta/i.test(description);
  const category=isFryer?'Ipari olajsütők':isGriddle?'Sütőlapok':isPasta?'Tésztafőzők':'Főzőberendezések';
  const photoMatches=$('img').toArray().flatMap(el=>[$(el).attr('src'),$(el).attr('data-src')]).filter(Boolean).map(raw=>{try{return new URL(raw,r.url)}catch{return null}})
  .filter(x=>x&&x.protocol==='https:'&&x.hostname==='www.modular.it'&&/catalogo\/prodotti\/immagini/i.test(x.pathname))
  .filter(x=>modelCanon(decodeURIComponent(x.pathname)).includes(modelCanon(sku)));
  const image=photoMatches.length===1?photoMatches[0].href:null;
  const p={id,manufacturer:name,supplier:name,manufacturer_status:'verified_model_official_page',
   name:'Modular '+sku+' – '+description,sku,model:sku,category,ean:'',
   description:'Modular '+sku+'. '+description+'. A műszaki adatok a gyártó hivatalos termékoldalán ellenőrizhetők.',
   specifications:{'Termékcsalád':'FUN 600','Gyártói modell':sku},source_url:url,
   source_type:'official_product_page',record_status:'verified_manufacturer_model',
   image_url:image,image_source:image?'official_manufacturer_exact_model_photo':'manufacturer_image_pending',
   photo_match_type:image?'exact_manufacturer_sku_image_filename':null,
   stock_source_status:'pending_supplier_stock',price:null,availability:null};
  products.push(p);idExists.add(id);exists.add(modelCanon(sku));
  report.added.push({sku,model_url:url,name:p.name,image_url:image});
  report.checked.push({url,sku,added:true});
 }catch(e){report.errors.push({url,error:String(e.message||e).slice(0,100)})}
 await new Promise(r=>setTimeout(r,250));
}
report.after=products.filter(p=>p.manufacturer===name).length;
if(report.added.length){
 await writeFile(file,JSON.stringify(products,null,2)+'\n');
 let html=await readFile('index.html','utf8');
 const start=html.indexOf('let products='),end=html.indexOf(';\nconst categoryGroup=',start);
 if(start<0||end<0)throw Error('inline_catalog_missing');
 html=html.slice(0,start)+'let products='+JSON.stringify(products).replace(/</g,'\\u003c')+html.slice(end);
 await writeFile('index.html',html);
}
await writeFile('data/modular-101-expansion-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({before:report.before,after:report.after,added:report.added.length,photos:report.added.filter(x=>x.image_url).length,errors:report.errors.length,pages:report.checked.length}));
