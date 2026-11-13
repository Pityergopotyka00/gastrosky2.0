import {copyFile} from 'node:fs/promises';
for(const file of ['impresszum.html','adatkezeles.html','sutik.html','stock-monitor.html']) {
 await copyFile(file,'dist/'+file);
}
console.log('Legal pages and stock monitor copied into dist/');
