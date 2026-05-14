/* ═══════════════════════════════════════════════════════════
   BODEGA — Módulo de gestión de inventario y abastecimiento
═══════════════════════════════════════════════════════════ */

let _bodegaData = null;
let _bodegaView = 'cobertura';

async function loadBodega(){
  const wrap = document.getElementById('bodega-content');
  if(!wrap) return;
  wrap.innerHTML = '<div style="text-align:center;padding:60px 24px;color:var(--gray-400)"><div style="font-size:32px;margin-bottom:10px">⏳</div><div style="font-size:13px">Cargando datos de bodega…</div></div>';
  try {
    _bodegaData = await fetchBodegaFromGitHub();
  } catch(e){ _bodegaData = null; }
  if(!_bodegaData){
    wrap.innerHTML = '<div style="text-align:center;padding:60px 24px;color:var(--gray-400)"><div style="font-size:40px;margin-bottom:12px">📦</div><div style="font-size:15px;font-weight:700;color:var(--navy);margin-bottom:6px">Sin datos de bodega</div><div style="font-size:12px">Ejecuta el script <strong>sync-bodega.ps1</strong> para sincronizar desde Excel.</div></div>';
    return;
  }
  renderBodegaTabs();
  renderBodegaView(_bodegaView);
}

function switchBodegaView(view){
  _bodegaView = view;
  document.querySelectorAll('.bdg-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  renderBodegaView(view);
}

function renderBodegaTabs(){
  const bar = document.getElementById('bodega-tabs');
  if(!bar) return;
  const tabs = [
    {id:'cobertura',    label:'Cobertura',          icon:'📊'},
    {id:'abastecimiento',label:'Abastecimiento',    icon:'🔄'},
    {id:'proveedores',  label:'Proveedores',         icon:'🏭'},
    {id:'lotesFinales', label:'Lotes Finales',       icon:'📋'},
    {id:'reqDiario',    label:'Requerimiento Diario',icon:'📅'},
    {id:'lastmile',     label:'Last Mile',           icon:'🚚'},
    {id:'inventario',   label:'Inventario',          icon:'🗃️'},
    {id:'invSemanal',   label:'Inv. Semanal',        icon:'📆'},
  ];
  bar.innerHTML = tabs.map(t =>
    `<button class="bdg-tab${t.id===_bodegaView?' active':''}" data-view="${t.id}" onclick="switchBodegaView('${t.id}')">
      <span class="bdg-tab-icon">${t.icon}</span><span class="bdg-tab-label">${t.label}</span>
    </button>`
  ).join('');
}

function renderBodegaView(view){
  const wrap = document.getElementById('bodega-content');
  if(!wrap || !_bodegaData) return;
  const d = _bodegaData;
  const updAt = d.updatedAt ? `<span style="font-size:10px;color:var(--gray-400);margin-left:8px">Actualizado: ${d.updatedAt}</span>` : '';

  switch(view){
    case 'cobertura':     wrap.innerHTML = renderCobertura(d, updAt); break;
    case 'abastecimiento':wrap.innerHTML = renderAbastecimiento(d, updAt); break;
    case 'proveedores':   wrap.innerHTML = renderProveedores(d, updAt); break;
    case 'lotesFinales':  wrap.innerHTML = renderLotesFinales(d, updAt); break;
    case 'reqDiario':     wrap.innerHTML = renderReqDiario(d, updAt); break;
    case 'lastmile':      wrap.innerHTML = renderLastMile(d, updAt); break;
    case 'inventario':    wrap.innerHTML = renderInventario(d, updAt); break;
    case 'invSemanal':    wrap.innerHTML = renderInvSemanal(d, updAt); break;
    default: wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray-400)">Vista no disponible</div>';
  }
}

