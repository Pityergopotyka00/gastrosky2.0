'use strict';
const form=document.getElementById('login');
const account=document.getElementById('account');
const status=document.getElementById('status');
const submit=document.getElementById('submit');
const identity=document.getElementById('identity');
const logout=document.getElementById('logout');
let csrfToken=null;
function message(text,error=false){status.textContent=text;status.dataset.state=error?'error':'info'}
function showAccount(data){
 form.hidden=true;
 account.hidden=false;
 identity.textContent=data.email+' · '+(data.role==='owner'?'Tulajdonos':'Szerkesztő');
 csrfToken=data.csrfToken;
 message('Biztonságos munkamenet aktív.');
 window.gastroAdminDashboard?.start(data);
}
function showLogin(){
 account.hidden=true;form.hidden=false;csrfToken=null;
 window.gastroAdminDashboard?.stop();
 document.getElementById('password').value='';
 document.getElementById('code').value='';
}
async function send(url,options={}){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 const data=await response.json().catch(()=>({}));
 return {response,data};
}
form.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!form.reportValidity())return;
 submit.disabled=true;
 message('Bejelentkezés ellenőrzése...');
 try{
  const payload={
   email:document.getElementById('email').value.trim(),
   password:document.getElementById('password').value,
   code:document.getElementById('code').value.trim()
  };
  const {response,data}=await send('/api/admin/login',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify(payload)
  });
  if(response.ok&&data.ok)showAccount(data);
  else{
   document.getElementById('password').value='';
   document.getElementById('code').value='';
   const explanation=response.status===429?'Túl sok próbálkozás. Várj egy percet.':response.status===503?'A bejelentkezés még nincs beállítva vagy átmenetileg nem érhető el.':response.status===409?'Egyszeri jelszófrissítés szükséges az új biztonságos bejelentkezéshez.':'Sikertelen bejelentkezés. Ellenőrizd az adatokat és az Authenticator kódot.';
   message(explanation,true);
  }
 }catch{message('Nem sikerült kapcsolódni. Próbáld újra.',true)}
 finally{submit.disabled=false}
});
logout.addEventListener('click',async()=>{
 if(!csrfToken){showLogin();return}
 logout.disabled=true;
 try{
  const {response}=await send('/api/admin/logout',{method:'POST',headers:{'x-csrf-token':csrfToken}});
  if(!response.ok)throw Error('logout_failed');
  showLogin();message('Sikeresen kijelentkeztél.');
 }catch{message('A kijelentkezés nem sikerült. Zárd be a böngészőt, vagy próbáld újra.',true)}
 finally{logout.disabled=false}
});
(async()=>{
 try{
  const {response,data}=await send('/api/admin/session');
  if(response.ok&&data.authenticated)showAccount(data);
 }catch{ /* Keep login form usable if initial session check fails. */ }
})();
