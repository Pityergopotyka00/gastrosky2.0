import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile('index.html','utf8');
const css=html.match(/<style id="gs-mobile-responsive-2026">([\s\S]*?)<\/style>/)?.[1];
assert.ok(css,'Mobile responsive stylesheet must exist');

test('mobile menu is accessible and does not remove desktop navigation',()=>{
 assert.match(html,/id="mobileMenuToggle"[^>]*aria-controls="gsPrimaryNavigation"[^>]*aria-expanded="false"/);
 assert.match(html,/<nav id="gsPrimaryNavigation" aria-label="Fő navigáció">/);
 assert.match(html,/mobileMenuToggle\.addEventListener\('click'/);
 assert.match(html,/primaryNavigation\.querySelectorAll\('a,button'\)/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/#gsPrimaryNavigation\[data-open="true"\]/);
});

test('catalog filters and cards adapt to small screens',()=>{
 assert.match(css,/\.tools\{position:static!important/);
 assert.match(css,/#search,\.tools select\{min-height:50px!important;font-size:16px!important/);
 assert.match(css,/@media\(max-width:520px\)\{\s*\.grid\{grid-template-columns:1fr\}/);
 assert.match(css,/\.gs-category-steps\{grid-template-columns:1fr\}/);
 assert.match(css,/\.actions \.button\{grid-column:1\/-1!important;width:100%;min-height:46px/);
});

test('quote and detail dialogs fit within a phone viewport',()=>{
 assert.match(css,/#quotePanel,#detail\{position:fixed/);
 assert.match(css,/max-height:94dvh!important/);
 assert.match(css,/env\(safe-area-inset-bottom\)/);
 assert.match(css,/#quotePanel input,#quotePanel textarea\{font-size:16px!important/);
});
