// Add only real Krupps model codes visible in current official catalog listings.
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const file='data/catalog-products.json';
const products=JSON.parse(await readFile(file,'utf8'));
const brand='Krupps',target=101;
const names=products.filter(p=>p.manufacturer===brand).map(p=>p.sku.toUpperCase());
const existing=new Set(names);
const ids=new Set(products.map(p=>p.id));
const paths=[
 'kera-range','elitech-range','soft-range','koral-range','advance-range','evolution-range',
 'elitech-north-america','koral-north-america','type/glasswasher','type/undercounter-dishwasher',
 'type/pass-through-dishwasher','type/warewasher','type/rack-conveyor-dishwashers'
];
const report={date:new Date().toISOString(),before:existing.size,target,added:[],pages:[],rejections:[]};
for(const slug of paths){
 if(products.filter(p=>p.manufacturer===brand).length>=target)break;
 const url='https://www.krupps.com/en/catalogue/'+slug+'/';
 const page={url,items:0,added:0};
 try{
  const r=await fetch(url,{headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogVerification/1.0'},signal:AbortSignal.timeout(14000)});
  page.http=r.status;
  if(!r.ok||new URL(r.url).hostname!=='www.krupps.com')throw Error('catalog_page_unavailable');
  const $=load(await r.text());
  const listings=$('article.dt_portfolio,article.type-dt_portfolio').toArray();
  page.items=listings.length;
  for(const item of listings){
   if(products.filter(p=>p.manufacturer===brand).length>=target)break;
   const c=$(item);
   const a=c.find('h3.entry-title a').first();
   const sku=a.text().replace(/\s+/g,' ').trim().toUpperCase();
   const href=(a.attr('href')||'').trim();
   if(!/^[A-Z0-9]{2,12}(?:-[A-Z0-9]{1,6})?$/.test(sku)||!href||existing.has(sku))continue;
   const site=new URL(href,url);
   if(site.hostname!=='www.krupps.com'||site.protocol!=='https:'||!/\/catalogo\/[^/]+\/prodotto\//.test(site.pathname))continue;
   const id='krupps:'+sku;if(ids.has(id))continue;
   const img=c.find('figure img').first();
   const photoLink=(img.attr('data-src')||img.attr('src')||'').trim();
   let image=null;
   try{
    const p=new URL(photoLink,site.href);
    const base=decodeURIComponent(p.pathname.split('/').at(-1)).toUpperCase();
    if(p.hostname==='www.krupps.com' && p.protocol==='https:' && base.startsWith(sku+'.') && /\.(?:jpe?g|png|webp)$/i.test(p.pathname))image=p.href;
   }catch{}
   const group=slug.split('/')[0].replace(/-range|-north-america/i,'').replace(/-/g,' ').trim();
   const name='Krupps '+sku+' – ipari mosogatógép';
   products.push({id,manufacturer:brand,supplier:brand,manufacturer_status:'verified_official_range',
    name,sku,model:sku,category:'Mosogatástechnika',ean:'',
    description:'Krupps '+sku+' ipari mosogatógép. Gyártói termékmodell, hivatalos katalógusoldal alapján.',
    specifications:{'Modell':sku,'Termékvonal':group},
    source_url:site.href,source_type:'official_manufacturer_product_page',record_status:'manufacturer_exact_model_detail',
    image_url:image,image_source:image?'official_manufacturer_exact_filename':'manufacturer_image_pending',
    price:null,availability:null,stock_source_status:'pending_supplier_stock'});
   existing.add(sku);ids.add(id);page.added++;
   report.added.push({sku,url:site.href,image_url:image,group});
  }
 }catch(e){page.error=String(e.message||e)}
 report.pages.push(page);
 await new Promise(r=>setTimeout(r,380));
}
report.after=products.filter(p=>p.manufacturer===brand).length;
if(report.added.length){
 await writeFile(file,JSON.stringify(products,null,2)+'\n');
 let html=await readFile('index.html','utf8');
 const i=html.indexOf('let products='),j=html.indexOf(';\nconst categoryGroup=',i);
 if(i<0||j<0)throw Error('inline_catalog_missing');
 html=html.slice(0,i)+'let products='+JSON.stringify(products).replace(/</g,'\\u003c')+html.slice(j);
 await writeFile('index.html',html);
}
await writeFile('data/krupps-101-expansion-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({before:report.before,after:report.after,added:report.added.length,pages:report.pages}));
