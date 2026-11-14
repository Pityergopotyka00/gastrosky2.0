import {writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const url='https://coldline.it/en/catalog/1400-lt-5';
const response=await fetch(url,{headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogMedia/1.0'},signal:AbortSignal.timeout(16000)});
if(!response.ok)throw Error('HTTP '+response.status);
const $=load(await response.text());
const out={url,models:[],productImages:[]};
const normalized=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim().toUpperCase();
const targets=['A140/2BR','A140/2BRV','A140/2BV','A140/2M'];
for(const target of targets){
 const hits=$('h2,h3,h4,h5,a,strong,span,div').toArray().filter(el=>$(el).children().length===0&&normalized($(el).text())===target);
 for(const el of hits.slice(0,4)){
  let n=$(el),ancestor=[];
  for(let i=0;i<10;i++){
   n=n.parent();if(!n.length)break;
   ancestor.push({depth:i,tag:n.get(0).tagName,class:n.attr('class')||'',id:n.attr('id')||'',imgCount:n.find('.product-image img').length,models:n.find('.product-tab-detail').toArray().map(x=>$(x).text().trim()).slice(0,6),images:n.find('.product-image img').toArray().slice(0,4).map(x=>$(x).attr('src'))});
  }
  out.models.push({target,ancestor});
 }
}
out.productImages=$('.product-image img').toArray().slice(0,15).map(el=>{let n=$(el),anc=[];for(let i=0;i<7;i++){n=n.parent();if(!n.length)break;anc.push({depth:i,class:n.attr('class')||'',models:n.find('.product-tab-detail').toArray().map(x=>$(x).text().trim()).slice(0,4),headings:n.find('h2,h3,h4').toArray().slice(0,4).map(x=>$(x).text().trim().slice(0,45))});}return {src:$(el).attr('src'),anc};});
await writeFile('data/coldline-model-dom-report.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({models:out.models.length,images:out.productImages.length}));
