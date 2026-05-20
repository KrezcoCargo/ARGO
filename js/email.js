function openEmailModal(){
  if(typeof currentPage!=='undefined'&&currentPage==='bodega'){
    if(!_bodegaData){showToast('Sin datos de bodega disponibles.',true);return;}
    _renderBodegaModal(_bodegaView);
    document.getElementById('email-modal').style.display='flex';
    return;
  }
  if(!SCHOOLS.length){showToast('Carga primero un archivo Excel.',true);return;}
  renderEmailModal();
  document.getElementById('email-modal').style.display='flex';
}
function closeEmailModal(){document.getElementById('email-modal').style.display='none';}

function renderEmailModal(){
  const d=ST.dia;
  const fecha=d2i(d);
  const [y,m,dd]=fecha.split('-');
  const fechaFmt=dd+'/'+m+'/'+y;
  const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const fechaLarga=parseInt(dd)+' de '+MESES[parseInt(m)-1]+' '+y;

  document.getElementById('em-subtitle').textContent='Día '+d+' · '+fechaLarga+' · '+CFG.clienteNombre;

  const tot=SCHOOLS.length;
  const racTot=SCHOOLS.reduce((a,s)=>a+s.raciones,0);
  const racEnt=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='entregada').reduce((a,s)=>a+s.raciones,0);
  const racRuta=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='en_ruta').reduce((a,s)=>a+s.raciones,0);
  const racPend=racTot-racEnt-racRuta;
  const tonEnt=(SCHOOLS.filter(s=>s.dia<=d&&s.estado==='entregada').reduce((a,s)=>a+s.peso_kg,0)/1000).toFixed(1);
  const pctEnt=racTot>0?Math.round(racEnt/racTot*100):0;
  const nE=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='entregada').length;
  const nR=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='en_ruta').length;
  const nPr=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='problema').length;
  const nP=tot-nE-nR-nPr;

  const fmtR=n=>n>=1e6?(n/1e6).toFixed(2).replace('.',',')+' M':n>=1e3?(n/1e3).toFixed(1).replace('.',',')+' K':n.toLocaleString('es-EC');

  // KPI Cards
  const kpis=[
    {label:'Total Raciones',val:fmtR(racTot),sub:tot+' IE · programa',color:'#14213D',bg:'#14213D',tc:'#fff',sc:'rgba(255,255,255,.55)'},
    {label:'Entregadas',val:fmtR(racEnt),sub:pctEnt+'% · '+tonEnt+' TON',color:'#1F9D55',bg:'#E6F6EC',tc:'#1F9D55',sc:'#2D7A47'},
    {label:'En Ruta',val:fmtR(racRuta),sub:Math.round(racRuta/racTot*100)+'% del programa',color:'#F47C20',bg:'#FFF1E3',tc:'#F47C20',sc:'#A8510D'},
    {label:'Pendientes',val:fmtR(racPend),sub:Math.round(racPend/racTot*100)+'% restante',color:'#9AA4B8',bg:'#EEF1F7',tc:'#5C6478',sc:'#5C6478'},
  ];
  document.getElementById('em-kpis').innerHTML=kpis.map(k=>`
    <div style="background:${k.bg};border-radius:10px;padding:12px 14px">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${k.sc};margin-bottom:4px">${k.label}</div>
      <div style="font-size:20px;font-weight:800;color:${k.tc};line-height:1">${k.val}</div>
      <div style="font-size:10px;color:${k.sc};margin-top:3px">${k.sub}</div>
    </div>`).join('');

  // Barra global
  document.getElementById('em-pct-label').textContent=pctEnt+'% entregado';
  document.getElementById('em-prog-bar').style.width=pctEnt+'%';

  // Provincias
  const provs=[...new Set(SCHOOLS.map(s=>s.prov).filter(Boolean))].sort();
  const PROV_COLORS=['#0277BD','#1F9D55','#7B1FA2','#F47C20','#C62828','#00838F'];
  document.getElementById('em-provs').innerHTML=provs.map((p,i)=>{
    const ptot=SCHOOLS.filter(s=>s.prov===p).length;
    const pent=SCHOOLS.filter(s=>s.prov===p&&s.dia<=d&&s.estado==='entregada').length;
    const ppct=ptot>0?Math.round(pent/ptot*100):0;
    const col=PROV_COLORS[i%PROV_COLORS.length];
    const pname=p.charAt(0)+p.slice(1).toLowerCase();
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:12px;font-weight:700;color:#14213D">${pname}</span>
        <span style="font-size:11px;color:#5C6478">${pent}/${ptot} IE · <strong style="color:${col}">${ppct}%</strong></span>
      </div>
      <div style="background:#EEF1F7;border-radius:999px;height:8px;overflow:hidden">
        <div style="height:100%;background:${col};border-radius:999px;width:${ppct}%"></div>
      </div>
    </div>`;
  }).join('');

  // IE detalle
  const ieItems=[
    {label:'Plan acumulado',val:SCHOOLS.filter(s=>s.dia<=d).length+' IE',color:'#14213D'},
    {label:'Entregadas',val:nE+' IE',color:'#1F9D55'},
    {label:'En ruta',val:nR+' IE',color:'#F47C20'},
    {label:'Pendientes',val:nP+' IE',color:'#9AA4B8'},
    {label:'Con problema',val:nPr+' IE',color:'#DC2626'},
    {label:'Toneladas entregadas',val:tonEnt+' TON',color:'#0277BD'},
  ];
  document.getElementById('em-ie').innerHTML=ieItems.map(x=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#F4F6FB;border-radius:8px">
      <div style="width:8px;height:8px;border-radius:50%;background:${x.color};flex-shrink:0"></div>
      <div>
        <div style="font-size:10px;color:#5C6478">${x.label}</div>
        <div style="font-size:13px;font-weight:800;color:${x.color}">${x.val}</div>
      </div>
    </div>`).join('');
}

function buildEmailBody(){
  const d=ST.dia;
  const fecha=d2i(d);
  const [y,m,dd]=fecha.split('-');
  const fechaFmt=dd+'/'+m+'/'+y;
  const tot=SCHOOLS.length;
  const nE=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='entregada').length;
  const nR=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='en_ruta').length;
  const nPr=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='problema').length;
  const nP=tot-nE-nR-nPr;
  const racTot=SCHOOLS.reduce((a,s)=>a+s.raciones,0);
  const racEnt=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='entregada').reduce((a,s)=>a+s.raciones,0);
  const racRuta=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='en_ruta').reduce((a,s)=>a+s.raciones,0);
  const tonEnt=(SCHOOLS.filter(s=>s.dia<=d&&s.estado==='entregada').reduce((a,s)=>a+s.peso_kg,0)/1000).toFixed(1);
  const pctEnt=racTot>0?Math.round(racEnt/racTot*100):0;
  const provs=[...new Set(SCHOOLS.map(s=>s.prov).filter(Boolean))].sort();
  const provLines=provs.map(p=>{
    const ptot=SCHOOLS.filter(s=>s.prov===p).length;
    const pent=SCHOOLS.filter(s=>s.prov===p&&s.dia<=d&&s.estado==='entregada').length;
    const ppct=ptot>0?Math.round(pent/ptot*100):0;
    const bar='█'.repeat(Math.round(ppct/10))+'░'.repeat(10-Math.round(ppct/10));
    return '  '+(p.charAt(0)+p.slice(1).toLowerCase()).padEnd(16)+bar+' '+ppct+'% ('+pent+'/'+ptot+' IE)';
  }).join('\n');
  return `RESUMEN OPERATIVO — DÍA ${d} · ${fechaFmt}\nPrograma: ${CFG.programa} | ${CFG.clienteNombre}\n${'─'.repeat(48)}\n\nRACIONES\n  Total programa     : ${racTot.toLocaleString('es-EC')}\n  Entregadas         : ${racEnt.toLocaleString('es-EC')} (${pctEnt}%)\n  En ruta            : ${racRuta.toLocaleString('es-EC')}\n  Toneladas entregadas: ${tonEnt} TON\n\nINSTITUCIONES\n  Total programa     : ${tot} IE\n  Entregadas         : ${nE} IE\n  En ruta            : ${nR} IE\n  Con problema       : ${nPr} IE\n  Pendientes         : ${nP} IE\n\nPROGRESO POR PROVINCIA\n${provLines}\n\n${'─'.repeat(48)}\nReporte generado automáticamente · KrezcoCargo SAS`;
}

function buildHtmlEmail(){
  const d=ST.dia;
  const fecha=d2i(d);
  const [y,m,dd]=fecha.split('-');
  const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const fechaLarga=parseInt(dd)+' de '+MESES[parseInt(m)-1]+' '+y;
  const tot=SCHOOLS.length;
  const racTot=SCHOOLS.reduce((a,s)=>a+s.raciones,0);
  const racEnt=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='entregada').reduce((a,s)=>a+s.raciones,0);
  const racRuta=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='en_ruta').reduce((a,s)=>a+s.raciones,0);
  const racPend=racTot-racEnt-racRuta;
  const tonEnt=(SCHOOLS.filter(s=>s.dia<=d&&s.estado==='entregada').reduce((a,s)=>a+s.peso_kg,0)/1000).toFixed(1);
  const pctEnt=racTot>0?Math.round(racEnt/racTot*100):0;
  const nE=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='entregada').length;
  const nR=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='en_ruta').length;
  const nPr=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='problema').length;
  const nP=tot-nE-nR-nPr;
  const fmtR=n=>n>=1e6?(n/1e6).toFixed(2).replace('.',',')+' M':n>=1e3?(n/1e3).toFixed(1).replace('.',',')+' K':n.toLocaleString('es-EC');
  const provs=[...new Set(SCHOOLS.map(s=>s.prov).filter(Boolean))].sort();
  const PCOLORS=['#0277BD','#1F9D55','#7B1FA2','#F47C20','#C62828','#00838F'];
  const provRows=provs.map((p,i)=>{
    const ptot=SCHOOLS.filter(s=>s.prov===p).length;
    const pent=SCHOOLS.filter(s=>s.prov===p&&s.dia<=d&&s.estado==='entregada').length;
    const ppct=ptot>0?Math.round(pent/ptot*100):0;
    const col=PCOLORS[i%PCOLORS.length];
    const pname=p.charAt(0)+p.slice(1).toLowerCase();
    return `<tr><td style="padding:6px 0;width:110px;font-size:13px;font-weight:600;color:#14213D;vertical-align:middle">${pname}</td>
      <td style="padding:6px 8px;vertical-align:middle"><div style="background:#EEF1F7;border-radius:999px;height:10px;overflow:hidden"><div style="height:100%;width:${ppct}%;background:${col};border-radius:999px"></div></div></td>
      <td style="padding:6px 0 6px 8px;white-space:nowrap;font-size:12px;color:#5C6478;vertical-align:middle"><strong style="color:${col}">${ppct}%</strong> &nbsp;${pent}/${ptot} IE</td></tr>`;
  }).join('');
  const kpis=[
    {label:'Total Raciones',val:fmtR(racTot),sub:tot+' IE',bg:'#14213D',vc:'#fff',sc:'rgba(255,255,255,.6)'},
    {label:'Entregadas',val:fmtR(racEnt),sub:pctEnt+'% · '+tonEnt+' TON',bg:'#E6F6EC',vc:'#1F9D55',sc:'#2D7A47'},
    {label:'En Ruta',val:fmtR(racRuta),sub:Math.round(racRuta/racTot*100)+'% del programa',bg:'#FFF1E3',vc:'#F47C20',sc:'#A8510D'},
    {label:'Pendientes',val:fmtR(racPend),sub:Math.round(racPend/racTot*100)+'% restante',bg:'#EEF1F7',vc:'#5C6478',sc:'#5C6478'},
  ];
  const kpiCells=kpis.map(k=>`<td style="width:25%;padding:4px"><div style="background:${k.bg};border-radius:10px;padding:14px 12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${k.sc};margin-bottom:4px">${k.label}</div><div style="font-size:22px;font-weight:800;color:${k.vc};line-height:1.1">${k.val}</div><div style="font-size:10px;color:${k.sc};margin-top:3px">${k.sub}</div></div></td>`).join('');
  const ieItems=[['Plan acumulado',SCHOOLS.filter(s=>s.dia<=d).length+' IE','#14213D'],['Entregadas',nE+' IE','#1F9D55'],['En ruta',nR+' IE','#F47C20'],['Pendientes',nP+' IE','#9AA4B8'],['Con problema',nPr+' IE','#DC2626'],['Toneladas',tonEnt+' TON','#0277BD']];
  const ieCells=ieItems.map(x=>`<td style="width:33%;padding:4px"><div style="background:#F4F6FB;border-radius:8px;padding:9px 12px;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${x[2]};flex-shrink:0"></span><div><div style="font-size:10px;color:#5C6478">${x[0]}</div><div style="font-size:13px;font-weight:800;color:${x[2]}">${x[1]}</div></div></div></td>`).join('');
  return `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;background:#F4F6FB;border-radius:12px;overflow:hidden">
  <div style="background:#14213D;padding:20px 24px">
    <div style="color:#fff;font-size:16px;font-weight:800">Resumen Operativo — Día ${d}</div>
    <div style="color:rgba(255,255,255,.55);font-size:12px;margin-top:3px">${fechaLarga} &nbsp;·&nbsp; ${CFG.clienteNombre} &nbsp;·&nbsp; ${CFG.programa}</div>
  </div>
  <div style="padding:20px 24px">
    <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px"><tr>${kpiCells}</tr></table>
    <div style="background:#fff;border-radius:10px;padding:14px 16px;margin-bottom:16px;border:1px solid #DDE3EE">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#5C6478;margin-bottom:8px">Progreso acumulado del programa</div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1;background:#EEF1F7;border-radius:999px;height:12px;overflow:hidden"><div style="height:100%;width:${pctEnt}%;background:#1F9D55;border-radius:999px"></div></div>
        <span style="font-size:14px;font-weight:800;color:#14213D;white-space:nowrap">${pctEnt}% entregado</span>
      </div>
    </div>
    <div style="background:#fff;border-radius:10px;padding:14px 16px;margin-bottom:16px;border:1px solid #DDE3EE">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#5C6478;margin-bottom:10px">Progreso por Provincia (acumulado días 1–${d})</div>
      <table width="100%" cellspacing="0" cellpadding="0">${provRows}</table>
    </div>
    <div style="background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #DDE3EE">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#5C6478;margin-bottom:10px">Instituciones Educativas</div>
      <table width="100%" cellspacing="0" cellpadding="0"><tr>${ieCells.slice(0,3)}</tr><tr style="margin-top:4px">${ieCells.slice(3)}</tr></table>
    </div>
    <div style="text-align:center;margin-top:16px;font-size:10px;color:#9AA4B8">Reporte generado automáticamente · KrezcoCargo SAS</div>
  </div>
</div>`;
}

