// Read prevalidated authorized supplier-feed snapshots from Cloudflare static assets.
// Customers never trigger a supplier request; GitHub Actions updates snapshot files on schedule.
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
async function readAsset(env,path,url){
 if(!env.ASSETS)throw Error('assets_binding_missing');
 const response=await env.ASSETS.fetch(new Request(new URL(path,url).toString()));
 if(!response.ok)throw Error('asset_unavailable');
 return response.json();
}
const unknown=(id,reason)=>({id,kind:'unknown',quantity:null,expected_date:null,reason,checked_at:null});
export default{
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/stock'&&request.method==='GET'){
   const id=url.searchParams.get('id')||'';
   if(!/^(?:maxima|hendi):[\w.-]{1,80}$/i.test(id))return json({error:'invalid_product_id'},400);
   try{
    const catalog=await readAsset(env,'/data/catalog-products.json',url);
    const product=catalog.find(p=>p.id===id);
    if(!product)return json({error:'unknown_product'},404);
    const stock=await readAsset(env,'/data/supplier-stock-snapshot.json',url);
    const record=stock[id];
    if(!record)return json({...unknown(id,'feed_not_connected'),sku:product.sku});
    // A stale feed may not be shown as genuine live inventory.
    const observed=Date.parse(record.checked_at);
    if(!Number.isFinite(observed)||observed>Date.now()+60000||Date.now()-observed>6*60*60*1000)
      return json({...unknown(id,'stock_stale'),sku:product.sku});
    const allowed=['in_stock','out_of_stock','low_stock','unknown','out_of_assortment'];
    if(!allowed.includes(record.kind))return json({...unknown(id,'unverified_stock_kind'),sku:product.sku});
    return json({
      id,sku:product.sku,kind:record.kind,
      quantity:Number.isSafeInteger(record.quantity)?record.quantity:null,
      expected_date:null,reason:record.reason||null,checked_at:record.checked_at,
      source:'authorized_supplier_feed'
    });
   }catch{return json(unknown(id,'feed_unavailable'))}
  }
  if(url.pathname==='/api/products'&&request.method==='GET'){
   try{
    const all=await readAsset(env,'/data/catalog-products.json',url);
    const limit=Math.min(100,Math.max(1,parseInt(url.searchParams.get('limit')||'25',10)||25));
    const offset=Math.max(0,parseInt(url.searchParams.get('offset')||'0',10)||0);
    return json({items:all.slice(offset,offset+limit).map(p=>({id:p.id,sku:p.sku,name:p.name,manufacturer:p.manufacturer,category:p.category,image_url:p.image_url||null})),total:all.length,offset,limit});
   }catch{return json({error:'catalog_unavailable'},503)}
  }
  if(url.pathname==='/api/health'&&request.method==='GET'){
   let count=0,synced=0;
   try{
    const products=await readAsset(env,'/data/catalog-products.json',url);
    const stock=await readAsset(env,'/data/supplier-stock-snapshot.json',url);
    count=products.length;synced=Object.keys(stock).length;
   }catch{}
   return json({ok:true,mode:'scheduled_authorized_feed_snapshots',products:count,stock_records:synced,live_stock_enabled:synced>0});
  }
  if(env.ASSETS)return env.ASSETS.fetch(request);
  return new Response('Not found',{status:404});
 }
};
