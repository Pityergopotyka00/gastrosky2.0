// Catalog coverage target: at least 250 real photo-linked products per supplier.
// Report is informational; storefront does not claim completion prematurely.
import {readFile,writeFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const goal=250;
const brands=['Maxima','HENDI'];
const counts=Object.fromEntries(brands.map(name=>[name,{products:0,with_photo_url:0,missing_to_target:goal}]));
const seen=new Set();
const issues=[];
for(const p of catalog){
 if(!brands.includes(p.manufacturer))continue;
 if(seen.has(p.id))issues.push('Duplicate ID: '+p.id);
 seen.add(p.id);
 counts[p.manufacturer].products++;
 if(p.image_url&&/^https:\/\//.test(p.image_url))counts[p.manufacturer].with_photo_url++;
}
for(const brand of brands)counts[brand].missing_to_target=Math.max(0,goal-counts[brand].products);
const report={
 target_per_supplier:goal,target_total:goal*brands.length,
 current_total:catalog.length,counts,
 complete:brands.every(name=>counts[name].products>=goal&&counts[name].with_photo_url>=goal),
 notes:'Photo URLs are not proof of successful image delivery. Run the separate image audit.',
 issues
};
await writeFile('data/catalog-coverage.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(process.env.REQUIRE_COMPLETE_CATALOG==='true'&&!report.complete)process.exitCode=1;
