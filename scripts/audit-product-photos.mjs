// Non-destructive photo availability audit.
// Reports URL validity and real HTTP response, never replaces a photo with a guess.
import {readFile,writeFile} from 'node:fs/promises';
const products=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const limit=Math.min(200,Math.max(1,Number(process.env.PHOTO_AUDIT_LIMIT||40)));
const report={checked_at:new Date().toISOString(),total_products:products.length,checked:0,ok:0,failed:0,skipped:Math.max(products.length-limit,0),problems:[]};
const day=Math.floor(Date.now()/86400000);
const start=products.length?(day*limit)%products.length:0;
const rotated=[...products.slice(start),...products.slice(0,start)].slice(0,limit);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(const item of rotated){
 report.checked++;
 let status='unreachable';
 try{
  const response=await fetch(item.image_url,{method:'HEAD',signal:AbortSignal.timeout(11000),redirect:'follow'});
  if(response.ok){
   const type=response.headers.get('content-type')||'';
   status=type.startsWith('image/')?'ok':'unexpected_content_type';
  }else{
   status='HTTP_'+response.status;
   if([405,403].includes(response.status)){
    // Some manufacturer CDNs block HEAD, so use a tiny ranged GET.
    const range=await fetch(item.image_url,{headers:{Range:'bytes=0-1023'},signal:AbortSignal.timeout(11000)});
    if(range.ok&&(range.headers.get('content-type')||'').startsWith('image/'))status='ok';
   }
  }
 }catch(e){status=e?.name==='TimeoutError'?'timeout':'request_failed'}
 if(status==='ok')report.ok++;
 else{report.failed++;report.problems.push({id:item.id,status})}
 console.log(item.id,status);
 await sleep(350);
}
await writeFile('data/catalog-image-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total_products,checked:report.checked,ok:report.ok,failed:report.failed},null,2));
