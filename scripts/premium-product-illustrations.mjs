// Premium illustrated equipment fallback generator, deliberately NOT a product photo.
// Each design represents the type of machine, NOT necessarily its exact manufacturer's shape.
import {readFile,mkdir,writeFile} from 'node:fs/promises';

const products=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const out='dist/media/product-illustrations';
await mkdir(out,{recursive:true});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const fold=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h;};
const num=(n)=>Math.round(n*10)/10;
const R=(x,y,w,h,rx=5,fill='url(#steel)',stroke='#61798b',sw=2)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+rx+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'"/>';
const E=(cx,cy,rx,ry,fill='url(#steel)',stroke='#607788',sw=2)=>'<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'"/>';
const C=(cx,cy,r,fill='url(#steel)',stroke='#607788',sw=2)=>'<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'"/>';
const P=(points,fill='url(#steel)',stroke='#627b8e',sw=2)=>'<polygon points="'+points+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-linejoin="round"/>';
const D=(d,stroke='#536d80',width=4,fill='none')=>'<path d="'+d+'" stroke="'+stroke+'" stroke-width="'+width+'" stroke-linecap="round" stroke-linejoin="round" fill="'+fill+'"/>';
const H=(x,y)=>C(x,y,4,'#f8c478','#b58a44',1);
const V=(x,y,w,h)=>R(x,y,w,h,3,'url(#glass)','#6d8193',2)+D('M'+(x+8)+' '+(y+9)+'L'+(x+8)+' '+(y+h-12),'#d4e4ec',3);
const feet=(x1,x2,y)=>R(x1,y,16,17,3,'#425565','#455e70',1)+R(x2,y,16,17,3,'#425565','#455e70',1);
function box(x,y,w,h,side=24){
 return P((x)+','+(y)+' '+(x+side)+','+(y-18)+' '+(x+w+side)+','+(y-18)+' '+(x+w)+','+y,'url(#top)')+
  P((x+w)+','+y+' '+(x+w+side)+','+(y-18)+' '+(x+w+side)+','+(y+h-18)+' '+(x+w)+','+(y+h),'url(#side)')+
  R(x,y,w,h,5,'url(#steel)','#8194a3',2);
}
function oven(){
 let a=box(93,47,244,228,23)+feet(114,303,275);
 a+=R(105,57,220,41,3,'url(#dark)','#576a7b',1);
 a+=R(119,69,95,16,3,'#152b3b','#8096a5',1)+R(126,74,49,6,1,'#6fc6be','none',0)+C(288,76,9,'#243e51','#8ba2b0',2)+H(255,77);
 a+=R(111,109,206,151,5,'url(#dark)','#92a7b5',3)+R(127,120,172,120,2,'url(#glass)','#8ba2b0',2);
 for(let y=143;y<=220;y+=24)a+=D('M141 '+y+'H283','#a2c3d0',3);
 a+=D('M119 110H311','#f5f8f9',7);
 return a;
}
function dishwasher(hood=false,glass=false){
 let a=box(100,92,236,185,21)+feet(118,304,277);
 if(hood){
  a+=box(112,25,208,85,18)+D('M128 36H291','#eef6fb',5);
  a+=D('M115 108V196M326 109V196','#7c96a7',8);
  a+=R(132,152,170,54,3,'url(#glass)','#a7bccc',2);
  for(let x=145;x<=284;x+=20)a+=D('M'+x+' 159V202','#74a6c4',2);
  a+=D('M128 122H316','#344e65',6);
 }else{
  a+=R(114,111,207,148,4,'url(#steel2)','#718696',2);
  a+=R(126,122,183,7,2,'#758c9d','none',0);
  if(glass){a+=V(138,135,160,94);for(let x=152;x<=284;x+=22)a+=R(x,196,10,21,3,'#b7d9e5','#4c8db3',1);}
  else a+=R(145,148,143,64,4,'url(#side)','#a6b6bf',1)+D('M155 169H276','#eaf1f4',4);
  a+=R(114,99,207,25,2,'url(#dark)','#687c8c',1)+R(127,106,54,11,2,'#78b3ba','none',0)+H(291,111);
 }
 return a;
}
function fridge(blast=false){
 let a=box(125,17,198,258,27)+feet(147,283,275);
 a+=R(136,29,176,31,3,'url(#dark)','#50687c',1)+R(147,37,79,12,2,'#2f6477','#6c8f9e',1)+H(284,45);
 if(blast){
  a+=R(141,76,162,123,3,'url(#steel2)','#9aabb4',2)+D('M152 86H291','#f4f7f8',6)+R(149,212,143,39,5,'url(#vent)','#8195a4',1);
  for(let y=219;y<=241;y+=8)a+=D('M157 '+y+'H284','#758a98',2);
 }else{
  a+=D('M132 159H313','#677f92',3)+R(153,77,9,68,3,'#526a7b','#8197a7',1)+R(153,175,9,65,3,'#526a7b','#8197a7',1);
  a+=D('M294 72V145','#f8fafb',3);
 }
 return a;
}
function fryer(){
 let a=box(81,141,266,125,24)+feet(99,318,266);
 a+=P('84,142 115,110 370,110 349,142','url(#steel2)','#698398',2);
 for(let k=0;k<2;k++){
  const x=121+k*120;
  a+=R(x,102,105,71,5,'url(#dark)','#98a8b3',2);
  a+=R(x+10,112,85,49,2,'url(#mesh)','#5f7788',1);
  for(let y=116;y<=157;y+=10)a+=D('M'+(x+14)+' '+y+'H'+(x+88),'#a1b4bf',1);
  a+=D('M'+(x+50)+' 102V62Q'+(x+53)+' 54 '+(x+61)+' 54','#293d4d',10);
 }
 a+=C(160,218,13,'url(#dark)','#acbbc4',2)+C(267,218,13,'url(#dark)','#acbbc4',2)+H(323,219);
 return a;
}
function griddle(){
 let a=box(75,147,274,112,25)+feet(97,318,259);
 a+=P('66,148 97,89 347,89 372,148','url(#top)','#677d90',2);
 a+=D('M94 92H342','#f6fafc',7)+D('M83 140H360','#6f8799',7);
 a+=R(92,169,240,19,2,'url(#dark)','#6b8392',1);
 for(let i=0;i<3;i++)a+=C(142+i*71,225,12,'#314959','#a0b2bd',3)+H(146+i*71,221);
 return a;
}
function stovetop(){
 let a=box(76,147,273,115,23)+feet(94,317,262);
 a+=P('74,146 102,88 345,88 371,146','url(#top)','#648197',3);
 for(let row=0;row<2;row++)for(let col=0;col<3;col++){
  const x=136+col*79+row*8,y=111+row*18;
  a+=E(x,y,27,10,'#3d5262','#879dad',3)+E(x,y,11,4,'#839cab','#273c50',1);
 }
 a+=R(97,174,231,15,2,'url(#dark)','#738898',1);
 for(let i=0;i<4;i++)a+=C(128+i*59,224,11,'#263e4e','#aabdc6',2);
 return a;
}
function worktable(shelf=true){
 let a=R(72,122,290,28,5,'url(#top)','#6b8292',2);
 a+=P('72,122 102,86 390,86 362,122','url(#top)','#8297a5',2);
 a+=D('M85 151V290M353 151V290','#708899',13)+D('M102 159V288M332 159V288','#a5b9c5',6);
 if(shelf)a+=P('91,245 356,245 337,260 107,260','url(#steel2)','#718898',2);
 a+=D('M77 123H361','#f6fafc',4);
 return a;
}
function sink(){
 let a=worktable(false);
 a+=P('105,119 118,92 232,92 221,119','url(#dark)','#728899',2);
 a+=P('240,119 252,92 352,92 342,119','url(#dark)','#728899',2);
 a+=P('119,96 213,96 201,116 112,116','url(#glass)','#869eac',1);
 a+=P('254,96 340,96 332,116 246,116','url(#glass)','#869eac',1);
 a+=D('M228 111V70Q228 44 258 44Q278 44 278 70V88','#6a8294',10)+D('M229 113V69Q229 46 258 46Q276 46 276 70V85','#f4f8fb',3);
 a+=C(232,110,6,'#f1f5f6','#718898',2);
 return a;
}
function shelf(){
 let a='';
 for(const x of [106,348])a+=R(x,37,13,254,1,'url(#steel2)','#678296',1);
 for(const y of [66,127,188,250]){
  a+=P('110,'+y+' 350,'+y+' 371,'+(y-19)+' 131,'+(y-19),'url(#top)','#7b91a1',2);
  a+=D('M111 '+(y+7)+'H349','#d7e1e6',3);
 }
 return a;
}
function mixer(){
 let a=R(168,54,121,61,24,'url(#steel)','#708797',3);
 a+=R(197,107,23,107,6,'url(#steel2)','#536d7c',2);
 a+=R(173,214,126,51,18,'url(#dark)','#7c96a5',2)+feet(180,277,267);
 a+=P('129,175 276,175 250,242 158,242','url(#steel)','#667d8c',3);
 a+=E(202,177,74,20,'url(#top)','#708898',2);
 a+=D('M220 120V160','#516a7a',10)+E(223,163,20,6,'#8aa2af','#536977',2);
 a+=C(251,83,10,'#324c5b','#a0b4c0',2)+H(261,89);
 return a;
}
function slicer(){
 let a=R(72,234,305,33,9,'url(#steel2)','#688296',3)+feet(92,337,267);
 a+=C(273,150,97,'url(#steel)','#6d8392',6)+C(273,150,76,'url(#steel2)','#8b9caa',4)+C(273,150,13,'#b3c4d0','#697f90',2);
 a+=D('M91 190L236 136L258 151L114 205','#496476',20);
 a+=P('104,205 218,171 256,200 142,234','url(#steel2)','#667d91',3);
 a+=R(112,163,12,46,3,'#344d5f','#8197a5',2)+C(117,166,8,'url(#dark)','#b4c1ca',1);
 return a;
}
function grinder(){
 let a=box(172,122,167,119,27)+feet(187,312,241);
 a+=C(172,173,49,'url(#steel)','#6e8597',4)+C(172,173,26,'#304b5c','#94a8b4',3);
 for(let ang=0;ang<7;ang++){
  const t=ang*2*Math.PI/7;
  a+=C(num(172+16*Math.cos(t)),num(173+16*Math.sin(t)),4,'#cbd8e0','#8a9eae',1);
 }
 a+=D('M225 127V90','#617989',16)+E(225,86,61,17,'url(#top)','#71899a',3)+R(286,152,39,17,2,'url(#dark)','#718a9b',1);
 return a;
}
function iceMachine(){
 let a=box(113,58,231,218,23)+feet(132,315,276);
 a+=R(128,76,199,114,4,'url(#glass)','#718b9c',3)+R(135,192,188,56,4,'url(#vent)','#657c8d',2);
 for(let y=204;y<243;y+=9)a+=D('M146 '+y+'H310','#8ca3b1',2);
 a+=C(301,99,7,'#79cbd6','#e0fafc',2);
 return a;
}
function pizza(){
 let a=box(80,70,276,191,23)+feet(103,324,261);
 a+=R(99,97,239,139,5,'url(#dark)','#9aafba',3);
 a+=D('M130 201V162Q130 119 220 119Q310 119 310 162V201Z','#9caab5',5,'url(#warm)');
 a+=D('M146 196H290','#e89f56',7)+D('M165 207H273','#6e8598',4);
 a+=C(123,240,9,'#3c586b','#a3b7c3',1)+C(314,240,9,'#3c586b','#a3b7c3',1);
 return a;
}
function accessory(){
 let a=E(216,237,145,31,'url(#steel2)','#647d90',3);
 a+=P('110,146 327,146 355,202 87,202','url(#top)','#7892a1',4);
 a+=D('M110 147V180Q113 202 136 202H309Q341 202 345 182V148','#71899a',6);
 a+=D('M122 158H318','#f8fbfd',4);
 a+=R(149,114,130,28,4,'url(#steel2)','#8495a3',2);
 a+=D('M164 119H261','#f5fafb',4);
 return a;
}
function coffee(){
 let a=box(96,76,243,190,23)+feet(117,309,266);
 a+=R(110,95,213,47,4,'url(#dark)','#7593a1',2)+R(131,109,76,16,3,'#5aaeb4','none',0);
 a+=C(282,116,13,'url(#steel2)','#b6c6cf',2)+H(259,113);
 a+=D('M164 152V202M276 152V202','#728b9a',9);
 for(const x of [154,264])a+=R(x,207,36,27,6,'#e5eef3','#97aebd',2);
 a+=D('M133 237H304','#4f6477',5);
 return a;
}
function kettle(){
 let a=box(102,141,236,125,26)+feet(121,305,266);
 a+=E(215,128,110,73,'url(#steel)','#657e8e',4);
 a+=E(215,80,104,27,'url(#dark)','#8298a7',3);
 a+=E(215,77,87,19,'url(#top)','#677f8f',2);
 a+=R(139,95,9,64,2,'#546d7f','#91a8b8',1);
 a+=R(294,95,9,64,2,'#546d7f','#91a8b8',1);
 a+=C(284,232,11,'#3a5568','#98b3bf',2)+H(317,230);
 return a;
}
function generic(){
 let a=box(96,74,249,190,28)+feet(118,317,264);
 a+=R(112,96,216,56,4,'url(#dark)','#748b9b',2)+V(123,107,116,34)+C(292,124,13,'#314b5d','#97aeba',2);
 a+=R(120,163,197,75,3,'url(#steel2)','#849ba8',2)+D('M141 185H290','#e9f1f5',4);
 return a;
}
function typeOf(p){
 const s=fold([p.category,p.name,p.model,p.sku].join(' '));
 if(/tartozek|adapter|kosar|tálca|talca|gn edeny|edeny|rack|accessor|vazlat|betet|perforalt/.test(s))return 'accessory';
 if(/pizzasuto|pizza oven|kemence|pizzakemence/.test(s))return 'pizza';
 if(/poharmoso|poharmos|glasswash/.test(s))return 'glasswasher';
 if(/kalapos|hood|haub|pass-through/.test(s)&&/mosog|washer/.test(s))return 'hoodwasher';
 if(/mosogat|dishwash|washer|mósog/.test(s))return 'dishwasher';
 if(/sokkol|blast|shock freezer/.test(s))return 'blast';
 if(/jegg|jegkeszit|jégkész|ice maker|ice machine|jegpehely/.test(s))return 'ice';
 if(/fridge|refriger|fagy|huto|hűt|cold|freezer|cabinet|chiller/.test(s))return 'fridge';
 if(/olajsuto|olajsüt|deep.fryer|fryer|frit|fritoz/.test(s))return 'fryer';
 if(/szeletelo|szeletel|slicer|affettat/.test(s))return 'slicer';
 if(/husdaral|húsdarál|meat grinder|daralo|daráló/.test(s))return 'grinder';
 if(/mixer|dagaszt|robotgep|robotgép|kevero|keverő|blend|aprít|aprit/.test(s))return 'mixer';
 if(/kaves|kávés|coffee|espresso/.test(s))return 'coffee';
 if(/főzőüst|fozoust|kettle|üst|ust|serpenyo|serpenyő/.test(s))return 'kettle';
 if(/mosogato medence|mosogató medence|mosogatotal|kagyló|kagylo|csaptelep|sink|washbasin/.test(s))return 'sink';
 if(/fali.polc|polc|shelf|allvany|állvány|regal/.test(s))return 'shelf';
 if(/munk.asztal|asztal|pult|table|counter|neutral|rozsdamentes butor/.test(s))return 'table';
 if(/sütőlap|sutolap|griddle|fry.top|plancha|rostlap/.test(s))return 'griddle';
 if(/grill|főző|fozo|tuzhely|tűzhely|indukcio|indukció|cooking|burner|kore|range/.test(s))return 'stove';
 if(/sütő|suto|oven|konvek|combi|gőzpárol|gozparol|ikore/.test(s))return 'oven';
 return 'equipment';
}
const art={oven,fridge,blast:()=>fridge(true),dishwasher,hoodwasher:()=>dishwasher(true),glasswasher:()=>dishwasher(false,true),fryer,griddle,stove:stovetop,table:worktable,sink,shelf,mixer,slicer,grinder,ice:iceMachine,pizza,accessory,coffee,kettle,equipment:generic};
const definitions='<defs>'+
 '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4f8fb"/><stop offset=".57" stop-color="#dae5ee"/><stop offset="1" stop-color="#cbdce8"/></linearGradient>'+
 '<linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f9fcfe"/><stop offset=".17" stop-color="#d1dce4"/><stop offset=".4" stop-color="#f7fafb"/><stop offset=".68" stop-color="#a4b8c6"/><stop offset="1" stop-color="#e2edf3"/></linearGradient>'+
 '<linearGradient id="steel2" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#9fb1c0"/><stop offset=".4" stop-color="#f4f8fa"/><stop offset="1" stop-color="#a4b8c5"/></linearGradient>'+
 '<linearGradient id="top" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="#fcffff"/><stop offset=".5" stop-color="#d2e0e8"/><stop offset="1" stop-color="#8fa7b8"/></linearGradient>'+
 '<linearGradient id="side" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b6c8d4"/><stop offset="1" stop-color="#667f92"/></linearGradient>'+
 '<linearGradient id="dark" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#445e70"/><stop offset="1" stop-color="#152c3c"/></linearGradient>'+
 '<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b0d0db"/><stop offset=".4" stop-color="#466c82"/><stop offset=".52" stop-color="#82a7bc"/><stop offset="1" stop-color="#203d52"/></linearGradient>'+
 '<linearGradient id="warm" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f8c66e"/><stop offset="1" stop-color="#9e4c2a"/></linearGradient>'+
 '<pattern id="mesh" width="11" height="11" patternUnits="userSpaceOnUse"><rect width="11" height="11" fill="#a1b4c0"/><path d="M0 0L11 11M11 0L0 11" stroke="#5f7d8e" stroke-width="1"/></pattern>'+
 '<pattern id="vent" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#e4ecf2"/><path d="M0 5H10" stroke="#8ca1ae" stroke-width="3"/></pattern>'+
 '<radialGradient id="shine"><stop stop-color="#fff" stop-opacity=".78"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'+
 '<filter id="shadow" x="-35%" y="-45%" width="180%" height="220%"><feDropShadow dx="1" dy="11" stdDeviation="11" flood-color="#435e75" flood-opacity=".27"/></filter>'+
 '</defs>';