function exportPDF(){
  if(typeof currentPage!=='undefined'&&currentPage==='bodega'){_exportBodegaPDF(_bodegaView);return;}
  if(typeof window.jspdf==='undefined'){showToast('Cargando librería PDF, intenta en unos segundos.',true);return;}
  const {jsPDF}=window.jspdf;
  const d=ST.dia;
  const fecha=d2i(d);
  const [y,m,dd]=fecha.split('-');
  const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const fechaLarga=parseInt(dd)+' de '+MESES[parseInt(m)-1]+' '+y;
  const tot=SCHOOLS.length;
  const racTot=SCHOOLS.reduce((a,s)=>a+s.raciones,0);
  const racEnt=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='entregada').reduce((a,s)=>a+s.raciones,0);
  const racRuta=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='en_ruta').reduce((a,s)=>a+s.raciones,0);
  const racPend=racTot-racEnt-racRuta;
  const tonEnt=(SCHOOLS.filter(s=>s.dia<=d&&s.estado==='entregada').reduce((a,s)=>a+s.peso_kg,0)/1000).toFixed(1);
  const pctEnt=racTot>0?Math.round(racEnt/racTot*100):0;
  const nE=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='entregada').length;
  const nR=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='en_ruta').length;
  const nPr=SCHOOLS.filter(s=>s.dia<=d&&s.estado==='problema').length;
  const nP=tot-nE-nR-nPr;
  const fmtR=n=>n>=1e6?(n/1e6).toFixed(2).replace('.',',')+' M':n>=1e3?(n/1e3).toFixed(1).replace('.',',')+' K':n.toLocaleString('es-EC');
  const provs=[...new Set(SCHOOLS.map(s=>s.prov).filter(Boolean))].sort();

  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=doc.internal.pageSize.getWidth();
  const navy=[20,33,61], green=[31,157,85], orange=[244,124,32], gray=[92,100,120], lightbg=[244,246,251];

  // Header band
  doc.setFillColor(...navy);
  doc.rect(0,0,W,28,'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');
  doc.setFontSize(14);
  doc.text('Resumen Operativo — Día '+d,14,11);
  doc.setFontSize(9);
  doc.setFont('helvetica','normal');
  doc.setTextColor(180,190,210);
  doc.text(fechaLarga+'   ·   '+CFG.clienteNombre+'   ·   '+CFG.programa,14,19);
  doc.setTextColor(255,255,255);
  doc.setFontSize(8);
  doc.text('KrezcoCargo SAS',14,25);

  let y2=36;

  // KPI row — 4 boxes
  const kpis=[
    {label:'Total Raciones',val:fmtR(racTot),sub:tot+' IE · programa completo',col:navy,bg:[230,235,245]},
    {label:'Entregadas',val:fmtR(racEnt),sub:pctEnt+'% · '+tonEnt+' TON',col:green,bg:[230,246,236]},
    {label:'En Ruta',val:fmtR(racRuta),sub:Math.round(racRuta/racTot*100)+'% del programa',col:orange,bg:[255,241,227]},
    {label:'Pendientes',val:fmtR(racPend),sub:Math.round(racPend/racTot*100)+'% restante',col:gray,bg:[238,241,247]},
  ];
  const kW=(W-28)/4, kH=20;
  kpis.forEach((k,i)=>{
    const x=14+i*(kW+2.3);
    doc.setFillColor(...k.bg); doc.roundedRect(x,y2,kW,kH,2,2,'F');
    doc.setTextColor(...k.col); doc.setFont('helvetica','bold'); doc.setFontSize(7);
    doc.text(k.label.toUpperCase(),x+4,y2+5);
    doc.setFontSize(13); doc.text(k.val,x+4,y2+12);
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(...gray);
    doc.text(k.sub,x+4,y2+17);
  });
  y2+=kH+6;

  // Barra progreso global
  doc.setFillColor(...lightbg); doc.roundedRect(14,y2,W-28,10,2,2,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...navy);
  doc.text('Progreso acumulado del programa',17,y2+4.5);
  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...green);
  doc.text(pctEnt+'% entregado',W-14,y2+4.5,{align:'right'});
  const barX=14, barY=y2+6.5, barW=W-28, barH=2.5;
  doc.setFillColor(220,224,233); doc.roundedRect(barX,barY,barW,barH,1,1,'F');
  doc.setFillColor(...green); doc.roundedRect(barX,barY,barW*(pctEnt/100),barH,1,1,'F');
  y2+=16;

  // Provincias table
  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...navy);
  doc.text('Progreso por Provincia — Acumulado Días 1–'+d, 14, y2);
  y2+=4;
  const provData=provs.map(p=>{
    const ptot=SCHOOLS.filter(s=>s.prov===p).length;
    const pent=SCHOOLS.filter(s=>s.prov===p&&s.dia<=d&&s.estado==='entregada').length;
    const pruta=SCHOOLS.filter(s=>s.prov===p&&s.dia<=d&&s.estado==='en_ruta').length;
    const ppct=ptot>0?Math.round(pent/ptot*100):0;
    const racTotP=SCHOOLS.filter(s=>s.prov===p).reduce((a,s)=>a+s.raciones,0);
    const racEntP=SCHOOLS.filter(s=>s.prov===p&&s.dia<=d&&s.estado==='entregada').reduce((a,s)=>a+s.raciones,0);
    const racRutaP=SCHOOLS.filter(s=>s.prov===p&&s.dia<=d&&s.estado==='en_ruta').reduce((a,s)=>a+s.raciones,0);
    const pname=p.charAt(0)+p.slice(1).toLowerCase();
    return[pname, pent+' / '+ptot+' IE', ppct+'%',
      racEntP.toLocaleString('es-EC')+' / '+racTotP.toLocaleString('es-EC'),
      pruta+' IE · '+racRutaP.toLocaleString('es-EC')+' rac',
      (ptot-pent-pruta)+' IE'];
  });
  doc.autoTable({startY:y2,head:[['Provincia','IE Entregadas','% Avance','Raciones Ent.','En Ruta','Pendientes']],body:provData,
    styles:{fontSize:8,cellPadding:3,textColor:navy},
    headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',fontSize:7.5},
    alternateRowStyles:{fillColor:[248,249,252]},
    columnStyles:{2:{textColor:green,fontStyle:'bold'},0:{fontStyle:'bold'},3:{textColor:[2,119,189]}},
    margin:{left:14,right:14}});
  y2=doc.lastAutoTable.finalY+6;

  // IE summary table
  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...navy);
  doc.text('Resumen de Instituciones Educativas', 14, y2);
  y2+=4;
  doc.autoTable({startY:y2,head:[['Indicador','Cantidad']],
    body:[['Total programa',tot+' IE'],['Plan acumulado (días 1–'+d+')',SCHOOLS.filter(s=>s.dia<=d).length+' IE'],
      ['Entregadas',nE+' IE'],['En ruta',nR+' IE'],['Pendientes',nP+' IE'],['Con problema',nPr+' IE'],
      ['Toneladas entregadas',tonEnt+' TON'],['Raciones entregadas',racEnt.toLocaleString('es-EC')],
      ['Raciones en ruta',racRuta.toLocaleString('es-EC')],['Raciones pendientes',racPend.toLocaleString('es-EC')]],
    styles:{fontSize:9,cellPadding:3,textColor:navy},
    headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',fontSize:8},
    alternateRowStyles:{fillColor:[248,249,252]},
    margin:{left:14,right:14}});

  // Footer
  const pageH=doc.internal.pageSize.getHeight();
  doc.setDrawColor(220,224,233); doc.line(14,pageH-12,W-14,pageH-12);
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...gray);
  doc.text('Reporte generado automáticamente · KrezcoCargo SAS · '+new Date().toLocaleString('es-EC'),14,pageH-7);

  const filename='Resumen_Dia'+d+'_'+dd+m+y+'.pdf';
  doc.save(filename);

  // Abrir correo con texto redactado
  setTimeout(()=>{
    const [yy,mm,ddx]=fecha.split('-');
    const subject=encodeURIComponent('Resumen Día '+d+' — '+CFG.programa+' — '+ddx+'/'+mm+'/'+yy);
    const recipients=document.getElementById('email-recipients').value.trim();
    const body=encodeURIComponent(
      'Estimado equipo,\n\n'+
      'Adjunto encontrarán el resumen operativo del Día '+d+' correspondiente al '+fechaLarga+'.\n\n'+
      'PUNTOS CLAVE:\n'+
      '  • Raciones entregadas: '+fmtR(racEnt)+' ('+pctEnt+'% del programa total)\n'+
      '  • Raciones en ruta:    '+fmtR(racRuta)+'\n'+
      '  • Toneladas entregadas: '+tonEnt+' TON\n'+
      '  • IE entregadas: '+nE+' de '+tot+' ('+Math.round(nE/tot*100)+'%)\n\n'+
      'Para mayor detalle, revisar el PDF adjunto.\n\n'+
      'Saludos,\n'+
      (SESSION?SESSION.name:'KrezcoCargo SAS'));
    window.location.href='mailto:'+(recipients?encodeURIComponent(recipients):'')+'?subject='+subject+'&body='+body;
  },800);
}

async function copyHtmlForGmail(){
  const isBodega=typeof currentPage!=='undefined'&&currentPage==='bodega';
  const html=isBodega?_buildBodegaHtmlEmail(_bodegaView):buildHtmlEmail();
  const text=isBodega?_buildBodegaEmailBody(_bodegaView):buildEmailBody();
  try{
    await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);
    const btn=document.getElementById('btn-copy-html');
    btn.textContent='✅ ¡Copiado!';btn.style.background='#1F9D55';btn.style.color='#fff';btn.style.borderColor='#1F9D55';
    setTimeout(()=>{btn.textContent='📋 Copiar para Gmail';btn.style.background='#fff';btn.style.color='#1F9D55';btn.style.borderColor='#1F9D55';},2500);
  }catch(e){
    showToast('No se pudo copiar. Usa "Abrir en correo".',true);
  }
}

