// Audit product image coverage and shared URLs without assuming repeated family photos are wrong.
import {readFile} from 'node:fs/promises';
const products=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const byImage=new Map();
const missing=[];
for(const product of products){
 if(!product.image_url){missing.push({id:product.id,manufacturer:product.manufacturer,sku:product.sku,name:product.name,source_url:product.source_url});continue}
 const url=product.image_url.trim();
 if(!byImage.has(url))byImage.set(url,[]);
 byImage.get(url).push({id:product.id,manufacturer:product.manufacturer,sku:product.sku,photo_status:product.photo_status||null,image_source:product.image_source||null});
}
const reused=[...byImage].filter(([,items])=>items.length>1).map(([image_url,items])=>({
 image_url,items,kind:items.every(p=>p.image_source==='official_manufacturer_shared_model_photo')?'declared_family_image':'manual_review'
})).sort((a,b)=>b.items.length-a.items.length);
const byBrand={};
for(const p of products){const row=byBrand[p.manufacturer]??={total:0,with_image:0,missing_image:0};row.total++;if(p.image_url)row.with_image++;else row.missing_image++}
const report={total:products.length,with_image:products.length-missing.length,missing_image:missing.length,unique_image_urls:byImage.size,reused_url_groups:reused.length,reused_urls:reused,by_brand:byBrand,missing};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else{
 console.log(`Catalog: ${report.total}; images: ${report.with_image}; missing: ${report.missing_image}; reused URL groups: ${reused.length}`);
 for(const [brand,row] of Object.entries(byBrand))console.log(`${brand}: ${row.with_image}/${row.total} photos, ${row.missing_image} missing`);
 for(const row of reused)console.log(`${row.kind}: ${row.items.length} entries share ${row.image_url}`);
 console.log('Use --json to list every missing product and reused URL for verification.');
}
