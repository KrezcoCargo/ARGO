/* ── Parsea número UTM desde string con posibles separadores de miles ──────
   Elimina puntos y comas que actúan como separadores de miles antes de
   parsear, para manejar formatos como "691.776,69" o "691,776.69".         */
function _parseUTM(v){
  if(v==null)return null;
  let s=String(v).trim();
  // Si hay coma Y punto, determinar cuál es decimal por posición
  const lastComma=s.lastIndexOf(','), lastDot=s.lastIndexOf('.');
  if(lastComma>lastDot){
    // coma es decimal: "691.776,69" → quitar puntos → "691776,69" → coma→punto
    s=s.replace(/\./g,'').replace(',','.');
  } else {
    // punto es decimal o solo hay uno: "691,776.69" → quitar comas
    s=s.replace(/,/g,'');
  }
  const n=parseFloat(s);
  return isNaN(n)?null:n;
}

function navTo(page){
  currentPage=page;
  sessionStorage.setItem('kc_last_page', page);  // remember for F5 restore
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
  const ni=document.getElementById('nav-'+page);
  if(ni)ni.classList.add('active');
  document.querySelectorAll('.page-content').forEach(p=>p.classList.remove('active'));
  const pc=document.getElementById('pg-'+page);
  if(pc)pc.classList.add('active');
  // Topbar
  const titles={dashboard:'Dashboard',map:'Mapa de Rutas',bodega:'Bodega',upload:'Cargar Planificación',config:'Configuración',users:'Gestión de Usuarios'};
  document.getElementById('tb-title').textContent=titles[page]||page;
  const tenantName=ACTIVE_TENANT?ACTIVE_TENANT.name:'KrezcoCargo SAS';
  document.getElementById('tb-sub').textContent=SESSION?`${SESSION.name} · ${tenantName}`:tenantName;
  document.getElementById('date-ctrl').style.display=page==='dashboard'?'':'none';
  // Page-specific init
  if(page==='users')renderUsersPage();
  if(page==='config')loadConfig2();
  if(page==='upload')buildUploadTenantSelect();
  if(page==='map'){renderMapStats();initSICMap();if(_mapCreated&&SCHOOLS.length>0)renderMapMarkers();}
  if(page==='bodega')loadBodega();
}

/* ═══════════════════════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════════════════════ */
function loadFromStorage(){
  try{
    // Try current tenant key first, then legacy 'kc_data' for backward compat
    const raw=localStorage.getItem(getDataCacheKey())||localStorage.getItem('kc_data');
    if(raw){const o=JSON.parse(raw);SCHOOLS=o.schools||[];CFG=Object.assign(CFG,o.cfg||{});
      // Recalculate diasTotal from diaFechasRev (reliable even if stored value was stale)
      if(CFG.diaFechasRev&&Object.keys(CFG.diaFechasRev).length>0){const _dn=Object.keys(CFG.diaFechasRev).map(Number).filter(n=>n>0);if(_dn.length>0)CFG.diasTotal=Math.max(..._dn);}
      const saved=getSavedClientName();
      CFG.clienteNombre=saved||(ACTIVE_TENANT?ACTIVE_TENANT.name:'')||CFG.clienteNombre;
      if(SCHOOLS.length>0){
        setField('cfg-cliente',CFG.clienteNombre);setField('cfg-programa',CFG.programa);
        setField('cfg-fecha',CFG.fechaInicioISO);setField('cfg-dias',CFG.diasTotal);
        document.getElementById('last-update').textContent=o.updatedAt||'—';
        updateSidebarInfo();
        initDashboard();return;
      }
    }
  }catch{}
}

