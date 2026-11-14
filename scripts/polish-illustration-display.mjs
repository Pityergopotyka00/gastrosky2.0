// Ensure the artwork is laid out at full resolution on cards and detail views,
// while keeping truthful, prominent provenance labels.
import {readFile,writeFile} from 'node:fs/promises';
const file='index.html';
let html=await readFile(file,'utf8');
const swaps=[
 [" image.src=productIllustrationSrc(p);\n image.className='product-photo';\n image.alt=p.name+' – sematikus illusztráció, nem termékfotó';",
  " image.src=productIllustrationSrc(p);\n image.className=frame.classList.contains('gs-detail-image-frame')?'gs-detail-image product-photo':'product-photo';\n image.alt=p.name+' – részletes berendezésillusztráció, nem gyártói termékfotó';\n frame.classList.add('gs-illustrated-frame');"],
 ["Sematikus illusztráció – a termékfotó nem tölthető be","Berendezésillusztráció – a gyártói termékfotó nem tölthető be"],
 ["Sematikus illusztráció – termékfotó beszerzés alatt","Berendezésillusztráció – a pontos termékfotó beszerzés alatt"]
];
let changed=0;
for(const [from,to] of swaps){
 if(html.includes(from)){html=html.replace(from,to);changed++}
 else if(html.includes(to)){/* already applied */}
 else throw Error('Cannot locate storefront illustration formatting anchor: '+from.slice(0,90));
}
const css='<style id="gs-premium-illustration-view">.gs-illustrated-frame .product-photo{padding:0!important;background:transparent!important}.gs-detail-image-frame.gs-illustrated-frame .product-photo{width:100%!important;height:100%!important;max-height:520px!important;object-fit:contain!important;position:static!important}.gs-illustrated-frame .gs-family-image-note{top:10px;right:10px;bottom:auto}.gs-detail-image-frame.gs-illustrated-frame{background:linear-gradient(135deg,#f2f7fa,#dae6ed)}</style>';
if(!html.includes('id="gs-premium-illustration-view"')){
 if(!html.includes('</head>'))throw Error('missing document head');
 html=html.replace('</head>',css+'</head>');changed++;
}
if(changed)await writeFile(file,html);
console.log('Illustration presentation improvements applied:',changed);
