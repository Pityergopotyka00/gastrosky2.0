// Inspect Fagor official PUBLIC product image markup (no login).
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const products=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const fagor=products.filter(p=>p.manufacturer==='Fagor');
const missing=fagor.filter(p=>!p.image_url);
const pages=[
 'https://www.fagorprofessional.com/en/kitchen-appliances',
 'https://www.fagorprofessional.com/en/kitchen-appliances/industrial-ovens',
 'https://www.fagorprofessional.com/en/kitchen-appliances/industrial-ovens/ikore',
 'https://www.fagorprofessional.com/en/kitchen-appliances/industrial-cooking',
 'https://www.fagorprofessional.com/en/kitchen-appliances/industrial-dishwashers',
 'https://www.fagorprofessional.com/en/kitchen-appliances/refrigeration',
 'https://www.fagorprofessional.com/en/foodservice',
 'https://www.fagorprofessional.com/en/search?keywords=CI-CG604T',
 'https://www.fagorprofessional.com/en/search?keywords=FE-4'
];
const results=[];
for(const url of pages){
 const o={url};
 try{
  const r=await fetch(url,{headers:{'User-Agent':'GastroSkyCatalogImageResearch/1.0','Accept':'text/html'},signal:AbortSignal.timeout(14000)});
  o.status=r.status;o.final_url=r.url;o.type=r.headers.get('content-type');
  if((o.type||'').includes('text/html')){
   const body=await r.text(),$=load(body);o.title=$('title').text().trim().slice(0,160);
   o.images=$('img').toArray().map(el=>{const n=$(el);return {src:n.attr('src'),lazy:n.attr('data-src'),alt:n.attr('alt')}})
    .filter(x=>x.src||x.lazy).filter(x=>!/logo|flag|icon|sprite|menu|social/i.test(x.src||x.lazy)).slice(0,55);
   const mainText=($('main').text()||'').toUpperCase();
   o.model_text_hits=['CI-CG604T','FE-4','APW-061','IKORE'].map(k=>({key:k,hit:mainText.includes(k)}));
   o.links=$('a[href]').toArray().map(x=>({text:$(x).text().trim().slice(0,72),href:$(x).attr('href')}))
    .filter(x=>/product|range|cooking|oven|dishwash|kitchen|coccion|catalog|fryer|refrigerat|fagor/i.test(x.text+' '+x.href)).slice(0,55);
   o.ogimage=$('meta[property="og:image"]').attr('content')||null;
  }else await r.body?.cancel();
 }catch(e){o.error=String(e).slice(0,220)}
 results.push(o);
 await new Promise(r=>setTimeout(r,500));
}
const countBy=(arr,fn)=>{const o={};for(const v of arr){const k=String(fn(v));o[k]=(o[k]||0)+1}return Object.fromEntries(Object.entries(o).sort((a,b)=>b[1]-a[1]));};
const report={
 checked_at:new Date().toISOString(),
 totals:{fagor:fagor.length,missing:missing.length,
  by_source:countBy(missing,p=>new URL(p.source_url).pathname),
  by_category:countBy(missing,p=>p.category),
  distinct_models:new Set(missing.map(p=>p.model||p.sku)).size,
  models:missing.map(p=>({sku:p.sku,model:p.model,category:p.category,source_url:p.source_url})).slice(0,70)},
 pages:results
};
await writeFile('data/fagor-public-photo-probe.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:{total:report.totals.fagor,missing:report.totals.missing,by_source:report.totals.by_source},pages:results.map(p=>({url:p.url,status:p.status,img:p.images?.length,links:p.links?.length,error:p.error}))}));