async function loadFromGitHubThenRender(){
  // Try GitHub first (shared data source for all users)
  const remote=await fetchFromGitHub();
  if(remote&&remote.schools&&remote.schools.length>0){
    SCHOOLS=remote.schools;CFG=Object.assign(CFG,remote.cfg||{});
    // Recalculate diasTotal from diaFechasRev (reliable even if stored value was stale)
    if(CFG.diaFechasRev&&Object.keys(CFG.diaFechasRev).length>0){const _dn=Object.keys(CFG.diaFechasRev).map(Number).filter(n=>n>0);if(_dn.length>0)CFG.diasTotal=Math.max(..._dn);}
    // Nombre del cliente: (1) nombre guardado para este tenant, (2) nombre del tenant, (3) lo que venga en el archivo
    const saved=getSavedClientName();
    CFG.clienteNombre=saved||(ACTIVE_TENANT?ACTIVE_TENANT.name:'')||CFG.clienteNombre;
    // Cache locally
    localStorage.setItem(getDataCacheKey(),JSON.stringify(Object.assign({},remote,{updatedAt:remote.updatedAt||new Date().toLocaleString('es-EC')})));
    setField('cfg-cliente',CFG.clienteNombre);setField('cfg-programa',CFG.programa);
    setField('cfg-fecha',CFG.fechaInicioISO);setField('cfg-dias',CFG.diasTotal);
    const lu=document.getElementById('last-update');
    if(lu)lu.textContent=(remote.updatedAt||'GitHub')+' 🔄';
    _lastDataHash = dataHash(SCHOOLS) + '|' + (remote.updatedAt||'');
    updateSidebarInfo();initDashboard();refreshMapIfActive();
  } else {
    // Fallback to localStorage
    loadFromStorage();
  }
}

function saveToStorage(){
  localStorage.setItem(getDataCacheKey(),JSON.stringify({schools:SCHOOLS,cfg:CFG,updatedAt:new Date().toLocaleString('es-EC')}));
  updateSidebarInfo();
}

function refreshMapIfActive(){
  if(currentPage==='map'&&typeof _mapCreated!=='undefined'&&_mapCreated&&SCHOOLS.length>0)
    renderMapMarkers();
}

function updateSidebarInfo(){
  const el=document.getElementById('sb-data-info');
  if(el){el.innerHTML=SCHOOLS.length>0?`${SCHOOLS.length.toLocaleString('es-EC')} IE cargadas<br>${CFG.clienteNombre} · ${CFG.diasTotal} días`:'Sin datos cargados';}
}

function clearData(){
  if(!confirm('¿Borrar todos los datos cargados?'))return;
  localStorage.removeItem(getDataCacheKey());SCHOOLS=[];
  document.getElementById('dashboard').style.display='none';
  document.getElementById('empty-state').style.display='';
  updateSidebarInfo();
  const ls=document.getElementById('load-status');
  if(ls)ls.innerHTML='';
  showToast('Datos borrados');
}

/* ═══════════════════════════════════════════════════════════
   KEY NORMALIZER — strips EVERYTHING non-alphanumeric
═══════════════════════════════════════════════════════════ */
function nk(k){
  return String(k)
    .toLowerCase()
    .replace(/[áàâäã]/g,'a').replace(/[éèêë]/g,'e')
    .replace(/[íìîï]/g,'i').replace(/[óòôöõ]/g,'o')
    .replace(/[úùûü]/g,'u').replace(/ñ/g,'n')
    .replace(/[^a-z0-9]/g,'');  // remove ALL non-alphanumeric
}

/* ═══════════════════════════════════════════════════════════
   EXCEL PARSER — dynamic header detection
═══════════════════════════════════════════════════════════ */
function parseExcelDate(dv){
  if(!dv) return '';
  // JavaScript Date object (cellDates:true)
  if(dv instanceof Date){
    if(isNaN(dv.getTime())) return '';
    return dv.getFullYear()+'-'+String(dv.getMonth()+1).padStart(2,'0')+'-'+String(dv.getDate()).padStart(2,'0');
  }
  // Excel serial number (40000–60000 covers 2009–2064)
  if(typeof dv==='number'&&dv>40000&&dv<60000){
    const epoch=new Date(Math.round((dv-25569)*86400000));
    return epoch.getUTCFullYear()+'-'+String(epoch.getUTCMonth()+1).padStart(2,'0')+'-'+String(epoch.getUTCDate()).padStart(2,'0');
  }
  if(typeof dv==='string'){
    const s=dv.trim();
    if(!s) return '';
    // YYYY-MM-DD or YYYY-M-D
    const pISO=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(pISO) return pISO[1]+'-'+pISO[2].padStart(2,'0')+'-'+pISO[3].padStart(2,'0');
    // DD/MM/YYYY or D/M/YYYY  (Latin America standard)
    const pSlash=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(pSlash) return pSlash[3]+'-'+pSlash[2].padStart(2,'0')+'-'+pSlash[1].padStart(2,'0');
    // DD-MM-YYYY or D-M-YYYY
    const pDash=s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if(pDash) return pDash[3]+'-'+pDash[2].padStart(2,'0')+'-'+pDash[1].padStart(2,'0');
    // YYYY/MM/DD
    const pYSlash=s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if(pYSlash) return pYSlash[1]+'-'+pYSlash[2].padStart(2,'0')+'-'+pYSlash[3].padStart(2,'0');
    // DD/MM/YY (2-digit year → assume 2000+)
    const pShort=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if(pShort) return '20'+pShort[3]+'-'+pShort[2].padStart(2,'0')+'-'+pShort[1].padStart(2,'0');
  }
  return '';
}

