// Add ONLY real product-card photographs on pages that explicitly identify
// the exact Fagor model AND manufacturer's numerical SKU.
// Never substitute a drawing, illustration, generic range photo, or near variant.
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const file='data/catalog-products.json';
const products=JSON.parse(await readFile(file,'utf8'));
const candidates=[
 {sku:'19102772',model:'CI-CG604T',page:'https://contessa.rs/proizvod/profesionalni-gasni-top-sporet/',photo:'https://contessa.rs/wp-content/uploads/2020/12/CI-CG604T2-fagor.jpg'},
 {sku:'19101248',model:'FT-G710 L',page:'https://contessa.rs/proizvod/gasni-rostilj-ravna-ploca-fagor-ft-g710-l-serija-700/',photo:'https://contessa.rs/wp-content/uploads/2022/06/gasni-rostilj-fagor-ravni-FT-G710-L.jpg'},
 {sku:'19101390',model:'FT-E705 L',page:'https://contessa.rs/proizvod/profesionalni-strujni-rostilj-ravna-ploca/',photo:'https://contessa.rs/wp-content/uploads/2020/12/rostilj-fagor-struja-ravna-ploca-400-mm.jpg'},
 {sku:'19074120',model:'B-G705',page:'https://jopco.net/producto/parrilla-de-cocina-a-gas-de-20-x-7-pulgadas-19074120-fagor/',photo:'https://jopco.net/wp-content/uploads/2023/07/FG-B-G705-LPG.jpg'},
 {sku:'19074781',model:'B-G705 I',page:'https://cateringinventar.dk/produkter/maskiner-smaa-el/koge-varme-og-stege/gas-grill-b-g705-i-fagor/',photo:'https://cateringinventar.dk/wp-content/uploads/2024/05/80f3e1a0-18de-49a7-b17c-a7832dffae89.jpg'},
 {sku:'19101247',model:'FT-E710 L',page:'https://contessa.rs/proizvod/elektricni-rostilj-ravna-ploca-700/',photo:'https://contessa.rs/wp-content/uploads/2020/12/rostilj-fagor-struja-ravna-ploca-800-mm.jpg'}
];
const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/gi,'').toUpperCase();
const forbidden=/drawing|blueprint|manual|scheme|sketch|diagram|illustration|mockup|logo|icon|favicon|banner|placeholder/i;
const allowed=new Set(['contessa.rs','jopco.net','cateringinventar.dk']);
const report={checked_at:new Date().toISOString(),checked:0,added:0,matched:[],unmatched:[]};
const existing=new Map();
for(const p of products)if(p.image_url){try{const u=new URL(p.image_url);existing.set(u.origin+u.pathname,[...(existing.get(u.origin+u.pathname)||[]),norm(p.model||p.sku)]);}catch{}}
for(const seed of candidates){
 report.checked++;
 const p=products.find(p=>p.manufacturer==='Fagor'&&p.sku===seed.sku);
 try{
  if(!p)throw Error('sku_not_in_current_storefront_catalog');
  if(p.image_url)throw Error('catalog_already_has_image');
  if(norm(p.model)!==norm(seed.model))throw Error('catalog_model_mismatch');
  const source=new URL(seed.page),photo=new URL(seed.photo);
  if(!allowed.has(source.hostname)||photo.hostname!==source.hostname||source.protocol!=='https:'||photo.protocol!=='https:')throw Error('untrusted_retailer_domain');
  if(!/\.(?:jpe?g|png|webp)$/i.test(photo.pathname)||forbidden.test(photo.pathname))throw Error('not_a_product_photo_asset');
  const response=await fetch(seed.page,{signal:AbortSignal.timeout(16000),headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogMedia/1.0'}});
  if(!response.ok||new URL(response.url).hostname!==source.hostname)throw Error('product_page_not_available');
  const $=load(await response.text());
  const body=$('body').text();
  const title=$('h1').first().text();
  if(!body.includes(seed.sku))throw Error('exact_sku_not_on_retailer_page');
  if(!norm(title).includes(norm(seed.model)))throw Error('exact_model_not_in_product_title');
  if(!/fagor/i.test(title))throw Error('manufacturer_not_in_product_title');
  const og=$('meta[property="og:image"]').attr('content');
  const gallery=$('.woocommerce-product-gallery img,.product-images img,.product-cover img,.product-image img,.product-images-container img,.js-qv-product-cover')
   .toArray().flatMap(el=>['src','data-src','data-original'].map(key=>$(el).attr(key))).filter(Boolean);
  const normalizeUrl=(raw)=>{try{const u=new URL(raw,seed.page);u.search='';u.hash='';return u.href}catch{return ''}};
  const images=[og,...gallery].filter(Boolean).map(normalizeUrl);
  if(!images.includes(normalizeUrl(seed.photo)))throw Error('photo_not_present_in_product_gallery_or_og');
  const key=photo.origin+photo.pathname;
  if((existing.get(key)||[]).some(x=>x!==norm(seed.model)))throw Error('same_photo_already_for_different_model');
  const img=await fetch(seed.photo,{headers:{'User-Agent':'GastroSkyCatalogMedia/1.0',Range:'bytes=0-128'},signal:AbortSignal.timeout(15000)});
  const good=img.ok&&new URL(img.url).hostname===photo.hostname&&(img.headers.get('content-type')||'').toLowerCase().startsWith('image/');
  await img.body?.cancel();
  if(!good)throw Error('product_photo_not_http_verified');
  p.image_url=seed.photo;
  p.image_source='retailer_real_product_photo_sku_verified';
  p.image_reference_page=seed.page;
  p.photo_match_type='exact_manufacturer_sku_and_model_product_gallery';
  p.photo_status='real_product_photo_http_verified_reuse_rights_to_confirm';
  existing.set(key,[...(existing.get(key)||[]),norm(seed.model)]);
  report.added++;
  report.matched.push({id:p.id,model:p.model,sku:seed.sku,source:seed.page,image_url:seed.photo});
 }catch(e){report.unmatched.push({sku:seed.sku,model:seed.model,reason:String(e.message||e).slice(0,120)})}
 await new Promise(r=>setTimeout(r,300));
}
if(report.added){
 await writeFile(file,JSON.stringify(products,null,2)+'\n');
 let html=await readFile('index.html','utf8');
 const begin=html.indexOf('let products='),end=html.indexOf(';\nconst categoryGroup=',begin);
 if(begin<0||end<0)throw Error('cannot_locate_embedded_storefront_catalog');
 html=html.slice(0,begin)+'let products='+JSON.stringify(products).replace(/</g,'\\u003c')+html.slice(end);
 await writeFile('index.html',html);
}
await writeFile('data/fagor-verified-retail-photos-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checked:report.checked,added:report.added,unmatched:report.unmatched}));
