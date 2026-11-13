import {copyFile,mkdir} from 'node:fs/promises';
await mkdir('dist/data',{recursive:true});
await copyFile('data/supplier-stock-snapshot.json','dist/data/supplier-stock-snapshot.json');
await copyFile('data/catalog-products.json','dist/data/catalog-products.json');
for(const file of ['impresszum.html','adatkezeles.html','sutik.html','stock-monitor.html']) {
 await copyFile(file,'dist/'+file);
}
console.log('Legal pages and stock monitor copied into dist/');
