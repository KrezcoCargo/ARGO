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
      // Recalculate diasTotal from diaFechasRev (reliable even if stored value was stale)
      if(CFG.diaFechasRev&&Object.keys(CFG.diaFechasRev).length>0){const _dn=Object.keys(CFG.diaFechasRev).map(Number).filter(n=>n>0);if(_dn.length>0)CFG.diasTotal=Math.max(..._dn);}
      const _saved=getSavedClientName();
      CFG.clienteNombre=_saved||(ACTIVE_TENANT?ACTIVE_TENANT.name:'')||CFG.clienteNombre;
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
    <div class="tb-wrap">
      <div class="tb-section-label">Base de datos</div>
      <div style="position:relative">
        <div class="tb-active-btn" onclick="${multi?'toggleTenantPicker()':''}">
          <span class="tb-dot" style="background:${ACTIVE_TENANT?.color||'#999'}"></span>
          <span class="tb-name">${ACTIVE_TENANT?.name||'—'}</span>
          ${multi?'<span class="tb-chevron">▾</span>':''}
        </div>
        <div id="tenant-picker" style="display:none;position:absolute;top:calc(100%+6px);left:0;right:0;background:#1a2540;border-radius:10px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.55);z-index:600">
          ${accessible.map(t=>`<div onclick="switchTenant('${t.id}')" class="tb-picker-item${t.id===ACTIVE_TENANT?.id?' tb-picker-active':''}">
            <span style="width:9px;height:9px;border-radius:50%;background:${t.color};flex-shrink:0;display:inline-block"></span>${t.name}
          </div>`).join('')}
        </div>
      </div>
    </div>`;
}

function toggleTenantPicker(){
  const p=document.getElementById('tenant-picker');
  if(!p)return;
  if(p.style.display!=='none'){p.style.display='none';return;}
  const btn=document.querySelector('.tb-active-btn');
  if(!btn)return;
  const rect=btn.getBoundingClientRect();
  const sb=document.getElementById('sidebar');
  const collapsed=sb&&sb.classList.contains('collapsed');
  // Max height so picker never overflows screen, with scroll for many tenants
  const maxH=Math.min(320, window.innerHeight-16);
  p.style.position='fixed';
  p.style.width=(collapsed?'190px':'200px');
  p.style.right='auto';
  p.style.maxHeight=maxH+'px';
  p.style.overflowY='auto';
  if(collapsed){
    p.style.left='68px';
  } else {
    // Align with left edge of sidebar content
    p.style.left=rect.left+'px';
  }
  // Decide: open downward or upward depending on available space
  const pickerH=Math.min(maxH, p.scrollHeight||200);
  const spaceBelow=window.innerHeight-rect.bottom-8;
  const spaceAbove=rect.top-8;
  if(spaceBelow>=pickerH||spaceBelow>=spaceAbove){
    p.style.top=(rect.bottom+4)+'px';
    p.style.bottom='auto';
  } else {
    p.style.bottom=(window.innerHeight-rect.top+4)+'px';
    p.style.top='auto';
  }
  p.style.display='block';
  // Re-check after render (real height may differ)
  requestAnimationFrame(()=>{
    const realH=p.offsetHeight;
    const sb2=window.innerHeight-rect.bottom-8;
    const sa2=rect.top-8;
    if(realH>sb2&&sa2>=realH){
      p.style.top='auto';
      p.style.bottom=(window.innerHeight-rect.top+4)+'px';
    } else {
      p.style.bottom='auto';
      p.style.top=(rect.bottom+4)+'px';
    }
  });
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
