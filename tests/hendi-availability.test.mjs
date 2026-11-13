import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHendiAvailability} from '../worker/hendi-availability.js';

const page=(status,sku='239780')=>'<main><h1>HENDI induction</h1> Product variants <table>Code V W '+sku+' 230 3500</table> '+status+' <h2>Documents</h2> More products from this line Out of assortment</main>';
test('Online ordering disabled is not the same as out of stock',()=>{
 const actual=parseHendiAvailability(page('This product is not available at the moment for online orders.'),'239780');
 assert.equal(actual.kind,'unknown');
 assert.equal(actual.reason,'online_ordering_unavailable_not_stock');
});
test('Out of assortment is a distinct status',()=>{
 assert.equal(parseHendiAvailability(page('Out of assortment'),'239780').kind,'out_of_assortment');
});
test('Wrong SKU cannot claim assortment status',()=>{
 assert.equal(parseHendiAvailability(page('Out of assortment'),'239421').kind,'unknown');
});
test('Related products must not change this product status',()=>{
 assert.equal(parseHendiAvailability(page('This product is not available at the moment for online orders.'),'239780').kind,'unknown');
});
