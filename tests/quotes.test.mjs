import test from 'node:test';
import assert from 'node:assert/strict';
import {validateQuote,handleQuote,quoteConfig} from '../worker/quotes.js';

const okPayload={
 name:'Teszt Konyha',email:'test@example.com',message:'Kérek ajánlatot.',
 items:['maxima:09400018'],companyWebsite:''
};
const credentials={RESEND_API_KEY:'test_key',QUOTE_TO_EMAIL:'info@gastrosky.hu',QUOTE_FROM_EMAIL:'GastroSky <ajanlat@example.com>',
 TURNSTILE_SECRET_KEY:'testsecret',TURNSTILE_SITE_KEY:'testsitekey'};
const sample=[{id:'maxima:09400018',name:'Ipari hűtő',sku:'09400018',manufacturer:'Maxima'}];

test('Name, email, product IDs and request size validated',()=>{
 assert.equal(validateQuote(okPayload),null);
 assert.equal(validateQuote({...okPayload,name:'a'}),'invalid_name');
 assert.equal(validateQuote({...okPayload,email:'not-an-email'}),'invalid_email');
 assert.equal(validateQuote({...okPayload,items:['fake:1']}),'invalid_items');
 assert.equal(validateQuote({...okPayload,items:['maxima:09400018','maxima:09400018']}),'duplicate_items');
 assert.equal(validateQuote({...okPayload,companyWebsite:'spam'}),'spam_rejected');
 assert.equal(validateQuote({...okPayload,items:[]}), 'invalid_items');
});
test('Mail configuration is unavailable by default',async()=>{
 const result=await quoteConfig({}).json();
 assert.equal(result.enabled,false);
 assert.equal(result.turnstileSiteKey,null);
});
test('Missing email credentials never sends',async()=>{
 const request=new Request('https://gastrosky.example/api/quote',{method:'POST',headers:{Origin:'https://gastrosky.example','content-type':'application/json'},body:JSON.stringify(okPayload)});
 const response=await handleQuote(request,{},async()=>sample);
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,'email_not_configured');
});
test('Wrong origin cannot submit email',async()=>{
 const request=new Request('https://gastrosky.example/api/quote',{method:'POST',headers:{Origin:'https://evil.example'},body:JSON.stringify(okPayload)});
 const response=await handleQuote(request,credentials,async()=>sample);
 assert.equal(response.status,403);
});
test('Invalid requests rejected before sending',async()=>{
 const request=new Request('https://gastrosky.example/api/quote',{method:'POST',headers:{Origin:'https://gastrosky.example','content-type':'application/json'},body:JSON.stringify({...okPayload,items:['invalid:100']})});
 const response=await handleQuote(request,credentials,async()=>sample);
 assert.equal(response.status,400);
});
