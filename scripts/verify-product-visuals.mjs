// Verify every catalog record has a deployed visual, without confusing
// technical illustrations with verified manufacturer product photography.
import {readFile,access,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const catalog=JSON.parse(await readFile('data/catalog-products.json','utf8'));
const dir='dist/media/product-illustrations';
const hash=id=>{
 let value=2166136261;
 for(let i=0;i<id.length;i++){value^=id.charCodeAt(i);value=Math.imul(value,16777619)>>>0}
 return value.toString(16).padStart(8,'0');
};
const names=new Set();
const idSet=new Set();
let photographed=0,illustrated=0;
for(const p of catalog){
 if(idSet.has(p.id))throw Error('Duplicate product ID '+p.id);
 idSet.add(p.id);
 const name=hash(p.id)+'.svg';
 if(names.has(name))throw Error('Illustration hash collision for '+p.id);
 names.add(name);
 await access(join(dir,name));
 const svg=await readFile(join(dir,name),'utf8');
 if(!svg.startsWith('<svg ')||!svg.includes('</svg>'))
   throw Error('Malformed SVG fallback for '+p.id);
 if(p.image_url)photographed++;else illustrated++;
}
const files=await readdir(dir);
if(files.length!==catalog.length)throw Error('Expected '+catalog.length+' distinct illustrations; got '+files.length);
console.log('Visual coverage verified:',catalog.length,'products;',photographed,'photo URLs;',illustrated,'illustration fallbacks.');