function sendEmailSummary(){
  const recipients=document.getElementById('email-recipients').value.trim();
  if(!recipients){document.getElementById('email-recipients').style.borderColor='#DC2626';document.getElementById('email-recipients').focus();return;}
  if(typeof currentPage!=='undefined'&&currentPage==='bodega'){
    const subject=encodeURIComponent(_buildBodegaEmailSubject(_bodegaView));
    const body=encodeURIComponent(_buildBodegaEmailBody(_bodegaView));
    window.location.href='mailto:'+encodeURIComponent(recipients)+'?subject='+subject+'&body='+body;
    return;
  }
  const d=ST.dia;
  const fecha=d2i(d);
  const [y,m,dd]=fecha.split('-');
  const subject=encodeURIComponent('Resumen Día '+d+' - '+CFG.programa+' - '+dd+'/'+m+'/'+y);
  const body=encodeURIComponent(buildEmailBody());
  window.location.href='mailto:'+encodeURIComponent(recipients)+'?subject='+subject+'&body='+body;
}

/* ═══════════════════════════════════════════════════════════
   BODEGA EMAIL — modal render + plain text + HTML
═══════════════════════════════════════════════════════════ */

function _bdgVLabel(view){
  return{cobertura:'Cobertura',abastecimiento:'Abastecimiento',proveedores:'Proveedores',
    lotesFinales:'Lotes Finales',reqDiario:'Req. Diario',lastmile:'Last Mile',
    graficas:'Gráficas',invSemanal:'Inv. Semanal'}[view]||view;
}

/* Shared colour helper (mirrors bodega.js _C) */
function _eC(pct){
  const p=Number(pct||0);
  if(p>=0.95)return{bg:'#E6F6EC',fg:'#166534',bar:'#1F9D55'};
  if(p>=0.7) return{bg:'#FEF3C7',fg:'#92400E',bar:'#D97706'};
  return{bg:'#FEE2E2',fg:'#991B1B',bar:'#EF4444'};
}
function _eN(n,d=0){if(n==null||n===''||isNaN(Number(n)))return'—';return Number(n).toLocaleString('es-EC',{minimumFractionDigits:d,maximumFractionDigits:d});}
function _eP(v){if(v==null||isNaN(Number(v)))return'—';return(Number(v)*100).toFixed(1)+'%';}

/* Set the text/visibility of a modal element if it exists */
function _emEl(id,html){const el=document.getElementById(id);if(el)el.innerHTML=html;}
function _emTxt(id,txt){const el=document.getElementById(id);if(el)el.textContent=txt;}
function _emShow(id,show){const el=document.getElementById(id);if(el)el.style.display=show?'':'none';}

/* Build KPI card HTML */
function _emKpi(label,val,sub,bg,vc,sc){
  return`<div style="background:${bg};border-radius:10px;padding:12px 14px">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${sc};margin-bottom:4px">${label}</div>
    <div style="font-size:20px;font-weight:800;color:${vc};line-height:1">${val}</div>
    <div style="font-size:10px;color:${sc};margin-top:3px">${sub}</div>
  </div>`;
}

/* Product progress row (reuse for provinces-section) */
function _emProdBar(name,pct,left,right,barColor){
  const w=Math.min(100,Math.max(0,Math.round(pct)));
  return`<div style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span style="font-size:12px;font-weight:700;color:#14213D;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%">${name||'—'}</span>
      <span style="font-size:11px;color:#5C6478;white-space:nowrap">${left} · <strong style="color:${barColor}">${right}</strong></span>
    </div>
    <div style="background:#EEF1F7;border-radius:999px;height:8px;overflow:hidden">
      <div style="height:100%;background:${barColor};border-radius:999px;width:${w}%"></div>
    </div>
  </div>`;
}

/* Detail chip */
function _emChip(label,val,color){
  return`<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#F4F6FB;border-radius:8px">
    <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></div>
    <div><div style="font-size:10px;color:#5C6478">${label}</div>
    <div style="font-size:13px;font-weight:800;color:${color}">${val}</div></div>
  </div>`;
}

/* ── Main modal renderer ── */
function _renderBodegaModal(view){
  const d=_bodegaData;
  const upd=d.updatedAt||'';
  _emTxt('em-subtitle',_bdgVLabel(view)+(upd?' · '+upd:'')+' · Bodega');

  /* reset prog bar color */
  const pb=document.getElementById('em-prog-bar');
  if(pb)pb.style.background='#1F9D55';

  if(view==='cobertura')      _emBodegaCobertura(d);
  else if(view==='abastecimiento') _emBodegaAbastecimiento(d);
  else if(view==='proveedores')    _emBodegaProveedores(d);
  else if(view==='lotesFinales')   _emBodegaLotes(d);
  else if(view==='reqDiario')      _emBodegaReqDiario(d);
  else if(view==='lastmile')       _emBodegaLastMile(d);
  else if(view==='invSemanal')     _emBodegaInvSemanal(d);
  else                             _emBodegaGenerico(d,view);
}

/* ── 1. COBERTURA ── */
function _emBodegaCobertura(d){
  const rows=(d.cobertura||[]).filter(r=>!(_bdgFilter['cobertura']||[]).includes(r.producto));
  const totIng=rows.reduce((a,r)=>a+(r.ingresos||0),0);
  const totReq=rows.reduce((a,r)=>a+(r.totalReq||0),0);
  const _rg1=totReq>0?totIng/totReq:0;
  const glob=(_rg1>=1&&rows.some(r=>(r.pct||0)<1))?0.99:_rg1;
  const pctGlob=Math.round(glob*100);
  const ok=rows.filter(r=>(r.pct||0)>=1).length;
  const med=rows.filter(r=>(r.pct||0)>=0.7&&(r.pct||0)<1).length;
  const crit=rows.filter(r=>(r.pct||0)<0.7).length;
  const cg=_eC(glob);
  _emEl('em-kpis',[
    _emKpi('Total ingresos',_eN(totIng),ok+' productos completos','#EBF4FD','#0277BD','#0277BD'),
    _emKpi('Total requerido',_eN(totReq),rows.length+' productos','#14213D','#fff','rgba(255,255,255,.6)'),
    _emKpi('Cobertura global',pctGlob+'%',crit+' críticos <70%',cg.bg,cg.fg,cg.fg),
    _emKpi('Estado',ok+'✅ '+med+'⚠️ '+crit+'❌','Completos · Proceso · Críticos','#EEF1F7','#5C6478','#5C6478'),
  ].join(''));
  _emShow('em-prog-section',true);
  _emTxt('em-prog-title','Cobertura global del inventario');
  _emTxt('em-pct-label',pctGlob+'% cobertura');
  const pb=document.getElementById('em-prog-bar');
  if(pb){pb.style.width=pctGlob+'%';pb.style.background=cg.bar;}
  _emShow('em-provs-section',true);
  _emTxt('em-provs-title','Cobertura por producto');
  _emEl('em-provs',rows.map(r=>{
    const c=_eC(r.pct),p=Math.round((r.pct||0)*100);
    return _emProdBar(r.producto,p,_eN(r.ingresos)+' / '+_eN(r.totalReq),p+'%',c.bar);
  }).join(''));
  _emShow('em-ie-section',true);
  _emTxt('em-ie-title','Resumen de cobertura');
  _emEl('em-ie',[
    _emChip('Cobertura global',pctGlob+'%',cg.bar),
    _emChip('Completos ≥100%',ok,   '#1F9D55'),
    _emChip('En proceso 70–99%',med,'#D97706'),
    _emChip('Críticos <70%',crit,   '#EF4444'),
    _emChip('Total ingresos',_eN(totIng),'#0277BD'),
    _emChip('Total requerido',_eN(totReq),'#14213D'),
  ].join(''));
}

/* ── 2. ABASTECIMIENTO ── */
function _emBodegaAbastecimiento(d){
  const rows=(d.abastecimiento||[]).filter(r=>!(_bdgFilter['abastecimiento']||[]).includes(r.producto));
  const ok=rows.filter(r=>(r.pct||0)>=1).length;
  const med=rows.filter(r=>(r.pct||0)>=0.7&&(r.pct||0)<1).length;
  const crit=rows.filter(r=>(r.pct||0)<0.7).length;
  const pctOk=rows.length?Math.round(ok/rows.length*100):0;
  _emEl('em-kpis',[
    _emKpi('Completados ≥100%',ok,'100% abastecidos','#E6F6EC','#1F9D55','#2D7A47'),
    _emKpi('En proceso 70–99%',med,'Parcialmente abast.','#FFF1E3','#F47C20','#A8510D'),
    _emKpi('Críticos <70%',crit,'Requieren atención','#FEE2E2','#DC2626','#991B1B'),
    _emKpi('Total productos',rows.length,pctOk+'% completados','#EEF1F7','#5C6478','#5C6478'),
  ].join(''));
  _emShow('em-prog-section',true);
  _emTxt('em-prog-title','Productos con abastecimiento completo');
  _emTxt('em-pct-label',pctOk+'% completos');
  const pb=document.getElementById('em-prog-bar');
  if(pb){pb.style.width=pctOk+'%';pb.style.background='#1F9D55';}
  _emShow('em-provs-section',true);
  _emTxt('em-provs-title','Nivel de abastecimiento por producto');
  _emEl('em-provs',rows.map(r=>{
    const c=_eC(r.pct),p=Math.round((r.pct||0)*100);
    return _emProdBar(r.producto,p,_eN(r.ingresos)+' / '+_eN(r.totalReq),p+'%',c.bar);
  }).join(''));
  _emShow('em-ie-section',true);
  _emTxt('em-ie-title','Productos críticos');
  const critRows=rows.filter(r=>(r.pct||0)<0.7);
  _emEl('em-ie',critRows.length
    ? critRows.map(r=>_emChip(r.producto,_eP(r.pct),'#EF4444')).join('')
    : '<div style="font-size:12px;color:#1F9D55;padding:8px">✅ Sin productos críticos</div>');
}

/* ── 3. PROVEEDORES ── */
function _emBodegaProveedores(d){
  const rows=(d.proveedores||[]).filter(r=>!(_bdgFilter['proveedores']||[]).includes(r.producto));
  const totP=rows.reduce((a,r)=>a+(r.planificado||0),0);
  const totI=rows.reduce((a,r)=>a+(r.ingresos||0),0);
  const _rg2=totP>0?totI/totP:0;
  const glob=(_rg2>=1&&rows.some(r=>(r.pct||0)<1))?0.99:_rg2;
  const pctG=Math.round(glob*100);
  const cg=_eC(glob);
  const crit=rows.filter(r=>(r.pct||0)<0.7).length;
  const ok=rows.filter(r=>(r.pct||0)>=1).length;
  _emEl('em-kpis',[
    _emKpi('Total planificado',_eN(totP),rows.length+' proveedores','#14213D','#fff','rgba(255,255,255,.6)'),
    _emKpi('Total ingresos',_eN(totI),ok+' completos','#E6F6EC','#1F9D55','#2D7A47'),
    _emKpi('Cumplimiento global',pctG+'%',crit+' críticos','#EBF4FD','#0277BD','#0277BD'),
    _emKpi('Estado',ok+'✅ '+crit+'❌','Completos · Críticos',cg.bg,cg.fg,cg.fg),
  ].join(''));
  _emShow('em-prog-section',true);
  _emTxt('em-prog-title','Cumplimiento global de proveedores');
  _emTxt('em-pct-label',pctG+'% cumplimiento');
  const pb=document.getElementById('em-prog-bar');
  if(pb){pb.style.width=pctG+'%';pb.style.background=cg.bar;}
  _emShow('em-provs-section',true);
  _emTxt('em-provs-title','Cumplimiento por proveedor');
  _emEl('em-provs',rows.map(r=>{
    const c=_eC(r.pct),p=Math.round((r.pct||0)*100);
    return _emProdBar(r.producto,p,_eN(r.ingresos)+' / '+_eN(r.planificado),p+'%',c.bar);
  }).join(''));
  _emShow('em-ie-section',true);
  _emTxt('em-ie-title','Resumen de proveedores');
  _emEl('em-ie',[
    _emChip('Cumplimiento global',pctG+'%',cg.bar),
    _emChip('Total planificado',_eN(totP),'#14213D'),
    _emChip('Total ingresos',_eN(totI),'#1F9D55'),
    _emChip('Completos ≥100%',ok,'#1F9D55'),
    _emChip('En proceso 70–99%',rows.filter(r=>(r.pct||0)>=0.7&&(r.pct||0)<1).length,'#D97706'),
    _emChip('Críticos <70%',crit,'#EF4444'),
  ].join(''));
}

