// Use the user's chosen real-looking 4x4 equipment illustration sheet as the
// only missing-photo fallback. Preserve all actual product photographs.
import {readFile,writeFile} from 'node:fs/promises';
const path='index.html';
let html=await readFile(path,'utf8');
const start=html.indexOf('function showIllustration(frame,p){');
const end=html.indexOf('\nfunction render(){',start);
if(start<0||end<0)throw Error('Missing storefront illustration function');
const js=`// A single optimized 4×4 WebP; browser background-position crops a tile.
// Coordinates: [column,row], starting at zero.
function illustrationSpriteCell(p){
 const s=[p.category,p.name,p.model,p.sku].join(' ').normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();
 if(/pizza|pizzakemence|pizzasuto/.test(s))return [3,3];
 if(/poharmoso|glasswash/.test(s))return [0,2];
 if(/kalapos|hood.wash|pass.through.dish/.test(s))return [2,0];
 if(/mosogatogep|dishwash|washing.machine/.test(s))return [1,0];
 if(/mosogato|kagylo|sink|washbasin|csaptelep/.test(s))return [1,3];
 if(/sokkol|blast.chill|blast.freez|shock.chill/.test(s))return [3,1];
 if(/hutopult|hutoasztal|refrigerat.*counter|refrigerat.*table|under.counter|huto.munkaasztal/.test(s))return [3,1];
 if(/jegkeszit|jegpehely|ice.machine|ice.maker|ice.flake|ice.cube/.test(s))return [0,3];
 if(/huto|fagy|refriger|freezer|fridge|chiller|cold.room|hutokamra/.test(s))return [2,1];
 if(/olajsuto|deep.fryer|fryer|frit|fritoz/.test(s))return [3,0];
 if(/husdaral|meat.grinder|mincer|daralogep/.test(s))return [3,2];
 if(/szeletel|slicer|affettat|salami/.test(s))return [2,2];
 if(/mixer|dagaszt|kevero|robotgep|blend|aprit|cutter|zoldsegszeletelo/.test(s))return [1,2];
 if(/polc|shelf|allvany|regal|rack/.test(s))return [2,3];
 if(/munkaasztal|asztal|rozsdamentes.butor|worktable|prep.table|asztallap|cabinet|szekreny/.test(s))return [1,1];
 if(/sutolap|fry.top|griddle|grill|rostlap|plancha|gazuzemu.suto|indukcio|induction|fozolap|fozo.modul|cooking.range/.test(s))return [0,1];
 if(/kave|coffee|espresso/.test(s))return [1,2];
 if(/suto|oven|konvek|gozparol|combi|tartozek|tepsi|tray|baking/.test(s))return [0,0];
 if(/tuzhely|gazeg|burner|fozo|hotplate/.test(s))return [0,1];
 return [1,1];
}
function showIllustration(frame,p){
 frame.replaceChildren();
 frame.classList.add('gs-illustrated-frame');
 const crop=document.createElement('div');
 crop.className='gs-photorealistic-illustration';
 crop.setAttribute('role','img');
 crop.setAttribute('aria-label',p.name+' – a berendezés típusa szerinti illusztráció, nem a pontos termék fotója');
 const [col,row]=illustrationSpriteCell(p);
 crop.style.backgroundPosition=(col*100/3).toFixed(4)+'% '+(row*100/3).toFixed(4)+'%';
 frame.append(crop);
 const badge=document.createElement('span');
 badge.className='gs-family-image-note';
 badge.textContent='Illusztráció · nem termékfotó';
 frame.append(badge);
}
`;
html=html.slice(0,start)+js+html.slice(end);
const css=`<style id="gs-photorealistic-sprite-style">
/* The user-selected 4x4 appliance image, cropped by CSS to individual machine. */
.gs-photorealistic-illustration{display:block;flex:none;background-image:url('/media/illustrations/equipment-sprite.webp');background-size:400% 400%;background-repeat:no-repeat;background-color:#e5eef5}
.illustration>.gs-photorealistic-illustration{position:absolute;inset:0;width:100%;height:100%}
.gs-detail-image-frame.gs-illustrated-frame{position:relative;overflow:hidden;padding:12px!important;background:#e1eaf2}
.gs-detail-image-frame>.gs-photorealistic-illustration{width:min(100%,410px);max-height:100%;aspect-ratio:1/1;margin:auto}
.illustration>.gs-family-image-note,.gs-detail-image-frame>.gs-family-image-note{z-index:3;right:10px;bottom:10px;top:auto;font-size:10px;background:rgba(16,38,57,.91);border:1px solid rgba(255,255,255,.14);box-shadow:0 3px 12px rgba(17,39,57,.13);color:#fff}
@media(max-width:520px){.gs-detail-image-frame>.gs-photorealistic-illustration{width:min(100%,280px)}}
</style>`;
if(!html.includes('id="gs-photorealistic-sprite-style"')){
 if(!html.includes('</head>'))throw Error('Cannot locate head to insert illustration CSS');
 html=html.replace('</head>',css+'</head>');
}
await writeFile(path,html,'utf8');
console.log('Installed photorealistic equipment sprite fallback with 16 cropped tiles.');