/* ── helpers ── */
function _fmt(n, dec=0){
  if(n==null||n===''||isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('es-EC',{minimumFractionDigits:dec,maximumFractionDigits:dec});
}
function _pct(v){
  if(v==null||isNaN(Number(v))) return '—';
  return (Number(v)*100).toFixed(1)+'%';
}
function _pctColor(v){
  const p = Number(v)*100;
  if(p>=95) return {bg:'#DCFCE7',color:'#166534',bar:'#1F9D55'};
  if(p>=70) return {bg:'#FEF3C7',color:'#92400E',bar:'#F59E0B'};
  return {bg:'#FEE2E2',color:'#991B1B',bar:'#EF4444'};
}
function _pctBadge(v){
  const c = _pctColor(v);
  return `<span style="background:${c.bg};color:${c.color};border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700">${_pct(v)}</span>`;
}
function _barHtml(pct, color='#F47C20', h=6){
  const w = Math.max(0,Math.min(100,Number(pct)*100));
  return `<div style="background:#EEF1F7;border-radius:999px;height:${h}px;margin-top:4px;overflow:hidden"><div style="width:${w}%;height:100%;background:${color};border-radius:999px;transition:width .4s"></div></div>`;
}
function _sectionHead(title, sub='', updAt=''){
  return `<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <div>
      <div style="font-size:16px;font-weight:800;color:var(--navy)">${title}</div>
      ${sub?`<div style="font-size:11px;color:var(--gray-600);margin-top:2px">${sub}</div>`:''}
    </div>
    ${updAt}
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   1. COBERTURA — % por producto con barra de días
═══════════════════════════════════════════════════════════ */
function renderCobertura(d, updAt){
  const rows = d.cobertura||[];
  if(!rows.length) return '<div class="bdg-empty">Sin datos de cobertura</div>';

  // Summary KPIs
  const totalIngresos = rows.reduce((a,r)=>a+(r.ingresos||0),0);
  const totalReq      = rows.reduce((a,r)=>a+(r.totalReq||0),0);
  const avgPct        = totalReq>0 ? totalIngresos/totalReq : 0;

  const kpis = `
  <div class="bdg-kpi-row">
    <div class="bdg-kpi"><div class="bdg-kpi-label">Total ingresos</div><div class="bdg-kpi-val">${_fmt(totalIngresos)}</div></div>
    <div class="bdg-kpi"><div class="bdg-kpi-label">Total requerido</div><div class="bdg-kpi-val">${_fmt(totalReq)}</div></div>
    <div class="bdg-kpi bdg-kpi-accent"><div class="bdg-kpi-label">Cobertura global</div><div class="bdg-kpi-val">${_pct(avgPct)}</div></div>
    <div class="bdg-kpi"><div class="bdg-kpi-label">Productos</div><div class="bdg-kpi-val">${rows.length}</div></div>
  </div>`;

  const tableRows = rows.map(r => {
    const c = _pctColor(r.pct);
    const porDia = Array.isArray(r.porDia) ? r.porDia : [];
    const barCells = porDia.map((v,i) => {
      const neg = v<0;
      return `<td style="text-align:right;font-size:10px;color:${neg?'#EF4444':'var(--navy)'};white-space:nowrap;padding:2px 6px">${_fmt(v)}</td>`;
    }).join('');
    return `<tr>
      <td style="font-weight:600;color:var(--navy);white-space:nowrap">${r.producto||'—'}</td>
      <td style="text-align:right">${_fmt(r.ingresos)}</td>
      <td style="text-align:right">${_fmt(r.totalReq)}</td>
      <td style="text-align:right;color:${(r.saldo||0)<0?'#EF4444':'var(--navy)'}">${_fmt(r.saldo)}</td>
      <td style="min-width:120px">
        <div style="display:flex;align-items:center;gap:6px">
          ${_pctBadge(r.pct)}
          ${_barHtml(r.pct, c.bar, 5)}
        </div>
      </td>
      ${barCells}
      <td style="text-align:right;color:${(r.porRecibir||0)<0?'#EF4444':'var(--navy)'}">${_fmt(r.porRecibir)}</td>
    </tr>`;
  }).join('');

  // Dynamic day headers
  const firstRow = rows[0];
  const numDias = Array.isArray(firstRow?.porDia) ? firstRow.porDia.length : 0;
  const dayHeaders = Array.from({length:numDias},(_,i)=>`<th style="text-align:right;white-space:nowrap">D${i+1}</th>`).join('');

  return `<div class="bdg-section">
    ${_sectionHead('📊 Cobertura de productos','Ingresos vs requerimiento total por producto',updAt)}
    ${kpis}
    <div class="bdg-table-wrap">
      <table class="bdg-table">
        <thead><tr>
          <th>Producto</th>
          <th style="text-align:right">Ingresos</th>
          <th style="text-align:right">Total req.</th>
          <th style="text-align:right">Saldo</th>
          <th style="min-width:140px">Cobertura</th>
          ${dayHeaders}
          <th style="text-align:right">Por recibir</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   2. ABASTECIMIENTO — % de abastecimiento por producto
═══════════════════════════════════════════════════════════ */
function renderAbastecimiento(d, updAt){
  const rows = d.abastecimiento||[];
  if(!rows.length) return '<div class="bdg-empty">Sin datos de abastecimiento</div>';

  const over100 = rows.filter(r=>(r.pct||0)>=1).length;
  const under70  = rows.filter(r=>(r.pct||0)<0.7).length;

  const kpis = `
  <div class="bdg-kpi-row">
    <div class="bdg-kpi bdg-kpi-green"><div class="bdg-kpi-label">≥100% abastecidos</div><div class="bdg-kpi-val">${over100}</div></div>
    <div class="bdg-kpi bdg-kpi-red"><div class="bdg-kpi-label">Críticos &lt;70%</div><div class="bdg-kpi-val">${under70}</div></div>
    <div class="bdg-kpi"><div class="bdg-kpi-label">Total productos</div><div class="bdg-kpi-val">${rows.length}</div></div>
  </div>`;

  const cards = rows.map(r => {
    const c = _pctColor(r.pct);
    const pNum = Math.max(0,Math.min(100,(r.pct||0)*100));
    return `<div class="bdg-abast-card" style="border-left:4px solid ${c.bar}">
      <div class="bdg-abast-name">${r.producto||'—'}</div>
      <div class="bdg-abast-pct" style="color:${c.color}">${_pct(r.pct)}</div>
      <div style="background:#EEF1F7;border-radius:999px;height:8px;margin:6px 0;overflow:hidden">
        <div style="width:${pNum}%;height:100%;background:${c.bar};border-radius:999px"></div>
      </div>
      <div class="bdg-abast-detail">
        <span>Ing: <strong>${_fmt(r.ingresos)}</strong></span>
        <span>Req: <strong>${_fmt(r.totalReq)}</strong></span>
        <span style="color:${(r.porRecibir||0)<0?'#EF4444':'var(--navy)'}">Por rec: <strong>${_fmt(r.porRecibir)}</strong></span>
      </div>
    </div>`;
  }).join('');

  return `<div class="bdg-section">
    ${_sectionHead('🔄 % de Abastecimiento','Porcentaje de cumplimiento de ingreso vs requerimiento',updAt)}
    ${kpis}
    <div class="bdg-abast-grid">${cards}</div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   3. PROVEEDORES
═══════════════════════════════════════════════════════════ */
function renderProveedores(d, updAt){
  const rows = d.proveedores||[];
  if(!rows.length) return '<div class="bdg-empty">Sin datos de proveedores</div>';

  const totalPlan = rows.reduce((a,r)=>a+(r.planificado||0),0);
  const totalIng  = rows.reduce((a,r)=>a+(r.ingresos||0),0);
  const avgPct    = totalPlan>0 ? totalIng/totalPlan : 0;

  const kpis = `<div class="bdg-kpi-row">
    <div class="bdg-kpi"><div class="bdg-kpi-label">Total planificado</div><div class="bdg-kpi-val">${_fmt(totalPlan)}</div></div>
    <div class="bdg-kpi"><div class="bdg-kpi-label">Total ingresos</div><div class="bdg-kpi-val">${_fmt(totalIng)}</div></div>
    <div class="bdg-kpi bdg-kpi-accent"><div class="bdg-kpi-label">Cumplimiento global</div><div class="bdg-kpi-val">${_pct(avgPct)}</div></div>
    <div class="bdg-kpi"><div class="bdg-kpi-label">Proveedores</div><div class="bdg-kpi-val">${rows.length}</div></div>
  </div>`;

  const tableRows = rows.map(r => {
    const c = _pctColor(r.pct);
    return `<tr>
      <td style="font-weight:600;color:var(--navy)">${r.producto||'—'}</td>
      <td style="text-align:right">${_fmt(r.planificado)}</td>
      <td style="text-align:right">${_fmt(r.ingresos)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;min-width:120px">
          ${_pctBadge(r.pct)}
          ${_barHtml(r.pct, c.bar, 5)}
        </div>
      </td>
    </tr>`;
  }).join('');

  return `<div class="bdg-section">
    ${_sectionHead('🏭 Proveedores','Planificado vs ingresos reales por proveedor/producto',updAt)}
    ${kpis}
    <div class="bdg-table-wrap">
      <table class="bdg-table">
        <thead><tr>
          <th>Producto / Proveedor</th>
          <th style="text-align:right">Planificado</th>
          <th style="text-align:right">Ingresos</th>
          <th style="min-width:160px">Cumplimiento</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   4. LOTES FINALES
═══════════════════════════════════════════════════════════ */
function renderLotesFinales(d, updAt){
  const rows = d.lotesFinales||[];
  if(!rows.length) return '<div class="bdg-empty">Sin datos de lotes finales</div>';

  const ok  = rows.filter(r=>(r.pct||0)>=1).length;
  const crit = rows.filter(r=>(r.pct||0)<0.7).length;

  const kpis = `<div class="bdg-kpi-row">
    <div class="bdg-kpi bdg-kpi-green"><div class="bdg-kpi-label">Completados ≥100%</div><div class="bdg-kpi-val">${ok}</div></div>
    <div class="bdg-kpi bdg-kpi-red"><div class="bdg-kpi-label">Críticos &lt;70%</div><div class="bdg-kpi-val">${crit}</div></div>
    <div class="bdg-kpi"><div class="bdg-kpi-label">Total productos</div><div class="bdg-kpi-val">${rows.length}</div></div>
  </div>`;

  const tableRows = rows.map(r => {
    const c = _pctColor(r.pct);
    const neg = (r.porRecibir||0)<0;
    return `<tr>
      <td style="font-weight:600;color:var(--navy)">${r.producto||'—'}</td>
      <td style="text-align:right;color:${neg?'#EF4444':'var(--navy)'}">${_fmt(r.porRecibir)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;min-width:120px">
          ${_pctBadge(r.pct)}
          ${_barHtml(r.pct, c.bar, 5)}
        </div>
      </td>
      <td style="font-size:11px;color:var(--gray-600)">${r.lotes||'—'}</td>
    </tr>`;
  }).join('');

  return `<div class="bdg-section">
    ${_sectionHead('📋 Lotes Finales','Saldo por recibir y cobertura de lotes',updAt)}
    ${kpis}
    <div class="bdg-table-wrap">
      <table class="bdg-table">
        <thead><tr>
          <th>Producto</th>
          <th style="text-align:right">Por recibir</th>
          <th style="min-width:160px">Cobertura</th>
          <th>Lotes</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   5. REQUERIMIENTO DIARIO
═══════════════════════════════════════════════════════════ */
function renderReqDiario(d, updAt){
  const rows = d.requerimientoDiario||[];
  if(!rows.length) return '<div class="bdg-empty">Sin datos de requerimiento diario</div>';

  const maxDias = Math.max(...rows.map(r=>(r.dias||[]).length));

  const dayHeaders = Array.from({length:maxDias},(_,i)=>`<th style="text-align:right;white-space:nowrap">D${i+1}</th>`).join('');

  const tableRows = rows.map(r => {
    const dias = Array.isArray(r.dias) ? r.dias : [];
    const diaCells = Array.from({length:maxDias},(_,i)=>{
      const v = dias[i];
      return `<td style="text-align:right;font-size:11px;white-space:nowrap">${v!=null&&v!==''?_fmt(v):'—'}</td>`;
    }).join('');
    return `<tr>
      <td style="font-weight:600;color:var(--navy);white-space:nowrap">${r.producto||'—'}</td>
      <td style="text-align:right;font-weight:700;color:var(--orange)">${_fmt(r.distributivo)}</td>
      ${diaCells}
    </tr>`;
  }).join('');

  return `<div class="bdg-section">
    ${_sectionHead('📅 Requerimiento Diario','Distribución requerida por día y producto',updAt)}
    <div class="bdg-table-wrap">
      <table class="bdg-table">
        <thead><tr>
          <th>Producto</th>
          <th style="text-align:right">Distributivo</th>
          ${dayHeaders}
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   6. LAST MILE
═══════════════════════════════════════════════════════════ */
function renderLastMile(d, updAt){
  const lm = d.lastmile||{};
  const notas = d.notasEntrega||{};

  // Notas de entrega summary
  const notasHtml = notas.planificadas != null ? `
  <div class="bdg-kpi-row" style="margin-bottom:20px">
    <div class="bdg-kpi"><div class="bdg-kpi-label">Notas planificadas</div><div class="bdg-kpi-val">${_fmt(notas.planificadas)}</div></div>
    <div class="bdg-kpi bdg-kpi-green"><div class="bdg-kpi-label">Recibidas</div><div class="bdg-kpi-val">${_fmt(notas.recibidas)}</div></div>
    <div class="bdg-kpi bdg-kpi-red"><div class="bdg-kpi-label">Pendientes</div><div class="bdg-kpi-val">${_fmt(notas.pendientes)}</div></div>
    <div class="bdg-kpi bdg-kpi-accent"><div class="bdg-kpi-label">% Recibidas</div><div class="bdg-kpi-val">${notas.pctRecibidas||'—'}</div></div>
  </div>` : '';

  // Resumen
  const resumen = Array.isArray(lm.resumen)&&lm.resumen.length ? `
  <div style="margin-bottom:20px">
    <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px;text-transform:uppercase;letter-spacing:.3px">Resumen</div>
    <div class="bdg-table-wrap">
      <table class="bdg-table">
        <thead><tr>${Object.keys(lm.resumen[0]).map(k=>`<th>${k}</th>`).join('')}</tr></thead>
        <tbody>${lm.resumen.map(r=>`<tr>${Object.values(r).map(v=>`<td style="font-size:11px">${v??'—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
  </div>` : '';

  // Detalle
  const detalle = Array.isArray(lm.detalle)&&lm.detalle.length ? `
  <div>
    <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px;text-transform:uppercase;letter-spacing:.3px">Detalle de entregas</div>
    <div class="bdg-table-wrap">
      <table class="bdg-table">
        <thead><tr>${Object.keys(lm.detalle[0]).map(k=>`<th>${k}</th>`).join('')}</tr></thead>
        <tbody>${lm.detalle.slice(0,100).map(r=>`<tr>${Object.values(r).map(v=>`<td style="font-size:11px">${v??'—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
    ${lm.detalle.length>100?`<div style="font-size:10px;color:var(--gray-400);text-align:center;padding:8px">Mostrando 100 de ${lm.detalle.length} registros</div>`:''}
  </div>` : '';

  if(!notasHtml && !resumen && !detalle)
    return '<div class="bdg-empty">Sin datos de Last Mile</div>';

  return `<div class="bdg-section">
    ${_sectionHead('🚚 Last Mile','Notas de entrega y estado de distribución',updAt)}
    ${notasHtml}
    ${resumen}
    ${detalle}
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   7. INVENTARIO
═══════════════════════════════════════════════════════════ */
function renderInventario(d, updAt){
  const rows = d.inventario||[];
  if(!rows.length) return '<div class="bdg-empty">Sin datos de inventario</div>';

  // Try to detect if rows have numeric values (adjustments)
  const hasNumeric = rows.some(r => !isNaN(Number(r.ajuste)));

  const tableRows = rows.map(r => {
    const val = r.ajuste;
    const num = Number(val);
    const isNum = !isNaN(num) && val!=='' && val!=null;
    const neg = isNum && num < 0;
    const pos = isNum && num > 0;
    const color = neg?'#EF4444': pos?'#1F9D55':'var(--navy)';
    const displayVal = isNum ? _fmt(num) : (val||'—');
    return `<tr>
      <td style="font-weight:600;color:var(--navy)">${r.producto||'—'}</td>
      <td style="text-align:right;color:${color};font-weight:${isNum?'700':'400'}">${displayVal}</td>
    </tr>`;
  }).join('');

  return `<div class="bdg-section">
    ${_sectionHead('🗃️ Inventario','Ajustes y saldos de inventario',updAt)}
    <div class="bdg-table-wrap" style="max-width:600px">
      <table class="bdg-table">
        <thead><tr>
          <th>Producto</th>
          <th style="text-align:right">Ajuste / Saldo</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   8. INVENTARIO SEMANAL
═══════════════════════════════════════════════════════════ */
function renderInvSemanal(d, updAt){
  const rows = d.inventarioSemanal||[];
  if(!rows.length) return '<div class="bdg-empty">Sin datos de inventario semanal</div>';

  // Detect columns dynamically from first row
  const firstRow = rows[0]||{};
  const keys = Object.keys(firstRow).filter(k=>k!=='dia'&&k!=='__rowNum');
  const headers = keys.map(k=>`<th style="text-transform:capitalize">${k}</th>`).join('');

  const tableRows = rows.map(r => {
    const cells = keys.map(k=>`<td style="font-size:11px;color:var(--navy)">${r[k]||'—'}</td>`).join('');
    return `<tr>
      <td style="font-weight:700;color:var(--orange);text-transform:uppercase;white-space:nowrap">${r.dia||'—'}</td>
      ${cells}
    </tr>`;
  }).join('');

  return `<div class="bdg-section">
    ${_sectionHead('📆 Inventario Semanal','Distribución de productos por día de la semana',updAt)}
    <div class="bdg-table-wrap">
      <table class="bdg-table">
        <thead><tr>
          <th>Día</th>
          ${headers}
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </div>`;
}
