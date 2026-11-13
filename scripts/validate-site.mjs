// GastroSky CI validation: current nine-manufacturer catalog and storefront.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=await readFile('index.html','utf8');
const products=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const script=html.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
assert.ok(script,'Missing inline storefront script');
new vm.Script(script,{filename:'index.inline.js'});
assert.ok(Array.isArray(products)&&products.length>0,'Catalog missing');
const brands=['Maxima','HENDI','Fagor','Modular','Coldline','Krupps','Aristarco','Sistema Project Italia','Tecnodom','Gastro Haal'];
const prefixes={Maxima:'maxima',HENDI:'hendi',Fagor:'fagor',Modular:'modular',Coldline:'coldline',Krupps:'krupps',Aristarco:'aristarco','Sistema Project Italia':'sistemaproject',Tecnodom:'tecnodom','Gastro Haal':'gastrohaal'};
const hosts={
 Maxima:['maxima.com'],HENDI:['hendi.eu','www.hendi.eu','hendi.xcdn.nl'],
 Fagor:['fagorprofessional.com','www.fagorprofessional.com','anvalor.hu'],
 Modular:['modular.it','www.modular.it','thenicekitchen.com','www.thenicekitchen.com'],
 Coldline:['coldline.it','www.coldline.it'],Krupps:['krupps.com','www.krupps.com'],
 Aristarco:['aristarco.it','www.aristarco.it'],
 'Sistema Project Italia':['projectsystems.it','www.projectsystems.it'],
 Tecnodom:['tecnodomspa.com','www.tecnodomspa.com'],
 'Gastro Haal':['gastrohaal.sk','www.gastrohaal.sk']
};
const allowedRetailPhotoHosts=new Set(['static.materiel-horeca.com','images.metro-marketplace.eu','cubosupplies.com','www.hellopro.fr','tirol.bg','www.wea56.com','www.materielhoreca.com','www.audores.lt','audores.lt','nivaeq.com','www.ventus.com.gr','img.archiexpo.com','horeca365.ro','www.andretti.hu','restoll.ru','et-e.com.ua','res.cloudinary.com','www.mh-hygiene.com','flexikitch.com.au','www.pesage-mb.com','luxia-nce.co.uk','shop.gastrooprema.rs','itpizza-russia.ru','www.lahostelera.com','mdb-equipement.com']);
const seen=new Set();
for(const item of products){
 assert.ok(item&&typeof item==='object','Invalid product');
 assert.ok(brands.includes(item.manufacturer),'Unapproved manufacturer: '+item.manufacturer);
 assert.ok(typeof item.id==='string'&&item.id.startsWith(prefixes[item.manufacturer]+':'),'Invalid product ID '+item.id);
 assert.ok(!seen.has(item.id),'Duplicate product ID '+item.id);seen.add(item.id);
 assert.ok(typeof item.sku==='string'&&item.sku.trim(),'Missing model/SKU '+item.id);
 assert.ok(typeof item.name==='string'&&item.name.trim(),'Missing product title '+item.id);
 assert.ok(typeof item.category==='string'&&item.category.trim(),'Missing category '+item.id);
 assert.ok(item.price==null||typeof item.price==='number','Unexpected public price '+item.id);
 if(item.source_url){const u=new URL(item.source_url);assert.equal(u.protocol,'https:','Non HTTPS source '+item.id);assert.ok(hosts[item.manufacturer].includes(u.hostname),'Unexpected manufacturer source '+item.id);}
 if(item.image_url){
  const img=new URL(item.image_url);assert.equal(img.protocol,'https:','Non HTTPS image '+item.id);
  assert.ok(hosts[item.manufacturer].includes(img.hostname)||allowedRetailPhotoHosts.has(img.hostname),'Unknown product image host '+item.id);
 }
 if(item.record_status==='official_product_family_listing'){
  assert.equal(item.manufacturer,'Tecnodom');
  assert.ok(!item.image_url||(item.photo_match_type==='official_manufacturer_model_page'&&item.image_source==='official_manufacturer_model_page'&&new URL(item.image_url).hostname==='www.tecnodomspa.com'),'Only individually matched official manufacturer family photos are permitted');
  assert.equal(item.price,null,'Do not invent product family prices');
 }
 if(item.record_status==='official_model_index_only'){
  assert.equal(item.manufacturer,'Modular');
  assert.equal(item.image_url,null,'Do not invent unverified model images');
 }
}
for(const brand of brands){
 assert.ok(products.some(p=>p.manufacturer===brand),'Missing supplier catalog: '+brand);
 assert.ok(html.includes('value="'+brand+'"'),'Missing manufacturer filter option: '+brand);
}
const tecnodom=products.filter(p=>p.manufacturer==='Tecnodom');
assert.equal(tecnodom.length,54,'Tecnodom must contain only the 54 official Horizontal/Vertical families');
assert.equal(tecnodom.filter(p=>p.specifications?.['Termékvonal']==='HORIZONTAL').length,21);
assert.equal(tecnodom.filter(p=>p.specifications?.['Termékvonal']==='VERTICAL').length,33);
const gastro=products.filter(p=>p.manufacturer==='Gastro Haal');
for(const p of gastro){
 assert.ok(!/\/3_tuzhelyek(?:\/|$)/i.test(new URL(p.source_url).pathname),'Excluded Tűzhelyek product: '+p.id);
 assert.ok(p.image_url&&new URL(p.image_url).hostname==='gastrohaal.sk','Gastro Haal listings require individual manufacturer photos: '+p.id);
 assert.ok(p.source_url.includes('/hu/termekek/'),'Gastro Haal product needs its official detail page');
}
for(const control of ['id="search"','id="category"','id="manufacturer"','id="sortBy"','id="quotePanel"','id="quoteOpen"']){
 assert.ok(html.includes(control),'Missing catalog control '+control);
}
for(const section of ['gs-header-inner','gs-hero-showcase','gs-intro-strip','gs-catalog-heading','gs-process-grid','gs-bottom-cta','gs-footer-main']){
 assert.ok(html.includes(section),'Missing storefront section: '+section);
}
assert.ok(script.includes('loadFullSupplierCatalog()'),'Catalog loader missing');
assert.ok(script.includes('syncCategoriesForManufacturer'),'Manufacturer-aware category filter missing');
assert.ok(script.includes('addToQuote'),'Quote add handler missing');
assert.ok(script.includes("fetch('/api/quote'"),'Quote API integration missing');
assert.ok(script.includes("result?.success==='true'"),'Form submission must verify success response');
const stock=script.indexOf('let latestSupplierStock='),render=script.indexOf('render();');
assert.ok(stock!==-1&&stock<render,'Stock state must initialize before render');
const monitor=await readFile('stock-monitor.html','utf8');
const monitorScript=monitor.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
assert.ok(monitorScript,'Missing stock monitor script');
new vm.Script(monitorScript,{filename:'stock-monitor.inline.js'});
console.log('Verified '+products.length+' catalog entries across '+brands.length+' manufacturers and storefront script syntax');
