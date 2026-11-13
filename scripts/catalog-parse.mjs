import {load} from 'cheerio';

function photoLink(url,sku,vendor){
  try{
    const u=new URL(url,vendor.origin);
    if(u.protocol!=='https:')return null;
    const host=u.hostname.toLowerCase();
    if(vendor.name==='Maxima'&&host==='maxima.com'&&/\/(?:media|img)\//.test(u.pathname))return u.href;
    if(vendor.name==='HENDI'&&['hendi.xcdn.nl','www.hendi.eu','hendi.eu'].includes(host)&&
      u.pathname.toLowerCase().includes(sku.toLowerCase())&&/\.(?:jpe?g|png|webp)$/i.test(u.pathname))return u.href;
  }catch{}
  return null;
}
export function parseProducts(html,url,vendor,existing=new Map()){
  const $=load(html);
  const title=$('h1').first().text().replace(/\s+/g,' ').trim();
  if(!title||title.length>250)return [];
  // This public commercial kitchen catalog excludes sharp/weapon-like goods.
  if(/\b(?:knife|knives|blade|dagger|machete|k[eé]s|peng[eé])\b/i.test(title))return [];
  const body=$('body').text().replace(/\s+/g,' ');
  const description=$('meta[name="description"]').attr('content')?.trim()||'';
  const category=$('nav[aria-label*=breadcrumb] a, .breadcrumbs a').last().text().trim()||
     (vendor.name==='Maxima'?'Maxima berendezések':'HENDI berendezések');
  const result=[];
  if(vendor.name==='Maxima'){
    const sku=body.match(/(?:Cikkszám|Article number|Artikelnummer)\s*:?\s*(0\d{7})\b/i)?.[1];
    if(!sku)return [];
    const image=$('meta[property="og:image"]').attr('content')||$('meta[name="twitter:image"]').attr('content')||'';
    const photo=photoLink(image,sku,vendor);
    if(!photo)return [];
    const ean=body.match(/(?:Vonalkód\s*\(EAN\)|EAN)\s*:?\s*(\d{8,14})\b/i)?.[1]||'';
    result.push({sku,image_url:photo,ean});
  }else{
    // HENDI pages may show more than one SKU in a variants table.
    // Pair each six-digit variant SKU to a *matching* image filename.
    const variants=new Set();
    $('tr').each((_,el)=>{
      const row=$(el).text().replace(/\s+/g,' ');
      for(const match of row.matchAll(/\b(\d{6})\b/g))variants.add(match[1]);
    });
    const primary=body.match(/\bSKU\s+(\d{6})\b/i)?.[1];
    if(primary)variants.add(primary);
    const images=[];
    $('img[src],img[data-src],a[href],meta[property="og:image"]').each((_,el)=>{
      const raw=$(el).attr('src')||$(el).attr('data-src')||$(el).attr('href')||$(el).attr('content');
      if(raw)images.push(raw);
    });
    for(const sku of variants){
      const image=images.map(u=>photoLink(u,sku,vendor)).find(Boolean);
      if(!image)continue;
      // Exact SKU must also be part of a visible product variant or the main SKU.
      result.push({sku,image_url:image,ean:''});
    }
  }
  return result.map(({sku,image_url,ean})=>{
    const id=vendor.name.toLowerCase()+':'+sku;
    const before=existing.get(id)||{};
    return {...before,id,sku,name:title,manufacturer:vendor.name,supplier:vendor.name,
      description:description.slice(0,1300)||before.description||'',
      category:before.category||category,ean:ean||before.ean||'',
      specifications:before.specifications||{},
      source_url:url,image_url,image_source:'manufacturer_public_page',
      source_type:'manufacturer_public_catalog',record_status:'sku_and_image_verified',
      discovered_at:before.discovered_at||new Date().toISOString(),
      last_seen_at:new Date().toISOString(),
      price:null,availability:null
    };
  });
}
