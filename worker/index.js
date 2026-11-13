// GastroSky 2.0 — experimental Maxima stock monitor.
// Only live, source-verified values may be shown as stock.
import products from '../data/maxima-products.json';

const SOURCES = products.filter(p => p.manufacturer === 'Maxima' && p.sku && p.source_url);
const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control':'no-store', 'access-control-allow-origin':'*' };
const json = (body, status=200) => new Response(JSON.stringify(body), {status, headers:HEADERS});
const unknown = (reason='not_verified') => ({kind:'unknown',quantity:null,expected_date:null,raw:null,reason});
const normalize = s => (s||'').replace(/&nbsp;|&#160;/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const decode = s => s.replace(/&aacute;/g,'á').replace(/&eacute;/g,'é').replace(/&ouml;/g,'ö').replace(/&uuml;/g,'ü').replace(/&amp;/g,'&');

export function parseMaximaAvailability(html) {
  if (!html || typeof html !== 'string') return unknown('empty_response');
  const text = decode(normalize(html));
  // Parsing is deliberately conservative. No matching exact status => unknown.
  // Supplier pages sometimes include stock text for suggested products, so only
  // read a product-scope snippet near its cart area.
  const match = /(?:Kosárba|Add to Cart)[\s\S]{0,800}?(?:Még mindig\s+(\d+)\s+van raktáron|Only\s+(\d+)\s+left in stock|Várható\s*:\s*([\d]{1,2}\s+[a-záéíóöőúüű]+)|Expected\s*:\s*([\d]{1,2}\s+[A-Za-z]+)|Készleten|In stock|Nincs készleten|Out of stock)/i.exec(text);
  if (!match) return unknown('status_not_found');
  const full = match[0];
  if (/Nincs készleten|Out of stock/i.test(full)) return {kind:'out_of_stock',quantity:0,expected_date:null,raw:'Out of stock',reason:null};
  if (match[1] || match[2]) return {kind:'low_stock',quantity:Number(match[1]||match[2]),expected_date:null,raw:'low stock',reason:null};
  if (match[3] || match[4]) return {kind:'expected',quantity:null,expected_date:match[3]||match[4],raw:'expected',reason:null};
  if (/Készleten|In stock/i.test(full)) return {kind:'in_stock',quantity:null,expected_date:null,raw:'in stock',reason:null};
  return unknown('ambiguous_status');
}

async function syncOne(env, p) {
  let status = unknown();
  try {
    const u = new URL(p.source_url);
    if (u.protocol !== 'https:' || u.hostname !== 'maxima.com') throw new Error('invalid_supplier_host');
    const response = await fetch(u.toString(), {headers:{Accept:'text/html','User-Agent':'GastroSky-StockMonitor/0.1 (supplier feed requested; info@gastrosky.hu)'},redirect:'follow',signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error('supplier_http_'+response.status);
    const body = await response.text();
    status = parseMaximaAvailability(body);
  } catch (error) {
    status = unknown(String(error?.message || error).slice(0,100));
  }
  const observed = new Date().toISOString();
  // Fail closed: an unsuccessful check overwrites stale values with unknown.
  await env.DB.prepare('INSERT INTO stock_checks (sku,kind,quantity,expected_date,reason,checked_at) VALUES (?1,?2,?3,?4,?5,?6)').bind(p.sku,status.kind,status.quantity,status.expected_date,status.reason,observed).run();
  await env.DB.prepare('INSERT INTO stock_current (sku,kind,quantity,expected_date,reason,checked_at) VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(sku) DO UPDATE SET kind=excluded.kind,quantity=excluded.quantity,expected_date=excluded.expected_date,reason=excluded.reason,checked_at=excluded.checked_at').bind(p.sku,status.kind,status.quantity,status.expected_date,status.reason,observed).run();
  return {sku:p.sku,...status,checked_at:observed};
}

async function syncAll(env) {
  // Go gently: one fetch at a time and pause between requests. Obtain
  // supplier permission before enabling recurring automated checks.
  const results=[];
  for(const product of SOURCES) {
    results.push(await syncOne(env, product));
    await new Promise(r=>setTimeout(r,700));
  }
  return results;
}

export default {
  async fetch(req, env) {
    const url=new URL(req.url);
    if(url.pathname === '/api/stock' && req.method === 'GET') {
      if(!env.DB) return json({enabled:false,items:[],message:'D1 not configured'});
      const rows=await env.DB.prepare('SELECT sku,kind,quantity,expected_date,reason,checked_at FROM stock_current').all();
      return json({enabled:true,items:rows.results||[]});
    }
    if(url.pathname === '/api/health') return json({ok:true,mode:'prototype',stock_sync_enabled:env.ENABLE_STOCK_SYNC === 'true'});
    return new Response('Not found',{status:404});
  },
  async scheduled(controller,env,ctx){
    if(env.ENABLE_STOCK_SYNC !== 'true' || !env.DB) return;
    ctx.waitUntil(syncAll(env));
  }
};
