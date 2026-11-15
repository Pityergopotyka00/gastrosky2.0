// After uploading the companion images under public/media/realistic-products/,
// run this installer once, then build/deploy. No generic image replaces official photos.
import {readFile,writeFile,access} from 'node:fs/promises';
await access('public/media/realistic-products/rice-cooker.webp');
const catalogFile='data/catalog-products.json', storefront='index.html';
const products=JSON.parse(await readFile(catalogFile,'utf8'));
const rice=products.filter(p=>p.manufacturer==='HENDI'&&String(p.sku)==='240410');
if(rice.length!==1)throw Error('Expected one HENDI SKU 240410, found '+rice.length);
rice[0].image_url='/media/realistic-products/rice-cooker.webp';
rice[0].image_source='generated_type_reference';
rice[0].photo_status='visual_reference_not_exact_model_photo';
await writeFile(catalogFile,JSON.stringify(products,null,2)+'\n');
let html=await readFile(storefront,'utf8');
const start=html.indexOf('let products='),end=html.indexOf(';\nconst categoryGroup=',start);
if(start<0||end<0)throw Error('Embedded catalog anchors missing');
html=html.slice(0,start)+'let products='+JSON.stringify(products).replace(/</g,'\\u003c')+html.slice(end);
await writeFile(storefront,html,'utf8');
console.log('HENDI 240410 now uses realistic rice-cooker picture; remember to deploy.');
