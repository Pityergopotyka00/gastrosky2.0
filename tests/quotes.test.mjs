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
 assert.equal(validateQuote({...okPayload,items:[]}), null); // A detailed general enquiry is valid\n assert.equal(validateQuote({...okPayload,items:[],message:''}), 'message_required_for_general_quote');
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

test('Verified quote is accepted by mail provider with correct SKU and reply-to',async()=>{
 const original=globalThis.fetch;
 const requests=[];
 globalThis.fetch=async(url,options)=>{
  requests.push({url,options});
  if(url.includes('turnstile'))return new Response(JSON.stringify({success:true}),{status:200,headers:{'content-type':'application/json'}});
  if(url.includes('resend.com'))return new Response(JSON.stringify({id:'msg_test_100'}),{status:200,headers:{'content-type':'application/json'}});
  throw new Error('Unexpected outbound endpoint');
 };
 try{
  const data={...okPayload,turnstileToken:'a'.repeat(32)};
  const request=new Request('https://gastrosky.example/api/quote',{method:'POST',headers:{Origin:'https://gastrosky.example','Content-Type':'application/json'},body:JSON.stringify(data)});
  const response=await handleQuote(request,credentials,async()=>sample);
  assert.equal(response.status,202);
  assert.equal((await response.json()).ok,true);
  assert.equal(requests.length,3); // Owner email plus customer acknowledgement
  const body=JSON.parse(requests[1].options.body);
  assert.equal(body.reply_to,'test@example.com');
  assert.match(body.text,/09400018/);
  assert.deepEqual(body.to,['info@gastrosky.hu']);
  assert.deepEqual(JSON.parse(requests[2].options.body).to,['test@example.com']);
 }finally{globalThis.fetch=original}
});
test('Provider error never claims successful quotation delivery',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url)=>url.includes('turnstile')?
  new Response(JSON.stringify({success:true}),{status:200}):
  new Response(JSON.stringify({message:'unauthorized'}),{status:401});
 try{
  const data={...okPayload,turnstileToken:'a'.repeat(32)};
  const request=new Request('https://gastrosky.example/api/quote',{method:'POST',headers:{Origin:'https://gastrosky.example'},body:JSON.stringify(data)});
  const response=await handleQuote(request,credentials,async()=>sample);
  assert.equal(response.status,502);
  assert.equal((await response.json()).error,'email_delivery_failed');
 }finally{globalThis.fetch=original}
});
