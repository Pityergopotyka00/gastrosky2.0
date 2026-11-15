// Correct wrong category fallbacks without changing real manufacturer photographs.
// Run before Vite; the generated per-product SVG files are built by copy-static.
import {readFile,writeFile} from 'node:fs/promises';
const path='index.html';
let html=await readFile(path,'utf8');
const start=html.indexOf('function showIllustration(frame,p){');
const end=html.indexOf('\nfunction render(){',start);
if(start<0||end<0)throw Error('Cannot find storefront image fallback');
const renderer=`// A missing product photograph must never be replaced by an unrelated machine photo.
// Use the generated individual per-product type artwork only.
function gsArtHash(id){
 let h=2166136261;const s=String(id);
 for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}
 return h.toString(16).padStart(8,'0');
}
function showIllustration(frame,p){
 frame.replaceChildren();
 frame.classList.add('gs-illustrated-frame');
 const picture=document.createElement('img');
 picture.className='product-photo gs-individual-artwork';
 picture.alt=p.name+' – terméktípus szerinti berendezéskép';
 picture.loading='lazy';
 picture.src='/media/product-illustrations/'+gsArtHash(p.id)+'.svg';
 frame.append(picture);
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