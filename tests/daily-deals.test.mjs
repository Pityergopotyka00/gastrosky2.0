import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile('index.html','utf8');
const products=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const source=html.match(/const DAILY_DEALS_GROUP='__akciok__';([\s\S]*?)function render\(/)?.[0];
assert.ok(source,'Daily deals selection functions must exist');
const helpers=source.replace(/function render\($/,'');
const {dailyDealProducts}=vm.runInNewContext(helpers+'\n({dailyDealProducts})');

test('Akciók appear in the category menu right after Minden termék',()=>{
 assert.match(html,/all\.textContent='Minden termék \('\+relevant\.length\+'\)'/);
 assert.match(html,/categoryGroup\.append\(all\);[\s\S]*?dealsOption\.value=DAILY_DEALS_GROUP;[\s\S]*?categoryGroup\.append\(dealsOption\)/);
 assert.doesNotMatch(html,/id="kedvezmenyek"/,'Separate promotions panel should be moved into the category menu');
});

test('daily deal selection is deterministic, distinct, and only uses approved quote promotions',()=>{
 const one=dailyDealProducts(products,'2026-11-14');
 const again=dailyDealProducts(products,'2026-11-14');
 const next=dailyDealProducts(products,'2026-11-15');
 assert.deepEqual(one.map(x=>x.id),again.map(x=>x.id));
 assert.ok(one.length>0&&one.length<=3);
 assert.equal(new Set(one.map(x=>x.id)).size,one.length);
 for(const p of one){
  assert.equal(p.promotion.kind,'discount_quote_request');
  assert.equal(p.promotion.status,'subject_to_quote');
  assert.equal(p.promotion.price_verified,false);
 }
 if(products.filter(p=>p.promotion?.kind==='discount_quote_request'&&p.promotion?.status==='subject_to_quote'&&p.promotion?.price_verified===false).length>3){
  assert.notDeepEqual(one.map(x=>x.id),next.map(x=>x.id),'Different days should display different items');
 }
});

test('rotation does not advertise unverified numerical prices',()=>{
 assert.match(html,/A kedvezmény és a végleges ár az egyedi ajánlatban kerül megerősítésre/);
 assert.match(html,/const promo=todaysDeals\.has\(p\.id\)/);
});