function handleFile(ev){const f=ev.target.files[0];if(f)loadFile(f);ev.target.value='';}

function loadFile(file){
  readCfgFromForms();
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array',cellDates:true});

      // Find best sheet: prefer PLANIFICACION (has DÍA, ESTADO, AMIE), then BBD PESOS, then first non-config
      const SKIP=['CONFIG','PESOS TOTAL'];
      const normSheet=n=>n.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Z]/g,'');
      const skipSheet=n=>{const u=normSheet(n);return u==='DIAS'||u==='DIA'||u==='CONFIG'||n.toUpperCase()==='PESOS TOTAL';};
      let sheetName = wb.SheetNames.find(n=>n.toUpperCase()==='PLANIFICACION')
        || wb.SheetNames.find(n=>n.toUpperCase()==='BBD PESOS')
        || wb.SheetNames.find(n=>n.toUpperCase()==='IE')
        || wb.SheetNames.find(n=>!skipSheet(n))
        || wb.SheetNames[0];

      const ws=wb.Sheets[sheetName];
      // Get as array of arrays
      const aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:false});

      // Find header row: first row containing a cell that normalizes to 'amie'
      let headerRowIdx=-1;
      for(let i=0;i<Math.min(aoa.length,15);i++){
        const row=aoa[i];
        if(row&&row.some(c=>c!=null&&nk(String(c))==='amie')){headerRowIdx=i;break;}
      }

      if(headerRowIdx<0){
        // Fallback: try PLANIFICACION sheet
        const ws2=wb.Sheets['PLANIFICACION']||wb.Sheets[wb.SheetNames[0]];
        const aoa2=XLSX.utils.sheet_to_json(ws2,{header:1,defval:null,raw:false});
        for(let i=0;i<Math.min(aoa2.length,15);i++){
          if(aoa2[i]&&aoa2[i].some(c=>c!=null&&nk(String(c))==='amie')){
            headerRowIdx=i;
            const rows=buildRows(aoa2,headerRowIdx);
            processRows(rows,file.name);return;
          }
        }
        showToast('No se encontró columna AMIE en el archivo.',true);return;
      }

      // Read DÍAS sheet FIRST so autoDetectDay() has CFG.diaFechas ready when processRows→initDashboard runs
      const diasSN=wb.SheetNames.find(n=>{const u=normSheet(n);return u==='DIAS'||u==='DIA'||u.startsWith('DIA');});
      if(diasSN){
        const dws=wb.Sheets[diasSN];
        const dAoa=XLSX.utils.sheet_to_json(dws,{header:1,defval:null,raw:true});
        CFG.diaFechas={};CFG.diaFechasRev={};
        dAoa.forEach(row=>{
          if(!row||row.length<2)return;
          // Day number: find first numeric cell in the row (usually col 0, sometimes col 1)
          let dayNum=NaN,dvIdx=1;
          for(let ci=0;ci<Math.min(row.length,3);ci++){
            const v=parseInt(String(row[ci]));
            if(!isNaN(v)&&v>0&&v<=366){dayNum=v;dvIdx=ci+1;break;}
          }
          if(isNaN(dayNum))return;
          const dv=row[dvIdx];
          if(!dv)return;
          const iso=parseExcelDate(dv);
          if(iso){CFG.diaFechas[iso]=dayNum;CFG.diaFechasRev[dayNum]=iso;}
        });
        console.log('[KC] diaFechas:',JSON.stringify(CFG.diaFechas));
        const _dn=Object.keys(CFG.diaFechasRev).map(Number).filter(n=>n>0).sort((a,b)=>a-b);
        if(_dn.length>0){
          const _d1=CFG.diaFechasRev[_dn[0]];const _dM=_dn[_dn.length-1];
          if(_d1){CFG.fechaInicioISO=_d1;setField('cfg-fecha',_d1);setField('cfg2-fecha',_d1);}
          if(_dM>0){CFG.diasTotal=_dM;setField('cfg-dias',_dM);setField('cfg2-dias',_dM);}
        }
      }
      const rows=buildRows(aoa,headerRowIdx);
      processRows(rows,file.name);

    }catch(e){showToast('Error: '+e.message,true);console.error(e);}
  };
  reader.readAsArrayBuffer(file);
}

