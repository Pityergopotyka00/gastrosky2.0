// Regression guard: images must not show repeated image labels or captions.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const index=await readFile('index.html','utf8');
const showcase=await readFile('scripts/build-illustration-showcase.mjs','utf8');
for(const text of [
 'Illusztráció · nem termékfotó',
 'Termékcsalád-fotó',
 'Berendezésillusztráció',
 'const pictureNote=make',
 "badge.textContent='Illusztráció",
 'const familyNote=document.createElement'
])assert.ok(!index.includes(text),'Unwanted image note in storefront: '+text);
for(const text of [
 'Illusztráció – nem gyártói termékfotó',
 'GastroSky · látványillusztrációk',
 'A termékillusztrációk kizárólag vizuális tájékoztatásra szolgálnak.'
])assert.ok(!showcase.includes(text),'Unwanted image note in preview: '+text);
assert.ok(index.includes("frame.append(crop);"),'Image crop fallback removed');
assert.ok(index.includes("function showIllustration(frame,p)"),'Image fallback removed');
assert.ok(index.includes("photo.append(img)"),'Product photo renderer missing');
console.log('No illustration labels or image notes in storefront or gallery.');
