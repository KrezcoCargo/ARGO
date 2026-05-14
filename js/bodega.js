/* ═══════════════════════════════════════════════════════════
   BODEGA v2 — Power BI-inspired design
═══════════════════════════════════════════════════════════ */
let _bodegaData = null;
let _bodegaView = 'cobertura';

async function loadBodega(){
  const wrap = document.getElementById('bodega-content');
  if(!wrap) return;
  wrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:240px;gap:10px;color:#94A3B8"><div style="font-size:20px">⏳</div><div style="font-size:13px;font-weight:600">Cargando datos de bodega…</div></div>`;
  try{ _bodegaData = await fetchBodegaFromGitHub(); }catch(e){ _bodegaData=null; }
  if(!_bodegaData){
    wrap.innerHTML=`<div class="bdg-empty"><div class="bdg-empty-icon">📦</div><div class="bdg-empty-msg">Sin datos de bodega</div><div style="font-size:11px;color:#94A3B8;text-align:center">Ejecuta <strong>sync-bodega.bat</strong> en tu escritorio para sincronizar desde Excel.</div></div>`;
    return;
  }
  renderBodegaTabs();
  renderBodegaView(_bodegaView);
}

function switchBodegaView(v){
  _bodegaView=v;
  document.querySelectorAll('.bdg-tab').forEach(t=>t.classList.toggle('active',t.dataset.view===v));
  renderBodegaView(v);
}

function renderBodegaTabs(){
  const bar=document.getElementById('bodega-tabs');
  if(!bar)return;
  const tabs=[
    {id:'cobertura',    label:'Cobertura'},
    {id:'abastecimiento',label:'Abastecimiento'},
    {id:'proveedores',  label:'Proveedores'},
    {id:'lotesFinales', label:'Lotes Finales'},
    {id:'reqDiario',    label:'Req. Diario'},
    {id:'lastmile',     label:'Last Mile'},
    {id:'inventario',   label:'Inventario'},
    {id:'invSemanal',   label:'Inv. Semanal'},
  ];
  bar.innerHTML=tabs.map(t=>`<button class="bdg-tab${t.id===_bodegaView?' active':''}" data-view="${t.id}" onclick="switchBodegaView('${t.id}')">${t.label}</button>`).join('');
}

function renderBodegaView(v){
  const wrap=document.getElementById('bodega-content');
  if(!wrap||!_bodegaData)return;
  const d=_bodegaData;
  const ua=d.updatedAt?`<span class="bdg-updated">Actualizado: ${d.updatedAt}</span>`:'';
  switch(v){
    case 'cobertura':     wrap.innerHTML=renderCobertura(d,ua);break;
    case 'abastecimiento':wrap.innerHTML=renderAbastecimiento(d,ua);break;
    case 'proveedores':   wrap.innerHTML=renderProveedores(d,ua);break;
    case 'lotesFinales':  wrap.innerHTML=renderLotesFinales(d,ua);break;
    case 'reqDiario':     wrap.innerHTML=renderReqDiario(d,ua);break;
    case 'lastmile':      wrap.innerHTML=renderLastMile(d,ua);break;
    case 'inventario':    wrap.innerHTML=renderInventario(d,ua);break;
    case 'invSemanal':    wrap.innerHTML=renderInvSemanal(d,ua);break;
    default: wrap.innerHTML='<div class="bdg-empty"><div class="bdg-empty-msg">Vista no disponible</div></div>';
  }
}