function buildRows(aoa,headerRowIdx){
  const headers=aoa[headerRowIdx].map(h=>h!=null?String(h).trim():'');
  // Print debug info
  const diaColIdx=headers.findIndex(h=>nk(h)==='dia'||nk(h)==='diaprogramado'||nk(h)==='diadeentrega'||nk(h)==='ndia'||nk(h)==='numerodedia');
  console.log(`[KC] Header row: ${headerRowIdx} | Cols: ${headers.filter(Boolean).slice(0,12).join(', ')}`);
  console.log(`[KC] DIA column: idx=${diaColIdx}, name="${headers[diaColIdx]}"`);

  return aoa.slice(headerRowIdx+1)
    .filter(r=>r&&r.some(c=>c!=null&&String(c).trim()!=''))
    .map(r=>{
      const obj={};
      headers.forEach((h,i)=>{if(h)obj[h]=r[i]??null;});
      return obj;
    });
}

function processRows(rows,fname){
  if(!rows.length){showToast('El archivo no tiene datos.',true);return;}

  // Use local variable — only assign to global SCHOOLS if uploading for the active tenant
  const newSchools=rows.map(mapRow).filter(s=>s.amie);
  if(!newSchools.length){showToast('No se encontraron registros válidos.',true);return;}

  // Determine upload target tenant BEFORE touching SCHOOLS
  const uploadSel=document.getElementById('upload-tenant-sel');
  const uploadTenantId=uploadSel?uploadSel.value:'';
  const allTenants=TENANTS.length>0?TENANTS:DEFAULT_TENANTS;
  const uploadTenant=allTenants.find(t=>t.id===uploadTenantId)||ACTIVE_TENANT;
  const targetPath=uploadTenant?uploadTenant.dataPath:null;
  const isCurrentTenant=!uploadTenant||!ACTIVE_TENANT||uploadTenant.id===ACTIVE_TENANT.id;

  // If DÍAS sheet didn't provide dates, fall back to max dia from data
  const maxDia=Math.max(...newSchools.map(s=>s.dia).filter(d=>d>0));
  if(!isNaN(maxDia)&&maxDia>0&&Object.keys(CFG.diaFechasRev||{}).length===0){
    CFG.diasTotal=maxDia;
    setField('cfg-dias',maxDia);
  }

  const dCounts={};newSchools.forEach(s=>{dCounts[s.dia]=(dCounts[s.dia]||0)+1;});
  const eCounts={};newSchools.forEach(s=>{eCounts[s.estado]=(eCounts[s.estado]||0)+1;});
  console.log('[KC] Dia distribution:',JSON.stringify(dCounts));
  console.log('[KC] Estado distribution:',JSON.stringify(eCounts));

  // Only update the active tenant's view if uploading for THIS tenant
  if(isCurrentTenant){
    SCHOOLS=newSchools;
    saveToStorage();
    initDashboard();
    refreshMapIfActive();
  }

  // Build recognized days schedule display
  const diasRev=CFG.diaFechasRev||{};
  const dayNums=Object.keys(diasRev).map(Number).filter(n=>n>0).sort((a,b)=>a-b);
  const diasHtml=dayNums.length>0
    ?'<div style="margin-top:10px"><div style="font-size:10px;font-weight:700;color:#5C6478;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">📅 Días reconocidos (hoja DÍAS)</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:4px">'
      +dayNums.map(d=>{const iso=diasRev[d]||'';const pts=iso.split('-');const lb=pts.length===3?parseInt(pts[2])+' '+MONTHS[parseInt(pts[1])-1]+' '+pts[0]:'—';return`<span style="background:#E8F5E9;border:1px solid #A5D6A7;border-radius:6px;padding:3px 8px;font-size:10px;color:#1B5E20;font-weight:700;white-space:nowrap">Día ${d} · ${lb}</span>`;}).join('')
      +'</div></div>'
    :'';

  const tenantLabel=uploadTenant&&!isCurrentTenant?` → <strong>${uploadTenant.name}</strong>`:'';
  const ls=document.getElementById('load-status');
  if(ls)ls.innerHTML=`<div class="status-alert alert-ok">✓ ${newSchools.length.toLocaleString('es-EC')} instituciones cargadas desde "${fname}"${tenantLabel} · Inicio: <strong>${CFG.fechaInicioISO||'—'}</strong> · <strong>${CFG.diasTotal} días</strong></div>${diasHtml}`;
  showToast(`✓ ${newSchools.length.toLocaleString('es-EC')} IE · ${CFG.diasTotal} días`+(isCurrentTenant?'':' → '+uploadTenant.name));

  // Nombre del cliente = siempre el nombre del tenant de subida
  if(uploadTenant){
    CFG.clienteNombre=uploadTenant.name;
    saveClientName(uploadTenant.name, uploadTenant.id);
    if(isCurrentTenant) setField('cfg-cliente', uploadTenant.name);
  }

  // Publish to GitHub using newSchools (never the stale global SCHOOLS)
  const dataPayload={schools:newSchools,cfg:CFG,updatedAt:new Date().toLocaleString('es-EC')};
  publishToGitHub(dataPayload,targetPath);
}

