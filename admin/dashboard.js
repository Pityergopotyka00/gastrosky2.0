'use strict';
// The admin server authorizes every request; this UI never authorizes itself.
(()=>{
const $=id=>document.getElementById(id);
let token=null,role=null,editing=null,offset=0,brands=[];
const root=$('account');
const note=(text,error=false)=>{const el=$('status');el.textContent=text;el.dataset.state=error?'error':'info'};
const create=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x};
const empty=(element,text)=>{element.replaceChildren(create('p','note',text))};
async function request(path,method='GET',body){
 const res=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:{...(body?{'content-type':'application/json'}:{}),...(method!=='GET'?{'x-csrf-token':token||''}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const payload=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(payload.error||'HTTP '+res.status);
 return payload;
}
function show(tab){
 for(const btn of root.querySelectorAll('[data-tab]'))btn.setAttribute('aria-current',btn.dataset.tab===tab?'page':'false');
 for(const page of root.querySelectorAll('[data-page]'))page.hidden=page.dataset.page!==tab;
 if(tab==='products')loadProducts();
 if(tab==='quotes')loadNotes();
 if(tab==='security')loadSecurity();
}
async function loadDashboard(){
 try{
  const d=await request('/api/admin/dashboard');
  $('metricProducts').textContent=d.products;
  $('metricBrands').textContent=d.brands.length;
  $('metricEdits').textContent=d.edits;
  $('metricNotes').textContent=d.openNotes;
  brands=d.brands;
  const sel=$('productBrand');sel.replaceChildren(new Option('Minden gyártó',''));
  const newBrand=$('newManufacturer');newBrand.replaceChildren(new Option('Válassz gyártót',''));
  const chips=$('brandResults');chips.replaceChildren();
  d.brands.forEach(b=>{
   sel.add(new Option(b,b));
   newBrand.add(new Option(b,b));
   const btn=create('button','brand-chip',b);
   btn.type='button';btn.addEventListener('click',()=>{sel.value=b;show('products')});
   chips.append(btn);
  });
  const summary=$('overviewDetails');summary.replaceChildren();
  for(const [label,value] of [['Aktív admin fiókok',d.accounts],['Nyitott követések',d.openNotes],['Termékek a katalógusban',d.products],['Módosított termékek',d.edits]]){
   const row=create('div','summary-row');row.append(create('span',null,label),create('strong',null,value));summary.append(row);
  }
  note('Vezérlőpult betöltve.');
 }catch(e){note('Az admin adatbázis még nincs teljesen előkészítve: '+e.message,true)}
}
async function loadProducts(append=false){
 if(!append)offset=0;
 const q=encodeURIComponent($('productSearch').value.trim());
 const brand=encodeURIComponent($('productBrand').value);
 const target=$('productResults');
 try{
  const d=await request('/api/admin/products?q='+q+'&manufacturer='+brand+'&offset='+offset);
  if(!append)target.replaceChildren();
  if(!d.items.length&&!append)empty(target,'Nincs találat.');
  for(const p of d.items){
   const row=create('article','product-admin-row');
   if(p.image_url){const img=create('img');img.src=p.image_url;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';row.append(img)}
   const details=create('div','product-admin-details');
   details.append(create('strong',null,p.name),create('small',null,p.manufacturer+' · '+p.sku));
   if(p.featured)details.append(create('small','featured','Kiemelt'));
   if(p.hidden)details.append(create('small','featured','Elrejtve'));
   if(p.manual)details.append(create('small',null,'Manuális termék'));
   const btn=create('button','small-button','Szerkesztés');
   btn.type='button';btn.disabled=role!=='owner';
   btn.addEventListener('click',()=>editProduct(p));
   row.append(details,btn);
   if(p.manual&&role==='owner'){
    const archive=create('button','small-button muted-button','Archiválás');
    archive.type='button';archive.addEventListener('click',async()=>{
     if(!confirm('Archiválod ezt a manuálisan létrehozott terméket?'))return;
     try{await request('/api/admin/products/'+encodeURIComponent(p.id),'DELETE');await loadProducts();await loadDashboard();note('Termék archiválva.')}
     catch(err){note(err.message,true)}
    });
    row.append(archive);
   }
   target.append(row);
  }
  offset+=d.items.length;
  $('moreProducts').hidden=offset>=d.total;
 }catch(e){note('Terméklista hiba: '+e.message,true)}
}
function editProduct(p){
 editing=p;
 $('editingProduct').textContent=p.manufacturer+' · '+p.sku;
 $('editName').value=p.name;
 $('editDescription').value=p.description||'';
 $('editImage').value=p.image_url||'';
 $('editHidden').checked=Boolean(p.hidden);
 $('editFeatured').checked=p.featured;
 $('productEditor').hidden=false;
 $('productEditor').scrollIntoView({behavior:'smooth',block:'start'});
}
$('newProductForm').addEventListener('submit',async e=>{
 e.preventDefault();if(role!=='owner')return;
 const body={
  manufacturer:$('newManufacturer').value,
  sku:$('newSku').value.trim(),name:$('newName').value.trim(),
  category:$('newCategory').value.trim(),description:$('newDescription').value.trim(),
  image_url:$('newImage').value.trim()
 };
 try{
  await request('/api/admin/products','POST',body);
  $('newProductForm').reset();note('Új termék létrehozva.');
  await loadProducts();await loadDashboard();
 }catch(err){note('Új termék mentése sikertelen: '+err.message,true)}
});
$('productEditor').addEventListener('submit',async e=>{
 e.preventDefault();if(!editing||role!=='owner')return;
 const body={id:editing.id,name:$('editName').value,description:$('editDescription').value,image_url:$('editImage').value.trim(),hidden:$('editHidden').checked,featured:$('editFeatured').checked};
 try{
  await request('/api/admin/product','PUT',body);
  $('productEditor').hidden=true;editing=null;note('Termék módosítva. A nyilvános katalógus rövid gyorsítótár után frissül.');
  await loadProducts();await loadDashboard();
 }catch(err){note('Nem sikerült menteni: '+err.message,true)}
});
$('cancelEdit').addEventListener('click',()=>{$('productEditor').hidden=true;editing=null});
$('searchProducts').addEventListener('click',()=>loadProducts());
$('productSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadProducts()}});
$('productBrand').addEventListener('change',()=>loadProducts());
$('moreProducts').addEventListener('click',()=>loadProducts(true));
$('quoteNoteForm').addEventListener('submit',async e=>{
 e.preventDefault();
 try{
  await request('/api/admin/quotes','POST',{name:$('quoteName').value,email:$('quoteEmail').value,note:$('quoteText').value});
  $('quoteNoteForm').reset();note('Teendő elmentve.');await loadNotes();await loadDashboard();
 }catch(err){note('Teendő mentése nem sikerült: '+err.message,true)}
});
async function loadNotes(){
 const target=$('quoteResults');
 try{
  const d=await request('/api/admin/quotes');target.replaceChildren();
  if(!d.items.length)empty(target,'Még nincsenek kézzel rögzített követési teendők.');
  for(const item of d.items){
   const card=create('article','quote-note');
   card.append(create('strong',null,item.customer_name),create('small',null,item.customer_email),create('p',null,item.note||'Nincs megjegyzés'));
   const select=create('select');select.setAttribute('aria-label','Teendő állapota');
   for(const [v,label] of [['new','Új'],['in_progress','Folyamatban'],['done','Kész']])select.add(new Option(label,v));
   select.value=item.status;select.disabled=role!=='owner';
   select.addEventListener('change',async()=>{
    try{await request('/api/admin/quotes/'+encodeURIComponent(item.id),'PATCH',{status:select.value});note('Állapot frissítve.');await loadDashboard()}
    catch(err){note(err.message,true)}
   });
   card.append(select);
   if(role==='owner'){
    const remove=create('button','small-button muted-button','Teendő törlése');
    remove.type='button';remove.addEventListener('click',async()=>{
     if(!confirm('Biztosan törlöd ezt a követési teendőt?'))return;
     try{await request('/api/admin/quotes/'+encodeURIComponent(item.id),'DELETE');await loadNotes();await loadDashboard();note('Teendő törölve.')}
     catch(err){note('Törlés sikertelen: '+err.message,true)}
    });
    card.append(remove);
   }
   target.append(card);
  }
 }catch(e){note('Teendők betöltése sikertelen: '+e.message,true)}
}
async function loadSecurity(){
 const staff=$('staffResults'),audit=$('auditResults');
 if(role!=='owner'){empty(staff,'Csak tulajdonos nézheti meg.');empty(audit,'Csak tulajdonos nézheti meg.');return}
 try{
  const [u,a]=await Promise.all([request('/api/admin/staff'),request('/api/admin/audit')]);
  staff.replaceChildren();audit.replaceChildren();
  for(const item of u.items){
   const row=create('div','summary-row');
   const details=create('div');details.append(create('strong',null,item.email),create('small',null,' · '+item.role+(item.disabled?' · Letiltva':'')));
   row.append(details);
   if(item.email!==document.getElementById('identity').textContent.split(' · ')[0]){
    const btn=create('button','small-button',item.disabled?'Engedélyezés':'Hozzáférés tiltása');
    btn.type='button';
    btn.addEventListener('click',async()=>{
     const disabled=!Boolean(item.disabled);
     if(!confirm(disabled?'Letiltod ezt az adminfiókot és a munkameneteit?':'Újra engedélyezed az adminfiókot?'))return;
     try{await request('/api/admin/staff','PATCH',{email:item.email,disabled});await loadSecurity();await loadDashboard();note('Hozzáférés módosítva.')}
     catch(err){note('Hozzáférés módosítása sikertelen: '+err.message,true)}
    });
    row.append(btn);
   }
   staff.append(row);
  }
  for(const item of a.items){const row=create('div','summary-row');row.append(create('span',null,item.event+(item.detail?' · '+item.detail:'')),create('small',null,new Date(item.occurred_at).toLocaleString('hu-HU')));audit.append(row)}
 }catch(e){note('Biztonsági adatok nem érhetők el: '+e.message,true)}
}
root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.tab)));
root.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.jump)));
window.gastroAdminDashboard={
 start(data){token=data.csrfToken;role=data.role;show('overview');loadDashboard()},
 stop(){token=null;role=null;editing=null;$('productEditor').hidden=true}
};
})();
