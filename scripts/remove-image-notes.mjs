// Remove repeated on-screen badges, image notes and captions without changing
// verified photo URLs, fallback imagery, model names, stock or quotation logic.
import {readFile,writeFile} from 'node:fs/promises';
let html=await readFile('index.html','utf8');
const replacements=[
 [
 "crop.setAttribute('aria-label',p.name+' – a berendezés típusa szerinti illusztráció, nem a pontos termék fotója');",
 "crop.setAttribute('aria-label',p.name+' – berendezéskép');"
 ],
 [
 " frame.append(crop);\n const badge=document.createElement('span');\n badge.className='gs-family-image-note';\n badge.textContent='Illusztráció · nem termékfotó';\n frame.append(badge);",
 " frame.append(crop);"
 ],
 [
 "pic.append(image);if(p.image_source==='official_manufacturer_shared_model_photo'){const familyNote=document.createElement('span');familyNote.className='gs-family-image-note';familyNote.textContent='Termékcsalád-fotó';pic.append(familyNote)}}else showIllustration(pic,p);",
 "pic.append(image)}else showIllustration(pic,p);"
 ],
 [
 "img.onerror=()=>{showIllustration(photo,p);const caption=visual.querySelector('.gs-detail-picture-note span:last-child');if(caption)caption.textContent='Berendezésillusztráció – a gyártói termékfotó nem tölthető be';};",
 "img.onerror=()=>showIllustration(photo,p);"
 ],
 [
 " const pictureNote=make('div','gs-detail-picture-note');\n pictureNote.append(make('span','gs-detail-picture-dot'),make('span','',p.image_url?p.manufacturer+' termékfotó':'Berendezésillusztráció – a pontos termékfotó beszerzés alatt'));\n visual.append(pictureNote);\n",
 ""
 ]
];
for(const [oldText,newText] of replacements){
 const occurrences=html.split(oldText).length-1;
 if(occurrences!==1)throw Error('Expected one replacement anchor; got '+occurrences+': '+oldText.slice(0,90));
 html=html.replace(oldText,newText);
}
const visibleLabels=[
 'Illusztráció · nem termékfotó',
 'Termékcsalád-fotó',
 'Berendezésillusztráció –',
 'gs-detail-picture-note span:last-child'
];
for(const marker of visibleLabels)if(html.includes(marker))throw Error('Image-caption marker still in storefront: '+marker);
await writeFile('index.html',html);
console.log('Removed storefront image badges and detail captions without modifying product data.');
