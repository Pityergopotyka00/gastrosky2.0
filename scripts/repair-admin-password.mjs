// One-time LOCAL admin password migration helper.
// This never connects to Cloudflare or includes the plaintext password in its output.
// Requires the owner's authorization and a previously enrolled admin account.
import {scryptSync,randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const email=(process.env.ADMIN_SETUP_EMAIL||'').trim().toLowerCase();
const password=process.env.ADMIN_SETUP_PASSWORD||'';
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>160||password.length<14||password.length>256){
 console.error('Valid admin email and password (14–256 characters) required.');
 process.exitCode=1;
}else{
 const salt=randomBytes(32);
 const digest=scryptSync(password,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex');
 const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
 const statement='UPDATE admin_users SET password_salt='+quote(salt.toString('hex'))+
 ',password_hash='+quote(digest)+",password_algo='scrypt-v1',failed_attempts=0,locked_until=0 WHERE email="+quote(email)+';\n';
 const file='.admin-password-repair-'+Date.now()+'.sql';
 await writeFile(file,statement,{flag:'wx',mode:0o600});
 console.log('Private migration SQL saved locally as '+file);
 console.log('Apply migrations/0002_admin_scrypt.sql in the D1 Console first, then execute this SQL in the same Console.');
 console.log('Your existing account, owner role and Authenticator app stay unchanged. Do not share this file.');
}