/* ─────────────── HELPERS ─────────────── */
function _N(n,d=0){
  if(n==null||n===''||isNaN(Number(n)))return'—';
  return Number(n).toLocaleString('es-EC',{minimumFractionDigits:d,maximumFractionDigits:d});
}
function _P(v){
  if(v==null||isNaN(Number(v)))return'—';
  return(Number(v)*100).toFixed(1)+'%';
}
function _C(v){
  const p=Number(v)*100;
  if(p>=95)return{bg:'#DCFCE7',fg:'#166534',bar:'#1F9D55'};
  if(p>=70)return{bg:'#FEF3C7',fg:'#92400E',bar:'#D97706'};
  return{bg:'#FEE2E2',fg:'#991B1B',bar:'#EF4444'};
}
function _badge(v){const c=_C(v);return`<span class="bdg-badge" style="background:${c.bg};color:${c.fg}">${_P(v)}</span>`;}
function _bar(pct,color,h=6){
  const w=Math.min(100,Math.max(0,Number(pct||0)*100));
  const c=color||_C(pct).bar;
  return`<div class="bdg-bar-track" style="height:${h}px"><div style="width:${w}%;background:${c};height:100%;border-radius:999px"></div></div>`;
}
function _spark(values){
  if(!Array.isArray(values)||!values.length)return'<span style="color:#ccc;font-size:10px">—</span>';
  const nums=values.map(v=>Number(v)||0);
  const mx=Math.max(...nums.map(Math.abs),1);
  const W=72,H=22,n=nums.length;
  const bw=Math.max(2,Math.floor((W-n)/(n+1)));
  const rects=nums.map((v,i)=>{
    const neg=v<0,h=Math.max(1,Math.round(Math.abs(v)/mx*(H/2-1)));
    const x=i*(bw+2),y=neg?H/2:H/2-h;
    return`<rect x="${x}" y="${y.toFixed(0)}" width="${bw}" height="${h}" fill="${neg?'#F87171':'#34D399'}" rx="1"/>`;
  }).join('');
  return`<svg width="${W}" height="${H}" style="display:block">${rects}</svg>`;
}
function _td(val,cls=''){return`<td class="r ${cls}">${_N(val)}</td>`;}
function _hdr(txt,right=false){return`<th${right?' class="r"':''}>${txt}</th>`;}

/* ─────────────── 1. COBERTURA ─────────────── */
function renderCobertura(d,ua){
  const rows=d.cobertura||[];
  if(!rows.length)return`<div class="bdg-empty"><div class="bdg-empty-icon">📊</div><div class="bdg-empty-msg">Sin datos de cobertura</div></div>`;
  const totIng=rows.reduce((a,r)=>a+(r.ingresos||0),0);
  const totReq=rows.reduce((a,r)=>a+(r.totalReq||0),0);
  const glob=totReq>0?totIng/totReq:0;
  const cg=_C(glob);
  const trs=rows.map(r=>{
    const c=_C(r.pct),neg=(r.saldo||0)<0,negR=(r.porRecibir||0)<0;
    return`<tr>
      <td style="font-weight:600;color:#1E293B;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.producto||'—'}</td>
      ${_td(r.ingresos)}
      ${_td(r.totalReq)}
      <td class="r ${neg?'neg':''}">${_N(r.saldo)}</td>
      <td style="min-width:72px">${_spark(r.porDia)}</td>
      <td style="min-width:140px">
        <div style="display:flex;align-items:center;gap:8px">
          ${_badge(r.pct)}
          ${_bar(r.pct,c.bar,5)}
        </div>
      </td>
      <td class="r ${negR?'neg':''}">${_N(r.porRecibir)}</td>
    </tr>`;
  }).join('');
  return`<div class="bdg-section">
    <div class="bdg-hdr"><div class="bdg-hdr-left"><div class="bdg-hdr-title">📊 Cobertura de productos</div><div class="bdg-hdr-sub">Ingresos vs requerimiento total · tendencia por día</div></div>${ua}</div>
    <div class="bdg-kpis">
      <div class="bdg-kpi bdg-kpi--blue"><div class="bdg-kpi-lbl">Total ingresos</div><div class="bdg-kpi-val">${_N(totIng)}</div></div>
      <div class="bdg-kpi"><div class="bdg-kpi-lbl">Total requerido</div><div class="bdg-kpi-val">${_N(totReq)}</div></div>
      <div class="bdg-kpi bdg-kpi--orange"><div class="bdg-kpi-lbl">Cobertura global</div><div class="bdg-kpi-val" style="color:${cg.fg}">${_P(glob)}</div></div>
      <div class="bdg-kpi"><div class="bdg-kpi-lbl">Productos</div><div class="bdg-kpi-val">${rows.length}</div></div>
    </div>
    <div class="bdg-tbl-wrap">
      <table class="bdg-tbl">
        <thead><tr>${_hdr('Producto')}${_hdr('Ingresos',true)}${_hdr('Total req.',true)}${_hdr('Saldo',true)}${_hdr('Tendencia')}${_hdr('Cobertura')}${_hdr('Por recibir',true)}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
  </div>`;
}

