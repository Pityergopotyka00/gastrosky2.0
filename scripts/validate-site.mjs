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
const assignments=[...script.matchAll(/\bconst products=/g)];
assert.equal(assignments.length,1,'Catalog must have one embedded data declaration');
assert.equal((new Set(p.map(x=>x.id))).size,p.length,'Duplicate supplier SKU IDs');
for (const x of p) {
 assert.ok(x.sku&&x.name&&x.manufacturer&&x.id);
 assert.equal(x.id,x.manufacturer.toLowerCase()+':'+x.sku,'Catalog ID mismatch '+x.id);
 assert.ok(html.includes(JSON.stringify(x.sku).slice(1,-1)),'SKU absent from standalone storefront: '+x.sku);
}
assert.ok(html.includes('Ajánlatkéréshez adom'),'Quote add button not installed');
assert.ok(html.includes('quotePanel'),'Quote dialog absent');
console.log('Validated inline JS and '+p.length+' supplier products');

const monitor=await readFile('stock-monitor.html','utf8');
const monitorScript=monitor.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
assert.ok(monitorScript,'Missing stock monitor script');
new vm.Script(monitorScript,{filename:'stock-monitor.inline.js'});
assert.ok(html.includes('stock-monitor.html'),'Stock monitor navigation missing');
assert.ok(html.includes('id="manufacturer"'),'Manufacturer filter missing');
console.log('Stock monitor JavaScript compiled');