function buildUploadTenantSelect(){
  const wrap=document.getElementById('upload-tenant-wrap');
  if(!wrap)return;
  if(!SESSION||SESSION.role==='viewer'){wrap.innerHTML='';return;}
  const accessible=getUserTenants();
  if(accessible.length<=1){
    wrap.innerHTML='';
    // Even without selector, auto-fill client name from the single accessible tenant
    const t=accessible[0]||ACTIVE_TENANT;
    if(t){setField('cfg-cliente',t.name);}
    return;
  }
  const current=ACTIVE_TENANT?ACTIVE_TENANT.id:(accessible[0]?accessible[0].id:'');
  wrap.innerHTML=`
    <div style="margin-bottom:14px;padding:12px 16px;background:var(--gray-bg);border-radius:10px;display:flex;align-items:center;gap:12px">
      <span style="font-size:20px">🗄️</span>
      <div style="flex:1">
        <div style="font-size:11px;font-weight:700;color:var(--navy);margin-bottom:4px">¿A qué base de datos subir?</div>
        <select id="upload-tenant-sel" onchange="onUploadTenantChange()" style="border:1.5px solid var(--gray-200);border-radius:7px;padding:6px 10px;font-size:12px;font-weight:600;color:var(--navy);background:#fff;width:100%;cursor:pointer">
          ${accessible.map(t=>`<option value="${t.id}"${t.id===current?' selected':''}>${t.name}</option>`).join('')}
        </select>
      </div>
    </div>`;
  onUploadTenantChange();
}

function onUploadTenantChange(){
  const sel=document.getElementById('upload-tenant-sel');
  if(!sel) return;
  const allTenants=TENANTS.length>0?TENANTS:DEFAULT_TENANTS;
  const t=allTenants.find(x=>x.id===sel.value);
  if(t){
    setField('cfg-cliente', t.name);
    setField('cfg-programa', CFG.programa||'Programa Alimentación Escolar');
  }
}

