import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const script=await readFile('mobile-scroll.js','utf8');
const page=await readFile('index.html','utf8');
const copy=await readFile('scripts/copy-static.mjs','utf8');

test('mobile jump script is valid JS and included in production output',()=>{
 assert.doesNotThrow(()=>execFileSync(process.execPath,['--check','mobile-scroll.js']));
 assert.match(page,/src="\/mobile-scroll\.js" defer/);
 assert.match(copy,/copyFile\('mobile-scroll\.js','dist\/mobile-scroll\.js'\)/);
});
test('floating button is mobile-only, accessible and goes in both directions',()=>{
 assert.match(script,/max-width:760px/);
 assert.match(script,/data-visible="true"/);
 assert.match(script,/aria-label/);
 assert.match(script,/destination==='top'/);
 assert.match(script,/window\.scrollTo/);
 assert.match(script,/prefers-reduced-motion/);
 assert.match(script,/safe-area-inset-bottom/);
});
