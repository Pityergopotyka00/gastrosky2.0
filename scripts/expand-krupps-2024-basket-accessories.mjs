// Official Krupps 2024 full price list: real dishwasher baskets and inserts.
// Printed catalog pages 98, 99 and 100 (PDF pages 100–102).
// No tools, detergents, spare chemicals, fictional SKUs or inferred prices.
import {readFile,writeFile} from 'node:fs/promises';
const path='data/catalog-products.json';
const products=JSON.parse(await readFile(path,'utf8'));
const brand='Krupps',target=101;
const pdf='https://www.krupps.com/download.php?fn=wp-content%2Fuploads%2Fsites%2F1%2F2024%2F10%2FPrice-List-UNIKO_IT_EN_FR_20240913';
const entries=[
 ['1153','Csészealj-tartó, 12 férőhely','295 × 90 × 80 mm',98],
 ['207035','Kerek pohármosó kosár, Ø350','Ø350 × 160 mm',98],
 ['207054','Négyzetes pohármosó kosár, 350×350','350 × 350 × 150 mm',98],
 ['208035','Kerek pohármosó kosár, Ø390','Ø390 × 160 mm',98],
 ['208052','Döntött pohármosó kosár, 3 rekeszes','400 × 400 × 180 mm',98],
 ['208057','Döntött pohármosó kosár, 4 rekeszes','400 × 400 × 180 mm',98],
 ['208054','Négyzetes pohármosó kosár, 400×400','400 × 400 × 150 mm',99],
 ['208055','Tányérmosó kosár, 9 férőhely','400 × 400 × 120 mm',99],
 ['800052','Döntött pohármosó kosár, 4 rekeszes','500 × 500 × 180 mm',99],
 ['800057','Döntött pohármosó kosár, 5 rekeszes','500 × 500 × 170 mm',99],
 ['800200','Tálcamosó kosár, 7 férőhely','500 × 500 × 100 mm',99],
 ['800201','Sűrű rácsú pohármosó kosár','500 × 500 × 100 mm',99],
 ['800202','Széles rácsú pohármosó kosár','500 × 500 × 100 mm',99],
 ['800211','Tányérmosó kosár, 18 férőhely','500 × 500 × 100 mm',99],
 ['800216K','Moduláris pohármosó kosár, 16 rekeszes','500 × 500 × 100 mm',100],
 ['800220K','Oldalt nyitott tálcamosó kosár, 4 tálca','500 × 500 × 180 mm',100],
 ['543300K','Tálcamosó kosár, 2 rekeszes','500 × 500 × 220 mm',100],
 ['640200','Tálcamosó kosár, 4 rekeszes','500 × 500 × 200 mm',100]
];
const canon=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const ids=new Set(products.map(p=>p.id));
const existing=new Set(products.filter(x=>x.manufacturer===brand).map(x=>canon(x.sku)));
const added=[],skipped=[];
const start=products.filter(x=>x.manufacturer===brand).length;
for(const [sku,title,dimensions,page] of entries){
 if(products.filter(x=>x.manufacturer===brand).length>=target)break;
 const id='krupps:catalog2024-'+sku.toLowerCase();
 if(ids.has(id)||existing.has(canon(sku))){skipped.push({sku,reason:'already_present'});continue}
 if(!/^\d{4,6}K?$/.test(sku))throw Error('unexpected non-manufacturer code '+sku);
 products.push({
  id,manufacturer:brand,supplier:brand,manufacturer_status:'official_krupps_catalog_accessory',
  name:'Krupps '+sku+' – '+title,
  sku,model:sku,category:'Mosogatógép-kosarak és betétek',ean:'',
  description:'Krupps '+sku+' – '+title+'. A Krupps hivatalos 2024-es katalógusában szereplő mosogatógép-kosár vagy betét. A rendelhetőséget az ajánlatkéréskor ellenőrizni kell.',
  specifications:{'Méret':dimensions,'Gyártói termékkód':sku,'Katalógus':'KRUPPS 2024','Katalógusoldal':String(page)},
  source_url:pdf,source_type:'official_manufacturer_catalog_2024',
  record_status:'official_manufacturer_accessory_code_verified',
  image_url:null,image_source:'manufacturer_image_pending',photo_status:'product_photo_pending',
  stock_source_status:'supplier_stock_unverified',price:null,availability:null
 });
 ids.add(id);existing.add(canon(sku));
 added.push({sku,title,dimensions,pdf_page:page,source:pdf});
}
const report={checked_at:new Date().toISOString(),source:pdf,before:start,target,after:products.filter(x=>x.manufacturer===brand).length,added,skipped};
if(added.length){
 await writeFile(path,JSON.stringify(products,null,2)+'\n');
 let html=await readFile('index.html','utf8');
 const a=html.indexOf('let products='),b=html.indexOf(';\nconst categoryGroup=',a);
 if(a<0||b<0)throw Error('inline_storefront_catalog_not_found');
 html=html.slice(0,a)+'let products='+JSON.stringify(products).replace(/</g,'\\u003c')+html.slice(b);
 await writeFile('index.html',html);
}
await writeFile('data/krupps-baskets-101-expansion-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({before:start,added:added.length,after:report.after,skipped}));
