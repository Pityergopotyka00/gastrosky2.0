// Add only manufacturer-printed standalone T-series worktable codes from
// Sistema Project Italia's 2025/26 official PDF catalog (pages 76-79).
// Images remain unset unless matched to an exact product code.
import {readFile,writeFile} from 'node:fs/promises';
const file='data/catalog-products.json';
const products=JSON.parse(await readFile(file,'utf8'));
const reportData=JSON.parse(await readFile('data/sistema-catalog-code-probe.json','utf8'));
const SOURCE='https://www.projectsystems.it/wp-content/uploads/2025/05/SistemaProject-Italia-catalogo-2025.pdf';
if(reportData.source!==SOURCE)throw Error('unexpected manufacturer catalogue');
const brand='Sistema Project Italia',target=101;
const table=[
 ['T80202','Oldalsó asztal, 700 mm'],
 ['T80202L','Oldalsó asztal, 1200 mm'],
 ['T80200','Munkapult, jobbos, 700 mm'],
 ['T80201','Munkapult, balos, 700 mm'],
 ['T80204','Munkapult, jobbos, 1200 mm'],
 ['T80203','Munkapult, balos, 1200 mm'],
 ['T80206L700','Mosogatómedencés munkapult, jobbos, 700 mm'],
 ['T80205L700','Mosogatómedencés munkapult, balos, 700 mm'],
 ['T80206','Mosogatómedencés munkapult, jobbos, 1200 mm'],
 ['T80205','Mosogatómedencés munkapult, balos, 1200 mm'],
 ['T80208','Mosogatómedencés és lefolyónyílásos munkapult, jobbos, 1200 mm'],
 ['T80207','Mosogatómedencés és lefolyónyílásos munkapult, balos, 1200 mm'],
 ['T70206','Munkapult, 700 mm'],
 ['T70217','Munkapult, jobbos, 700 mm']
];
const normalize=s=>String(s||'').replace(/[^A-Z0-9]/gi,'').toUpperCase();
const known=new Set(products.filter(p=>p.manufacturer===brand).map(p=>normalize(p.sku)));
const all=new Set(products.map(p=>p.id));
const samples=new Map(reportData.new_codes.map(x=>[x.sku.toUpperCase(),x]));
const result={checked_at:new Date().toISOString(),catalog:SOURCE,before:products.filter(p=>p.manufacturer===brand).length,target,added:[],rejected:[]};
for(const [sku,title] of table){
 if(products.filter(p=>p.manufacturer===brand).length>=target)break;
 if(known.has(normalize(sku))||all.has('sistemaproject:catalog2025-'+sku.toLowerCase()))continue;
 const found=samples.get(sku);
 if(!found){result.rejected.push({sku,reason:'not_found_in_official_pdf_text'});continue}
 if(found.page_number<76||found.page_number>82){result.rejected.push({sku,reason:'outside_washing_table_manufacturer_pages'});continue}
 const context=found.context;
 const index=context.indexOf('COD. '+sku);
 if(index<0){result.rejected.push({sku,reason:'not_individually_labelled_with_full_product_code'});continue}
 const after=context.slice(index+('COD. '+sku).length);
 if(!/Work table|Side table|Tavolo laterale|Piano di lavoro/i.test(after)){
  result.rejected.push({sku,reason:'no_table_description_after_code'});continue;
 }
 const match=after.match(/\bL\s*(\d{3,4})\s*X\s*P\s*(\d{3,4})\s*X\s*H\s*(\d{3,4})\s*MM/i);
 if(!match){result.rejected.push({sku,reason:'missing_manufacturer_dimensions'});continue}
 const [_,length,depth,height]=match;
 const id='sistemaproject:catalog2025-'+sku.toLowerCase();
 const p={
  id,manufacturer:brand,supplier:brand,manufacturer_status:'official_catalog_sku',
  name:'Sistema Project Italia '+sku+' – '+title,
  sku,model:sku,category:'Rozsdamentes mosogatóasztalok',ean:'',
  description:'Sistema Project Italia '+sku+' – '+title+
   '. A gyártó 2025/26-os katalógusában, a T110E–T1215–T1515 mosogatógépek kiegészítő asztalai között szereplő, valós cikkszám.',
  specifications:{'Hosszúság (mm)':length,'Mélység (mm)':depth,'Magasság (mm)':height,
    'Gyártói katalógus':'2025/26','PDF oldal':String(found.page_number)},
  source_url:SOURCE,source_type:'official_manufacturer_catalog_2025_26',
  record_status:'official_catalog_code_verified',
  image_url:null,image_source:'manufacturer_image_pending',
  photo_status:'product_photo_pending',stock_source_status:'supplier_stock_unverified',
  price:null,availability:null
 };
 products.push(p);known.add(normalize(sku));all.add(id);
 result.added.push({sku,title,dimensions_mm:[Number(length),Number(depth),Number(height)],pdf_page:found.page_number,source:SOURCE});
}
result.after=products.filter(p=>p.manufacturer===brand).length;
if(result.added.length){
 await writeFile(file,JSON.stringify(products,null,2)+'\n');
 let html=await readFile('index.html','utf8');
 const start=html.indexOf('let products='),end=html.indexOf(';\nconst categoryGroup=',start);
 if(start<0||end<0)throw Error('inline_catalog_not_found');
 html=html.slice(0,start)+'let products='+JSON.stringify(products).replace(/</g,'\\u003c')+html.slice(end);
 await writeFile('index.html',html);
}
await writeFile('data/sistema-101-expansion-report.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({before:result.before,after:result.after,added:result.added.length,rejected:result.rejected}));