/* ── 4. LOTES FINALES ── */
function _emBodegaLotes(d){
  const rows=(d.lotesFinales||[]).filter(r=>!(_bdgFilter['lotesFinales']||[]).includes(r.producto));
  const ok=rows.filter(r=>(r.pct||0)>=1).length;
  const crit=rows.filter(r=>(r.pct||0)<0.7).length;
  const pctOk=rows.length?Math.round(ok/rows.length*100):0;
  _emEl('em-kpis',[
    _emKpi('Completados ≥100%',ok,'Lotes cubiertos','#E6F6EC','#1F9D55','#2D7A47'),
    _emKpi('Críticos <70%',crit,'Requieren lotes','#FEE2E2','#DC2626','#991B1B'),
    _emKpi('Total productos',rows.length,pctOk+'% completados','#EEF1F7','#5C6478','#5C6478'),
    _emKpi('Actualizado',d.updatedAt||'—','Última sincronización','#EBF4FD','#0277BD','#0277BD'),
  ].join(''));
  _emShow('em-prog-section',true);
  _emTxt('em-prog-title','Productos con cobertura completa');
  _emTxt('em-pct-label',pctOk+'% completados');
  const pb=document.getElementById('em-prog-bar');
  if(pb){pb.style.width=pctOk+'%';pb.style.background='#1F9D55';}
  _emShow('em-provs-section',true);
  _emTxt('em-provs-title','Cobertura y lotes por producto');
  _emEl('em-provs',rows.map(r=>{
    const c=_eC(r.pct),p=Math.round((r.pct||0)*100);
    const loteText=r.lotes&&r.lotes!=='—'&&r.lotes!=='-'?r.lotes:'Sin lote';
    return`<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <span style="font-size:12px;font-weight:700;color:#14213D;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50%">${r.producto||'—'}</span>
        <span style="font-size:11px;color:#5C6478;white-space:nowrap"><strong style="color:${c.bar}">${p}%</strong> · ${_eN(r.porRecibir)}</span>
      </div>
      <div style="background:#EEF1F7;border-radius:999px;height:8px;overflow:hidden;margin-bottom:3px">
        <div style="height:100%;background:${c.bar};border-radius:999px;width:${Math.min(100,p)}%"></div>
      </div>
      <div style="font-size:10px;color:#64748B">${loteText}</div>
    </div>`;
  }).join(''));
  _emShow('em-ie-section',true);
  _emTxt('em-ie-title','Alertas de lotes');
  const critRows=rows.filter(r=>(r.pct||0)<0.7);
  _emEl('em-ie',critRows.length
    ? critRows.map(r=>{const c=_eC(r.pct);return _emChip(r.producto,_eP(r.pct),c.bar);}).join('')
    : '<div style="font-size:12px;color:#1F9D55;padding:8px">✅ Sin productos críticos</div>');
}

/* ── 5. REQ. DIARIO ── */
function _emBodegaReqDiario(d){
  const rows=(d.requerimientoDiario||[]).filter(r=>!(_bdgFilter['reqDiario']||[]).includes(r.producto));
  const totDist=rows.reduce((a,r)=>a+(r.distributivo||0),0);
  const nd=rows.length?Math.max(...rows.map(r=>(r.dias||[]).length),0):0;
  const lbls=d.diaLabels||[];
  _emEl('em-kpis',[
    _emKpi('Total productos',rows.length,'En requerimiento','#14213D','#fff','rgba(255,255,255,.6)'),
    _emKpi('Total distributivo',_eN(totDist),nd+' días planificados','#EBF4FD','#0277BD','#0277BD'),
    _emKpi('Días',nd,lbls[0]?(lbls[0].replace(/^D\d+_/,''))+' – '+(lbls[nd-1]||'').replace(/^D\d+_/,''):'planificados','#FFF1E3','#F47C20','#A8510D'),
    _emKpi('Actualizado',d.updatedAt||'—','Última sincronización','#EEF1F7','#5C6478','#5C6478'),
  ].join(''));
  _emShow('em-prog-section',false);
  _emShow('em-provs-section',true);
  _emTxt('em-provs-title','Requerimiento diario por producto');
  _emEl('em-provs',rows.map(r=>{
    const dias=(r.dias||[]).filter(v=>v!=null&&v!=='');
    const sum=dias.reduce((a,v)=>a+Number(v),0);
    return`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #F1F5F9">
      <span style="font-size:12px;font-weight:700;color:#14213D">${r.producto||'—'}</span>
      <span style="font-size:12px;color:#5C6478">Dist: <strong style="color:#F47C20">${_eN(r.distributivo)}</strong> · Suma: ${_eN(sum)}</span>
    </div>`;
  }).join(''));
  _emShow('em-ie-section',true);
  _emTxt('em-ie-title','Resumen requerimiento');
  _emEl('em-ie',[
    _emChip('Total productos',rows.length,'#14213D'),
    _emChip('Total distributivo',_eN(totDist),'#F47C20'),
    _emChip('Días planificados',nd,'#0277BD'),
    _emChip('Actualizado',d.updatedAt||'—','#9AA4B8'),
  ].join(''));
}

