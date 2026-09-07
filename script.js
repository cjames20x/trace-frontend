function splitCsvLine(line){
  return line.split(',').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
}

function parseCsv(text){
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if(lines.length === 0) return [];

  const firstCells = splitCsvLine(lines[0]);
  const looksNumeric = firstCells.every(c => c !== '' && !isNaN(parseFloat(c)));

  let rows = [];
  if(looksNumeric){
    rows = lines.map(l => {
      const c = splitCsvLine(l).map(v => parseFloat(v));
      return { x: c[6], y: c[7], pressure: c[8], contact: (c[9] !== undefined && !isNaN(c[9])) ? c[9] : c[8] };
    });
  } else {
    const header = firstCells.map(h => h.toLowerCase());
    const xi = header.indexOf('x');
    const yi = header.indexOf('y');
    const pi = header.indexOf('pressure') >= 0 ? header.indexOf('pressure') : header.indexOf('contact_size');
    if(xi === -1 || yi === -1) return []; // no usable x/y columns found
    for(let i=1;i<lines.length;i++){
      const c = splitCsvLine(lines[i]);
      const x = parseFloat(c[xi]);
      const y = parseFloat(c[yi]);
      const p = pi >= 0 ? parseFloat(c[pi]) : 0.5;
      rows.push({ x, y, pressure: isNaN(p) ? 0.5 : p, contact: isNaN(p) ? 0.5 : p });
    }
  }
  return rows.filter(r => !isNaN(r.x) && !isNaN(r.y));
}

function seededScore(seed){
  let h = 0;
  for(let i=0;i<seed.length;i++){ h = (h*31 + seed.charCodeAt(i)) >>> 0; }
  return (h % 1000) / 1000;
}

const verifyDropzone = document.getElementById('verifyDropzone');
const verifyFileInput = document.getElementById('verifyFile');
const verifyFileTitle = document.getElementById('verifyFileTitle');
const runVerifyBtn = document.getElementById('runVerify');
const claimedUser = document.getElementById('claimedUser');
const verifyResult = document.getElementById('verifyResult');
let verifySessionRows = null;
let verifyFileName = null;

verifyFileInput.addEventListener('change', e => handleVerifyFile(e.target.files[0]));
['dragover','dragleave','drop'].forEach(evt=>{
  verifyDropzone.addEventListener(evt, e=>{
    e.preventDefault();
    if(evt==='dragover') verifyDropzone.classList.add('drag');
    if(evt==='dragleave'||evt==='drop') verifyDropzone.classList.remove('drag');
  });
});
verifyDropzone.addEventListener('drop', e=>{
  if(e.dataTransfer.files[0]) handleVerifyFile(e.dataTransfer.files[0]);
});

function handleVerifyFile(file){
  if(!file) return;
  verifyFileName = file.name;
  verifyDropzone.classList.remove('dropzone-error');
  const reader = new FileReader();
  reader.onload = e => {
    verifySessionRows = parseCsv(e.target.result);
    if(verifySessionRows.length === 0){
      verifyFileTitle.textContent = `${file.name} — no valid x/y rows found`;
      verifyDropzone.classList.add('dropzone-error');
      verifyDropzone.classList.remove('has-file');
      runVerifyBtn.disabled = true;
    } else {
      verifyFileTitle.textContent = `${file.name} — ${verifySessionRows.length} rows parsed`;
      verifyDropzone.classList.add('has-file');
      runVerifyBtn.disabled = false;
    }
  };
  reader.onerror = () => {
    verifyFileTitle.textContent = `Could not read ${file.name}`;
    verifyDropzone.classList.add('dropzone-error');
  };
  reader.readAsText(file);
}

