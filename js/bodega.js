/* ═══════════════════════════════════════════════════════════
   BODEGA v7 — compact layout · PBI colors · invSemanal for all
             · diaLabels desde Excel (D1_Mi6 → Mi<br>6)
═══════════════════════════════════════════════════════════ */
let _bodegaData = null;

/* Convierte "D1_Mi6" → "<span>Mi</span><span>6</span>" para el encabezado de día.
   Si no hay label usa "D{i+1}" como fallback. */
function _diaThHtml(labels, i){
  const raw = labels && labels[i] ? labels[i] : null;
  if(!raw) return `D${i+1}`;
  // Formato esperado: D{n}_{abbr}{fecha}  ej: D1_Mi6 / D3_J10
  const m = raw.match(/^D\d+_([A-Za-zÁÉÍÓÚáéíóúÜü]+)(\d+)$/);
  if(m) return `<span style="display:flex;flex-direction:column;align-items:center;gap:0;text-transform:none">`
    +`<span style="font-size:7px;font-weight:600;line-height:1.15;color:rgba(255,255,255,.65)">D${i+1}</span>`
    +`<span style="font-size:9.5px;font-weight:700;line-height:1.2;color:rgba(255,255,255,.95)">${m[1]}${m[2]}</span>`
    +`</span>`;
  return `<span style="display:flex;flex-direction:column;align-items:center;gap:0;text-transform:none">`
    +`<span style="font-size:7px;color:rgba(255,255,255,.65)">D${i+1}</span>`
    +`<span style="font-size:9px">${raw}</span>`
    +`</span>`;
}
let _bodegaView = 'cobertura';
let _bdgTabOrder = null;
let _bdgFilter   = {};
let _bdgColHidden= {};          // {viewId: Set<colId>}
let _bdgDragTab  = null;
let _bdgZoom     = 100;
let _bdgFilterPushTimer = null;
let _bdgPollTimer       = null;
let _bdgFilterOpen      = false;
let _bdgColOpen         = false;

const GH_FILTER_PATH = 'data/bodega-filter.json';

const BDG_TABS = [
  {id:'cobertura',     label:'Cobertura',     icon:'📊'},
  {id:'abastecimiento',label:'Abastecimiento', icon:'🔄'},
  {id:'proveedores',   label:'Proveedores',   icon:'🏭'},
  {id:'lotesFinales',  label:'Lotes Finales', icon:'📋'},
  {id:'reqDiario',     label:'Req. Diario',   icon:'📅'},
  {id:'lastmile',      label:'Last Mile',     icon:'🚚'},
  {id:'graficas',      label:'Gráficas',      icon:'📈'},
  {id:'invSemanal',    label:'Inv. Semanal',  icon:'🗃️'},
];

/* ─── persistence ─── */
function _bdgLoad(){
  try{_bdgTabOrder=JSON.parse(localStorage.getItem('kc_bdg_order')||'null');}catch{}
  try{_bdgFilter=JSON.parse(localStorage.getItem('kc_bdg_filter')||'{}');}catch{}
  try{_bdgZoom=parseInt(localStorage.getItem('kc_bdg_zoom')||'100');}catch{}
  try{
    const raw=JSON.parse(localStorage.getItem('kc_bdg_col')||'{}');
    Object.keys(raw).forEach(k=>_bdgColHidden[k]=new Set(raw[k]));
  }catch{}
}
function _bdgSaveOrder(){ localStorage.setItem('kc_bdg_order',JSON.stringify(_bdgTabOrder)); }

/* ─── filter save + auto-push (debounced 1.5 s) ─── */
function _bdgSaveFilter(){
  localStorage.setItem('kc_bdg_filter',JSON.stringify(_bdgFilter));
  if(!(SESSION&&SESSION.role==='superadmin'))return;
  _bdgSetPubStatus('⏳ Guardando…');
  clearTimeout(_bdgFilterPushTimer);
  _bdgFilterPushTimer=setTimeout(()=>bdgPublishFilter(true),1500);
}
function _bdgSetPubStatus(msg){
  const el=document.getElementById('bdg-pub-status');
  if(!el)return;
  el.textContent=msg;
  el.style.display='inline-flex';
  clearTimeout(el._t);
  el._t=setTimeout(()=>{el.style.display='none';},5000);
}

