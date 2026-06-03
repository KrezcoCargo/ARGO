/* ═══════════════════════════════════════════════════════════
   CONTEO DE INVENTARIO  — conteo.js  v6
   · Múltiples filas de pallets × cajas/pallet (auto-add, sin saltar cursor)
   · Productos unificados ("en conjunto") y esperado sincronizado desde
     PROYECCIONES.xlsm (hoja INVENTARIO) vía data/conteo-config.json
   · Validación falta/sobra con colchón % + confirmación por doble conteo
═══════════════════════════════════════════════════════════ */

const DIAS_ORD = ['LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO','DOMINGO'];

/* ── Storage keys ── */
const _CONTEO_LOG_KEY = 'kc_conteo_log_v1';
const _CONTEO_TOL_KEY = 'kc_tolerancia_v1';   // tolerancia % por grupo (admin)

/* ── Estado en memoria ── */
let _conteoLog    = [];
let _conteoConfig = { grupos: [] };  // esperado/caja por grupo (sincronizado)
let _tolerancia   = {};              // { grupo: porcentaje }
let _firstAttempt = {};              // { key: unidadesContadas } primer intento fuera de rango
let _confirmed    = {};              // { key: true } aceptado por doble conteo
const _TOL_DEFAULT = 1;              // % por defecto (columna E de tu Excel)

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
async function loadConteo(){
  try { _conteoLog  = JSON.parse(localStorage.getItem(_CONTEO_LOG_KEY)||'[]'); } catch{}
  try { _tolerancia = JSON.parse(localStorage.getItem(_CONTEO_TOL_KEY)||'{}'); } catch{}

  const el = document.getElementById('pg-conteo');
  if(el && (!_bodegaData || !_conteoConfig.grupos.length)){
    el.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;height:220px;gap:14px;color:#94A3B8">
      <div style="width:26px;height:26px;border:3px solid #E2E8F0;border-top-color:#F47C20;border-radius:50%;animation:bdgSpin .8s linear infinite"></div>
      <div style="font-size:13px;font-weight:600">Cargando datos…</div></div>`;
  }
  if(!_bodegaData){
    try { _bodegaData = await fetchBodegaFromGitHub(); } catch(e){ _bodegaData = null; }
  }
  // Config de conteo (esperado sincronizado)
  try {
    const cc = await fetchConteoConfigFromGitHub();
    if(cc && Array.isArray(cc.grupos)) _conteoConfig = cc;
  } catch{}

  renderConteoPage();
}

/* ══════════════════════════════════════════════════════════
   HELPERS DE DATOS
══════════════════════════════════════════════════════════ */
function _getSemRows(){ return (_bodegaData||{}).inventarioSemanal || []; }
function _getAllProductos(){
  const prov = ((_bodegaData||{}).proveedores||[]).map(r=>r.producto).filter(Boolean);
  const cob  = ((_bodegaData||{}).cobertura||[]).map(r=>r.producto).filter(Boolean);
  return [...new Set([...prov,...cob])].sort();
}
function _getOperadores(){
  const sem = _getSemRows();
  if(!sem.length) return [];
  return Object.keys(sem[0]).filter(k=>k!=='dia'&&k!=='__rowNum'&&k!=='orden');
}
function _getDias(){
  const dias = [...new Set(_getSemRows().map(r=>r.dia).filter(Boolean))];
  return dias.sort((a,b)=>DIAS_ORD.indexOf(a.toUpperCase())-DIAS_ORD.indexOf(b.toUpperCase()));
}
function _getTodayDia(availDias){
  const WD_ES = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
  const hoy = WD_ES[new Date().getDay()];
  return availDias.find(d=>_norm(d)===_norm(hoy)) || availDias[0] || '';
}
function _getMyOperador(){
  if(!SESSION) return null;
  const ops = _getOperadores();
  if(!ops.length) return null;
  const me = (SESSION.name||SESSION.username||'').toLowerCase().trim();
  return ops.find(o=>o.toLowerCase()===me)
      || ops.find(o=>me.includes(o.toLowerCase())||o.toLowerCase().includes(me))
      || null;
}
function _getProductosDeOperador(op){
  const sem = _getSemRows();
  const prods = new Set();
  sem.forEach(row=>{
    const val = String(row[op]||'').trim();
    if(val && !val.toUpperCase().includes('INVENTARIO')){
      val.split(/[,;]/).map(v=>v.trim()).filter(Boolean).forEach(v=>prods.add(v));
    }
  });
  return [...prods].sort();
}
function _getProductosParaDia(dia, operador){
  const sem = _getSemRows();
  const rows = sem.filter(r=>(r.dia||'').toUpperCase()===dia.toUpperCase());
  if(!rows.length) return [];
  const opValues = rows.map(r=>(r[operador]||'')).filter(Boolean);
  const esGeneral = opValues.some(v=>v.toUpperCase().includes('INVENTARIO GENERAL'));
  if(esGeneral){
    const opProds = _getProductosDeOperador(operador);
    return opProds.length ? opProds : _getAllProductos();
  }
  return opValues.filter(v=>v && !v.toUpperCase().includes('INVENTARIO'));
}

/* ── Normalización + matching de nombres a grupos del config ── */
function _norm(s){
  return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toUpperCase().replace(/\s+/g,' ').trim();
}
function _matchConfigGroup(prod){
  const grupos = _conteoConfig.grupos||[];
  if(!grupos.length) return null;
  const n = _norm(prod);
  // 1) exacto
  let g = grupos.find(x=>_norm(x.grupo)===n);
  if(g) return g;
  // 2) el nombre contiene al grupo o viceversa
  g = grupos.find(x=>{const gn=_norm(x.grupo);return n.includes(gn)||gn.includes(n);});
  if(g) return g;
  // 3) coincidencia por producto detalle
  g = grupos.find(x=>(x.detalles||[]).some(d=>{const dn=_norm(d.producto);return dn.includes(n)||n.includes(dn);}));
  return g||null;
}
function _tolPct(grupo){
  return (_tolerancia[grupo]!=null && _tolerancia[grupo]!=='') ? Number(_tolerancia[grupo]) : _TOL_DEFAULT;
}

/* ══════════════════════════════════════════════════════════
   STORAGE HELPERS (inputs del conteo)
══════════════════════════════════════════════════════════ */
function _saveConteoEntry(key, obj){ localStorage.setItem(`kc_ce_${key}`, JSON.stringify(obj)); }
function _loadConteoEntry(key){ try { return JSON.parse(localStorage.getItem(`kc_ce_${key}`)||'{}'); } catch{ return {}; } }
function _normalizeEntry(saved){
  let rows = saved.rows;
  if(!Array.isArray(rows)){
    rows = (saved.pallets!=null||saved.cajasXPlt!=null)
      ? [{pallets:saved.pallets||'', cajasXPlt:saved.cajasXPlt||''}]
      : [{pallets:'', cajasXPlt:''}];
  }
  if(!rows.length) rows = [{pallets:'', cajasXPlt:''}];
  return { rows, suelta:saved.suelta||'', unidades:saved.unidades||'' };
}

/* ══════════════════════════════════════════════════════════
   RENDERIZADO PRINCIPAL
══════════════════════════════════════════════════════════ */
function renderConteoPage(){
  const el = document.getElementById('pg-conteo');
  if(!el) return;

  const sem  = _getSemRows();
  const dias = _getDias();
  const ops  = _getOperadores();
  const isAdmin = SESSION && (SESSION.role==='superadmin'||SESSION.role==='editor');

  if(!sem.length){
    el.innerHTML=`<div style="text-align:center;padding:60px 24px;color:#64748B">
      <div style="font-size:44px;margin-bottom:12px">🧮</div>
      <div style="font-size:16px;font-weight:700;color:#14213D;margin-bottom:6px">Sin datos de inventario semanal</div>
      <div style="font-size:12px">Sincroniza los datos desde el botón Sync Bodega.</div>
    </div>`;
    return;
  }

  const myOp     = isAdmin ? null : _getMyOperador();
  const todayDia = _getTodayDia(dias);
  const savedDia = isAdmin ? (localStorage.getItem('kc_conteo_dia')||todayDia) : todayDia;
  const savedOp  = isAdmin ? (localStorage.getItem('kc_conteo_op')||ops[0]||'') : (myOp||ops[0]||'');
  const today    = new Date().toISOString().slice(0,10);
  const cfgTs    = _conteoConfig.updatedAt ? `· esperado actualizado ${_conteoConfig.updatedAt}` : '';

  el.innerHTML=`
  <div style="padding:16px 20px;max-width:960px;margin:0 auto">

    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px">
      <div style="font-size:18px;font-weight:800;color:#14213D;flex:1">🧮 Conteo de Inventario</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
        <div style="display:flex;flex-direction:column;gap:2px">
          <label style="${_ctLbl()}">Día</label>
          ${isAdmin
            ? `<select id="ct-dia" onchange="onConteoDiaChange()" style="${_ctSelect()}">
                 ${dias.map(d=>`<option value="${d}" ${d===savedDia?'selected':''}>${d.charAt(0)+d.slice(1).toLowerCase()}</option>`).join('')}
               </select>`
            : `<input type="hidden" id="ct-dia" value="${_safeAttr(savedDia)}">
               <div style="${_ctReadonly()}">📅 ${savedDia.charAt(0)+savedDia.slice(1).toLowerCase()}</div>`
          }
        </div>
        <div style="display:flex;flex-direction:column;gap:2px">
          <label style="${_ctLbl()}">Operador</label>
          ${isAdmin
            ? `<select id="ct-op" onchange="onConteoOpChange()" style="${_ctSelect()}">
                 ${ops.map(o=>`<option value="${o}" ${o===savedOp?'selected':''}>${o.charAt(0).toUpperCase()+o.slice(1)}</option>`).join('')}
               </select>`
            : `<input type="hidden" id="ct-op" value="${_safeAttr(savedOp)}">
               <div style="${_ctReadonly()}">👷 ${savedOp?savedOp.charAt(0).toUpperCase()+savedOp.slice(1):'—'}</div>`
          }
        </div>
        ${isAdmin
          ? `<div style="display:flex;flex-direction:column;gap:2px">
               <label style="${_ctLbl()}">Fecha</label>
               <input type="date" id="ct-fecha" value="${today}" style="${_ctSelect()};min-width:130px">
             </div>`
          : `<input type="hidden" id="ct-fecha" value="${today}">
             <div style="display:flex;flex-direction:column;gap:2px">
               <label style="${_ctLbl()}">Fecha</label>
               <div style="${_ctReadonly()}">🗓 ${today}</div>
             </div>`
        }
      </div>
    </div>
    <div style="font-size:10px;color:#94A3B8;margin-bottom:16px">${cfgTs}</div>

    <div id="ct-productos"></div>

    <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px">
      <button onclick="ctReiniciar()" style="padding:10px 18px;border-radius:8px;border:1px solid #E2E8F0;background:#fff;color:#64748B;font-size:13px;font-weight:600;cursor:pointer">🔄 Reiniciar</button>
      <button onclick="ctGuardar()" style="padding:10px 22px;border-radius:8px;border:none;background:#1F9D55;color:#fff;font-size:13px;font-weight:700;cursor:pointer">✅ Guardar Conteo</button>
    </div>

    <div style="margin-top:24px">
      <div onclick="ctToggleLog()" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px 14px;background:#F1F5F9;border-radius:8px;user-select:none">
        <span style="font-size:13px;font-weight:700;color:#475569">📋 Historial de conteos</span>
        <span id="ct-log-arrow" style="margin-left:auto;color:#94A3B8;font-size:12px">▼</span>
      </div>
      <div id="ct-log-panel" style="display:none;margin-top:8px"></div>
    </div>

    ${isAdmin ? _renderAdminPanel() : ''}
  </div>`;

  _syncHiddenInput('ct-op', savedOp);
  renderConteoProductos();
}

function _ctLbl(){ return 'font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase'; }
function _ctSelect(){ return 'border:1px solid #E2E8F0;border-radius:8px;padding:6px 10px;font-size:13px;color:#14213D;background:#fff;cursor:pointer;min-width:110px'; }
function _ctReadonly(){ return `${_ctSelect()};background:#F1F5F9;cursor:default;color:#475569;font-weight:700`; }
function _ctInput(w){ return `border:1px solid #E2E8F0;border-radius:8px;padding:6px 8px;font-size:14px;font-weight:600;color:#14213D;width:${w};text-align:center;outline:none`; }
function _safeAttr(s){ return String(s||'').replace(/"/g,'&quot;'); }
function _syncHiddenInput(id, val){ const el=document.getElementById(id); if(el&&el.tagName==='INPUT')el.value=val; }

/* ══════════════════════════════════════════════════════════
   PRODUCTOS DEL DÍA
══════════════════════════════════════════════════════════ */
function renderConteoProductos(){
  const el = document.getElementById('ct-productos');
  if(!el) return;

  const dia  = (document.getElementById('ct-dia')||{}).value||'';
  const op   = (document.getElementById('ct-op')||{}).value||'';
  const prods = _getProductosParaDia(dia, op);

  const sem     = _getSemRows();
  const rows2   = sem.filter(r=>(r.dia||'').toUpperCase()===dia.toUpperCase());
  const opVals  = rows2.map(r=>(r[op]||'')).filter(Boolean);
  const esGeneral = opVals.some(v=>v.toUpperCase().includes('INVENTARIO GENERAL'));

  if(!prods.length){
    el.innerHTML=`<div style="text-align:center;padding:32px;color:#94A3B8;background:#F8FAFC;border-radius:12px">
      <div style="font-size:28px">📭</div>
      <div style="font-size:13px;margin-top:8px">No hay productos programados para este día y operador</div>
    </div>`;
    return;
  }

  el.innerHTML=`
  ${esGeneral?`<div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;font-weight:700;color:#92400E">📋 INVENTARIO GENERAL — Todos los productos de ${op.charAt(0).toUpperCase()+op.slice(1)}</div>`:''}
  <div style="display:flex;flex-direction:column;gap:10px">
    ${prods.map(prod=>_renderProductoCard(prod,dia,op)).join('')}
  </div>`;
}

function _renderProductoCard(prod, dia, op){
  const key   = `${dia}_${op}_${prod}`;
  const sk    = _safeId(key);
  const entry = _normalizeEntry(_loadConteoEntry(key));
  let   rows  = entry.rows;
  if(!rows.length || (rows[rows.length-1].pallets && rows[rows.length-1].cajasXPlt)){
    rows = [...rows, {pallets:'', cajasXPlt:''}];
  }
  const suelta   = entry.suelta;
  const unidades = entry.unidades;
  const subTotal  = rows.reduce((s,r)=>s+(Number(r.pallets)||0)*(Number(r.cajasXPlt)||0), 0);
  const totalCajas = subTotal + (Number(suelta)||0);
  const cfg = _matchConfigGroup(prod);
  const validHtml = _validarProducto(key, prod, totalCajas, Number(unidades)||0);
  const cajaInfo = cfg && cfg.caja ? `<span style="font-size:10px;color:#94A3B8;font-weight:600">· ${cfg.caja} u/caja</span>` : '';

  return `
  <div id="ct-card-${sk}" style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <div style="font-size:13px;font-weight:800;color:#14213D;margin-bottom:10px;text-transform:uppercase;letter-spacing:.4px;display:flex;align-items:center;gap:8px">
      📦 ${prod} ${cajaInfo}
    </div>

    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
      <span style="${_ctLbl()};width:68px;text-align:center">Pallets</span>
      <span style="width:16px"></span>
      <span style="${_ctLbl()};width:84px;text-align:center">Cajas / Pallet</span>
      <span style="width:16px"></span>
      <span style="${_ctLbl()};min-width:68px;text-align:center">Subtotal</span>
    </div>

    <div id="ct-rows-${sk}">
      ${rows.map((r,i)=>_rowHTML(sk,_escKey(key),r,i,rows.length)).join('')}
    </div>

    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;margin-bottom:10px;padding-top:8px;border-top:1px dashed #E2E8F0">
      <div style="display:flex;flex-direction:column;gap:3px">
        <label style="${_ctLbl()}">Cajas sueltas</label>
        <input type="number" min="0" placeholder="0" id="ct-suelta-${sk}" value="${suelta}"
          oninput="ctRecalcCard('${sk}','${_escKey(key)}')" style="${_ctInput('80px')}">
      </div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <label style="${_ctLbl()}">Unidades sueltas</label>
        <input type="number" min="0" placeholder="0" id="ct-unidades-${sk}" value="${unidades}"
          oninput="ctRecalcCard('${sk}','${_escKey(key)}')" style="${_ctInput('80px')}">
      </div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#F8FAFC;border-radius:8px;flex-wrap:wrap;gap:6px">
      <div style="display:flex;gap:16px">
        <span style="font-size:12px;color:#64748B">Total cajas: <strong id="ct-totalcaj-${sk}" style="color:#14213D">${totalCajas}</strong></span>
        <span style="font-size:12px;color:#64748B">Unidades: <strong id="ct-totalun-${sk}" style="color:#14213D">${unidades||0}</strong></span>
      </div>
      <div id="ct-valid-${sk}">${validHtml}</div>
    </div>
  </div>`;
}

function _rowHTML(sk, ek, row, idx, totalRows){
  const p   = row.pallets||'';
  const cx  = row.cajasXPlt||'';
  const sub = (Number(p)||0)*(Number(cx)||0);
  const canDel = totalRows > 1;
  return `<div id="ct-row-${sk}-${idx}" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
    <input type="number" min="0" placeholder="0" id="ct-pallets-${sk}-${idx}" value="${p}"
      oninput="ctRecalcCard('${sk}','${ek}')" style="${_ctInput('68px')}">
    <span style="color:#CBD5E1;font-size:18px;font-weight:300">×</span>
    <input type="number" min="0" placeholder="0" id="ct-cajasxplt-${sk}-${idx}" value="${cx}"
      oninput="ctRecalcCard('${sk}','${ek}')" style="${_ctInput('84px')}">
    <span style="color:#CBD5E1;font-size:18px;font-weight:300">=</span>
    <div id="ct-sub-${sk}-${idx}" style="background:#F1F5F9;border-radius:8px;padding:6px 10px;min-width:68px;font-size:14px;font-weight:700;color:#1E40AF;text-align:center">${sub}</div>
    ${canDel
      ? `<button onclick="ctRemoveRow('${sk}','${ek}',${idx})" style="padding:4px 8px;border-radius:6px;border:1px solid #FCA5A5;background:#FFF0F0;color:#DC2626;font-size:13px;cursor:pointer;flex-shrink:0;line-height:1">🗑</button>`
      : `<div style="width:32px"></div>`
    }
  </div>`;
}

/* ══════════════════════════════════════════════════════════
   RECÁLCULO EN TIEMPO REAL
══════════════════════════════════════════════════════════ */
function _readAllRows(sk){
  const rows = [];
  for(let i=0;;i++){
    const pEl = document.getElementById(`ct-pallets-${sk}-${i}`);
    const cEl = document.getElementById(`ct-cajasxplt-${sk}-${i}`);
    if(!pEl||!cEl) break;
    rows.push({ pallets: pEl.value, cajasXPlt: cEl.value, p: Number(pEl.value)||0, cx: Number(cEl.value)||0 });
  }
  return rows;
}

function ctRecalcCard(sk, origKey){
  const rows     = _readAllRows(sk);
  const suelta   = Number(document.getElementById(`ct-suelta-${sk}`)?.value)||0;
  const unidades = Number(document.getElementById(`ct-unidades-${sk}`)?.value)||0;

  rows.forEach((r,i)=>{
    const el = document.getElementById(`ct-sub-${sk}-${i}`);
    if(el) el.textContent = r.p * r.cx;
  });

  const subTotal   = rows.reduce((s,r)=>s+r.p*r.cx, 0);
  const totalCajas = subTotal + suelta;

  const tcEl = document.getElementById(`ct-totalcaj-${sk}`);
  const tuEl = document.getElementById(`ct-totalun-${sk}`);
  const vaEl = document.getElementById(`ct-valid-${sk}`);
  if(tcEl) tcEl.textContent = totalCajas;
  if(tuEl) tuEl.textContent = unidades;

  const prod = origKey.split('_').slice(2).join('_');
  // Si cambian los valores se invalida la confirmación previa
  _confirmed[origKey] = false;
  if(vaEl) vaEl.innerHTML = _validarProducto(origKey, prod, totalCajas, unidades);

  _saveConteoEntry(origKey, {
    rows: rows.map(r=>({pallets:r.pallets, cajasXPlt:r.cajasXPlt})),
    suelta: suelta||'', unidades: unidades||''
  });

  const last = rows[rows.length-1];
  if(last && last.p && last.cx && !document.getElementById(`ct-pallets-${sk}-${rows.length}`)){
    _appendRow(sk, origKey, rows.length);
  }
}

function _appendRow(sk, origKey, idx){
  const container = document.getElementById(`ct-rows-${sk}`);
  if(!container) return;
  const ek  = _escKey(origKey);
  const div = document.createElement('div');
  div.id    = `ct-row-${sk}-${idx}`;
  div.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap';
  div.innerHTML = `
    <input type="number" min="0" placeholder="0" id="ct-pallets-${sk}-${idx}"
      oninput="ctRecalcCard('${sk}','${ek}')" style="${_ctInput('68px')}">
    <span style="color:#CBD5E1;font-size:18px;font-weight:300">×</span>
    <input type="number" min="0" placeholder="0" id="ct-cajasxplt-${sk}-${idx}"
      oninput="ctRecalcCard('${sk}','${ek}')" style="${_ctInput('84px')}">
    <span style="color:#CBD5E1;font-size:18px;font-weight:300">=</span>
    <div id="ct-sub-${sk}-${idx}" style="background:#F1F5F9;border-radius:8px;padding:6px 10px;min-width:68px;font-size:14px;font-weight:700;color:#1E40AF;text-align:center">0</div>
    <button onclick="ctRemoveRow('${sk}','${ek}',${idx})" style="padding:4px 8px;border-radius:6px;border:1px solid #FCA5A5;background:#FFF0F0;color:#DC2626;font-size:13px;cursor:pointer;flex-shrink:0;line-height:1">🗑</button>`;
  container.appendChild(div);
  _ensureDeleteBtn(sk, origKey, idx-1);
  // NO mover el foco: el usuario sigue escribiendo en el campo actual.
}

function _ensureDeleteBtn(sk, origKey, idx){
  const rowEl = document.getElementById(`ct-row-${sk}-${idx}`);
  if(!rowEl || rowEl.querySelector('button')) return;
  const placeholder = rowEl.querySelector('div[style*="width:32px"]');
  if(placeholder) placeholder.remove();
  const ek  = _escKey(origKey);
  const btn = document.createElement('button');
  btn.setAttribute('onclick', `ctRemoveRow('${sk}','${ek}',${idx})`);
  btn.style.cssText = 'padding:4px 8px;border-radius:6px;border:1px solid #FCA5A5;background:#FFF0F0;color:#DC2626;font-size:13px;cursor:pointer;flex-shrink:0;line-height:1';
  btn.textContent = '🗑';
  rowEl.appendChild(btn);
}

function ctRemoveRow(sk, origKey){
  const idx = arguments[2];
  const rows = _readAllRows(sk);
  if(rows.length<=1) return;
  const suelta   = document.getElementById(`ct-suelta-${sk}`)?.value||'';
  const unidades = document.getElementById(`ct-unidades-${sk}`)?.value||'';
  let newRows = rows.filter((_,i)=>i!==idx).map(r=>({pallets:r.pallets, cajasXPlt:r.cajasXPlt}));
  if(!newRows.length) newRows = [{pallets:'', cajasXPlt:''}];
  _saveConteoEntry(origKey, {rows:newRows, suelta, unidades});
  _rerenderRows(sk, origKey, newRows);
  ctRecalcCard(sk, origKey);
}

function _rerenderRows(sk, origKey, rows){
  const container = document.getElementById(`ct-rows-${sk}`);
  if(!container) return;
  const ek = _escKey(origKey);
  let rs = [...rows];
  if(!rs.length || (rs[rs.length-1].pallets && rs[rs.length-1].cajasXPlt)){
    rs.push({pallets:'', cajasXPlt:''});
  }
  container.innerHTML = rs.map((r,i)=>_rowHTML(sk,ek,r,i,rs.length)).join('');
}

/* ══════════════════════════════════════════════════════════
   VALIDACIÓN  (contra esperado sincronizado + colchón %)
══════════════════════════════════════════════════════════ */
function _badge(bg,col,txt){
  return `<span style="background:${bg};color:${col};padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700">${txt}</span>`;
}
/* Devuelve {estado, html, contadoU, esperadoU, margenU} */
function _evalConteo(prod, totalCajas, unidades){
  const cfg = _matchConfigGroup(prod);
  if(!cfg) return {estado:'sin_config', html:'', contadoU:0};
  const esperadoU = Number(cfg.saldo)||0;
  const caja      = Number(cfg.caja)||1;
  const contadoU  = (Number(totalCajas)||0)*caja + (Number(unidades)||0);
  const margenU   = Math.max(Math.round(esperadoU * _tolPct(cfg.grupo)/100), 0);
  const diffU     = contadoU - esperadoU;
  return {cfg, esperadoU, caja, contadoU, margenU, diffU,
          estado: contadoU===0 ? 'vacio'
                : Math.abs(diffU)<=margenU ? 'ok'
                : diffU<0 ? 'bajo' : 'excedente'};
}
function _cajasTxt(u, caja){
  const c = caja>0 ? u/caja : u;
  return caja>0 ? `${u} u (~${(Math.round(c*10)/10)} cajas)` : `${u} u`;
}
function _validarProducto(key, prod, totalCajas, unidades){
  const e = _evalConteo(prod, totalCajas, unidades);
  if(e.estado==='sin_config' || e.estado==='vacio') return '';
  if(_confirmed[key]) return _badge('#DCFCE7','#16A34A','✅ Confirmado (doble conteo)');
  if(e.estado==='ok') return _badge('#DCFCE7','#16A34A','✅ Conteo correcto');
  if(e.estado==='bajo') return _badge('#FEE2E2','#DC2626','❌ Falta producto — vuelva a contar');
  return _badge('#FEF3C7','#D97706','⚠️ Sobra producto — vuelva a contar');
}

/* ══════════════════════════════════════════════════════════
   PANEL ADMIN — esperado sincronizado + tolerancia (colchón %)
══════════════════════════════════════════════════════════ */
function _renderAdminPanel(){
  const grupos = _conteoConfig.grupos||[];
  const ts = _conteoConfig.updatedAt||'—';
  const filas = grupos.map(g=>{
    const sid = _safeId(g.grupo);
    const tol = _tolerancia[g.grupo]!=null ? _tolerancia[g.grupo] : '';
    const cajas = g.saldoCajas!=null ? g.saldoCajas : (g.caja?Math.round((g.saldo/g.caja)*100)/100:'—');
    return `<div style="display:grid;grid-template-columns:1fr 90px 90px 90px;gap:6px;align-items:center;padding:5px 6px;background:#fff;border-radius:8px;border:1px solid #EDE9FE">
      <span style="font-size:12px;font-weight:600;color:#14213D">${g.grupo}</span>
      <span style="font-size:12px;text-align:center;color:#1E40AF;font-weight:700">${g.saldo??'—'}</span>
      <span style="font-size:12px;text-align:center;color:#64748B">${cajas}</span>
      <input type="number" min="0" step="0.5" placeholder="${_TOL_DEFAULT}" id="adm-tol-${sid}" value="${tol}"
        style="border:1px solid #DDD6FE;border-radius:6px;padding:5px 6px;font-size:12px;text-align:center;width:100%">
    </div>`;
  }).join('');

  return `
  <div style="margin-top:28px;border-top:2px dashed #E2E8F0;padding-top:20px">
    <div onclick="ctToggleAdmin()" style="cursor:pointer;display:flex;align-items:center;gap:10px;margin-bottom:4px">
      <span style="font-size:13px;font-weight:800;color:#7C3AED">⚙️ Esperado y colchón (tolerancia)</span>
      <span style="font-size:10px;background:#EDE9FE;color:#7C3AED;padding:2px 7px;border-radius:20px;font-weight:700">Solo Admin</span>
      <span id="ct-admin-arrow" style="margin-left:auto;color:#94A3B8;font-size:12px">▼</span>
    </div>
    <div style="font-size:11px;color:#94A3B8;margin-bottom:10px">
      El <b>esperado</b> se sincroniza automáticamente desde PROYECCIONES.xlsm (hoja INVENTARIO) — última: ${ts}.
      Solo defines el <b>colchón %</b>: si el conteo queda dentro de ±% del esperado, se acepta. (Por defecto ${_TOL_DEFAULT}%.)
    </div>
    <div id="ct-admin-panel" style="display:none">
      <div style="background:#FAF5FF;border:1px solid #DDD6FE;border-radius:12px;padding:14px">
        ${grupos.length? `
        <div style="display:grid;grid-template-columns:1fr 90px 90px 90px;gap:6px;margin-bottom:8px;padding:0 6px">
          <span style="font-size:10px;font-weight:700;color:#7C3AED;text-transform:uppercase">Grupo</span>
          <span style="font-size:10px;font-weight:700;color:#7C3AED;text-transform:uppercase;text-align:center">Esperado (u)</span>
          <span style="font-size:10px;font-weight:700;color:#7C3AED;text-transform:uppercase;text-align:center">≈ Cajas</span>
          <span style="font-size:10px;font-weight:700;color:#7C3AED;text-transform:uppercase;text-align:center">Colchón %</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;max-height:360px;overflow-y:auto">${filas}</div>
        <div style="margin-top:12px;display:flex;justify-content:flex-end">
          <button onclick="ctGuardarAdmin()" style="padding:9px 20px;border-radius:8px;border:none;background:#7C3AED;color:#fff;font-size:13px;font-weight:700;cursor:pointer">💾 Guardar colchones</button>
        </div>`
        : `<div style="text-align:center;color:#94A3B8;font-size:12px;padding:14px">Sin configuración sincronizada todavía. Ejecuta Sync Bodega para traer el esperado desde PROYECCIONES.xlsm.</div>`}
      </div>
    </div>
  </div>`;
}

/* ══════════════════════════════════════════════════════════
   HISTORIAL
══════════════════════════════════════════════════════════ */
function _renderLogPanel(){
  if(!_conteoLog.length) return `<div style="text-align:center;padding:20px;color:#94A3B8;font-size:12px">Sin conteos guardados aún</div>`;
  const isAdmin = SESSION && (SESSION.role==='superadmin'||SESSION.role==='editor');
  const recent=[..._conteoLog].reverse().slice(0,60);
  const grupos={};
  recent.forEach(e=>{
    const gk=`${e.fecha}_${e.dia}_${e.operador}`;
    if(!grupos[gk]) grupos[gk]={fecha:e.fecha,dia:e.dia,op:e.operador,items:[]};
    grupos[gk].items.push(e);
  });
  // Texto de diferencia (SOLO admin) para confirmaciones marcadas
  const revisarTxt = it => {
    if(it.contadoUnidades==null || it.esperadoUnidades==null) return '';
    const cfg = _matchConfigGroup(it.producto);
    const caja = (cfg && cfg.caja) || 1;
    const d = it.contadoUnidades - it.esperadoUnidades;
    const cajas = caja>0 ? Math.round((d/caja)*10)/10 : d;
    const signo = d>0?'+':'';
    return `${signo}${d} u (${signo}${cajas} cajas)`;
  };
  return Object.values(grupos).map(g=>`
    <div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:12px;margin-bottom:8px">
      <div style="font-size:12px;font-weight:700;color:#14213D;margin-bottom:8px">
        📅 ${g.fecha} — ${g.dia} — ${(g.op||'').charAt(0).toUpperCase()+(g.op||'').slice(1)}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#F1F5F9">
          <th style="text-align:left;padding:5px 8px;color:#475569;font-weight:700">Producto</th>
          <th style="text-align:center;padding:5px 8px;color:#475569;font-weight:700">Cajas</th>
          <th style="text-align:center;padding:5px 8px;color:#475569;font-weight:700">Unidades</th>
          <th style="text-align:center;padding:5px 8px;color:#475569;font-weight:700">Estado</th>
          ${isAdmin?`<th style="text-align:center;padding:5px 8px;color:#7C3AED;font-weight:700">Revisar (admin)</th>`:''}
        </tr></thead>
        <tbody>${g.items.map(it=>{
          const revisar = it.estado==='confirmado';
          return `
          <tr style="border-bottom:1px solid #F1F5F9;${revisar?'background:#FEF7ED':''}">
            <td style="padding:5px 8px;color:#14213D">${it.producto}</td>
            <td style="padding:5px 8px;text-align:center;font-weight:600;color:#1E40AF">${it.totalCajas}</td>
            <td style="padding:5px 8px;text-align:center;color:#64748B">${it.unidades||0}</td>
            <td style="padding:5px 8px;text-align:center">${
              it.estado==='ok'?'<span style="color:#16A34A">✅</span>':
              it.estado==='confirmado'?'<span style="color:#16A34A">✅✅</span>':
              it.estado==='bajo'?'<span style="color:#DC2626">❌</span>':
              it.estado==='excedente'?'<span style="color:#D97706">⚠️</span>':'—'
            }</td>
            ${isAdmin?`<td style="padding:5px 8px;text-align:center;font-weight:700;color:${revisar?'#D97706':'#CBD5E1'}">${revisar?'⚠ '+revisarTxt(it):'—'}</td>`:''}
          </tr>`;}).join('')}
        </tbody>
      </table>
    </div>`).join('');
}

/* ══════════════════════════════════════════════════════════
   ACCIONES
══════════════════════════════════════════════════════════ */
function onConteoDiaChange(){
  localStorage.setItem('kc_conteo_dia', document.getElementById('ct-dia')?.value||'');
  renderConteoProductos();
}
function onConteoOpChange(){
  localStorage.setItem('kc_conteo_op', document.getElementById('ct-op')?.value||'');
  renderConteoProductos();
}

function ctReiniciar(){
  if(!confirm('¿Reiniciar todos los valores del conteo actual?')) return;
  const dia = document.getElementById('ct-dia')?.value||'';
  const op  = document.getElementById('ct-op')?.value||'';
  _getProductosParaDia(dia,op).forEach(prod=>{
    const key=`${dia}_${op}_${prod}`;
    localStorage.removeItem(`kc_ce_${key}`);
    delete _firstAttempt[key]; delete _confirmed[key];
  });
  renderConteoProductos();
}

function ctGuardar(){
  const dia   = document.getElementById('ct-dia')?.value||'';
  const op    = document.getElementById('ct-op')?.value||'';
  const fecha = document.getElementById('ct-fecha')?.value||new Date().toISOString().slice(0,10);
  const prods = _getProductosParaDia(dia,op);

  const recount = [];   // productos fuera de rango que requieren reconteo
  const entries = prods.map(prod=>{
    const key  = `${dia}_${op}_${prod}`;
    const sk   = _safeId(key);
    const rows = _readAllRows(sk);
    const suelta   = Number(document.getElementById(`ct-suelta-${sk}`)?.value)||0;
    const unidades = Number(document.getElementById(`ct-unidades-${sk}`)?.value)||0;
    const totalCajas = rows.reduce((s,r)=>s+r.p*r.cx,0)+suelta;
    const e = _evalConteo(prod, totalCajas, unidades);

    let estado = e.estado;
    if(estado==='bajo' || estado==='excedente'){
      // Confirmación por doble conteo: si el reconteo coincide (±margen) con el intento previo, aceptar
      const prev = _firstAttempt[key];
      if(prev!=null && Math.abs(e.contadoU - prev) <= Math.max(e.margenU,0)){
        _confirmed[key] = true;
        estado = 'confirmado';
      } else {
        _firstAttempt[key] = e.contadoU;   // guardar este intento
        recount.push({prod, txt:(e.estado==='bajo'?'falta':'sobra')+' producto'});
      }
    } else if(estado==='ok'){
      _confirmed[key]=false;
    }
    // refrescar badge
    const vaEl = document.getElementById(`ct-valid-${sk}`);
    if(vaEl) vaEl.innerHTML = _validarProducto(key, prod, totalCajas, unidades);

    return {fecha,dia,operador:op,producto:prod,
            rows:rows.map(r=>({pallets:r.p,cajasXPlt:r.cx})),
            suelta,unidades,totalCajas,
            contadoUnidades:e.contadoU, esperadoUnidades:e.esperadoU??null,
            estado};
  });

  // Guardar historial
  _conteoLog = _conteoLog.filter(e=>!(e.fecha===fecha&&e.dia===dia&&e.operador===op));
  _conteoLog.push(...entries);
  localStorage.setItem(_CONTEO_LOG_KEY, JSON.stringify(_conteoLog));

  if(recount.length){
    const lista = recount.map(r=>`• ${r.prod}: ${r.txt}`).join('\n');
    showToast(`⚠️ ${recount.length} producto(s) fuera de rango — vuelve a contar`);
    setTimeout(()=>alert(`Estos productos no cuadran con el esperado. Vuelve a contar y guarda otra vez.\nSi sale el mismo número, se aceptará:\n\n${lista}`), 100);
  } else {
    showToast(`✅ Conteo guardado — ${entries.length} productos`);
  }
}

function ctGuardarAdmin(){
  (_conteoConfig.grupos||[]).forEach(g=>{
    const sid = _safeId(g.grupo);
    const v = document.getElementById(`adm-tol-${sid}`)?.value;
    if(v!=='' && v!=null) _tolerancia[g.grupo] = Number(v);
    else delete _tolerancia[g.grupo];
  });
  localStorage.setItem(_CONTEO_TOL_KEY, JSON.stringify(_tolerancia));
  showToast('💾 Colchones guardados');
  renderConteoProductos();
}

function ctToggleAdmin(){
  const panel=document.getElementById('ct-admin-panel');
  const arrow=document.getElementById('ct-admin-arrow');
  if(!panel) return;
  const vis=panel.style.display==='none';
  panel.style.display=vis?'block':'none';
  if(arrow) arrow.textContent=vis?'▲':'▼';
}
function ctToggleLog(){
  const panel=document.getElementById('ct-log-panel');
  const arrow=document.getElementById('ct-log-arrow');
  if(!panel) return;
  const vis=panel.style.display==='none';
  if(vis) panel.innerHTML=_renderLogPanel();
  panel.style.display=vis?'block':'none';
  if(arrow) arrow.textContent=vis?'▲':'▼';
}

/* ══════════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════════ */
function _safeId(s){ return String(s).replace(/[^a-zA-Z0-9]/g,'_'); }
function _escKey(s){ return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