/* ─────────────── 2. ABASTECIMIENTO ─────────────── */
function renderAbastecimiento(d,ua){
  const rows=d.abastecimiento||[];
  if(!rows.length)return`<div class="bdg-empty"><div class="bdg-empty-icon">🔄</div><div class="bdg-empty-msg">Sin datos de abastecimiento</div></div>`;
  const ok=rows.filter(r=>(r.pct||0)>=1).length;
  const med=rows.filter(r=>(r.pct||0)>=0.7&&(r.pct||0)<1).length;
  const crit=rows.filter(r=>(r.pct||0)<0.7).length;
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
    <div class="bdg-hdr"><div class="bdg-hdr-left"><div class="bdg-hdr-title">🔄 Abastecimiento</div><div class="bdg-hdr-sub">% cumplimiento ingreso vs requerimiento por producto</div></div>${ua}</div>
    <div class="bdg-kpis">
      <div class="bdg-kpi bdg-kpi--green"><div class="bdg-kpi-lbl">Completados ≥100%</div><div class="bdg-kpi-val">${ok}</div></div>
      <div class="bdg-kpi bdg-kpi--orange"><div class="bdg-kpi-lbl">En proceso 70–99%</div><div class="bdg-kpi-val">${med}</div></div>
      <div class="bdg-kpi bdg-kpi--red"><div class="bdg-kpi-lbl">Críticos &lt;70%</div><div class="bdg-kpi-val">${crit}</div></div>
      <div class="bdg-kpi"><div class="bdg-kpi-lbl">Total productos</div><div class="bdg-kpi-val">${rows.length}</div></div>
    </div>
    <div class="bdg-card-grid">${cards}</div>
  </div>`;
}

/* ─────────────── 3. PROVEEDORES ─────────────── */
function renderProveedores(d,ua){
  const rows=d.proveedores||[];
  if(!rows.length)return`<div class="bdg-empty"><div class="bdg-empty-icon">🏭</div><div class="bdg-empty-msg">Sin datos de proveedores</div></div>`;
  const totP=rows.reduce((a,r)=>a+(r.planificado||0),0);
  const totI=rows.reduce((a,r)=>a+(r.ingresos||0),0);
  const glob=totP>0?totI/totP:0;
  const trs=rows.map(r=>{
    const c=_C(r.pct);
    return`<tr>
      <td style="font-weight:600;color:#1E293B">${r.producto||'—'}</td>
      ${_td(r.planificado)}
      ${_td(r.ingresos)}
      <td style="min-width:170px">
        <div style="display:flex;flex-direction:column;gap:3px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            ${_badge(r.pct)}
            <span style="font-size:10px;color:#64748B">${_N(r.ingresos)} / ${_N(r.planificado)}</span>
          </div>
          ${_bar(r.pct,c.bar,6)}
        </div>
      </td>
    </tr>`;
  }).join('');
  return`<div class="bdg-section">
    <div class="bdg-hdr"><div class="bdg-hdr-left"><div class="bdg-hdr-title">🏭 Proveedores</div><div class="bdg-hdr-sub">Planificado vs ingresos reales · % cumplimiento</div></div>${ua}</div>
    <div class="bdg-kpis">
      <div class="bdg-kpi bdg-kpi--blue"><div class="bdg-kpi-lbl">Total planificado</div><div class="bdg-kpi-val">${_N(totP)}</div></div>
      <div class="bdg-kpi bdg-kpi--green"><div class="bdg-kpi-lbl">Total ingresos</div><div class="bdg-kpi-val">${_N(totI)}</div></div>
      <div class="bdg-kpi bdg-kpi--orange"><div class="bdg-kpi-lbl">Cumplimiento global</div><div class="bdg-kpi-val" style="color:${_C(glob).fg}">${_P(glob)}</div></div>
      <div class="bdg-kpi"><div class="bdg-kpi-lbl">Proveedores</div><div class="bdg-kpi-val">${rows.length}</div></div>
    </div>
    <div class="bdg-tbl-wrap">
      <table class="bdg-tbl">
        <thead><tr>${_hdr('Proveedor / Producto')}${_hdr('Planificado',true)}${_hdr('Ingresos',true)}${_hdr('Cumplimiento')}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
  </div>`;
}

/* ─────────────── 4. LOTES FINALES ─────────────── */
function renderLotesFinales(d,ua){
  const rows=d.lotesFinales||[];
  if(!rows.length)return`<div class="bdg-empty"><div class="bdg-empty-icon">📋</div><div class="bdg-empty-msg">Sin datos de lotes finales</div></div>`;
  const ok=rows.filter(r=>(r.pct||0)>=1).length;
  const crit=rows.filter(r=>(r.pct||0)<0.7).length;
  const cards=rows.map(r=>{
    const c=_C(r.pct),p=Math.min(100,Math.max(0,(r.pct||0)*100)),neg=(r.porRecibir||0)<0;
    return`<div class="bdg-card" style="border-left:4px solid ${c.bar}">
      <div class="bdg-card-name">${r.producto||'—'}</div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div class="bdg-card-pct" style="color:${c.fg}">${_P(r.pct)}</div>
        ${r.lotes&&r.lotes!=='—'?`<span style="font-size:9px;background:#F1F5F9;border-radius:4px;padding:2px 6px;color:#64748B">${r.lotes}</span>`:''}
      </div>
      <div class="bdg-bar-track" style="height:7px"><div style="width:${p}%;background:${c.bar};height:100%;border-radius:999px"></div></div>
      <div class="bdg-card-detail">
        <span style="color:${neg?'#EF4444':'#64748B'}">Por recibir: <strong style="color:${neg?'#EF4444':'var(--navy)'}">${_N(r.porRecibir)}</strong></span>
      </div>
    </div>`;
  }).join('');
  return`<div class="bdg-section">
    <div class="bdg-hdr"><div class="bdg-hdr-left"><div class="bdg-hdr-title">📋 Lotes Finales</div><div class="bdg-hdr-sub">Cobertura de lotes · saldo por recibir</div></div>${ua}</div>
    <div class="bdg-kpis">
      <div class="bdg-kpi bdg-kpi--green"><div class="bdg-kpi-lbl">Completados ≥100%</div><div class="bdg-kpi-val">${ok}</div></div>
      <div class="bdg-kpi bdg-kpi--red"><div class="bdg-kpi-lbl">Críticos &lt;70%</div><div class="bdg-kpi-val">${crit}</div></div>
      <div class="bdg-kpi"><div class="bdg-kpi-lbl">Total productos</div><div class="bdg-kpi-val">${rows.length}</div></div>
    </div>
    <div class="bdg-card-grid">${cards}</div>
  </div>`;
}

/* ─────────────── 5. REQUERIMIENTO DIARIO ─────────────── */
function renderReqDiario(d,ua){
  const rows=d.requerimientoDiario||[];
  if(!rows.length)return`<div class="bdg-empty"><div class="bdg-empty-icon">📅</div><div class="bdg-empty-msg">Sin datos de requerimiento diario</div></div>`;
  const maxD=Math.max(...rows.map(r=>(r.dias||[]).length));
  const trs=rows.map(r=>{
    const dias=Array.isArray(r.dias)?r.dias:[];
    return`<tr>
      <td style="font-weight:600;color:#1E293B;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.producto||'—'}</td>
      <td style="min-width:72px">${_spark(dias)}</td>
      <td class="r" style="font-weight:700;color:var(--orange)">${_N(r.distributivo)}</td>
      <td class="r">${r.numDias||'—'}</td>
    </tr>`;
  }).join('');
  return`<div class="bdg-section">
    <div class="bdg-hdr"><div class="bdg-hdr-left"><div class="bdg-hdr-title">📅 Requerimiento Diario</div><div class="bdg-hdr-sub">Distribución requerida por día · la barra muestra la tendencia</div></div>${ua}</div>
    <div class="bdg-tbl-wrap">
      <table class="bdg-tbl">
        <thead><tr>${_hdr('Producto')}${_hdr('Tendencia diaria')}${_hdr('Distributivo',true)}${_hdr('Días',true)}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
  </div>`;
}

/* ─────────────── 6. LAST MILE ─────────────── */
function renderLastMile(d,ua){
  const lm=d.lastmile||{};
  const notas=d.notasEntrega||{};
  const hasNotas=notas.planificadas!=null;
  const pctRec=hasNotas&&notas.planificadas>0?notas.recibidas/notas.planificadas:0;
  const notasHtml=hasNotas?`
    <div class="bdg-stat-strip">
      <div class="bdg-stat bdg-kpi--blue"><div class="bdg-stat-lbl">Planificadas</div><div class="bdg-stat-val">${_N(notas.planificadas)}</div></div>
      <div class="bdg-stat bdg-kpi--green"><div class="bdg-stat-lbl">Recibidas</div><div class="bdg-stat-val">${_N(notas.recibidas)}</div></div>
      <div class="bdg-stat bdg-kpi--red"><div class="bdg-stat-lbl">Pendientes</div><div class="bdg-stat-val">${_N(notas.pendientes)}</div></div>
      <div class="bdg-stat bdg-kpi--orange"><div class="bdg-stat-lbl">% Recibidas</div><div class="bdg-stat-val">${notas.pctRecibidas||_P(pctRec)}</div></div>
    </div>
    <div style="background:#fff;border-radius:10px;border:1px solid #E2E8F0;padding:12px 16px">
      <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:600;color:#64748B;margin-bottom:6px"><span>Progreso de recepción</span><span style="color:${_C(pctRec).fg}">${_P(pctRec)}</span></div>
      ${_bar(pctRec,_C(pctRec).bar,10)}
    </div>`:''
  const detalleHtml=Array.isArray(lm.detalle)&&lm.detalle.length?`
    <div style="font-size:11px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.3px;margin-top:4px">Detalle de entregas</div>
    <div class="bdg-tbl-wrap">
      <table class="bdg-tbl">
        <thead><tr>${Object.keys(lm.detalle[0]).map(k=>`<th>${k}</th>`).join('')}</tr></thead>
        <tbody>${lm.detalle.slice(0,80).map(r=>`<tr>${Object.values(r).map(v=>`<td style="font-size:11px">${v??'—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
    ${lm.detalle.length>80?`<div style="font-size:10px;color:#94A3B8;text-align:center;padding:6px">Mostrando 80 de ${lm.detalle.length} registros</div>`:''}`:''
  if(!hasNotas&&!detalleHtml)return`<div class="bdg-empty"><div class="bdg-empty-icon">🚚</div><div class="bdg-empty-msg">Sin datos de Last Mile</div></div>`;
  return`<div class="bdg-section">
    <div class="bdg-hdr"><div class="bdg-hdr-left"><div class="bdg-hdr-title">🚚 Last Mile</div><div class="bdg-hdr-sub">Notas de entrega y estado de distribución</div></div>${ua}</div>
    ${notasHtml}${detalleHtml}
  </div>`;
}

/* ─────────────── 7. INVENTARIO ─────────────── */
function renderInventario(d,ua){
  const rows=d.inventario||[];
  if(!rows.length)return`<div class="bdg-empty"><div class="bdg-empty-icon">🗃️</div><div class="bdg-empty-msg">Sin datos de inventario</div></div>`;
  const trs=rows.map(r=>{
    const num=Number(r.ajuste),isNum=!isNaN(num)&&r.ajuste!=null&&r.ajuste!=='';
    const neg=isNum&&num<0,pos=isNum&&num>0;
    const cls=neg?'neg':pos?'pos':'nm';
    const icon=neg?'▼ ':pos?'▲ ':'';
    return`<tr>
      <td style="font-weight:600;color:#1E293B">${r.producto||'—'}</td>
      <td class="r ${cls}">${icon}${isNum?_N(num):(r.ajuste||'—')}</td>
    </tr>`;
  }).join('');
  return`<div class="bdg-section">
    <div class="bdg-hdr"><div class="bdg-hdr-left"><div class="bdg-hdr-title">🗃️ Inventario</div><div class="bdg-hdr-sub">Ajustes y saldos de inventario por producto</div></div>${ua}</div>
    <div class="bdg-tbl-wrap" style="max-width:540px">
      <table class="bdg-tbl">
        <thead><tr>${_hdr('Producto')}${_hdr('Ajuste / Saldo',true)}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
  </div>`;
}

/* ─────────────── 8. INVENTARIO SEMANAL ─────────────── */
function renderInvSemanal(d,ua){
  const rows=d.inventarioSemanal||[];
  if(!rows.length)return`<div class="bdg-empty"><div class="bdg-empty-icon">📆</div><div class="bdg-empty-msg">Sin datos de inventario semanal</div></div>`;
  const keys=Object.keys(rows[0]||{}).filter(k=>k!=='dia');
  const colsHtml=keys.map(k=>`<th style="text-transform:capitalize">${k}</th>`).join('');
  const trs=rows.map(r=>{
    const cells=keys.map(k=>`<td style="font-size:11px">${r[k]||'—'}</td>`).join('');
    return`<tr><td style="font-weight:700;color:var(--orange);text-transform:uppercase;white-space:nowrap">${r.dia||'—'}</td>${cells}</tr>`;
  }).join('');
  return`<div class="bdg-section">
    <div class="bdg-hdr"><div class="bdg-hdr-left"><div class="bdg-hdr-title">📆 Inventario Semanal</div><div class="bdg-hdr-sub">Distribución de productos por día de la semana</div></div>${ua}</div>
    <div class="bdg-tbl-wrap">
      <table class="bdg-tbl">
        <thead><tr><th>Día</th>${colsHtml}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
  </div>`;
}