function mapRow(row){
  const n={};
  Object.keys(row).forEach(k=>{n[nk(k)]=row[k];});

  const nv=keys=>{for(const k of keys)if(n[k]!=null&&n[k]!=='')return n[k];return null;};
  const nvS=(keys,d='')=>{const v=nv(keys);return v!=null?String(v).trim():d;};
  const nvI=(keys,d=0)=>{const v=nv(keys);if(v==null)return d;const x=parseInt(String(v).replace(/[^0-9\-]/g,''));return isNaN(x)?d:x;};
  const nvF=(keys,d=0)=>{const v=nv(keys);if(v==null)return d;const x=parseFloat(String(v).replace(',','.'));return isNaN(x)?d:x;};

  const amie=nvS(['amie','codigo','codigoamie','codigoinst']);
  if(!amie)return{amie:null};

  const est=nvI(['total','estudiantes','totalestud','numestudiantes'],0);
  const rac=nvI(['raciones','totalraciones','racion','numraciones'],est*20);
  const pesoTon=nvF(['pesostoneladas','pesos_toneladas','pesonton'],null);
  const peso=pesoTon!=null?pesoTon*1000:nvF(['pesokg','peso','pesototal'],est*4.12);

  // DIA — very broad detection
  const diaRaw=nv([
    // exact normalized matches:
    'dia','diaprogramado','diaentrega','diadistribucion','ndiaentrega',
    'ndia','numerodedia','ndiadistribucion','diaruta','programaciondia',
    'diaoperacion','nrodedia','numdia','ndiaprogramado','diadistrib',
    'ndia','ndiaentrega','ndiaprogramado',
    // the actual column found: 'Día' -> 'dia' already covered above
  ]);
  let dia=1;
  if(diaRaw!=null){
    const parsed=parseInt(String(diaRaw).replace(/[^0-9]/g,''));
    if(!isNaN(parsed)&&parsed>0)dia=parsed;
  }

  const eNorm=s=>s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[\s_\-]+/g,'_');
  const eRaw=eNorm(nvS(['estado','statuentrega','status','statusentrega','estadoentrega','estadodistribucion'],'pendiente'));
  const eMap={
    entregada:'entregada',entregado:'entregada',delivered:'entregada',entrega:'entregada',
    en_ruta:'en_ruta',enruta:'en_ruta',ruta:'en_ruta',en_distribucion:'en_ruta',
    distribucion:'en_ruta',distribuyendo:'en_ruta',en_camino:'en_ruta',encamino:'en_ruta',
    transito:'en_ruta',en_transito:'en_ruta',despachado:'en_ruta',despacho:'en_ruta',
    salida:'en_ruta',en_salida:'en_ruta',
    pendiente:'pendiente',pending:'pendiente',noprogramado:'pendiente',sin_entregar:'pendiente',no_entregado:'pendiente',programado:'pendiente',
    problema:'problema',problem:'problema',novedad:'problema',con_problema:'problema',no_entregado_problema:'problema'};
  const estado=eMap[eRaw]||'pendiente';

  // Coordenadas: 1) lat/lon directas del Excel, 2) UTM Zona 17S o 17N (X/Y), 3) null
  let xlat=null,xlon=null;
  const directLat=nvF(['lat','latitud','latitude','latdec','y_dd'],null);
  const directLon=nvF(['lon','lng','longitud','longitude','londec','x_dd'],null);
  if(directLat&&directLon&&directLat>=-6&&directLat<=2&&directLon>=-92&&directLon<=-75){
    xlat=directLat; xlon=directLon;
  } else {
    // Parsear X/Y con _parseUTM para manejar separadores de miles (#,##0.00)
    const _rx=nv(['x','este','easting']),_ry=nv(['y','norte','northing']);
    const utmX=_parseUTM(_rx),utmY=_parseUTM(_ry);
    // Zona 17S: Y > 5 000 000 (falso norte 10M) | Zona 17N: Y ≤ 5 000 000 (sin falso norte)
    if(utmX!=null&&utmY!=null&&utmX>100000&&utmX<900000&&utmY>0){
      const yAdj=utmY>5000000?utmY-10000000:utmY;
      xlat=yAdj/111320;
      xlon=-81+(utmX-500000)/(111320*Math.cos((xlat||0)*Math.PI/180));
      if(xlat<-6||xlat>2||xlon<-92||xlon>-75){xlat=null;xlon=null;}
    }
  }
  const regRaw=nvS(['regimen','region','reg','zonaeducativa','zonaedu'],'').toUpperCase().trim();
  const reg=regRaw.includes('COSTA')?'COSTA':regRaw.includes('SIERRA')?'SIERRA':'';
  return{amie,nombre:nvS(['nombreinstitucion','nombre','institucion','nombrecolegio']),
    prov:nvS(['provincia','prov']).toUpperCase(),canton:nvS(['canton']),parr:nvS(['parroquia','parr']),
    acceso:(()=>{const r=nvS(['formadeacceso','formaacceso','acceso','tipovia'],'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');return r.includes('AER')?'Aérea':r.includes('FLU')?'Fluvial':r.includes('TER')||r===''?'Terrestre':r.charAt(0).toUpperCase()+r.slice(1).toLowerCase();})(),
    reg,
    estudiantes:est,raciones:rac,peso_kg:peso,dia,estado,
    xlat,xlon,
    fecha_real:nvS(['fechareal','fechaentrega']),hora:nvS(['hora','horaentrega']),
    transportista:nvS(['transportista','nombretransportista']),
    placa:nvS(['placa','placavehiculo']),notas:nvS(['notas','observaciones','comentarios'])};
}

