/* ═══════════════════════════════════════════════════════════
   GITHUB API
═══════════════════════════════════════════════════════════ */
function getGHCfg(){
  const base=JSON.parse(localStorage.getItem('kc_gh_cfg')||'{}');
  let token=sessionStorage.getItem('kc_gh_token')||'';
  if(!token){
    try{
      const raw=localStorage.getItem('kc_gh_tok');
      if(raw) token=decodeURIComponent(escape(atob(raw)));
    }catch{}
  }
  return Object.assign({},base,{token});
}

function saveGitHubConfig(){
  const cfg={
    owner:document.getElementById('gh-owner').value.trim(),
    repo:document.getElementById('gh-repo').value.trim(),
    branch:document.getElementById('gh-branch').value.trim()||'main',
    path:document.getElementById('gh-path').value.trim()||'data.json'
  };
  const token=document.getElementById('gh-token').value.trim();
  if(!cfg.owner||!cfg.repo){showGHStatus('Completa owner y repositorio.','err');return;}
  localStorage.setItem('kc_gh_cfg',JSON.stringify(cfg));
  if(token){
    sessionStorage.setItem('kc_gh_token',token);
    try{ localStorage.setItem('kc_gh_tok', btoa(unescape(encodeURIComponent(token)))); }catch{}
  }
  showGHStatus('✓ Configuración guardada. El token quedó guardado en este navegador.','ok');
  showToast('✓ GitHub configurado');
  checkGHConnectedBadge();
}

