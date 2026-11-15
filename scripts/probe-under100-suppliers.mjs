import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const items=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const seeds=[
 ['HENDI','https://www.hendi.eu/en/kitchen-appliances/'],
 ['HENDI','https://www.hendi.eu/en/grills-griddles/'],
 ['HENDI','https://www.hendi.eu/en/deep-fryers/'],
 ['HENDI','https://www.hendi.eu/en/cooling/'],
 ['HENDI','https://www.hendi.eu/en/griddle-flat-512400.html'],
 ['Modular','https://www.modular.it/en/products/fun-600'],
 ['Modular','https://www.modular.it/en/warehouse/items'],
 ['Modular','https://www.modular.it/en/Fun'],
 ['Krupps','https://www.krupps.com/en/catalogue/'],
 ['Krupps','https://www.krupps.com/en/catalogue/type/glasswasher/'],
 ['Krupps','https://www.krupps.com/en/catalogue/advance-range/'],
 ['Aristarco','https://www.aristarco.it/en/washing/categories/'],
 ['Aristarco','https://www.aristarco.it/en/ice/categories/'],
 ['Aristarco','https://www.aristarco.it/en/washing/categories/warewashers/'],
 ['Sistema Project Italia','https://www.projectsystems.it/en/projects/'],
 ['Sistema Project Italia','https://www.projectsystems.it/en/projects-categories/'],
 ['Tecnodom','https://www.tecnodomspa.com/en/orizzontale/tavoli-refrigerati/tavolo-60.html'],
 ['Tecnodom','https://www.tecnodomspa.com/en/verticale.html'],
 ['Tecnodom','https://www.tecnodomspa.com/en/orizzontale.html']
];
const report={checked_at:new Date().toISOString(),pages:[]};
for(const [brand,url] of seeds){
 const z={brand,url};
 try{
 const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'GastroSkyPublicCatalogImporter/1.0',Accept:'text/html'}});
 z.status=r.status;z.final=r.url;
 if(!r.ok)throw Error('http:'+r.status);
 const $=load(await r.text());z.title=$('title').text().trim().slice(0,130);
 z.h1=$('h1').first().text().replace(/\s+/g,' ').trim().slice(0,160);
 z.headingSample=$('h2,h3,h4').toArray().map(x=>$(x).text().replace(/\s+/g,' ').trim()).filter(x=>x&&x.length<110).slice(0,50);
 const links=$('a[href]').toArray().map(el=>({text:$(el).text().replace(/\s+/g,' ').trim().slice(0,85),href:$(el).attr('href')}));
 z.links=links.filter(x=>/product|prodot|catalog|category|warewash|dishwash|ice\/|grill|kitchen|restaurant|project|equipment|[A-Z]\d\d\d/i.test(x.href+' '+x.text)).slice(0,65);
 z.jsonld=$('script[type="application/ld+json"]').toArray().map(x=>$(x).html().slice(0,1000)).slice(0,3);
 z.meta={sku:$('meta[property="product:retailer_item_id"]').attr('content'),og:$('meta[property="og:image"]').attr('content'),canonical:$('link[rel=canonical]').attr('href')};
 z.models=Object.keys(Object.groupBy(items.filter(p=>p.manufacturer===brand),p=>p.sku.toUpperCase())).length;
 }catch(e){z.error=String(e.message||e).slice(0,180)}
 report.pages.push(z);
 await new Promise(r=>setTimeout(r,300));
}
await writeFile('data/under100-supplier-probe.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.pages.map(x=>({brand:x.brand,url:x.url,status:x.status,headings:x.headingSample?.length,links:x.links?.length,jsonld:x.jsonld?.length,error:x.error}))));
