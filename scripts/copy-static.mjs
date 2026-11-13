import {copyFile} from 'node:fs/promises';
for(const file of ['impresszum.html','adatkezeles.html','sutik.html']) await copyFile(file,'dist/'+file);
console.log('Legal drafts copied into dist/');
