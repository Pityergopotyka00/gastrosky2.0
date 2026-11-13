// Live smoke test for a single publicly listed Maxima product.
// Does not run automatically on a schedule; respectful one-off verification.
import {parseMaximaAvailability} from '../worker/availability.js';
const sku='09100000';
const url='https://maxima.com/hu/eszpresszogep-1-dugattyu.html';
const checked_at=new Date().toISOString();
try{
 const response=await fetch(url,{headers:{Accept:'text/html','Accept-Language':'hu-HU,hu;q=0.9'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('supplier_http_'+response.status);
 if(new URL(response.url).hostname!=='maxima.com')throw Error('supplier_redirected');
 const html=await response.text();
 const result=parseMaximaAvailability(html,sku);
 const evidence={sku,checked_at,supplier_url:response.url,kind:result.kind,quantity:result.quantity,expected_date:result.expected_date,delivery_days:result.delivery_days??null,reason:result.reason};
 console.log(JSON.stringify(evidence,null,2));
 if(result.kind==='unknown')process.exitCode=2;
}catch(e){console.error(JSON.stringify({sku,checked_at,kind:'unknown',reason:String(e.message||e)}));process.exitCode=2;}
