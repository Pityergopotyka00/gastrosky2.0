// Catalog target: at least 50 distinct entries per manufacturer, with honest media/verification reporting.
import {readFile,writeFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const goal=50;
const brands=['Maxima','HENDI','Fagor','Modular','Coldline','Krupps','Aristarco','Sistema Project Italia'];
const counts=Object.fromEntries(brands.map(name=>[name,{products:0,verified_products:0,model_only:0,with_photo_url:0,missing_to_target:goal}]));
const seen=new Set();
const issues=[];
for(const p of catalog){
  if(!brands.includes(p.manufacturer)){issues.push('Unexpected manufacturer: '+p.manufacturer);continue;}
  if(seen.has(p.id)){issues.push('Duplicate ID: '+p.id);continue;}
  seen.add(p.id);
  const entry=counts[p.manufacturer];
  entry.products++;
  if(p.record_status==='official_model_index_only')entry.model_only++;
  else entry.verified_products++;
  if(p.image_url && /^https:\/\//.test(p.image_url))entry.with_photo_url++;
}
for(const brand of brands)counts[brand].missing_to_target=Math.max(0,goal-counts[brand].products);
const report={
  target_per_supplier:goal,
  target_total:goal*brands.length,
  current_total:seen.size,
  counts,
  complete:brands.every(name=>counts[name].products>=goal),
  all_entries_have_photos:brands.every(name=>counts[name].with_photo_url>=counts[name].products),
  notes:'Model-only entries are official model identifiers awaiting product-level SKU/spec/photo verification. Photo URL presence does not guarantee a working image or display rights. Do not represent model-only entries as verified individual SKUs.',
  issues
};
await writeFile('data/catalog-coverage.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(process.env.REQUIRE_COMPLETE_CATALOG==='true'&&!report.complete)process.exitCode=1;
