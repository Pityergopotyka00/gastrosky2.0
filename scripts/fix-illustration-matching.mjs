// Correct wrong category fallbacks without changing real manufacturer photographs.
// Run before Vite; the generated per-product SVG files are built by copy-static.
import {readFile,writeFile} from 'node:fs/promises';
const path='index.html';
let html=await readFile(path,'utf8');
const start=html.indexOf('function showIllustration(frame,p){');
const end=html.indexOf('\nfunction render(){',start);
if(start<0||end<0)throw Error('Cannot find storefront image fallback');
const renderer=`// Only reuse the 4x4 equipment sprite for products with a verified equipment-type match.
// Everything else gets a unique, category-classified product illustration.
function gsArtworkType(p){
 const text=[p.name,p.category,p.model].filter(Boolean).join(' ')
  .normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();
 // These are handled by individually generated product images, not the griddle tile.
 if(/rizsfozo|rice.cooker|rizsparolo|rice.warmer|rice.steamer|paella|bain.marie|melegentarto|etelszallito|vakuum|vacuum|sous.vide|mikrohullam|microwave|waffle|gofri|palacsinta|crepe|kenyerpirito|toaster|gyumolcscentrifuga|juicer|citruspres|hot.dog|kolbasz|sausage|elektromos.vizforralo|water.boiler|levesfozo|soup.kettle|serpenyo|ed[eé]ny|fazek|fed[oő]|kesztyu|tarto|merleg|scale|kosar|basket|rack|talc|tray|polc|accessor|tartozek|pasta|tesztanyujto|szeletelo.tarcsa/.test(text))return null;
 if(/pizza|pizzakemence|pizzasuto/.test(text))return [3,3];
 if(/poharmoso|glasswash/.test(text))return [0,2];
 if(/kalapos|hood.wash|pass.through.dish/.test(text))return [2,0];
 if(/mosogatogep|dishwash/.test(text))return [1,0];
 if(/mosogatomedence|kagylo|sink|washbasin|csaptelep/.test(text))return [1,3];
 if(/sokkol|blast.chill|blast.freez|shock.chill/.test(text))return [3,1];
 if(/hutopult|hutoasztal|refrigerat.*counter|refrigerat.*table|under.counter/.test(text))return [3,1];
 if(/jegkeszit|jegpehely|ice.machine|ice.maker|ice.flake/.test(text))return [0,3];
 if(/huto|fagy|refriger|freezer|fridge|chiller|cold.room/.test(text))return [2,1];
 if(/olajsuto|deep.fryer|fryer|frit|fritoz/.test(text))return [3,0];
 if(/husdaral|meat.grinder|mincer/.test(text))return [3,2];
 if(/szeletelogep|slicer|affettat|salami.slicer/.test(text))return [2,2];
 if(/mixer|dagaszt|kevero|robotgep|blend|aprit|cutter/.test(text))return [1,2];
 if(/rozsdamentes.*polc|shelf|allvany|regal/.test(text))return [2,3];
 if(/munkaasztal|worktable|prep.table|rozsdamentes.asztal/.test(text))return [1,1];
 if(/sutolap|fry.top|griddle|rostlap|plancha/.test(text))return [0,1];
 if(/kavefozo|coffee.machine|espresso/.test(text))return [1,2];
 if(/konvek|gozparol|combi.oven|ipari.suto|oven/.test(text))return [0,0];
 if(/tuzhely|gazeg|burner|fozolap|indukcio|induction|cooking.range/.test(text))return [0,1];
 return null;
}
function gsArtHash(id){
 let h=2166136261;const s=String(id);
 for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}
 return h.toString(16).padStart(8,'0');
}
function showIllustration(frame,p){
 frame.replaceChildren();
 frame.classList.add('gs-illustrated-frame');
 const tile=gsArtworkType(p);
 if(tile){
  const crop=document.createElement('div');
  crop.className='gs-photorealistic-illustration';
  crop.setAttribute('role','img');
  crop.setAttribute('aria-label',p.name+' – berendezéskép');
  crop.style.backgroundPosition=(tile[0]*100/3).toFixed(4)+'% '+(tile[1]*100/3).toFixed(4)+'%';
  frame.append(crop);
 }else{
  const picture=document.createElement('img');
  picture.className='product-photo gs-individual-artwork';
  picture.alt=p.name+' – terméktípushoz illesztett berendezéskép';
  picture.loading='lazy';
  picture.src='/media/product-illustrations/'+gsArtHash(p.id)+'.svg';
  frame.append(picture);
 }
}
`;
html=html.slice(0,start)+renderer+html.slice(end);
const css=`<style id="gs-correct-fallback-style">
.gs-illustrated-frame{position:relative;overflow:hidden}
.gs-illustrated-frame .gs-individual-artwork{display:block;width:100%;height:100%;object-fit:contain;padding:0!important}
.gs-detail-image-frame .gs-individual-artwork{max-height:520px}
</style>`;
if(!html.includes('id="gs-correct-fallback-style"'))html=html.replace('</head>',css+'</head>');
await writeFile(path,html);
console.log('Updated fallback category matching; real product image URLs were not modified.');