import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProducts} from '../scripts/catalog-parse.mjs';
const Maxima={name:'Maxima',origin:'https://maxima.com',prefix:'/hu/'};
const HENDI={name:'HENDI',origin:'https://www.hendi.eu',prefix:'/en/'};

test('Maxima: reads SKU, EAN, product name and official image',()=>{
 const page='<html><head><meta property="og:image" content="https://maxima.com/media/catalog/product/09100000.jpg"></head><body><h1>Eszpresszógép</h1><p>Cikkszám 09100000</p><p>EAN 8720783959617</p></body></html>';
 const p=parseProducts(page,'https://maxima.com/hu/eszpresszogep.html',Maxima);
 assert.equal(p.length,1);
 assert.equal(p[0].id,'maxima:09100000');
 assert.equal(p[0].ean,'8720783959617');
 assert.match(p[0].image_url,/09100000\.jpg$/);
});
test('Maxima: rejects missing verified photo',()=>{
 const html='<html><body><h1>Termék</h1><p>Cikkszám 09100000</p></body></html>';
 assert.equal(parseProducts(html,'https://maxima.com/hu/example.html',Maxima).length,0);
});
test('HENDI: variants become separate SKU/image products',()=>{
 const page='<html><body><h1>Refrigerated counter, 4 doors</h1><table><tr><td>238158</td><td><img src="https://www.hendi.eu/media/238158.jpg"></td></tr><tr><td>238165</td><td><img src="https://www.hendi.eu/media/238165.jpg"></td></tr></table><p>Product variants</p></body></html>';
 const result=parseProducts(page,'https://www.hendi.eu/en/refrigerated-counter-4-doors-724519.html',HENDI);
 assert.deepEqual(result.map(p=>p.sku).sort(),['238158','238165']);
 for(const p of result)assert.ok(p.image_url.includes(p.sku+'.jpg'));
});
test('HENDI: does not invent a barcode from a SKU',()=>{
 const html='<html><body><h1>Chafing Dish</h1><table><tr><td>239780</td></tr></table><img src="https://hendi.xcdn.nl/RM265,265/-/239780.jpg"></body></html>';
 const [item]=parseProducts(html,'https://www.hendi.eu/en/chafing-dish.html',HENDI);
 assert.equal(item.ean,'');
});
test('HENDI: blocks unrelated images and product IDs',()=>{
 const html='<html><body><h1>Chafing Dish</h1><table><tr><td>239780</td></tr></table><img src="https://unknown.example/239780.jpg"><img src="https://hendi.xcdn.nl/other.jpg"></body></html>';
 assert.equal(parseProducts(html,'https://www.hendi.eu/en/item.html',HENDI).length,0);
});
test('Preserve original first-discovery date',()=>{
 const html='<html><head><meta property="og:image" content="https://maxima.com/media/catalog/product/09100000.jpg"></head><body><h1>Eszpresszógép</h1><p>Cikkszám 09100000</p></body></html>';
 const before=new Map([['maxima:09100000',{id:'maxima:09100000',discovered_at:'2026-01-01T00:00:00Z'}]]);
 const [item]=parseProducts(html,'https://maxima.com/hu/espresso.html',Maxima,before);
 assert.equal(item.discovered_at,'2026-01-01T00:00:00Z');
});
