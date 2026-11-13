import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSupplierUrl} from '../scripts/catalog-url.mjs';
const maxima={name:'Maxima',origin:'https://maxima.com',prefix:'/hu/'};
const hendi={name:'HENDI',origin:'https://www.hendi.eu',prefix:'/en/'};
test('Maxima Hungarian product page is accepted and tracking removed',()=>{
 assert.equal(normalizeSupplierUrl('https://maxima.com/hu/huto.html?utm_source=x#detail',maxima),'https://maxima.com/hu/huto.html');
});
test('HENDI new-products category pagination survives',()=>{
 assert.equal(normalizeSupplierUrl('/en/new/?p=2',hendi),'https://www.hendi.eu/en/new/?p=2');
 assert.equal(normalizeSupplierUrl('/en/new/?p=10&utm_source=ad',hendi),'https://www.hendi.eu/en/new/?p=10');
});
test('HENDI pagination is canonical and bounded',()=>{
 assert.equal(normalizeSupplierUrl('/en/new/?p=01',hendi),'https://www.hendi.eu/en/new/');
 assert.equal(normalizeSupplierUrl('/en/new/?p=201',hendi),'https://www.hendi.eu/en/new/');
});
test('Tracking and unsafe unrelated domains are rejected',()=>{
 assert.equal(normalizeSupplierUrl('https://attacker.example/en/new/',hendi),null);
 assert.equal(normalizeSupplierUrl('http://www.hendi.eu/en/new/',hendi),null);
 assert.equal(normalizeSupplierUrl('/en/files/catalog.pdf',hendi),null);
});
test('Maxima preserves catalog pagination',()=>{
 assert.equal(normalizeSupplierUrl('/hu/etterem-es-szalloda/?p=4',maxima),'https://maxima.com/hu/etterem-es-szalloda/?p=4');
});
