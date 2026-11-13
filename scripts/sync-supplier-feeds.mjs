// GastroSky 2.0 supplier feed importer.
// Run on GitHub Actions using supplier-authorized URLs in repository secrets.
// A product without a source photo stays unpictured; stock is unknown unless explicit.
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';

const feeds=[
  {manufacturer:'Maxima',url:process.env.MAXIMA_FEED_URL},
  {manufacturer:'HENDI',url:process.env.HENDI_FEED_URL},
  {manufacturer:'Fagor',url:process.env.FAGOR_FEED_URL},
  {manufacturer:'Modular',url:process.env.MODULAR_FEED_URL}
];
const productFile='data/catalog-products.json';
const stockFile='data/supplier-stock-snapshot.json';
const catalog=JSON.parse(await readFile(productFile,'utf8'));
const products=new Map(catalog.map(p=>[p.id,p]));
const stocks={};
let successful=0;
const pick=(r,names)=>{
 for(const k of names){const v=r[k.toLowerCase()];if(v!==undefined&&String(v).trim())return String(v).trim()}
 return '';
};
const cleanName=x=>x.toLowerCase().replace(/[^a-z0-9]+/g,'');
function normalize(row){
 const o={};for(const [k,v] of Object.entries(row)){const key=cleanName(k);if(key&&!o[key])o[key]=typeof v==='string'?v:JSON.stringify(v)}return o;
}
function csvRows(src) {
 // Supports UTF-8 BOM, semicolon or comma exports with RFC4180 quoting.
 src=src.replace(/^\uFEFF/,'');
 const firstLine=src.split(/\r?\n/,1)[0];
 const delim=(firstLine.match(/;/g)||[]).length>(firstLine.match(/,/g)||[]).length?';':',';
 let row=[],cell='',quote=false;const rows=[];
 for(let i=0;i<src.length;i++){
  const ch=src[i];
  if(ch==='"'){if(quote&&src[i+1]==='"'){cell+='"';i++}else quote=!quote}
  else if(ch===delim&&!quote){row.push(cell);cell=''}
  else if((ch==='\r'||ch==='\n')&&!quote){
   if(ch==='\r'&&src[i+1]==='\n')i++;
   row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';
  }else cell+=ch;
 }
 if(quote)throw Error('invalid CSV quotation');
 row.push(cell);if(row.some(Boolean))rows.push(row);
 const headers=rows.shift()||[];
 return rows.map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]||''])));
}
function xmlRows(src){
 // Supports common <product>, <item>, <offer>, <article> XML feed nodes.
 // No namespace-specific vendor assumptions; unknown feeds fail safely.
 const $=load(src,{xmlMode:true,decodeEntities:true});
 const nodes=$('product,item,offer,article').filter((_,el)=>$(el).children().length>0);
 return nodes.toArray().map(el=>{
  const row={};
  $(el).children().each((_,child)=>{
   const key=child.tagName?.replace(/^.*:/,'')||'';
   if(!key)return;
   const value=$(child).text().trim();
   if(value&&!row[key])row[key]=value;
   if(/images?|pictures?|photos?/i.test(key)){
    const links=$(child).find('url,src,image,picture').map((_,e)=>$(e).text().trim()).get();
    if(links.length)row[key]=links[0];
   }
  });
  return row;
 });
}
function publicUrl(raw){
 try{
  const u=new URL(raw);
  return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;
 }catch{return null}
}
function statusFromRecord(r){
 const qty=pick(r,['stock','stockquantity','quantity','qty','inventory','availablequantity','stocklevel']);
 if(qty!==''&&/^\d+$/.test(qty)){
  const n=Number(qty);
  if(Number.isSafeInteger(n))return {kind:n===0?'out_of_stock':'in_stock',quantity:n};
 }
 const raw=pick(r,['availability','stockstatus','instock','available','status']).toLowerCase();
 if(['yes','true','1','in stock','in_stock','available','on stock','in stock warehouse'].includes(raw))
  return {kind:'in_stock',quantity:null};
 if(['no','false','0','out of stock','out_of_stock','sold out','unavailable'].includes(raw))
  return {kind:'out_of_stock',quantity:0};
 return {kind:'unknown',quantity:null};
}
function mapProduct(r,manufacturer){
 const sku=pick(r,['sku','itemnumber','productcode','code','articlenumber','article','productid','id','artikelnummer','productno']);
 if(!sku||sku.length>80)return null;
 const name=pick(r,['productname','name','title','producttitle','descriptiontitle']);
 if(!name)return null;
 const id=manufacturer.toLowerCase()+':'+sku;
 const prev=products.get(id);
 const image=publicUrl(pick(r,['imageurl','imagelink','image','picture','pictureurl','productpicture','productimage','mainimage','mainpicture','photo','photo1','image1','img']));
 const source=publicUrl(pick(r,['url','producturl','link','productlink','sourceurl']));
 const ean=pick(r,['ean','gtin','barcode','ean13'])||prev?.ean||'';
 const desc=pick(r,['description','shortdescription','text','productdescription']);
 const category=pick(r,['category','categoryname','group','productgroup'])||prev?.category||'Egyéb';
 return {
  ...prev,id,manufacturer,supplier:manufacturer,sku,
  name:name.slice(0,300),description:(desc||prev?.description||'').slice(0,2000),
  category:category.slice(0,140),ean,
  specifications:prev?.specifications||{},
  image_url:image||prev?.image_url||null,
  image_source:image?'authorized_supplier_feed':prev?.image_source||'missing',
  source_url:source||prev?.source_url||null,
  record_status:'supplier_feed_import',source_type:'authorized_supplier_feed',
  price:null,availability:null
 };
}
for(const feed of feeds){
 if(!feed.url){console.log(feed.manufacturer+': no authorized feed URL configured, unchanged');continue}
 const url=publicUrl(feed.url);
 if(!url)throw Error(feed.manufacturer+': feed must have a valid HTTPS URL');
 const response=await fetch(url,{headers:{Accept:'application/xml, text/xml, text/csv, application/json'},signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error(feed.manufacturer+': supplier feed HTTP '+response.status);
 const raw=await response.text();
 if(raw.length>35000000)throw Error(feed.manufacturer+': supplier feed too large');
 const records=raw.trimStart().startsWith('<')?xmlRows(raw):raw.trimStart().startsWith('[')||raw.trimStart().startsWith('{')
   ?(()=>{const body=JSON.parse(raw);return Array.isArray(body)?body:body.products||body.items||[]})():csvRows(raw);
 if(!Array.isArray(records)||!records.length)throw Error(feed.manufacturer+': no recognizable products in feed');
 let mapped=0,withPhotos=0,knownStock=0;const observedAt=new Date().toISOString();
 for(const rawRecord of records){
  const r=normalize(rawRecord);const p=mapProduct(r,feed.manufacturer);
  if(!p||!p.image_url)continue;
  // Avoid publishing unpictured items or unsafe restricted products.
  if(/\b(?:knife|knives|blade|dagger|machete|k[eé]s|peng[eé])\b/i.test(p.name))continue;
  mapped++;withPhotos++;products.set(p.id,p);
  const status=statusFromRecord(r);
  if(status.kind!=='unknown')knownStock++;
  stocks[p.id]={id:p.id,sku:p.sku,kind:status.kind,quantity:status.quantity,expected_date:null,reason:status.kind==='unknown'?'supplier_feed_no_explicit_stock':null,checked_at:observedAt,source:'authorized_supplier_feed'};
 }
 if(!mapped)throw Error(feed.manufacturer+': no valid SKU/name pairs. Supplier feed format needs mapping.');
 successful++;
 console.log(feed.manufacturer+': mapped '+mapped+' products, '+withPhotos+' photos, '+knownStock+' explicit stock statuses');
}
// Fail safe: no feed configured = no public data files changed.
if(!successful)throw Error('No supplier feed configured. Set at least one of MAXIMA_FEED_URL, HENDI_FEED_URL, FAGOR_FEED_URL or MODULAR_FEED_URL in GitHub Actions secrets.');
const all=[...products.values()].sort((a,b)=>a.manufacturer.localeCompare(b.manufacturer)||a.sku.localeCompare(b.sku));
await writeFile(productFile,JSON.stringify(all,null,2)+'\n');
// Existing stock from older supplier imports must not appear fresh.
const old=JSON.parse(await readFile(stockFile,'utf8').catch(()=>'{}'));
const snapshot={...old,...stocks};
await writeFile(stockFile,JSON.stringify(snapshot,null,2)+'\n');
console.log('Complete product catalog and stock snapshot written for Cloudflare.');
