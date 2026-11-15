import {load} from 'cheerio';
import {readFile,writeFile} from 'node:fs/promises';
const products=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const brands=['HENDI','Krupps','Aristarco','Modular','Sistema Project Italia','Tecnodom'];
const checks=[
['Aristarco','https://www.aristarco.it/en/washing/categories/front-loader/'],
['Aristarco','https://www.aristarco.it/en/washing/categories/warewashers/'],
['Aristarco','https://www.aristarco.it/en/washing/categories/hood-dishwashers/'],
['Aristarco','https://www.aristarco.it/en/ice/categories/cubetto-pieno-18gr/'],
['Krupps','https://www.krupps.com/en/catalogue/advance-range/'],
['Krupps','https://www.krupps.com/en/catalogue/type/glasswasher/'],
['Krupps','https://www.krupps.com/en/catalogue/type/pass-through-dishwasher/'],
['Modular','https://www.modular.it/en/products/fun-600'],
['Modular','https://www.modular.it/en/products/fun-600-11'],
['Modular','https://www.modular.it/en/warehouse/items'],
['Sistema Project Italia','https://www.projectsystems.it/en/projects/a-series/'],
['Sistema Project Italia','https://www.projectsystems.it/en/projects/'],
['HENDI','https://www.hendi.eu/en/'],
['HENDI','https://www.hendi.eu/en/griddle-flat-512400.html'],
['Tecnodom','https://www.tecnodomspa.com/en/verticale.html'],
['Tecnodom','https://www.tecnodomspa.com/en/orizzontale.html'],
['Tecnodom','https://www.tecnodomspa.com/en/orizzontale/tavoli-refrigerati.html'],
];
const result={checked_at:new Date().toISOString(),existing:Object.fromEntries(brands.map(b=>[b,products.filter(x=>x.manufacturer===b).length])),pages:[]};
for(const [brand,url] of checks){
 const info={brand,url};
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'Accept':'text/html','User-Agent':'GastroSkyCatalogResearch/1.0'}});
  info.http=r.status;info.url_actual=r.url;
  if(!r.ok)throw Error('http_'+r.status);
  const html=await r.text(),$=load(html);
  info.title=$('title').text().trim().slice(0,130);
  info.headings=$('h1,h2,h3,h4').toArray().slice(0,80).map(x=>$(x).text().replace(/\s+/g,' ').trim()).filter(Boolean);
  info.links=$('a[href]').toArray().map(x=>({text:$(x).text().replace(/\s+/g,' ').trim().slice(0,110),href:new URL($(x).attr('href'),r.url).href})).filter(x=>x.text&&/^https/.test(x.href)&&/aristarco.it|krupps.com|modular.it|projectsystems.it|hendi.eu|tecnodomspa.com/.test(new URL(x.href).hostname)).slice(0,150);
  info.images=$('img').toArray().map(x=>({src:$(x).attr('src')||$(x).attr('data-src'),alt:$(x).attr('alt')})).filter(x=>x.src).slice(0,100);
  info.html_length=html.length;
 }catch(e){info.error=String(e.message||e).slice(0,140)}
 result.pages.push(info);
 console.log(brand,info.http,info.title,'headings',info.headings?.length,'links',info.links?.length,info.error||'');
 await new Promise(r=>setTimeout(r,250));
}
await writeFile('data/six-brand-expansion-probe.json',JSON.stringify(result,null,2)+'\n');