/* ═══════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════ */
function readCfgFromForms(){
  const n=document.getElementById('cfg-cliente').value.trim();
  CFG.clienteNombre=n||CFG.clienteNombre||'';
  if(n)saveClientName(n);
  CFG.programa=document.getElementById('cfg-programa').value.trim()||'Programa';
  CFG.fechaInicioISO=document.getElementById('cfg-fecha').value||isoToday();
  CFG.diasTotal=parseInt(document.getElementById('cfg-dias').value)||10;
}

function applyConfig(){
  readCfgFromForms();
  if(SCHOOLS.length>0){saveToStorage();initDashboard();showToast('✓ Configuración aplicada');}
  else showToast('Carga primero un archivo Excel');
}

function loadConfig2(){
  setField('cfg2-cliente',CFG.clienteNombre);
  setField('cfg2-programa',CFG.programa);
  setField('cfg2-fecha',CFG.fechaInicioISO);
  setField('cfg2-dias',CFG.diasTotal);
  loadConfig2GH();
  checkGHConnectedBadge();
  if(SESSION&&SESSION.role==='superadmin')renderTenantMgmt();
  const ss=document.getElementById('sys-stats');
  if(ss){
    const _dr=CFG.diaFechasRev||{};
    const _dn=Object.keys(_dr).map(Number).filter(n=>n>0).sort((a,b)=>a-b);
    const _diasHtml=_dn.length>0
      ?'<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--gray-100)"><div style="font-size:10px;font-weight:700;color:#5C6478;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px">📅 Calendario de días</div><div style="display:flex;flex-wrap:wrap;gap:3px">'
        +_dn.map(d=>{const iso=_dr[d]||'';const pts=iso.split('-');const lb=pts.length===3?parseInt(pts[2])+' '+MONTHS[parseInt(pts[1])-1]:' — ';return`<span style="background:#E8F5E9;border:1px solid #A5D6A7;border-radius:4px;padding:2px 6px;font-size:10px;font-weight:600;color:#1B5E20;white-space:nowrap">D${d}·${lb}</span>`;}).join('')
        +'</div></div>'
      :'';
    ss.innerHTML=`
    Instituciones cargadas: <strong>${SCHOOLS.length.toLocaleString('es-EC')}</strong><br>
    Cliente: <strong>${CFG.clienteNombre}</strong><br>
    Programa: <strong>${CFG.programa}</strong><br>
    Período: <strong>${CFG.fechaInicioISO} → ${addDays(CFG.fechaInicioISO,CFG.diasTotal-1)}</strong> (${CFG.diasTotal} días)<br>
    Raciones totales: <strong>${SCHOOLS.reduce((a,s)=>a+s.raciones,0).toLocaleString('es-EC')}</strong><br>
    Última actualización: <strong>${document.getElementById('last-update').textContent}</strong>${_diasHtml}`;
  }
}

function saveConfig2(){
  const newNombre=document.getElementById('cfg2-cliente').value.trim();
  CFG.clienteNombre=newNombre||CFG.clienteNombre;
  saveClientName(CFG.clienteNombre);
  CFG.programa=document.getElementById('cfg2-programa').value.trim()||CFG.programa;
  CFG.fechaInicioISO=document.getElementById('cfg2-fecha').value||CFG.fechaInicioISO;
  CFG.diasTotal=parseInt(document.getElementById('cfg2-dias').value)||CFG.diasTotal;
  setField('cfg-cliente',CFG.clienteNombre);setField('cfg-programa',CFG.programa);
  setField('cfg-fecha',CFG.fechaInicioISO);setField('cfg-dias',CFG.diasTotal);
  if(SCHOOLS.length>0){
    saveToStorage();
    initDashboard();
    publishToGitHub({schools:SCHOOLS,cfg:CFG,updatedAt:new Date().toLocaleString('es-EC')},ACTIVE_TENANT?ACTIVE_TENANT.dataPath:null);
  }
  showToast('✓ Configuración guardada y sincronizada');
  loadConfig2();
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD INIT
═══════════════════════════════════════════════════════════ */