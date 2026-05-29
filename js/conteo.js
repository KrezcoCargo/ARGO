/* ═══════════════════════════════════════════════════════════
   CONTEO DE INVENTARIO  — conteo.js  v1
   Calculadora de pallets × cajas/pallet + sueltas + unidades
   Validación con excedente configurable (solo admin)
═══════════════════════════════════════════════════════════ */

const DIAS_ORD = ['LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO','DOMINGO'];

/* ── Storage keys ── */
const _CONTEO_CFG_KEY = 'kc_excedentes_v1';   // configuración admin
const _CONTEO_LOG_KEY = 'kc_conteo_log_v1';   // historial de conteos

/* ── Estado en memoria ── */
let _excedentes = {};     // { producto: { min: N, extra: N } }
let _conteoLog  = [];     // [ { fecha, dia, operador, producto, totalCajas, totalUnidades, ts } ]

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
function loadConteo(){
  try { _excedentes = JSON.parse(localStorage.getItem(_CONTEO_CFG_KEY)||'{}'); } catch{}
  try { _conteoLog  = JSON.parse(localStorage.getItem(_CONTEO_LOG_KEY)||'[]'); } catch{}
  renderConteoPage();
}

/* ══════════════════════════════════════════════════════════
   HELPERS DE DATOS
══════════════════════════════════════════════════════════ */
function _getSemRows(){
  return (_bodegaData||{}).inventarioSemanal || [];
}
function _getAllProductos(){
  const prov = ((_bodegaData||{}).proveedores||[]).map(r=>r.producto).filter(Boolean);
  const cob  = ((_bodegaData||{}).cobertura||[]).map(r=>r.producto).filter(Boolean);
  // Combinar y deduplicar
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
function _getProductosParaDia(dia, operador){
  const sem = _getSemRows();
  const rows = sem.filter(r=>(r.dia||'').toUpperCase()===dia.toUpperCase());
  if(!rows.length) return [];
  // ¿Es inventario general?
  const esGeneral = rows.some(r=>
    Object.values(r).some(v=>String(v||'').toUpperCase().includes('INVENTARIO GENERAL'))
  );
  if(esGeneral) return _getAllProductos();
  // Productos de ese operador en ese día
  const prods = rows.map(r=>(r[operador]||'')).filter(v=>v&&!v.toUpperCase().includes('INVENTARIO'));
  return prods.filter(Boolean);
}

/* ══════════════════════════════════════════════════════════
   RENDERIZADO PRINCIPAL
══════════════════════════════════════════════════════════ */
function renderConteoPage(){
  const el = document.getElementById('pg-conteo');
  if(!el) return;

  const sem = _getSemRows();
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

  const savedDia = localStorage.getItem('kc_conteo_dia') || dias[0] || '';
  const savedOp  = localStorage.getItem('kc_conteo_op')  || ops[0] || '';

  el.innerHTML=`
  <div style="padding:16px 20px;max-width:900px;margin:0 auto">

    <!-- TÍTULO + CONTROLES -->
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px">
      <div style="font-size:18px;font-weight:800;color:#14213D;flex:1">🧮 Conteo de Inventario</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div style="display:flex;flex-direction:column;gap:2px">
          <label style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase">Día</label>
          <select id="ct-dia" onchange="onConteoDiaChange()" style="${_ctSelect()}">
            ${dias.map(d=>`<option value="${d}" ${d===savedDia?'selected':''}>${d.charAt(0)+d.slice(1).toLowerCase()}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:2px">
          <label style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase">Operador</label>
          <select id="ct-op" onchange="onConteoOpChange()" style="${_ctSelect()}">
            ${ops.map(o=>`<option value="${o}" ${o===savedOp?'selected':''}>${o.charAt(0).toUpperCase()+o.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:2px">
          <label style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase">Fecha</label>
          <input type="date" id="ct-fecha" value="${new Date().toISOString().slice(0,10)}"
            style="${_ctSelect()};min-width:130px">
        </div>
      </div>
    </div>

    <!-- ÁREA DE PRODUCTOS -->
    <div id="ct-productos"></div>

    <!-- BTN GUARDAR -->
    <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px">
      <button onclick="ctReiniciar()" style="padding:10px 18px;border-radius:8px;border:1px solid #E2E8F0;background:#fff;color:#64748B;font-size:13px;font-weight:600;cursor:pointer">🔄 Reiniciar</button>
      <button onclick="ctGuardar()" style="padding:10px 22px;border-radius:8px;border:none;background:#1F9D55;color:#fff;font-size:13px;font-weight:700;cursor:pointer">✅ Guardar Conteo</button>
    </div>

    <!-- HISTORIAL (colapsable) -->
    <div style="margin-top:24px">
      <div onclick="ctToggleLog()" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px 14px;background:#F1F5F9;border-radius:8px;user-select:none">
        <span style="font-size:13px;font-weight:700;color:#475569">📋 Historial de conteos</span>
        <span id="ct-log-arrow" style="margin-left:auto;color:#94A3B8;font-size:12px">▼</span>
      </div>
      <div id="ct-log-panel" style="display:none;margin-top:8px"></div>
    </div>

    ${isAdmin ? _renderAdminPanel() : ''}
  </div>`;

  renderConteoProductos();
}

function _ctSelect(){
  return `border:1px solid #E2E8F0;border-radius:8px;padding:6px 10px;font-size:13px;color:#14213D;background:#fff;cursor:pointer;min-width:110px`;
}

/* ══════════════════════════════════════════════════════════
   PRODUCTOS DEL DÍA
══════════════════════════════════════════════════════════ */
function renderConteoProductos(){
  const el = document.getElementById('ct-productos');
  if(!el) return;

  const dia = (document.getElementById('ct-dia')||{}).value || '';
  const op  = (document.getElementById('ct-op')||{}).value  || '';
  const prods = _getProductosParaDia(dia, op);
  const esGeneral = _getSemRows().some(r=>(r.dia||'').toUpperCase()===dia.toUpperCase()&&
    Object.values(r).some(v=>String(v||'').toUpperCase().includes('INVENTARIO GENERAL')));

  if(!prods.length){
    el.innerHTML=`<div style="text-align:center;padding:32px;color:#94A3B8;background:#F8FAFC;border-radius:12px">
      <div style="font-size:28px">📭</div>
      <div style="font-size:13px;margin-top:8px">No hay productos programados para este día y operador</div>
    </div>`;
    return;
  }

  el.innerHTML=`
  ${esGeneral?`<div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;font-weight:700;color:#92400E">⚠️ INVENTARIO GENERAL — Se muestran todos los productos</div>`:''}
  <div style="display:flex;flex-direction:column;gap:10px">
    ${prods.map(prod=>_renderProductoCard(prod, dia, op)).join('')}
  </div>`;
}

function _renderProductoCard(prod, dia, op){
  const key = `${dia}_${op}_${prod}`;
  const saved = _loadConteoEntry(key);
  const pallets     = saved.pallets     || '';
  const cajasXPlt   = saved.cajasXPlt   || '';
  const suelta      = saved.suelta      || '';
  const unidades    = saved.unidades    || '';
  const subTotal    = (Number(pallets)||0) * (Number(cajasXPlt)||0);
  const totalCajas  = subTotal + (Number(suelta)||0);
  const validHtml   = _validarProducto(prod, totalCajas);

  return `
  <div class="ct-card" id="ct-card-${_safeId(key)}" style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <div style="font-size:13px;font-weight:800;color:#14213D;margin-bottom:10px;text-transform:uppercase;letter-spacing:.4px">
      📦 ${prod}
    </div>

    <!-- PALLETS × CAJAS/PALLET -->
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
      <div style="display:flex;flex-direction:column;gap:3px">
        <label style="font-size:10px;font-weight:600;color:#64748B">Pallets</label>
        <input type="number" min="0" placeholder="0"
          id="ct-pallets-${_safeId(key)}"
          value="${pallets}"
          oninput="ctRecalc('${_safeId(key)}','${_escKey(key)}')"
          style="${_ctInput('64px')}">
      </div>
      <div style="font-size:18px;font-weight:300;color:#CBD5E1;margin-top:14px">×</div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <label style="font-size:10px;font-weight:600;color:#64748B">Cajas / Pallet</label>
        <input type="number" min="0" placeholder="0"
          id="ct-cajasxplt-${_safeId(key)}"
          value="${cajasXPlt}"
          oninput="ctRecalc('${_safeId(key)}','${_escKey(key)}')"
          style="${_ctInput('80px')}">
      </div>
      <div style="font-size:18px;font-weight:300;color:#CBD5E1;margin-top:14px">=</div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <label style="font-size:10px;font-weight:600;color:#64748B">Subtotal cajas</label>
        <div id="ct-sub-${_safeId(key)}"
          style="background:#F1F5F9;border-radius:8px;padding:6px 10px;min-width:64px;font-size:14px;font-weight:700;color:#1E40AF;text-align:center;line-height:1.6">
          ${subTotal}
        </div>
      </div>
    </div>

    <!-- CAJAS SUELTAS + UNIDADES -->
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px">
      <div style="display:flex;flex-direction:column;gap:3px">
        <label style="font-size:10px;font-weight:600;color:#64748B">Cajas sueltas</label>
        <input type="number" min="0" placeholder="0"
          id="ct-suelta-${_safeId(key)}"
          value="${suelta}"
          oninput="ctRecalc('${_safeId(key)}','${_escKey(key)}')"
          style="${_ctInput('80px')}">
      </div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <label style="font-size:10px;font-weight:600;color:#64748B">Unidades sueltas</label>
        <input type="number" min="0" placeholder="0"
          id="ct-unidades-${_safeId(key)}"
          value="${unidades}"
          oninput="ctRecalc('${_safeId(key)}','${_escKey(key)}')"
          style="${_ctInput('80px')}">
      </div>
    </div>

    <!-- TOTAL + VALIDACIÓN -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#F8FAFC;border-radius:8px;flex-wrap:wrap;gap:6px">
      <div style="display:flex;gap:16px">
        <span style="font-size:12px;color:#64748B">Total cajas: <strong id="ct-totalcaj-${_safeId(key)}" style="color:#14213D">${totalCajas}</strong></span>
        <span style="font-size:12px;color:#64748B">Unidades sueltas: <strong id="ct-totalun-${_safeId(key)}" style="color:#14213D">${unidades||0}</strong></span>
      </div>
      <div id="ct-valid-${_safeId(key)}">${validHtml}</div>
    </div>
  </div>`;
}

function _ctInput(w){
  return `border:1px solid #E2E8F0;border-radius:8px;padding:6px 8px;font-size:14px;font-weight:600;color:#14213D;width:${w};text-align:center;outline:none`;
}

/* ══════════════════════════════════════════════════════════
   RECÁLCULO EN TIEMPO REAL
══════════════════════════════════════════════════════════ */
function ctRecalc(safeKey, origKey){
  const p  = Number(document.getElementById(`ct-pallets-${safeKey}`)?.value)||0;
  const cx = Number(document.getElementById(`ct-cajasxplt-${safeKey}`)?.value)||0;
  const s  = Number(document.getElementById(`ct-suelta-${safeKey}`)?.value)||0;
  const u  = Number(document.getElementById(`ct-unidades-${safeKey}`)?.value)||0;

  const sub   = p * cx;
  const total = sub + s;

  const subEl = document.getElementById(`ct-sub-${safeKey}`);
  const tcEl  = document.getElementById(`ct-totalcaj-${safeKey}`);
  const tuEl  = document.getElementById(`ct-totalun-${safeKey}`);
  const vaEl  = document.getElementById(`ct-valid-${safeKey}`);

  if(subEl) subEl.textContent = sub;
  if(tcEl)  tcEl.textContent  = total;
  if(tuEl)  tuEl.textContent  = u;

  // Extraer nombre de producto del origKey: "DIA_OP_PRODUCTO"
  const parts = origKey.split('_');
  const prod  = parts.slice(2).join('_');
  if(vaEl) vaEl.innerHTML = _validarProducto(prod, total);

  // Auto-guardar en localStorage
  _saveConteoEntry(origKey, {pallets:p||'', cajasXPlt:cx||'', suelta:s||'', unidades:u||''});
}

/* ══════════════════════════════════════════════════════════
   VALIDACIÓN
══════════════════════════════════════════════════════════ */
function _validarProducto(prod, totalCajas){
  const cfg = _excedentes[prod];
  if(!cfg || cfg.min == null || cfg.min === '') return '';   // sin configurar → no validar
  const min   = Number(cfg.min)   || 0;
  const extra = Number(cfg.extra) || 0;

  if(totalCajas === 0) return '';  // sin datos aún
  if(totalCajas < min){
    const diff = min - totalCajas;
    return `<span style="background:#FEE2E2;color:#DC2626;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700">❌ Faltan ${diff} cajas — vuelva a contar</span>`;
  }
  if(totalCajas <= min + extra){
    return `<span style="background:#DCFCE7;color:#16A34A;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700">✅ Conteo correcto</span>`;
  }
  // Excede el excedente permitido
  const sobra = totalCajas - min;
  return `<span style="background:#FEF3C7;color:#D97706;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700">⚠️ Excedente: +${sobra} cajas</span>`;
}

/* ══════════════════════════════════════════════════════════
   PANEL ADMIN — CONFIGURACIÓN DE EXCEDENTES
══════════════════════════════════════════════════════════ */
function _renderAdminPanel(){
  const todos = _getAllProductos();
  return `
  <div style="margin-top:28px;border-top:2px dashed #E2E8F0;padding-top:20px">
    <div onclick="ctToggleAdmin()" style="cursor:pointer;display:flex;align-items:center;gap:10px;margin-bottom:4px">
      <span style="font-size:13px;font-weight:800;color:#7C3AED">⚙️ Configuración de excedentes</span>
      <span style="font-size:10px;background:#EDE9FE;color:#7C3AED;padding:2px 7px;border-radius:20px;font-weight:700">Solo Admin</span>
      <span id="ct-admin-arrow" style="margin-left:auto;color:#94A3B8;font-size:12px">▼</span>
    </div>
    <div style="font-size:11px;color:#94A3B8;margin-bottom:10px">
      Define la cantidad mínima esperada y el excedente permitido por producto. Si el conteo está entre Min y Min+Excedente se considera correcto.
    </div>
    <div id="ct-admin-panel" style="display:none">
      <div style="background:#FAF5FF;border:1px solid #DDD6FE;border-radius:12px;padding:14px">
        <div style="display:grid;grid-template-columns:1fr 110px 110px;gap:6px;margin-bottom:8px;padding:0 6px">
          <span style="font-size:10px;font-weight:700;color:#7C3AED;text-transform:uppercase">Producto</span>
          <span style="font-size:10px;font-weight:700;color:#7C3AED;text-transform:uppercase;text-align:center">Mín esperado</span>
          <span style="font-size:10px;font-weight:700;color:#7C3AED;text-transform:uppercase;text-align:center">Excedente</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;max-height:340px;overflow-y:auto">
          ${todos.map(prod=>{
            const c = _excedentes[prod]||{};
            const sid = _safeId(prod);
            return `<div style="display:grid;grid-template-columns:1fr 110px 110px;gap:6px;align-items:center;padding:5px 6px;background:#fff;border-radius:8px;border:1px solid #EDE9FE">
              <span style="font-size:12px;font-weight:600;color:#14213D">${prod}</span>
              <input type="number" min="0" placeholder="—" id="adm-min-${sid}" value="${c.min!=null?c.min:''}"
                style="border:1px solid #DDD6FE;border-radius:6px;padding:5px 6px;font-size:12px;text-align:center;width:100%">
              <input type="number" min="0" placeholder="—" id="adm-ext-${sid}" value="${c.extra!=null?c.extra:''}"
                style="border:1px solid #DDD6FE;border-radius:6px;padding:5px 6px;font-size:12px;text-align:center;width:100%">
            </div>`;
          }).join('')}
        </div>
        <div style="margin-top:12px;display:flex;justify-content:flex-end">
          <button onclick="ctGuardarAdmin()" style="padding:9px 20px;border-radius:8px;border:none;background:#7C3AED;color:#fff;font-size:13px;font-weight:700;cursor:pointer">💾 Guardar configuración</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ══════════════════════════════════════════════════════════
   HISTORIAL DE CONTEOS
══════════════════════════════════════════════════════════ */
function _renderLogPanel(){
  if(!_conteoLog.length) return `<div style="text-align:center;padding:20px;color:#94A3B8;font-size:12px">Sin conteos guardados aún</div>`;
  const recent = [..._conteoLog].reverse().slice(0,50);
  // Agrupar por fecha+dia+operador
  const grupos = {};
  recent.forEach(e=>{
    const gk=`${e.fecha}_${e.dia}_${e.operador}`;
    if(!grupos[gk]) grupos[gk]={fecha:e.fecha,dia:e.dia,op:e.operador,items:[]};
    grupos[gk].items.push(e);
  });
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
        </tr></thead>
        <tbody>${g.items.map(it=>`
          <tr style="border-bottom:1px solid #F1F5F9">
            <td style="padding:5px 8px;color:#14213D">${it.producto}</td>
            <td style="padding:5px 8px;text-align:center;font-weight:600;color:#1E40AF">${it.totalCajas}</td>
            <td style="padding:5px 8px;text-align:center;color:#64748B">${it.unidades||0}</td>
            <td style="padding:5px 8px;text-align:center">${
              it.estado==='ok'?'<span style="color:#16A34A;font-size:11px">✅</span>':
              it.estado==='bajo'?'<span style="color:#DC2626;font-size:11px">❌</span>':
              it.estado==='excedente'?'<span style="color:#D97706;font-size:11px">⚠️</span>':'—'
            }</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`).join('');
}

/* ══════════════════════════════════════════════════════════
   ACCIONES
══════════════════════════════════════════════════════════ */
function onConteoDiaChange(){
  const v = document.getElementById('ct-dia')?.value||'';
  localStorage.setItem('kc_conteo_dia', v);
  renderConteoProductos();
}
function onConteoOpChange(){
  const v = document.getElementById('ct-op')?.value||'';
  localStorage.setItem('kc_conteo_op', v);
  renderConteoProductos();
}

function ctReiniciar(){
  if(!confirm('¿Reiniciar todos los valores del conteo actual?')) return;
  const dia = document.getElementById('ct-dia')?.value||'';
  const op  = document.getElementById('ct-op')?.value||'';
  const prods = _getProductosParaDia(dia, op);
  prods.forEach(prod=>{
    const key = `${dia}_${op}_${prod}`;
    localStorage.removeItem(`kc_ce_${key}`);
  });
  renderConteoProductos();
}

function ctGuardar(){
  const dia   = document.getElementById('ct-dia')?.value||'';
  const op    = document.getElementById('ct-op')?.value||'';
  const fecha = document.getElementById('ct-fecha')?.value||new Date().toISOString().slice(0,10);
  const prods = _getProductosParaDia(dia, op);

  const entries = prods.map(prod=>{
    const key    = `${dia}_${op}_${prod}`;
    const saved  = _loadConteoEntry(key);
    const p  = Number(saved.pallets)||0;
    const cx = Number(saved.cajasXPlt)||0;
    const s  = Number(saved.suelta)||0;
    const u  = Number(saved.unidades)||0;
    const totalCajas = p*cx + s;
    const cfg = _excedentes[prod]||{};
    let estado = 'sin_config';
    if(cfg.min!=null && cfg.min!==''){
      const min=Number(cfg.min)||0, extra=Number(cfg.extra)||0;
      if(totalCajas<min) estado='bajo';
      else if(totalCajas<=min+extra) estado='ok';
      else estado='excedente';
    }
    return { fecha, dia, operador:op, producto:prod, pallets:p, cajasXPlt:cx, suelta:s, unidades:u, totalCajas, estado };
  });

  // Guardar log (eliminar entradas anteriores del mismo turno, reemplazar)
  _conteoLog = _conteoLog.filter(e=>!(e.fecha===fecha&&e.dia===dia&&e.operador===op));
  _conteoLog.push(...entries);
  localStorage.setItem(_CONTEO_LOG_KEY, JSON.stringify(_conteoLog));

  showToast(`✅ Conteo guardado — ${entries.length} productos`);

  // Actualizar validaciones visualmente
  prods.forEach(prod=>{
    const key    = `${dia}_${op}_${prod}`;
    const saved  = _loadConteoEntry(key);
    const p  = Number(saved.pallets)||0;
    const cx = Number(saved.cajasXPlt)||0;
    const s  = Number(saved.suelta)||0;
    const total = p*cx+s;
    const vaEl = document.getElementById(`ct-valid-${_safeId(key)}`);
    if(vaEl) vaEl.innerHTML = _validarProducto(prod, total);
  });
}

function ctGuardarAdmin(){
  const todos = _getAllProductos();
  todos.forEach(prod=>{
    const sid = _safeId(prod);
    const minEl = document.getElementById(`adm-min-${sid}`);
    const extEl = document.getElementById(`adm-ext-${sid}`);
    const min = minEl?.value;
    const ext = extEl?.value;
    if(min!==''||ext!==''){
      _excedentes[prod] = { min: min!==''?Number(min):null, extra: ext!==''?Number(ext):null };
    }
  });
  localStorage.setItem(_CONTEO_CFG_KEY, JSON.stringify(_excedentes));
  showToast('💾 Configuración de excedentes guardada');
  renderConteoProductos(); // Refrescar validaciones
}

function ctToggleAdmin(){
  const panel = document.getElementById('ct-admin-panel');
  const arrow = document.getElementById('ct-admin-arrow');
  if(!panel) return;
  const vis = panel.style.display==='none';
  panel.style.display = vis ? 'block' : 'none';
  if(arrow) arrow.textContent = vis ? '▲' : '▼';
}

function ctToggleLog(){
  const panel = document.getElementById('ct-log-panel');
  const arrow = document.getElementById('ct-log-arrow');
  if(!panel) return;
  const vis = panel.style.display==='none';
  if(vis) panel.innerHTML = _renderLogPanel();
  panel.style.display = vis ? 'block' : 'none';
  if(arrow) arrow.textContent = vis ? '▲' : '▼';
}

/* ══════════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════════ */
function _safeId(s){ return String(s).replace(/[^a-zA-Z0-9]/g,'_'); }
function _escKey(s){ return s.replace(/'/g,"\\'"); }

function _saveConteoEntry(key, obj){
  localStorage.setItem(`kc_ce_${key}`, JSON.stringify(obj));
}
function _loadConteoEntry(key){
  try { return JSON.parse(localStorage.getItem(`kc_ce_${key}`)||'{}'); } catch{ return {}; }
}
