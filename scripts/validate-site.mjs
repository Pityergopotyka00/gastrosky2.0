// Validate single-file preview, product catalog and inline client JavaScript.
// This catches errors that Vite's static HTML build may not detect.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=await readFile('index.html','utf8');
const p=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const script=html.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
assert.ok(script,'Missing inline storefront script');
new vm.Script(script,{filename:'index.inline.js'});
assert.ok(script.includes('let products='),'Preview catalog fallback missing');
assert.ok(script.includes('loadFullSupplierCatalog()'),'Bulk supplier catalog loader missing');
assert.equal((new Set(p.map(x=>x.id))).size,p.length,'Duplicate supplier SKU IDs');
const publicModularIndex=JSON.parse(await readFile('data/modular-official-model-index.json','utf8'));
assert.ok(Array.isArray(publicModularIndex.models)&&publicModularIndex.models.length>=65,'Official Modular model index missing');
assert.equal(new Set(publicModularIndex.models.map(x=>x.model)).size,publicModularIndex.models.length,'Duplicate Modular models in index');
assert.ok(publicModularIndex.models.every(x=>x.manufacturer==='Modular'&&x.model&&x.name_hu&&x.image_url===null),'Unverified Modular index entry');
const fagorStaged=JSON.parse(await readFile('data/fagor-verified-staging.json','utf8'));
assert.ok(Array.isArray(fagorStaged)&&fagorStaged.length>=19,'Fagor manufacturer staging records missing');
assert.equal(new Set(fagorStaged.map(x=>x.sku)).size,fagorStaged.length,'Duplicate Fagor catalog reference');
for(const item of fagorStaged){
 assert.equal(item.id,'fagor:'+item.sku,'Incorrect Fagor item ID');
 assert.ok(item.name&&item.description.length>=95&&Object.keys(item.specifications).length>=4,'Incomplete Fagor model description or specifications');
 assert.equal(item.image_url,null,'Staged Fagor images must not be claimed verified');
 assert.ok(item.source_url.startsWith('https://www.fagorprofessional.com/'),'Unofficial Fagor product reference');
 assert.ok(p.some(x=>x.id===item.id),'Published Fagor model absent from main catalog');
}
const staged=JSON.parse(await readFile('data/modular-verified-staging.json','utf8'));
assert.ok(Array.isArray(staged)&&staged.length>=6,'Verified Modular staging records missing');
assert.equal(new Set(staged.map(x=>x.sku)).size,staged.length,'Repeated Modular staging SKU');
for(const item of staged){
 assert.equal(item.id,'modular:'+item.sku,'Invalid staged Modular SKU');
 assert.ok(item.name&&item.description.length>=95&&Object.keys(item.specifications).length>2,'Incomplete manufacturer product information');
 assert.equal(item.image_url,null,'Do not imply images are verified before media review');
 assert.ok(item.source_url.startsWith('https://www.modular.it/'),'Missing official product sheet');
 assert.ok(p.some(x=>x.id===item.id),'Published Modular model absent from main catalog');
}

