import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMaximaAvailability} from '../worker/availability.js';
const product=(status,sku='09400018')=>'<main><h1>Maxima freezer</h1><button>Kosárba</button> '+status+' 2 év garancia <p>Cikkszám '+sku+'</p></main>';
test('reported number',()=>assert.deepEqual(parseMaximaAvailability(product('Még mindig 2 van raktáron'),'09400018'),{kind:'low_stock',quantity:2,expected_date:null,reason:null}));
test('expected Hungarian date',()=>assert.equal(parseMaximaAvailability(product('Várható: 23 december'),'09400018').kind,'expected'));
test('English in stock',()=>assert.equal(parseMaximaAvailability(product('In stock'),'09400018').kind,'in_stock'));
test('wrong SKU never claims availability',()=>assert.equal(parseMaximaAvailability(product('Készleten'),'09402310').kind,'unknown'));
test('no cart never claims availability',()=>assert.equal(parseMaximaAvailability('<p>Cikkszám 09400018 Készleten</p>','09400018').kind,'unknown'));

test('Maxima Hungarian public product page: 1 left after cart',()=>{
 const html='<header>Site</header><main><h1>Eszpresszógép</h1><button>Kosárba</button> Még mindig 1 van raktáron. Ma rendeltem, szállítás 5 munkanapon belül <section>Műszaki adatok Cikkszám 09100000 Vonalkód (EAN) 8720783959617</section></main>';
 const got=parseMaximaAvailability(html,'09100000');
 assert.equal(got.kind,'low_stock');
 assert.equal(got.quantity,1);
});
test('Shipping promise is not falsely reported as physical inventory',()=>{
 const html='<main><button>Kosárba</button> Ma rendeltem, szállítás 5 munkanapon belül <section>Műszaki adatok Cikkszám 09240050</section></main>';
 const got=parseMaximaAvailability(html,'09240050');
 assert.equal(got.kind,'orderable');
 assert.equal(got.quantity,null);
 assert.equal(got.delivery_days,5);
});