/* ─── GH filter fetch / push ─── */
async function _fetchFilterFromGH(){
  const cfg=GH_REPO_CFG;
  if(!cfg.owner||!cfg.repo)return null;
  try{
    const r=await fetch(`https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch||'main'}/${GH_FILTER_PATH}?_=${Date.now()}`,{cache:'no-store'});
    if(r.ok)return await r.json();
  }catch{}
  return null;
}
async function bdgPublishFilter(auto=false){
  const cfg=getGHCfg();
  if(!cfg.token){if(!auto)showToast('⚠️ Token de GitHub requerido');return;}
  const url=`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${GH_FILTER_PATH}`;
  const h={Authorization:`token ${cfg.token}`,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'};
  let sha=null;
  try{const r=await fetch(url,{headers:h});if(r.ok){const j=await r.json();sha=j.sha;}}catch{}
  const b64=btoa(unescape(encodeURIComponent(JSON.stringify(_bdgFilter,null,2))));
  const body={message:`Update bodega filter — ${new Date().toLocaleString('es-EC')}`,content:b64,branch:cfg.branch||'main'};
  if(sha)body.sha=sha;
  try{
    const r=await fetch(url,{method:'PUT',headers:h,body:JSON.stringify(body)});
    if(r.ok){ _bdgSetPubStatus('✓ Publicado'); if(!auto)showToast('✅ Filtro publicado'); }
    else _bdgSetPubStatus('✗ Error al guardar');
  }catch(e){_bdgSetPubStatus('✗ '+e.message);}
}

/* ─── non-superadmin polling (every 20 s) ─── */
function _bdgStartPolling(){
  clearInterval(_bdgPollTimer);
  _bdgPollTimer=setInterval(async()=>{
    if(typeof currentPage!=='undefined'&&currentPage!=='bodega')return;
    if(!_bodegaData)return;
    const ghF=await _fetchFilterFromGH();
    if(ghF&&JSON.stringify(ghF)!==JSON.stringify(_bdgFilter)){
      _bdgFilter=ghF;
      renderBodegaView(_bodegaView);
      _updateFilterPanel(_bodegaView);
    }
  },20000);
}

/* ─── visible tabs ─── */
function _bdgGetTabs(){
  const canInv=!!SESSION; // visible to all authenticated users
  let tabs=BDG_TABS.filter(t=>t.id==='invSemanal'?canInv:true);
  if(_bdgTabOrder&&_bdgTabOrder.length){
    tabs=[...tabs].sort((a,b)=>{
      const ai=_bdgTabOrder.indexOf(a.id),bi=_bdgTabOrder.indexOf(b.id);
      if(ai<0&&bi<0)return 0;if(ai<0)return 1;if(bi<0)return -1;return ai-bi;
    });
  }
  return tabs;
}

/* ─── MAIN LOAD ─── */
async function loadBodega(){
  _bdgLoad();
  // Restore last active sub-tab (survives F5)
  const _savedTab = sessionStorage.getItem('kc_last_bdg_tab');
  if(_savedTab) _bodegaView = _savedTab;
  const wrap=document.getElementById('bodega-content');
  if(!wrap)return;
  wrap.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;height:100%;gap:14px;color:#94A3B8">
    <div style="width:28px;height:28px;border:3px solid #E2E8F0;border-top-color:var(--orange);border-radius:50%;animation:bdgSpin .8s linear infinite"></div>
    <div style="font-size:13px;font-weight:600">Cargando datos…</div></div>`;
  try{_bodegaData=await fetchBodegaFromGitHub();}catch{_bodegaData=null;}
  if(!_bodegaData){
    wrap.innerHTML=`<div class="bdg-empty"><div class="bdg-empty-icon">📦</div>
      <div class="bdg-empty-msg">Sin datos de bodega</div>
      <div class="bdg-empty-hint">Ejecuta <strong>sync-bodega.bat</strong> para sincronizar desde Excel.</div></div>`;
    _renderToolbar();_ensureFilterPanel();return;
  }
  if(!SESSION||SESSION.role!=='superadmin'){
    const ghF=await _fetchFilterFromGH();
    if(ghF)_bdgFilter=ghF;
    _bdgStartPolling();
  }
  renderBodegaTabs();
  _renderToolbar();
  _ensureFilterPanel();
  _applyZoom();
  renderBodegaView(_bodegaView);
}

/* ─── tabs bar ─── */
function renderBodegaTabs(){
  const bar=document.getElementById('bodega-tabs');
  if(!bar)return;
  const isSA=SESSION&&SESSION.role==='superadmin';
  bar.innerHTML=_bdgGetTabs().map(t=>{
    const drag=isSA?`draggable="true" ondragstart="bdgDragStart(event,'${t.id}')" ondragover="bdgDragOver(event)" ondrop="bdgDrop(event,'${t.id}')" ondragleave="bdgDragLeave(event)"`:'' ;
    return`<button class="bdg-tab${t.id===_bodegaView?' active':''}" data-view="${t.id}" onclick="switchBodegaView('${t.id}')" ${drag}>
      ${isSA?'<span class="bdg-drag-handle">⠿</span>':''}
      <span class="bdg-tab-icon">${t.icon}</span>${t.label}</button>`;
  }).join('');
}

/* ─── toolbar ─── */
function _renderToolbar(){
  let bar=document.getElementById('bodega-toolbar');
  if(!bar){
    const pg=document.getElementById('pg-bodega'),body=document.getElementById('bodega-content');
    if(!pg||!body)return;
    bar=document.createElement('div');bar.id='bodega-toolbar';bar.className='bdg-toolbar';
    pg.insertBefore(bar,body);
  }
  const isSA=SESSION&&SESSION.role==='superadmin';
  const upd=_bodegaData&&_bodegaData.updatedAt?_bodegaData.updatedAt:'';
  bar.innerHTML=`
    <div class="bdg-toolbar-left">
      ${upd?`<span class="bdg-upd-tag">🕐 ${upd}</span>`:''}
      ${isSA?`<button class="bdg-filter-btn" id="bdg-filter-btn" onclick="bdgToggleFilterPanel()">⚙️ Filtrar</button>
              <span id="bdg-pub-status" class="bdg-pub-status" style="display:none"></span>`:''}
      <button class="bdg-filter-btn" id="bdg-col-btn" onclick="bdgToggleColPanel()">⊟ Columnas</button>
    </div>
    <div class="bdg-toolbar-right">
      <button class="bdg-filter-btn bdg-email-btn" onclick="openEmailModal()" title="Enviar reporte por correo">✉️ Enviar correo</button>
      <div class="bdg-zoom-ctrl">
        <button class="bdg-zoom-btn" onclick="bdgZoomOut()" title="Reducir">−</button>
        <span id="bdg-zoom-pct" class="bdg-zoom-pct" onclick="bdgZoomFit()" title="100%">${_bdgZoom}%</span>
        <button class="bdg-zoom-btn" onclick="bdgZoomIn()" title="Ampliar">+</button>
        <button class="bdg-zoom-btn bdg-zoom-fit" onclick="bdgZoomFit()" title="Ajustar">⊡</button>
      </div>
    </div>`;
}

/* ─── filter panel (inline below toolbar) ─── */
function _ensureFilterPanel(){
  if(document.getElementById('bdg-filter-panel'))return;
  const pg=document.getElementById('pg-bodega'),body=document.getElementById('bodega-content');
  if(!pg||!body)return;
  const p=document.createElement('div');p.id='bdg-filter-panel';p.className='bdg-filter-panel';
  pg.insertBefore(p,body);
}
function _ensureColPanel(){
  if(document.getElementById('bdg-col-panel'))return;
  const pg=document.getElementById('pg-bodega'),body=document.getElementById('bodega-content');
  if(!pg||!body)return;
  const p=document.createElement('div');p.id='bdg-col-panel';p.className='bdg-filter-panel';
  pg.insertBefore(p,body);
}
function bdgToggleFilterPanel(){
  _bdgFilterOpen=!_bdgFilterOpen;
  const p=document.getElementById('bdg-filter-panel');
  if(p)p.classList.toggle('open',_bdgFilterOpen);
  if(_bdgFilterOpen)_updateFilterPanel(_bodegaView);
}
function _updateFilterPanel(viewId){
  const p=document.getElementById('bdg-filter-panel');
  const btn=document.getElementById('bdg-filter-btn');
  if(!p||!_bdgFilterOpen)return;
  const all=_bdgGetProdsForView(viewId);
  if(!all.length){
    p.innerHTML='<div style="padding:8px 16px;font-size:11px;color:#94A3B8">No hay productos filtrables en esta vista.</div>';
    if(btn)btn.innerHTML='⚙️ Filtrar';return;
  }
  const hidden=new Set(_bdgFilter[viewId]||[]);
  const vis=all.length-hidden.size;
  const chips=all.map(pr=>{
    const h=hidden.has(pr),s=pr.replace(/'/g,"\\'").replace(/"/g,'&quot;');
    return`<label class="bdg-fchip${h?' bdg-fchip--off':''}"><input type="checkbox" ${h?'':'checked'} onchange="bdgToggleProd('${viewId}','${s}',this.checked)" style="display:none">${pr}</label>`;
  }).join('');
  p.innerHTML=`<div class="bdg-fchips">${chips}</div>`;
  if(btn)btn.innerHTML=`⚙️ Filtrar <span class="bdg-fbadge">${vis}/${all.length}</span>`;
}
function _bdgGetProdsForView(viewId){
  if(!_bodegaData)return[];
  const m={cobertura:'cobertura',abastecimiento:'abastecimiento',proveedores:'proveedores',lotesFinales:'lotesFinales',reqDiario:'requerimientoDiario',invSemanal:'inventario'};
  return(_bodegaData[m[viewId]]||[]).map(r=>r.producto).filter(Boolean);
}

/* ── COLUMN FILTER ── */
function _getViewColDefs(viewId){
  if(!_bodegaData)return[];
  const lbls=_bodegaData.diaLabels||[];
  let nd=0;
  if(viewId==='cobertura'){
    const r=(_bodegaData.cobertura||[]).find(r=>Array.isArray(r.porDia)&&r.porDia.length);
    nd=r?r.porDia.length:0;
  } else if(viewId==='reqDiario'){
    const rows=_bodegaData.requerimientoDiario||[];
    nd=rows.length?Math.max(...rows.map(r=>(r.dias||[]).length)):0;
  }
  const days=Array.from({length:nd},(_,i)=>{
    const raw=lbls[i]||'';
    const m2=raw.match(/^D\d+_([A-Za-zÁÉÍÓÚáéíóúÜü]+)(\d+)$/);
    return{id:`dia${i+1}`,label:m2?`D${i+1} · ${m2[1]}${m2[2]}`:`D${i+1}`};
  });
  if(viewId==='cobertura') return[
    {id:'ingresos',  label:'Ingresos'},
    {id:'req',       label:'Req.'},
    {id:'saldo',     label:'Saldo'},
    ...days,
    {id:'cobertura', label:'Cobertura'},
    {id:'porrecibir',label:'Por Recibir'}
  ];
  if(viewId==='proveedores') return[
    {id:'planificado', label:'Planificado'},
    {id:'ingresos',    label:'Ingresos'},
    {id:'porrecibir',  label:'Por Recibir'},
    {id:'cumplimiento',label:'Cumplimiento'}
  ];
  if(viewId==='reqDiario') return[
    ...days,
    {id:'distributivo',label:'Distributivo'},
    {id:'numDias',     label:'Días'}
  ];
  return[];
}
function bdgToggleColPanel(){
  _bdgColOpen=!_bdgColOpen;
  _ensureColPanel();
  const p=document.getElementById('bdg-col-panel');
  if(p)p.classList.toggle('open',_bdgColOpen);
  if(_bdgColOpen)_updateColPanel(_bodegaView);
}
function _updateColPanel(viewId){
  const p=document.getElementById('bdg-col-panel');
  const btn=document.getElementById('bdg-col-btn');
  if(!p||!_bdgColOpen)return;
  const cols=_getViewColDefs(viewId);
  if(!cols.length){
    p.innerHTML='<div style="padding:6px 16px;font-size:11px;color:#94A3B8">Sin columnas filtrables en esta vista.</div>';
    if(btn)btn.innerHTML='⊟ Columnas';return;
  }
  const hidden=_bdgColHidden[viewId]||new Set();
  const vis=cols.length-hidden.size;
  const chips=cols.map(c=>{
    const off=hidden.has(c.id),s=c.id.replace(/'/g,"\\'");
    return`<label class="bdg-fchip${off?' bdg-fchip--off':''}"><input type="checkbox" ${off?'':'checked'} onchange="bdgToggleCol('${viewId}','${s}',this.checked)" style="display:none">${c.label}</label>`;
  }).join('');
  p.innerHTML=`<div class="bdg-fchips">${chips}</div>`;
  if(btn)btn.innerHTML=`⊟ Columnas <span class="bdg-fbadge">${vis}/${cols.length}</span>`;
}
function bdgToggleCol(viewId,colId,visible){
  if(!_bdgColHidden[viewId])_bdgColHidden[viewId]=new Set();
  if(!visible)_bdgColHidden[viewId].add(colId);
  else _bdgColHidden[viewId].delete(colId);
  // persist
  const serial={};
  Object.keys(_bdgColHidden).forEach(k=>serial[k]=[..._bdgColHidden[k]]);
  localStorage.setItem('kc_bdg_col',JSON.stringify(serial));
  _applyColHidden(viewId);
  _updateColPanel(viewId);
}
function _applyColHidden(viewId){
  const hidden=_bdgColHidden[viewId]||new Set();
  const content=document.getElementById('bodega-content');
  if(!content)return;
  content.querySelectorAll('[data-col]').forEach(el=>{
    el.style.display=hidden.has(el.dataset.col)?'none':'';
  });
}

/* ─── zoom ─── */
function bdgZoomIn(){_bdgZoom=Math.min(200,_bdgZoom+10);_applyZoom();}
function bdgZoomOut(){_bdgZoom=Math.max(50,_bdgZoom-10);_applyZoom();}
function bdgZoomFit(){_bdgZoom=100;_applyZoom();}
function _applyZoom(){
  localStorage.setItem('kc_bdg_zoom',String(_bdgZoom));
  const b=document.getElementById('bodega-content');
  if(b){b.style.zoom=_bdgZoom+'%';b.style.overflow=_bdgZoom>100?'auto':'hidden';}
  const p=document.getElementById('bdg-zoom-pct');
  if(p)p.textContent=_bdgZoom+'%';
}

/* ─── switch view ─── */
function switchBodegaView(v){
  _bodegaView=v;
  sessionStorage.setItem('kc_last_bdg_tab', v);  // remember sub-tab for F5
  document.querySelectorAll('.bdg-tab').forEach(t=>t.classList.toggle('active',t.dataset.view===v));
  _updateFilterPanel(v);
  renderBodegaView(v);
}
function renderBodegaView(v){
  const w=document.getElementById('bodega-content');
  if(!w||!_bodegaData)return;
  const d=_bodegaData;
  switch(v){
    case'cobertura':     w.innerHTML=renderCobertura(d);break;
    case'abastecimiento':w.innerHTML=renderAbastecimiento(d);break;
    case'proveedores':   w.innerHTML=renderProveedores(d);break;
    case'lotesFinales':  w.innerHTML=renderLotesFinales(d);break;
    case'reqDiario':     w.innerHTML=renderReqDiario(d);break;
    /* falls through to default for other views */
    case'lastmile':      w.innerHTML=renderLastMile(d);break;
    case'graficas':      w.innerHTML=renderGraficas(d);break;
    case'invSemanal':    w.innerHTML=renderInvSemanal(d);break;
    default:w.innerHTML='<div class="bdg-empty"><div class="bdg-empty-msg">Vista no disponible</div></div>';
  }
  // apply column visibility and update col panel badge
  _applyColHidden(v);
  if(_bdgColOpen)_updateColPanel(v);
}

/* ─── drag & drop ─── */
function bdgDragStart(e,id){_bdgDragTab=id;e.currentTarget.classList.add('bdg-tab--dragging');e.dataTransfer.effectAllowed='move';}
function bdgDragOver(e){e.preventDefault();e.currentTarget.classList.add('bdg-tab--dragover');e.dataTransfer.dropEffect='move';}
function bdgDragLeave(e){e.currentTarget.classList.remove('bdg-tab--dragover');}
function bdgDrop(e,tid){
  e.preventDefault();e.currentTarget.classList.remove('bdg-tab--dragover');
  if(!_bdgDragTab||_bdgDragTab===tid)return;
  const tabs=_bdgGetTabs(),order=tabs.map(t=>t.id);
  const fi=order.indexOf(_bdgDragTab),ti=order.indexOf(tid);
  if(fi<0||ti<0)return;
  order.splice(fi,1);order.splice(ti,0,_bdgDragTab);
  _bdgTabOrder=order;_bdgDragTab=null;_bdgSaveOrder();renderBodegaTabs();
}

/* ─── filter row apply ─── */
function _bdgRows(viewId,rows,key='producto'){
  const h=_bdgFilter[viewId]||[];
  return h.length?rows.filter(r=>!h.includes(r[key])):rows;
}
function bdgToggleProd(viewId,product,visible){
  if(!_bdgFilter[viewId])_bdgFilter[viewId]=[];
  _bdgFilter[viewId]=visible?_bdgFilter[viewId].filter(p=>p!==product):[..._bdgFilter[viewId].filter(p=>p!==product),product];
  _bdgSaveFilter();
  _updateFilterPanel(viewId);
  renderBodegaView(_bodegaView);
}

/* ─── row selection ─── */
function bdgSelRow(tr){
  document.querySelectorAll('#bodega-content .bdg-row-sel').forEach(r=>r.classList.remove('bdg-row-sel'));
  tr.classList.add('bdg-row-sel');
}

/* ═══════════ HELPERS ═══════════ */
function _N(n,d=0){if(n==null||n===''||isNaN(Number(n)))return'—';return Number(n).toLocaleString('es-EC',{minimumFractionDigits:d,maximumFractionDigits:d});}
function _P(v){if(v==null||isNaN(Number(v)))return'—';return(Number(v)*100).toFixed(1)+'%';}
function _C(v){const p=Number(v)*100;if(p>=95)return{bg:'#DCFCE7',fg:'#166534',bar:'#1F9D55'};if(p>=70)return{bg:'#FEF3C7',fg:'#92400E',bar:'#D97706'};return{bg:'#FEE2E2',fg:'#991B1B',bar:'#EF4444'};}
function _badge(v){const c=_C(v);return`<span class="bdg-badge" style="background:${c.bg};color:${c.fg}">${_P(v)}</span>`;}
function _bar(pct,col,h=5){const w=Math.min(100,Math.max(0,Number(pct||0)*100));return`<div class="bdg-bar-track" style="height:${h}px"><div style="width:${w}%;background:${col||_C(pct).bar};height:100%;border-radius:999px"></div></div>`;}

/* ── SVG Pie ── */
function _pie(received,total,title,dec=0){
  if(!total||total<=0)return`<div class="bdg-chart-card"><div class="bdg-chart-title">${title}</div><div style="text-align:center;padding:28px 0;color:#94A3B8;font-size:11px">Sin datos</div></div>`;
  const pct=Math.min(1,Math.max(0,received/total));
  const pending=total-received;
  const r=48,cx=60,cy=58;
  let ap='',bp='';
  if(pct>=1){ap=`M ${cx},${cy-r} A ${r},${r} 0 1,1 ${cx-0.01},${cy-r} Z`;}
  else if(pct<=0){bp=`M ${cx},${cy-r} A ${r},${r} 0 1,1 ${cx-0.01},${cy-r} Z`;}
  else{
    const angle=pct*2*Math.PI;
    const sx=(cx+r*Math.sin(0)).toFixed(2),sy=(cy-r*Math.cos(0)).toFixed(2);
    const ex=(cx+r*Math.sin(angle)).toFixed(2),ey=(cy-r*Math.cos(angle)).toFixed(2);
    const la=pct>0.5?1:0;
    ap=`M ${cx},${cy} L ${sx},${sy} A ${r},${r} 0 ${la},1 ${ex},${ey} Z`;
    bp=`M ${cx},${cy} L ${ex},${ey} A ${r},${r} 0 ${1-la},1 ${sx},${sy} Z`;
  }
  const v1=dec>0?Number(received).toFixed(dec):_N(received);
  const v2=dec>0?Number(pending).toFixed(dec):_N(pending);
  return`<div class="bdg-chart-card">
    <div class="bdg-chart-title">${title}</div>
    <svg viewBox="0 0 120 116" width="100%" style="display:block;max-width:110px;margin:0 auto">
      ${bp?`<path d="${bp}" fill="#C8DCF0"/>`:''}
      ${ap?`<path d="${ap}" fill="#2574A9"/>`:''}
    </svg>
    <div style="text-align:center;font-size:15px;font-weight:800;color:#1E293B;margin:1px 0 2px">${(pct*100).toFixed(2)}%</div>
    <div class="bdg-chart-legend"><span style="color:#2574A9">● ${v1}</span><span style="color:#7BAACC">● ${v2}</span></div>
  </div>`;
}

/* ── SVG Bar Chart (responsive, no scrollbar) ── */
function _barChart(data,title,dec=0,barColor='#2574A9'){
  if(!data.length)return'';
  const max=Math.max(...data.map(d=>d.value),1);
  const n=data.length,bW=28,gap=8,topH=16,botH=18,barMax=80;
  const vbW=n*(bW+gap)-gap+20,vbH=topH+barMax+botH;
  const bars=data.map((d,i)=>{
    const h=Math.max(2,Math.round((d.value/max)*barMax));
    const x=10+i*(bW+gap),y=topH+(barMax-h);
    const val=dec>0?Number(d.value).toFixed(dec):_N(d.value);
    return`<g>
      <text x="${x+bW/2}" y="${y-3}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#1E293B" font-family="Segoe UI,sans-serif">${val}</text>
      <rect x="${x}" y="${y}" width="${bW}" height="${h}" fill="${barColor}" rx="3"/>
      <text x="${x+bW/2}" y="${vbH-2}" text-anchor="middle" font-size="8" fill="#94A3B8" font-family="Segoe UI,sans-serif">${d.label}</text>
    </g>`;
  }).join('');
  return`<div class="bdg-chart-card bdg-chart-wide">
    <div class="bdg-chart-title">${title}</div>
    <svg viewBox="0 0 ${vbW} ${vbH}" width="100%" style="display:block" preserveAspectRatio="xMidYMid meet">${bars}</svg>
  </div>`;
}

/* ── Horizontal Bar (Inventario) — HTML/CSS (no SVG scaling issues) ── */
function _hbarChart(rows){
  if(!rows.length)return'';
  const vals=rows.filter(r=>r.ajuste!=null&&!isNaN(Number(r.ajuste)))
               .slice().sort((a,b)=>Math.abs(Number(b.ajuste))-Math.abs(Number(a.ajuste)));
  if(!vals.length)return'';
  const mx=Math.abs(Number(vals[0].ajuste))||1;
  const items=vals.map(r=>{
    const v=Number(r.ajuste),neg=v<0;
    const pct=Math.max(0.5,Math.round(Math.abs(v)/mx*100));
    const col=neg?'#F47C20':'#3D8EB9';
    const track=neg?'rgba(244,124,32,.1)':'rgba(61,142,185,.1)';
    return`<div style="display:flex;align-items:center;gap:10px;padding:3px 0">
      <div style="flex:0 0 34%;min-width:0;text-align:right;font-size:11px;font-weight:600;
                  color:#1E293B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
           title="${(r.producto||'').replace(/"/g,'&quot;')}">${r.producto||'—'}</div>
      <div style="flex:1;height:24px;background:${track};border-radius:5px;overflow:hidden;min-width:0">
        <div style="width:${pct}%;height:100%;background:${col};border-radius:5px;
                    transition:width .45s cubic-bezier(.2,.8,.3,1)"></div>
      </div>
      <div style="flex:0 0 62px;text-align:right;font-size:11.5px;font-weight:700;color:${col};
                  white-space:nowrap">${_N(v)}</div>
    </div>`;
  }).join('');
  return`<div class="bdg-tbl-wrap" style="padding:16px 20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div class="bdg-chart-title" style="text-align:left;margin:0">AJUSTE DE INVENTARIO</div>
      <div style="display:flex;gap:14px;font-size:10px;color:#64748B;margin-left:auto">
        <span style="display:flex;align-items:center;gap:4px">
          <span style="display:inline-block;width:10px;height:10px;background:#3D8EB9;border-radius:2px"></span>Positivo
        </span>
        <span style="display:flex;align-items:center;gap:4px">
          <span style="display:inline-block;width:10px;height:10px;background:#F47C20;border-radius:2px"></span>Negativo
        </span>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:2px">${items}</div>
  </div>`;
}

/* ─── sub-label ─── */
function _subLabel(t){return`<div class="bdg-sub-label">${t}</div>`;}

/* ═══════════ VIEWS ═══════════ */

/* ── 1. COBERTURA ── */
function renderCobertura(d){
  const all=d.cobertura||[];
  if(!all.length)return`<div class="bdg-empty"><div class="bdg-empty-icon">📊</div><div class="bdg-empty-msg">Sin datos de cobertura</div></div>`;
  const rows=_bdgRows('cobertura',all);
  const totIng=rows.reduce((a,r)=>a+(r.ingresos||0),0),totReq=rows.reduce((a,r)=>a+(r.totalReq||0),0);
  const _rawGlob=totReq>0?totIng/totReq:0;
  const glob=(_rawGlob>=1&&rows.some(r=>(r.pct||0)<1))?0.99:_rawGlob,cg=_C(glob);
  const nd=(rows.find(r=>Array.isArray(r.porDia)&&r.porDia.length)||{}).porDia?.length||0;
  const _lbls=d.diaLabels||[];
  const dayTh=Array.from({length:nd},(_,i)=>`<th class="bdg-day-th" title="${_lbls[i]||'D'+(i+1)}">${_diaThHtml(_lbls,i)}</th>`).join('');
  const trs=rows.map((r,ri)=>{
    const c=_C(r.pct),neg=(r.saldo||0)<0,negR=(r.porRecibir||0)<0;
    const dias=Array.isArray(r.porDia)?r.porDia:[];
    const dCells=Array.from({length:nd},(_,i)=>{
      const v=dias[i];if(v==null)return`<td class="r bdg-day-td" data-col="dia${i+1}" style="color:#CBD5E1">—</td>`;
      return`<td class="r bdg-day-td${Number(v)<0?' neg':''}" data-col="dia${i+1}">${_N(v)}</td>`;
    }).join('');
    const delay=`animation-delay:${Math.min(ri,14)*45}ms`;
    return`<tr onclick="bdgSelRow(this)" style="${delay}">
      <td class="bdg-sticky-col" style="font-weight:600">${r.producto||'—'}</td>
      <td class="r" data-col="ingresos">${_N(r.ingresos)}</td>
      <td class="r" data-col="req">${_N(r.totalReq)}</td>
      <td class="r${neg?' neg':''}" data-col="saldo">${_N(r.saldo)}</td>${dCells}
      <td data-col="cobertura" style="min-width:120px"><div style="display:flex;align-items:center;gap:5px">${_badge(r.pct)}<div style="flex:1">${_bar(r.pct,c.bar,4)}</div></div></td>
      <td class="r${negR?' neg':''}" data-col="porrecibir">${_N(r.porRecibir)}</td>
    </tr>`;
  }).join('');
  return`<div class="bdg-section">
    <div class="bdg-kpis">
      <div class="bdg-kpi bdg-kpi--blue"><div class="bdg-kpi-lbl">Total ingresos</div><div class="bdg-kpi-val">${_N(totIng)}</div></div>
      <div class="bdg-kpi"><div class="bdg-kpi-lbl">Total requerido</div><div class="bdg-kpi-val">${_N(totReq)}</div></div>
      <div class="bdg-kpi bdg-kpi--orange"><div class="bdg-kpi-lbl">Cobertura global</div><div class="bdg-kpi-val" style="color:${cg.fg}">${_P(glob)}</div></div>
      <div class="bdg-kpi"><div class="bdg-kpi-lbl">Productos</div><div class="bdg-kpi-val">${rows.length}</div></div>
    </div>
    <div class="bdg-tbl-wrap"><table class="bdg-tbl">
      <thead><tr>
        <th class="bdg-sticky-col">Producto</th>
        <th class="r" data-col="ingresos">Ingresos</th>
        <th class="r" data-col="req">Req.</th>
        <th class="r" data-col="saldo">Saldo</th>
        ${dayTh}
        <th data-col="cobertura">Cobertura</th>
        <th class="r" data-col="porrecibir">Por recibir</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table></div>
  </div>`;
}

/* ── 2. ABASTECIMIENTO ── */
function renderAbastecimiento(d){
  const all=d.abastecimiento||[];
  if(!all.length)return`<div class="bdg-empty"><div class="bdg-empty-icon">🔄</div><div class="bdg-empty-msg">Sin datos de abastecimiento</div></div>`;
  const rows=_bdgRows('abastecimiento',all);
  const ok=rows.filter(r=>(r.pct||0)>=1).length,med=rows.filter(r=>(r.pct||0)>=0.7&&(r.pct||0)<1).length,crit=rows.filter(r=>(r.pct||0)<0.7).length;
  const cards=rows.map(r=>{
    const c=_C(r.pct),p=Math.min(100,Math.max(0,(r.pct||0)*100));
    return`<div class="bdg-card" style="border-left:4px solid ${c.bar}">
      <div class="bdg-card-name">${r.producto||'—'}</div>
      <div class="bdg-card-pct" style="color:${c.fg}">${_P(r.pct)}</div>
      <div class="bdg-bar-track" style="height:6px"><div style="width:${p}%;background:${c.bar};height:100%;border-radius:999px"></div></div>
      <div class="bdg-card-detail">
        <span>Ing: <strong>${_N(r.ingresos)}</strong></span>
        <span>Req: <strong>${_N(r.totalReq)}</strong></span>
        <span style="color:${(r.porRecibir||0)<0?'#EF4444':'#64748B'}">Saldo: <strong>${_N(r.porRecibir)}</strong></span>
      </div>
    </div>`;
  }).join('');
  return`<div class="bdg-section">
    <div class="bdg-kpis">
      <div class="bdg-kpi bdg-kpi--green"><div class="bdg-kpi-lbl">Completados ≥100%</div><div class="bdg-kpi-val">${ok}</div></div>
      <div class="bdg-kpi bdg-kpi--orange"><div class="bdg-kpi-lbl">En proceso 70–99%</div><div class="bdg-kpi-val">${med}</div></div>
      <div class="bdg-kpi bdg-kpi--red"><div class="bdg-kpi-lbl">Críticos &lt;70%</div><div class="bdg-kpi-val">${crit}</div></div>
      <div class="bdg-kpi"><div class="bdg-kpi-lbl">Total productos</div><div class="bdg-kpi-val">${rows.length}</div></div>
    </div>
    <div class="bdg-card-grid">${cards}</div>
  </div>`;
}

/* ── 3. PROVEEDORES ── */
function renderProveedores(d){
  const all=d.proveedores||[];
  if(!all.length)return`<div class="bdg-empty"><div class="bdg-empty-icon">🏭</div><div class="bdg-empty-msg">Sin datos de proveedores</div></div>`;
  const rows=_bdgRows('proveedores',all);
  const totP=rows.reduce((a,r)=>a+(r.planificado||0),0),totI=rows.reduce((a,r)=>a+(r.ingresos||0),0);
  const _rawGlobP=totP>0?totI/totP:0;
  const glob=(_rawGlobP>=1&&rows.some(r=>(r.pct||0)<1))?0.99:_rawGlobP;
  const totPR=rows.reduce((a,r)=>a+(r.porRecibir||0),0);
  const trs=rows.map(r=>{
    const c=_C(r.pct),negPR=(r.porRecibir||0)<0;
    return`<tr onclick="bdgSelRow(this)">
      <td class="bdg-sticky-col" style="font-weight:600">${r.producto||'—'}</td>
      <td class="r" data-col="planificado">${_N(r.planificado)}</td>
      <td class="r" data-col="ingresos">${_N(r.ingresos)}</td>
      <td class="r${negPR?' neg':''}" data-col="porrecibir">${_N(r.porRecibir)}</td>
      <td data-col="cumplimiento" style="min-width:160px"><div style="display:flex;flex-direction:column;gap:3px">
        <div style="display:flex;align-items:center;justify-content:space-between">${_badge(r.pct)}<span style="font-size:10px;color:#64748B">${_N(r.ingresos)} / ${_N(r.planificado)}</span></div>
        ${_bar(r.pct,c.bar,6)}
      </div></td>
    </tr>`;
  }).join('');
  return`<div class="bdg-section">
    <div class="bdg-kpis">
      <div class="bdg-kpi bdg-kpi--blue"><div class="bdg-kpi-lbl">Total planificado</div><div class="bdg-kpi-val">${_N(totP)}</div></div>
      <div class="bdg-kpi bdg-kpi--green"><div class="bdg-kpi-lbl">Total ingresos</div><div class="bdg-kpi-val">${_N(totI)}</div></div>
      <div class="bdg-kpi bdg-kpi--orange"><div class="bdg-kpi-lbl">Cumplimiento global</div><div class="bdg-kpi-val" style="color:${_C(glob).fg}">${_P(glob)}</div></div>
      <div class="bdg-kpi${totPR<0?' bdg-kpi--red':''}"><div class="bdg-kpi-lbl">Por recibir</div><div class="bdg-kpi-val">${_N(totPR)}</div></div>
    </div>
    <div class="bdg-tbl-wrap"><table class="bdg-tbl">
      <thead><tr>
        <th class="bdg-sticky-col">Proveedor / Producto</th>
        <th class="r" data-col="planificado">Planificado</th>
        <th class="r" data-col="ingresos">Ingresos</th>
        <th class="r" data-col="porrecibir">Por recibir</th>
        <th data-col="cumplimiento">Cumplimiento</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table></div>
  </div>`;
}

/* ── 4. LOTES FINALES ── */
function renderLotesFinales(d){
  const all=d.lotesFinales||[];
  if(!all.length)return`<div class="bdg-empty"><div class="bdg-empty-icon">📋</div><div class="bdg-empty-msg">Sin datos de lotes finales</div></div>`;
  const rows=_bdgRows('lotesFinales',all);
  const ok=rows.filter(r=>(r.pct||0)>=1).length,crit=rows.filter(r=>(r.pct||0)<0.7).length;
  const trs=rows.map(r=>{
    const c=_C(r.pct),neg=(r.porRecibir||0)<0;
    return`<tr onclick="bdgSelRow(this)">
      <td class="bdg-sticky-col" style="font-weight:600">${r.producto||'—'}</td>
      <td class="r${neg?' neg':''}">${_N(r.porRecibir)}</td>
      <td style="min-width:150px"><div style="display:flex;align-items:center;gap:7px">${_badge(r.pct)}<div style="flex:1">${_bar(r.pct,c.bar,5)}</div></div></td>
      <td style="font-size:11px;color:#64748B">${r.lotes&&r.lotes!=='—'&&r.lotes!=='-'?r.lotes:'—'}</td>
    </tr>`;
  }).join('');
  return`<div class="bdg-section">
    <div class="bdg-kpis">
      <div class="bdg-kpi bdg-kpi--green"><div class="bdg-kpi-lbl">Completados ≥100%</div><div class="bdg-kpi-val">${ok}</div></div>
      <div class="bdg-kpi bdg-kpi--red"><div class="bdg-kpi-lbl">Críticos &lt;70%</div><div class="bdg-kpi-val">${crit}</div></div>
      <div class="bdg-kpi"><div class="bdg-kpi-lbl">Total productos</div><div class="bdg-kpi-val">${rows.length}</div></div>
    </div>
    <div class="bdg-tbl-wrap"><table class="bdg-tbl">
      <thead><tr><th class="bdg-sticky-col">Producto</th><th class="r">Por recibir</th><th>Cobertura</th><th>Lotes</th></tr></thead>
      <tbody>${trs}</tbody>
    </table></div>
  </div>`;
}

/* ── 5. REQUERIMIENTO DIARIO ── */
function renderReqDiario(d){
  const all=d.requerimientoDiario||[];
  if(!all.length)return`<div class="bdg-empty"><div class="bdg-empty-icon">📅</div><div class="bdg-empty-msg">Sin datos de requerimiento diario</div></div>`;
  const rows=_bdgRows('reqDiario',all);
  const nd=rows.length?Math.max(...rows.map(r=>(r.dias||[]).length),0):0;
  const _lbls2=d.diaLabels||[];
  const dayTh=Array.from({length:nd},(_,i)=>`<th class="bdg-day-th" title="${_lbls2[i]||'D'+(i+1)}">${_diaThHtml(_lbls2,i)}</th>`).join('');
  const trs=rows.map((r,ri)=>{
    const dias=Array.isArray(r.dias)?r.dias:[];
    const dCells=Array.from({length:nd},(_,i)=>{
      const v=dias[i];if(v==null||v==='')return`<td class="r bdg-day-td" data-col="dia${i+1}" style="color:#CBD5E1">—</td>`;
      return`<td class="r bdg-day-td" data-col="dia${i+1}">${_N(v)}</td>`;
    }).join('');
    const delay=`animation-delay:${Math.min(ri,14)*45}ms`;
    return`<tr onclick="bdgSelRow(this)" style="${delay}">
      <td class="bdg-sticky-col" style="font-weight:600">${r.producto||'—'}</td>
      ${dCells}
      <td class="r" data-col="distributivo" style="font-weight:700;color:var(--orange)">${_N(r.distributivo)}</td>
      <td class="r" data-col="numDias">${r.numDias||'—'}</td>
    </tr>`;
  }).join('');
  return`<div class="bdg-section">
    <div class="bdg-tbl-wrap"><table class="bdg-tbl">
      <thead><tr>
        <th class="bdg-sticky-col">Producto</th>${dayTh}
        <th class="r" data-col="distributivo">Distributivo</th>
        <th class="r" data-col="numDias">Días</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table></div>
  </div>`;
}

/* ── 6. LAST MILE ── */
function renderLastMile(d){
  const lm=d.lastmile||{};

  /* ── Tabla 1: Errores por transportista ── */
  // Exclude fallback bucket names (B1, B2 … B15) — empty Excel header cells
  const _lmValKeys = r => Object.keys(r).filter(k=>k!=='transportista'&&!/^B\d+$/.test(k));
  const _lmHasData = r => _lmValKeys(r).some(k=>{const v=Number(r[k]);return r[k]!=null&&r[k]!==''&&!isNaN(v)&&v!==0;});

  const pivot=(Array.isArray(lm.pivot)?lm.pivot:[])
    .filter(r=>r.transportista&&!/^total/i.test(r.transportista.trim()))
    .filter(_lmHasData);   // ← ocultar filas completamente vacías
  let errHtml='';
  if(pivot.length){
    const valKeys=_lmValKeys(pivot[0]);
    errHtml=`
    ${_subLabel('ERRORES POR TRANSPORTISTA')}
    <div class="bdg-tbl-wrap"><table class="bdg-tbl bdg-tbl--compact">
      <thead><tr>
        <th class="bdg-sticky-col">Transportista</th>
        ${valKeys.map(k=>`<th class="r">${k}</th>`).join('')}
      </tr></thead>
      <tbody>${pivot.map((r,ri)=>{
        const delay=`animation-delay:${Math.min(ri,14)*40}ms`;
        return`<tr onclick="bdgSelRow(this)" style="${delay}">
          <td class="bdg-sticky-col" style="font-weight:600">${r.transportista||''}</td>
          ${valKeys.map(k=>{
            const v=Number(r[k]);
            if(r[k]==null||r[k]===''||isNaN(v)||v===0) return`<td class="r"></td>`;
            return`<td class="r neg">${_N(v)}</td>`;
          }).join('')}
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  }

  /* ── Gráfico SVG: Transportistas por día (lm_resumen — META vs VALIDACIÓN) ── */
  const res=(Array.isArray(lm.resumen)?lm.resumen:[]).filter(r=>r.etiqueta!=null);
  let diaHtml='';
  if(res.length){
    const C_META='#3D8EB9', C_VAL='#F47C20';
    const mx=Math.max(...res.map(r=>Math.max(Number(r.cuentaTrans)||0,Number(r.cuentaVal)||0)),1);
    const n=res.length;
    const bW=28,gap=5,grpGap=22,topH=22,botH=28,barMax=160;
    const grpW=bW*2+gap;
    const vbW=n*(grpW+grpGap)-grpGap+40;
    const vbH=topH+barMax+botH;
    const bars=res.map((r,i)=>{
      const meta=Number(r.cuentaTrans)||0,val=Number(r.cuentaVal)||0;
      const hm=Math.max(2,Math.round(meta/mx*barMax));
      const hv=Math.max(2,Math.round(val/mx*barMax));
      const x=20+i*(grpW+grpGap);
      const xm=x,xv=x+bW+gap;
      const ym=topH+(barMax-hm),yv=topH+(barMax-hv);
      return`<g>
        <text x="${xm+bW/2}" y="${ym-5}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#1E293B" font-family="Segoe UI,sans-serif">${meta||''}</text>
        <rect x="${xm}" y="${ym}" width="${bW}" height="${hm}" fill="${C_META}" rx="3"/>
        <text x="${xv+bW/2}" y="${yv-5}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#1E293B" font-family="Segoe UI,sans-serif">${val||''}</text>
        <rect x="${xv}" y="${yv}" width="${bW}" height="${hv}" fill="${C_VAL}" rx="3"/>
        <text x="${x+grpW/2}" y="${vbH-6}" text-anchor="middle" font-size="9.5" fill="#64748B" font-family="Segoe UI,sans-serif" font-weight="600">${r.etiqueta}</text>
      </g>`;
    }).join('');
    diaHtml=`
    ${_subLabel('TRANSPORTISTAS POR DÍA')}
    <div class="bdg-chart-card bdg-chart-wide bdg-lm-chart">
      <div style="display:flex;gap:18px;font-size:11px;color:#64748B;margin-bottom:6px;justify-content:center">
        <span style="display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:13px;height:13px;background:${C_META};border-radius:3px"></span><strong>META</strong></span>
        <span style="display:flex;align-items:center;gap:5px"><span style="display:inline-block;width:13px;height:13px;background:${C_VAL};border-radius:3px"></span><strong>VALIDACIÓN</strong></span>
      </div>
      <svg viewBox="0 0 ${vbW} ${vbH}" width="100%" style="display:block;flex:1;min-height:0" preserveAspectRatio="xMidYMid meet">${bars}</svg>
    </div>`;
  }

  if(!errHtml&&!diaHtml)return`<div class="bdg-empty"><div class="bdg-empty-icon">🚚</div><div class="bdg-empty-msg">Sin datos de Last Mile</div></div>`;
  return`<div class="bdg-section bdg-section--fullh"><div class="bdg-scroll-panel bdg-lm-panel">${errHtml}${diaHtml}</div></div>`;
}

/* ── 7. GRÁFICAS ── */
function renderGraficas(d){
  const notas=d.notasEntrega||{};
  const sc=typeof SCHOOLS!=='undefined'?SCHOOLS:[];
  const totTon=sc.reduce((a,s)=>a+(s.peso_kg||0),0)/1000;
  const despTon=sc.filter(s=>s.estado==='entregada').reduce((a,s)=>a+(s.peso_kg||0),0)/1000;
  const totIE=sc.length,despIE=sc.filter(s=>s.estado==='entregada').length;
  const byDia={};
  sc.forEach(s=>{if(!byDia[s.dia])byDia[s.dia]={inst:0,ton:0};byDia[s.dia].inst++;byDia[s.dia].ton+=(s.peso_kg||0)/1000;});
  const dias=Object.keys(byDia).map(Number).sort((a,b)=>a-b).map(k=>({label:`${k}`,inst:byDia[k].inst,ton:byDia[k].ton}));
  const pie1=_pie(notas.recibidas||0,notas.planificadas||0,'NOTAS RECIBIDAS');
  const pie2=_pie(notas.racionesRecibidas||0,notas.racionesPlanificadas||0,'RACIONES DESPACHADAS');
  const pie3=_pie(despTon,totTon,'TONELADAS DESPACHADAS',2);
  const pie4=_pie(despIE,totIE,'INSTITUCIONES DESPACHADAS');
  const bar1=dias.length?_barChart(dias.map(x=>({label:x.label,value:x.inst})),'INSTITUCIONES POR DÍA',0,'#3D8EB9'):'';
  const bar2=dias.length?_barChart(dias.map(x=>({label:x.label,value:x.ton})),'TONELADAS POR DÍA',2,'#F47C20'):'';
  return`<div class="bdg-section"><div class="bdg-scroll-panel">
    <div class="bdg-pie-grid">${pie1}${pie2}${pie3}${pie4}</div>
    <div class="bdg-bar-grid">${bar1}${bar2}</div>
  </div></div>`;
}

/* ── 8. INV. SEMANAL ── */
function renderInvSemanal(d){
  const semRows=d.inventarioSemanal||[];
  const invRows=d.inventario||[];
  const filtInv=_bdgRows('invSemanal',invRows);
  const keys=Object.keys(semRows[0]||{}).filter(k=>k!=='dia'&&k!=='__rowNum');
  const semHtml=semRows.length?`
    ${_subLabel('INVENTARIO SEMANAL')}
    <div class="bdg-tbl-wrap" style="flex:none;max-height:220px"><table class="bdg-tbl">
      <thead><tr>
        <th style="min-width:80px">Día</th>
        ${keys.map(k=>`<th class="r" style="text-transform:capitalize;min-width:90px">${k}</th>`).join('')}
      </tr></thead>
      <tbody>${semRows.map(r=>`<tr>
        <td style="font-weight:700;color:var(--orange);white-space:nowrap;font-size:12px">${r.dia||'—'}</td>
        ${keys.map(k=>`<td class="r" style="font-size:12px">${r[k]!=null?r[k]:'—'}</td>`).join('')}
      </tr>`).join('')}</tbody>
    </table></div>`:'';
  const invHtml=filtInv.length?`
    ${_subLabel('AJUSTE DE INVENTARIO')}
    <div style="flex:1;min-height:0;overflow:auto">${_hbarChart(filtInv)}</div>`:'';
  if(!semRows.length&&!filtInv.length)return`<div class="bdg-empty"><div class="bdg-empty-icon">🗃️</div><div class="bdg-empty-msg">Sin datos de inventario</div></div>`;
  return`<div class="bdg-section"><div class="bdg-scroll-panel">${semHtml}${invHtml}</div></div>`;
}
