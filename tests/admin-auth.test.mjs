import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import {handleAdminRequest,isAdminPath,totpAt,passwordDigest} from '../worker/admin-auth.js';

test('all admin HTML and API routes remain private, including under static assets',()=>{
 for(const path of ['/admin','/admin/','/admin/index.html','/api/admin','/api/admin/login','/api/admin/products']){
  assert.equal(isAdminPath(path),true,path);
 }
 assert.equal(isAdminPath('/api/products'),false);
 assert.equal(isAdminPath('/administrator'),false);
});

test('no admin page, signup, bootstrap or privileged CRUD is publicly served',async()=>{
 for(const path of ['/admin','/admin/index.html','/api/admin/signup','/api/admin/bootstrap','/api/admin/products']){
  const resp=await handleAdminRequest(new Request('https://example.test'+path),{});
  assert.ok([404,503].includes(resp.status),path);
  assert.equal(resp.headers.get('cache-control'),'no-store');
 }
});

test('admin login and session fail closed without production configuration',async()=>{
 const login=await handleAdminRequest(new Request('https://example.test/api/admin/login',{
  method:'POST',headers:{origin:'https://example.test','content-type':'application/json'},
  body:JSON.stringify({email:'a@example.test',password:'not-a-real-password',code:'123456'})
 }),{});
 assert.equal(login.status,503);
 assert.deepEqual(await login.json(),{error:'admin_not_configured'});
 const session=await handleAdminRequest(new Request('https://example.test/api/admin/session'),{});
 assert.equal(session.status,503);
});

test('RFC 6238 TOTP implementation matches the published SHA-1 test vector',async()=>{
 const secret=new TextEncoder().encode('12345678901234567890');
 assert.equal(await totpAt(secret,1),'287082');
});

test('scrypt password hashes match the offline setup utility and verify deterministically',async()=>{
 const salt='12'.repeat(32);
 const a=await passwordDigest('correct horse battery staple',salt);
 const b=await passwordDigest('correct horse battery staple',salt);
 assert.equal(a,b);
 assert.equal(a,scryptSync('correct horse battery staple',Buffer.from(salt,'hex'),32,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex'));
 assert.match(a,/^[0-9a-f]{64}$/);
 await assert.rejects(passwordDigest('short',salt),/invalid_password_parameters/);
});

test('login shell is served without exposing private APIs or admin files',async()=>{
 const requests=[];
 const env={ASSETS:{fetch:async request=>{
  requests.push(new URL(request.url).pathname);
  return new Response('<!doctype html><title>GastroSky Admin</title>',{headers:{'content-type':'text/html; charset=utf-8'}});
 }}};
 const page=await handleAdminRequest(new Request('https://example.test/admin'),env);
 assert.equal(page.status,200);
 assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);
 assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 assert.equal(page.headers.get('cache-control'),'no-store');
 assert.deepEqual(requests,['/admin/index.html']);
 const privatePath=await handleAdminRequest(new Request('https://example.test/admin/secrets.txt'),env);
 assert.equal(privatePath.status,404);
 assert.equal(requests.length,1);
 const login=await handleAdminRequest(new Request('https://example.test/api/admin/login',{method:'POST',headers:{origin:'https://example.test'}}),env);
 assert.equal(login.status,503);
});
