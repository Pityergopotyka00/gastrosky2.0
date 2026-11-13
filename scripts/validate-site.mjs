// Validate single-file preview, product catalog and inline client JavaScript.
// This catches errors that Vite's static HTML build may not detect.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=await readFile('index.html','utf8');
const p=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const script=html.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
assert.ok(script,'Missing inline storefront script');
new vm.Script(script,{filename:'index.inline.js'});
assert.ok(script.includes('let products='),'Preview catalog fallback missing');
assert.ok(script.includes('loadFullSupplierCatalog()'),'Bulk supplier catalog loader missing');
assert.equal((new Set(p.map(x=>x.id))).size,p.length,'Duplicate supplier SKU IDs');
for (const x of p) {
 assert.ok(x.sku&&x.name&&x.manufacturer&&x.id);
 if(x.manufacturer==='HENDI'){
  assert.ok(!/\b(?:chafing dish|milkshake|cook\\s*&\\s*hold|bain-marie|rice cooker|griddle)\b/i.test(x.name),'Untranslated HENDI product name: '+x.id);
  assert.ok(!/gyártó.{0,20}oldal/i.test(x.description||''),'HENDI description sends customer to manufacturer: '+x.id);
 }
 assert.equal(x.id,x.manufacturer.toLowerCase()+':'+x.sku,'Catalog ID mismatch '+x.id);
 assert.ok(x.image_url&&/^https:\/\//i.test(x.image_url),'Each published product needs a secure real photo URL: '+x.id);
 const image=new URL(x.image_url);
 const isMaxima=x.manufacturer==='Maxima';
 const manufacturerHosts=isMaxima?['maxima.com']:['hendi.eu','www.hendi.eu','hendi.xcdn.nl'];
 const manuallyMatchedRetailPhoto=isMaxima&&x.image_source==='matching_retailer_product_photo';
 const retailerHosts=['static.materiel-horeca.com','images.metro-marketplace.eu','cubosupplies.com'];
 assert.ok(manufacturerHosts.includes(image.hostname)||(manuallyMatchedRetailPhoto&&retailerHosts.includes(image.hostname)),'Unexpected product photo host: '+x.id);
 if(!isMaxima){
  assert.ok(image.pathname.includes(x.sku),'HENDI image filename does not match the product SKU: '+x.id);
 }
 if(x.source_url){
  const source=new URL(x.source_url);
  assert.equal(source.protocol,'https:','Unsafe manufacturer product URL: '+x.id);
  assert.ok((isMaxima?['maxima.com']:['hendi.eu','www.hendi.eu']).includes(source.hostname),'Incorrect product manufacturer URL: '+x.id);
 }
}
assert.ok(html.includes('Ajánlatkéréshez adom'),'Quote add button not installed');
assert.ok(html.includes('quotePanel'),'Quote dialog absent');
console.log('Validated storefront JS and dynamic catalog of '+p.length+' products');

const monitor=await readFile('stock-monitor.html','utf8');
const monitorScript=monitor.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
assert.ok(monitorScript,'Missing stock monitor script');
new vm.Script(monitorScript,{filename:'stock-monitor.inline.js'});
assert.ok(html.includes('id="quoteEmailButton"'),'Quote email submission button missing');
assert.ok(html.includes('id="quoteFeedback"'),'Accessible quotation feedback missing');
assert.ok(script.includes("fetch('/api/quote'"),'Server-side email route not wired');
assert.ok(html.includes('id="manufacturer"'),'Manufacturer filter missing');
assert.ok(script.includes("badge.hidden=kind==='unknown'"),'Unknown-stock badges must remain hidden');
assert.ok(html.includes('id="statusHint"'),'Inventory explanation missing');
console.log('Stock monitor JavaScript compiled');
