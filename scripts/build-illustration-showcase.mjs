// Optional visual QA gallery for representative category illustrations.
import {readFile,writeFile} from 'node:fs/promises';
const products=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const report=JSON.parse(await readFile('dist/media/illustration-type-report.json','utf8'));
const hash=id=>{let h=2166136261;for(let i=0;i<id.length;i++){h^=id.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h.toString(16).padStart(8,'0')};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={oven:'Ipari sütő',dishwasher:'Mosogatógép',hoodwasher:'Kalapos mosogatógép',glasswasher:'Pohármosó',fridge:'Hűtő',blast:'Sokkoló hűtő',fryer:'Olajsütő',griddle:'Sütőlap',stove:'Főzőberendezés',table:'Rozsdamentes asztal',sink:'Mosogatómedence',shelf:'Polc',mixer:'Keverőgép',slicer:'Szeletelő',grinder:'Húsdaráló',ice:'Jégkészítő',pizza:'Pizzasütő',accessory:'Tartozék',coffee:'Kávégép',kettle:'Főzőüst',equipment:'Konyhatechnika'};
const all=JSON.parse(await readFile('dist/media/illustration-type-report.json','utf8'));
const samples=[];
const groups={};
for(const p of products){
 if(p.image_url)continue;
 const key=p.manufacturer+'-'+p.category;
 if(!groups[key])groups[key]=[];
 groups[key].push(p);
}
const seen=new Set();
for(const p of products.filter(p=>!p.image_url)){
 if(samples.length>=28)break;
 const hit=Object.keys(names).find(type=>{
  const str=(p.name+' '+p.category).toLowerCase();return type!=='equipment'&&str.includes(type);
 })||'equipment';
 const semantic=p.category;
 if(seen.has(semantic))continue;
 seen.add(semantic);
 samples.push(p);
}
function tile(p){
 const text=[p.category,p.name,p.model,p.sku].join(' ').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/pizza/.test(text))return [3,3];
 if(/poharmoso|glasswash/.test(text))return [0,2];
 if(/kalapos|hood.wash|pass.through.dish/.test(text))return [2,0];
 if(/mosogatogep|dishwash/.test(text))return [1,0];
 if(/mosogato|kagylo|sink|washbasin/.test(text))return [1,3];
 if(/sokkol|blast/.test(text))return [3,1];
 if(/jegkeszit|jegpehely|ice.machine|ice.maker/.test(text))return [0,3];
 if(/huto|fagy|refriger|freezer|chiller/.test(text))return [2,1];
 if(/olajsuto|fryer|frit/.test(text))return [3,0];
 if(/husdaral|meat.grinder|mincer/.test(text))return [3,2];
 if(/szeletel|slicer/.test(text))return [2,2];
 if(/mixer|dagaszt|kevero|blend|aprit/.test(text))return [1,2];
 if(/polc|shelf|allvany|rack/.test(text))return [2,3];
 if(/asztal|rozsdamentes.butor|worktable|table|cabinet/.test(text))return [1,1];
 if(/sutolap|griddle|grill|rostlap|plancha|indukcio/.test(text))return [0,1];
 if(/suto|oven|konvek|gozparol/.test(text))return [0,0];
 return [1,1];
}
const cards=samples.map(p=>{
 const [col,row]=tile(p);
 const bg=(col*100/3).toFixed(4)+'% '+(row*100/3).toFixed(4)+'%';
 return '<article><div class="appliance-crop" role="img" aria-label="'+esc(p.name)+' – géptípus illusztráció" style="background-position:'+bg+'"></div><div class="details"><small>'+esc(p.manufacturer)+' · '+esc(p.category)+'</small><strong>'+esc(p.model||p.sku)+'</strong><span>Illusztráció – nem gyártói termékfotó</span></div></article>';
}).join('');
const html='<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GastroSky – Látványillusztrációk</title><style>'+
 '*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,Arial,sans-serif;background:#f1f5f8;color:#142e43}header{padding:46px max(24px,calc((100vw - 1200px)/2));background:#112c40;color:#fff}h1{margin:0 0 12px;font-size:clamp(28px,4vw,46px)}p{max-width:760px;line-height:1.6;color:#b8cdd8}a{color:#d4ae73}.grid{max-width:1200px;margin:auto;padding:30px 20px 60px;display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:23px}article{border-radius:19px;background:#fff;box-shadow:0 14px 38px rgba(11,29,44,.08);overflow:hidden}article .appliance-crop{width:100%;aspect-ratio:1/1;background-image:url("/media/illustrations/equipment-sprite.webp");background-size:400% 400%;background-repeat:no-repeat;background-color:#e2eaf1}.details{padding:18px;display:grid;gap:8px}.details small{color:#7b8c99}.details strong{font-size:18px}.details span{font-size:12px;color:#647487}footer{text-align:center;padding:24px;color:#667986}'+
 '</style></head><body><header><h1>GastroSky · látványillusztrációk</h1><p>Mintaképek a katalógusban használt 16 fotórealisztikus, kivágott berendezésábrából, '+report.generated+' katalógustermékhez. Ezek <strong>nem</strong> az adott cikkszámhoz tartozó gyártói termékfotók. Az ellenőrzött fotókkal rendelkező termékeket továbbra is az eredeti fotóikkal mutatjuk be.</p><a href="/">Vissza a GastroSky katalógushoz</a></header><main class="grid">'+cards+'</main><footer>A termékillusztrációk kizárólag vizuális tájékoztatásra szolgálnak.</footer></body></html>';
await writeFile('dist/illusztracio-bemutato.html',html);
console.log('Visual QA gallery created with '+samples.length+' product illustrations.');
