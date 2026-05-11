/* ═══════════════════════════════════════════════════════════
   USUARIOS — lee/escribe data/users.json en GitHub
   Cache local en localStorage para que el login sea instantáneo
═══════════════════════════════════════════════════════════ */

function getUsers(){
  try{return JSON.parse(localStorage.getItem('kc_users')||'[]');}
  catch{return[];}
}

/* Guarda en localStorage Y sube a GitHub en segundo plano */
async function saveUsers(users){
  localStorage.setItem('kc_users',JSON.stringify(users));
  const ok=await saveUsersToGitHub(users);
  return ok;
}

function ensureMaster(){
  const users=getUsers();
  if(!users.find(u=>u.username==='bmeneses')){
    const h=hashPwd('NeverLet2015');
    users.unshift({username:'bmeneses',name:'Borys Meneses',role:'superadmin',pwdHash:h,created:new Date().toISOString(),locked:true});
    localStorage.setItem('kc_users',JSON.stringify(users));
  } else {
    const u=users.find(x=>x.username==='bmeneses');
    if(u&&u.name!=='Borys Meneses'){u.name='Borys Meneses';localStorage.setItem('kc_users',JSON.stringify(users));}
  }
}

/* ═══════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════ */
function doLogin(){
  const u=document.getElementById('inp-user').value.trim().toLowerCase();
  const p=document.getElementById('inp-pass').value;
  const h=hashPwd(p);
  const users=getUsers();
  const user=users.find(x=>x.username===u&&x.pwdHash===h);
  if(!user){document.getElementById('lerr').style.display='block';return;}
  document.getElementById('lerr').style.display='none';
  SESSION={username:user.username,role:user.role,name:user.name};
  sessionStorage.setItem('kc_sess',JSON.stringify(SESSION));
  startApp();
}

function doLogout(){
  SESSION=null;sessionStorage.removeItem('kc_sess');
  document.getElementById('app').classList.remove('visible');
  document.getElementById('page-login').style.display='';
}

/* ── Al cargar la página: refresca usuarios desde GitHub y luego inicia ── */
async function initAuth(){
  // Primero asegurar superadmin en caché local
  ensureMaster();
  // Refrescar usuarios desde GitHub (en segundo plano, sin bloquear login)
  fetchUsersFromGitHub().then(users=>{
    if(users&&users.length>0) ensureMaster(); // re-asegurar superadmin tras merge
  });
  // Intentar restaurar sesión activa
  try{
    const s=sessionStorage.getItem('kc_sess');
    if(s){SESSION=JSON.parse(s);startApp();return;}
  }catch{}
  document.getElementById('page-login').style.display='';
}
