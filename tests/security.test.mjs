import test from 'node:test';
import assert from 'node:assert/strict';
import {securityResponse, rejectUnsafeRequest} from '../worker/security.js';

test('security headers accompany HTML and frame embedding is denied', () => {
  const response=securityResponse(new Response('<h1>GastroSky</h1>',{headers:{'content-type':'text/html; charset=utf-8'}}));
  assert.equal(response.headers.get('x-frame-options'),'DENY');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.match(response.headers.get('content-security-policy-report-only'),/frame-ancestors 'none'/);
});
test('API JSON responses also get baseline headers', () => {
  const response=securityResponse(new Response('{}',{headers:{'content-type':'application/json'}}));
  assert.equal(response.headers.get('x-frame-options'),'DENY');
});
test('conditional 304 response keeps a null body', () => {
  const response=securityResponse(new Response(null,{status:304}));
  assert.equal(response.status,304);
});
test('hidden server files cannot be requested', () => {
  for(const path of ['/.env','/.git/config','/wrangler.jsonc','/node_modules/x.js','/app.js.map']){
    assert.equal(rejectUnsafeRequest(new Request('https://gastrosky.example'+path))?.status,404,path);
  }
});
test('quote POST stays available, other writes are denied', () => {
  assert.equal(rejectUnsafeRequest(new Request('https://gastrosky.example/api/quote',{method:'POST'})),null);
  assert.equal(rejectUnsafeRequest(new Request('https://gastrosky.example/data/catalog-products.json',{method:'POST'}))?.status,405);
  assert.equal(rejectUnsafeRequest(new Request('https://gastrosky.example/',{method:'GET'})),null);
});
