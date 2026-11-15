import {writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const seeds=['https://www.tecnodomspa.com/en/orizzontale.html','https://www.tecnodomspa.com/en/verticale.html'];
const seen=new Set(),queue=[...seeds],pages=[];
const allowed=(raw,base)=>{try{const u=new URL(raw,base);u.search='';u.hash='';return u.protocol==='https:'&&u.hostname==='www.tecnodomspa.com'&&/^\/en\/(?:orizzontale|verticale)\/.+\.html$/i.test(u.pathname)?u.href:null}catch{return null}};
while(queue.length&&seen.size<110){
 const url=queue.shift();if(seen.has(url))continue;seen.add(url);
 const p={url};
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'text/html','User-Agent':'GastroSkyCatalogVerification/1.0'}});
  p.http=r.status;if(!r.ok)throw Error('HTTP '+r.status);
  const $=load(await r.text());p.title=$('h1').first().text().replace(/\s+/g,' ').trim().slice(0,100);
  const body=$('body').text().replace(/\s+/g,' ').trim();
  const markers=['Available sizes','Available models','Available versions','Available sizes','MODELS','Codice'];
  p.evidence=markers.map(token=>({token,i:body.toLowerCase().indexOf(token.toLowerCase())})).filter(x=>x.i!==-1).map(x=>({marker:x.token,sample:body.slice(x.i,x.i+700)})).slice(0,4);
  p.codeWords=[...new Set((p.evidence.flatMap(x=>x.sample.match(/\b[A-Z]{1,5}[ -]?[0-9]{2,4}\b/g)||[])).filter(x=>x.length>=3))].slice(0,24);
  const related=$('a[href]').toArray().map(x=>allowed($(x).attr('href'),r.url)).filter(Boolean);
  p.links=[...new Set(related)];for(const next of p.links)if(!seen.has(next)&&!queue.includes(next)&&queue.length<140)queue.push(next);
 }catch(e){p.error=String(e.message||e).slice(0,100)}
 pages.push(p);
 await new Promise(r=>setTimeout(r,170));
}
const report={checked_at:new Date().toISOString(),pages_checked:pages.length,pages};
await writeFile('data/tecnodom-size-variant-probe.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checked:pages.length,evidence_pages:pages.filter(x=>x.evidence?.some(e=>e.marker==='Available sizes')).length,model_candidates:pages.filter(x=>x.codeWords?.length).map(x=>({url:x.url,title:x.title,codes:x.codeWords?.slice(0,12)})).slice(0,40)}));
