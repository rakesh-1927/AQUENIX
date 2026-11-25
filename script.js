/* AQUENIX runs from local files. Measurements live only in this browser. */
'use strict';
const DATA_KEY = 'aquenix.fieldbook.v1';
const LANG_KEY = 'aquenix.language.v1';
const pages = {
  overview: ['Overview', 'dashboard'], scarcity: ['Water Scarcity', 'warning'],
  monitoring: ['Groundwater Monitoring', 'waves'], intelligence: ['Smart Groundwater Intelligence', 'scan'],
  conservation: ['Water Conservation', 'leaf'], admin: ['Admin Panel', 'sliders']
};
const sitesSeed = [
  ['gad','Gadchiroli','Maharashtra',20.1809,80.0030,[12,13,14,16,18,15],[14,8,19,12,23,182],[12,10,15,16,26,180]],
  ['nag','Nagpur','Maharashtra',21.1458,79.0882,[17,18,19.5,21,23,22],[11,7,10,8,18,110],[14,12,16,17,24,160]],
  ['hyd','Hyderabad','Telangana',17.3850,78.4867,[14,15.5,17,18,20,18],[7,5,12,16,24,86],[8,9,13,20,32,110]],
  ['pun','Pune','Maharashtra',18.5204,73.8567,[9,10,11,12,13,11],[3,4,6,11,21,136],[4,4,8,15,25,140]]
];
function initialData() {
  const sites = sitesSeed.map(([id,name,state,lat,lng,depths,rain,base]) => ({
    id,name,state,lat,lng,readings:depths.map((depth,i)=>({
      month:`2026-0${i+1}`,depth,rain:rain[i],base:base[i],source:'AQUENIX sample series',
      updated:`2026-0${i+1}-28T12:00:00Z`
    }))
  }));
  return {version:1,sites,bores:[]};
}
const finite = v => typeof v === 'number' && Number.isFinite(v);
const validPoint = (lat,lng) => finite(lat)&&finite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
const validMonth = s => typeof s==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
function validData(d) {
  return d && d.version===1 && Array.isArray(d.sites) && d.sites.length>0 && Array.isArray(d.bores)
    && d.sites.every(s=>typeof s.id==='string'&&typeof s.name==='string'&&typeof s.state==='string'&&validPoint(s.lat,s.lng)
      && Array.isArray(s.readings)&&s.readings.every(r=>validMonth(r.month)&&finite(r.depth)&&r.depth>=0
        && [r.rain,r.base].every(v=>v===null||(finite(v)&&v>=0))&&typeof r.source==='string'&&typeof r.updated==='string'))
    && d.bores.every(b=>typeof b.name==='string'&&validPoint(b.lat,b.lng)&&typeof b.ref==='string'&&typeof b.date==='string');
}
let storeIssue='';
function loadBook() {
  try {
    const raw=localStorage.getItem(DATA_KEY);
    if(!raw) return initialData();
    const book=JSON.parse(raw);
    if(!validData(book)) throw Error('Unknown format');
    return book;
  } catch {storeIssue='Saved records could not be read. This session shows the sample series.';return initialData()}
}
let book=loadBook(), lang='en';
try {lang=localStorage.getItem(LANG_KEY)||'en'} catch {}
if(!['en','hi','mr','te'].includes(lang)) lang='en';
let page='overview',stateFilter='',siteFilter='',monitorId='gad',adminTab='reading',editing=null;
let point=null,report=null,baseMap='atlas',map=null,plot=null,selectedLayer=null,toastTimer=null,heroObserver=null,rangeN=6;
let calc={area:100,rain:800,coef:.8,result:64000};
const $=id=>document.getElementById(id);
const tr=s=>window.AQUENIX_LANG?.[lang]?.[s]||s;
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const t=s=>esc(tr(s));
const locales={en:'en-IN',hi:'hi-IN',mr:'mr-IN',te:'te-IN'};
const num=(x,d=0)=>Number(x).toLocaleString(locales[lang],{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtMonth=(s,short=false)=>s?new Intl.DateTimeFormat(locales[lang],{month:short?'short':'short',...(short?{}:{year:'numeric'}),timeZone:'UTC'}).format(new Date(s+'-15T12:00:00Z')):'—';
const ordered=s=>[...s.readings].sort((a,b)=>a.month.localeCompare(b.month));
const latest=s=>ordered(s).at(-1);
function offsetMonth(month,offset) {const d=new Date(month+'-15T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+offset);return d.toISOString().slice(0,7)}
function previous(s,r=latest(s)){return r?s.readings.find(a=>a.month===offsetMonth(r.month,-1)):null}
const avg=a=>a.length?a.reduce((p,n)=>p+n,0)/a.length:null;
const siteBy=id=>book.sites.find(s=>s.id===id);
const scoped=()=>book.sites.filter(s=>(!stateFilter||s.state===stateFilter)&&(!siteFilter||s.id===siteFilter));
const allMonths=sites=>[...new Set(sites.flatMap(s=>s.readings.map(r=>r.month)))].sort();
const ratio=r=>r&&r.rain!==null&&r.base>0?r.rain/r.base:null;
const statuses={normal:'Normal',watch:'Watch',high:'High risk',none:'No data'};
function status(s) {
  const r=latest(s), q=ratio(r);
  if(!r) return 'none';
  if(r.depth>=20||(q!==null&&q<.7)) return 'high';
  if(r.depth>=16||(q!==null&&q<.85)) return 'watch';
  return 'normal';
}
function summary(sites) {
  const has=sites.filter(s=>latest(s)), alerts=has.filter(s=>['high','watch'].includes(status(s)));
  const shifts=has.filter(s=>previous(s)).map(s=>latest(s).depth-previous(s).depth);
  const q=has.map(s=>ratio(latest(s))).filter(v=>v!==null);
  return {has,alerts,depth:avg(has.map(s=>latest(s).depth)),change:avg(shifts),rain:avg(q),
    risk:has.length===0?'none':alerts.length===0?'normal':has.every(s=>status(s)==='high')?'high':'watch',
    month:allMonths(sites).at(-1)};
}
function changeText(n){return n===null?'—':`${num(Math.abs(n),1)} m · ${t(Math.abs(n)<.0001?'Unchanged':n>0?'Deeper':'Shallower')}`}
const icons={
  dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  warning:'<path d="M10.3 4.4 2.9 17.6A1.8 1.8 0 0 0 4.5 20h15a1.8 1.8 0 0 0 1.6-2.4L13.7 4.4a1.9 1.9 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3v.2"/>',
  waves:'<path d="M2 7q2.5 2.5 5 0t5 0t5 0t5 0M2 12q2.5 2.5 5 0t5 0t5 0t5 0M2 17q2.5 2.5 5 0t5 0t5 0t5 0"/>',
  scan:'<path d="M3 8V4h4m10 0h4v4m0 8v4h-4M7 20H3v-4"/><circle cx="12" cy="12" r="4"/><path d="M12 5v3m7 4h-3m-4 7v-3m-7-4h3"/>',
  leaf:'<path d="M20 3c-5 4-12 0-15 7-3 9 8 12 13 5 2-3 2-8 2-12Z"/><path d="M3 21c3-5 7-8 12-12"/>',
  sliders:'<path d="M4 7h6m4 0h6M4 17h10m4 0h2"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>',
  drop:'<path d="M12 2s-7 8-7 13a7 7 0 1 0 14 0c0-5-7-13-7-13Z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
  layers:'<path d="m12 3 10 5-10 5L2 8l10-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
  globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>', flag:'<path d="M5 21V4c4-3 8 3 14 0v10c-6 3-10-3-14 0"/>',
  book:'<path d="M3 4h6q3 0 3 3v14q0-3-3-3H3zm18 0h-6q-3 0-3 3v14q0-3 3-3h6z"/>',
  rain:'<path d="M6 14a4 4 0 1 1 .5-8 6 6 0 0 1 11 .9A4 4 0 0 1 18 15M9 16l-1 3m5-3-1 3m5-3-1 3"/>',
  filter:'<path d="M3 6h18M6 12h12m-9 6h6"/>',expand:'<path d="M14 3h7v7m-7 0 7-7M10 21H3v-7m7 0-7 7"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  chart:'<path d="M3 3v18h18M6 15l4-5 4 3 6-8"/>',add:'<path d="M12 5v14M5 12h14"/>',
  speaker:'<path d="m11 5-6 5H2v4h3l6 5Zm4 3q5 4 0 8m3-11q8 7 0 14"/>',
  print:'<path d="M6 9V3h12v6M6 16H3V9h18v7h-3"/><rect x="6" y="14" width="12" height="7"/>',
  check:'<path d="m3 12 6 6L21 5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  house:'<path d="m2 11 10-8 10 8m-17-1v11h14V10m-10 11v-7h6v7"/>',
  tool:'<path d="m3 18 8-8a6 6 0 0 1 8-7l-4 4 2 2 4-4a6 6 0 0 1-8 8l-8 8z"/>',
  people:'<circle cx="9" cy="8" r="3"/><path d="M2 20v-3a7 7 0 0 1 14 0v3m0-15a3 3 0 0 1 0 6m3 3c2 1 3 3 3 6"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',edit:'<path d="m4 16 12-12 4 4L8 20l-5 1zM13 7l4 4"/>'
};
const icon=k=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[k]||icons.drop}</svg>`;
const tile=(i,c='cyan')=>`<span class="tile-icon ${c}">${icon(i)}</span>`;
const badge=code=>`<span class="badge ${code}"><i class="dot"></i>${t(statuses[code])}</span>`;
const btn=(label,action,i='',cls='')=>`<button type="button" class="button ${cls}" data-action="${action}">${i?icon(i):''}${t(label)}</button>`;
const field=(label,input)=>`<label class="field"><span>${t(label)}</span>${input}</label>`;
const options=(pairs,value)=>pairs.map(([v,label])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(label)}</option>`).join('');
const siteOptions=id=>options(book.sites.map(s=>[s.id,s.name]),id);
const panelHead=(title,sub='',extra='')=>`<div class="panel-head"><div><h2>${t(title)}</h2>${sub?`<p class="meta">${sub}</p>`:''}</div>${extra}</div>`;
const pageTitle=(section,title,sub)=>`<div class="page-title"><p class="eyebrow">${t(section)}</p><h1>${t(title)}</h1><p>${t(sub)}</p></div>`;
const coText=(lat,lng)=>`${Math.abs(lat).toFixed(4)}° ${lat<0?'S':'N'}, ${Math.abs(lng).toFixed(4)}° ${lng<0?'W':'E'}`;
function toast(msg){$('toast').textContent=tr(msg);clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').textContent='',4500)}
function setMenu(open){$('sidebar').classList.toggle('open',open);$('scrim').hidden=!open;document.querySelector('.menu')?.setAttribute('aria-expanded',String(open));if(open) document.querySelector('.nav-link.active')?.focus()}
const logo=`<svg class="brandmark" viewBox="0 0 40 42" aria-hidden="true"><rect x="1" y="1" width="38" height="39" rx="11" fill="#09283d"/><path d="m7.5 29 10-19c.8-1.5 2-2 3.7-2h1.3l-4.7 10.5-5.7 10.6z" fill="#83e0ee"/><path d="m21 15.4 2.9-6.1 9 19.7h-5.7z" fill="#39bade"/><path d="M14.8 30.5c3.5-5 7-5.6 11-2.4l1.5 3.1c-4.5-2.9-8-2.1-12.5-.7Z" fill="#dcfbff"/></svg>`;
function shell() {
  document.documentElement.lang=lang;document.title=`AQUENIX · ${tr(pages[page][0])}`;
  const group=(name,keys)=>`<div class="side-group"><div class="side-title">${t(name)}</div>${keys.map(k=>`<a href="#${k}" class="nav-link ${page===k?'active':''}" ${page===k?'aria-current="page"':''}>${icon(pages[k][1])}<span>${t(pages[k][0])}</span></a>`).join('')}</div>`;
  $('sidebar').innerHTML=`<div class="brand">${logo}<div><strong>AQUENIX</strong><small>${t('Water intelligence')}</small></div></div><nav aria-label="${t('Workspace')}">${group('Workspace',['overview','scarcity','monitoring'])}${group('Analysis',['intelligence','conservation'])}${group('Management',['admin'])}</nav><div class="side-bottom"><span class="square">${icon('layers')}</span><div><strong>${t('Demonstration workspace')}</strong>${t('All India')}</div></div>`;
  $('topbar').innerHTML=`<div class="crumb"><button class="icon-btn menu" data-action="menu" aria-label="${t('Workspace')}" aria-expanded="false" aria-controls="sidebar">${icon('menu')}</button><span class="parent">${t('Workspace')}</span><span class="divider">/</span><strong>${t(pages[page][0])}</strong></div><div class="top-actions"><span class="demo-pill"><i class="dot"></i>${t('Demonstration data')}</span><label class="lang">${icon('globe')}<select id="language" aria-label="Interface language">${options([['en','English'],['mr','मराठी'],['hi','हिन्दी'],['te','తెలుగు']],lang)}</select></label></div>`;
}
function hero(){
  return `<div class="hero"><canvas id="contours" aria-hidden="true"></canvas><div class="hero-text"><div class="eyebrow"><i></i>${t('Water intelligence')} &nbsp; / &nbsp; ${t('All India')}</div><h1>${t('Water overview')}</h1><p>${t('Groundwater conditions across your monitoring network.')}</p></div>${btn('Know Before You Drill','goto-intelligence','scan','hero-action')}</div>`;
}
// Stylized water contours are decorative. They carry no geographic measurements.
function drawContours() {
  const canvas=$('contours');if(!canvas)return;
  const paint=()=>{
    const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
    if(!w||!h)return;
    canvas.width=w*dpr;canvas.height=h*dpr;
    const c=canvas.getContext('2d');c.scale(dpr,dpr);
    const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#092338');bg.addColorStop(.55,'#0b3049');bg.addColorStop(1,'#095673');c.fillStyle=bg;c.fillRect(0,0,w,h);
    c.lineWidth=1;
    c.save();c.translate(w*.84,h*.16);c.rotate(-.26);
    for(let j=0;j<52;j++){
      const r=11+j*5.4;c.strokeStyle=`rgba(94,213,225,${(j%5===0?.66:.38)*Math.max(.15,1-j/68)})`;c.beginPath();
      for(let k=0;k<=240;k++){const a=k*Math.PI/120;const wobble=1+.16*Math.sin(3*a+r*.009)+.085*Math.cos(5*a-r*.012)+.05*Math.sin(7*a+.6);
        const x=Math.cos(a)*r*1.64*wobble, y=Math.sin(a)*r*.65*wobble; if(k===0)c.moveTo(x,y);else c.lineTo(x,y)}
      c.closePath();c.stroke();
    }c.restore();
    const shade=c.createLinearGradient(0,0,w,0);shade.addColorStop(0,'#092338');shade.addColorStop(.30,'#092338f8');shade.addColorStop(.62,'#0a294030');shade.addColorStop(1,'#0a294000');c.fillStyle=shade;c.fillRect(0,0,w,h);
    c.fillStyle='#b4f7fd5c';
    for(let x=w*.61;x<w;x+=33)for(let y=14;y<h;y+=27)c.fillRect(x,y,1,1);
  };paint();heroObserver=new ResizeObserver(paint);heroObserver.observe(canvas);
}
function filters() {
  const states=[...new Set(book.sites.map(s=>s.state))].sort();
  const locations=book.sites.filter(s=>!stateFilter||s.state===stateFilter);
  const control=(id,label,ico,choices,val)=>`<label class="scope">${icon(ico)}<select id="${id}" aria-label="${t(label)}">${options(choices,val)}</select></label>`;
  return `<div class="filters"><h2>${t('Latest readings')}</h2><div class="filter-tools">${control('state-filter','State','filter',[['',tr('All states')],...states.map(s=>[s,s])],stateFilter)}${control('site-filter','Location','pin',[['',tr('All locations')],...locations.map(s=>[s.id,s.name])],siteFilter)}</div></div>`;
}
function metrics(sites,stats) {
  const history=allMonths(sites).slice(-8).map(m=>avg(sites.flatMap(s=>s.readings.filter(r=>r.month===m).map(r=>r.depth))));
  const bars=history.length?`<span class="minibars" aria-hidden="true">${history.map(v=>`<i style="height:${5+Math.round(v/Math.max(1,...history)*24)}px"></i>`).join('')}</span>`:'';
  const metric=(title,value,detail,i,c,spark='')=>`<article class="metric ${spark?'has-spark':''}"><div class="metric-top">${tile(i,c)}${t(title)}</div><div class="metric-value">${value}</div><p class="meta">${detail}</p>${spark}</article>`;
  const countStates=new Set(sites.map(s=>s.state)).size;
  return `<div class="metrics">${metric('Monitoring locations',num(sites.length),`${num(countStates)} ${t('states in view')}`,'pin','cyan')}${metric('Average depth',stats.depth===null?'—':`${num(stats.depth,1)} <span class="unit">m</span>`,t('Below ground level'),'waves','teal',bars)}${metric('Scarcity status',t(statuses[stats.risk]),t('Network screening'),'drop','amber')}${metric('Require attention',num(stats.alerts.length),t('Watch or high risk'),'flag','coral')}</div>`;
}
const pinColors={normal:'#168c78',watch:'#c69123',high:'#c35d4b',none:'#8394a0'};
function mapPanel(mode='overview') {
  const heading=mode==='intelligence'?'Select a location':'Monitoring network';
  const extra=mode==='overview'?btn('Open monitoring','goto-monitoring','expand'):`<select id="map-base" class="atlas-control" aria-label="${t('Base map')}">${options([['atlas',tr('Field atlas')],['osm','OpenStreetMap']],baseMap)}</select>`;
  const legend=(s,txt)=>`<span class="leg"><i class="dot" style="color:${s}"></i>${t(txt)}</span>`;
  return `<article class="panel">${panelHead(heading,mode==='intelligence'?t('Choose a site on the map or enter its coordinates.'):t('Sample monitoring locations'),extra)}<div class="map-frame"><div id="map" class="mapbox ${mode!=='overview'?'large':''}" aria-label="${t(heading)}"></div><div id="map-note" class="map-note" role="status" hidden></div></div><div class="map-foot"><div class="legend">${Object.entries(pinColors).filter(([k])=>k!=='none').map(([k,c])=>legend(c,statuses[k])).join('')}${mode==='intelligence'?legend('#23435b','Selected site'):''}${book.bores.length?legend('#715897','Referenced borewell'):''}</div><span class="meta" id="base-caption">${t('Offline field atlas')}</span></div></article>`;
}
const hasReadings=s=>s.readings.length>0;
function chartPanel(sites,large=false) {
  const mm=allMonths(sites), end=mm.at(-1);
  const current=end?avg(sites.flatMap(s=>s.readings.filter(r=>r.month===end).map(r=>r.depth))):null;
  const st=summary(sites);
  const rainText=st.rain===null?'—':t(st.rain<1?'Below baseline':'At or above baseline');
  return `<article class="panel">${panelHead('Groundwater trend',t(large?'Water table depth':'Monthly mean depth'),`<select aria-label="${t('Chart period')}" id="chart-range" class="atlas-control">${options([['6',tr('6 months')],['12',tr('12 months')]],String(rangeN))}</select>`)}<div class="chart-lead"><strong>${current===null?'—':num(current,1)}</strong><span class="muted">m</span><span class="meta">${fmtMonth(end)} · ${num(sites.filter(s=>s.readings.some(r=>r.month===end)).length)} ${t('reporting')}</span></div><div class="chart-wrap ${large?'large':''}"><canvas id="trend" role="img" aria-label="${t('Groundwater trend')}"></canvas></div><div class="chart-foot"><div><span>${t('Depth change')}</span><strong>${changeText(st.change)}</strong></div><div><span>${t('Rainfall status')}</span><strong>${rainText}</strong></div></div></article>`;
}
function drawChart(sites) {
  const canvas=$('trend');if(!canvas)return;
  const end=allMonths(sites).at(-1);
  if(!end||!window.Chart){canvas.parentNode.innerHTML=`<p class="empty">${t(end?'Chart unavailable. See monthly readings.':'No readings yet')}</p>`;return}
  const months=Array.from({length:rangeN},(_,i)=>offsetMonth(end,i-rangeN+1));
  const values=months.map(m=>avg(sites.flatMap(s=>s.readings.filter(r=>r.month===m).map(r=>r.depth))));
  const counts=months.map(m=>sites.filter(s=>s.readings.some(r=>r.month===m)).length);
  const ctx=canvas.getContext('2d');
  const fill=ctx.createLinearGradient(0,0,0,canvas.parentNode.clientHeight);fill.addColorStop(0,'rgba(37,174,199,.33)');fill.addColorStop(1,'rgba(37,174,199,.015)');
  plot=new Chart(ctx,{type:'line',data:{labels:months.map(m=>fmtMonth(m,true)),datasets:[{label:tr('Groundwater depth'),data:values,borderColor:'#1196b8',backgroundColor:fill,borderWidth:2.8,pointRadius:3.5,pointHoverRadius:5,pointBackgroundColor:'#fff',pointBorderWidth:2,pointBorderColor:'#1093b3',tension:.23,fill:true,spanGaps:false}]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,locale:locales[lang],layout:{padding:{top:10,right:8,left:3}},interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>fmtMonth(months[items[0].dataIndex]),label:item=>` ${num(item.parsed.y,1)} m · ${counts[item.dataIndex]} ${tr('reporting')}`}}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:'#617889',font:{size:11},maxRotation:0,maxTicksLimit:7}},y:{beginAtZero:false,grace:'12%',border:{display:false},grid:{color:'#e3ebef'},ticks:{maxTicksLimit:5,color:'#647b89',font:{size:11},callback:v=>`${v} m`}}}}});
}
function siteTable(sites,action=true) {
  const head=['Location','Depth (m)','Month','Scarcity status'];
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${head.map(h=>`<th>${t(h)}</th>`).join('')}</tr></thead><tbody>${sites.map(s=>{const r=latest(s);return `<tr><td>${action?`<button class="button quiet" data-monitor="${esc(s.id)}">${esc(s.name)}</button>`:esc(s.name)}<small>${esc(s.state)}</small></td><td>${r?num(r.depth,1):'—'}</td><td>${fmtMonth(r?.month)}</td><td>${badge(status(s))}</td></tr>`}).join('')}</tbody></table></div>`;
}
function activity(sites,limit=4) {
  const rows=sites.flatMap(s=>s.readings.map(r=>({s,r}))).sort((a,b)=>b.r.updated.localeCompare(a.r.updated)||a.s.name.localeCompare(b.s.name)).slice(0,limit);
  return rows.length?`<div class="list">${rows.map(({s,r})=>`<div class="list-item">${tile('waves','cyan')}<div><strong>${esc(s.name)}</strong><span class="meta">${t('Groundwater depth')} · ${num(r.depth,1)} m</span></div><span class="right">${fmtMonth(r.month)}</span></div>`).join('')}</div>`:`<div class="empty">${t('No readings yet')}</div>`;
}
function overview() {
  const sites=scoped(),st=summary(sites);
  return hero()+filters()+metrics(sites,st)+`<div class="grid2">${mapPanel()}${chartPanel(sites)}</div><div class="grid2"><article class="panel">${panelHead('Monitoring alerts',t('Locations flagged by the demo rules'),btn('View all','goto-scarcity'))}${st.alerts.length?siteTable(st.alerts):`<p class="empty">${t('No alerts')}</p>`}</article><article class="panel">${panelHead('Recent activity',t('Most recently recorded observations'))}${activity(sites,3)}</article></div>`;
}
const riskRules='High risk begins at 20 m depth or rainfall below 70% of baseline. Watch begins at 16 m or rainfall below 85%. Other measured sites are Normal. Missing rainfall is left unknown.';
function scarcity() {
  const sites=scoped(), st=summary(sites);
  return pageTitle('Workspace','Water Scarcity','Review the locations that need a closer look.')+filters()+metrics(sites,st)+`<div class="grid2"><article class="panel">${panelHead('Monitoring register',t('Latest available reading at each site'))}${siteTable(sites)}</article><article class="panel">${panelHead('Rainfall comparison',t('Latest monthly rainfall against its sample baseline'))}<div class="list">${sites.map(s=>{const r=latest(s),q=ratio(r);return `<div class="list-item">${tile('rain',q!==null&&q<.85?'amber':'cyan')}<div><strong>${esc(s.name)}</strong><span class="meta">${fmtMonth(r?.month)} · ${q===null?'—':`${num(r.rain)} / ${num(r.base)} mm`}</span></div><span class="right">${q===null?t('No data'):`${num(q*100)}%`}</span></div>`}).join('')}</div></article></div><article class="panel pad section"><h2>${t('How it works')}</h2><p class="intro">${t(riskRules)}</p><p class="fine">${t('The network shows Watch if any site needs attention, and High risk if all measured sites are high risk. These thresholds are for the demonstration only.')}</p></article>`;
}
function readingTable(s,edit=false) {
  const rows=ordered(s).reverse();if(!rows.length)return `<p class="empty">${t('No readings yet')}</p>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${['Month','Depth (m)','Rainfall (mm)','Baseline (mm)','Source',...(edit?['Edit']:[])].map(x=>`<th>${t(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td>${fmtMonth(r.month)}</td><td>${num(r.depth,1)}</td><td>${r.rain===null?'—':num(r.rain)}</td><td>${r.base===null?'—':num(r.base)}</td><td>${t(r.source)}</td>${edit?`<td><button class="button" data-edit="${esc(r.month)}">${icon('edit')}${t('Edit')}</button></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
function monitoring() {
  const s=siteBy(monitorId)||book.sites[0],r=latest(s),prev=previous(s);
  return pageTitle('Workspace','Groundwater Monitoring','Explore the history of a sample monitoring site.')+`<div class="filters"><label class="scope">${icon('pin')}<select id="monitor-site" aria-label="${t('Monitoring locations')}">${siteOptions(s.id)}</select></label>${btn('Add reading','add-monitor-reading','add','primary')}</div><div class="grid2">${mapPanel('monitoring')}<div class="stack">${chartPanel([s],true)}<div class="notice">${t('A deeper reading means water is farther below ground.')}</div></div></div><div class="grid2"><article class="panel">${panelHead('Monthly readings',esc(s.name)+' · '+esc(s.state))}${readingTable(s)}</article><article class="panel">${panelHead('Site details',coText(s.lat,s.lng),badge(status(s)))}<div class="panel-body stack"><div><h3>${t('Historical comparison')}</h3><p class="intro">${fmtMonth(prev?.month)} ${prev?`· ${num(prev.depth,1)} m`:''} &nbsp; / &nbsp; ${fmtMonth(r?.month)} ${r?`· ${num(r.depth,1)} m`:''}</p></div><p class="notice ${['high','watch'].includes(status(s))?'warn':''}">${t(['high','watch'].includes(status(s))?'This site needs review under the demo scarcity rules.':r?'This site is within the demo monitoring thresholds.':'No readings yet')}</p><p class="fine">${t('Sample site coordinates represent a city reference point. All depths and rainfall records are illustrative.')}</p></div></article></div>`;
}
function atlasLayers(m,detail) {
  const geo=window.AQUENIX_MAP;if(!geo)return;
  const style={color:'#a3b8ab',weight:1,fillColor:'#edf1e5',fillOpacity:1,interactive:false};
  L.geoJSON(geo.land,{interactive:false,style}).addTo(m);
  const shades=['#eaf1e4','#e4eddf','#ecf1e5','#e5edde','#edf0e1'];
  let n=0;L.geoJSON(geo.states,{interactive:false,style:()=>({...style,color:'#afbfad',weight:.9,fillColor:shades[n++%shades.length]})}).addTo(m);
  L.geoJSON(geo.rivers,{interactive:false,style:{color:'#87bfc9',weight:detail?1.2:1.05,opacity:.86,fill:false}}).addTo(m);
  const labels=[['MAHARASHTRA',19.6,76.1],['TELANGANA',18.25,79.1],['KARNATAKA',15.5,75.9],['MADHYA PRADESH',23.5,77.9],['CHHATTISGARH',21.5,82.7],['ANDHRA PRADESH',15.6,79.4],['Arabian Sea',17,70.9],['Bay of Bengal',16.4,83.8],['GUJARAT',22.5,71.8],['ODISHA',20.5,85.3]];
  const group=L.layerGroup().addTo(m);
  const refresh=()=>{group.clearLayers();if(m.getZoom()<5||m.getZoom()>9)return;labels.forEach(([name,lat,lng])=>L.marker([lat,lng],{interactive:false,keyboard:false,icon:L.divIcon({className:'geo-label'+(/Sea|Bay/.test(name)?' water':''),html:esc(name),iconSize:[106,12],iconAnchor:[46,6]})}).addTo(group))};refresh();m.on('zoomend',refresh);return group;
}
function initMap(mode) {
  if(!$('map'))return;
  if(!window.L){$('map').innerHTML=`<p class="empty">${t('Map unavailable. Use the site selector.')}</p>`;return}
  const selection=mode==='overview'?scoped():book.sites;
  const m=map=L.map('map',{attributionControl:true,zoomControl:false,zoomSnap:.25,zoomDelta:1,scrollWheelZoom:false,minZoom:3,maxZoom:18,tapTolerance:12});
  m.attributionControl.setPrefix(false);
  L.control.zoom({position:'topleft'}).addTo(m);
  const pts=selection.map(s=>[s.lat,s.lng]);
  if(mode==='intelligence'&&point) m.setView([point.lat,point.lng],7);
  else if(mode==='monitoring'&&monitorId) {const site=siteBy(monitorId);m.setView([site.lat,site.lng],6.75)}
  else if(pts.length>1) m.fitBounds(L.latLngBounds(pts),{paddingTopLeft:[43,24],paddingBottomRight:[60,25],maxZoom:7.5});
  else if(pts.length)m.setView(pts[0],7);
  else m.setView([21,78],5);
  const labels=atlasLayers(m,mode!=='overview');
  m.attributionControl.addAttribution('<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>');
  if(mode!=='overview'&&baseMap==='osm'){
    const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',pane:'overlayPane',zIndex:500});
    // A separate pane places optional street tiles above atlas vectors, below markers.
    const pane=m.createPane('streets');pane.style.zIndex='410';tiles.options.pane='streets';let failed=false;
    const fallback=()=>{if(failed||m!==map)return;failed=true;m.removeLayer(tiles);baseMap='atlas';if($('map-base'))$('map-base').value='atlas';if(labels&&!m.hasLayer(labels))labels.addTo(m);$('base-caption').textContent=tr('Offline field atlas');$('map-note').hidden=false;$('map-note').textContent=tr('Street tiles unavailable. Showing the offline atlas.')};
    tiles.on('tileerror',fallback);tiles.on('loading',()=>{if(!failed&&$('map-note')){$('map-note').hidden=false;$('map-note').textContent=tr('Loading street map…')}});tiles.on('load',()=>{if(!failed&&$('map-note'))$('map-note').hidden=true});
    if(labels)m.removeLayer(labels);tiles.addTo(m);$('base-caption').textContent='OpenStreetMap';
  }
  selection.forEach(s=>{
    const color=pinColors[status(s)];
    const marker=L.marker([s.lat,s.lng],{title:s.name,alt:s.name,icon:L.divIcon({className:'station-pin',iconSize:[17,17],iconAnchor:[8.5,8.5],html:`<span style="--pin:${color}"></span>`})}).addTo(m);
    marker.bindTooltip(esc(s.name),{permanent:true,direction:s.id==='nag'?'top':s.id==='pun'?'left':'right',offset:s.id==='nag'?[0,-8]:s.id==='pun'?[-7,0]:[8,0],className:'map-label',opacity:1});
    marker.on('click',()=>{if(mode==='intelligence')setPoint(s.lat,s.lng,s.name);else if(mode==='monitoring'){monitorId=s.id;render()}else{monitorId=s.id;navigate('monitoring')}});
  });
  if(mode!=='overview')book.bores.forEach(b=>L.marker([b.lat,b.lng],{title:b.name,icon:L.divIcon({className:'bore-pin',html:'<span></span>',iconSize:[13,13]})}).addTo(m).bindPopup(`<strong>${esc(b.name)}</strong><br>${t('Reference')}: ${esc(b.ref)}<br>${esc(b.date)}`));
  if(mode==='intelligence'){m.on('click',e=>setPoint(e.latlng.lat,e.latlng.wrap().lng));drawSelected()}
}
function drawSelected(){if(selectedLayer&&map)selectedLayer.remove();selectedLayer=null;if(!map||!point)return;selectedLayer=L.marker([point.lat,point.lng],{interactive:false,keyboard:false,zIndexOffset:800,icon:L.divIcon({className:'assess-pin',iconSize:[27,27],iconAnchor:[13.5,13.5],html:'<span></span>'})}).addTo(map)}
const gazetteer=[
  ['New Delhi',28.6139,77.2090],['Mumbai',19.0760,72.8777],['Bengaluru',12.9716,77.5946],
  ['Chennai',13.0827,80.2707],['Kolkata',22.5726,88.3639],['Jaipur',26.9124,75.7873],
  ['Patna',25.5941,85.1376],['Kochi',9.9312,76.2673],['Guwahati',26.1445,91.7362],['Ahmedabad',23.0225,72.5714]
];
function distanceKm(a,b){
  const r=Math.PI/180,dp=(b.lat-a.lat)*r,dl=(b.lng-a.lng)*r;
  const h=Math.sin(dp/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dl/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
// The 2 km radius links the click to a teaching scenario. It is not a survey radius.
function assess(p) {
  const nearest=book.sites.map(s=>({s,km:distanceKm(p,s)})).sort((a,b)=>a.km-b.km)[0];
  const s=nearest&&nearest.km<=2?nearest.s:null,r=s&&latest(s),prev=r&&previous(s,r),q=ratio(r);
  const points=[r?(r.depth<12?2:r.depth<20?1:0):null,
    r&&prev?(prev.depth-r.depth>=1?2:r.depth-prev.depth>=1?0:1):null,
    q!==null?(q>=1?2:q>=.75?1:0):null];
  const total=points.every(v=>v!==null)?points.reduce((a,b)=>a+b,0):null;
  const category=total===null?'Insufficient data':['Very low suitability','Low suitability','Moderate suitability','Moderate suitability','High suitability','High suitability','Very high suitability'][total];
  return {p:{...p},s,r,prev,q,points,total,category,km:s?nearest.km:null,
    bores:book.bores.filter(b=>distanceKm(p,b)<=2),date:new Date().toISOString().slice(0,10)};
}
const categories=['Groundwater depth','Depth change','Rainfall comparison'];
const rules=[
  'Depth under 12 m earns 2 points, 12 to under 20 m earns 1, and 20 m or deeper earns 0.',
  'Compared with the preceding calendar month, at least 1 m shallower earns 2 points, at least 1 m deeper earns 0, and a smaller change earns 1.',
  'Rainfall at or above its monthly baseline earns 2 points, 75% to under 100% earns 1, and below 75% earns 0.',
  'Totals of 0, 1, 2–3, 4–5 and 6 correspond to very low, low, moderate, high and very high demo suitability.'
];
function scoringRules(){return `<details class="details"><summary>${t('How scoring works')}</summary><p>${t('A point within 2 km of a sample station can use its teaching scenario. All three inputs are required. The radius and thresholds are illustrative.')}</p><ul class="rule-list">${rules.map(s=>`<li>${t(s)}</li>`).join('')}</ul></details>`}
function reportHTML() {
  if(!report)return `<article class="panel section result-placeholder" id="report-box">${tile('scan')}<div><h3>${t('Assessment report')}</h3><p>${t('Choose a point and run the assessment to see its evidence.')}</p></div></article>`;
  const a=report;
  const evidence=[a.r?`${t('Groundwater depth')} · ${num(a.r.depth,1)} m`:null,a.prev?`${t('Depth change')} · ${changeText(a.r.depth-a.prev.depth)}`:null,a.q!==null?`${t('Rainfall comparison')} · ${num(a.r.rain)} / ${num(a.r.base)} mm`:null];
  const missing=['Geology, rock formations and fractures','Elevation, slope and drainage analysis','Site-scale water-body distances','Field measurements and pumping-test yields'];
  if(!a.s)missing.unshift('No sample station within 2 km.');
  else categories.forEach((key,i)=>{if(a.points[i]===null)missing.unshift(key)});
  if(!a.bores.length)missing.push('Verified nearby borewell records');
  const list=a=>`<ul>${a.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  const section=(title,body)=>`<section><h3>${t(title)}</h3>${body}</section>`;
  return `<article class="panel section report" id="report-box" tabindex="-1"><div class="pad"><div class="report-heading"><div><div class="meta-title">AQUENIX / ${t('Assessment report')}</div><h2 class="report-title">${t(a.category)}</h2><p class="meta">${t('Selected coordinates')} · <span class="coords">${coText(a.p.lat,a.p.lng)}</span></p></div><span class="scope-pill">${t(a.total===null?'No score':'Illustrative score')}${a.total!==null?` · ${num(a.total)}/6`:''}</span></div><p class="fine" style="margin:9px 0">${t('Report date')} · ${esc(a.date)} &nbsp; | &nbsp; ${t('Reference month')} · ${fmtMonth(a.r?.month)} &nbsp; | &nbsp; ${t('Source')} · ${a.s?`${esc(a.s.name)} · ${t(a.r?.source||'No readings yet')} · ${num(a.km,2)} km`:t('No linked evidence')}</p><div class="notice warn"><strong>${t('Limited confidence')}.</strong> ${t('Real-site suitability is undetermined. The demo score is a classroom illustration, never a probability of borewell success.')}</div><div class="fact-grid">${section('Evidence available',list([...evidence.map((x,i)=>x?`${x} · ${num(a.points[i])}/2`:null).filter(Boolean),...a.bores.map(b=>`${t('Referenced borewell')} · ${esc(b.name)} · ${esc(b.ref)} (${esc(b.date)})`),...(!evidence.some(Boolean)&&!a.bores.length?[t('No linked evidence')]:[])]))}${section('Missing information',list(missing.map(t)))}${section('Potential risks',list([t('Coordinates alone cannot establish groundwater availability.'),t('Seasonal changes and local rock conditions can alter well yield.')]))}${section('Recommendations',list([t('Get a local hydrogeological survey before drilling.'),t('Ask a qualified professional whether electrical resistivity surveying is appropriate.')]))}</div>${scoringRules()}<p class="print-only fine">${t('Demonstration data')} · ${t('Groundwater intelligence screening with three illustrative factors.')}</p><div class="actions">${btn('Print report','print','print','primary')}${btn('Read aloud','speak','speaker')}</div></div></article>`;
}
function intelligence() {
  const current=point?coText(point.lat,point.lng):'—';
  const names=[...book.sites.map(s=>s.name),...gazetteer.map(a=>a[0])];
  return pageTitle('Smart Groundwater Intelligence','Know Before You Drill','Explore what the available data can tell you about a proposed site.')+`<div class="grid2">${mapPanel('intelligence')}<article class="panel">${panelHead('Site assessment',t('Search a city, select a sample station or click the map.'))}<div class="panel-body stack"><form id="place-search" class="fields"><label class="field"><span>${t('Search sample sites or enter coordinates')}</span><span class="search"><input name="query" required list="places" placeholder="Nagpur / 21.1458, 79.0882" autocomplete="off"><button class="button" type="submit">${icon('search')}${t('Find site')}</button></span></label><datalist id="places">${names.map(n=>`<option value="${esc(n)}"></option>`).join('')}</datalist></form><label class="field">${t('Sample monitoring location')}<select id="sample-site">${options([['',tr('Select site')],...book.sites.map(s=>[s.id,s.name])],point?.siteId||'')}</select></label><div class="readout"><div><div class="meta">${t('Selected coordinates')}</div><div class="coords" id="coords" aria-live="polite">${current}</div></div>${icon('scan')}</div><button type="button" class="button primary" id="analyse" data-action="analyse" ${point?'':'disabled'}>${icon('scan')}${t('Analyse Location')}</button><p class="fine">${t('Coordinates alone cannot establish groundwater availability.')}</p>${scoringRules()}</div></article></div>${reportHTML()}`;
}
function setPoint(lat,lng,name='') {
  if(!validPoint(lat,lng))return;
  point={lat,lng,name,siteId:book.sites.find(s=>s.lat===lat&&s.lng===lng)?.id||''};
  report=null;const box=$('report-box');if(box)box.outerHTML=reportHTML();
  if($('coords'))$('coords').textContent=coText(lat,lng);if($('sample-site'))$('sample-site').value=point.siteId;
  if($('analyse'))$('analyse').disabled=false;drawSelected();
}
const guides=[
  ['house','cyan','Rainwater harvesting and rooftop collection','Use a covered storage tank and fit a first-flush diverter.'],
  ['layers','teal','Groundwater recharge','Ask a local specialist to check soil, water quality and site suitability before designing a recharge pit.'],
  ['drop','cyan','Drip irrigation','Apply water near plant roots and check emitters for leaks.'],
  ['leaf','teal','Water-saving farming','Use mulch and match irrigation to crop needs and soil moisture.'],
  ['tool','amber','Borewell maintenance','Keep wellheads protected and arrange professional inspections.'],
  ['people','cyan','Community water management','Review seasonal readings together and agree on a shared water-use plan.']
];
const numberInput=(name,value,min,max,step='any',required=true)=>`<input type="number" name="${name}" value="${esc(value)}" min="${min}" max="${max}" step="${step}" ${required?'required':''} inputmode="decimal">`;
function conservation() {
  return pageTitle('Analysis','Water Conservation','Estimate the water a roof can collect, then choose a practical conservation step.')+`<div class="grid2 equal"><article class="panel">${panelHead('Rainwater calculator',t('Use your catchment dimensions and local annual rainfall.'))}<form id="harvest" class="panel-body fields"><div class="formgrid">${field('Catchment area (m²)',numberInput('area',calc.area,0,1e8))}${field('Annual rainfall (mm)',numberInput('rain',calc.rain,0,1e5))}${field('Runoff coefficient',numberInput('coef',calc.coef,0,1,'.01'))}<div class="fine">${t('Use a value from 0 to 1 for the share of rainfall that reaches storage.')}</div></div><div><button class="button primary" type="submit">${icon('drop')}${t('Calculate')}</button></div></form></article><article class="panel pad"><div class="darkcard" id="harvest-result" aria-live="polite">${harvestResult()}</div><p class="fine" style="margin-top:12px">${t('This is the yearly collection potential. Actual storage depends on tank capacity, rainfall timing and losses.')}</p></article></div><div class="guide-grid">${guides.map(([i,c,title,body])=>`<article class="guide-card">${tile(i,c)}<h3>${t(title)}</h3><p>${t(body)}</p></article>`).join('')}</div>`;
}
function harvestResult(){return `<div class="eyebrow">${t('Estimated annual harvest')}</div><strong>${num(calc.result,calc.result>0&&calc.result<1?2:0)}</strong><p>${t('litres per year')}</p><p class="equation">${num(calc.area,calc.area%1?1:0)} m² × ${num(calc.rain,calc.rain%1?1:0)} mm × ${num(calc.coef,2)}</p>`}
function nextMonth(s){const last=latest(s)?.month;return last?offsetMonth(last,1):new Date().toISOString().slice(0,7)}
function adminForm(s){
  const start=editing?ordered(s).find(r=>r.month===editing):null;
  if(adminTab==='reading')return `<form id="reading-form" class="fields"><div class="formgrid">${field('Location',`<select id="admin-site" name="site">${siteOptions(s.id)}</select>`)}${field('Month',`<input type="month" name="month" min="1900-01" max="2100-12" value="${esc(start?.month||nextMonth(s))}" required ${start?'readonly':''}>`)}${field('Depth (m)',numberInput('depth',start?.depth??'',0,2000,'.1'))}${field('Rainfall (mm)',numberInput('rain',start?.rain??'',0,10000,'any',false))}${field('Baseline (mm)',numberInput('base',start?.base??'',.01,10000,'any',false))}</div><p class="fine">${t('Rainfall and baseline are optional. Blank fields stay unknown.')}</p><div class="actions"><button type="submit" class="button primary">${icon('check')}${t(start?'Update reading':'Save reading')}</button>${start?btn('Cancel','cancel-edit'):''}</div><span class="form-error" role="alert"></span></form>`;
  if(adminTab==='location')return `<form id="location-form" class="fields"><div class="formgrid">${field('Site name','<input name="name" maxlength="70" required>')}${field('State','<input name="state" maxlength="70" required>')}${field('Latitude',numberInput('lat','',-90,90))}${field('Longitude',numberInput('lng','',-180,180))}</div><p class="fine">${t('New locations start with no readings. Their coordinates identify demonstration sites.')}</p><div><button type="submit" class="button primary">${icon('add')}${t('Save location')}</button></div><span class="form-error" role="alert"></span></form>`;
  return `<form id="bore-form" class="fields"><div class="formgrid">${field('Site name','<input name="name" maxlength="70" required>')}${field('Verification date',`<input name="date" type="date" max="${new Date().toISOString().slice(0,10)}" required>`)}${field('Latitude',numberInput('lat','',-90,90))}${field('Longitude',numberInput('lng','',-180,180))}</div>${field('Source reference','<input name="ref" maxlength="240" required minlength="4" placeholder="Survey title / record ID">')}<label class="checks"><input name="confirm" type="checkbox" required>${t('I checked these coordinates against the cited original record.')}</label><p class="fine">${t('AQUENIX stores your reference locally. Referenced borewells do not add points to the demo score.')}</p><div><button class="button primary" type="submit">${icon('check')}${t('Save record')}</button></div><span class="form-error" role="alert"></span></form>`;
}
function admin() {
  const s=siteBy(monitorId)||book.sites[0];
  const tabs=[['reading','Add reading'],['location','Add location'],['bore','Add borewell record']];
  return pageTitle('Management','Admin Panel','Manage this browser’s local monitoring records.')+`<div class="notice">${t('Open demo administration. Anyone using this browser can edit its demonstration records.')}</div><div class="grid2"><article class="panel">${panelHead(editing?'Update reading':'Local records')}<div class="panel-body"><div class="tabs">${tabs.map(([id,txt])=>`<button type="button" data-tab="${id}" aria-pressed="${id===adminTab}" class="tab ${id===adminTab?'active':''}">${t(txt)}</button>`).join('')}</div>${adminForm(s)}</div></article><article class="panel">${panelHead('Recent entries',t('Most recently recorded observations'))}${activity(book.sites)}</article></div><article class="panel section">${panelHead('Monthly readings',esc(s.name)+' · '+esc(s.state),`<select class="atlas-control" id="register-site" aria-label="${t('Select site')}">${siteOptions(s.id)}</select>`)}${readingTable(s,true)}</article><div class="grid2"><article class="panel">${panelHead('Monitoring locations')}${siteTable(book.sites)}</article><article class="panel">${panelHead('Borewell records')}${book.bores.length?`<div class="list">${book.bores.map(b=>`<div class="list-item">${tile('pin')}<div><strong>${esc(b.name)}</strong><p class="meta">${esc(b.ref)} · ${esc(b.date)}</p><span class="meta">${coText(b.lat,b.lng)}</span></div></div>`).join('')}</div>`:`<p class="empty">${t('No referenced borewell records have been entered.')}</p>`}</article></div>`;
}
function render() {
  if(plot){plot.destroy();plot=null}
  if(map){map.remove();map=null;selectedLayer=null}
  if(heroObserver){heroObserver.disconnect();heroObserver=null}
  shell();
  const views={overview,scarcity,monitoring,intelligence,conservation,admin};
  $('main').innerHTML=(storeIssue?`<p class="notice warn">${t(storeIssue)}</p>`:'')+views[page]()+`<footer class="page-footer"><span>AQUENIX · ${t('Water intelligence')}</span><span>${t('Prototype data stored in this browser')}</span></footer>`;
  if(page==='overview'){drawContours();drawChart(scoped());initMap('overview')}
  if(page==='monitoring'){drawChart([siteBy(monitorId)||book.sites[0]]);initMap('monitoring')}
  if(page==='intelligence')initMap('intelligence');
}
function route(){
  const id=location.hash.slice(1);page=Object.hasOwn(pages,id)?id:'overview';setMenu(false);render();window.scrollTo(0,0);
}
function navigate(id){if(page===id){render();window.scrollTo(0,0)}else location.hash=id}
function speak(){
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){toast('Voice guidance is unavailable in this browser.');return}
  const voice=window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().split(/[-_]/)[0]===lang);
  if(!voice){toast('No voice is available for this language on this device.');return}
  window.speechSynthesis.cancel();
  const words=[tr('Assessment report'),tr(report.category),tr('Coordinates alone cannot establish groundwater availability.'),tr('Get a local hydrogeological survey before drilling.')];
  const utterance=new SpeechSynthesisUtterance(words.join('. '));utterance.lang=voice.lang;utterance.voice=voice;
  utterance.onerror=()=>toast('Voice guidance is unavailable in this browser.');window.speechSynthesis.speak(utterance);
}
function saveChange(change) {
  // Read the current book before each write so unrelated earlier tab edits survive.
  try {
    const raw=localStorage.getItem(DATA_KEY), next=raw?JSON.parse(raw):initialData();
    if(!validData(next))return 'Changes could not be saved in this browser.';
    const err=change(next);
    if(err)return err;
    if(!validData(next))return 'Changes could not be saved in this browser.';
    localStorage.setItem(DATA_KEY,JSON.stringify(next));book=next;storeIssue='';report=null;return '';
  } catch{return 'Changes could not be saved in this browser.'}
}
function feedbackForm(form,msg){const node=form.querySelector('.form-error');if(node)node.textContent=tr(msg);else toast(msg)}
function submitReading(form,f){
  const id=f.get('site'),month=f.get('month'),depth=Number(f.get('depth'));
  const optional=k=>f.get(k)===''?null:Number(f.get(k));
  const record={month,depth,rain:optional('rain'),base:optional('base'),source:'Local demo entry',updated:new Date().toISOString()};
  const err=saveChange(next=>{
    const site=next.sites.find(s=>s.id===id);if(!site||!validMonth(month))return 'Changes could not be saved in this browser.';
    const idx=site.readings.findIndex(r=>r.month===month);
    if(editing&&idx>=0&&month===editing)site.readings[idx]=record;
    else if(idx>=0)return 'A reading already exists for that month. Use Edit in Monthly readings.';
    else site.readings.push(record);
  });
  if(err)return feedbackForm(form,err);
  monitorId=id;editing=null;render();toast('Record saved');
}
document.addEventListener('submit',e=>{
  const form=e.target;e.preventDefault();if(!form.reportValidity())return;
  const f=new FormData(form);
  if(form.id==='place-search'){
    const query=String(f.get('query')).trim().toLowerCase();
    const pair=query.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*[,;]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);
    const known=[...book.sites.map(s=>[s.name,s.lat,s.lng]),...gazetteer];
    const match=known.find(([name])=>name.toLowerCase()===query);
    const lat=pair?Number(pair[1]):match?.[1],lng=pair?Number(pair[2]):match?.[2];
    if(!validPoint(lat,lng)){toast('No match. Try a listed city or a latitude, longitude pair.');return}
    setPoint(lat,lng,match?.[0]||'');map?.setView([lat,lng],7);return;
  }
  if(form.id==='harvest'){
    const area=Number(f.get('area')),rain=Number(f.get('rain')),coef=Number(f.get('coef'));
    calc={area,rain,coef,result:area*rain*coef};$('harvest-result').innerHTML=harvestResult();return;
  }
  if(form.id==='reading-form'){submitReading(form,f);return}
  const name=String(f.get('name')||'').trim(),lat=Number(f.get('lat')),lng=Number(f.get('lng'));
  if(!validPoint(lat,lng))return feedbackForm(form,'Enter valid coordinates.');
  if(form.id==='location-form'){
    const state=String(f.get('state')).trim();
    if(!name||!state)return feedbackForm(form,'Enter a site name and state.');
    const id=`local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    const err=saveChange(next=>{if(next.sites.some(s=>s.name.toLowerCase()===name.toLowerCase()&&s.state.toLowerCase()===state.toLowerCase()))return 'A site with this name and state already exists.';next.sites.push({id,name,state,lat,lng,readings:[]})});
    if(err)return feedbackForm(form,err);monitorId=id;adminTab='reading';editing=null;render();toast('New location saved');return;
  }
  if(form.id==='bore-form'){
    const ref=String(f.get('ref')||'').trim(),date=String(f.get('date')||'');
    if(!name||ref.length<4||!f.get('confirm'))return feedbackForm(form,'Enter a source reference.');
    const err=saveChange(next=>{next.bores.push({name,lat,lng,ref,date})});
    if(err)return feedbackForm(form,err);render();toast('Reference saved');
  }
});
document.addEventListener('change',e=>{
  const el=e.target;
  switch(el.id){
    case 'language': lang=el.value;try{localStorage.setItem(LANG_KEY,lang)}catch{}window.speechSynthesis?.cancel();render();break;
    case 'state-filter':stateFilter=el.value;siteFilter='';render();break;
    case 'site-filter':siteFilter=el.value;render();break;
    case 'admin-site':case 'register-site':case 'monitor-site':monitorId=el.value;editing=null;render();break;
    case 'chart-range':rangeN=Number(el.value);render();break;
    case 'map-base':{
      baseMap=el.value;const center=map?.getCenter(),z=map?.getZoom();render();if(center&&map)map.setView(center,z);break;
    }
    case 'sample-site':{
      const s=siteBy(el.value);if(s){setPoint(s.lat,s.lng,s.name);map?.setView([s.lat,s.lng],7)}else{point=null;report=null;render()}break;
    }
  }
});
document.addEventListener('click',e=>{
  const target=e.target.closest('button,a');if(!target)return;
  const a=target.dataset.action;
  if(target.id==='scrim'){setMenu(false);document.querySelector('.menu')?.focus();return}
  if(target.dataset.monitor){monitorId=target.dataset.monitor;navigate('monitoring');return}
  if(target.dataset.tab){adminTab=target.dataset.tab;editing=null;render();return}
  if(target.dataset.edit){editing=target.dataset.edit;adminTab='reading';render();$('reading-form').elements.depth.focus();return}
  if(target.matches('.nav-link'))setMenu(false);
  if(!a)return;
  if(a.startsWith('goto-')){navigate(a.slice(5));return}
  if(a==='menu'){setMenu(!$('sidebar').classList.contains('open'));return}
  if(a==='add-monitor-reading'){editing=null;adminTab='reading';navigate('admin');return}
  if(a==='cancel-edit'){editing=null;render();return}
  if(a==='analyse'&&point){report=assess(point);$('report-box').outerHTML=reportHTML();$('report-box').focus({preventScroll:true});$('report-box').scrollIntoView({block:'nearest'});toast('Report ready');return}
  if(a==='print'&&report){window.print();return}
  if(a==='speak'&&report)speak();
});
window.addEventListener('hashchange',route);
window.addEventListener('storage',e=>{if(e.key!==DATA_KEY)return;book=loadBook();if(!siteBy(monitorId))monitorId=book.sites[0].id;if(siteFilter&&!siteBy(siteFilter))siteFilter='';report=null;editing=null;render()});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('sidebar').classList.contains('open')){setMenu(false);document.querySelector('.menu')?.focus()}});
if(window.speechSynthesis)window.speechSynthesis.getVoices();
route();