async function testGitHubConnection(){
  const cfg=getGHCfg();
  if(!cfg.owner||!cfg.repo||!cfg.token){showGHStatus('Completa owner, repo y token primero.','err');return;}
  showGHStatus('Probando conexión…','info');
  try{
    const r=await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}`,{headers:{Authorization:`token ${cfg.token}`,'Accept':'application/vnd.github.v3+json'}});
    if(r.ok){showGHStatus('✓ Conexión exitosa al repositorio.','ok');}
    else{const j=await r.json();showGHStatus(`✗ Error ${r.status}: ${j.message}`,'err');}
  }catch(e){showGHStatus('✗ Error de red: '+e.message,'err');}
}

function showGHStatus(msg,type){
  const el=document.getElementById('gh-status');
  if(!el)return;
  const styles={ok:'background:var(--green-lite);color:var(--green)',err:'background:var(--red-bg);color:var(--red)',info:'background:var(--orange-bg);color:#92400E'};
  el.style.cssText=styles[type]||styles.info;el.textContent=msg;el.style.display='block';
}

async function publishToGitHub(dataObj,targetPath){
  const cfg=getGHCfg();
  if(!cfg.owner||!cfg.repo){
    showPublishStatus('⚠️ GitHub no configurado. Ve a ⚙️ Configuración → Sincronización con GitHub.','warn');
    return false;
  }
  if(!cfg.token){
    showPublishStatus('⚠️ Token de GitHub no encontrado. Ve a ⚙️ Configuración → pega tu token → Guardar y conectar.','warn');
    return false;
  }
  showPublishStatus('⏳ Publicando en GitHub…','info');
  const path=targetPath||getDataPath()||cfg.path;
  const url=`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  const headers={Authorization:`token ${cfg.token}`,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'};
  let sha=null;
  try{const r=await fetch(url,{headers});if(r.ok){const j=await r.json();sha=j.sha;}}catch{}
  const jsonStr=JSON.stringify(dataObj);
  const b64=btoa(unescape(encodeURIComponent(jsonStr)));
  const body={message:`Update data.json — ${new Date().toLocaleString('es-EC')}`,content:b64,branch:cfg.branch||'main'};
  if(sha)body.sha=sha;
  try{
    const r=await fetch(url,{method:'PUT',headers,body:JSON.stringify(body)});
    if(r.ok){
      showPublishStatus('✅ Publicado en GitHub. Todos los usuarios verán los datos nuevos en ~30 segundos.','ok');
      showToast('✅ Datos publicados en GitHub');
      return true;
    }else{
      const j=await r.json();
      showPublishStatus(`✗ Error GitHub ${r.status}: ${j.message}`,'err');
      return false;
    }
  }catch(e){showPublishStatus('✗ Error de red: '+e.message,'err');return false;}
}

function showPublishStatus(msg,type){
  const el=document.getElementById('gh-publish-status');
  if(!el)return;
  const styles={ok:'background:var(--green-lite);color:var(--green)',err:'background:var(--red-bg);color:var(--red)',warn:'background:var(--orange-bg);color:#92400E',info:'background:#E0E7FF;color:#3730A3'};
  el.style.cssText=styles[type]||styles.info;el.textContent=msg;el.style.display='block';
}

async function fetchFromGitHub(){
  const stored=JSON.parse(localStorage.getItem('kc_gh_cfg')||'{}');
  const owner=(typeof GH_REPO_CFG!=='undefined'&&GH_REPO_CFG.owner)?GH_REPO_CFG.owner:stored.owner||'';
  const repo=(typeof GH_REPO_CFG!=='undefined'&&GH_REPO_CFG.repo)?GH_REPO_CFG.repo:stored.repo||'';
  const branch=(typeof GH_REPO_CFG!=='undefined'&&GH_REPO_CFG.branch)?GH_REPO_CFG.branch:stored.branch||'main';
  const path=getDataPath();
  if(!owner||!repo)return null;
  const apiUrl=`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}&_=${Date.now()}`;
  try{
    const r=await fetch(apiUrl,{headers:{'Accept':'application/vnd.github.v3+json','Cache-Control':'no-cache'}});
    if(r.ok){
      const meta=await r.json();
      const decoded=decodeURIComponent(escape(atob(meta.content.replace(/\n/g,''))));
      return JSON.parse(decoded);
    }
  }catch{}
  try{
    const rawUrl=`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}?_=${Date.now()}`;
    const r2=await fetch(rawUrl,{cache:'no-store'});
    if(r2.ok)return await r2.json();
  }catch{}
  return null;
}

/* ── Guarda data/users.json en GitHub (lo llama auth.js al crear/borrar usuarios) ── */
async function saveUsersToGitHub(users){
  const cfg=getGHCfg();
  if(!cfg.owner||!cfg.repo||!cfg.token) return false;
  const url=`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${GH_USERS_PATH}`;
  const headers={Authorization:`token ${cfg.token}`,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'};
  let sha=null;
  try{const r=await fetch(url,{headers});if(r.ok){const j=await r.json();sha=j.sha;}}catch{}
  const exportable=users.filter(u=>!u.locked&&u.role!=='superadmin');
  const b64=btoa(unescape(encodeURIComponent(JSON.stringify(exportable,null,2))));
  const body={message:`Update users — ${new Date().toLocaleString('es-EC')}`,content:b64,branch:cfg.branch||'main'};
  if(sha)body.sha=sha;
  try{
    const r=await fetch(url,{method:'PUT',headers,body:JSON.stringify(body)});
    return r.ok;
  }catch{return false;}
}

/* ── Carga data/users.json desde GitHub y lo guarda en caché local ── */
async function fetchUsersFromGitHub(){
  const owner=GH_REPO_CFG.owner||'';
  const repo=GH_REPO_CFG.repo||'';
  const branch=GH_REPO_CFG.branch||'main';
  if(!owner||!repo)return null;
  try{
    const url=`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${GH_USERS_PATH}?_=${Date.now()}`;
    const r=await fetch(url,{cache:'no-store'});
    if(r.ok){
      const users=await r.json();
      localStorage.setItem('kc_users',JSON.stringify(users));
      return users;
    }
  }catch{}
  return null;
}

/* ── Tenants: leer/escribir data/tenants.json ── */
async function fetchTenantsFromGitHub(){
  const owner=GH_REPO_CFG.owner||'';const repo=GH_REPO_CFG.repo||'';const branch=GH_REPO_CFG.branch||'main';
  if(!owner||!repo){TENANTS=[...DEFAULT_TENANTS];return TENANTS;}
  try{
    const url=`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${GH_TENANTS_PATH}?_=${Date.now()}`;
    const r=await fetch(url,{cache:'no-store'});
    if(r.ok){const t=await r.json();localStorage.setItem('kc_tenants',JSON.stringify(t));TENANTS=[...t];return t;}
  }catch{}
  try{const c=localStorage.getItem('kc_tenants');if(c){TENANTS=JSON.parse(c);return TENANTS;}}catch{}
  TENANTS=[...DEFAULT_TENANTS];return TENANTS;
}
async function saveTenantsToGitHub(tenants){
  const cfg=getGHCfg();if(!cfg.owner||!cfg.repo||!cfg.token)return false;
  const url=`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${GH_TENANTS_PATH}`;
  const headers={Authorization:`token ${cfg.token}`,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'};
  let sha=null;try{const r=await fetch(url,{headers});if(r.ok){const j=await r.json();sha=j.sha;}}catch{}
  const b64=btoa(unescape(encodeURIComponent(JSON.stringify(tenants,null,2))));
  const body={message:`Update tenants — ${new Date().toLocaleString('es-EC')}`,content:b64,branch:cfg.branch||'main'};
  if(sha)body.sha=sha;
  try{
    const r=await fetch(url,{method:'PUT',headers,body:JSON.stringify(body)});
    if(r.ok){TENANTS=[...tenants];localStorage.setItem('kc_tenants',JSON.stringify(tenants));}
    return r.ok;
  }catch{return false;}
}

/* ── Bodega: leer/escribir data/bodega.json ── */
async function fetchBodegaFromGitHub(){
  const owner=GH_REPO_CFG.owner||'';const repo=GH_REPO_CFG.repo||'';const branch=GH_REPO_CFG.branch||'main';
  // Resolve bodegaPath: ACTIVE_TENANT.bodegaPath (may be missing if tenants.json was saved before this field existed)
  // → fallback to DEFAULT_TENANTS entry for this tenant → fallback to global constant (only for krezco)
  let path=ACTIVE_TENANT&&ACTIVE_TENANT.bodegaPath?ACTIVE_TENANT.bodegaPath:null;
  if(!path&&ACTIVE_TENANT){
    const def=(typeof DEFAULT_TENANTS!=='undefined'?DEFAULT_TENANTS:[]).find(t=>t.id===ACTIVE_TENANT.id);
    path=def&&def.bodegaPath?def.bodegaPath:null;
  }
  // Only fall back to global GH_BODEGA_PATH when no tenant is active (no tenant context)
  if(!path&&!ACTIVE_TENANT) path=typeof GH_BODEGA_PATH!=='undefined'?GH_BODEGA_PATH:'data/bodega.json';
  if(!owner||!repo||!path)return null;
  try{
    const url=`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}?_=${Date.now()}`;
    const r=await fetch(url,{cache:'no-store'});
    if(r.ok)return await r.json();
  }catch{}
  return null;
}

function loadConfig2GH(){
  const cfg=JSON.parse(localStorage.getItem('kc_gh_cfg')||'{}');
  setField('gh-owner',cfg.owner||'');
  setField('gh-repo',cfg.repo||'');
  setField('gh-branch',cfg.branch||'main');
  setField('gh-path',cfg.path||'data.json');
  const ghcfg=getGHCfg();
  if(ghcfg.token){
    const masked='•'.repeat(Math.max(0,ghcfg.token.length-6))+ghcfg.token.slice(-6);
    const inp=document.getElementById('gh-token');
    if(inp&&!inp.value) inp.placeholder=`Token guardado: ${masked} (pega uno nuevo para reemplazar)`;
  }
}
