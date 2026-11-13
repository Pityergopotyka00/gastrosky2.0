// Parse availability only from the main product purchase section.
// Every positive result must belong to the specified SKU on the product page.
const unknown=(reason='status_not_found')=>({kind:'unknown',quantity:null,expected_date:null,reason});
const entities=s=>s.replace(/&nbsp;|&#160;/gi,' ').replace(/&aacute;/gi,'á').replace(/&eacute;/gi,'é').replace(/&ouml;/gi,'ö').replace(/&uuml;/gi,'ü').replace(/&amp;/gi,'&');
function textOf(html) {
 return entities(html.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
 .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
}
export function parseMaximaAvailability(html,expectedSku) {
 if(typeof html!=='string'||!html.length)return unknown('empty_response');
 const text=textOf(html);
 // Don't use the SKU from a related product; it must be in the technical section.
 const mainSku = new RegExp('(?:Cikkszám|Article number|Artikelnummer)\\s*:?\\s*'+expectedSku+'\\b','i');
 if(!expectedSku||!mainSku.test(text))return unknown('product_identity_unverified');
 const cart=/\b(?:Kosárba|Add to Cart|In den Warenkorb)\b/i.exec(text);
 if(!cart)return unknown('purchase_section_missing');
 // The stock indicator is sometimes ABOVE the Add to Cart button.
 // Cut before "related products" to avoid reading another SKU's stock.
 const related=/(?:Összefüggő Termékek|Related Products|Kapcsolódó termékek)/i.exec(text.slice(cart.index));
 const end=related?cart.index+related.index:cart.index+200;
 const region=text.slice(Math.max(0,cart.index-500),Math.min(text.length,end+80));
 const low=/(?:Még mindig\s+(\d+)\s+van raktáron|Only\s+(\d+)\s+left in stock)/i.exec(region);
 if(low)return {kind:'low_stock',quantity:Number(low[1]||low[2]),expected_date:null,reason:null};
 const expected=/(?:Várható\s*:\s*|Expected(?:\s+on)?\s*:?\s*)(\d{1,2}\s+[a-záéíóöőúüű]+)/i.exec(region);
 if(expected)return {kind:'expected',quantity:null,expected_date:expected[1],reason:null};
 if(/(?:Nincs készleten|Out of stock)/i.test(region))return {kind:'out_of_stock',quantity:0,expected_date:null,reason:null};
 if(/(?:Készleten|In stock)/i.test(region))return {kind:'in_stock',quantity:null,expected_date:null,reason:null};
 // This is a real promise to ship, not a verified warehouse quantity.
 const delivery=/(?:szállítás\s+(\d+)\s+munkanapon belül|delivery within\s+(\d+)\s+working days)/i.exec(region);
 if(delivery)return {kind:'orderable',quantity:null,expected_date:null,reason:null,delivery_days:Number(delivery[1]||delivery[2])};
 return unknown('no_public_stock_indicator');
}
