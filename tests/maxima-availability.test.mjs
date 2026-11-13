import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMaximaAvailability} from '../worker/availability.js';
const product=(status,sku='09400018')=>'<main><h1>Maxima freezer</h1><button>Kosárba</button> '+status+' 2 év garancia <p>Cikkszám '+sku+'</p></main>';
test('reported number',()=>assert.deepEqual(parseMaximaAvailability(product('Még mindig 2 van raktáron'),'09400018'),{kind:'low_stock',quantity:2,expected_date:null,reason:null}));
test('expected Hungarian date',()=>assert.equal(parseMaximaAvailability(product('Várható: 23 december'),'09400018').kind,'expected'));
test('English in stock',()=>assert.equal(parseMaximaAvailability(product('In stock'),'09400018').kind,'in_stock'));
test('wrong SKU never claims availability',()=>assert.equal(parseMaximaAvailability(product('Készleten'),'09402310').kind,'unknown'));
test('no cart never claims availability',()=>assert.equal(parseMaximaAvailability('<p>Cikkszám 09400018 Készleten</p>','09400018').kind,'unknown'));
