/* ═══════════════════════════════════════════════════════════
   BODEGA v4 — Enterprise · shared filters · zoom · no redundant headers
═══════════════════════════════════════════════════════════ */
let _bodegaData = null;
let _bodegaView = 'cobertura';
let _bdgTabOrder = null;
let _bdgFilter   = {};
let _bdgDragTab  = null;
let _bdgZoom     = 100;

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

/* ─── state persistence ─── */
function _bdgLoad(){
  try{_bdgTabOrder=JSON.parse(localStorage.getItem('kc_bdg_order')||'null');}catch{}
  try{_bdgFilter=JSON.parse(localStorage.getItem('kc_bdg_filter')||'{}');}catch{}
  try{_bdgZoom=parseInt(localStorage.getItem('kc_bdg_zoom')||'100');}catch{}
}
function _bdgSaveOrder(){ localStorage.setItem('kc_bdg_order',JSON.stringify(_bdgTabOrder)); }
function _bdgSaveFilter(){
  localStorage.setItem('kc_bdg_filter',JSON.stringify(_bdgFilter));
  const pub=document.getElementById('bdg-filter-pub');
  if(pub) pub.style.display='inline-flex';
}

/* ─── GH filter fetch / push ─── */
async function _fetchFilterFromGH(){
  const cfg=GH_REPO_CFG;
  if(!cfg.owner||!cfg.repo)return null;
  try{
    const url=`https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch||'main'}/${GH_FILTER_PATH}?_=${Date.now()}`;
    const r=await fetch(url,{cache:'no-store'});
    if(r.ok)return await r.json();
  }catch{}
  return null;
}
async function bdgPublishFilter(){
  const cfg=getGHCfg();
  if(!cfg.token){showToast('⚠️ Token de GitHub requerido');return;}
  const btn=document.getElementById('bdg-filter-pub');
  if(btn){btn.textContent='⏳ Publicando…';btn.disabled=true;}
  const url=`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${GH_FILTER_PATH}`;
  const headers={Authorization:`token ${cfg.token}`,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'};
  let sha=null;
  try{const r=await fetch(url,{headers});if(r.ok){const j=await r.json();sha=j.sha;}}catch{}
  const b64=btoa(unescape(encodeURIComponent(JSON.stringify(_bdgFilter,null,2))));
  const body={message:`Update bodega filter — ${new Date().toLocaleString('es-EC')}`,content:b64,branch:cfg.branch||'main'};
  if(sha)body.sha=sha;
  try{
    const r=await fetch(url,{method:'PUT',headers,body:JSON.stringify(body)});
    if(r.ok){
      showToast('✅ Filtro publicado para todos los usuarios');
      if(btn){btn.style.display='none';btn.disabled=false;btn.innerHTML='📡 Publicar para todos';}
    }else{
      showToast('✗ Error al publicar filtro');
      if(btn){btn.disabled=false;btn.innerHTML='📡 Publicar para todos';}
    }
  }catch(e){
    showToast('✗ '+e.message);
    if(btn){btn.disabled=false;btn.innerHTML='📡 Publicar para todos';}
  }
}

/* ─── visible tabs (role-aware + custom order) ─── */
function _bdgGetTabs(){
  const canInv=SESSION&&(SESSION.role==='editor'||SESSION.role==='superadmin');
  let tabs=BDG_TABS.filter(t=>t.id==='invSemanal'?canInv:true);
  if(_bdgTabOrder&&_bdgTabOrder.length){
    tabs=[...tabs].sort((a,b)=>{
      const ai=_bdgTabOrder.indexOf(a.id),bi=_bdgTabOrder.indexOf(b.id);
      if(ai<0&&bi<0)return 0;if(ai<0)return 1;if(bi<0)return -1;return ai-bi;
    });
  }
  return tabs;
}

/* ─── main load ─── */
async function loadBodega(){
  _bdgLoad();
  const wrap=document.getElementById('bodega-content');
  if(!wrap)return;
  wrap.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;height:300px;gap:14px;color:#94A3B8">
    <div style="width:30px;height:30px;border:3px solid #E2E8F0;border-top-color:var(--orange);border-radius:50%;animation:bdgSpin .8s linear infinite"></div>
    <div style="font-size:13px;font-weight:600;letter-spacing:.2px">Cargando datos…</div>
  </div>`;
  try{_bodegaData=await fetchBodegaFromGitHub();}catch(e){_bodegaData=null;}
  if(!_bodegaData){
    wrap.innerHTML=`<div class="bdg-empty">
      <div class="bdg-empty-icon">📦</div>
      <div class="bdg-empty-msg">Sin datos de bodega</div>
      <div class="bdg-empty-hint">Ejecuta <strong>sync-bodega.bat</strong> en tu escritorio para sincronizar desde Excel.</div>
    </div>`;
    _renderToolbar();
    return;
  }
  /* Non-superadmin: apply shared filter from GitHub */
  if(!SESSION||SESSION.role!=='superadmin'){
    const ghF=await _fetchFilterFromGH();
    if(ghF)_bdgFilter=ghF;
  }
  renderBodegaTabs();
  _renderToolbar();
  _applyZoom();
  renderBodegaView(_bodegaView);
}

/* ─── tabs ─── */
function renderBodegaTabs(){
  const bar=document.getElementById('bodega-tabs');
  if(!bar)return;
  const isSA=SESSION&&SESSION.role==='superadmin';
  const tabs=_bdgGetTabs();
  bar.innerHTML=tabs.map(t=>{
    const drag=isSA?`draggable="true" ondragstart="bdgDragStart(event,'${t.id}')" ondragover="bdgDragOver(event)" ondrop="bdgDrop(event,'${t.id}')" ondragleave="bdgDragLeave(event)"`:'' ;
    return`<button class="bdg-tab${t.id===_bodegaView?' active':''}" data-view="${t.id}" onclick="switchBodegaView('${t.id}')" ${drag}>
      ${isSA?'<span class="bdg-drag-handle">⠿</span>':''}
      <span class="bdg-tab-icon">${t.icon}</span>${t.label}
    </button>`;
  }).join('');
}

/* ─── toolbar (zoom + publish) ─── */
function _renderToolbar(){
  let bar=document.getElementById('bodega-toolbar');
  if(!bar){
    const pg=document.getElementById('pg-bodega');
    const body=document.getElementById('bodega-content');
    if(!pg||!body)return;
    bar=document.createElement('div');
    bar.id='bodega-toolbar';
    bar.className='bdg-toolbar';
    pg.insertBefore(bar,body);
  }
  const isSA=SESSION&&SESSION.role==='superadmin';
  const updAt=_bodegaData&&_bodegaData.updatedAt?_bodegaData.updatedAt:'';
  bar.innerHTML=`
    <div class="bdg-toolbar-left">
      ${updAt?`<span class="bdg-upd-tag">🕐 ${updAt}</span>`:''}
      ${isSA?`<button id="bdg-filter-pub" class="bdg-pub-badge" style="display:none" onclick="bdgPublishFilter()">📡 Publicar para todos</button>`:''}
    </div>
    <div class="bdg-toolbar-right">
      <div class="bdg-zoom-ctrl">
        <button class="bdg-zoom-btn" onclick="bdgZoomOut()" title="Reducir">−</button>
        <span id="bdg-zoom-pct" class="bdg-zoom-pct" onclick="bdgZoomFit()" title="Restablecer 100%">${_bdgZoom}%</span>
        <button class="bdg-zoom-btn" onclick="bdgZoomIn()" title="Ampliar">+</button>
        <button class="bdg-zoom-btn bdg-zoom-fit" onclick="bdgZoomFit()" title="Ajustar a página">⊡</button>
      </div>
    </div>`;
}

/* ─── zoom ─── */
function bdgZoomIn() {_bdgZoom=Math.min(200,_bdgZoom+10);_applyZoom();}
function bdgZoomOut(){_bdgZoom=Math.max(50, _bdgZoom-10);_applyZoom();}
function bdgZoomFit(){_bdgZoom=100;_applyZoom();}
function _applyZoom(){
  localStorage.setItem('kc_bdg_zoom',String(_bdgZoom));
  const body=document.getElementById('bodega-content');
  if(body)body.style.zoom=_bdgZoom+'%';
  const pct=document.getElementById('bdg-zoom-pct');
  if(pct)pct.textContent=_bdgZoom+'%';
}

function switchBodegaView(v){
  _bodegaView=v;
  document.querySelectorAll('.bdg-tab').forEach(t=>t.classList.toggle('active',t.dataset.view===v));
  renderBodegaView(v);
}
function renderBodegaView(v){
  const wrap=document.getElementById('bodega-content');
  if(!wrap||!_bodegaData)return;
  const d=_bodegaData;
  switch(v){
    case 'cobertura':     wrap.innerHTML=renderCobertura(d);break;
    case 'abastecimiento':wrap.innerHTML=renderAbastecimiento(d);break;
    case 'proveedores':   wrap.innerHTML=renderProveedores(d);break;
    case 'lotesFinales':  wrap.innerHTML=renderLotesFinales(d);break;
    case 'reqDiario':     wrap.innerHTML=renderReqDiario(d);break;
    case 'lastmile':      wrap.innerHTML=renderLastMile(d);break;
    case 'graficas':      wrap.innerHTML=renderGraficas(d);break;
    case 'invSemanal':    wrap.innerHTML=renderInvSemanal(d);break;
    default: wrap.innerHTML='<div class="bdg-empty"><div class="bdg-empty-msg">Vista no disponible</div></div>';
  }
}

/* ─── drag & drop (superadmin) ─── */
function bdgDragStart(e,id){_bdgDragTab=id;e.currentTarget.classList.add('bdg-tab--dragging');e.dataTransfer.effectAllowed='move';}
function bdgDragOver(e){e.preventDefault();e.currentTarget.classList.add('bdg-tab--dragover');e.dataTransfer.dropEffect='move';}
function bdgDragLeave(e){e.currentTarget.classList.remove('bdg-tab--dragover');}
function bdgDrop(e,targetId){
  e.preventDefault();e.currentTarget.classList.remove('bdg-tab--dragover');
  if(!_bdgDragTab||_bdgDragTab===targetId)return;
  const tabs=_bdgGetTabs(),order=tabs.map(t=>t.id);
  const fi=order.indexOf(_bdgDragTab),ti=order.indexOf(targetId);
  if(fi<0||ti<0)return;
  order.splice(fi,1);order.splice(ti,0,_bdgDragTab);
  _bdgTabOrder=order;_bdgDragTab=null;_bdgSaveOrder();renderBodegaTabs();
}

/* ─── product filter ─── */
function _bdgFilterBar(viewId,allProducts){
  const isSA=SESSION&&SESSION.role==='superadmin';
  if(!isSA||!allProducts.length)return'';
  const hidden=new Set(_bdgFilter[viewId]||[]);
  const visible=allProducts.length-hidden.size;
  const chips=allProducts.map(p=>{
    const h=hidden.has(p);
    const safe=p.replace(/'/g,"\\'").replace(/"/g,'&quot;');
    return`<label class="bdg-fchip${h?' bdg-fchip--off':''}"><input type="checkbox" ${h?'':'checked'} onchange="bdgToggleProd('${viewId}','${safe}',this.checked)" style="display:none">${p}</label>`;
  }).join('');
  return`<details class="bdg-fpanel">
    <summary class="bdg-fpanel-sum">⚙️ Filtrar productos visibles <span class="bdg-fbadge">${visible} / ${allProducts.length}</span></summary>
    <div class="bdg-fchips">${chips}</div>
  </details>`;
}
function bdgToggleProd(viewId,product,visible){
  if(!_bdgFilter[viewId])_bdgFilter[viewId]=[];
  _bdgFilter[viewId]=visible?_bdgFilter[viewId].filter(p=>p!==product):[..._bdgFilter[viewId].filter(p=>p!==product),product];
  _bdgSaveFilter();renderBodegaView(_bodegaView);
}
function _bdgRows(viewId,rows,key='producto'){
  const hidden=_bdgFilter[viewId]||[];
  return hidden.length?rows.filter(r=>!hidden.includes(r[key])):rows;
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
function _bar(pct,col,h=5){const w=Math.min(100,Math.max(0,Number(pct||0)*100));const c=col||_C(pct).bar;return`<div class="bdg-bar-track" style="height:${h}px"><div style="width:${w}%;background:${c};height:100%;border-radius:999px;transition:width .4s"></div></div>`;}

/* ── SVG Pie ── */
function _pie(received,total,title,dec=0){
  if(!total||total<=0)return`<div class="bdg-chart-card"><div class="bdg-chart-title">${title}</div><div style="text-align:center;padding:36px 0;color:#94A3B8;font-size:11px">Sin datos</div></div>`;
  const pct=Math.min(1,Math.max(0,received/total));
  const pending=total-received;
  const r=50,cx=60,cy=60;
  let arcPath='',bgPath='';
  if(pct>=1){arcPath=`M ${cx},${cy-r} A ${r},${r} 0 1,1 ${cx-0.01},${cy-r} Z`;}
  else if(pct<=0){bgPath=`M ${cx},${cy-r} A ${r},${r} 0 1,1 ${cx-0.01},${cy-r} Z`;}
  else{
    const angle=pct*2*Math.PI;
    const sx=(cx+r*Math.sin(0)).toFixed(2),sy=(cy-r*Math.cos(0)).toFixed(2);
    const ex=(cx+r*Math.sin(angle)).toFixed(2),ey=(cy-r*Math.cos(angle)).toFixed(2);
    const la=pct>0.5?1:0;
    arcPath=`M ${cx},${cy} L ${sx},${sy} A ${r},${r} 0 ${la},1 ${ex},${ey} Z`;
    bgPath=`M ${cx},${cy} L ${ex},${ey} A ${r},${r} 0 ${1-la},1 ${sx},${sy} Z`;
  }
  const v1=dec>0?Number(received).toFixed(dec):_N(received);
  const v2=dec>0?Number(pending).toFixed(dec):_N(pending);
  return`<div class="bdg-chart-card">
    <div class="bdg-chart-title">${title}</div>
    <svg width="120" height="120" viewBox="0 0 120 120" style="display:block;margin:0 auto">
      ${bgPath?`<path d="${bgPath}" fill="#E8C9A0"/>`:''}
      ${arcPath?`<path d="${arcPath}" fill="#1A3A6B"/>`:''}
    </svg>
    <div style="text-align:center;font-size:18px;font-weight:800;color:#1E293B;margin:-4px 0 6px">${(pct*100).toFixed(2)}%</div>
    <div class="bdg-chart-legend"><span style="color:#1A3A6B">● ${v1}</span><span style="color:#D4A76A">● ${v2}</span></div>
  </div>`;
}

/* ── Vertical Bar Chart ── */
function _barChart(data,title,dec=0,barColor='#1A3A6B'){
  if(!data.length)return'';
  const max=Math.max(...data.map(d=>d.value),1);
  const bars=data.map(d=>{
    const h=Math.max(2,Math.round((d.value/max)*110));
    const val=dec>0?Number(d.value).toFixed(dec):_N(d.value);
    return`<div class="bdg-bc-col">
      <div class="bdg-bc-val">${val}</div>
      <div class="bdg-bc-bar" style="height:${h}px;background:${barColor}"></div>
      <div class="bdg-bc-lbl">${d.label}</div>
    </div>`;
  }).join('');
  return`<div class="bdg-chart-card bdg-chart-wide">
    <div class="bdg-chart-title">${title}</div>
    <div class="bdg-bc-wrap">${bars}</div>
  </div>`;
}

/* ── Horizontal Bar (Inventario) ── */
function _hbarChart(rows){
  if(!rows.length)return'';
  const vals=rows.filter(r=>r.ajuste!=null&&!isNaN(Number(r.ajuste)));
  if(!vals.length)return'';
  const mx=Math.max(...vals.map(r=>Math.abs(Number(r.ajuste))),1);
  const bh=22,gap=6,labelW=230,rightW=200,midX=labelW;
  const svgW=labelW+rightW+20,svgH=vals.length*(bh+gap)+20;
  const rects=vals.map((r,i)=>{
    const v=Number(r.ajuste),neg=v<0;
    const bw=Math.max(1,Math.round(Math.abs(v)/mx*rightW*0.85));
    const y=10+i*(bh+gap);
    const bx=neg?midX-bw:midX;
    const col=neg?'#EF4444':'#1A3A6B';
    const tx=neg?midX-bw-4:midX+bw+4;
    const ta=neg?'end':'start';
    return`<g>
      <text x="${labelW-8}" y="${y+bh/2+4}" font-size="10" fill="#334155" text-anchor="end" font-family="Segoe UI,sans-serif">${r.producto}</text>
      <rect x="${bx}" y="${y}" width="${bw}" height="${bh}" fill="${col}" rx="3"/>
      <text x="${tx}" y="${y+bh/2+4}" font-size="9" fill="#64748B" text-anchor="${ta}" font-weight="700" font-family="Segoe UI,sans-serif">${_N(v)}</text>
    </g>`;
  }).join('');
  return`<div class="bdg-tbl-wrap" style="background:#fff;padding:20px">
    <div class="bdg-chart-title" style="margin-bottom:14px">INVENTARIO</div>
    <div style="overflow-x:auto"><svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
      <line x1="${midX}" y1="5" x2="${midX}" y2="${svgH-5}" stroke="#E2E8F0" stroke-width="1"/>
      ${rects}
    </svg></div>
  </div>`;
}

/* ─── sub-section label ─── */
function _subLabel(txt){return`<div class="bdg-sub-label">${txt}</div>`;}

/* ═══════════ VIEWS ═══════════ */

/* ── 1. COBERTURA ── */
function renderCobertura(d){
  const all=d.cobertura||[];
  if(!all.length)return`<div class="bdg-empty"><div class="bdg-empty-icon">📊</div><div class="bdg-empty-msg">Sin datos de cobertura</div></div>`;
  const rows=_bdgRows('cobertura',all);
  const allProds=all.map(r=>r.producto).filter(Boolean);
  const totIng=rows.reduce((a,r)=>a+(r.ingresos||0),0);
  const totReq=rows.reduce((a,r)=>a+(r.totalReq||0),0);
  const glob=totReq>0?totIng/totReq:0;
  const cg=_C(glob);
  const nd=(rows.find(r=>Array.isArray(r.porDia)&&r.porDia.length)||{}).porDia?.length||0;
  const dayTh=Array.from({length:nd},(_,i)=>`<th class="r bdg-day-th">D${i+1}</th>`).join('');
  const trs=rows.map(r=>{
    const c=_C(r.pct),neg=(r.saldo||0)<0,negR=(r.porRecibir||0)<0;
    const dias=Array.isArray(r.porDia)?r.porDia:[];
    const dCells=Array.from({length:nd},(_,i)=>{
      const v=dias[i];if(v==null)return`<td class="r" style="color:#CBD5E1">—</td>`;
      return`<td class="r${Number(v)<0?' neg':''}">${_N(v)}</td>`;
    }).join('');
    return`<tr onclick="bdgSelRow(this)">
      <td class="bdg-sticky-col" style="font-weight:600;white-space:nowrap">${r.producto||'—'}</td>
      <td class="r">${_N(r.ingresos)}</td><td class="r">${_N(r.totalReq)}</td>
      <td class="r${neg?' neg':''}">${_N(r.saldo)}</td>
      ${dCells}
      <td style="min-width:140px"><div style="display:flex;align-items:center;gap:6px">${_badge(r.pct)}<div style="flex:1">${_bar(r.pct,c.bar,4)}</div></div></td>
      <td class="r${negR?' neg':''}">${_N(r.porRecibir)}</td>
    </tr>`;
  }).join('');
  return`<div class="bdg-section">
    ${_bdgFilterBar('cobertura',allProds)}
    <div class="bdg-kpis">
      <div class="bdg-kpi bdg-kpi--blue"><div class="bdg-kpi-lbl">Total ingresos</div><div class="bdg-kpi-val">${_N(totIng)}</div></div>
      <div class="bdg-kpi"><div class="bdg-kpi-lbl">Total requerido</div><div class="bdg-kpi-val">${_N(totReq)}</div></div>
      <div class="bdg-kpi bdg-kpi--orange"><div class="bdg-kpi-lbl">Cobertura global</div><div class="bdg-kpi-val" style="color:${cg.fg}">${_P(glob)}</div></div>
      <div class="bdg-kpi"><div class="bdg-kpi-lbl">Productos</div><div class="bdg-kpi-val">${rows.length}</div></div>
    </div>
    <div class="bdg-tbl-wrap"><table class="bdg-tbl">
      <thead><tr>
        <th class="bdg-sticky-col">Producto</th>
        <th class="r">Ingresos</th><th class="r">Total req.</th><th class="r">Saldo</th>
        ${dayTh}
        <th style="min-width:140px">Cobertura</th><th class="r">Por recibir</th>
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
  const allProds=all.map(r=>r.producto).filter(Boolean);
  const ok=rows.filter(r=>(r.pct||0)>=1).length,med=rows.filter(r=>(r.pct||0)>=0.7&&(r.pct||0)<1).length,crit=rows.filter(r=>(r.pct||0)<0.7).length;
  const cards=rows.map(r=>{
    const c=_C(r.pct),p=Math.min(100,Math.max(0,(r.pct||0)*100));
    return`<div class="bdg-card" style="border-left:4px solid ${c.bar}">
      <div class="bdg-card-name">${r.producto||'—'}</div>
      <div class="bdg-card-pct" style="color:${c.fg}">${_P(r.pct)}</div>
      <div class="bdg-bar-track" style="height:7px"><div style="width:${p}%;background:${c.bar};height:100%;border-radius:999px"></div></div>
      <div class="bdg-card-detail">
        <span>Ing: <strong>${_N(r.ingresos)}</strong></span>
        <span>Req: <strong>${_N(r.totalReq)}</strong></span>
        <span style="color:${(r.porRecibir||0)<0?'#EF4444':'#64748B'}">Saldo: <strong>${_N(r.porRecibir)}</strong></span>
      </div>
    </div>`;
  }).join('');
  return`<div class="bdg-section">
    ${_bdgFilterBar('abastecimiento',allProds)}
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
  const allProds=all.map(r=>r.producto).filter(Boolean);
  const totP=rows.reduce((a,r)=>a+(r.planificado||0),0),totI=rows.reduce((a,r)=>a+(r.ingresos||0),0);
  const glob=totP>0?totI/totP:0;
  const trs=rows.map(r=>{
    const c=_C(r.pct);
    return`<tr onclick="bdgSelRow(this)">
      <td class="bdg-sticky-col" style="font-weight:600">${r.producto||'—'}</td>
      <td class="r">${_N(r.planificado)}</td><td class="r">${_N(r.ingresos)}</td>
      <td style="min-width:180px">
        <div style="display:flex;flex-direction:column;gap:4px">
          <div style="display:flex;align-items:center;justify-content:space-between">${_badge(r.pct)}<span style="font-size:10px;color:#64748B">${_N(r.ingresos)} / ${_N(r.planificado)}</span></div>
          ${_bar(r.pct,c.bar,6)}
        </div>
      </td>
    </tr>`;
  }).join('');
  return`<div class="bdg-section">
    ${_bdgFilterBar('proveedores',allProds)}
    <div class="bdg-kpis">
      <div class="bdg-kpi bdg-kpi--blue"><div class="bdg-kpi-lbl">Total planificado</div><div class="bdg-kpi-val">${_N(totP)}</div></div>
      <div class="bdg-kpi bdg-kpi--green"><div class="bdg-kpi-lbl">Total ingresos</div><div class="bdg-kpi-val">${_N(totI)}</div></div>
      <div class="bdg-kpi bdg-kpi--orange"><div class="bdg-kpi-lbl">Cumplimiento global</div><div class="bdg-kpi-val" style="color:${_C(glob).fg}">${_P(glob)}</div></div>
      <div class="bdg-kpi"><div class="bdg-kpi-lbl">Proveedores</div><div class="bdg-kpi-val">${rows.length}</div></div>
    </div>
    <div class="bdg-tbl-wrap"><table class="bdg-tbl">
      <thead><tr><th class="bdg-sticky-col">Proveedor / Producto</th><th class="r">Planificado</th><th class="r">Ingresos</th><th>Cumplimiento</th></tr></thead>
      <tbody>${trs}</tbody>
    </table></div>
  </div>`;
}

/* ── 4. LOTES FINALES ── */
function renderLotesFinales(d){
  const all=d.lotesFinales||[];
  if(!all.length)return`<div class="bdg-empty"><div class="bdg-empty-icon">📋</div><div class="bdg-empty-msg">Sin datos de lotes finales</div></div>`;
  const rows=_bdgRows('lotesFinales',all);
  const allProds=all.map(r=>r.producto).filter(Boolean);
  const ok=rows.filter(r=>(r.pct||0)>=1).length,crit=rows.filter(r=>(r.pct||0)<0.7).length;
  const trs=rows.map(r=>{
    const c=_C(r.pct),neg=(r.porRecibir||0)<0;
    return`<tr onclick="bdgSelRow(this)">
      <td class="bdg-sticky-col" style="font-weight:600">${r.producto||'—'}</td>
      <td class="r${neg?' neg':''}">${_N(r.porRecibir)}</td>
      <td style="min-width:160px"><div style="display:flex;align-items:center;gap:8px">${_badge(r.pct)}<div style="flex:1">${_bar(r.pct,c.bar,5)}</div></div></td>
      <td style="font-size:11px;color:#64748B">${r.lotes&&r.lotes!=='—'&&r.lotes!=='-'?r.lotes:'—'}</td>
    </tr>`;
  }).join('');
  return`<div class="bdg-section">
    ${_bdgFilterBar('lotesFinales',allProds)}
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
  const allProds=all.map(r=>r.producto).filter(Boolean);
  const nd=rows.length?Math.max(...rows.map(r=>(r.dias||[]).length),0):0;
  const dayTh=Array.from({length:nd},(_,i)=>`<th class="r bdg-day-th">D${i+1}</th>`).join('');
  const trs=rows.map(r=>{
    const dias=Array.isArray(r.dias)?r.dias:[];
    const dCells=Array.from({length:nd},(_,i)=>{
      const v=dias[i];if(v==null||v==='')return`<td class="r" style="color:#CBD5E1">—</td>`;
      return`<td class="r">${_N(v)}</td>`;
    }).join('');
    return`<tr onclick="bdgSelRow(this)">
      <td class="bdg-sticky-col" style="font-weight:600;white-space:nowrap">${r.producto||'—'}</td>
      ${dCells}
      <td class="r" style="font-weight:700;color:var(--orange)">${_N(r.distributivo)}</td>
      <td class="r">${r.numDias||'—'}</td>
    </tr>`;
  }).join('');
  return`<div class="bdg-section">
    ${_bdgFilterBar('reqDiario',allProds)}
    <div class="bdg-tbl-wrap"><table class="bdg-tbl">
      <thead><tr>
        <th class="bdg-sticky-col">Producto</th>
        ${dayTh}
        <th class="r">Distributivo</th><th class="r">Días</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table></div>
  </div>`;
}

/* ── 6. LAST MILE ── */
function renderLastMile(d){
  const errores=d.historialErrores||[];
  const lm=d.lastmile||{};
  const errHtml=errores.length?`
    ${_subLabel('ERRORES LASTMILE')}
    <div class="bdg-tbl-wrap"><table class="bdg-tbl">
      <thead><tr><th class="bdg-sticky-col">Transportista</th>${Object.keys(errores[0]).filter(k=>k!=='transportista').map(k=>`<th class="r">${k}</th>`).join('')}</tr></thead>
      <tbody>${errores.map(r=>`<tr onclick="bdgSelRow(this)">
        <td class="bdg-sticky-col" style="font-weight:600;white-space:nowrap">${r.transportista||'—'}</td>
        ${Object.keys(r).filter(k=>k!=='transportista').map(k=>{const v=Number(r[k]);const has=!isNaN(v)&&r[k]!=null&&r[k]!=='';return`<td class="r${has&&v>0?' neg':''}">`+(has?_N(v):'')+'</td>';}).join('')}
      </tr>`).join('')}</tbody>
    </table></div>`:'';
  const res=Array.isArray(lm.resumen)?lm.resumen.filter(r=>r.etiqueta!=null):[];
  const cumHtml=res.length?`
    ${_subLabel('CUMPLIMIENTO')}
    <div class="bdg-tbl-wrap" style="padding:20px">
      <div style="display:flex;gap:16px;font-size:10px;color:#64748B;margin-bottom:14px">
        <span><span style="color:#E8C9A0;font-size:14px">●</span> META</span>
        <span><span style="color:#1A3A6B;font-size:14px">●</span> VALIDACIÓN</span>
      </div>
      <div style="display:flex;gap:20px;align-items:flex-end;overflow-x:auto;padding-bottom:8px">
        ${res.map(r=>{
          const meta=Number(r.cuentaTrans)||0,val=Number(r.cuentaVal)||0;
          const maxV=Math.max(meta,val,1);
          const hm=Math.max(2,Math.round(meta/maxV*110)),hv=Math.max(2,Math.round(val/maxV*110));
          return`<div style="display:flex;flex-direction:column;align-items:center;gap:6px;min-width:54px">
            <div style="display:flex;gap:4px;align-items:flex-end;height:120px">
              <div style="display:flex;flex-direction:column;align-items:center;gap:3px"><span style="font-size:8px;font-weight:700;color:#1E293B">${meta}</span><div style="width:20px;height:${hm}px;background:#E8C9A0;border-radius:3px 3px 0 0"></div></div>
              <div style="display:flex;flex-direction:column;align-items:center;gap:3px"><span style="font-size:8px;font-weight:700;color:#1E293B">${val}</span><div style="width:20px;height:${hv}px;background:#1A3A6B;border-radius:3px 3px 0 0"></div></div>
            </div>
            <span style="font-size:9px;font-weight:600;color:#64748B;text-align:center">${r.etiqueta}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`:'';
  if(!errHtml&&!cumHtml)return`<div class="bdg-empty"><div class="bdg-empty-icon">🚚</div><div class="bdg-empty-msg">Sin datos de Last Mile</div></div>`;
  return`<div class="bdg-section">${errHtml}${cumHtml}</div>`;
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
  const diasArr=Object.keys(byDia).map(Number).sort((a,b)=>a-b).map(k=>({label:`${k}`,inst:byDia[k].inst,ton:byDia[k].ton}));
  const pie1=_pie(notas.recibidas||0,notas.planificadas||0,'NOTAS RECIBIDAS');
  const pie2=_pie(notas.racionesRecibidas||0,notas.racionesPlanificadas||0,'RACIONES DESPACHADAS');
  const pie3=_pie(despTon,totTon,'TONELADAS DESPACHADAS',2);
  const pie4=_pie(despIE,totIE,'INSTITUCIONES DESPACHADAS');
  const bar1=diasArr.length?_barChart(diasArr.map(x=>({label:x.label,value:x.inst})),'INSTITUCIONES POR DÍA',0,'#1A3A6B'):'';
  const bar2=diasArr.length?_barChart(diasArr.map(x=>({label:x.label,value:x.ton})),'TONELADAS POR DÍA',2,'#1A3A6B'):'';
  return`<div class="bdg-section">
    <div class="bdg-pie-grid">${pie1}${pie2}${pie3}${pie4}</div>
    <div class="bdg-bar-grid">${bar1}${bar2}</div>
  </div>`;
}

/* ── 8. INV. SEMANAL + INVENTARIO ── */
function renderInvSemanal(d){
  const semRows=d.inventarioSemanal||[];
  const invRows=d.inventario||[];
  const all=(d.inventario||[]).map(r=>r.producto).filter(Boolean);
  const keys=Object.keys(semRows[0]||{}).filter(k=>k!=='dia'&&k!=='__rowNum');
  const semHtml=semRows.length?`
    ${_subLabel('INVENTARIO SEMANAL')}
    <div class="bdg-tbl-wrap"><table class="bdg-tbl">
      <thead><tr><th>Día</th>${keys.map(k=>`<th style="text-transform:capitalize">${k}</th>`).join('')}</tr></thead>
      <tbody>${semRows.map(r=>`<tr>
        <td style="font-weight:700;color:var(--orange);white-space:nowrap">${r.dia||'—'}</td>
        ${keys.map(k=>`<td style="font-size:11px">${r[k]||'—'}</td>`).join('')}
      </tr>`).join('')}</tbody>
    </table></div>`:'';
  const filtInv=_bdgRows('invSemanal',invRows);
  const invHtml=filtInv.length?`<div style="margin-top:20px">${_hbarChart(filtInv)}</div>`:'';
  return`<div class="bdg-section">
    ${_bdgFilterBar('invSemanal',all)}
    ${semHtml}
    ${invHtml}
  </div>`;
}
