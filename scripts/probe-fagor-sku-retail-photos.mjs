import {writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const items=[
 ['19102772','CI-CG604T','https://contessa.rs/proizvod/profesionalni-gasni-top-sporet/'],
 ['19101248','FT-G710 L','https://contessa.rs/proizvod/gasni-rostilj-ravna-ploca-fagor-ft-g710-l-serija-700/'],
 ['19101390','FT-E705 L','https://contessa.rs/proizvod/profesionalni-strujni-rostilj-ravna-ploca/'],
 ['19101392','FT-G705 V L','https://contessa.rs/proizvod/profesionalni-ravni-gasni-rostilj/'],
 ['19074120','B-G705','https://jopco.net/producto/parrilla-de-cocina-a-gas-de-20-x-7-pulgadas-19074120-fagor/'],
 ['19074120','B-G705','https://cateringinventar.com/produkter/maskiner-smaa-el/koge-varme-og-stege/gas-grill-b-g705-fagor/'],
 ['19074781','B-G705 I','https://cateringinventar.dk/produkter/maskiner-smaa-el/koge-varme-og-stege/gas-grill-b-g705-i-fagor/'],
 ['19101247','FT-E710 L','https://contessa.rs/proizvod/elektricni-rostilj-ravna-ploca-700/'],
 ['19101399','FT-E710 L+R','https://audores.com/griddle-plates/15221-fagor-electric-griddle-plate-double-fry-top-ft-e710-lr']
];
const result={checked_at:new Date().toISOString(),pages:[]};
for(const [sku,model,url] of items){
 const entry={sku,model,url};
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(16000),headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogResearch/1.0'}});
  entry.status=r.status;entry.final_url=r.url;
  if(!r.ok)throw Error('HTTP '+r.status);
  const html=await r.text(),$=load(html);
  entry.title=$('h1').first().text().trim().slice(0,140);
  entry.sku_evidence=$('body').text().includes(sku);
  entry.model_evidence=$('body').text().toUpperCase().includes(model.toUpperCase());
  entry.og_image=$('meta[property="og:image"]').attr('content');
  entry.gallery=$('.woocommerce-product-gallery img,.product-images img,.product-cover img,.product-image img,.product-images-container img,.js-qv-product-cover').slice(0,8).map((_,e)=>({src:$(e).attr('src'),data_src:$(e).attr('data-src'),alt:$(e).attr('alt'),srcset:$(e).attr('srcset')?.slice(0,100)})).get();
  entry.other=$('main img,article img').slice(0,10).map((_,e)=>({src:$(e).attr('src'),alt:$(e).attr('alt')})).get();
 }catch(e){entry.error=String(e.message||e).slice(0,110)}
 result.pages.push(entry);
 await new Promise(r=>setTimeout(r,500));
}
await writeFile('data/fagor-retail-photo-probe.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.pages.map(x=>({sku:x.sku,status:x.status,title:x.title,sku_evidence:x.sku_evidence,model_evidence:x.model_evidence,og_image:x.og_image,gallery:x.gallery?.slice(0,3),error:x.error}))));