for (const x of p) {
 assert.ok(x.sku&&x.name&&x.manufacturer&&x.id);
 if(x.manufacturer==='HENDI'){
  assert.ok(!/\b(?:chafing dish|milkshake|cook\s*&\s*hold|bain-marie|rice cooker|griddle)\b/i.test(x.name),'Untranslated HENDI product name: '+x.id);
  assert.ok(!/gyártó.{0,20}oldal/i.test(x.description||''),'HENDI description sends customer to manufacturer: '+x.id);
  assert.ok((x.description||'').length>=95,'HENDI description needs meaningful details: '+x.id);
  assert.ok(!/^Professzionális vendéglátóipari termék\./.test(x.description||''),'Generic HENDI description: '+x.id);
 }
 assert.equal(x.id,(x.manufacturer==='Sistema Project Italia'?'sistemaproject:'+x.sku.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''):x.manufacturer.toLowerCase()+':'+x.sku),'Catalog ID mismatch '+x.id);
 assert.ok(!x.image_url||/^https:\/\//i.test(x.image_url),'Product photo URL must use HTTPS if supplied: '+x.id);
 if((x.manufacturer==='Fagor'||x.manufacturer==='Modular')&&!x.image_url)assert.equal(x.photo_status,'product_photo_pending','Missing photo status must be explicit: '+x.id);
 const image=x.image_url?new URL(x.image_url):null;
 const isMaxima=x.manufacturer==='Maxima';
 const manufacturerHosts=isMaxima?['maxima.com']:x.manufacturer==='HENDI'?['hendi.eu','www.hendi.eu','hendi.xcdn.nl']:x.manufacturer==='Modular'?['modular.it','www.modular.it','thenicekitchen.com','www.thenicekitchen.com']:x.manufacturer==='Fagor'?['fagorprofessional.com','www.fagorprofessional.com']:x.manufacturer==='Coldline'?['coldline.it','www.coldline.it']:x.manufacturer==='Krupps'?['krupps.com','www.krupps.com']:x.manufacturer==='Aristarco'?['aristarco.it','www.aristarco.it']:x.manufacturer==='Sistema Project Italia'?['projectsystems.it','www.projectsystems.it']:[];
 const manuallyMatchedRetailPhoto=(isMaxima||['Fagor','Krupps','Aristarco','Coldline'].includes(x.manufacturer))&&['matching_retailer_product_photo','matching_retailer_family_photo','manufacturer_family_reference_photo','manufacturer_previous_code_photo','manufacturer_shared_family_photo'].includes(x.image_source);
 const retailerHosts=['static.materiel-horeca.com','images.metro-marketplace.eu','cubosupplies.com','www.hellopro.fr','tirol.bg','www.wea56.com','www.materielhoreca.com','www.audores.lt','audores.lt','nivaeq.com','www.ventus.com.gr','img.archiexpo.com','horeca365.ro','www.andretti.hu','restoll.ru','et-e.com.ua','res.cloudinary.com','www.mh-hygiene.com','flexikitch.com.au','www.pesage-mb.com','luxia-nce.co.uk','shop.gastrooprema.rs','itpizza-russia.ru','www.lahostelera.com'];
 if(image)assert.ok(manufacturerHosts.includes(image.hostname)||(manuallyMatchedRetailPhoto&&retailerHosts.includes(image.hostname)),'Unexpected product photo host: '+x.id);
 if(x.manufacturer==='HENDI'){
  assert.ok(image&&image.pathname.includes(x.sku),'HENDI image filename does not match the product SKU: '+x.id);
 }
 if(x.source_url){
  const source=new URL(x.source_url);
  assert.equal(source.protocol,'https:','Unsafe manufacturer product URL: '+x.id);
  const allowedSourceHosts={Maxima:['maxima.com'],HENDI:['hendi.eu','www.hendi.eu'],Modular:['modular.it','www.modular.it','thenicekitchen.com','www.thenicekitchen.com'],Fagor:['fagorprofessional.com','www.fagorprofessional.com'],Coldline:['coldline.it','www.coldline.it'],Krupps:['krupps.com','www.krupps.com'],Aristarco:['aristarco.it','www.aristarco.it'],'Sistema Project Italia':['projectsystems.it','www.projectsystems.it']};
  assert.ok((allowedSourceHosts[x.manufacturer]||[]).includes(source.hostname),'Incorrect product manufacturer URL: '+x.id);
 }
}
assert.ok(html.includes('Ajánlatkéréshez adom'),'Quote add button not installed');
assert.ok(html.includes('quotePanel'),'Quote dialog absent');
assert.ok(script.includes('gs-detail-shell'),'Premium detail layout is missing');
assert.ok(script.includes('gs-detail-spec-grid'),'Structured specification tiles are missing');
assert.ok(script.includes('Ajánlatkéréshez adom'),'Onsite details quotation action is missing');
assert.ok(!script.includes('source.href=p.source_url'),'Supplier website links must not appear in product details');
// Keep the full branded storefront intact during future updates.
for(const section of ['gs-header-inner','gs-hero-showcase','gs-intro-strip','gs-catalog-heading','gs-process-grid','gs-bottom-cta','gs-footer-main']){
 assert.ok(html.includes(section),'Premium storefront section missing: '+section);
}
for(const brand of ['Maxima','HENDI','Fagor','Modular','Coldline','Krupps','Aristarco','Sistema Project Italia'])assert.ok(html.includes('value="'+brand+'"'),'Brand filter missing: '+brand);
for(const action of ['id="search"','id="category"','id="manufacturer"','id="sortBy"','id="quoteOpen"','id="quotePanel"']){
 assert.ok(html.includes(action),'Important catalog/quote control missing: '+action);
}
const minimumBrands=['Maxima','HENDI','Fagor','Modular','Coldline','Krupps','Aristarco','Sistema Project Italia'];
for(const brand of minimumBrands){
 const count=p.filter(item=>item.manufacturer===brand).length;
 assert.ok(count>=16,brand+' needs at least 16 real catalog entries; got '+count);
 const label=brand==='Sistema Project Italia'?'SISTEMA PROJECT ITALIA':brand.toUpperCase();
 assert.ok(html.includes('data-brand-filter="'+brand+'"'),brand+' missing from clickable brand directory');
 assert.ok(html.includes(count+' termék megtekinthető'),brand+' count missing from directory');
}
assert.ok(html.includes('id="kedvezmenyek"'),'Discount request section missing');
assert.ok(p.filter(x=>x.promotion?.kind==='discount_quote_request').length>=5,'Discount quote products missing');
assert.ok(script.includes("result?.success==='true'"),'FormSubmit should not treat a false string as success');
assert.ok(script.includes("activation_required"),'Recipient activation status must be surfaced');
const declaredStock=script.indexOf('let latestSupplierStock=');
const firstRender=script.indexOf('render();');
assert.ok(declaredStock>=0&&declaredStock<firstRender,'Initialize saved stock before first render so quote buttons can bind');
const declaredVisibleLimit=script.indexOf('let visibleLimit=40;');
assert.ok(declaredVisibleLimit>=0&&declaredVisibleLimit<firstRender,'Initialize visibleLimit before first render so quote buttons can bind');
assert.ok(script.includes('coldline|krupps|aristarco|sistemaproject'),'Persist quote selections for all manufacturers');
console.log('Validated storefront JS and dynamic catalog of '+p.length+' products');

const monitor=await readFile('stock-monitor.html','utf8');
const monitorScript=monitor.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
assert.ok(monitorScript,'Missing stock monitor script');
new vm.Script(monitorScript,{filename:'stock-monitor.inline.js'});
assert.ok(html.includes('id="quoteEmailButton"'),'Quote email submission button missing');
assert.ok(html.includes('id="quoteFeedback"'),'Accessible quotation feedback missing');
assert.ok(script.includes("fetch('/api/quote'"),'Server-side email route not wired');
assert.ok(html.includes('id="manufacturer"'),'Manufacturer filter missing');
assert.ok(html.includes('data-brand-filter="Sistema Project Italia"'),'New brand directory tile missing');
assert.ok(script.includes("'Sistema Project Italia'].includes(p.manufacturer)"),'Supplier loader must accept all brands');
assert.ok(script.includes("badge.hidden=kind==='unknown'"),'Unknown-stock badges must remain hidden');
assert.ok(html.includes('id="statusHint"'),'Inventory explanation missing');
console.log('Stock monitor JavaScript compiled');
