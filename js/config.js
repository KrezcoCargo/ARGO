/* ═══════════════════════════════════════════════════════════
   CONSTANTS & STATE
═══════════════════════════════════════════════════════════ */
const SALT = 'krezco2025_x8j';

// ╔══════════════════════════════════════════════════════════════════╗
// ║  GH_REPO_CFG — repositorio compartido                           ║
// ║  Todos los usuarios leen datos y usuarios desde aquí            ║
// ╚══════════════════════════════════════════════════════════════════╝
const GH_REPO_CFG = {
  owner:  'KrezcoCargo',
  repo:   'ARGO',
  branch: 'main',
  path:   'data.json'
};

// Ruta del archivo de usuarios dentro del mismo repo
const GH_USERS_PATH = 'data/users.json';

/* ── PURE-JS SHA-256 (sin crypto.subtle — funciona en file://, http://, https://) ── */
function sha256(msg) {
  const rr=(v,n)=>(v>>>n)|(v<<(32-n));
  const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const bytes=[...new TextEncoder().encode(msg)];
  const bitLen=bytes.length*8;
  bytes.push(0x80);
  while(bytes.length%64!==56)bytes.push(0);
  for(let i=7;i>=0;i--)bytes.push(Math.floor(bitLen/Math.pow(2,i*8))&0xff);
  const ch=H.slice();
  for(let blk=0;blk<bytes.length;blk+=64){
    const W=[];
    for(let i=0;i<16;i++)W.push((bytes[blk+i*4]<<24)|(bytes[blk+i*4+1]<<16)|(bytes[blk+i*4+2]<<8)|bytes[blk+i*4+3]);
    for(let i=16;i<64;i++){const s0=rr(W[i-15],7)^rr(W[i-15],18)^(W[i-15]>>>3);const s1=rr(W[i-2],17)^rr(W[i-2],19)^(W[i-2]>>>10);W.push((W[i-16]+s0+W[i-7]+s1)|0);}
    let [a,b,c,d,e,f,g,h]=[...ch];
    for(let i=0;i<64;i++){const S1=rr(e,6)^rr(e,11)^rr(e,25);const cv=(e&f)^(~e&g);const t1=(h+S1+cv+K[i]+W[i])|0;const S0=rr(a,2)^rr(a,13)^rr(a,22);const mj=(a&b)^(a&c)^(b&c);const t2=(S0+mj)|0;h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
    ch.forEach((v,i)=>{ch[i]=(v+[a,b,c,d,e,f,g,h][i])|0;});
  }
  return ch.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
}
function hashPwd(pwd){return sha256(pwd+SALT);}

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const MONTHS_F = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WD = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const ROLE_PERMS = {
  superadmin:['Ver dashboard completo','Cargar y modificar datos Excel','Gestionar usuarios y roles','Acceso a configuración','Ver mapa'],
  editor:['Ver dashboard completo','Cargar y modificar datos Excel','Ver mapa'],
  viewer:['Ver dashboard (solo lectura)','Ver mapa']
};
const NAV_ITEMS = {
  superadmin:[
    {id:'dashboard',icon:'📊',label:'Dashboard'},
    {id:'map',icon:'🗺️',label:'Mapa'},
    {id:'upload',icon:'📂',label:'Cargar Planificación'},
    {id:'config',icon:'⚙️',label:'Configuración'},
    {id:'users',icon:'👥',label:'Crear Usuarios'},
  ],
  editor:[
    {id:'dashboard',icon:'📊',label:'Dashboard'},
    {id:'map',icon:'🗺️',label:'Mapa'},
    {id:'upload',icon:'📂',label:'Cargar Planificación'},
  ],
  viewer:[
    {id:'dashboard',icon:'📊',label:'Dashboard'},
    {id:'map',icon:'🗺️',label:'Mapa'},
  ]
};

let SCHOOLS=[], CFG={clienteNombre:'',programa:'Programa',fechaInicioISO:'',diasTotal:0,diaFechas:{}};

/* Nombre del cliente — clave por tenant. NO hay fallback a la clave global 'kc_client'
   para evitar que un nombre de otro tenant contamine la vista actual. */
function getSavedClientName(){
  const k='kc_client_'+(ACTIVE_TENANT?ACTIVE_TENANT.id:'');
  return localStorage.getItem(k)||'';
}
function saveClientName(name, tenantId){
  if(!name) return;
  const id=tenantId||(ACTIVE_TENANT?ACTIVE_TENANT.id:'');
  localStorage.setItem('kc_client_'+id, name);
}
let ST={scope:'DAY',prov:'ALL',est:'ALL',dia:1,q:''};
let SESSION=null;
let currentPage='dashboard';

/* ═══════════════════════════════════════════════════════════
   MULTI-TENANT
═══════════════════════════════════════════════════════════ */
const GH_TENANTS_PATH='data/tenants.json';
let TENANTS=[];
let ACTIVE_TENANT=null;
const DEFAULT_TENANTS=[
  {id:'krezco',  name:'KrezcoCargo',           dataPath:'data.json',              color:'#F47C20'},
  {id:'gloria',  name:'Grupo Gloria',           dataPath:'data/gloria.json',       color:'#1565C0'},
  {id:'worldvision',name:'World Vision Ecuador',dataPath:'data/worldvision.json',  color:'#2E7D32'},
  {id:'pruebas', name:'Pruebas',                dataPath:'data/pruebas.json',      color:'#888'}
];
function getDataPath(){return(ACTIVE_TENANT&&ACTIVE_TENANT.dataPath)||GH_REPO_CFG.path;}
function getDataCacheKey(){return'kc_data_'+(ACTIVE_TENANT?ACTIVE_TENANT.id:'default');}
function getUserTenants(){
  if(!SESSION)return[];
  const src=TENANTS.length>0?TENANTS:DEFAULT_TENANTS;
  if(SESSION.role==='superadmin')return src;
  const ids=SESSION.tenants||[];
  if(!ids.length)return src.slice(0,1); // backward-compat: default to first tenant
  return src.filter(t=>ids.includes(t.id));
}
