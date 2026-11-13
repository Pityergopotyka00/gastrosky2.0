// URL rules used by the public catalog importer.
// Kept pure so pagination behavior can be tested without contacting suppliers.
export function normalizeSupplierUrl(raw,vendor){
 try{
  const u=new URL(raw,vendor.origin);
  if(u.protocol!=='https:')return null;
  const host=u.hostname.toLowerCase();
  if(vendor.name==='Maxima'&&host!=='maxima.com')return null;
  if(vendor.name==='HENDI'&&!['www.hendi.eu','hendi.eu'].includes(host))return null;
  if(!u.pathname.startsWith(vendor.prefix))return null;
  if(/\.(?:pdf|jpe?g|gif|png|webp|svg|xml|css|js|woff\d?|zip)$/i.test(u.pathname))return null;
  const page=u.searchParams.get('p');
  u.search='';u.hash='';
  if(vendor.name==='HENDI'&&page&&/^\d{1,3}$/.test(page)&&Number(page)>1&&Number(page)<=200){
   u.searchParams.set('p',String(Number(page)));
  }
  return u.href;
 }catch{return null}
}
