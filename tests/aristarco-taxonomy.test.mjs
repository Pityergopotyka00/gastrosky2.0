import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile('index.html','utf8');
const catalog=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const source=html.slice(html.indexOf('function catalogTaxonomy(p){'),html.indexOf('\nfunction syncCategoriesForManufacturer',html.indexOf('function catalogTaxonomy(p){')));
const taxonomy=vm.runInNewContext(source+'\ncatalogTaxonomy');
test('Aristarco machine families are routed into the correct main section',()=>{
 const iceCategories=new Set(['Jégpehelykészítők','Üreges jégkockás jéggépek','Teli jégkockás jéggépek','Kockajégkészítők','Granulált jégkészítők']);
 const rows=catalog.filter(p=>p.manufacturer==='Aristarco');
 assert.equal(rows.length,74);
 for(const p of rows){
  const result=taxonomy(p);
  assert.equal(result.group,iceCategories.has(p.category)?'Jégtechnika':'Mosogatástechnika',p.id+' | '+p.category);
 }
});
