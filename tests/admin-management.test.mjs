import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleAdminRequest} from '../worker/admin-auth.js';
import {getCatalogWithOverrides} from '../worker/admin-management.js';
const page=await readFile('admin/index.html','utf8');
const client=await readFile('admin/dashboard.js','utf8');
const copy=await readFile('scripts/copy-static.mjs','utf8');
test('admin dashboard has real account-gated navigation and all management areas',()=>{
 for(const section of ['overview','products','promos','quotes','brands','images','security']){
  assert.match(page,new RegExp('data-page="'+section+'"'));
 }
 assert.match(page,/id="productEditor"/);
 assert.match(page,/id="quoteNoteForm"/);
 assert.match(client,/\/api\/admin\/dashboard/);
 assert.match(client,/\/api\/admin\/product/);
 assert.match(copy,/dashboard\.js/);
});
test('catalog overrides apply edits and hide only public products',async()=>{
 const source=[{id:'maxima:123',name:'Original',description:'Original description',image_url:null},{id:'maxima:456',name:'Visible'}];
 const env={
  ASSETS:{fetch:async()=>new Response(JSON.stringify(source),{status:200})},
  ADMIN_DB:{prepare:sql=>({all:async()=>({results:[
   {product_id:'maxima:123',custom_name:'Edited',custom_description:null,image_url:'https://example.com/image.jpg',hidden:1,featured:1}
  ]})})}
 };
 const published=await getCatalogWithOverrides(env,'https://example.test/');
 assert.equal(published.length,1);
 assert.equal(published[0].id,'maxima:456');
 const management=await getCatalogWithOverrides(env,'https://example.test/',{includeHidden:true});
 assert.equal(management[0].name,'Edited');
 assert.equal(management[0].admin_hidden,true);
});
test('protected admin actions cannot run without configured authentication',async()=>{
 const request=new Request('https://example.test/api/admin/product',{method:'PUT',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify({id:'maxima:123'})});
 const r=await handleAdminRequest(request,{});
 assert.equal(r.status,503);
});
