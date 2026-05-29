// ════════════════════════════════════════
// SUPABASE INIT
// ════════════════════════════════════════
let supabase = null;
if(typeof window !== 'undefined' && window.SUPABASE_CONFIG) {
  const { createClient } = window.supabase;
  supabase = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.key);
}

// ════════════════════════════════════════
// AUTH
// ════════════════════════════════════════
let currentUser = null;
let currentUserData = null;

async function doLogin() {
  const email = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-err');
  
  if(!email || !password) {
    err.textContent = '❌ กรุณากรอกอีเมลและรหัสผ่าน';
    err.style.display = 'block';
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2"></i>กำลังเข้าสู่ระบบ...';
  
  try {
    if(!supabase) throw new Error('Supabase ยังไม่ได้ตั้งค่า');
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if(error) throw error;
    
    currentUser = data.user;
    currentUserData = data.user.user_metadata || {};
    
    err.style.display = 'none';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('user-pill-wrap').innerHTML = `👤 ${email}`;
    document.getElementById('user-pill-wrap').style.display = 'inline-block';
    
    const role = currentUserData.role || 'staff';
    if(role !== 'admin') {
      document.getElementById('mode-admin').style.display = 'none';
    }
    
    const dept = currentUserData.dept || 'CCU';
    document.getElementById('dept-sel').value = dept;
    
    initApp();
  } catch(e) {
    err.textContent = '❌ ' + (e.message || 'เข้าสู่ระบบล้มเหลว');
    err.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-lock-open"></i>เข้าสู่ระบบ';
  }
}

async function doLogout() {
  if(!confirm('ต้องการออกจากระบบ?')) return;
  if(supabase) {
    await supabase.auth.signOut();
  }
  currentUser = null;
  currentUserData = null;
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-user').value = '';
}

// ════════════════════════════════════════
// MODE SWITCH
// ════════════════════════════════════════
function switchMode(m) {
  document.getElementById('dash-mode').style.display = m === 'dashboard' ? 'flex' : 'none';
  document.getElementById('admin-mode').style.display = m === 'admin' ? 'flex' : 'none';
  document.getElementById('mode-dash').classList.toggle('active', m === 'dashboard');
  document.getElementById('mode-admin').classList.toggle('active', m === 'admin');
  if(m === 'dashboard') { renderTable(); renderStaff(); }
  if(m === 'admin') { loadAll(); renderHist(); renderSpecTabs(); renderDrList(); }
}

// ════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════
const SK = 'ccu_v3';
const MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const ALL_DEPTS = ['CCU','NCU','ICU'];
const DEPTS = {
  CCU: {full:'หอผู้ป่วยวิกฤตโรคหัวใจ', beds:9, types:['CCU','IMCCU','ฝากนอน']},
  NCU: {full:'หอผู้ป่วยวิกฤตระบบประสาท', beds:7, types:['NCU','IMNCU','ฝากนอน']},
  ICU: {full:'หอผู้ป่วยวิกฤตอายุรกรรม', beds:13, types:['ICU','IMCU','ฝากนอน']}
};

const TC = {
  CCU: {bg:'#cce0f8', tx:'#1a3a6a', br:'#7ab0d8'},
  IMCCU: {bg:'#e8e6f8', tx:'#3a3490', br:'#9090d8'},
  NCU: {bg:'#d0eedc', tx:'#0a5030', br:'#6ec8a0'},
  IMNCU: {bg:'#c8eed8', tx:'#0a6040', br:'#50b888'},
  ICU: {bg:'#fff3d0', tx:'#7a5200', br:'#e0a020'},
  IMCU: {bg:'#fce8d8', tx:'#6a3010', br:'#d08040'},
  ฝากนอน: {bg:'#e8e8e8', tx:'#4a4a4a', br:'#b0b0b0'}
};

const PC = {
  'อยู่ต่อ': {bg:'#e8eef6', tx:'#3a5570', br:'#b8cce0'},
  'รอรับใหม่': {bg:'#f8e0e8', tx:'#8a1a3a', br:'#d87aaa'},
  'plan D/C': {bg:'#d8f0e8', tx:'#0a5030', br:'#50b888'},
  'D/C': {bg:'#c8eed8', tx:'#0a5030', br:'#0e8060'},
  'refer': {bg:'#e8e6f8', tx:'#3a3490', br:'#9090d8'},
  'ย้ายward รอห้อง': {bg:'#fff3d0', tx:'#7a5200', br:'#e0a020'},
  'ย้าย ward ได้ห้องแล้ว': {bg:'#d8eaf8', tx:'#1a3a6a', br:'#7ab0d8'}
};

const DXC = dx => {
  if(!dx) return null;
  const d = dx.toLowerCase();
  if(d.includes('stemi') && !d.includes('nstemi')) return {bg:'#fce8e8', tx:'#8a1a1a', br:'#d88080'};
  if(d.includes('nstemi')) return {bg:'#fff3d0', tx:'#7a5200', br:'#e0a020'};
  if(d.includes('hf') || d.includes('chf')) return {bg:'#d8eaf8', tx:'#1a3a6a', br:'#7ab0d8'};
  if(d.includes('vt') || d.includes('code')) return {bg:'#fce0e0', tx:'#7a1a1a', br:'#d07070'};
  if(d.includes('pe') || d.includes('sepsis')) return {bg:'#e8e6f8', tx:'#3a3490', br:'#9090d8'};
  if(d.includes('open') || d.includes('cabg')) return {bg:'#fce8d8', tx:'#6a3010', br:'#d08040'};
  return {bg:'#e8eef6', tx:'#1a3a6a', br:'#b8cce0'};
};

const PLANS = [
  {v:'อยู่ต่อ', l:'อยู่ต่อ'},
  {v:'รอรับใหม่', l:'รอรับใหม่'},
  {v:'plan D/C', l:'plan D/C'},
  {v:'D/C', l:'D/C'},
  {v:'refer', l:'Refer'},
  {v:'ย้ายward รอห้อง', l:'ย้ายวอร์ด รอห้อง'},
  {v:'ย้าย ward ได้ห้องแล้ว', l:'ได้ห้องแล้ว'}
];

const CL = {
  'อยู่ต่อ': [{id:'lab',l:'Lab/X-ray'},{id:'or',l:'OR'},{id:'cag',l:'Plan CAG'},{id:'npo',l:'NPO'},{id:'liq',l:'จำกัดน้ำ'},{id:'fall',l:'Fall/Bleed'},{id:'flat',l:'นอนราบ/ห้ามงอขา'}],
  'ย้ายward รอห้อง': [{id:'w1',l:'ญาติ'},{id:'w2',l:'ยา'},{id:'w3',l:'ยาเดิม'},{id:'w4',l:'ทรัพย์สิน'},{id:'w5',l:'ยาในตู้เย็น'}],
  'ย้าย ward ได้ห้องแล้ว': [{id:'g1',l:'รอ Lab'},{id:'g2',l:'รอแพทย์'},{id:'g3',l:'รอ criteria'},{id:'g4',l:'รอ obs.'},{id:'g5',l:'รอญาติ'},{id:'g6',l:'รอทำห้อง'},{id:'g7',l:'รอส่งเวร'},{id:'g8',l:'รอห้องว่าง'},{id:'g9',l:'ยาในตู้เย็น'}],
  'plan D/C': [{id:'a1',l:'บัตรนัด'},{id:'a2',l:'ยา H/M'},{id:'a3',l:'คืนยา (ยาในตู้เย็น)'},{id:'a4',l:'ตรวจสอบเอกสาร'},{id:'a5',l:'ใบยินยอม'},{id:'a6',l:'Investigation'},{id:'a7',l:'ส่งการเงิน'},{id:'a8',l:'ยาในตู้เย็น'}],
  'D/C': [{id:'a1',l:'บัตรนัด'},{id:'a2',l:'ยา H/M'},{id:'a3',l:'คืนยา (ยาในตู้เย็น)'},{id:'a4',l:'ตรวจสอบเอกสาร'},{id:'a5',l:'ใบยินยอม'},{id:'a6',l:'Investigation'},{id:'a7',l:'ส่งการเงิน'},{id:'a8',l:'ยาในตู้เย็น'}],
  'refer': [{id:'r1',l:'ใบ Refer'},{id:'r2',l:'ประวัติ/Lab/X-ray/CAG'},{id:'r3',l:'เตรียมเอกสาร'},{id:'r4',l:'รอติดต่อ'},{id:'r5',l:'รอตอบกลับ'},{id:'r6',l:'ไป รพ.'},{id:'r7',l:'จองรถ Amb'},{id:'r8',l:'รอการเงิน'},{id:'r9',l:'ญาติพร้อม'},{id:'r10',l:'เวชระเบียน'},{id:'r11',l:'คืนยา (ยาในตู้เย็น) / ยกเลิก Lab'},{id:'r12',l:'ยาในตู้เย็น'}]
};

// ════════════════════════════════════════
// STATE
// ════════════════════════════════════════
let dept = 'CCU', editDept = 'CCU', showEmpty = false, staffExp = false, swapMode = 'swap';
let allBeds = {}, wards = {}, stCfg = {}, doctors = [];
let editId = null, editChecks = [], editConsults = [], editDx = [], editSRN = [], editSPN = [];
let rptHist = [], parsedBeds = [], selHistIdx = -1;

// ════════════════════════════════════════
// DEFAULT STAFF
// ════════════════════════════════════════
const DEF_ST = {
  CCU: {RN:['ศรีนคร โคทะนา','ฐาวิตรี ศรีศิริ','เจนจุรี ดวงแก้วปั้น','มณัฑนา วัฒนะพล','ไพจิตร หีบแก้ว','ลลิตา แสงส่อง','สโรชา แสงโยธา','กานต์มณี พรมชาติ','สุดารัตน์ สายโสม','สกาย นาดี'],PN:['เปมิกา สอนพงษ์','ละมุล สาลีวงษ์','สุกัญญา เริงเขตการ','ขวัญฤดี มีภักดี','สาวิตรี ชนะค้า','ขวัญชนก ปิ่นหอม','ชลนิภา พุ่มพวง','ศิรินาฎ ชมจันทร์','ขวัญธิดา หงษ์สาพันธ์']},
  NCU: {RN:['กาญจนา ภูมิคำ','วิชุตา กุนอก','มอญ ไชยสุระ','จันทนา เกตุนาค','มนธิรา หาวงศ์','รัญชิดา สนคงนอก','เพ็ญพลอย อุ่นนา','ศศินา ทะนารี','วราลักษณ์ เวฬุวนาธร','ชุติมา ปนคำ','ณัฐพร พันนุมา','มยุรา ไชบุญญา','กัลยาณี พงษ์วัน','จิราภรณ์ นะวะสด'],PN:['พิชญ์สินี เลิศนราวโรจน์','หยาดพิรุณ แสงสว่าง','อรนุช วงศ์ษาบุตร','ประณิตา ศิริวรรณ','ปรัชญา แกมนิล','รติกร จุลพันธ์','หัทยา เผยสง่า','อุลัย จันทร์สว่าง','นิภาพร เกษมศรีสุขสง่า']},
  ICU: {RN:['ศิริลักษณ์ แสนอุบล','บุณยวีร์ กลิ่นเพชร์','พัชรา สายกระสุน','เจนจิรา ศรีสงคราม','จิรเนตร พันธุ์คุ้มเก่า','มารศรี จันทราช','ณัฐนนท์ หลายแห่ง','นิศาชล หงษ์หิน','พัชรพร อินทำ','มุยรา ไชบุญญา','สิริกัลยาภรณ์ พลหาญ','วันทนีย์ สารักษ์','เดือนเพ็ญ บุญแก้ว','อุชเชษินี พิจารณ์','ชญานิศ ชัยฤทธิ์'],PN:['อมรา ทองแสง','ทิพย์พวรรณ สวัสดี','วราภรณ์ ดำนิน','รุ่งนภา พวงจำปา','นัทพร แก้วคำชาติ','มณีรุ่ง สิงห์คะนอง','ชลธิชา ยวนยี','วิจิตรา ไตรยะมูล','ปวีณา แสนเสน','ปัณณรัชต์ บุระเนตร','การัติมา ดีบุปผา','ยลดา พัฒนจักร์']},
};

function mergeStaffFromDefaults() {
  ALL_DEPTS.forEach(d => {
    if(!stCfg[d]) stCfg[d] = {RN:[], PN:[]};
    ['RN','PN'].forEach(role => {
      const def = DEF_ST[d]?.[role] || [];
      const cur = stCfg[d][role] || [];
      def.forEach(n => { if(n && !cur.includes(n)) cur.push(n); });
      stCfg[d][role] = cur;
    });
  });
}

// ════════════════════════════════════════
// STORAGE: SUPABASE + LocalStorage fallback
// ════════════════════════════════════════
async function loadFromSupabase() {
  if(!supabase) return loadFromLocal();
  try {
    const { data, error } = await supabase.from('ccu_state').select('*').eq('id', 'META').single();
    if(error && error.code !== 'PGRST116') throw error;
    if(data) {
      allBeds = data.beds || {};
      wards = data.wards || {};
      stCfg = data.st_cfg || {};
      doctors = data.doctors || [];
      rptHist = data.report_history || [];
    }
  } catch(e) {
    console.error('Supabase load error:', e);
    loadFromLocal();
  }
}

async function saveToSupabase() {
  if(!supabase) return saveToLocal();
  try {
    const { error } = await supabase.from('ccu_state').upsert({
      id: 'META',
      beds: allBeds,
      wards: wards,
      st_cfg: stCfg,
      doctors: doctors,
      report_history: rptHist,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    if(error) throw error;
  } catch(e) {
    console.error('Supabase save error:', e);
    saveToLocal();
  }
}

function loadFromLocal() {
  const d = localStorage.getItem(SK);
  if(d) {
    const data = JSON.parse(d);
    allBeds = data.beds || {};
    wards = data.wards || {};
    stCfg = data.st_cfg || {};
    doctors = data.doctors || [];
    rptHist = data.report_history || [];
  }
}

function saveToLocal() {
  localStorage.setItem(SK, JSON.stringify({
    beds: allBeds,
    wards: wards,
    st_cfg: stCfg,
    doctors: doctors,
    report_history: rptHist
  }));
}

async function persist() {
  saveToLocal();
  if(supabase) await saveToSupabase();
}

async function load() {
  await loadFromSupabase();
  mergeStaffFromDefaults();
}

// ════════════════════════════════════════
// BED FUNCTIONS
// ════════════════════════════════════════
function emptyBed(id, d) {
  return {id, dept:d, dx:[], master:[], consult:[], checks:[], plan:'อยู่ต่อ', rn:''};
}

function initBeds() {
  if(allBeds.CCU) return;
  ALL_DEPTS.forEach(d => {
    allBeds[d] = {};
    DEPTS[d].types.forEach(t => {
      const n = t === 'ฝากนอน' ? 3 : (d === 'CCU' ? 9 : d === 'NCU' ? 7 : 13);
      for(let i = 1; i <= n; i++) {
        const id = t + String(i).padStart(2, '0');
        allBeds[d][id] = emptyBed(id, d);
      }
    });
  });
  persist();
}

function openBed(bedId, bedDept) {
  editId = bedId;
  editDept = bedDept;
  const b = allBeds[bedDept]?.[bedId] || emptyBed(bedId, bedDept);
  
  editDx = [...(b.dx || [])];
  editConsults = [...(b.consult || [])];
  editChecks = [...(b.checks || [])];
  
  document.getElementById('m-title').textContent = 'เตียง ' + bedId;
  document.getElementById('m-bed-id').innerHTML = `<span style="font-size:13px;font-weight:600;color:var(--blue);">${bedId} [${bedDept}]</span>`;
  
  // Fill form
  document.getElementById('m-gender').value = b.gender || '';
  document.getElementById('m-age').value = b.age || '';
  document.getElementById('m-admit').value = b.admit_date || '';
  document.getElementById('m-los').value = b.los || '';
  document.getElementById('m-code').value = b.code || '';
  document.getElementById('m-rn').value = b.rn || '';
  document.getElementById('m-plan').value = b.plan || 'อยู่ต่อ';
  
  renderDxList();
  renderMasterList();
  renderConsultList();
  renderCheckList();
  
  document.getElementById('bed-modal').classList.add('open');
}

function closeBed() {
  document.getElementById('bed-modal').classList.remove('open');
  editId = null;
}

function updateBedField(key, value) {
  if(!editId || !allBeds[editDept]) return;
  if(!allBeds[editDept][editId]) allBeds[editDept][editId] = emptyBed(editId, editDept);
  allBeds[editDept][editId][key] = value;
  persist();
  renderTable();
}

function addDx() {
  const inp = document.getElementById('m-dx-inp');
  const v = inp.value.trim();
  if(v && !editDx.includes(v)) {
    editDx.push(v);
    updateBedField('dx', editDx);
    inp.value = '';
    renderDxList();
  }
}

function remDx(dx) {
  editDx = editDx.filter(x => x !== dx);
  updateBedField('dx', editDx);
  renderDxList();
}

function renderDxList() {
  document.getElementById('m-dx-list').innerHTML = editDx.map(dx => 
    `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:12px;">
      ${dxpill(dx)}
      <button onclick="remDx('${dx.replace(/'/g,"\\'")}');" style="border:none;background:none;cursor:pointer;color:#999;">✕</button>
    </div>`
  ).join('');
}

// ════════════════════════════════════════
// RENDER
// ════════════════════════════════════════
function tick() {
  const n = new Date();
  document.getElementById('clock').textContent = n.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  document.getElementById('datef').textContent = `${n.getDate()} ${MONTHS[n.getMonth()]} ${n.getFullYear()+543}`;
}

const pill = (l, bg, tx, br, sz=11) => `<span class="pill" style="background:${bg};color:${tx};border-color:${br};font-size:${sz}px;">${l}</span>`;
const tpill = t => {const c=TC[t]||TC['ฝากนอน'];return`<span class="tpill" style="background:${c.bg};color:${c.tx};border-color:${c.br};">${t}</span>`;};
const planpill = p => {const c=PC[p]||PC['อยู่ต่อ'];const l=PLANS.find(x=>x.v===p)?.l||p;return pill(l,c.bg,c.tx,c.br);};
const dxpill = dx => {const c=DXC(dx)||{bg:'#e8eef6',tx:'#1a3a6a',br:'#b8cce0'};return pill(dx,c.bg,c.tx,c.br);};

function syncDeptFromSelect() {
  const sel = document.getElementById('dept-sel');
  if(sel) dept = sel.value;
}

function changeDept() {
  syncDeptFromSelect();
  renderTable();
  renderStaff();
}

function renderTable() {
  syncDeptFromSelect();
  const isAll = dept === 'ALL';
  const beds = [];
  if(isAll) {
    ALL_DEPTS.forEach(d => {
      const dBeds = Object.values(allBeds[d] || {}).sort((a,b)=>parseInt(a.id)-parseInt(b.id));
      beds.push(...dBeds);
    });
  } else {
    const dBeds = Object.values(allBeds[dept] || {}).sort((a,b)=>parseInt(a.id)-parseInt(b.id));
    beds.push(...dBeds);
  }
  
  const vis = showEmpty ? beds : beds.filter(b => b.dx?.length || b.plan === 'รอรับใหม่');
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = vis.map(b => renderRow(b, isAll)).join('');
  
  // Update stats
  const occ = beds.filter(b => b.dx?.length || b.plan === 'รอรับใหม่').length;
  document.getElementById('st-occ').textContent = occ;
  document.getElementById('st-dc').textContent = beds.filter(b => b.plan === 'D/C').length;
  document.getElementById('st-ward').textContent = beds.filter(b => b.plan === 'ย้ายward รอห้อง').length;
  document.getElementById('st-got').textContent = beds.filter(b => b.plan === 'ย้าย ward ได้ห้องแล้ว').length;
  document.getElementById('st-ref').textContent = beds.filter(b => b.plan === 'refer').length;
}

function renderRow(b, showDept) {
  const occ = b.dx?.length || b.plan === 'รอรับใหม่';
  return `<tr onclick="openBed('${b.id}','${b.dept}')" style="cursor:pointer;">
    <td style="font-weight:600;color:var(--blue);font-family:monospace;">${b.id}${showDept ? ' ['+b.dept+']' : ''}</td>
    <td>${b.gender || '—'} ${b.age || '—'}</td>
    <td>${(b.dx||[]).map(dxpill).join(' ')}</td>
    <td>${(b.master||[]).map(m=>pill(m,'#e8eef6','#1a3a6a','#b8cce0',11)).join(' ')}</td>
    <td>${(b.consult||[]).map(c=>pill(c,'#e8e6f8','#3a3490','#9090d8',11)).join(' ')}</td>
    <td>${planpill(b.plan)}</td>
    <td>${b.rn || '—'}</td>
  </tr>`;
}

function renderStaff() {
  syncDeptFromSelect();
  const d = dept;
  const w = wards[d] || {};
  const sc = stCfg[d] || {};
  const rns = w.shiftRN?.length ? w.shiftRN : (sc.RN || []);
  const pns = w.shiftPN?.length ? w.shiftPN : (sc.PN || []);
  
  ['inc','tl','cb','dr'].forEach((k,i) => {
    const v = ['inCharge','teamLead','codeBlue','doctorNight'][i];
    const el = document.getElementById('s-'+k);
    if(el) el.textContent = w[v] || '—';
  });
  
  const seRn = document.getElementById('se-rn');
  if(seRn) seRn.innerHTML = rns.map(n=>`<span class="ch rn">${n}</span>`).join('');
  const sePn = document.getElementById('se-pn');
  if(sePn) sePn.innerHTML = pns.map(n=>`<span class="ch pn">${n}</span>`).join('');
}

function toggleStaff() {
  staffExp = !staffExp;
  document.getElementById('sstrip').style.display = staffExp ? 'none' : 'flex';
  document.getElementById('sexp').style.display = staffExp ? 'block' : 'none';
  if(staffExp) renderStaff();
}

function openStaff() {
  syncDeptFromSelect();
  const w = wards[dept] || {};
  document.getElementById('w-inc').value = w.inCharge || '';
  document.getElementById('w-tl').value = w.teamLead || '';
  document.getElementById('w-cb').value = w.codeBlue || '';
  document.getElementById('w-dr').value = w.doctorNight || '';
  editSRN = [...(w.shiftRN || [])];
  editSPN = [...(w.shiftPN || [])];
  renderST();
  document.getElementById('staff-modal').classList.add('open');
}

function closeStaff() {
  document.getElementById('staff-modal').classList.remove('open');
}

function saveStaff() {
  syncDeptFromSelect();
  wards[dept] = {
    inCharge: document.getElementById('w-inc').value,
    teamLead: document.getElementById('w-tl').value,
    codeBlue: document.getElementById('w-cb').value,
    doctorNight: document.getElementById('w-dr').value,
    shiftRN: [...editSRN],
    shiftPN: [...editSPN]
  };
  persist();
  renderStaff();
  closeStaff();
  toast('✓ บันทึกข้อมูลเวร');
}

function renderST() {
  const srnEl = document.getElementById('srn-t');
  const spnEl = document.getElementById('spn-t');
  if(srnEl) srnEl.innerHTML = editSRN.map((n,i) => `<div style="padding:4px 8px;background:#d0eedc;border-radius:4px;font-size:12px;display:flex;justify-content:space-between;align-items:center;gap:8px;"><span>${n}</span><button style="border:none;background:none;cursor:pointer;color:#999;" onclick="editSRN.splice(${i},1);renderST();">✕</button></div>`).join('');
  if(spnEl) spnEl.innerHTML = editSPN.map((n,i) => `<div style="padding:4px 8px;background:#fff3d0;border-radius:4px;font-size:12px;display:flex;justify-content:space-between;align-items:center;gap:8px;"><span>${n}</span><button style="border:none;background:none;cursor:pointer;color:#999;" onclick="editSPN.splice(${i},1);renderST();">✕</button></div>`).join('');
}

// ════════════════════════════════════════
// UI HELPERS
// ════════════════════════════════════════
function toast(msg, bg) {
  const n = document.createElement('div');
  n.textContent = msg;
  n.style.cssText = `position:fixed;bottom:18px;right:18px;background:${bg||'#1a6fcc'};color:#fff;padding:9px 16px;border-radius:var(--r);font-size:13px;z-index:9999;animation:fi .3s ease;box-shadow:0 4px 16px rgba(0,0,0,.2);font-family:'Sarabun',sans-serif;max-width:300px;`;
  document.body.appendChild(n);
  setTimeout(()=>{
    n.style.opacity='0';
    n.style.transition='opacity .4s';
    setTimeout(()=>n.remove(),400);
  }, 3000);
}

function toggleEmpty() {
  showEmpty = !showEmpty;
  document.getElementById('tbtn').textContent = showEmpty ? 'ซ่อนว่าง' : 'แสดงว่าง';
  renderTable();
}

function doRefresh() {
  load().then(() => {
    renderTable();
    renderStaff();
    toast('🔄 รีเฟรชข้อมูลแล้ว');
  });
}

function gotoPage(p, el) {
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.ntab').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-'+p)?.classList.add('active');
  if(el) el.classList.add('active');
}

// ════════════════════════════════════════
// STUBS (implement in detail if needed)
// ════════════════════════════════════════
function renderDxList() {}
function renderMasterList() {}
function renderConsultList() {}
function renderCheckList() {}
function loadAll() {}
function renderHist() {}
function renderSpecTabs() {}
function renderDrList() {}
function addSt(role) {}
function remSt(role, name) {}

// ════════════════════════════════════════
// APP INIT
// ════════════════════════════════════════
async function initApp() {
  await load();
  initBeds();
  setInterval(tick, 1000);
  tick();
  renderTable();
  renderStaff();
  switchMode('dashboard');
  
  // Setup Supabase realtime
  if(supabase) {
    supabase.channel('ccu_changes').on('postgres_changes', {event: '*', schema: 'public', table: 'ccu_state'}, payload => {
      doRefresh();
    }).subscribe();
  }
}

// Auto-login check
window.addEventListener('DOMContentLoaded', async () => {
  if(supabase) {
    const { data } = await supabase.auth.getSession();
    if(data.session) {
      currentUser = data.session.user;
      currentUserData = data.session.user.user_metadata || {};
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('main-app').style.display = 'flex';
      document.getElementById('user-pill-wrap').innerHTML = `👤 ${currentUser.email}`;
      document.getElementById('user-pill-wrap').style.display = 'inline-block';
      initApp();
    }
  }
});
