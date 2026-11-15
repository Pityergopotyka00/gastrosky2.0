// Tecnodom: one catalog option for each official size code/length explicitly
// shown on the manufacturer specification page. TDV- SKU is an INTERNAL
// GastroSky reference, not a manufacturer part number.
import {readFile,writeFile} from 'node:fs/promises';
const file='data/catalog-products.json';
const products=JSON.parse(await readFile(file,'utf8'));
const probe=JSON.parse(await readFile('data/tecnodom-size-variant-probe.json','utf8'));
const brand='Tecnodom',target=101;
const starting=products.filter(p=>p.manufacturer===brand).length;
const existing=new Set(products.map(p=>p.id));
const sections={
 'tavoli-refrigerati':'Tecnodom – Hűtött munkapultok',
 'saladette':'Tecnodom – Salátahűtők',
 'arredamento-neutro':'Tecnodom – Rozsdamentes konyhai bútorok',
 'espositori-refrigerati':'Tecnodom – Hűtött bemutatópultok',
 'semimurali-evo':'Tecnodom – Függőleges hűtővitrinek',
 'semimurali-evok':'Tecnodom – Függőleges hűtővitrinek',
 'murali-refrigerati':'Tecnodom – Függőleges hűtővitrinek'
};
const groups=[];
for(const page of probe.pages){
 if(page.http!==200||!page.url?.startsWith('https://www.tecnodomspa.com/en/'))continue;
 const evidence=page.evidence?.find(x=>x.marker==='Available sizes')?.sample;
 if(!evidence)continue;
 const section=evidence.split(/DEPTH|HEIGHT|Operating temperature|Look for other|Support/i)[0];
 const choices=[...section.matchAll(/\b([A-Z]{2,6}\d{1,3}[A-Z0-9]{0,4}|\d{2,3})L\s*(\d{3,4})\b/g)]
   .map(m=>({code:m[1],length:Number(m[2])}))
   .filter(x=>x.length>=550&&x.length<=4000);
 const dedup=[...new Map(choices.map(x=>[x.code,x])).values()];
 if(dedup.length<2)continue;
 const pathname=new URL(page.url).pathname;
 const slug=pathname.replace(/^\/en\//,'').replace(/\.html$/,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toUpperCase();
 const family=(page.title||'Tecnodom').replace(/([A-Z])(\d{2,4})$/,'$1 $2').replace(/\s+/g,' ').trim();
 let category='Tecnodom – Hűtőberendezések';
 for(const [segment,cat] of Object.entries(sections)){if(pathname.includes('/'+segment+'/')){category=cat;break}}
 groups.push({url:page.url,family,category,slug,choices:dedup});
}
const report={checked_at:new Date().toISOString(),probe_date:probe.checked_at,before:starting,target,
 available_real_size_options:groups.reduce((n,x)=>n+x.choices.length,0),
 documented_families:groups.length,added:[],groups:groups.map(x=>({url:x.url,options:x.choices.length}))};
let cursor=0;
while(products.filter(x=>x.manufacturer===brand).length<target){
 let changes=0;
 for(const group of groups){
  if(products.filter(x=>x.manufacturer===brand).length>=target)break;
  const variant=group.choices[cursor];if(!variant)continue;
  const sku='TDV-'+group.slug+'-'+variant.code.toUpperCase();
  const id='tecnodom:variant:'+sku.toLowerCase();
  if(existing.has(id))continue;
  products.push({
   id,manufacturer:brand,supplier:'Tecnodom S.p.A.',manufacturer_status:'verified_manufacturer_available_size_option',
   name:'Tecnodom '+group.family+' – '+variant.code+' ('+variant.length+' mm)',
   model:group.family+' '+variant.code,
   sku,category:group.category,
   description:'Gyártói adatlap alapján ténylegesen kínált '+variant.length+' mm hosszú méretváltozat ('+variant.code+'). A TDV kezdetű cikkszám GastroSky belső azonosító, nem hivatalos gyártói SKU.',
   specifications:{'Gyártó által közölt méretkód':variant.code,'Hosszúság (mm)':String(variant.length),'Azonosító':'GastroSky belső katalóguskód'},
   source_url:group.url,source_type:'official_manufacturer_specification_size_table',
   record_status:'official_manufacturer_size_variant',
   image_url:null,image_source:'manufacturer_image_pending',
   publication_status:'available_size_from_manufacturer_specs_stock_unconfirmed',
   stock_source_status:'unknown',price:null,availability:null
  });
  existing.add(id);changes++;
  report.added.push({sku,model:group.family+' '+variant.code,length_mm:variant.length,manufacturer_page:group.url});
 }
 if(!changes)break;
 cursor++;
}
report.after=products.filter(x=>x.manufacturer===brand).length;
if(report.added.length){
 await writeFile(file,JSON.stringify(products,null,2)+'\n');
 let html=await readFile('index.html','utf8');
 const start=html.indexOf('let products='),end=html.indexOf(';\nconst categoryGroup=',start);
 if(start<0||end<0)throw Error('cannot_find_inline_catalog');
 html=html.slice(0,start)+'let products='+JSON.stringify(products).replace(/</g,'\\u003c')+html.slice(end);
 await writeFile('index.html',html);
}
await writeFile('data/tecnodom-101-expansion-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({before:report.before,after:report.after,added:report.added.length,real_size_options:report.available_real_size_options,documented_families:report.documented_families,first:report.added.slice(0,9)}));
