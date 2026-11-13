// GastroSky 2.0 — quote request API.
// Sends only after a verified Turnstile challenge. Requires Resend credentials
// and a sender verified by the email provider. Never pretends to send.
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});
export function validateQuote(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return 'invalid_payload';
 const {name,email,message,items,companyWebsite}=payload;
 if(companyWebsite)return 'spam_rejected';
 if(typeof name!=='string'||name.trim().length<2||name.length>120)return 'invalid_name';
 if(typeof email!=='string'||email.length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return 'invalid_email';
 if(message!==undefined&&(typeof message!=='string'||message.length>1600))return 'invalid_message';
 if(!Array.isArray(items)||items.length>40)return 'invalid_items';
 if(items.length===0&&(typeof message!=='string'||message.trim().length<10))return 'message_required_for_general_quote';
 if(!items.every(id=>typeof id==='string'&&/^(maxima|hendi|fagor|modular|coldline|krupps|aristarco|sistemaproject|tecnodom|gastrohaal):[\w./-]{1,80}$/i.test(id)))return 'invalid_items';
 if(new Set(items).size!==items.length)return 'duplicate_items';
 return null;
}
const configured=env=>Boolean(env.RESEND_API_KEY&&env.QUOTE_FROM_EMAIL&&env.QUOTE_TO_EMAIL&&env.TURNSTILE_SECRET_KEY&&env.TURNSTILE_SITE_KEY);
function sameOrigin(request){
 const origin=request.headers.get('origin');
 if(!origin)return false;
 try{return new URL(origin).origin===new URL(request.url).origin}catch{return false}
}
function clean(s){return String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))}
export function quoteConfig(env){return reply({enabled:configured(env),turnstileSiteKey:configured(env)?env.TURNSTILE_SITE_KEY:null})}
async function verifyChallenge(secret,token,remoteIp){
 if(typeof token!=='string'||token.length<20||token.length>2048)return false;
 try{
  const form=new URLSearchParams({secret,response:token});
  if(remoteIp)form.set('remoteip',remoteIp);
  const res=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form,signal:AbortSignal.timeout(8000)});
  if(!res.ok)return false;
  return (await res.json()).success===true;
 }catch{return false}
}
export async function handleQuote(request,env,readProducts){
 if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
 if(!configured(env))return reply({error:'email_not_configured'},503);
 if(!sameOrigin(request))return reply({error:'invalid_origin'},403);
 const contentLength=Number(request.headers.get('content-length')||0);
 if(contentLength>18000)return reply({error:'payload_too_large'},413);
 let payload;
 try{
  const raw=await request.text();
  if(raw.length>18000)return reply({error:'payload_too_large'},413);
  payload=JSON.parse(raw);
 }catch{return reply({error:'invalid_json'},400)}
 const invalid=validateQuote(payload);
 if(invalid)return reply({error:invalid},400);
 const ok=await verifyChallenge(env.TURNSTILE_SECRET_KEY,payload.turnstileToken,request.headers.get('cf-connecting-ip'));
 if(!ok)return reply({error:'challenge_failed'},403);
 let products;
 try{products=await readProducts()}catch{return reply({error:'catalog_unavailable'},503)}
 const lookup=new Map(products.map(p=>[p.id,p]));
 const selected=payload.items.map(id=>lookup.get(id));
 if(selected.some(p=>!p))return reply({error:'unknown_product'},400);
 const name=payload.name.trim(),email=payload.email.trim(),message=(payload.message||'').trim();
 const productText=selected.map(p=>p.manufacturer+' – '+p.name+' ('+p.sku+')');
 const plain=['GastroSky ajánlatkérés','Név: '+name,'E-mail: '+email,'','Termékek:',...(productText.length?productText:['Általános ajánlatkérés – termék nincs kiválasztva']),'','Üzenet:',message||'—'].join('\n');
 const html='<h2>Új GastroSky ajánlatkérés</h2><p><b>Név:</b> '+clean(name)+'</p><p><b>E-mail:</b> '+clean(email)+'</p><h3>Termékek</h3><ul>'+selected.map(p=>'<li>'+clean(p.manufacturer)+' – '+clean(p.name)+' ('+clean(p.sku)+')</li>').join('')+'</ul><p><b>Üzenet:</b></p><p>'+clean(message||'—').replace(/\n/g,'<br>')+'</p>';
 try{
  const response=await fetch('https://api.resend.com/emails',{
   method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({from:env.QUOTE_FROM_EMAIL,to:[env.QUOTE_TO_EMAIL],reply_to:email,subject:'GastroSky ajánlatkérés – '+(selected.length?selected.length+' termék':'általános megkeresés'),text:plain,html}),
   signal:AbortSignal.timeout(12000)
  });
  if(!response.ok){console.error('Email provider rejected quote with HTTP',response.status);return reply({error:'email_delivery_failed'},502)}
  const result=await response.json();
  if(!result.id)return reply({error:'email_delivery_unconfirmed'},502);
  // The owner's quote notification succeeded. A customer receipt is best-effort:
  // never mark the owner's request as failed just because the receipt was rejected.
  let customerConfirmationSent=false;
  if(env.QUOTE_CUSTOMER_CONFIRMATION!=='false'){
   const receiptText=[
    'Kedves '+name+'!','','Köszönjük, hogy ajánlatot kért a GastroSky-tól.',
    'Az alábbi termékekre vonatkozó megkeresését megkaptuk:','',
    ...productText.map(p=>'• '+p),'',
    'Hamarosan felvesszük Önnel a kapcsolatot.',
    'Ez egy automatikus visszaigazolás, nem végleges árajánlat.','','GastroSky'
   ].join('\\n').replace(/\\n/g,'\n');
   const receiptHtml='<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172b42">'
    +'<div style="background:#102438;color:#e5ba73;padding:22px 26px;font-weight:bold;font-size:22px">GastroSky</div>'
    +'<div style="padding:25px;border:1px solid #e7ebf0"><h2 style="margin-top:0">Köszönjük az ajánlatkérést!</h2>'
    +'<p>Kedves '+clean(name)+'!</p><p>Megkaptuk megkeresését az alábbi termékekre:</p>'
    +'<ul>'+selected.map(p=>'<li>'+clean(p.manufacturer)+' – '+clean(p.name)+' ('+clean(p.sku)+')</li>').join('')+'</ul>'
    +'<p>Hamarosan felvesszük Önnel a kapcsolatot.</p>'
    +'<p style="font-size:12px;color:#65758b">Ez egy automatikus visszaigazolás, nem végleges árajánlat.</p></div></div>';
   try{
    const receipt=await fetch('https://api.resend.com/emails',{
     method:'POST',
     headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
     body:JSON.stringify({
      from:env.QUOTE_FROM_EMAIL,
      to:[email],
      subject:'GastroSky – ajánlatkérés visszaigazolása',
      text:receiptText,
      html:receiptHtml
     }),
     signal:AbortSignal.timeout(12000)
    });
    if(receipt.ok)customerConfirmationSent=Boolean((await receipt.json()).id);
    else console.error('Customer confirmation rejected with HTTP',receipt.status);
   }catch{console.error('Customer confirmation could not be delivered')}
  }
  return reply({ok:true,requestId:result.id,customerConfirmationSent},202);
 }catch{ return reply({error:'email_provider_unavailable'},502)}
}