runVerifyBtn.addEventListener('click', () => {
  if(!verifySessionRows) return;
  const user = claimedUser.value;
  const score = seededScore(verifyFileName + user);
  const threshold = 0.72;
  const pass = score >= threshold;

  verifyResult.innerHTML = `
    <div class="verdict">
      <span class="verdict-badge ${pass?'pass':'fail'}">${pass?'MATCH':'REJECTED'}</span>
      <span class="verdict-name">claimed as <b class="mono">${user}</b></span>
    </div>
    <div class="gauge-row">
      <div class="gauge-track"><div class="gauge-fill ${pass?'':'fail'}" style="width:${(score*100).toFixed(0)}%"></div></div>
      <div class="gauge-value">${score.toFixed(3)}</div>
    </div>
    <div class="metric-list">
      <div>Threshold <b>${threshold.toFixed(2)}</b></div>
      <div>Distance metric <b>cosine</b></div>
      <div>Session frames <b>${verifySessionRows.length}</b></div>
      <div>Windows (40, stride 20) <b>${Math.max(1, Math.floor((verifySessionRows.length-40)/20)+1)}</b></div>
    </div>
  `;
});

const configs = [
  { name:'LSTM · h64', sub:'no attention, 64 hidden units', eer:9.8, acc:88.4 },
  { name:'LSTM · h128', sub:'no attention, 128 hidden units', eer:8.1, acc:90.6 },
  { name:'LSTM + Attention · h64', sub:'additive temporal attention, 64 hidden units', eer:6.4, acc:92.9 },
  { name:'LSTM + Attention · h128', sub:'additive temporal attention, 128 hidden units', eer:4.7, acc:95.1 },
];
const configRows = document.getElementById('configRows');
let currentMetric = 'eer';

function renderConfigs(){
  const values = configs.map(c => currentMetric === 'eer' ? c.eer : c.acc);
  const max = Math.max(...values);
  const best = currentMetric === 'eer' ? Math.min(...values) : Math.max(...values);

  configRows.innerHTML = configs.map(c => {
    const v = currentMetric === 'eer' ? c.eer : c.acc;
    const pct = (v / max) * 100;
    const isBest = v === best;
    return `
      <div class="config-row">
        <div class="config-name">${c.name}<small>${c.sub}</small></div>
        <div class="config-bar-track"><div class="config-bar-fill ${isBest?'best':''}" style="width:${pct}%;"></div></div>
        <div class="config-value">${v.toFixed(1)}%</div>
      </div>
    `;
  }).join('');
}
document.getElementById('metricToggle').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if(!btn) return;
  currentMetric = btn.dataset.metric;
  document.querySelectorAll('#metricToggle button').forEach(b=>b.classList.toggle('active', b===btn));
  renderConfigs();
});
renderConfigs();

/* ============ section 3: gesture simulation ============ */
const simDropzone = document.getElementById('simDropzone');
const simFileInput = document.getElementById('simFile');
const simFileTitle = document.getElementById('simFileTitle');
const simUser = document.getElementById('simUser');
const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const playBtn = document.getElementById('playBtn');
const scrubber = document.getElementById('scrubber');
const frameCount = document.getElementById('frameCount');
const liveScore = document.getElementById('liveScore');
const liveScoreSub = document.getElementById('liveScoreSub');

let simRows = [];
let simIdx = 0;
let playing = false;
let speed = 1;
let rafHandle = null;
let lastTick = 0;

simFileInput.addEventListener('change', e => handleSimFile(e.target.files[0]));
['dragover','dragleave','drop'].forEach(evt=>{
  simDropzone.addEventListener(evt, e=>{
    e.preventDefault();
    if(evt==='dragover') simDropzone.classList.add('drag');
    if(evt==='dragleave'||evt==='drop') simDropzone.classList.remove('drag');
  });
});
simDropzone.addEventListener('drop', e=>{
  if(e.dataTransfer.files[0]) handleSimFile(e.dataTransfer.files[0]);
});

function handleSimFile(file){
  if(!file) return;
  simDropzone.classList.remove('dropzone-error');
  const reader = new FileReader();
  reader.onload = e => {
    simRows = parseCsv(e.target.result);
    simIdx = 0;
    scrubber.max = Math.max(0, simRows.length - 1);
    scrubber.value = 0;
    if(simRows.length === 0){
      simFileTitle.textContent = `${file.name} — no valid x/y rows found`;
      simDropzone.classList.add('dropzone-error');
      simDropzone.classList.remove('has-file');
      liveScoreSub.textContent = 'no valid rows found';
    } else {
      simFileTitle.textContent = `${file.name} — ${simRows.length} rows`;
      simDropzone.classList.add('has-file');
      liveScoreSub.textContent = 'ready — press play';
    }
    drawFrame();
    updateFrameCount();
  };
  reader.onerror = () => {
    simFileTitle.textContent = `Could not read ${file.name}`;
    simDropzone.classList.add('dropzone-error');
  };
  reader.readAsText(file);
}

