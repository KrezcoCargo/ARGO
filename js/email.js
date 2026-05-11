function openEmailModal(){
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
  const html=buildHtmlEmail();
  try{
    await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([buildEmailBody()],{type:'text/plain'})})]);
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
  const d=ST.dia;
  const fecha=d2i(d);
  const [y,m,dd]=fecha.split('-');
  const subject=encodeURIComponent('Resumen Día '+d+' - '+CFG.programa+' - '+dd+'/'+m+'/'+y);
  const body=encodeURIComponent(buildEmailBody());
  window.location.href='mailto:'+encodeURIComponent(recipients)+'?subject='+subject+'&body='+body;
}