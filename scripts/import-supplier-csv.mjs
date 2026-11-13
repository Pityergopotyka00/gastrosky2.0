// Bulk catalog importer for *authorized* Maxima and HENDI CSV exports.
// Input: data/imports/maxima.csv and data/imports/hendi.csv
// Output: data/catalog-products.json and embedded index.html catalog.
// Never interpret a supplier product catalog as a live inventory feed.
import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
const target='data/catalog-products.json', htmlPath='index.html';
function parseCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
  else if(c===','&&!quoted){row.push(cell);cell=''}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell=''}
  else cell+=c;
 }
 if(quoted)throw Error('Invalid CSV: unclosed quoted value');
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 return rows;
}
function canon(h){return h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_-]+/g,'')}
function convertCsv(source,supplier){
 const rows=parseCSV(source.replace(/^\uFEFF/,''));
 if(rows.length<2)return [];
 const header=rows.shift().map(canon);
 const field=(row,names)=>{const index=header.findIndex(h=>names.some(n=>canon(n)===h));return index<0?'':String(row[index]||'').trim()};
 const items=[];
 for(const row of rows){
  const sku=field(row,['sku','cikkszam','itemnumber','item_number','article_number','product_code','artikelnummer']);
  if(!sku)continue;
  const ean=field(row,['ean','barcode','gtin','vonalkod']);
  const name=field(row,['name','product_name','nev','termeknev','title']);
  if(!name)continue;
  const description=field(row,['description','short_description','leiras']);
  const category=field(row,['category','kategori­a','kategoria'])||'Egyéb berendezések';
  const image=field(row,['image_url','image','photo_url','picture_url']);
  const productUrl=field(row,['product_url','url','source_url','link']);
  const verifiedUrl=(value,domains)=>{
    try{const u=new URL(value);return u.protocol==='https:'&&domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d))?u.href:null}catch{return null}
  };
  const domains=supplier==='Maxima'?['maxima.com']:['hendi.eu'];
  items.push({
   id:supplier.toLowerCase()+':'+sku,manufacturer:supplier,supplier:supplier,
   name:name.slice(0,300),category:category.slice(0,120),sku,ean,
   description:description.slice(0,1500),specifications:{},
   source_url:verifiedUrl(productUrl,domains),
   image_url:verifiedUrl(image,domains),
   image_source:verifiedUrl(image,domains)?'authorized_supplier_export':'pending_supplier_media',
   price:null,availability:null,stock_source_status:'not_verified',
   record_status:'supplier_import_requires_review',
   source_type:'authorized_supplier_csv'
  });
 }
 return items;
}
const existing=JSON.parse(await readFile(target,'utf8'));
const byId=new Map(existing.map(p=>[p.id,p]));
let seenFiles=0,imported=0;
for(const [supplier,file] of [['Maxima','data/imports/maxima.csv'],['HENDI','data/imports/hendi.csv']]){
 if(!existsSync(file)){console.log('No '+supplier+' file at '+file+'; skipping');continue}
 seenFiles++;
 const text=await readFile(file,'utf8');
 const batch=convertCsv(text,supplier);
 for(const p of batch){
  const current=byId.get(p.id);
  byId.set(p.id,{...current,...p,
   image_url:p.image_url||current?.image_url||null,
   source_url:p.source_url||current?.source_url||null,
   image_source:p.image_url?'authorized_supplier_export':(current?.image_source||'pending_supplier_media')
  });
 }
 imported+=batch.length;
}
if(!seenFiles)throw Error('Missing supplier files: add authorized CSV exports to data/imports/maxima.csv or hendi.csv. No products were changed.');
const catalog=[...byId.values()].sort((a,b)=>a.manufacturer.localeCompare(b.manufacturer)||a.sku.localeCompare(b.sku));
await writeFile(target,JSON.stringify(catalog,null,2)+'\n');
let html=await readFile(htmlPath,'utf8');
const start=html.indexOf('const products='),end=html.indexOf(';\nconst search=',start);
if(start<0||end<0)throw Error('Cannot find product data in index.html');
html=html.slice(0,start)+'const products='+JSON.stringify(catalog).replaceAll('<','\\u003c')+html.slice(end);
await writeFile(htmlPath,html);
console.log('Imported or updated '+imported+' records; catalog now has '+catalog.length+' products. Review supplier terms, catalog and images before publication.');