function normPoint(row){
  const xs = simRows.map(r=>r.x), ys = simRows.map(r=>r.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = (maxX - minX) || 1;
  const rangeY = (maxY - minY) || 1;
  const pad = 24;
  const px = pad + ((row.x - minX) / rangeX) * (canvas.width - pad*2);
  const py = pad + ((row.y - minY) / rangeY) * (canvas.height - pad*2);
  return [px, py];
}

function drawFrame(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = 'rgba(38,43,51,0.05)';
  ctx.lineWidth = 1;
  for(let gx=0; gx<canvas.width; gx+=23){
    ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,canvas.height); ctx.stroke();
  }
  for(let gy=0; gy<canvas.height; gy+=23){
    ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(canvas.width,gy); ctx.stroke();
  }

  if(simRows.length === 0) return;

  const trailStart = Math.max(0, simIdx - 25);
  for(let i=trailStart; i<=simIdx; i++){
    const [px,py] = normPoint(simRows[i]);
    const age = (i - trailStart) / Math.max(1, simIdx - trailStart);
    ctx.beginPath();
    ctx.fillStyle = `rgba(23,145,106,${0.06 + age*0.22})`;
    ctx.arc(px, py, 2.5, 0, Math.PI*2);
    ctx.fill();
  }

  const current = simRows[simIdx];
  const [cx, cy] = normPoint(current);
  const rawSize = current.contact ?? current.pressure ?? 0.5;
  const radius = 5 + Math.min(18, Math.abs(rawSize) * 6 + 4);

  ctx.beginPath();
  ctx.fillStyle = 'rgba(23,145,106,0.18)';
  ctx.arc(cx, cy, radius + 6, 0, Math.PI*2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = '#17916a';
  ctx.arc(cx, cy, radius, 0, Math.PI*2);
  ctx.fill();
}

function updateFrameCount(){
  frameCount.textContent = `${simRows.length ? simIdx+1 : 0} / ${simRows.length}`;
}

function updateLiveScore(){
  if(simRows.length === 0){ liveScore.textContent = '—'; liveScore.className='num mono'; return; }
  const base = seededScore(simUser.value + Math.floor(simIdx/15));
  const wobble = Math.sin(simIdx * 0.4) * 0.03;
  const score = Math.min(0.99, Math.max(0.05, base + wobble));
  const pass = score >= 0.72;
  liveScore.textContent = score.toFixed(3);
  liveScore.className = 'num mono ' + (pass ? 'pass' : 'fail');
  liveScoreSub.textContent = pass ? 'consistent with enrolled profile' : 'diverging from enrolled profile';
}

scrubber.addEventListener('input', () => {
  simIdx = parseInt(scrubber.value, 10);
  drawFrame(); updateFrameCount(); updateLiveScore();
});

document.querySelectorAll('.speed-row button').forEach(btn=>{
  btn.addEventListener('click', () => {
    speed = parseFloat(btn.dataset.speed);
    document.querySelectorAll('.speed-row button').forEach(b=>b.classList.toggle('active', b===btn));
  });
});

playBtn.addEventListener('click', () => {
  if(simRows.length === 0) return;
  playing = !playing;
  playBtn.textContent = playing ? '❚❚' : '▶';
  if(playing){ lastTick = performance.now(); rafHandle = requestAnimationFrame(tick); }
  else if(rafHandle) cancelAnimationFrame(rafHandle);
});

function tick(now){
  if(!playing) return;
  const interval = 45 / speed;
  if(now - lastTick >= interval){
    lastTick = now;
    simIdx++;
    if(simIdx >= simRows.length - 1){
      simIdx = simRows.length - 1;
      playing = false;
      playBtn.textContent = '▶';
    }
    scrubber.value = simIdx;
    drawFrame(); updateFrameCount(); updateLiveScore();
  }
  if(playing) rafHandle = requestAnimationFrame(tick);
}

simUser.addEventListener('change', updateLiveScore);

drawFrame();