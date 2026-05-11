/* ═══════════════════════════════════════════════════════════
   APP — arranque, sidebar, navegación, auto-refresh
═══════════════════════════════════════════════════════════ */
function startApp(){
  document.getElementById('page-login').style.display='none';
  document.getElementById('app').classList.add('visible');
  buildSidebar();
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

function startAutoRefresh(){
  if(_refreshTimer) clearInterval(_refreshTimer);
  _refreshTimer = setInterval(async ()=>{
    const remote = await fetchFromGitHub();
    if(!remote || !remote.schools) return;
    const newHash = dataHash(remote.schools);
    if(newHash !== _lastDataHash && _lastDataHash !== ''){
      SCHOOLS = remote.schools;
      CFG = Object.assign(CFG, remote.cfg||{});
      CFG.clienteNombre = FORCED_CLIENT_NAME;
      localStorage.setItem('kc_data', JSON.stringify(Object.assign({},remote,{updatedAt:remote.updatedAt||''})));
      _lastDataHash = newHash;
      initDashboard();
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
