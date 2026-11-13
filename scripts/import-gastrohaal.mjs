// Import only genuine Gastro Haal model pages with verified manufacturer photos.
// Excludes the entire "Tűzhelyek" (stove/range) subtree, but permits Főzőzsámolyok.
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const ROOT='https://gastrohaal.sk/hu/termekek';
const mainGroups={
 '1_fozoustok':'Főzőüstök',
 '77_kotol-panvice':'Főzőüstök-serpenyők',
 '2_billentoserpenyok':'Billenőserpenyők',
 '5_elektromos-sutok':'Elektromos sütők',
 '4_fozozsamolyok':'Főzőzsámolyok',
 '72_burgonyakoptatok':'Burgonyakoptatók',
 '6_bain-maries':'Bain-maries',
 '61_automata-fertotlenito-adagolo':'Fertőtlenítés és kamera terminál'
};
const normalize=s=>String(s||'').replace(/\s+/g,' ').trim();
const slug=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const excluded=url=>/\/\d+_tuzhelyek(?:\/|$)|\/tuzhelyek(?:\/|$)|\/(?:combined|electric|gas|induction)[-_](?:ranges|stoves)(?:\/|$)|\/accessories-for-ranges(?:\/|$)/i.test(new URL(url).pathname);
const isLocal=url=>{try{const u=new URL(url,ROOT);return u.origin==='https://gastrohaal.sk'&&u.pathname.startsWith('/hu/termekek')&&!excluded(u.href)}catch{return false}};
const href=(raw,base)=>{try{const u=new URL(raw,base);u.hash='';u.search='';return isLocal(u.href)?u.href:null}catch{return null}};
const rootPath=url=>new URL(url).pathname.replace(/^\/hu\/termekek\/?/,'').split('/').filter(Boolean);
const isProduct=url=>{const p=rootPath(url);return p.length>=2&&/^\d{2,}_/.test(p[p.length-1])&&Number(p[p.length-1].split('_')[0])>=120};
const isCategory=url=>rootPath(url).length>0&&!isProduct(url);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const requests=new Map();
async function fetchPage(url){
 if(requests.has(url))return requests.get(url);
 const work=(async()=>{
  const res=await fetch(url,{headers:{Accept:'text/html','User-Agent':'GastroSkyCatalog/1.0 (+model-and-image-verification)'},signal:AbortSignal.timeout(11000)});
  if(!res.ok||!isLocal(res.url)||!(res.headers.get('content-type')||'').includes('text/html'))throw Error('page_unavailable');
  return {doc:load(await res.text()),url:res.url};
 })();
 requests.set(url,work);
 return work;
}
async function validImage(url){
 try{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='gastrohaal.sk'||!/\.(jpe?g|png|webp)$/i.test(u.pathname))return false;
  const res=await fetch(url,{headers:{Range:'bytes=0-2047'},signal:AbortSignal.timeout(8000)});
  if(!res.ok||!(res.headers.get('content-type')||'').startsWith('image/'))return false;
  await res.body?.cancel();return true;
 }catch{return false}
}
function photoCandidates($,url){
 const candidates=[];
 const add=(raw,score)=>{
  if(!raw)return;
  try{
   const u=new URL(raw,url);
   if(u.protocol!=='https:'||u.hostname!=='gastrohaal.sk'||!/\.(?:jpe?g|png|webp)$/i.test(u.pathname))return;
   if(/logo|flag|ikona|icon|pdf|social|banner|default|no-image|favicon|avatar/i.test(u.pathname))return;
   candidates.push({url:u.href,score});
  }catch{}
 };
 for(const sel of ['meta[property="og:image"]','meta[name="twitter:image"]'])add($(sel).attr('content'),8);
 $('img').each((_,el)=>{
  const img=$(el),near=normalize(img.attr('alt')+' '+img.attr('title')),parent=img.closest('a');
  const sc=/produkt|product|detail|gallery|main|photo|foto|obrazok|image/i.test((img.attr('class')||'')+' '+(img.parent().attr('class')||''));
  for(const key of ['data-large-image','data-zoom-image','data-src','src'])add(img.attr(key),sc?10:4);
  if(parent.length)add(parent.attr('href'),sc?11:5);
 });
 return [...new Map(candidates.sort((a,b)=>b.score-a.score).map(x=>[x.url,x])).values()];
}
function categoryInfo(url){
 const first=rootPath(url)[0]||'';
 const groups=[
  [/fozoustok|varne-kotly/i,'Főzőüstök'],
  [/kotol-panvice/i,'Főzőüstök-serpenyők'],
  [/billentoserpenyok/i,'Billenőserpenyők'],
  [/elektromos-sutok/i,'Elektromos sütők'],
  [/fozozsamolyok/i,'Főzőzsámolyok'],
  [/burgonyakoptatok/i,'Burgonyakoptatók'],
  [/bain-maries/i,'Bain-maries'],
  [/fertotlenito|dezinflex/i,'Fertőtlenítés és kamera terminál']
 ];
 const main=groups.find(([pattern])=>pattern.test(first))?.[1]||'Egyéb berendezések';
 return {main};
}
const catalog=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const known=new Set(catalog.map(p=>p.id));
const queue=[ROOT],seen=new Set(),productLinks=new Map(),errors=[];
const rootMap={...mainGroups};
while(queue.length&&seen.size<220){
 const url=queue.shift();if(seen.has(url)||excluded(url))continue;seen.add(url);
 try{
  const {doc:$,url:resolved}=await fetchPage(url);
  // Discover categories by the website's navigational links. A group inherits its
  // parent title; top-level product groups are always treated as categories.
  const links=$('a[href]').toArray();
  for(const el of links){
   const a=$(el),link=href(a.attr('href'),resolved);if(!link||link===ROOT||excluded(link))continue;
   const path=rootPath(link);
   if(!path.length)continue;
   if(isProduct(link)){
    const text=normalize(a.text());if(!productLinks.has(link))productLinks.set(link,text);
    continue;
   }
   if(isCategory(link)&&!seen.has(link)&&!queue.includes(link)&&path.length<=3){
    // Only follow official product-category navigation, not unrelated content.
    queue.push(link);
    if(path.length===1&&!rootMap[path[0]])rootMap[path[0]]=normalize(a.text())||'Gastro Haal berendezések';
   }
  }
  const next=$('a[href]').toArray().map(el=>href($(el).attr('href'),resolved)).filter(Boolean)
    .filter(link=>/\/(?:page|strana)\/\d+|[?&](?:page|p)=\d+/i.test(link));
  queue.push(...next.filter(link=>!seen.has(link)));
 }catch(e){errors.push({url,error:String(e.message||e).slice(0,90)});}
 await wait(130);
}
const additions=[],unresolved=[];
for(const [url,listingName] of productLinks){
 try{
  const {doc:$}=await fetchPage(url);
  const productCode=rootPath(url).at(-1).match(/^(\d+)_/)?.[1];
  if(!productCode)continue;
  const id='gastrohaal:'+productCode;
  // Owner-excluded accessories and DEZINFLEX M listings; do not re-import.
  if(new Set(['275','280','282','283','284','285']).has(productCode))continue;
  if(known.has(id))continue;
  const title=normalize($('h1').first().text())||normalize($('h2').first().text())||listingName;
  const detailTitle=normalize($('h2').first().text());
  const name=normalize((title+' '+detailTitle).slice(0,170));
  if(!name||/tűzhely|sporák|sporak|stove with base|ranges/i.test(name)&&rootPath(url)[0]==='3_tuzhelyek')continue;
  const info=categoryInfo(url);
  const photos=photoCandidates($,url);
  let image_url=null;
  for(const c of photos.slice(0,7)){if(await validImage(c.url)){image_url=c.url;break;}}
  if(!image_url){unresolved.push({url,name,reason:'no_confirmed_matching_photo'});continue;}
  const specs={Főcsoport:info.main};
  $('tr').slice(0,16).each((_,row)=>{
   const t=$(row).find('th,td').toArray().map(x=>normalize($(x).text())).filter(Boolean);
   if(t.length>=2&&t[0].length<85&&t[1].length<160)specs[t[0]]=t[1];
  });
  const description=normalize($('meta[name="description"]').attr('content')||$('main p').first().text()||'');
  const product={
   id,manufacturer:'Gastro Haal',manufacturer_status:'official_product_page',
   supplier:'GASTRO-HAAL s.r.o.',sku:productCode,model:title,name:'Gastro Haal – '+name,
   category:'Gastro Haal – '+info.main,
   description:description.length>45?description.slice(0,1100):'Gastro Haal professzionális berendezés a gyártó hivatalos katalógusából. A részleteket a modell adatlapja tartalmazza.',
   specifications:specs,
   source_url:url,source_type:'official_manufacturer_product_page',
   record_status:'manufacturer_page_and_photo_verified',
   image_url,image_source:'official_manufacturer_product_page',
   photo_status:'verified_url_display_permission_to_confirm',
   price:null,availability:null,stock_source_status:'unknown'
  };
  additions.push(product);known.add(id);
 }catch(e){unresolved.push({url,name:listingName,reason:String(e.message||e).slice(0,100)});}
 await wait(120);
}
await writeFile('data/catalog-products.json',JSON.stringify([...catalog,...additions],null,2)+'\n');
await writeFile('data/gastrohaal-import-report.json',JSON.stringify({
 imported_at:new Date().toISOString(),category_pages_checked:seen.size,
 product_pages_discovered:productLinks.size,
 published_with_images:additions.length,
 excluded_group:'Tűzhelyek (all numeric-prefix _tuzhelyek paths and descendants)',
 unresolved,errors
},null,2)+'\n');
console.log(JSON.stringify({category_pages:seen.size,found:productLinks.size,with_photos:additions.length,unresolved:unresolved.length,errors:errors.length}));
