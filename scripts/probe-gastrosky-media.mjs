// Diagnostic of PUBLIC image markup on original GastroSky product pages.
// The report deliberately excludes complete HTML, forms and personal data.
import {writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
const pages=[
 'https://gastrosky.hu/termekek/reszletek/munkaasztal',
 'https://gastrosky.hu/termekek/reszletek/egyszintes-atadopolc',
 'https://gastrosky.hu/termekek/reszletek/nyitott-pult',
 'https://gastrosky.hu/termekek/kategoria/munkaasztalok'
];
const results=[];
for(const url of pages){
 const result={url};
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(13000),headers:{Accept:'text/html','User-Agent':'GastroSky-Owner-Migration-Image-Diagnostics/1.0'}});
  result.http=r.status;result.type=r.headers.get('content-type');
  const html=await r.text(),$=load(html);
  result.title=$('title').text().trim();
  result.html_length=html.length;
  result.image_nodes=$('img').toArray().slice(0,35).map(el=>{
   const e=$(el),o={};
   for(const k of ['src','data-src','data-original','data-lazy-src','srcset','data-srcset','alt','width','height','class','style'])if(e.attr(k))o[k]=e.attr(k).slice(0,300);
   o.parent=(e.parent().attr('class')||'').slice(0,120);
   return o;
  });
  result.picture_sources=$('picture source').toArray().slice(0,15).map(el=>($(el).attr('srcset')||$(el).attr('data-srcset')||'').slice(0,300));
  result.meta_image=$('meta[property="og:image"]').attr('content')||null;
  result.css_backgrounds=$('[style*="url("]').toArray().slice(0,16).map(el=>($(el).attr('style')||'').slice(0,300));
  result.image_tests=[];
  for(const style of result.css_backgrounds.slice(0,2)){
   const match=style.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
   if(!match)continue;
   for(const variant of ['HEAD','RANGE','GET']){
    try{
     const response=await fetch(match[1],{
      method:variant==='HEAD'?'HEAD':'GET',
      headers:variant==='RANGE'?{Range:'bytes=0-128','User-Agent':'GastroSkyCatalogMedia/1.0'}:{'User-Agent':'GastroSkyCatalogMedia/1.0'},
      signal:AbortSignal.timeout(10000)
     });
     result.image_tests.push({variant,status:response.status,final_url:response.url,type:response.headers.get('content-type'),length:response.headers.get('content-length')});
     await response.body?.cancel();
    }catch(e){result.image_tests.push({variant,error:String(e).slice(0,160)})}
   }
  }
  result.image_urls_in_markup=[...new Set((html.match(/(?:"|'|[=(])(?:https?:)?[^"'\s<>]{1,260}\.(?:png|jpe?g|webp|gif|avif)(?:\?[^"'\s<>]*)?/gi)||[]).map(x=>x.slice(0,220)))].slice(0,35);
  const body=$('body');
  result.classes_near_name=body.find('*').filter((_,el)=>$(el).children().length===0&&/TERMÉK MEGNEVEZÉSE/i.test($(el).text())).slice(0,2).map((_,el)=>$(el).parent().parent().html()?.slice(0,1100)||'').get();
 }catch(e){result.error=String(e).slice(0,180)}
 results.push(result);
}
await writeFile('data/gastrosky-media-probe.json',JSON.stringify({checked_at:new Date().toISOString(),results},null,2)+'\n');
console.log(JSON.stringify(results.map(x=>({url:x.url,status:x.http,images:x.image_nodes?.length,markup_urls:x.image_urls_in_markup?.length,error:x.error}))));
