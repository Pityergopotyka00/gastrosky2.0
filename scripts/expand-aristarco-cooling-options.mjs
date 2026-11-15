// Expand Aristarco only with factory-documented A/W cooling configurations.
// ARI-* is a GastroSky internal catalog reference, NOT a manufacturer SKU.
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const file='data/catalog-products.json',catalog=JSON.parse(await readFile(file,'utf8'));
const manufacturer='Aristarco',target=102;
const officialPages=[
 'https://www.aristarco.it/en/ice/categories/cubetto-pieno-18gr/cp/',
 'https://www.aristarco.it/en/ice/categories/hollow-ice-cube-17-gr/cv/'
];
const canon=s=>String(s||'').normalize('NFKD').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
const originals=new Map(catalog.filter(p=>p.manufacturer===manufacturer&&!p.id.includes(':configuration:')).map(p=>[canon(p.sku),p]));
const existingIds=new Set(catalog.map(p=>p.id));
const report={date:new Date().toISOString(),before:catalog.filter(p=>p.manufacturer===manufacturer).length,target,pages:[],added:[],skipped:[]};
for(const url of officialPages){
 if(catalog.filter(p=>p.manufacturer===manufacturer).length>=target)break;
 const page={url,verified_models:0,added:0};
 try{
  const response=await fetch(url,{headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogVerification/1.0'},signal:AbortSignal.timeout(19000)});
  page.http=response.status;
  if(!response.ok||new URL(response.url).hostname!=='www.aristarco.it')throw Error('official_product_page_unavailable');
  const $=load(await response.text());
  const full=$('body').text().replace(/\s+/g,' ').trim();
  const models=$('h3').toArray().map(el=>$(el).text().replace(/\s+/g,' ').trim()).filter(text=>/^(?:PHE|LYN)\s+[0-9]+(?:\.[0-9]+)?(?:\s+M)?$/.test(text));
  const start=full.indexOf('Models '+(url.includes('/cp/')?'Phoenix':'Lynx'));
  if(start<0||models.length<5)throw Error('official_model_table_not_found');
  for(let i=0;i<models.length;i++){
   if(catalog.filter(p=>p.manufacturer===manufacturer).length>=target)break;
   const model=models[i],p=originals.get(canon(model));
   if(!p){report.skipped.push({model,reason:'base_model_not_in_catalog'});continue}
   const here=full.indexOf(model,start);
   const next=i<models.length-1?full.indexOf(models[i+1],here+model.length):-1;
   const block=full.slice(here,next>here?next:here+1100);
   if(!/Dimensions/i.test(block)||!/\bCooling system:\s*A\s*\/\s*W\b/i.test(block)){
    report.skipped.push({model,reason:'no_individual_air_water_option_evidence'});continue;
   }
   page.verified_models++;
   for(const option of [{key:'A',hu:'léghűtéses',en:'air-cooled'},{key:'W',hu:'vízhűtéses',en:'water-cooled'}]){
    if(catalog.filter(p=>p.manufacturer===manufacturer).length>=target)break;
    const internal='ARI-'+canon(model)+'-'+option.key;
    const id='aristarco:configuration:'+internal.toLowerCase();
    if(existingIds.has(id))continue;
    catalog.push({id,manufacturer,supplier:manufacturer,
     manufacturer_status:'official_model_cooling_options',
     name:'Aristarco '+model+' – '+option.hu+' kivitel',sku:internal,model:model+' '+option.key,
     category:p.category,ean:'',
     description:'Az Aristarco '+model+' gyártói műszaki adatlapja A/W hűtési opciókat jelöl. '+(option.key==='A'?'Léghűtéses':'Vízhűtéses')+' konfiguráció. Az ARI kezdetű cikkszám GastroSky belső referencia, nem a gyártó által kiadott cikkszám.',
     specifications:{'Alapmodell':model,'Hűtési mód':option.hu,'Gyártói hűtési jelölés':'A/W','Azonosító típusa':'GastroSky belső referenciaszám'},
     source_url:url,source_type:'manufacturer_model_specification_cooling_option',
     record_status:'verified_manufacturer_cooling_configuration',
     image_url:null,image_source:'manufacturer_image_pending',price:null,availability:null,stock_source_status:'unverified'});
    existingIds.add(id);
    page.added++;report.added.push({model,configuration:option.en,internal_reference:internal,source_page:url});
   }
  }
 }catch(e){page.error=String(e.message||e).slice(0,150)}
 report.pages.push(page);
 await new Promise(r=>setTimeout(r,350));
}
report.after=catalog.filter(p=>p.manufacturer===manufacturer).length;
if(report.added.length){
 await writeFile(file,JSON.stringify(catalog,null,2)+'\n');
 let html=await readFile('index.html','utf8');
 const i=html.indexOf('let products='),j=html.indexOf(';\nconst categoryGroup=',i);
 if(i<0||j<0)throw Error('inline_catalog_not_found');
 html=html.slice(0,i)+'let products='+JSON.stringify(catalog).replace(/</g,'\\u003c')+html.slice(j);
 await writeFile('index.html',html);
}
await writeFile('data/aristarco-cooling-101-expansion-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({before:report.before,after:report.after,added:report.added.length,pages:report.pages,skipped:report.skipped.slice(0,10)}));
