/* ═══════════════════════════════════════════════════════════
   DASHBOARD — renderizado
═══════════════════════════════════════════════════════════ */
function initDashboard(){
  const totalRac=SCHOOLS.reduce((a,s)=>a+s.raciones,0);
  const provs=[...new Set(SCHOOLS.map(s=>s.prov).filter(Boolean))];
  document.getElementById('tb-title').textContent=`${CFG.clienteNombre} · ${CFG.programa}`;
  document.getElementById('tb-sub').textContent=`${SCHOOLS.length.toLocaleString('es-EC')} IE · ${provs.length} provincias · ${fmtN(totalRac)} raciones`;

  // Date picker
  const dp=document.getElementById('date-pick');
  dp.min=CFG.fechaInicioISO;
  dp.max=addDays(CFG.fechaInicioISO,CFG.diasTotal-1);
  dp.value=CFG.fechaInicioISO;
  dp.onchange=()=>{ST.dia=diaForDate(dp.value);renderAll();};
  document.getElementById('date-ctrl').style.display='';
  document.getElementById('prev-day').disabled=false;
  document.getElementById('next-day').disabled=false;
  document.getElementById('prev-day').onclick=()=>{if(ST.dia>1){ST.dia--;syncDP();renderAll();}};
  document.getElementById('next-day').onclick=()=>{if(ST.dia<CFG.diasTotal){ST.dia++;syncDP();renderAll();}};

  // Province chips
  const sortedProvs=[...provs].sort();
  document.getElementById('prov-chips').innerHTML=
    `<span class="chip active" data-pv="ALL" onclick="setProv(this,'ALL')">Todas</span>`
    +sortedProvs.map(p=>`<span class="chip" data-pv="${esc(p)}" onclick="setProv(this,'${esc(p)}')">${cap(p)}</span>`).join('');

  ST.dia=autoDetectDay();syncDP();
  document.getElementById('empty-state').style.display='none';
  document.getElementById('dashboard').style.display='';
  renderAll();
  // Refresh map if already open
  if(typeof _mapCreated!=='undefined'&&_mapCreated)renderMapMarkers();
}

/* ═══════════════════════════════════════════════════════════
   RENDER
═══════════════════════════════════════════════════════════ */

