// Generate distinct, honestly labelled technical illustrations for products
// lacking a verified photograph. Does NOT set image_url or claim a manufacturer photo.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const dir='dist/media/product-illustrations';
await mkdir(dir,{recursive:true});
const idHash=s=>{
 let h=2166136261;
 for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
 return h.toString(16).padStart(8,'0');
};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const name=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,35);
function typeOf(p){
 const s=(p.name+' '+p.category).normalize('NFKD').toLowerCase();
 if(/mosogat|poharmoso|dishwash|washer|washing/.test(s))return 'washer';
 if(/huto|fagy|hűt|fagyaszt|frier|refriger|freezer|cabinet|chiller|blast/.test(s))return 'fridge';
 if(/olajsuto|olajsüt|fryer|frit|fritöz/.test(s))return 'fryer';
 if(/sütő|suto|oven|kemence|konvek/.test(s))return 'oven';
 if(/asztal|pult|munkaasztal|polc|szekreny|szekrény|allvany|állvány/.test(s))return 'table';
 if(/csap|mosogato|mosogató|sink|kagyló/.test(s))return 'sink';
 if(/mixer|dagaszt|robotgep|robotgép|aprít|daral|darál|blend/.test(s))return 'mixer';
 if(/grill|főző|fozo|tuzhely|tűzhely|cook|indukcio|indukció|lap/.test(s))return 'range';
 if(/jeg|jég|ice/.test(s))return 'ice';
 return 'equipment';
}
const steel='#cdd9e2',shadow='#8faabd',dark='#243e55',gold='#d7a95f',white='#eff5f8';
const common=`<defs><linearGradient id="steel" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#f8fbfd"/><stop offset=".48" stop-color="#b1c4d3"/><stop offset="1" stop-color="#dde8ed"/></linearGradient><linearGradient id="back" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#dbe7ec"/><stop offset="1" stop-color="#eef3f6"/></linearGradient></defs>`;
const rect=(x,y,w,h,rx=7,fill='url(#steel)')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${dark}" stroke-width="3"/>`;
function artwork(type){
 const base=`${rect(92,48,176,188)}${rect(107,62,146,29,3,dark)}<circle cx="229" cy="76" r="6" fill="${gold}"/><rect x="105" y="241" width="16" height="13" rx="2" fill="${dark}"/><rect x="240" y="241" width="16" height="13" rx="2" fill="${dark}"/>`;
 if(type==='washer')return base+`${rect(108,105,144,113,5,white)}<circle cx="181" cy="162" r="45" fill="#809dad" stroke="${dark}" stroke-width="5"/><circle cx="181" cy="162" r="29" fill="#bdd4df" stroke="${white}" stroke-width="5"/><circle cx="181" cy="162" r="13" fill="${white}"/>`;
 if(type==='fridge')return `${rect(108,30,145,218)}<path d="M109 129H252" stroke="${dark}" stroke-width="4"/><path d="M127 53V106M127 152V227" stroke="${dark}" stroke-width="6" stroke-linecap="round"/><rect x="116" y="244" width="18" height="13" fill="${dark}"/><rect x="227" y="244" width="18" height="13" fill="${dark}"/>`;
 if(type==='fryer')return `${rect(95,97,169,139)}${rect(111,111,135,76,4,white)}<path d="M121 145h116M142 117v60m30-60v60m30-60v60" stroke="${shadow}" stroke-width="4"/><path d="M103 97V63h70M188 97V63h70" fill="none" stroke="${dark}" stroke-width="8"/><circle cx="130" cy="214" r="8" fill="${gold}"/>`;
 if(type==='oven')return base+`${rect(110,101,140,116,4,dark)}${rect(121,111,117,94,3,'#e8f0f6')}<path d="M127 140H231M127 168H231" stroke="${shadow}" stroke-width="5"/><rect x="155" y="94" width="56" height="5" rx="2" fill="${dark}"/>`;
 if(type==='table')return `${rect(52,91,256,21,3)}<path d="M77 112V244M283 112V244" stroke="${dark}" stroke-width="11" stroke-linecap="round"/><path d="M80 204H280" stroke="${shadow}" stroke-width="13"/><path d="M78 108h204" stroke="${white}" stroke-width="3"/>`;
 if(type==='sink')return `${rect(61,96,236,31,4)}${rect(98,103,163,68,8,white)}<path d="M97 170V242M259 170V242" stroke="${dark}" stroke-width="10"/><path d="M183 101V65Q183 39 205 39Q226 39 226 64V77" stroke="${dark}" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="225" cy="89" r="4" fill="${gold}"/>`;
 if(type==='mixer')return `${rect(150,53,85,57,13,dark)}<circle cx="203" cy="75" r="7" fill="${gold}"/><path d="M190 110v41" stroke="${dark}" stroke-width="14"/><path d="M117 154h140l-23 78h-94z" fill="url(#steel)" stroke="${dark}" stroke-width="5"/><path d="M155 237h87" stroke="${dark}" stroke-width="11"/><path d="M118 243h140" stroke="${dark}" stroke-width="7"/>`;
 if(type==='range')return `${rect(68,111,225,122)}${rect(66,92,230,31,4,dark)}<ellipse cx="129" cy="107" rx="29" ry="7" fill="${shadow}"/><ellipse cx="232" cy="107" rx="29" ry="7" fill="${shadow}"/><circle cx="115" cy="211" r="7" fill="${gold}"/><circle cx="164" cy="211" r="7" fill="${gold}"/><circle cx="213" cy="211" r="7" fill="${gold}"/>`;
 if(type==='ice')return base+`${rect(110,106,140,111,5,white)}<g fill="#9dccde" stroke="${dark}" stroke-width="2"><rect x="133" y="125" width="31" height="27" rx="4"/><rect x="170" y="140" width="31" height="27" rx="4"/><rect x="150" y="168" width="33" height="28" rx="4"/></g>`;
 return base+`${rect(110,111,140,98,5,white)}<path d="M132 149H227M132 174H205" stroke="${shadow}" stroke-width="6" stroke-linecap="round"/>`;
}
function svg(p){
 const type=typeOf(p),model=name(p.model||p.sku||p.id),label=name(p.category||'Nagykonyhai berendezés'),brand=name(p.manufacturer);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="520" viewBox="0 0 640 520" role="img" aria-label="${esc(brand+' '+model+' illusztráció')}">
 ${common}<rect width="640" height="520" fill="url(#back)"/>
 <path d="M0 340L640 265V520H0Z" fill="#e0e9ee"/>
 <g transform="translate(140 56) scale(1.0)">${artwork(type)}</g>
 <rect x="24" y="17" width="165" height="34" rx="10" fill="#172e45"/>
 <text x="37" y="39" font-family="Arial,sans-serif" font-size="16" fill="#f3d198" font-weight="bold">ILLUSZTRÁCIÓ</text>
 <rect x="0" y="413" width="640" height="107" fill="#10273c"/>
 <text x="27" y="445" font-family="Arial,sans-serif" font-size="21" fill="#eac57e" font-weight="bold">${esc(brand)}</text>
 <text x="27" y="475" font-family="Arial,sans-serif" font-size="19" fill="#fff" font-weight="bold">${esc(model)}</text>
 <text x="27" y="500" font-family="Arial,sans-serif" font-size="15" fill="#bdd1df">${esc(label)}</text>
 </svg>`;
}
let n=0;
for(const product of catalog){
 const filename=idHash(product.id)+'.svg';
 await writeFile(dir+'/'+filename,svg(product),'utf8');n++;
}
console.log('Generated '+n+' distinct manufacturer/model-labelled illustrative SVG assets (NOT product photographs).');
