// Conservative stock-status extraction from verified Maxima single-product pages.
// A parse failure always produces unknown, never an inferred availability claim.
const unknown=(reason='status_not_found')=>({kind:'unknown',quantity:null,expected_date:null,reason});
function textOf(html){
 return html.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
 .replace(/<[^>]*>/g,' ')
 .replace(/&nbsp;|&#160;/gi,' ')
 .replace(/&aacute;/gi,'á').replace(/&eacute;/gi,'é')
 .replace(/&ouml;/gi,'ö').replace(/&uuml;/gi,'ü')
 .replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
}
export function parseMaximaAvailability(html, expectedSku){
 if(!html||typeof html!=='string')return unknown('empty_response');
 if(!expectedSku||!new RegExp('(?:Cikkszám|Article number|Artikelnummer|Numéro d.article)\\s*:?\\s*'+expectedSku+'\\b','i').test(textOf(html))){
  return unknown('product_identity_unverified');
 }
 const text=textOf(html);
 // Supplier stock can appear in 'related products' lower on the page.
 // Limit the extract to the main product's initial cart section.
 const cart=/\b(?:Kosárba|Add to Cart|In den Warenkorb|Læg i kurv)\b/i.exec(text);
 if(!cart)return unknown('cart_section_missing');
 const window=text.slice(cart.index,cart.index+430);
 const low=/(?:Még mindig\s+(\d+)\s+van raktáron|Only\s+(\d+)\s+left in stock)/i.exec(window);
 if(low)return {kind:'low_stock',quantity:Number(low[1]||low[2]),expected_date:null,reason:null};
 const expected=/(?:Várható\s*:\s*|Expected(?:\s+on)?\s*:?\s*)(\d{1,2}\s+[a-záéíóöőúüű]+)/i.exec(window);
 if(expected)return {kind:'expected',quantity:null,expected_date:expected[1],reason:null};
 if(/\b(?:Nincs készleten|Out of stock)\b/i.test(window))return {kind:'out_of_stock',quantity:0,expected_date:null,reason:null};
 if(/\b(?:Készleten|In stock)\b/i.test(window))return {kind:'in_stock',quantity:null,expected_date:null,reason:null};
 return unknown();
}