function autoDetectDay(){const today=isoToday();if(CFG.diaFechas&&CFG.diaFechas[today]!==undefined){return CFG.diaFechas[today];}if(CFG.fechaInicioISO){return Math.max(1,Math.min(CFG.diasTotal,diaForDate(today)));}return 1;}
function renderTonChart(){
  const c=ST.dia;
  const dl=SCHOOLS.filter(s=>s.dia<=c);
  const tE=dl.filter(s=>s.estado==='entregada').reduce((a,s)=>a+s.peso_kg,0)/1000;
  const tR=dl.filter(s=>s.estado==='en_ruta').reduce((a,s)=>a+s.peso_kg,0)/1000;
  const tP=dl.filter(s=>s.estado!=='entregada'&&s.estado!=='en_ruta').reduce((a,s)=>a+s.peso_kg,0)/1000;
  const rE=dl.filter(s=>s.estado==='entregada').reduce((a,s)=>a+s.raciones,0);
  const rR=dl.filter(s=>s.estado==='en_ruta').reduce((a,s)=>a+s.raciones,0);
  const rP=dl.filter(s=>s.estado!=='entregada'&&s.estado!=='en_ruta').reduce((a,s)=>a+s.raciones,0);
  const tTot=tE+tR+tP;
  setText('ton-dia-lbl',c>1?'Acum. dias 1-'+c:'Dia 1');
  setText('ton-dia-sub','Acumulado dias 1-'+c+': '+(tTot>0?tTot.toFixed(2)+' TON':'sin datos'));
  const maxT=Math.max(tE,tR,tP,0.001);
  const H=100;
  const bar=(ton,rac,color,label,icon)=>{
    const h=Math.max((ton/maxT)*H,ton>0?4:0);
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:80px;max-width:130px;flex:1">
      <div style="font-size:9px;font-weight:800;color:${color}">${ton>0?ton.toFixed(2)+' T':'—'}</div>
      <div style="font-size:8px;font-weight:600;color:var(--gray-600)">${rac>0?fmtN(rac)+' rac':'—'}</div>
      <div style="width:100%;height:${H}px;display:flex;align-items:flex-end;background:rgba(0,0,0,.03);border-radius:8px;overflow:hidden;padding:0 6px">
        <div style="width:100%;height:${h}px;background:${color};border-radius:6px 6px 0 0;transition:height .6s"></div>
      </div>
      <div style="font-size:10px;font-weight:700;color:var(--navy)">${icon} ${label}</div>
    </div>`;
  };
  // Province breakdown
  const provs=[...new Set(SCHOOLS.filter(s=>s.dia<=c).map(s=>s.prov))].sort();
  let provBars='';
  const maxProv=Math.max(...provs.map(p=>SCHOOLS.filter(s=>s.dia<=c&&s.prov===p).reduce((a,s)=>a+s.peso_kg,0)/1000),0.001);
  provs.forEach(p=>{
    const tProv=SCHOOLS.filter(s=>s.dia<=c&&s.prov===p).reduce((a,s)=>a+s.peso_kg,0)/1000;
    const rProv=SCHOOLS.filter(s=>s.dia<=c&&s.prov===p).reduce((a,s)=>a+s.raciones,0);
    const h=Math.max((tProv/maxProv)*H,tProv>0?4:0);
    provBars+=`<div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:60px;flex:1">
      <div style="font-size:8px;font-weight:800;color:var(--navy-soft)">${tProv>0?tProv.toFixed(2)+' T':'—'}</div>
      <div style="font-size:7px;font-weight:600;color:var(--gray-600)">${rProv>0?fmtN(rProv)+' rac':'—'}</div>
      <div style="width:100%;height:${H}px;display:flex;align-items:flex-end;background:rgba(0,0,0,.03);border-radius:8px;overflow:hidden;padding:0 4px">
        <div style="width:100%;height:${h}px;background:linear-gradient(180deg,#7B9FD4,var(--navy));border-radius:6px 6px 0 0;transition:height .6s"></div>
      </div>
      <div style="font-size:9px;font-weight:700;color:var(--navy);text-align:center">${p.charAt(0)+p.slice(1).toLowerCase()}</div>
    </div>`;
  });
  const wrap=document.getElementById('ton-chart-wrap');
  if(!wrap)return;
  wrap.innerHTML=`
    <div style="display:flex;gap:10px;align-items:flex-end;flex:0 0 auto">
      ${bar(tE,rE,'#1F9D55','Entregadas','✓')}
      ${bar(tR,rR,'#F47C20','En ruta','🚚')}
      ${bar(tP,rP,'#9AA4B8','Pendientes','⏳')}
    </div>
    <div style="width:1px;background:var(--gray-100);height:130px;align-self:center"></div>
    <div style="flex:1">
      <div style="font-size:9px;font-weight:700;color:var(--gray-600);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Por provincia</div>
      <div style="display:flex;gap:8px;align-items:flex-end">${provBars}</div>
    </div>`;
}

function changeEstado(sel){
  const [amie,dia]=sel.dataset.key.split('|');
  const diaNum=parseInt(dia);
  const s=SCHOOLS.find(x=>x.amie===amie&&x.dia===diaNum);
  if(!s)return;
  const prev=s.estado;
  s.estado=sel.value;
  // update select class for color
  sel.className='estado-sel s-'+sel.value;
  // update the underlying row's TR class if needed (optional)
  saveToStorage();
  // re-render stats without rebuilding the whole table (avoids losing scroll position)
  renderDiaTrack();renderRaciones();renderKpis();renderProvBars();renderDonut();renderTonChart();
  // if filtering by status and this row no longer matches, re-render table
  if(ST.est!=='ALL'&&ST.est!==sel.value){renderTable();}
  // auto-publish
  const dataPayload={schools:SCHOOLS,cfg:CFG,updatedAt:new Date().toLocaleString('es-EC')};
  publishToGitHub(dataPayload);
  showToast(`✓ ${amie} → ${sel.value}`);
}

function renderAll(){renderDiaTrack();renderRaciones();renderKpis();renderProvBars();renderDonut();renderTonChart();renderTable();}

function syncDP(){
  const iso=d2i(ST.dia);
  document.getElementById('date-pick').value=iso;
  document.getElementById('day-tag').textContent=`DÍA ${ST.dia}`;
}

function d2i(d){
  if(CFG.diaFechasRev&&CFG.diaFechasRev[d])return CFG.diaFechasRev[d];
  const [y,m,dd]=CFG.fechaInicioISO.split('-').map(Number);
  const dt=new Date(y,m-1,dd);dt.setDate(dt.getDate()+(d-1));
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
}
function addDays(iso,n){const[y,m,d]=iso.split('-').map(Number);const dt=new Date(y,m-1,d);dt.setDate(dt.getDate()+n);return dt.toISOString().slice(0,10);}
function diaForDate(iso){const[y1,m1,d1]=CFG.fechaInicioISO.split('-').map(Number);const[y2,m2,d2]=iso.split('-').map(Number);const diff=Math.round((new Date(y2,m2-1,d2)-new Date(y1,m1-1,d1))/86400000);return Math.max(1,Math.min(CFG.diasTotal,diff+1));}
function fmtS(iso){const[,m,d]=iso.split('-').map(Number);return`${d} ${MONTHS[m-1]}`;}
function fmtF(iso){const[y,m,d]=iso.split('-').map(Number);const dt=new Date(y,m-1,d);return`${WD[dt.getDay()]} ${d} de ${MONTHS_F[m-1]}`;}
function fmtN(n){if(n>=1e6)return(n/1e6).toFixed(2).replace('.',',')+' M';if(n>=1e3)return(n/1e3).toFixed(1).replace('.',',')+' K';return n.toLocaleString('es-EC');}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function cap(s){return String(s).split(' ').map(w=>w?w[0]+w.slice(1).toLowerCase():'').join(' ');}
function setText(id,t){const e=document.getElementById(id);if(e)e.textContent=t;}
function setHTML(id,h){const e=document.getElementById(id);if(e)e.innerHTML=h;}
function setField(id,v){const e=document.getElementById(id);if(e)e.value=v;}
function isoToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}

function renderRaciones(){
  const _dia=ST.dia;
  const _sc=SCHOOLS.filter(s=>s.dia<=_dia);
  const tot=SCHOOLS.reduce((a,s)=>a+s.raciones,0);
  const ent=_sc.filter(s=>s.estado==='entregada').reduce((a,s)=>a+s.raciones,0);
  const rut=_sc.filter(s=>s.estado==='en_ruta').reduce((a,s)=>a+s.raciones,0);
  const pend=tot-ent-rut;
  const pe=tot>0?(ent/tot*100).toFixed(1):0;
  const pr=tot>0?(rut/tot*100).toFixed(1):0;
  const pp=tot>0?(pend/tot*100).toFixed(1):100;
  const tTot=SCHOOLS.reduce((a,s)=>a+s.peso_kg,0)/1000;
  const tEnt=_sc.filter(s=>s.estado==='entregada').reduce((a,s)=>a+s.peso_kg,0)/1000;
  const tRut=_sc.filter(s=>s.estado==='en_ruta').reduce((a,s)=>a+s.peso_kg,0)/1000;
  const tPend=tTot-tEnt-tRut;
  setText('rac-total',fmtN(tot));setText('rac-total-ie',SCHOOLS.length.toLocaleString('es-EC')+' IE · programa completo');
  setText('rac-total-ton',tTot>0?tTot.toFixed(1)+' TON':'');
  setText('rac-ent',fmtN(ent));setText('rac-ent-p',pe+'% del programa');
  setText('rac-ent-ton',tEnt>0?tEnt.toFixed(1)+' TON':'');
  setText('rac-ruta',fmtN(rut));setText('rac-ruta-p',pr+'% del programa');
  setText('rac-ruta-ton',tRut>0?tRut.toFixed(1)+' TON':'');
  setText('rac-pend',fmtN(pend));setText('rac-pend-p',pp+'% restante');
  setText('rac-pend-ton',tPend>0?tPend.toFixed(1)+' TON':'');
  setText('rac-bar-r',pe+'% entregado');
  document.getElementById('rfill-e').style.width=pe+'%';
  document.getElementById('rfill-r').style.width=pr+'%';
}
function renderDiaTrack(){
  const t=document.getElementById('dia-track');let h='';
  for(let i=1;i<=CFG.diasTotal;i++){
    const iso=d2i(i);const cls=i<ST.dia?'past':i===ST.dia?'current':'';
    const dl=SCHOOLS.filter(s=>s.dia===i);
    h+=`<div class="dia-cell ${cls}" onclick="selDia(${i})">${i}<div class="tip">Día ${i}·${fmtS(iso)}·${dl.length} IE</div></div>`;
  }
  t.innerHTML=h;
}
function selDia(d){ST.dia=d;syncDP();renderAll();}

function renderKpis(){
  const c=ST.dia,dl=SCHOOLS.filter(s=>s.dia<=c);
  let nE=0,nR=0,nP=0,nPr=0,rE=0,rR=0,rP=0,tP=0;const m={};
  dl.forEach(s=>{if(s.estado==='entregada'){nE++;rE+=s.raciones;}else if(s.estado==='en_ruta'){nR++;rR+=s.raciones;m[s.acceso]=(m[s.acceso]||0)+1;}else if(s.estado==='problema')nPr++;else{nP++;rP+=s.raciones;tP+=s.peso_kg/1000;}});
  const iso=d2i(c),tot=SCHOOLS.length;
  const tDl=dl.reduce((a,s)=>a+s.peso_kg,0)/1000;const tE=dl.filter(s=>s.estado==='entregada').reduce((a,s)=>a+s.peso_kg,0)/1000;const tR2=dl.filter(s=>s.estado==='en_ruta').reduce((a,s)=>a+s.peso_kg,0)/1000;const tP2=dl.filter(s=>s.estado!=='entregada'&&s.estado!=='en_ruta').reduce((a,s)=>a+s.peso_kg,0)/1000;
  setText('kp1',dl.length.toLocaleString('es-EC'));setText('kp1a',(dl.length/Math.max(1,tot)*100).toFixed(1)+'% planificado · Días 1-'+c+'/'+CFG.diasTotal);setText('kp1b',`${fmtN(dl.reduce((a,s)=>a+s.raciones,0))} raciones · ${tDl.toFixed(2)} TON`);
  setText('kp2',nE.toLocaleString('es-EC'));setText('kp2a',(nE/Math.max(1,SCHOOLS.length)*100).toFixed(0)+'% del programa total');setText('kp2b',`${fmtN(rE)} raciones · ${tE.toFixed(2)} TON`);
  setText('kp3',nR.toLocaleString('es-EC'));setText('kp3a','🚗 '+(m['Terrestre']||0)+' · ✈️ '+(m['Aérea']||0)+' · 🛶 '+(m['Fluvial']||0));setText('kp3b',`${fmtN(rR)} raciones · ${tR2.toFixed(2)} TON`);
  setText('kp4',(nP+nPr).toLocaleString('es-EC'));setText('kp4a',`${tP2.toFixed(2)} TON pendientes`);setText('kp4b',`${fmtN(rP)} raciones · ${tP2.toFixed(2)} TON`);
  setHTML('day-summary',`Día ${c} <small>de ${CFG.diasTotal} · ${fmtF(iso)}</small>`);
  let cI=0,cR=0;for(let i=1;i<=c;i++){const x=SCHOOLS.filter(s=>s.dia===i);cI+=x.length;cR+=x.reduce((a,s)=>a+s.raciones,0);}
  setHTML('cum-summary',`${cI.toLocaleString('es-EC')} <small>de ${tot} IE · ${(cI/Math.max(1,tot)*100).toFixed(1)}%</small>`);
  setText('tbl-day',c>1?'Días 1-'+c+' · '+fmtF(iso):'Día '+c+' · '+fmtF(iso));setText('d-dia-label',c>1?'Días 1-'+c:'Día 1');
}

function renderProvBars(){
  const _pDia=ST.dia;
  setText('prov-sub',_pDia>1?'Acumulado Días 1-'+_pDia:'Acumulado Día 1');
  const provs=[...new Set(SCHOOLS.map(s=>s.prov).filter(Boolean))].sort();
  document.getElementById('prov-bars').innerHTML=provs.map(p=>{
    const total=SCHOOLS.filter(s=>s.prov===p).length;
    const delivered=SCHOOLS.filter(s=>s.prov===p&&s.dia<=_pDia&&s.estado==='entregada').length;
    const pct=total>0?Math.round(delivered/total*100):0;
    const rac=SCHOOLS.filter(s=>s.prov===p).reduce((a,s)=>a+s.raciones,0);
    const ie_acc=SCHOOLS.filter(s=>s.prov===p&&s.dia<=_pDia).length;
    return`<div class="brow"><div class="bname">${cap(p)}<span class="s">${total} IE</span></div><div class="btrack"><div class="bfill${delivered>0?' g':''}" style="width:${Math.max(pct,0)}%">${pct>12?pct+'%':''}</div></div><div class="bval">${delivered}/${total}<span class="s">${fmtN(rac)} rac</span></div></div>`;
  }).join('')||'<div style="padding:10px;font-size:11px;color:var(--gray-600)">Sin datos</div>';
}

function renderDonut(){
  const c=ST.dia;
  const tot=SCHOOLS.length;
  const nE=SCHOOLS.filter(s=>s.dia<=c&&s.estado==='entregada').length;
  const nR=SCHOOLS.filter(s=>s.dia<=c&&s.estado==='en_ruta').length;
  const nPr=SCHOOLS.filter(s=>s.dia<=c&&s.estado==='problema').length;
  const nP=tot-nE-nR-nPr;
  const C=2*Math.PI*65;
  const draw=(id,pct,off)=>{const d=pct/100*C;const el=document.getElementById(id);if(el){el.setAttribute('stroke-dasharray',`${d} ${C-d}`);el.setAttribute('stroke-dashoffset',-off);}return d;};
  let off=0;
  off+=draw('d-e',tot>0?nE/tot*100:0,off);
  off+=draw('d-r',tot>0?nR/tot*100:0,off);
  off+=draw('d-p',tot>0?nPr/tot*100:0,off);
  setText('d-cv',tot.toLocaleString('es-EC'));
  setHTML('donut-leg',[['Entregada','#1F9D55',nE],['En ruta','#F47C20',nR],['Pendiente','#9AA4B8',nP],['Problema','#DC2626',nPr]].map(([lb,cl,n])=>`<div class="dr"><div class="ddot" style="background:${cl}"></div><div class="dname">${lb}</div><div style="font-size:9px;color:var(--gray-600)">${n} IE</div><div class="dpct">${tot>0?(n/tot*100).toFixed(0):0}%</div></div>`).join(''));
  setText('donut-sub','Días 1-'+c+' · '+tot+' IE totales del programa');
}

function renderTable(){
  const c=ST.dia;
  const rows=SCHOOLS.filter(s=>{
    if(ST.scope==='DAY'&&s.dia!==c)return false;
    if(ST.prov!=='ALL'&&s.prov!==ST.prov)return false;
    if(ST.est!=='ALL'&&s.estado!==ST.est)return false;
    if(ST.q){const q=ST.q.toLowerCase();if(!(s.amie.toLowerCase().includes(q)||s.nombre.toLowerCase().includes(q)||s.canton.toLowerCase().includes(q)))return false;}
    return true;
  });
  const ord={en_ruta:0,problema:1,pendiente:2,entregada:3};
  rows.sort((a,b)=>(ord[a.estado]||2)-(ord[b.estado]||2));
  const CAP=300,disp=rows.slice(0,CAP);
  const aClass={'Terrestre':'aT','Aérea':'aA','Fluvial':'aF'};
  const sL={entregada:'Entregada',en_ruta:'En ruta',pendiente:'Pendiente',problema:'Problema'};
  const mkSel=(s)=>{
    const opts=[
      {v:'entregada',l:'✓ Entregada'},
      {v:'en_ruta',l:'↗ En ruta'},
      {v:'pendiente',l:'○ Pendiente'},
      {v:'problema',l:'✕ Problema'}
    ].map(o=>`<option value="${o.v}"${s.estado===o.v?' selected':''}>${o.l}</option>`).join('');
    const key=esc(s.amie)+'|'+s.dia;
    return `<select class="estado-sel s-${s.estado}" data-key="${key}" onchange="changeEstado(this)">${opts}</select>`;
  };
  document.getElementById('tbody').innerHTML=disp.map(s=>`<tr>
    <td><span class="amiec">${esc(s.amie)}</span></td>
    <td><div class="sname" title="${esc(s.nombre)}">${esc(s.nombre)}</div><div class="muted">${esc(s.prov)}</div></td>
    <td>${esc(s.canton)}<div class="muted">${esc(s.parr)}</div></td>
    <td><span class="atag ${aClass[s.acceso]||'aT'}">${esc(s.acceso)}</span></td>
    <td style="text-align:right;font-weight:600">${s.estudiantes.toLocaleString('es-EC')}</td>
    <td style="text-align:right;font-weight:600">${(s.peso_kg/1000).toFixed(2)}<span class="muted"> T</span></td>
    <td style="text-align:right;font-weight:600">${s.raciones.toLocaleString('es-EC')}</td>
    <td>${mkSel(s)}${s.notas?`<div class="muted" style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">📌 ${esc(s.notas)}</div>`:''}</td>
    <td><div style="font-weight:600;font-size:10px">${fmtS(d2i(s.dia))}<div class="muted">Día ${s.dia}${s.hora?' · '+esc(s.hora):''}</div></div></td>
    <td style="font-size:10px;color:var(--gray-600)">${esc(s.transportista||'—')}${s.placa?`<div class="muted">${esc(s.placa)}</div>`:''}</td>
  </tr>`).join('');
  const tT=rows.reduce((a,s)=>a+s.peso_kg/1000,0),tR=rows.reduce((a,s)=>a+s.raciones,0);
  const sl=ST.scope==='DAY'?`solo día ${c}`:'todo el programa';
  setText('row-count',`${rows.length.toLocaleString('es-EC')} IE · ${tT.toFixed(1)} TON · ${tR.toLocaleString('es-EC')} raciones · ${sl}${rows.length>CAP?' · (mostrando primeros '+CAP+')':''}`);}

/* ═══════════════════════════════════════════════════════════
   FILTERS
═══════════════════════════════════════════════════════════ */
function setScope(s){ST.scope=s;document.getElementById('sc-d').classList.toggle('active',s==='DAY');document.getElementById('sc-a').classList.toggle('active',s==='ALL');renderTable();}
function setProv(el,p){ST.prov=p;document.querySelectorAll('[data-pv]').forEach(c=>c.classList.toggle('active',c.dataset.pv===p));renderTable();}
function setEst(el,e){ST.est=e;document.querySelectorAll('[data-e]').forEach(c=>c.classList.toggle('active',c.dataset.e===e));renderTable();}
function onSearch(v){ST.q=v.trim();renderTable();}

/* ═══════════════════════════════════════════════════════════
   MAP STATS
═══════════════════════════════════════════════════════════ */
function renderMapStats(){/* stats now handled by map count bar */}

/* ═══════════════════════════════════════════════════════════
   USER MANAGEMENT
═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   PÁGINA DE USUARIOS
═══════════════════════════════════════════════════════════ */
function renderUsersPage(){
  const users=getUsers();
  updatePermPreview();
  document.getElementById('users-tbody').innerHTML=users.map(u=>`
    <tr>
      <td style="font-family:monospace;font-size:11px;font-weight:600">${esc(u.username)}</td>
      <td>${esc(u.name||'—')}</td>
      <td><span class="rbadge ${u.role==='superadmin'?'r-sa':u.role==='editor'?'r-ed':'r-vi'}">${{superadmin:'Super Admin',editor:'Editor',viewer:'Espectador'}[u.role]||u.role}</span></td>
      <td style="font-size:10px;color:var(--gray-600)">${u.created?new Date(u.created).toLocaleDateString('es-EC'):'—'}</td>
      <td>${u.locked?`<span style="font-size:9px;color:var(--gray-400)">🔒 Protegido</span>`:`<button class="btn btn-d" style="padding:3px 8px;font-size:9px" onclick="deleteUser('${esc(u.username)}')">Eliminar</button>`}</td>
    </tr>`).join('');
  // Actualizar contador en panel de sync
  const exportable=users.filter(u=>!u.locked&&u.role!=='superadmin');
  const panel=document.getElementById('export-panel');
  if(panel){
    const countEl=panel.querySelector('.export-count');
    if(countEl) countEl.textContent=`${exportable.length} usuario${exportable.length!==1?'s':''}`;
  }
}

async function createUser(){
  const uname=document.getElementById('nu-user').value.trim().toLowerCase();
  const name=document.getElementById('nu-name').value.trim();
  const pass=document.getElementById('nu-pass').value;
  const role=document.getElementById('nu-role').value;
  if(!uname){showFM('El nombre de usuario es requerido.','fm-err');return;}
  if(!/^[a-z0-9_]+$/.test(uname)){showFM('Solo letras minúsculas, números y _','fm-err');return;}
  if(pass.length<6){showFM('Contraseña mínimo 6 caracteres.','fm-err');return;}
  const users=getUsers();
  if(users.find(u=>u.username===uname)){showFM('Ese usuario ya existe.','fm-err');return;}
  const h=hashPwd(pass);
  users.push({username:uname,name,role,pwdHash:h,created:new Date().toISOString(),locked:false});
  showFM('⏳ Guardando usuario…','fm-ok');
  const ok=await saveUsers(users);
  showFM(ok?`✓ Usuario "${uname}" creado y sincronizado con GitHub.`:`✓ Usuario "${uname}" creado. (Sin conexión — se sincronizará al reconectar)`,'fm-ok');
  setField('nu-user','');setField('nu-name','');setField('nu-pass','');
  renderUsersPage();
  showToast(ok?`✓ Usuario "${uname}" guardado en GitHub`:`✓ "${uname}" creado localmente`);
}

async function deleteUser(uname){
  if(!confirm(`¿Eliminar usuario "${uname}"?`))return;
  const ok=await saveUsers(getUsers().filter(u=>u.username!==uname));
  renderUsersPage();
  showToast(ok?`Usuario "${uname}" eliminado y sincronizado`:`"${uname}" eliminado localmente`);
}
function updatePermPreview(){
  const role=document.getElementById('nu-role')?.value||'viewer';
  const el=document.getElementById('perm-list');
  if(el)el.innerHTML=(ROLE_PERMS[role]||[]).map(p=>`<div>✓ ${p}</div>`).join('');
}

function showFM(msg,cls){
  const el=document.getElementById('form-msg');
  if(el){el.textContent=msg;el.className=`form-msg ${cls}`;el.style.display='block';}
}

/* ═══════════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════════ */
function showToast(msg,isErr=false){
  const t=document.getElementById('toast');
  t.textContent=msg;t.style.background=isErr?'var(--red)':'var(--navy)';
  t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3200);
}