function svg(p){
 const type=typeOf(p),kind=art[type]||generic;
 const model=String(p.model||p.sku||p.name||'').replace(/\s+/g,' ').trim().slice(0,42);
 const category=String(p.category||'Nagykonyhai berendezés').replace(/\s+/g,' ').trim().slice(0,56);
 const brand=String(p.manufacturer||'GastroSky').slice(0,28);
 const variant=hash(p.id)%3;
 const accent=['#d8ab65','#a7cad8','#bbaecf'][variant];
 return '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="520" viewBox="0 0 640 520" role="img" aria-label="'+esc(brand+' '+model+' – berendezéskép')+'">'+
 definitions+
 '<rect width="640" height="520" fill="url(#bg)"/>'+
 '<path d="M0 318Q300 281 640 332V420H0Z" fill="#e4ecf2" opacity=".8"/>'+
 '<circle cx="540" cy="84" r="184" fill="url(#shine)" opacity=".85"/>'+
 '<ellipse cx="326" cy="353" rx="207" ry="24" fill="#8b9ead" opacity=".16"/>'+
 '<g filter="url(#shadow)" transform="translate(87 16) scale(1.1)">'+kind()+'</g>'+

 '<rect y="414" width="640" height="106" fill="#112c40"/>'+
 '<rect y="414" width="640" height="3" fill="'+accent+'"/>'+
 '<text x="27" y="445" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="'+accent+'">'+esc(brand)+'</text>'+
 '<text x="27" y="477" font-family="Arial,sans-serif" font-size="21" font-weight="700" fill="#f6f9fb">'+esc(model)+'</text>'+
 '<text x="27" y="501" font-family="Arial,sans-serif" font-size="14" fill="#b6cbd7">'+esc(category)+'</text>'+

 '</svg>';
}
let count=0;const types={};
for(const p of products){
 const t=typeOf(p);types[t]=(types[t]||0)+1;
 await writeFile(out+'/'+hash(p.id).toString(16).padStart(8,'0')+'.svg',svg(p),'utf8');
 count++;
}
await writeFile('dist/media/illustration-type-report.json',JSON.stringify({generated:count,by_type:types},null,2)+'\n');
console.log('Generated '+count+' detailed equipment illustrations across '+Object.keys(types).length+' equipment families.');
