import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const base=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const selected=[
 ['HENDI','https://www.hendi.eu/en/kitchen-appliances/'],
 ['HENDI','https://www.hendi.eu/en/kitchen-appliances/grills-and-griddles/'],
 ['HENDI','https://www.hendi.eu/en/kitchen-appliances/deep-fryers/'],
 ['HENDI','https://www.hendi.eu/en/kitchen-appliances/cookers/'],
 ['Modular','https://www.modular.it/en/prodotti/Fun%20600%20-%20Modular/Gas%20ranges'],
 ['Modular','https://www.modular.it/en/prodotti/Fun%20600%20-%20Modular/Fryers'],
 ['Modular','https://www.modular.it/en/products/fun-600-11'],
 ['Sistema Project Italia','https://www.projectsystems.it/en/projects/'],
 ['Sistema Project Italia','https://www.projectsystems.it/en/projects/page/2/'],
 ['Sistema Project Italia','https://www.projectsystems.it/en/projects-categories/glasswashers-and-dishwashers/'],
 ['Krupps','https://www.krupps.com/en/catalogue/evolution-range/'],
 ['Aristarco','https://www.aristarco.it/en/ice/categories/storage-bins/'],
 ['Aristarco','https://www.aristarco.it/en/ice/categories/full-ice-cube-36-gr/'],
 ['Tecnodom','https://www.tecnodomspa.com/en/orizzontale/tavoli-refrigerati/tavolo-60.html']
];
const result={date:new Date().toISOString(),sites:[]};
for(const [manufacturer,url] of selected){
 const o={manufacturer,url};
 try{
 const r=await fetch(url,{headers:{'User-Agent':'GastroSkyCatalogMigration/1.0',Accept:'text/html'},signal:AbortSignal.timeout(13500)});
 o.status=r.status;
 if(!r.ok)throw Error('http:'+r.status);
 const $=load(await r.text());o.text=$('body').text().replace(/\s+/g,' ').trim().slice(0,1400);
 const links=$('a[href]').map((i,e)=>({href:$(e).attr('href'),text:$(e).text().replace(/\s+/g,' ').trim().slice(0,85),cls:$(e).attr('class')})).get();
 o.link_count=links.length;
 o.product_links=links.filter(x=>/product|prodot|\/en\/projects\/|catalogue\/|\.html/i.test(x.href||'')&&(!/login|wishlist|account|tracking/i.test(x.href||''))).slice(-75);
 o.products=$('li.product-item,.products li,.product-item,.product_item,.product-card,.woocommerce-LoopProduct-link,.portfolio-item,article').slice(0,6).map((i,e)=>$(e).prop('outerHTML')?.slice(0,1200)).get();
 o.structured=$('[itemprop=sku],.product.attribute.sku,.sku,.product__sku,.product-info-main').slice(0,5).map((i,e)=>({text:$(e).text().replace(/\s+/g,' ').trim().slice(0,150),html:$(e).prop('outerHTML')?.slice(0,800)})).get();
 o.headers=$('h1,h2,h3,h4').map((i,e)=>({tag:e.tagName,txt:$(e).text().replace(/\s+/g,' ').trim().slice(0,90)})).get().filter(x=>x.txt).slice(0,40);
 o.img=$('main img').slice(0,5).map((i,e)=>({src:$(e).attr('src'),alt:$(e).attr('alt')})).get();
 }catch(e){o.error=String(e.message||e).slice(0,150)}
 result.sites.push(o);await new Promise(r=>setTimeout(r,350));
}
await writeFile('data/under100-markup-probe.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.sites.map(x=>({manufacturer:x.manufacturer,url:x.url,http:x.status,links:x.link_count,products:x.products?.length,headers:x.headers?.slice(0,7),error:x.error}))));
