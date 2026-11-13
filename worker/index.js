// GastroSky 2.0 — experimental Maxima stock monitor.
// Only live, source-verified values may be shown as stock.
import products from '../data/maxima-products.json';
import {parseMaximaAvailability} from './availability.js';

const SOURCES = products.filter(p => p.manufacturer === 'Maxima' && p.sku && p.source_url);
const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control':'no-store', 'access-control-allow-origin':'*' };
const json = (body, status=200) => new Response(JSON.stringify(body), {status, headers:HEADERS});
const unknown = (reason='not_verified') => ({kind:'unknown',quantity:null,expected_date:null,raw:null,reason});

async function syncOne(env, p) {
  let status = unknown();
  try {
    const u = new URL(p.source_url);
    if (u.protocol !== 'https:' || u.hostname !== 'maxima.com') throw new Error('invalid_supplier_host');
    const response = await fetch(u.toString(), {headers:{Accept:'text/html','User-Agent':'GastroSky-StockMonitor/0.1 (supplier feed requested; info@gastrosky.hu)'},redirect:'follow',signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error('supplier_http_'+response.status);
    const body = await response.text();
    status = parseMaximaAvailability(body,p.sku);
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
    if(env.ASSETS)return env.ASSETS.fetch(req);
    return new Response('Not found',{status:404});
  },
  async scheduled(controller,env,ctx){
    if(env.ENABLE_STOCK_SYNC !== 'true' || !env.DB) return;
    ctx.waitUntil(syncAll(env));
  }
};
