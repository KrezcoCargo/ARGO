/* ═══════════════════════════════════════════════════════════
   APP — arranque, sidebar, navegación, auto-refresh
═══════════════════════════════════════════════════════════ */
function startApp(){
  document.getElementById('page-login').style.display='none';
  document.getElementById('app').classList.add('visible');
  buildSidebar();
  buildTenantSwitcher();
  restoreSidebarState();
  loadFromGitHubThenRender();
  startAutoRefresh();
  navTo('dashboard');
  const btnEmail=document.getElementById('btn-email-summary');
  if(btnEmail)btnEmail.style.display=(SESSION&&(SESSION.role==='superadmin'||SESSION.role==='editor'))?'flex':'none';
}

/* ═══════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════ */
function buildSidebar(){
  if(!SESSION)return;
  document.getElementById('sb-avatar').textContent=(SESSION.name||SESSION.username).charAt(0).toUpperCase();
  document.getElementById('sb-name').textContent=SESSION.name||SESSION.username;
  document.getElementById('sb-role').textContent={superadmin:'Super Administrador',editor:'Editor',viewer:'Espectador'}[SESSION.role]||SESSION.role;
  const items=NAV_ITEMS[SESSION.role]||NAV_ITEMS.viewer;
  const nav=document.getElementById('sb-nav');
  nav.innerHTML=items.map(it=>`
    <div class="nav-item" id="nav-${it.id}" onclick="navTo('${it.id}')" data-label="${it.label}">
      <span class="nav-icon">${it.icon}</span><span>${it.label}</span>
    </div>`).join('');
}

/* ═══════════════════════════════════════════════════════════
   AUTO-REFRESH (cada 30s comprueba si hay datos nuevos)
═══════════════════════════════════════════════════════════ */
let _refreshTimer = null;
let _lastDataHash = '';

function dataHash(schools){
  if(!schools||!schools.length) return '0';
  return String(schools.length) + '_' + (schools.reduce((a,s)=>a+(s.raciones||0),0));
}

// Combines content hash + updatedAt timestamp so ANY change triggers a refresh
function remoteHash(remote){
  return dataHash(remote.schools) + '|' + (remote.updatedAt||'');
}

function startAutoRefresh(){
  if(_refreshTimer) clearInterval(_refreshTimer);
  _refreshTimer = setInterval(async ()=>{
    const remote = await fetchFromGitHub();
    if(!remote || !remote.schools) return;
    const newHash = remoteHash(remote);
    if(newHash !== _lastDataHash && _lastDataHash !== ''){
      SCHOOLS = remote.schools;
      CFG = Object.assign(CFG, remote.cfg||{});
      const _saved=getSavedClientName();if(_saved)CFG.clienteNombre=_saved;
      localStorage.setItem(getDataCacheKey(), JSON.stringify(Object.assign({},remote,{updatedAt:remote.updatedAt||''})));
      _lastDataHash = newHash;
      initDashboard();
      refreshMapIfActive();
      showRefreshBadge();
    } else if(_lastDataHash === ''){
      _lastDataHash = newHash;
    }
  }, 30000);
}

function showRefreshBadge(){
  const t = document.getElementById('toast');
  if(t){
    t.textContent = '🔄 Datos actualizados automáticamente';
    t.style.background = 'var(--green)';
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'), 3500);
  }
}

/* ═══════════════════════════════════════════════════════════
   TENANT SWITCHER
═══════════════════════════════════════════════════════════ */
function buildTenantSwitcher(){
  const el=document.getElementById('sb-tenant');
  if(!el)return;
  const accessible=getUserTenants();
  if(!ACTIVE_TENANT&&accessible.length>0){ACTIVE_TENANT=accessible[0];sessionStorage.setItem('kc_tenant',ACTIVE_TENANT.id);}
  if(!accessible.length){el.innerHTML='';return;}
  const multi=accessible.length>1;
  el.innerHTML=`
    <div style="padding:8px 14px 4px;border-top:1px solid rgba(255,255,255,.1)">
      <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.4);letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px">BASE DE DATOS</div>
      <div style="position:relative">
        <div onclick="${multi?'toggleTenantPicker()':''}" style="display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.08);border-radius:7px;padding:6px 10px;${multi?'cursor:pointer':''}">
          <span style="width:8px;height:8px;border-radius:50%;background:${ACTIVE_TENANT?.color||'#999'};flex-shrink:0"></span>
          <span style="font-size:11px;font-weight:700;color:#fff;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ACTIVE_TENANT?.name||'—'}</span>
          ${multi?'<span style="color:rgba(255,255,255,.4);font-size:9px">▾</span>':''}
        </div>
        <div id="tenant-picker" style="display:none;position:absolute;top:calc(100%+4px);left:0;right:0;background:#1a2540;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.5);z-index:600">
          ${accessible.map(t=>`<div onclick="switchTenant('${t.id}')" style="padding:9px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;color:#fff;transition:background .1s;${t.id===ACTIVE_TENANT?.id?'background:rgba(255,255,255,.14)':''}">
            <span style="width:9px;height:9px;border-radius:50%;background:${t.color};flex-shrink:0"></span>${t.name}
          </div>`).join('')}
        </div>
      </div>
    </div>`;
}

function toggleTenantPicker(){
  const p=document.getElementById('tenant-picker');
  if(p)p.style.display=p.style.display==='none'?'block':'none';
}

async function switchTenant(id){
  const t=getUserTenants().find(x=>x.id===id);
  if(!t||t.id===ACTIVE_TENANT?.id){const p=document.getElementById('tenant-picker');if(p)p.style.display='none';return;}
  ACTIVE_TENANT=t;
  sessionStorage.setItem('kc_tenant',id);
  _lastDataHash=''; // reset so auto-refresh detects new data
  SCHOOLS=[];
  CFG={clienteNombre:'',programa:'Programa',fechaInicioISO:'',diasTotal:0,diaFechas:{},diaFechasRev:{}};
  const p=document.getElementById('tenant-picker');if(p)p.style.display='none';
  buildTenantSwitcher();
  buildUploadTenantSelect();
  showToast('⏳ Cargando '+t.name+'…');
  await loadFromGitHubThenRender();
  navTo('dashboard');
  showToast('✓ '+t.name);
}

function toggleTokenVisibility(){
  const inp = document.getElementById('gh-token');
  if(!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function checkGHConnectedBadge(){
  const cfg = JSON.parse(localStorage.getItem('kc_gh_cfg')||'{}');
  const badge = document.getElementById('gh-connected-badge');
  if(badge) badge.style.display = (cfg.owner && cfg.repo) ? '' : 'none';
}

function toggleSidebar(){
  const sb=document.getElementById('sidebar');
  const mn=document.getElementById('main-content');
  const collapsed=sb.classList.toggle('collapsed');
  if(mn)mn.classList.toggle('collapsed',collapsed);
  localStorage.setItem('kc_sb_collapsed', collapsed?'1':'0');
}

function restoreSidebarState(){
  if(localStorage.getItem('kc_sb_collapsed')==='1'){
    const sb=document.getElementById('sidebar');
    const mn=document.getElementById('main-content');
    if(sb)sb.classList.add('collapsed');
    if(mn)mn.classList.add('collapsed');
  }
}