/* ── 6. LAST MILE ── */
function _emBodegaLastMile(d){
  const lm=d.lastmile||{};
  const pivot=(lm.pivot||[]).filter(r=>r.transportista&&!/^total/i.test(r.transportista.trim()));
  const res=lm.resumen||[];
  const totTrans=pivot.length;
  const valKeys=pivot.length?Object.keys(pivot[0]).filter(k=>k!=='transportista'&&!/^B\d+$/.test(k)):[];
  const totErr=pivot.reduce((a,r)=>a+valKeys.reduce((b,k)=>b+(Number(r[k])||0),0),0);
  _emEl('em-kpis',[
    _emKpi('Transportistas',totTrans,'Con errores registrados','#FEE2E2','#DC2626','#991B1B'),
    _emKpi('Total errores',_eN(totErr),'Suma de todas las novedades','#FFF1E3','#F47C20','#A8510D'),
    _emKpi('Días registrados',res.length,'Con datos de validación','#EBF4FD','#0277BD','#0277BD'),
    _emKpi('Actualizado',d.updatedAt||'—','Última sincronización','#EEF1F7','#5C6478','#5C6478'),
  ].join(''));
  _emShow('em-prog-section',false);
  _emShow('em-provs-section',true);
  _emTxt('em-provs-title','Errores por transportista');
  _emEl('em-provs',pivot.length?pivot.map(r=>{
    const errTotal=valKeys.reduce((a,k)=>a+(Number(r[k])||0),0);
    return`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #F1F5F9">
      <span style="font-size:12px;font-weight:700;color:#14213D">${r.transportista||'—'}</span>
      <span style="font-size:12px;color:#EF4444;font-weight:700">${_eN(errTotal)} errores</span>
    </div>`;
  }).join(''):'<div style="font-size:12px;color:#1F9D55;padding:8px">✅ Sin errores registrados</div>');
  _emShow('em-ie-section',true);
  _emTxt('em-ie-title','Resumen por día (Meta vs Validación)');
  _emEl('em-ie',res.length?res.map(r=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#F4F6FB;border-radius:8px">
      <div><div style="font-size:10px;color:#5C6478">${r.etiqueta||'—'}</div>
      <div style="font-size:12px;font-weight:700;color:#14213D">Meta: ${_eN(r.cuentaTrans)} · Val: ${_eN(r.cuentaVal)}</div></div>
    </div>`).join(''):'<div style="font-size:12px;color:#9AA4B8;padding:8px">Sin datos diarios</div>');
}

/* ── 7. INV. SEMANAL ── */
function _emBodegaInvSemanal(d){
  const inv=(d.inventario||[]).filter(r=>!(_bdgFilter['invSemanal']||[]).includes(r.producto));
  const pos=inv.filter(r=>Number(r.ajuste||0)>0).length;
  const neg=inv.filter(r=>Number(r.ajuste||0)<0).length;
  const sumPos=inv.filter(r=>Number(r.ajuste||0)>0).reduce((a,r)=>a+Number(r.ajuste),0);
  const sumNeg=inv.filter(r=>Number(r.ajuste||0)<0).reduce((a,r)=>a+Number(r.ajuste),0);
  _emEl('em-kpis',[
    _emKpi('Ajustes positivos',pos,'+'+_eN(sumPos)+' unidades','#E6F6EC','#1F9D55','#2D7A47'),
    _emKpi('Ajustes negativos',neg,_eN(sumNeg)+' unidades','#FEE2E2','#DC2626','#991B1B'),
    _emKpi('Total productos',inv.length,'Con ajuste de inventario','#EEF1F7','#5C6478','#5C6478'),
    _emKpi('Actualizado',d.updatedAt||'—','Última sincronización','#EBF4FD','#0277BD','#0277BD'),
  ].join(''));
  _emShow('em-prog-section',false);
  _emShow('em-provs-section',true);
  _emTxt('em-provs-title','Ajuste de inventario por producto');
  _emEl('em-provs',inv.length?inv.map(r=>{
    const v=Number(r.ajuste||0),neg=v<0;
    const col=neg?'#F47C20':'#3D8EB9';
    const mx=Math.max(...inv.map(x=>Math.abs(Number(x.ajuste||0))),1);
    const pct=Math.round(Math.abs(v)/mx*100);
    return`<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:12px;font-weight:700;color:#14213D;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%">${r.producto||'—'}</span>
        <span style="font-size:12px;font-weight:800;color:${col}">${_eN(v)}</span>
      </div>
      <div style="background:${neg?'rgba(244,124,32,.1)':'rgba(61,142,185,.1)'};border-radius:999px;height:8px;overflow:hidden">
        <div style="height:100%;background:${col};border-radius:999px;width:${pct}%"></div>
      </div>
    </div>`;
  }).join(''):'<div style="font-size:12px;color:#9AA4B8;padding:8px">Sin ajustes registrados</div>');
  _emShow('em-ie-section',true);
  _emTxt('em-ie-title','Inventario semanal');
  const sem=d.inventarioSemanal||[];
  const keys=Object.keys(sem[0]||{}).filter(k=>k!=='dia'&&k!=='__rowNum');
  _emEl('em-ie',sem.length?sem.map(r=>`
    <div style="padding:7px 10px;background:#F4F6FB;border-radius:8px;grid-column:1/-1">
      <div style="font-size:11px;font-weight:700;color:#F47C20;margin-bottom:4px">${r.dia||'—'}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${keys.map(k=>`<span style="font-size:11px;color:#14213D"><span style="color:#9AA4B8">${k}:</span> <strong>${r[k]!=null?r[k]:'—'}</strong></span>`).join('')}</div>
    </div>`).join(''):'<div style="font-size:12px;color:#9AA4B8;padding:8px">Sin datos semanales</div>');
}

/* ── 8. Genérico (Gráficas, etc.) ── */
function _emBodegaGenerico(d,view){
  _emEl('em-kpis',[
    _emKpi('Vista',_bdgVLabel(view),'Reporte de bodega','#14213D','#fff','rgba(255,255,255,.6)'),
    _emKpi('Actualizado',d.updatedAt||'—','Última sincronización','#EEF1F7','#5C6478','#5C6478'),
  ].join(''));
  _emShow('em-prog-section',false);
  _emShow('em-provs-section',false);
  _emShow('em-ie-section',false);
}

/* ══ PDF EXPORT — BODEGA ══ */
function _exportBodegaPDF(view){
  if(typeof window.jspdf==='undefined'){showToast('Cargando librería PDF, intenta en unos segundos.',true);return;}
  const {jsPDF}=window.jspdf;
  const d=_bodegaData;
  const upd=d.updatedAt||'—';
  const today=new Date().toLocaleDateString('es-EC',{day:'2-digit',month:'2-digit',year:'numeric'});
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=doc.internal.pageSize.getWidth();
  const navy=[10,48,96], blue=[21,101,192], gray=[92,100,120], lightbg=[244,246,251];
  const green=[31,157,85], orange=[244,124,32], red=[220,38,38];

  // Header
  doc.setFillColor(...blue); doc.rect(0,0,W,26,'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(13);
  doc.text('Reporte Bodega — '+_bdgVLabel(view), 14, 11);
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(200,220,255);
  doc.text('Actualizado: '+upd+'   ·   Generado: '+today, 14, 19);

  let y=34;

  function kpiRow(items){
    const kW=(W-28)/items.length;
    items.forEach((k,i)=>{
      const x=14+i*(kW+2);
      doc.setFillColor(...(k.bg||lightbg)); doc.roundedRect(x,y,kW-2,16,2,2,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...(k.lc||gray));
      // Replace special chars jsPDF can't render
      doc.text((k.label||'').replace(/≥/g,'>=').replace(/≤/g,'<=').toUpperCase(), x+3, y+5);
      doc.setFontSize(12); doc.setTextColor(...(k.vc||navy));
      doc.text(String(k.val||'—'), x+3, y+13);
    });
    y+=22;
  }

  function progBar(pct,col){
    col=col||green;
    doc.setFillColor(220,224,233); doc.roundedRect(14,y,W-28,4,1,1,'F');
    doc.setFillColor(...col); doc.roundedRect(14,y,(W-28)*(Math.min(100,pct)/100),4,1,1,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...col);
    doc.text(pct+'%', W-14, y+3.5,{align:'right'});
    y+=10;
  }

  // ── Helper: color cell by coverage pct ──
  function _pctColor(pct){ return pct>=1?green:pct>=0.7?orange:red; }

  // ── didParseCell hook for coverage-based row coloring ──
  function _coverageHook(rows, pctColIdx){
    return function(data){
      if(data.section!=='body')return;
      const r=rows[data.row.index];
      if(!r)return;
      const pct=r.pct||0;
      if(pct<1){
        const col=_pctColor(pct);
        if(data.column.index===0){data.cell.styles.textColor=col;data.cell.styles.fontStyle='bold';}
        if(data.column.index===pctColIdx){data.cell.styles.textColor=col;data.cell.styles.fontStyle='bold';}
      } else {
        if(data.column.index===pctColIdx){data.cell.styles.textColor=green;data.cell.styles.fontStyle='bold';}
      }
    };
  }

  // ── Per-view content ──
  if(view==='cobertura'){
    const rows=(d.cobertura||[]).filter(r=>!(_bdgFilter['cobertura']||[]).includes(r.producto));
    const totIng=rows.reduce((a,r)=>a+(r.ingresos||0),0);
    const totReq=rows.reduce((a,r)=>a+(r.totalReq||0),0);
    const _rg3=totReq>0?totIng/totReq:0;
    const glob=(_rg3>=1&&rows.some(r=>(r.pct||0)<1))?0.99:_rg3, pctG=Math.round(glob*100);
    const ok=rows.filter(r=>(r.pct||0)>=1).length, med=rows.filter(r=>(r.pct||0)>=0.7&&(r.pct||0)<1).length, crit=rows.filter(r=>(r.pct||0)<0.7).length;
    const col=glob>=0.95?green:glob>=0.7?orange:red;
    kpiRow([
      {label:'Total ingresos',val:_eN(totIng),bg:[235,244,253],vc:[2,119,189],lc:[2,119,189]},
      {label:'Total requerido',val:_eN(totReq),bg:navy,vc:[255,255,255],lc:[180,200,230]},
      {label:'Cobertura global',val:pctG+'%',bg:lightbg,vc:col,lc:col},
      {label:'Completos / Proceso / Criticos',val:ok+' / '+med+' / '+crit,bg:lightbg,vc:gray,lc:gray},
    ]);
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...gray);
    doc.text('COBERTURA GLOBAL DEL INVENTARIO',14,y);y+=4;
    progBar(pctG,col);
    // Por Recibir: 0 si ya cubrió (>=100%), déficit negativo si falta
    const bodyRows=rows.map(r=>{
      const deficit=Math.min(0,(r.ingresos||0)-(r.totalReq||0));
      const prTxt=deficit===0?'0':_eN(deficit);
      return[r.producto||'—',_eN(r.ingresos),_eN(r.totalReq),prTxt,Math.round((r.pct||0)*100)+'%'];
    });
    doc.autoTable({startY:y,
      head:[['Producto','Ingresos','Requerido','Por Recibir','Cobertura']],
      body:bodyRows,
      styles:{fontSize:8,cellPadding:2.5,textColor:navy},
      headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',fontSize:7.5},
      alternateRowStyles:{fillColor:[248,249,252]},
      columnStyles:{
        0:{cellWidth:'auto'},
        1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'}
      },
      didParseCell(data){
        if(data.section!=='body')return;
        const r=rows[data.row.index];if(!r)return;
        const deficit=Math.min(0,(r.ingresos||0)-(r.totalReq||0));
        const pct=r.pct||0;
        // Col 3 — Por Recibir
        if(data.column.index===3){
          data.cell.styles.fontStyle='bold';
          if(deficit===0){
            data.cell.styles.fillColor=[220,252,231];
            data.cell.styles.textColor=[21,128,61];
          } else {
            data.cell.styles.fillColor=[254,226,226];
            data.cell.styles.textColor=[185,28,28];
          }
        }
        // Col 4 — Cobertura (mantiene colores de semáforo)
        if(data.column.index===4){
          data.cell.styles.fontStyle='bold';
          const fc=pct>=1?[21,128,61]:pct>=0.7?[194,120,10]:[185,28,28];
          const bc=pct>=1?[220,252,231]:pct>=0.7?[254,243,199]:[254,226,226];
          data.cell.styles.fillColor=bc;
          data.cell.styles.textColor=fc;
        }
        // Fila con déficit: tinte muy sutil en toda la fila excepto cols 3 y 4
        if(deficit<0&&data.column.index<3){
          data.cell.styles.fillColor=[255,248,248];
        }
      },
      margin:{left:14,right:14}});

  } else if(view==='abastecimiento'){
    const rows=(d.abastecimiento||[]).filter(r=>!(_bdgFilter['abastecimiento']||[]).includes(r.producto));
    const ok=rows.filter(r=>(r.pct||0)>=1).length, med=rows.filter(r=>(r.pct||0)>=0.7&&(r.pct||0)<1).length, crit=rows.filter(r=>(r.pct||0)<0.7).length;
    kpiRow([
      {label:'Completos >=100%',val:ok,bg:[230,246,236],vc:green,lc:green},
      {label:'En proceso 70-99%',val:med,bg:[255,241,227],vc:orange,lc:orange},
      {label:'Criticos <70%',val:crit,bg:[254,226,226],vc:red,lc:red},
      {label:'Total productos',val:rows.length,bg:lightbg,vc:gray,lc:gray},
    ]);
    const bodyRowsA=rows.map(r=>{
      const deficit=Math.min(0,(r.ingresos||0)-(r.totalReq||0));
      return[r.producto||'—',_eN(r.ingresos),_eN(r.totalReq),deficit===0?'0':_eN(deficit),Math.round((r.pct||0)*100)+'%'];
    });
    doc.autoTable({startY:y,
      head:[['Producto','Ingresos','Requerido','Por Recibir','Cobertura']],
      body:bodyRowsA,
      styles:{fontSize:8,cellPadding:2.5,textColor:navy},
      headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',fontSize:7.5},
      alternateRowStyles:{fillColor:[248,249,252]},
      columnStyles:{0:{cellWidth:'auto'},1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'}},
      didParseCell(data){
        if(data.section!=='body')return;
        const r=rows[data.row.index];if(!r)return;
        const deficit=Math.min(0,(r.ingresos||0)-(r.totalReq||0));
        const pct=r.pct||0;
        if(data.column.index===3){
          data.cell.styles.fontStyle='bold';
          if(deficit===0){data.cell.styles.fillColor=[220,252,231];data.cell.styles.textColor=[21,128,61];}
          else{data.cell.styles.fillColor=[254,226,226];data.cell.styles.textColor=[185,28,28];}
        }
        if(data.column.index===4){
          data.cell.styles.fontStyle='bold';
          const fc=pct>=1?[21,128,61]:pct>=0.7?[194,120,10]:[185,28,28];
          const bc=pct>=1?[220,252,231]:pct>=0.7?[254,243,199]:[254,226,226];
          data.cell.styles.fillColor=bc;data.cell.styles.textColor=fc;
        }
        if(deficit<0&&data.column.index<3){data.cell.styles.fillColor=[255,248,248];}
      },
      margin:{left:14,right:14}});

  } else if(view==='proveedores'){
    const rows=(d.proveedores||[]).filter(r=>!(_bdgFilter['proveedores']||[]).includes(r.producto));
    const totP=rows.reduce((a,r)=>a+(r.planificado||0),0), totI=rows.reduce((a,r)=>a+(r.ingresos||0),0);
    const _rg4=totP>0?totI/totP:0;
    const glob=(_rg4>=1&&rows.some(r=>(r.pct||0)<1))?0.99:_rg4, pctG=Math.round(glob*100);
    const col=glob>=0.95?green:glob>=0.7?orange:red;
    kpiRow([
      {label:'Total planificado',val:_eN(totP),bg:navy,vc:[255,255,255],lc:[180,200,230]},
      {label:'Total ingresos',val:_eN(totI),bg:[230,246,236],vc:green,lc:green},
      {label:'Cumplimiento global',val:pctG+'%',bg:lightbg,vc:col,lc:col},
      {label:'Proveedores',val:rows.length,bg:lightbg,vc:gray,lc:gray},
    ]);
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...gray);
    doc.text('CUMPLIMIENTO GLOBAL DE PROVEEDORES',14,y);y+=4;
    progBar(pctG,col);
    const bodyRowsP=rows.map(r=>{
      const deficit=Math.min(0,(r.ingresos||0)-(r.planificado||0));
      return[r.producto||'—',_eN(r.planificado),_eN(r.ingresos),deficit===0?'0':_eN(deficit),Math.round((r.pct||0)*100)+'%'];
    });
    doc.autoTable({startY:y,
      head:[['Proveedor / Producto','Planificado','Ingresos','Por Recibir','Cumplimiento']],
      body:bodyRowsP,
      styles:{fontSize:8,cellPadding:2.5,textColor:navy},
      headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',fontSize:7.5},
      alternateRowStyles:{fillColor:[248,249,252]},
      columnStyles:{0:{cellWidth:'auto'},1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'}},
      didParseCell(data){
        if(data.section!=='body')return;
        const r=rows[data.row.index];if(!r)return;
        const deficit=Math.min(0,(r.ingresos||0)-(r.planificado||0));
        const pct=r.pct||0;
        if(data.column.index===3){
          data.cell.styles.fontStyle='bold';
          if(deficit===0){data.cell.styles.fillColor=[220,252,231];data.cell.styles.textColor=[21,128,61];}
          else{data.cell.styles.fillColor=[254,226,226];data.cell.styles.textColor=[185,28,28];}
        }
        if(data.column.index===4){
          data.cell.styles.fontStyle='bold';
          const fc=pct>=1?[21,128,61]:pct>=0.7?[194,120,10]:[185,28,28];
          const bc=pct>=1?[220,252,231]:pct>=0.7?[254,243,199]:[254,226,226];
          data.cell.styles.fillColor=bc;data.cell.styles.textColor=fc;
        }
        if(deficit<0&&data.column.index<3){data.cell.styles.fillColor=[255,248,248];}
      },
      margin:{left:14,right:14}});

  } else if(view==='lotesFinales'){
    const rows=(d.lotesFinales||[]).filter(r=>!(_bdgFilter['lotesFinales']||[]).includes(r.producto));
    const ok=rows.filter(r=>(r.pct||0)>=1).length, crit=rows.filter(r=>(r.pct||0)<0.7).length;
    kpiRow([
      {label:'Completados >=100%',val:ok,bg:[230,246,236],vc:green,lc:green},
      {label:'Criticos <70%',val:crit,bg:[254,226,226],vc:red,lc:red},
      {label:'Total productos',val:rows.length,bg:lightbg,vc:gray,lc:gray},
      {label:'Actualizado',val:upd,bg:lightbg,vc:gray,lc:gray},
    ]);
    const bodyRowsL=rows.map(r=>{
      const deficit=Math.min(0,r.porRecibir||0);
      return[r.producto||'—',deficit===0?'0':_eN(deficit),Math.round((r.pct||0)*100)+'%',r.lotes&&r.lotes!=='-'?r.lotes:'—'];
    });
    doc.autoTable({startY:y,
      head:[['Producto','Por Recibir','Cobertura','Lote']],
      body:bodyRowsL,
      styles:{fontSize:8,cellPadding:2.5,textColor:navy},
      headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',fontSize:7.5},
      alternateRowStyles:{fillColor:[248,249,252]},
      columnStyles:{0:{cellWidth:'auto'},1:{halign:'right'},2:{halign:'right'},3:{halign:'left'}},
      didParseCell(data){
        if(data.section!=='body')return;
        const r=rows[data.row.index];if(!r)return;
        const deficit=Math.min(0,r.porRecibir||0);
        const pct=r.pct||0;
        if(data.column.index===1){
          data.cell.styles.fontStyle='bold';
          if(deficit===0){data.cell.styles.fillColor=[220,252,231];data.cell.styles.textColor=[21,128,61];}
          else{data.cell.styles.fillColor=[254,226,226];data.cell.styles.textColor=[185,28,28];}
        }
        if(data.column.index===2){
          data.cell.styles.fontStyle='bold';
          const fc=pct>=1?[21,128,61]:pct>=0.7?[194,120,10]:[185,28,28];
          const bc=pct>=1?[220,252,231]:pct>=0.7?[254,243,199]:[254,226,226];
          data.cell.styles.fillColor=bc;data.cell.styles.textColor=fc;
        }
        if(deficit<0&&data.column.index===0){data.cell.styles.fillColor=[255,248,248];}
      },
      margin:{left:14,right:14}});

  } else if(view==='reqDiario'){
    const rows=(d.requerimientoDiario||[]).filter(r=>!(_bdgFilter['reqDiario']||[]).includes(r.producto));
    const totDist=rows.reduce((a,r)=>a+(r.distributivo||0),0);
    const nd=rows.length?Math.max(...rows.map(r=>(r.dias||[]).length),0):0;
    kpiRow([
      {label:'Total productos',val:rows.length,bg:navy,vc:[255,255,255],lc:[180,200,230]},
      {label:'Total distributivo',val:_eN(totDist),bg:[255,241,227],vc:orange,lc:orange},
      {label:'Dias planificados',val:nd,bg:[235,244,253],vc:[2,119,189],lc:[2,119,189]},
      {label:'Actualizado',val:upd,bg:lightbg,vc:gray,lc:gray},
    ]);
    const lbls=d.diaLabels||[];
    const dayHdrs=Array.from({length:nd},(_,i)=>{const r=lbls[i]||'';const m=r.match(/^D\d+_(.+)$/);return m?m[1]:'D'+(i+1);});
    doc.autoTable({startY:y,
      head:[['Producto',...dayHdrs,'Distributivo','Dias']],
      body:rows.map(r=>[r.producto||'—',...Array.from({length:nd},(_,i)=>r.dias&&r.dias[i]!=null?_eN(r.dias[i]):'—'),_eN(r.distributivo),r.numDias||'—']),
      styles:{fontSize:7,cellPadding:2,textColor:navy},
      headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',fontSize:6.5},
      alternateRowStyles:{fillColor:[248,249,252]},
      margin:{left:14,right:14}});

  } else if(view==='lastmile'){
    const lm=d.lastmile||{};
    const pivotAll=(lm.pivot||[]).filter(r=>r.transportista&&!/^total/i.test(r.transportista));
    // Exclude fallback cols (B1..B15) AND any pre-computed total column
    const vk=pivotAll.length?Object.keys(pivotAll[0]).filter(k=>k!=='transportista'&&!/^B\d+$/.test(k)&&!/total/i.test(k)):[];
    // Solo transportistas con al menos 1 error
    const pivot=pivotAll.filter(r=>vk.reduce((a,k)=>a+(Number(r[k])||0),0)>0);
    const totErr=pivot.reduce((a,r)=>a+vk.reduce((b,k)=>b+(Number(r[k])||0),0),0);
    const res=lm.resumen||[];
    kpiRow([
      {label:'Transportistas c/ errores',val:pivot.length,bg:[254,226,226],vc:red,lc:red},
      {label:'Total errores',val:_eN(totErr),bg:[255,241,227],vc:orange,lc:orange},
      {label:'Dias registrados',val:res.length,bg:[235,244,253],vc:[2,119,189],lc:[2,119,189]},
      {label:'Actualizado',val:upd,bg:lightbg,vc:gray,lc:gray},
    ]);
    if(pivot.length){
      doc.autoTable({startY:y,
        head:[['Transportista',...vk,'Total']],
        body:pivot.map(r=>[r.transportista,...vk.map(k=>Number(r[k])>0?_eN(r[k]):'—'),_eN(vk.reduce((a,k)=>a+(Number(r[k])||0),0))]),
        styles:{fontSize:7.5,cellPadding:2.5,textColor:navy},
        headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',fontSize:7},
        alternateRowStyles:{fillColor:[248,249,252]},
        didParseCell:function(data){
          if(data.section!=='body')return;
          const ci=data.column.index;
          if(ci>0){const v=Number(data.cell.raw);if(v>0){data.cell.styles.textColor=red;data.cell.styles.fontStyle='bold';}}
        },
        margin:{left:14,right:14}});
      y=doc.lastAutoTable.finalY+8;
    }
    if(res.length){
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...navy);
      doc.text('RESUMEN DIARIO (META VS VALIDACION)',14,y);y+=4;
      doc.autoTable({startY:y,
        head:[['Dia','Meta (Transportistas)','Validacion']],
        body:res.map(r=>[r.etiqueta||'—',_eN(r.cuentaTrans),_eN(r.cuentaVal)]),
        styles:{fontSize:8,cellPadding:2.5,textColor:navy},
        headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',fontSize:7.5},
        alternateRowStyles:{fillColor:[248,249,252]},
        margin:{left:14,right:14}});
    }

  } else if(view==='graficas'){
    const sc=typeof SCHOOLS!=='undefined'?SCHOOLS:[];
    if(!sc.length){
      doc.setFont('helvetica','normal');doc.setFontSize(11);doc.setTextColor(...gray);
      doc.text('Sin datos de instituciones educativas cargados.',14,y);
    } else {
      const tot=sc.length;
      const racTot=sc.reduce((a,s)=>a+(s.raciones||0),0);
      const nE=sc.filter(s=>s.estado==='entregada').length;
      const nR=sc.filter(s=>s.estado==='en_ruta').length;
      const nPr=sc.filter(s=>s.estado==='problema').length;
      const racEnt=sc.filter(s=>s.estado==='entregada').reduce((a,s)=>a+(s.raciones||0),0);
      const racRuta=sc.filter(s=>s.estado==='en_ruta').reduce((a,s)=>a+(s.raciones||0),0);
      const tonEnt=(sc.filter(s=>s.estado==='entregada').reduce((a,s)=>a+(s.peso_kg||0),0)/1000).toFixed(1);
      const pctEnt=racTot>0?Math.round(racEnt/racTot*100):0;
      kpiRow([
        {label:'Total raciones',val:racTot.toLocaleString('es-EC'),bg:navy,vc:[255,255,255],lc:[180,200,230]},
        {label:'Entregadas',val:racEnt.toLocaleString('es-EC'),bg:[230,246,236],vc:green,lc:green},
        {label:'En ruta',val:racRuta.toLocaleString('es-EC'),bg:[255,241,227],vc:orange,lc:orange},
        {label:'Toneladas entregadas',val:tonEnt+' TON',bg:[235,244,253],vc:[2,119,189],lc:[2,119,189]},
      ]);
      doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...gray);
      doc.text('PROGRESO ACUMULADO DEL PROGRAMA',14,y);y+=4;
      progBar(pctEnt,green);
      const provs=[...new Set(sc.map(s=>s.prov).filter(Boolean))].sort();
      doc.autoTable({startY:y,
        head:[['Provincia','IE Entregadas','% Avance','Raciones Ent.','En Ruta','Pendientes']],
        body:provs.map(p=>{
          const ptot=sc.filter(s=>s.prov===p).length;
          const pent=sc.filter(s=>s.prov===p&&s.estado==='entregada').length;
          const pruta=sc.filter(s=>s.prov===p&&s.estado==='en_ruta').length;
          const ppct=ptot>0?Math.round(pent/ptot*100):0;
          const racTP=sc.filter(s=>s.prov===p).reduce((a,s)=>a+(s.raciones||0),0);
          const racEP=sc.filter(s=>s.prov===p&&s.estado==='entregada').reduce((a,s)=>a+(s.raciones||0),0);
          return[p.charAt(0)+p.slice(1).toLowerCase(),pent+' / '+ptot+' IE',ppct+'%',
            racEP.toLocaleString('es-EC')+' / '+racTP.toLocaleString('es-EC'),
            pruta+' IE',(ptot-pent-pruta)+' IE'];
        }),
        styles:{fontSize:8,cellPadding:2.5,textColor:navy},
        headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',fontSize:7.5},
        alternateRowStyles:{fillColor:[248,249,252]},
        columnStyles:{2:{fontStyle:'bold',textColor:green}},
        margin:{left:14,right:14}});
      y=doc.lastAutoTable.finalY+8;
      doc.autoTable({startY:y,
        head:[['Indicador','Valor']],
        body:[['Total IE programa',tot+' IE'],['IE entregadas',nE+' IE'],['IE en ruta',nR+' IE'],
          ['IE con problema',nPr+' IE'],['IE pendientes',(tot-nE-nR-nPr)+' IE'],
          ['Toneladas entregadas',tonEnt+' TON'],['% avance raciones',pctEnt+'%']],
        styles:{fontSize:9,cellPadding:3,textColor:navy},
        headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',fontSize:8},
        alternateRowStyles:{fillColor:[248,249,252]},
        margin:{left:14,right:14}});
    }

  } else if(view==='invSemanal'){
    const inv=(d.inventario||[]).filter(r=>!(_bdgFilter['invSemanal']||[]).includes(r.producto));
    const pos=inv.filter(r=>Number(r.ajuste||0)>0).length;
    const neg=inv.filter(r=>Number(r.ajuste||0)<0).length;
    kpiRow([
      {label:'Ajustes positivos',val:pos,bg:[230,246,236],vc:green,lc:green},
      {label:'Ajustes negativos',val:neg,bg:[254,226,226],vc:red,lc:red},
      {label:'Total productos',val:inv.length,bg:lightbg,vc:gray,lc:gray},
      {label:'Actualizado',val:upd,bg:lightbg,vc:gray,lc:gray},
    ]);
    // Ordenar por campo "orden" del Excel
    const invSorted=inv.slice().sort((a,b)=>(a.orden??9999)-(b.orden??9999));
    const hasCajas=invSorted.some(r=>r.cajas!=null);
    const mxInv=Math.max(...invSorted.map(r=>Math.abs(Number(r.ajuste||0))),1);
    if(invSorted.length){
      // Columnas: Producto | Barra (visual) | Unidades | Cajas
      const head=hasCajas?['Producto','','Unidades','Cajas']:['Producto','','Unidades'];
      const body=invSorted.map(r=>{
        const row=[r.producto||'—','',_eN(r.ajuste)];
        if(hasCajas)row.push(r.cajas!=null?_eN(r.cajas,1):'—');
        return row;
      });
      const C_POS=[61,142,185], C_NEG=[244,124,32];
      const C_POS_BG=[235,246,253], C_NEG_BG=[255,243,232];
      const C_POS_TXT=[21,100,160], C_NEG_TXT=[160,70,10];
      doc.autoTable({startY:y,
        head:[head],
        body,
        styles:{fontSize:8,cellPadding:{top:3,bottom:3,left:5,right:5},textColor:navy},
        headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',fontSize:7.5},
        columnStyles:hasCajas?
          {0:{cellWidth:62},1:{cellWidth:80},2:{cellWidth:22,halign:'right'},3:{cellWidth:18,halign:'right'}}:
          {0:{cellWidth:62},1:{cellWidth:98},2:{cellWidth:22,halign:'right'}},
        didParseCell:function(data){
          if(data.section!=='body')return;
          const r=invSorted[data.row.index];if(!r)return;
          const v=Number(r.ajuste||0),isNeg=v<0;
          const bg=isNeg?C_NEG_BG:C_POS_BG;
          const fg=isNeg?C_NEG_TXT:C_POS_TXT;
          // Fondo de toda la fila
          data.cell.styles.fillColor=bg;
          // Columna barra: sin texto, sin padding lateral
          if(data.column.index===1){
            data.cell.styles.cellPadding={top:4,bottom:4,left:3,right:3};
          }
          // Columna Unidades
          if(data.column.index===2){
            data.cell.styles.textColor=fg;
            data.cell.styles.fontStyle='bold';
            data.cell.styles.fontSize=8.5;
          }
          // Columna Cajas
          if(hasCajas&&data.column.index===3){
            data.cell.styles.textColor=isNeg?[185,80,80]:[50,130,90];
            data.cell.styles.fontStyle='bold';
          }
        },
        didDrawCell:function(data){
          if(data.section!=='body'||data.column.index!==1)return;
          const r=invSorted[data.row.index];if(!r)return;
          const v=Number(r.ajuste||0),isNeg=v<0;
          const barPct=Math.max(0.02,Math.abs(v)/mxInv);
          const cellW=data.cell.width-6, cellH=data.cell.height-6;
          const trackH=6, trackY=data.cell.y+data.cell.height/2-trackH/2;
          const trackX=data.cell.x+3, trackW=cellW;
          // Track background
          doc.setFillColor(...(isNeg?[254,226,200]:[210,235,248]));
          doc.roundedRect(trackX,trackY,trackW,trackH,2,2,'F');
          // Bar fill
          const barW=Math.max(4,Math.round(barPct*trackW));
          doc.setFillColor(...(isNeg?C_NEG:C_POS));
          doc.roundedRect(trackX,trackY,barW,trackH,2,2,'F');
        },
        margin:{left:14,right:14}});
      y=doc.lastAutoTable.finalY+8;
    }
    const sem=d.inventarioSemanal||[];
    if(sem.length){
      const keys=Object.keys(sem[0]||{}).filter(k=>k!=='dia'&&k!=='__rowNum');
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...navy);
      doc.text('INVENTARIO SEMANAL',14,y);y+=4;
      doc.autoTable({startY:y,
        head:[['Dia',...keys]],
        body:sem.map(r=>[r.dia||'—',...keys.map(k=>r[k]!=null?String(r[k]):'—')]),
        styles:{fontSize:8,cellPadding:2.5,textColor:navy},
        headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',fontSize:7.5},
        alternateRowStyles:{fillColor:[248,249,252]},
        margin:{left:14,right:14}});
    }
  }

  // Footer
  const pageH=doc.internal.pageSize.getHeight();
  doc.setDrawColor(220,224,233);doc.line(14,pageH-10,W-14,pageH-10);
  doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...gray);
  doc.text('Reporte generado automaticamente · Bodega Dashboard · '+today,14,pageH-5);

  const fname='Bodega_'+_bdgVLabel(view).replace(/\s/g,'_')+'_'+today.replace(/\//g,'-')+'.pdf';
  doc.save(fname);
}

/* ══ PLAIN TEXT EMAIL ══ */
function _buildBodegaEmailSubject(view){
  const today=new Date().toLocaleDateString('es-EC');
  return 'Reporte Bodega — '+_bdgVLabel(view)+' — '+today;
}

function _buildBodegaEmailBody(view){
  const d=_bodegaData;
  const upd=d.updatedAt||'—';
  const sep='─'.repeat(48);
  let body='REPORTE DE BODEGA — '+_bdgVLabel(view).toUpperCase()+'\n'+
    'Actualizado: '+upd+'\n'+sep+'\n\n';

  if(view==='cobertura'){
    const rows=(d.cobertura||[]).filter(r=>!(_bdgFilter['cobertura']||[]).includes(r.producto));
    const totIng=rows.reduce((a,r)=>a+(r.ingresos||0),0);
    const totReq=rows.reduce((a,r)=>a+(r.totalReq||0),0);
    const _rg5=totReq>0?totIng/totReq:0;
    const glob=(_rg5>=1&&rows.some(r=>(r.pct||0)<1))?0.99:_rg5;
    body+='RESUMEN\n  Total ingresos : '+_eN(totIng)+'\n  Total requerido: '+_eN(totReq)+'\n  Cobertura global: '+(Math.round(glob*100))+'%\n\n';
    body+='COBERTURA POR PRODUCTO\n';
    rows.forEach(r=>{
      const p=Math.round((r.pct||0)*100);
      const bar='█'.repeat(Math.round(p/10))+'░'.repeat(10-Math.round(p/10));
      body+='  '+(r.producto||'—')+'\n    '+bar+' '+p+'%  ('+_eN(r.ingresos)+' / '+_eN(r.totalReq)+')\n';
    });
  } else if(view==='abastecimiento'){
    const rows=(d.abastecimiento||[]).filter(r=>!(_bdgFilter['abastecimiento']||[]).includes(r.producto));
    const ok=rows.filter(r=>(r.pct||0)>=1).length;
    const med=rows.filter(r=>(r.pct||0)>=0.7&&(r.pct||0)<1).length;
    const crit=rows.filter(r=>(r.pct||0)<0.7).length;
    body+='RESUMEN\n  Completos ≥100%: '+ok+'\n  En proceso 70-99%: '+med+'\n  Críticos <70%: '+crit+'\n\n';
    body+='DETALLE POR PRODUCTO\n';
    rows.forEach(r=>{
      const p=Math.round((r.pct||0)*100);
      const bar='█'.repeat(Math.round(p/10))+'░'.repeat(10-Math.round(p/10));
      body+='  '+(r.producto||'—')+'\n    '+bar+' '+p+'%  Ing: '+_eN(r.ingresos)+'  Req: '+_eN(r.totalReq)+'\n';
    });
  } else if(view==='proveedores'){
    const rows=(d.proveedores||[]).filter(r=>!(_bdgFilter['proveedores']||[]).includes(r.producto));
    const totP=rows.reduce((a,r)=>a+(r.planificado||0),0);
    const totI=rows.reduce((a,r)=>a+(r.ingresos||0),0);
    const _rg6=totP>0?totI/totP:0;
    const glob=(_rg6>=1&&rows.some(r=>(r.pct||0)<1))?0.99:_rg6;
    body+='RESUMEN\n  Total planificado: '+_eN(totP)+'\n  Total ingresos: '+_eN(totI)+'\n  Cumplimiento global: '+(Math.round(glob*100))+'%\n\n';
    body+='CUMPLIMIENTO POR PROVEEDOR\n';
    rows.forEach(r=>{
      const p=Math.round((r.pct||0)*100);
      const bar='█'.repeat(Math.round(p/10))+'░'.repeat(10-Math.round(p/10));
      body+='  '+(r.producto||'—')+'\n    '+bar+' '+p+'%  Plan: '+_eN(r.planificado)+'  Ing: '+_eN(r.ingresos)+'\n';
    });
  } else if(view==='lotesFinales'){
    const rows=(d.lotesFinales||[]).filter(r=>!(_bdgFilter['lotesFinales']||[]).includes(r.producto));
    body+='LOTES FINALES\n';
    rows.forEach(r=>{
      const p=Math.round((r.pct||0)*100);
      const bar='█'.repeat(Math.round(p/10))+'░'.repeat(10-Math.round(p/10));
      body+='  '+(r.producto||'—')+'\n    '+bar+' '+p+'%  Lote: '+(r.lotes&&r.lotes!=='-'?r.lotes:'—')+'\n';
    });
  } else if(view==='reqDiario'){
    const rows=(d.requerimientoDiario||[]).filter(r=>!(_bdgFilter['reqDiario']||[]).includes(r.producto));
    body+='REQUERIMIENTO DIARIO\n';
    rows.forEach(r=>{
      body+='  '+(r.producto||'—')+'\n    Distributivo: '+_eN(r.distributivo)+'  ('+r.numDias+' días)\n';
    });
  } else if(view==='lastmile'){
    const lm=d.lastmile||{};
    const pivot=(lm.pivot||[]).filter(r=>r.transportista&&!/^total/i.test(r.transportista));
    body+='ERRORES POR TRANSPORTISTA\n';
    const vk=pivot.length?Object.keys(pivot[0]).filter(k=>k!=='transportista'&&!/^B\d+$/.test(k)):[];
    pivot.forEach(r=>{
      const tot=vk.reduce((a,k)=>a+(Number(r[k])||0),0);
      body+='  '+(r.transportista||'—')+'\n    Total errores: '+tot+'\n';
    });
  } else if(view==='invSemanal'){
    const inv=(d.inventario||[]).filter(r=>!(_bdgFilter['invSemanal']||[]).includes(r.producto));
    body+='AJUSTE DE INVENTARIO\n';
    inv.forEach(r=>{
      body+='  '+(r.producto||'—')+'\n    Ajuste: '+_eN(r.ajuste)+'\n';
    });
  }
  body+='\n'+sep+'\nReporte generado automáticamente · Bodega Dashboard';
  return body;
}

/* ══ HTML EMAIL ══ */
function _buildBodegaHtmlEmail(view){
  const d=_bodegaData;
  const upd=d.updatedAt||'—';
  const today=new Date().toLocaleDateString('es-EC',{day:'numeric',month:'long',year:'numeric'});
  let contentHtml='';

  if(view==='cobertura'){
    const rows=(d.cobertura||[]).filter(r=>!(_bdgFilter['cobertura']||[]).includes(r.producto));
    const totIng=rows.reduce((a,r)=>a+(r.ingresos||0),0);
    const totReq=rows.reduce((a,r)=>a+(r.totalReq||0),0);
    const _rg7=totReq>0?totIng/totReq:0;
    const glob=(_rg7>=1&&rows.some(r=>(r.pct||0)<1))?0.99:_rg7;
    const pctG=Math.round(glob*100);
    const cg=_eC(glob);
    const ok=rows.filter(r=>(r.pct||0)>=1).length;
    const crit=rows.filter(r=>(r.pct||0)<0.7).length;
    contentHtml=`<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px"><tr>
      <td style="width:25%;padding:4px"><div style="background:#EBF4FD;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#0277BD">Total ingresos</div><div style="font-size:20px;font-weight:800;color:#0277BD">${_eN(totIng)}</div><div style="font-size:10px;color:#0277BD">${ok} completos</div></div></td>
      <td style="width:25%;padding:4px"><div style="background:#14213D;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.6)">Total requerido</div><div style="font-size:20px;font-weight:800;color:#fff">${_eN(totReq)}</div><div style="font-size:10px;color:rgba(255,255,255,.5)">${rows.length} productos</div></div></td>
      <td style="width:25%;padding:4px"><div style="background:${cg.bg};border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:${cg.fg}">Cobertura global</div><div style="font-size:20px;font-weight:800;color:${cg.fg}">${pctG}%</div><div style="font-size:10px;color:${cg.fg}">${crit} críticos</div></div></td>
      <td style="width:25%;padding:4px"><div style="background:#EEF1F7;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#5C6478">Productos</div><div style="font-size:20px;font-weight:800;color:#5C6478">${rows.length}</div><div style="font-size:10px;color:#5C6478">${ok}✅ ${crit}❌</div></div></td>
    </tr></table>
    <div style="background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #DDE3EE;margin-bottom:16px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#5C6478;margin-bottom:8px">Cobertura por producto</div>
      <table width="100%" cellspacing="0" cellpadding="0">${rows.map(r=>{
        const c=_eC(r.pct),p=Math.round((r.pct||0)*100);
        return`<tr><td style="padding:5px 0;width:38%;font-size:12px;font-weight:600;color:#14213D;vertical-align:middle;overflow:hidden">${r.producto||'—'}</td>
          <td style="padding:5px 8px;vertical-align:middle"><div style="background:#EEF1F7;border-radius:999px;height:10px;overflow:hidden"><div style="height:100%;width:${Math.min(100,p)}%;background:${c.bar};border-radius:999px"></div></div></td>
          <td style="padding:5px 0 5px 8px;white-space:nowrap;font-size:12px;font-weight:700;color:${c.bar};width:50px;text-align:right">${p}%</td>
          <td style="padding:5px 0 5px 12px;white-space:nowrap;font-size:11px;color:#9AA4B8;width:120px;text-align:right">${_eN(r.ingresos)} / ${_eN(r.totalReq)}</td></tr>`;
      }).join('')}</table>
    </div>`;
  } else if(view==='abastecimiento'){
    const rows=(d.abastecimiento||[]).filter(r=>!(_bdgFilter['abastecimiento']||[]).includes(r.producto));
    const ok=rows.filter(r=>(r.pct||0)>=1).length;
    const med=rows.filter(r=>(r.pct||0)>=0.7&&(r.pct||0)<1).length;
    const crit=rows.filter(r=>(r.pct||0)<0.7).length;
    contentHtml=`<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px"><tr>
      <td style="width:25%;padding:4px"><div style="background:#E6F6EC;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#2D7A47">Completos ≥100%</div><div style="font-size:24px;font-weight:800;color:#1F9D55">${ok}</div></div></td>
      <td style="width:25%;padding:4px"><div style="background:#FFF1E3;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#A8510D">En proceso 70–99%</div><div style="font-size:24px;font-weight:800;color:#F47C20">${med}</div></div></td>
      <td style="width:25%;padding:4px"><div style="background:#FEE2E2;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#991B1B">Críticos &lt;70%</div><div style="font-size:24px;font-weight:800;color:#DC2626">${crit}</div></div></td>
      <td style="width:25%;padding:4px"><div style="background:#EEF1F7;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#5C6478">Total</div><div style="font-size:24px;font-weight:800;color:#5C6478">${rows.length}</div></div></td>
    </tr></table>
    <div style="background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #DDE3EE">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#5C6478;margin-bottom:8px">Abastecimiento por producto</div>
      <table width="100%" cellspacing="0" cellpadding="0">${rows.map(r=>{
        const c=_eC(r.pct),p=Math.round((r.pct||0)*100);
        return`<tr><td style="padding:5px 0;width:40%;font-size:12px;font-weight:600;color:#14213D;vertical-align:middle">${r.producto||'—'}</td>
          <td style="padding:5px 8px;vertical-align:middle"><div style="background:#EEF1F7;border-radius:999px;height:10px;overflow:hidden"><div style="height:100%;width:${Math.min(100,p)}%;background:${c.bar};border-radius:999px"></div></div></td>
          <td style="padding:5px 0 5px 8px;white-space:nowrap;font-size:12px;font-weight:700;color:${c.bar};width:50px">${p}%</td></tr>`;
      }).join('')}</table>
    </div>`;
  } else if(view==='proveedores'){
    const rows=(d.proveedores||[]).filter(r=>!(_bdgFilter['proveedores']||[]).includes(r.producto));
    const totP=rows.reduce((a,r)=>a+(r.planificado||0),0);
    const totI=rows.reduce((a,r)=>a+(r.ingresos||0),0);
    const _rg8=totP>0?totI/totP:0;
    const glob=(_rg8>=1&&rows.some(r=>(r.pct||0)<1))?0.99:_rg8;
    const pctG=Math.round(glob*100);
    const cg=_eC(glob);
    contentHtml=`<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px"><tr>
      <td style="width:25%;padding:4px"><div style="background:#14213D;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.6)">Total planificado</div><div style="font-size:18px;font-weight:800;color:#fff">${_eN(totP)}</div></div></td>
      <td style="width:25%;padding:4px"><div style="background:#E6F6EC;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#2D7A47">Total ingresos</div><div style="font-size:18px;font-weight:800;color:#1F9D55">${_eN(totI)}</div></div></td>
      <td style="width:25%;padding:4px"><div style="background:${cg.bg};border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:${cg.fg}">Cumplimiento</div><div style="font-size:18px;font-weight:800;color:${cg.fg}">${pctG}%</div></div></td>
      <td style="width:25%;padding:4px"><div style="background:#EEF1F7;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#5C6478">Proveedores</div><div style="font-size:18px;font-weight:800;color:#5C6478">${rows.length}</div></div></td>
    </tr></table>
    <div style="background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #DDE3EE">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#5C6478;margin-bottom:8px">Cumplimiento por proveedor</div>
      <table width="100%" cellspacing="0" cellpadding="0">${rows.map(r=>{
        const c=_eC(r.pct),p=Math.round((r.pct||0)*100);
        return`<tr><td style="padding:5px 0;width:40%;font-size:12px;font-weight:600;color:#14213D;vertical-align:middle">${r.producto||'—'}</td>
          <td style="padding:5px 8px;vertical-align:middle"><div style="background:#EEF1F7;border-radius:999px;height:10px;overflow:hidden"><div style="height:100%;width:${Math.min(100,p)}%;background:${c.bar};border-radius:999px"></div></div></td>
          <td style="padding:5px 0 5px 8px;white-space:nowrap;font-size:12px;font-weight:700;color:${c.bar};width:50px">${p}%</td>
          <td style="padding:5px 0 5px 8px;font-size:11px;color:#9AA4B8;white-space:nowrap">${_eN(r.ingresos)} / ${_eN(r.planificado)}</td></tr>`;
      }).join('')}</table>
    </div>`;
  } else if(view==='lotesFinales'){
    const rows=(d.lotesFinales||[]).filter(r=>!(_bdgFilter['lotesFinales']||[]).includes(r.producto));
    const ok=rows.filter(r=>(r.pct||0)>=1).length;
    const crit=rows.filter(r=>(r.pct||0)<0.7).length;
    contentHtml=`<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px"><tr>
      <td style="width:33%;padding:4px"><div style="background:#E6F6EC;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#2D7A47">Completados ≥100%</div><div style="font-size:28px;font-weight:800;color:#1F9D55">${ok}</div></div></td>
      <td style="width:33%;padding:4px"><div style="background:#FEE2E2;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#991B1B">Críticos &lt;70%</div><div style="font-size:28px;font-weight:800;color:#DC2626">${crit}</div></div></td>
      <td style="width:33%;padding:4px"><div style="background:#EEF1F7;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#5C6478">Total</div><div style="font-size:28px;font-weight:800;color:#5C6478">${rows.length}</div></div></td>
    </tr></table>
    <div style="background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #DDE3EE">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#5C6478;margin-bottom:8px">Lotes finales por producto</div>
      <table width="100%" cellspacing="0" cellpadding="0">${rows.map(r=>{
        const c=_eC(r.pct),p=Math.round((r.pct||0)*100);
        const lote=r.lotes&&r.lotes!=='-'&&r.lotes!=='—'?r.lotes:'—';
        return`<tr><td style="padding:5px 0;width:35%;font-size:12px;font-weight:600;color:#14213D;vertical-align:top">${r.producto||'—'}</td>
          <td style="padding:5px 8px;vertical-align:middle;width:30%"><div style="background:#EEF1F7;border-radius:999px;height:10px;overflow:hidden"><div style="height:100%;width:${Math.min(100,p)}%;background:${c.bar};border-radius:999px"></div></div></td>
          <td style="padding:5px 0 5px 8px;font-weight:700;color:${c.bar};font-size:12px;white-space:nowrap;width:40px">${p}%</td>
          <td style="padding:5px 0 5px 8px;font-size:10px;color:#9AA4B8">${lote}</td></tr>`;
      }).join('')}</table>
    </div>`;
  } else if(view==='reqDiario'){
    const rows=(d.requerimientoDiario||[]).filter(r=>!(_bdgFilter['reqDiario']||[]).includes(r.producto));
    const totDist=rows.reduce((a,r)=>a+(r.distributivo||0),0);
    contentHtml=`<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px"><tr>
      <td style="width:33%;padding:4px"><div style="background:#14213D;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.6)">Total productos</div><div style="font-size:28px;font-weight:800;color:#fff">${rows.length}</div></div></td>
      <td style="width:33%;padding:4px"><div style="background:#FFF1E3;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#A8510D">Total distributivo</div><div style="font-size:24px;font-weight:800;color:#F47C20">${_eN(totDist)}</div></div></td>
      <td style="width:33%;padding:4px"><div style="background:#EBF4FD;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#0277BD">Actualizado</div><div style="font-size:14px;font-weight:800;color:#0277BD">${d.updatedAt||'—'}</div></div></td>
    </tr></table>
    <div style="background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #DDE3EE">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#5C6478;margin-bottom:8px">Requerimiento por producto</div>
      <table width="100%" cellspacing="0" cellpadding="0"><tr style="background:#F4F6FB"><td style="padding:6px 8px;font-size:10px;font-weight:700;color:#5C6478;text-transform:uppercase">Producto</td><td style="padding:6px 8px;font-size:10px;font-weight:700;color:#5C6478;text-align:right">Distributivo</td><td style="padding:6px 8px;font-size:10px;font-weight:700;color:#5C6478;text-align:right">Días</td></tr>
      ${rows.map((r,i)=>`<tr style="background:${i%2?'#F9FAFB':'#fff'}"><td style="padding:6px 8px;font-size:12px;color:#14213D;font-weight:600">${r.producto||'—'}</td><td style="padding:6px 8px;font-size:12px;font-weight:800;color:#F47C20;text-align:right">${_eN(r.distributivo)}</td><td style="padding:6px 8px;font-size:12px;color:#5C6478;text-align:right">${r.numDias||'—'}</td></tr>`).join('')}
      </table>
    </div>`;
  } else if(view==='lastmile'){
    const lm=d.lastmile||{};
    const pivot=(lm.pivot||[]).filter(r=>r.transportista&&!/^total/i.test(r.transportista));
    const vk=pivot.length?Object.keys(pivot[0]).filter(k=>k!=='transportista'&&!/^B\d+$/.test(k)):[];
    const res=lm.resumen||[];
    const totErr=pivot.reduce((a,r)=>a+vk.reduce((b,k)=>b+(Number(r[k])||0),0),0);
    contentHtml=`<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px"><tr>
      <td style="width:33%;padding:4px"><div style="background:#FEE2E2;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#991B1B">Transportistas</div><div style="font-size:28px;font-weight:800;color:#DC2626">${pivot.length}</div><div style="font-size:10px;color:#991B1B">Con errores</div></div></td>
      <td style="width:33%;padding:4px"><div style="background:#FFF1E3;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#A8510D">Total errores</div><div style="font-size:28px;font-weight:800;color:#F47C20">${_eN(totErr)}</div></div></td>
      <td style="width:33%;padding:4px"><div style="background:#EBF4FD;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#0277BD">Días registrados</div><div style="font-size:28px;font-weight:800;color:#0277BD">${res.length}</div></div></td>
    </tr></table>
    ${pivot.length?`<div style="background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #DDE3EE;margin-bottom:16px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#5C6478;margin-bottom:8px">Errores por transportista</div>
      <table width="100%" cellspacing="0" cellpadding="0">
        <tr style="background:#F4F6FB"><td style="padding:6px 8px;font-size:10px;font-weight:700;color:#5C6478">Transportista</td>${vk.map(k=>`<td style="padding:6px 8px;font-size:10px;font-weight:700;color:#5C6478;text-align:right">${k}</td>`).join('')}</tr>
        ${pivot.map((r,i)=>`<tr style="background:${i%2?'#F9FAFB':'#fff'}"><td style="padding:6px 8px;font-size:12px;font-weight:600;color:#14213D">${r.transportista}</td>${vk.map(k=>`<td style="padding:6px 8px;font-size:12px;font-weight:700;color:${Number(r[k])>0?'#EF4444':'#9AA4B8'};text-align:right">${Number(r[k])>0?_eN(r[k]):'—'}</td>`).join('')}</tr>`).join('')}
      </table>
    </div>`:''}`;
  } else if(view==='invSemanal'){
    const inv=(d.inventario||[]).filter(r=>!(_bdgFilter['invSemanal']||[]).includes(r.producto));
    const pos=inv.filter(r=>Number(r.ajuste||0)>0).length;
    const neg=inv.filter(r=>Number(r.ajuste||0)<0).length;
    const mx=Math.max(...inv.map(r=>Math.abs(Number(r.ajuste||0))),1);
    contentHtml=`<table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px"><tr>
      <td style="width:33%;padding:4px"><div style="background:#E6F6EC;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#2D7A47">Ajustes positivos</div><div style="font-size:28px;font-weight:800;color:#1F9D55">${pos}</div></div></td>
      <td style="width:33%;padding:4px"><div style="background:#FEE2E2;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#991B1B">Ajustes negativos</div><div style="font-size:28px;font-weight:800;color:#DC2626">${neg}</div></div></td>
      <td style="width:33%;padding:4px"><div style="background:#EEF1F7;border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#5C6478">Total productos</div><div style="font-size:28px;font-weight:800;color:#5C6478">${inv.length}</div></div></td>
    </tr></table>
    <div style="background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #DDE3EE">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#5C6478;margin-bottom:8px">Ajuste por producto</div>
      ${inv.map(r=>{
        const v=Number(r.ajuste||0),isNeg=v<0;
        const col=isNeg?'#F47C20':'#3D8EB9';
        const pct=Math.round(Math.abs(v)/mx*100);
        return`<div style="display:flex;align-items:center;gap:10px;padding:4px 0">
          <div style="width:38%;font-size:12px;font-weight:600;color:#14213D;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.producto||'—'}</div>
          <div style="flex:1;background:${isNeg?'rgba(244,124,32,.1)':'rgba(61,142,185,.1)'};border-radius:5px;height:16px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${col};border-radius:5px"></div>
          </div>
          <div style="width:60px;text-align:right;font-size:12px;font-weight:800;color:${col};white-space:nowrap">${_eN(v)}</div>
        </div>`;
      }).join('')}
    </div>`;
  } else {
    contentHtml=`<div style="text-align:center;padding:24px;color:#9AA4B8">Vista ${_bdgVLabel(view)} — sin contenido exportable</div>`;
  }

  return`<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:0 auto;background:#F4F6FB;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#0A3060 0%,#1565C0 100%);padding:20px 24px">
    <div style="color:#fff;font-size:16px;font-weight:800">Reporte Bodega — ${_bdgVLabel(view)}</div>
    <div style="color:rgba(255,255,255,.55);font-size:12px;margin-top:3px">${today} &nbsp;·&nbsp; Actualizado: ${upd}</div>
  </div>
  <div style="padding:20px 24px">${contentHtml}
    <div style="text-align:center;margin-top:16px;font-size:10px;color:#9AA4B8">Reporte generado automáticamente · Bodega Dashboard</div>
  </div>
</div>`;
}