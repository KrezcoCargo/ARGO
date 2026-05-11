function navTo(page){
  currentPage=page;
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
  const ni=document.getElementById('nav-'+page);
  if(ni)ni.classList.add('active');
  document.querySelectorAll('.page-content').forEach(p=>p.classList.remove('active'));
  const pc=document.getElementById('pg-'+page);
  if(pc)pc.classList.add('active');
  // Topbar
  const titles={dashboard:'Dashboard',map:'Mapa de Rutas',upload:'Cargar Planificación',config:'Configuración',users:'Gestión de Usuarios'};
  document.getElementById('tb-title').textContent=titles[page]||page;
  document.getElementById('tb-sub').textContent=SESSION?`${SESSION.name} · KrezcoCargo SAS`:'KrezcoCargo SAS';
  document.getElementById('date-ctrl').style.display=page==='dashboard'?'':'none';
  // Page-specific init
  if(page==='users')renderUsersPage();
  if(page==='config')loadConfig2();
  if(page==='map'){renderMapStats();initSICMap();if(_mapCreated&&SCHOOLS.length>0)renderMapMarkers();}
}

/* ═══════════════════════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════════════════════ */
function loadFromStorage(){
  try{
    const raw=localStorage.getItem('kc_data');
    if(raw){const o=JSON.parse(raw);SCHOOLS=o.schools||[];CFG=Object.assign(CFG,o.cfg||{});
      const saved=getSavedClientName();if(saved)CFG.clienteNombre=saved;
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
    const saved=getSavedClientName();if(saved)CFG.clienteNombre=saved;
    // Cache locally
    localStorage.setItem('kc_data',JSON.stringify(Object.assign({},remote,{updatedAt:remote.updatedAt||new Date().toLocaleString('es-EC')})));
    setField('cfg-cliente',CFG.clienteNombre);setField('cfg-programa',CFG.programa);
    setField('cfg-fecha',CFG.fechaInicioISO);setField('cfg-dias',CFG.diasTotal);
    const lu=document.getElementById('last-update');
    if(lu)lu.textContent=(remote.updatedAt||'GitHub')+' 🔄';
    _lastDataHash = dataHash(SCHOOLS);
    updateSidebarInfo();initDashboard();refreshMapIfActive();
  } else {
    // Fallback to localStorage
    loadFromStorage();
  }
}

function saveToStorage(){
  localStorage.setItem('kc_data',JSON.stringify({schools:SCHOOLS,cfg:CFG,updatedAt:new Date().toLocaleString('es-EC')}));
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
  localStorage.removeItem('kc_data');SCHOOLS=[];
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
      const skipSheet=n=>{const u=normSheet(n);return u==='DIAS'||u==='CONFIG'||n.toUpperCase()==='PESOS TOTAL';};
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
      const diasSN=wb.SheetNames.find(n=>normSheet(n)==='DIAS');
      if(diasSN){const dws=wb.Sheets[diasSN];const dAoa=XLSX.utils.sheet_to_json(dws,{header:1,defval:null,raw:true});CFG.diaFechas={};CFG.diaFechasRev={};dAoa.forEach(row=>{if(!row||row.length<2)return;const dayNum=parseInt(String(row[0]));const dv=row[1];if(isNaN(dayNum)||dayNum<=0||!dv)return;let iso='';if(dv instanceof Date){iso=dv.getFullYear()+'-'+String(dv.getMonth()+1).padStart(2,'0')+'-'+String(dv.getDate()).padStart(2,'0');}else if(typeof dv==='number'){const epoch=new Date(Math.round((dv-25569)*86400000));iso=epoch.getFullYear()+'-'+String(epoch.getMonth()+1).padStart(2,'0')+'-'+String(epoch.getDate()).padStart(2,'0');}else if(typeof dv==='string'&&dv.length>=8){if(dv.match(/^\d{4}-\d{2}-\d{2}/)){iso=dv.slice(0,10);}else{const p=dv.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(p)iso=p[3]+'-'+p[2].padStart(2,'0')+'-'+p[1].padStart(2,'0');}}if(iso){CFG.diaFechas[iso]=dayNum;CFG.diaFechasRev[dayNum]=iso;}});console.log('[KC] diaFechas:',JSON.stringify(CFG.diaFechas));}
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
  SCHOOLS=rows.map(mapRow).filter(s=>s.amie);
  if(!SCHOOLS.length){showToast('No se encontraron registros válidos.',true);return;}

  const maxDia=Math.max(...SCHOOLS.map(s=>s.dia).filter(d=>d>0));
  if(!isNaN(maxDia)&&maxDia>0&&maxDia>CFG.diasTotal){
    CFG.diasTotal=maxDia;
    setField('cfg-dias',maxDia);
  }

  const dCounts={};SCHOOLS.forEach(s=>{dCounts[s.dia]=(dCounts[s.dia]||0)+1;});
  const eCounts={};SCHOOLS.forEach(s=>{eCounts[s.estado]=(eCounts[s.estado]||0)+1;});
  console.log('[KC] Dia distribution:',JSON.stringify(dCounts));
  console.log('[KC] Estado distribution:',JSON.stringify(eCounts));

  saveToStorage();
  initDashboard();
  refreshMapIfActive();

  const ls=document.getElementById('load-status');
  if(ls)ls.innerHTML=`<div class="status-alert alert-ok">✓ ${SCHOOLS.length.toLocaleString('es-EC')} instituciones cargadas desde "${fname}" · Días detectados: ${Object.keys(dCounts).sort((a,b)=>+a-+b).join(', ')}</div>`;
  showToast(`✓ ${SCHOOLS.length.toLocaleString('es-EC')} IE · días 1-${maxDia}`);

  // Auto-publish to GitHub so all users see the new data
  const dataPayload={schools:SCHOOLS,cfg:CFG,updatedAt:new Date().toLocaleString('es-EC')};
  publishToGitHub(dataPayload);
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

  // Coordenadas: 1) lat/lon directas del Excel, 2) UTM Zone 17S (X/Y), 3) null
  let xlat=null,xlon=null;
  const directLat=nvF(['lat','latitud','latitude','latdec','y_dd'],null);
  const directLon=nvF(['lon','lng','longitud','longitude','londec','x_dd'],null);
  if(directLat&&directLon&&directLat>=-6&&directLat<=2&&directLon>=-92&&directLon<=-75){
    xlat=directLat; xlon=directLon;
  } else {
    const utmX=nvF(['x','este','easting'],null),utmY=nvF(['y','norte','northing'],null);
    if(utmX&&utmY&&utmX>100000&&utmY>1000000){
      xlat=(utmY-10000000)/111320;
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
  const ss=document.getElementById('sys-stats');
  if(ss)ss.innerHTML=`
    Instituciones cargadas: <strong>${SCHOOLS.length.toLocaleString('es-EC')}</strong><br>
    Cliente: <strong>${CFG.clienteNombre}</strong><br>
    Programa: <strong>${CFG.programa}</strong><br>
    Período: <strong>${CFG.fechaInicioISO} → ${addDays(CFG.fechaInicioISO,CFG.diasTotal-1)}</strong> (${CFG.diasTotal} días)<br>
    Raciones totales: <strong>${SCHOOLS.reduce((a,s)=>a+s.raciones,0).toLocaleString('es-EC')}</strong><br>
    Última actualización: <strong>${document.getElementById('last-update').textContent}</strong>`;
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
    // Publicar en GitHub para que todos los usuarios vean el nombre actualizado
    publishToGitHub({schools:SCHOOLS,cfg:CFG,updatedAt:new Date().toLocaleString('es-EC')});
  }
  showToast('✓ Configuración guardada y sincronizada');
  loadConfig2();
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD INIT
═══════════════════════════════════════════════════════════ */