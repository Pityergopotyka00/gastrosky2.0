// HENDI product page signals. "Not available for online orders" is not inventory.
// A verified public page can communicate assortment status, but not quantities by itself.
const unknown=(reason)=>({kind:'unknown',quantity:null,expected_date:null,reason});
function plain(html){
 return html.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
 .replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
 .replace(/\s+/g,' ').trim();
}
export function parseHendiAvailability(html,sku){
 if(!html||!sku)return unknown('empty_response');
 const text=plain(html);
 // Require a product SKU displayed on this product page.
 const variant=new RegExp('(?:SKU|Product variants|Code)\\b[\\s\\S]{0,700}\\b'+String(sku).replace(/[^0-9A-Za-z]/g,'')+'\\b','i');
 if(!variant.test(text))return unknown('product_identity_unverified');
 // Limit availability signals to the product section only.
 const first=text.indexOf('Product variants');
 if(first<0)return unknown('product_section_missing');
 let end=text.indexOf('Documents',first);
 if(end<0)end=Math.min(text.length,first+1600);
 const region=text.slice(Math.max(0,first-180),end);
 // Supplier expressly marks these as removed from product range.
 if(/\bOut of assortment\b/i.test(region))
  return {kind:'out_of_assortment',quantity:null,expected_date:null,reason:null};
 // This means visitor cannot order online, NOT proof of stock zero.
 if(/This product is not available at the moment for online orders/i.test(region))
  return unknown('online_ordering_unavailable_not_stock');
 return unknown('no_public_warehouse_stock');
}
