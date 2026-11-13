import {load} from 'cheerio';
import {mkdir,writeFile} from 'node:fs/promises';
const ORIGIN='https://gastrosky.hu';
const MAX_PAGES=Number(process.env.MAX_PAGES||1200);
const DELAY_MS=Number(process.env.DELAY_MS||800);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const allowed=u=>u.origin===ORIGIN && !u.search && (/^\/(termekek|$)/.test(u.pathname));
const queue=[ORIGIN+'/'];const seen=new Set();const products=[];
const knownBrands=['Winterhalter','Maxima','HENDI'];
let robots='';
try{const res=await fetch(ORIGIN+'/robots.txt');if(res.ok)robots=await res.text()}catch{}
const rules=robots.split(/\r?\n/);let active=false;const disallow=[];
for(const line of rules){const clean=line.split('#')[0].trim();if(/^user-agent:/i.test(clean))active=clean.split(':').slice(1).join(':').trim()==='*';else if(active&&/^disallow:/i.test(clean)){const path=clean.split(':').slice(1).join(':').trim();if(path)disallow.push(path)}}
const permitted=url=>!disallow.some(path=>url.pathname.startsWith(path));
while(queue.length&&seen.size<MAX_PAGES){
 const url=queue.shift();if(seen.has(url))continue;seen.add(url);
 const parsed=new URL(url);if(!allowed(parsed)||!permitted(parsed))continue;
 try{
  const response=await fetch(url,{headers:{'User-Agent':'GastroSkyCatalogMigration/0.1 (owner-authorized migration; contact info@gastrosky.hu)','Accept':'text/html'}});
  if(!response.ok){console.warn(response.status,url);continue}
  const $=load(await response.text());
  $('a[href]').each((_,el)=>{try{const u=new URL($(el).attr('href'),url);u.hash='';if(allowed(u)&&permitted(u)&&!seen.has(u.href)&&!queue.includes(u.href))queue.push(u.href)}catch{}});
  if(parsed.pathname.startsWith('/termekek/reszletek/')){
   const raw=$('body').text().replace(/\s+/g,' ').trim();
   const name=$('h1').first().text().trim()||$('title').text().replace(/^GastroSky\s*[-–]\s*/i,'').trim();
   const description=raw.match(/TERMÉKLEÍRÁS:\s*(.*?)\s*ÁRAJÁNLAT KÉRÉSE:/i)?.[1]||'';
   const brandMatches=knownBrands.filter(b=>new RegExp('\\b'+b+'\\b','i').test(name));
   const manufacturer=brandMatches.length===1?brandMatches[0]:null;
   products.push({name,description,source_url:url,category:$('h1').first().prevAll().first().text().trim()||null,manufacturer,manufacturer_status:manufacturer?'candidate':'unverified',imported_at:new Date().toISOString()});
   console.log('PRODUCT',products.length,name);
  }
 }catch(error){console.warn('Fetch error:',url,String(error))}
 await sleep(DELAY_MS);
}
await mkdir('data',{recursive:true});
await writeFile('data/imported-products.json',JSON.stringify(products,null,2)+'\n');
console.log('Done:',products.length,'products;',seen.size,'pages inspected. Review brand candidates manually.');
