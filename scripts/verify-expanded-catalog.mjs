// Regression contract: every non-exempt manufacturer has over 100 entries.
// GastroSky and Gastro Haal must retain exactly their original public assortments.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const catalog=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const by=new Map();
for(const item of catalog){
 if(!by.has(item.manufacturer))by.set(item.manufacturer,[]);
 by.get(item.manufacturer).push(item);
}
for(const brand of ['Aristarco','Coldline','Fagor','HENDI','Krupps','Maxima','Modular','Sistema Project Italia','Tecnodom']){
 assert.ok((by.get(brand)||[]).length>=101,brand+' has fewer than 101 verified catalog entries');
}
assert.equal(by.get('GastroSky')?.length,33,'Do not add GastroSky products without approval');
assert.equal(by.get('Gastro Haal')?.length,13,'Do not add Gastro Haal products without approval');
const skuCanon=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
for(const brand of ['Aristarco','HENDI','Krupps','Modular','Sistema Project Italia','Tecnodom']){
 const seen=new Set();
 for(const x of by.get(brand)||[]){
  const key=skuCanon(x.sku);
  assert.ok(key,'missing SKU '+x.id);
  assert.ok(!seen.has(key),'duplicated model or internal catalogue reference in '+brand+': '+key);
  seen.add(key);
 }
}
for(const item of catalog.filter(x=>x.record_status==='official_manufacturer_size_variant'||x.record_status==='verified_manufacturer_cooling_configuration')){
 assert.ok(item.description?.includes('belső') || item.specifications?.['Azonosító típusa']?.includes('belső'),
   'Internal variant cannot impersonate manufacturer SKU: '+item.id);
 assert.equal(item.price,null,'No invented prices for variants: '+item.id);
}
const photos=catalog.filter(p=>p.image_url).length;
console.log(JSON.stringify({total:catalog.length,photos,illustration_fallbacks:catalog.length-photos,
 counts:Object.fromEntries([...by.entries()].map(([brand,items])=>[brand,items.length]))}));
