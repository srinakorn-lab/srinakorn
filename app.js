// ════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════
const APP_CFG=window.CCU_CONFIG||{};
const APP_NAME=APP_CFG.appName||'CCU System';
const STORAGE_KEY=APP_CFG.storageKey||'ccu_v3';
const ADMIN_USERS=APP_CFG.adminEmails||['admin@ccu.local'];
let currentUser='';
let currentUserDept='CCU';
let currentUserRole='staff';
let supabaseClient=null;
let cloudReady=false;
let authBootstrapped=false;
let cloudRealtimeBound=false;
let cloudReloadTimer=null;

function canWriteOwnDept(d=dept){
  return currentUserRole==='admin' || d===currentUserDept;
}
function canWriteMeta(){
  return currentUserRole==='admin';
}
function requireDeptWrite(d=dept){
  if(canWriteOwnDept(d))return true;
  toast('อ่านได้ทุกแผนก แต่แก้ไขได้เฉพาะแผนกของตัวเอง','#c0392b');
  return false;
}
function requireMetaWrite(){
  if(canWriteMeta())return true;
  toast('บัญชี staff แก้ข้อมูลส่วนกลางไม่ได้','#c0392b');
  return false;
}
function updateAccessUI(){
  const badge=document.getElementById('user-pill-wrap');
  if(badge){
    const role=currentUserRole==='admin'?'admin':'staff';
    badge.textContent=`👤 ${(currentUser||'USER').toUpperCase()} · ${role.toUpperCase()}${currentUserRole==='admin'?' · ALL WRITE':' · READ ALL / WRITE OWN'}`;
  }
  const deptSel=document.getElementById('dept-sel');
  if(deptSel){
    deptSel.title=currentUserRole==='admin'
      ?'เลือกดูได้ทุกแผนก และแก้ไขได้ทุกแผนก'
      :'เลือกดูได้ทุกแผนก แต่บันทึกได้เฉพาะแผนกของตัวเอง';
  }
  ['mode-admin','mode-dash'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.title=currentUserRole==='admin'?'':'';
  });
  const info=document.getElementById('access-note');
  if(info){
    info.textContent=currentUserRole==='admin'
      ?'แอดมิน: ดูและแก้ไขได้ทุกแผนก'
      :'staff: ดูได้ทุกแผนก · แก้ไขได้เฉพาะแผนกของตัวเอง';
  }
  const deptStatus=document.getElementById('dept-status');
  if(deptStatus){
    const view=isAllView()?'ภาพรวม 3 แผนก':`${dept} · ${DEPTS[dept]?.full||''}`;
    const access=currentUserRole==='admin'
      ?'สิทธิ์: แก้ไขได้ทุกแผนก'
      :(canWriteOwnDept(dept)?'สิทธิ์: แก้ไขได้แผนกนี้':'สิทธิ์: ดูได้อย่างเดียว');
    deptStatus.innerHTML=`<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:var(--surf2);border:1px solid var(--bdr);color:var(--txd);">${view}</span><span style="font-size:11px;padding:2px 8px;border-radius:999px;background:${currentUserRole==='admin'?'#e8f8f0':'#f8f3e8'};border:1px solid ${currentUserRole==='admin'?'#0e8060':'#e0a020'};color:${currentUserRole==='admin'?'#0e8060':'#a06000'};">${access}</span>`;
  }
  const st=document.getElementById('st-dept-wrap');
  if(st)st.style.display=isAllView()?'flex':'none';
  const adminBtn=document.getElementById('mode-admin');
  if(adminBtn){
    adminBtn.style.display=currentUserRole==='admin'?'':'none';
    adminBtn.disabled=currentUserRole!=='admin';
    adminBtn.style.opacity=currentUserRole==='admin'?1:.45;
    adminBtn.style.cursor=currentUserRole==='admin'?'pointer':'not-allowed';
    adminBtn.title=currentUserRole==='admin'?'':'ใช้ได้เฉพาะแอดมิน';
  }
  const adminOnlyIds=['reset-all-btn'];
  adminOnlyIds.forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.disabled=currentUserRole!=='admin';
    el.style.opacity=currentUserRole==='admin'?1:.45;
    el.style.cursor=currentUserRole==='admin'?'pointer':'not-allowed';
    el.title=currentUserRole==='admin'?'':'ปุ่มสำหรับแอดมินเท่านั้น';
  });
  const staffLockedIds=['edit-staff-btn','clear-bed-btn','swbtn'];
  staffLockedIds.forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    if(id==='edit-staff-btn'){
      el.style.display=currentUserRole==='admin'?'':'none';
      return;
    }
    if(id==='swbtn'){
      el.style.display=currentUserRole==='admin'?'none':el.style.display;
    }
    const locked=(currentUserRole!=='admin' && (id==='edit-staff-btn'||id==='clear-bed-btn'||id==='swbtn'));
    el.disabled=locked;
    el.style.opacity=locked ? .45 : 1;
    el.style.cursor=locked?'not-allowed':'pointer';
    if(locked)el.title='อ่านได้ทุกแผนก แต่แก้ไขได้เฉพาะแผนกของตัวเอง';
  });
}

async function loadSupabaseSdk(){
  if(window.supabase?.createClient)return window.supabase;
  if(document.querySelector('script[data-supabase-sdk]'))return window.supabase;
  await new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.async=true;
    s.dataset.supabaseSdk='1';
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error('โหลด Supabase SDK ไม่สำเร็จ'));
    document.head.appendChild(s);
  });
  return window.supabase;
}

async function initCloud(){
  if(cloudReady)return supabaseClient;
  cloudReady=true;
  if(!APP_CFG.supabaseUrl||!APP_CFG.supabaseAnonKey)return null;
  try{
    await loadSupabaseSdk();
    supabaseClient=window.supabase.createClient(APP_CFG.supabaseUrl,APP_CFG.supabaseAnonKey);
    return supabaseClient;
  }catch(e){
    console.warn('Supabase not ready:',e);
    supabaseClient=null;
    return null;
  }
}

async function cloudFetchState(){
  const sb=await initCloud();
  if(!sb)return null;
  const ids=currentUserRole==='admin'?['CCU','NCU','ICU','META']:[...ALL_DEPTS,'META'];
  const { data, error } = await sb.from('ccu_state').select('*').in('id',ids);
  if(error){
    console.warn('cloudFetchState',error);
    return null;
  }
  return (data||[]).reduce((acc,row)=>{
    if(row.id==='META'){
      acc.doctors=row.doctors||acc.doctors;
      acc.reportHistory=row.report_history||acc.reportHistory;
    }else{
      acc.beds[row.id]=row.beds||{};
      acc.wards[row.id]=row.wards||{};
      acc.stCfg[row.id]=row.st_cfg||{RN:[],PN:[]};
    }
    return acc;
  },{beds:{},wards:{},stCfg:{},doctors:[],reportHistory:[]});
}

async function cloudSaveState(payload){
  const sb=await initCloud();
  if(!sb)return false;
  const deptRows=currentUserRole==='admin'?ALL_DEPTS:[currentUserDept];
  const rows=deptRows.map(id=>({
    id,
    beds:(payload.beds||{})[id]||{},
    wards:(payload.wards||{})[id]||{},
    st_cfg:(payload.stCfg||{})[id]||{RN:[],PN:[]},
    updated_at:new Date().toISOString(),
  }));
  rows.push({
    id:'META',
    beds:{},
    wards:{},
    st_cfg:{},
    doctors:payload.doctors||[],
    report_history:payload.reportHistory||[],
    updated_at:new Date().toISOString(),
  });
  for(const row of rows){
    const { error } = await sb.from('ccu_state').upsert(row,{onConflict:'id'});
    if(error){console.warn('cloudSaveState',error);return false;}
  }
  return true;
}

async function hydrateFromCloud(){
  const state=await cloudFetchState();
  if(!state)return false;
  allBeds={...allBeds,...(state.beds||{})};
  wards={...wards,...(state.wards||{})};
  stCfg={...stCfg,...(state.stCfg||{})};
  doctors=state.doctors||doctors;
  rptHist=state.report_history||rptHist;
  mergeStaffFromDefaults();
  writeLocalJSON(SK,{beds:allBeds,wards,stCfg,doctors,reportHistory:rptHist});
  return true;
}

function scheduleCloudReload(){
  if(cloudReloadTimer)clearTimeout(cloudReloadTimer);
  cloudReloadTimer=setTimeout(async()=>{
    const ok=await hydrateFromCloud();
    if(ok){
      renderTable();
      renderStaff();
      renderHist();
      updateAccessUI();
      toast('☁️ ข้อมูลอัปเดตจาก cloud','#1a6fcc');
    }
  },180);
}

async function bindCloudRealtime(){
  if(cloudRealtimeBound)return;
  const sb=await initCloud();
  if(!sb)return;
  cloudRealtimeBound=true;
  try{
    const ch=sb.channel('ccu_state_changes');
    ch.on('postgres_changes',{event:'*',schema:'public',table:'ccu_state'},()=>scheduleCloudReload());
    await ch.subscribe();
  }catch(e){
    console.warn('bindCloudRealtime',e);
  }
}

function readLocalJSON(key,fallback){
  try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}
  catch{return fallback;}
}
function writeLocalJSON(key,value){
  try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}
}

async function doLogin(){
  const u=document.getElementById('login-user').value.trim().toLowerCase();
  const p=document.getElementById('login-pass').value;
  const err=document.getElementById('login-err');
  const btn=document.getElementById('login-btn');
  const btnIcon=document.getElementById('login-btn-icon');
  const btnText=document.getElementById('login-btn-text');
  if(!u){err.textContent='❌ กรุณากรอกอีเมล';err.style.display='block';return;}
  err.style.display='none';
  btn.disabled=true;
  btnIcon.innerHTML='<span class="spin" style="width:14px;height:14px;border-color:rgba(255,255,255,.45);border-top-color:#fff;"></span>';
  btnText.textContent='กำลังเข้าสู่ระบบ...';
  const sb=await initCloud();
  if(!sb){
    err.textContent='❌ ยังไม่ได้ตั้งค่า Supabase';
    err.style.display='block';
    btn.disabled=false;btnIcon.textContent='🔐';btnText.textContent='เข้าสู่ระบบ';
    return;
  }
  const { data, error } = await sb.auth.signInWithPassword({ email:u, password:p });
  if(error||!data?.user){
    err.textContent='❌ อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    err.style.display='block';
    btn.disabled=false;btnIcon.textContent='🔐';btnText.textContent='เข้าสู่ระบบ';
    return;
  }
  await finishLogin(data.user);
}

async function doLogout(){
  if(!confirm('ต้องการออกจากระบบ?'))return;
  const sb=await initCloud();
  if(sb){try{await sb.auth.signOut();}catch{}}
  currentUser='';
  document.getElementById('main-app').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('login-pass').value='';
  document.getElementById('login-user').value='';
  document.getElementById('login-err').style.display='none';
}

async function finishLogin(user){
  currentUser=user?.email||'';
  const meta=user?.user_metadata||user?.app_metadata||{};
  const roleHint=String(meta.role||meta.dept||meta.department||'').toLowerCase();
  const deptHint=String(meta.dept||meta.department||currentUser.split('@')[0]||'').toLowerCase();
  currentUserRole=roleHint==='admin'||ADMIN_USERS.includes(currentUser)?'admin':'staff';
  document.getElementById('login-screen').style.display='none';
  document.getElementById('main-app').style.display='flex';
  document.getElementById('user-pill-wrap').textContent='👤 '+(currentUser||'USER').toUpperCase();
  document.getElementById('user-pill-wrap').style.display='inline-block';
  const isAdmin=currentUserRole==='admin';
  document.getElementById('mode-admin').style.display=isAdmin?'':'none';
  if(isAdmin)document.getElementById('dept-sel').value='ALL';
  else if(deptHint.includes('ccu')){currentUserDept='CCU';document.getElementById('dept-sel').value='CCU';}
  else if(deptHint.includes('icu')){currentUserDept='ICU';document.getElementById('dept-sel').value='ICU';}
  else if(deptHint.includes('ncu')){currentUserDept='NCU';document.getElementById('dept-sel').value='NCU';}
  document.getElementById('login-btn').disabled=false;
  document.getElementById('login-btn-icon').textContent='🔐';
  document.getElementById('login-btn-text').textContent='เข้าสู่ระบบ';
  updateAccessUI();
  initApp();
  bindCloudRealtime();
}

async function bootstrapAuth(){
  if(authBootstrapped)return;
  authBootstrapped=true;
  const sb=await initCloud();
  if(!sb)return;
  const { data } = await sb.auth.getSession();
  if(data?.session?.user){
    await finishLogin(data.session.user);
    bindCloudRealtime();
  }
  sb.auth.onAuthStateChange(async (_event, session)=>{
    if(session?.user && !currentUser){
      await finishLogin(session.user);
      bindCloudRealtime();
    }
    if(!session?.user && currentUser)await doLogout();
  });
}

function switchMode(m){
  if(m==='admin'&&currentUserRole!=='admin'){
    toast('บัญชี staff ใช้หน้า Admin ไม่ได้','#c0392b');
    m='dashboard';
  }
  document.getElementById('dash-mode').style.display=m==='dashboard'?'flex':'none';
  document.getElementById('admin-mode').style.display=m==='admin'?'flex':'none';
  document.getElementById('mode-dash').classList.toggle('active',m==='dashboard');
  document.getElementById('mode-admin').classList.toggle('active',m==='admin');
  if(m==='dashboard'){renderTable();renderStaff();}
  if(m==='admin'){loadAll();renderHist();renderSpecTabs();renderDrList();}
}

// ════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════
const SK=STORAGE_KEY;
const MONTHS=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const ALL_DEPTS=['CCU','NCU','ICU'];
const DEPTS={CCU:{full:'หอผู้ป่วยวิกฤตโรคหัวใจ',beds:9,types:['CCU','IMCCU','ฝากนอน']},NCU:{full:'หอผู้ป่วยวิกฤตระบบประสาท',beds:7,types:['NCU','IMNCU','ฝากนอน']},ICU:{full:'หอผู้ป่วยวิกฤตอายุรกรรม',beds:13,types:['ICU','IMCU','ฝากนอน']}};
const TC={CCU:{bg:'#cce0f8',tx:'#1a3a6a',br:'#7ab0d8'},IMCCU:{bg:'#e8e6f8',tx:'#3a3490',br:'#9090d8'},NCU:{bg:'#d0eedc',tx:'#0a5030',br:'#6ec8a0'},IMNCU:{bg:'#c8eed8',tx:'#0a6040',br:'#50b888'},ICU:{bg:'#fff3d0',tx:'#7a5200',br:'#e0a020'},IMCU:{bg:'#fce8d8',tx:'#6a3010',br:'#d08040'},ฝากนอน:{bg:'#e8e8e8',tx:'#4a4a4a',br:'#b0b0b0'}};
const PC={'อยู่ต่อ':{bg:'#e8eef6',tx:'#3a5570',br:'#b8cce0'},'รอรับใหม่':{bg:'#f8e0e8',tx:'#8a1a3a',br:'#d87aaa'},'plan D/C':{bg:'#d8f0e8',tx:'#0a5030',br:'#50b888'},'D/C':{bg:'#c8eed8',tx:'#0a5030',br:'#0e8060'},'refer':{bg:'#e8e6f8',tx:'#3a3490',br:'#9090d8'},'ย้ายward รอห้อง':{bg:'#fff3d0',tx:'#7a5200',br:'#e0a020'},'ย้าย ward ได้ห้องแล้ว':{bg:'#d8eaf8',tx:'#1a3a6a',br:'#7ab0d8'}};
const DXC=dx=>{if(!dx)return null;const d=dx.toLowerCase();if(d.includes('stemi')&&!d.includes('nstemi'))return{bg:'#fce8e8',tx:'#8a1a1a',br:'#d88080'};if(d.includes('nstemi'))return{bg:'#fff3d0',tx:'#7a5200',br:'#e0a020'};if(d.includes('hf')||d.includes('chf'))return{bg:'#d8eaf8',tx:'#1a3a6a',br:'#7ab0d8'};if(d.includes('vt')||d.includes('code'))return{bg:'#fce0e0',tx:'#7a1a1a',br:'#d07070'};if(d.includes('pe')||d.includes('sepsis'))return{bg:'#e8e6f8',tx:'#3a3490',br:'#9090d8'};if(d.includes('open')||d.includes('cabg'))return{bg:'#fce8d8',tx:'#6a3010',br:'#d08040'};return{bg:'#e8eef6',tx:'#1a3a6a',br:'#b8cce0'};};
const PLANS=[{v:'อยู่ต่อ',l:'อยู่ต่อ'},{v:'รอรับใหม่',l:'รอรับใหม่'},{v:'plan D/C',l:'plan D/C'},{v:'D/C',l:'D/C'},{v:'refer',l:'Refer'},{v:'ย้ายward รอห้อง',l:'ย้ายวอร์ด รอห้อง'},{v:'ย้าย ward ได้ห้องแล้ว',l:'ได้ห้องแล้ว'}];
const CL={'อยู่ต่อ':[{id:'lab',l:'Lab/X-ray'},{id:'or',l:'OR'},{id:'cag',l:'Plan CAG'},{id:'npo',l:'NPO'},{id:'liq',l:'จำกัดน้ำ'},{id:'fall',l:'Fall/Bleed'},{id:'flat',l:'นอนราบ/ห้ามงอขา'}],'ย้ายward รอห้อง':[{id:'w1',l:'ญาติ'},{id:'w2',l:'ยา'},{id:'w3',l:'ยาเดิม'},{id:'w4',l:'ทรัพย์สิน'},{id:'w5',l:'ยาในตู้เย็น'}],'ย้าย ward ได้ห้องแล้ว':[{id:'g1',l:'รอ Lab'},{id:'g2',l:'รอแพทย์'},{id:'g3',l:'รอ criteria'},{id:'g4',l:'รอ obs.'},{id:'g5',l:'รอญาติ'},{id:'g6',l:'รอทำห้อง'},{id:'g7',l:'รอส่งเวร'},{id:'g8',l:'รอห้องว่าง'},{id:'g9',l:'ยาในตู้เย็น'}],'plan D/C':[{id:'a1',l:'บัตรนัด'},{id:'a2',l:'ยา H/M'},{id:'a3',l:'คืนยา (ยาในตู้เย็น)'},{id:'a4',l:'ตรวจสอบเอกสาร'},{id:'a5',l:'ใบยินยอม'},{id:'a6',l:'Investigation'},{id:'a7',l:'ส่งการเงิน'},{id:'a8',l:'ยาในตู้เย็น'}],'D/C':[{id:'a1',l:'บัตรนัด'},{id:'a2',l:'ยา H/M'},{id:'a3',l:'คืนยา (ยาในตู้เย็น)'},{id:'a4',l:'ตรวจสอบเอกสาร'},{id:'a5',l:'ใบยินยอม'},{id:'a6',l:'Investigation'},{id:'a7',l:'ส่งการเงิน'},{id:'a8',l:'ยาในตู้เย็น'}],'refer':[{id:'r1',l:'ใบ Refer'},{id:'r2',l:'ประวัติ/Lab/X-ray/CAG'},{id:'r3',l:'เตรียมเอกสาร'},{id:'r4',l:'รอติดต่อ'},{id:'r5',l:'รอตอบกลับ'},{id:'r6',l:'ไป รพ.'},{id:'r7',l:'จองรถ Amb'},{id:'r8',l:'รอการเงิน'},{id:'r9',l:'ญาติพร้อม'},{id:'r10',l:'เวชระเบียน'},{id:'r11',l:'คืนยา (ยาในตู้เย็น) / ยกเลิก Lab'},{id:'r12',l:'ยาในตู้เย็น'}]};
const RWD={'5A':['501A','502A','503A','504A','505A','506A','507A','508A','509A','510A','511A','512A','513A','514A','515A','516A','517A','518A','519A','520A','521A','522A','523A','524A'],'6A':['601A','602A','603A','604A','605A','606A','607A','608A','609A','610A','611A','612A','613A','614A','615A','616A','617A','618A','619A','620A','621A','622A','623A','624A'],'7A':['701A','702A','703A','704A','705A','706A','707A','708A','709A','710A','711A','712A','713A','714A','715A','716A','717A','718A','719A','720A','721A','722A','723A','724A'],'8A':['801A','802A','803A','804A','805A','806A','807A','808A','809A','810A','811A','812A','813A','814A','815A','816A','817A','818A','819A','820A','821A','822A','823A','824A'],'9A':['901A','902A','903A','904A','905A','906A','907A','908A','909A','910A','911A','912A','913A','914A','915A','916A','917A','918A','919A','920A','921A','922A','923A','924A'],'10A':['1001A','1002A','1003A','1004A','1005A','1006A','1007A','1008A','1009A','1010A','1011A','1012A','1013A','1014A','1015A','1016A','1017A','1018A','1019A','1020A','1021A','1022A','1023A','1024A'],'11A':['1101A','1102A','1103A','1104A','1105A','1106A','1107A','1108A','1109A','1110A','1111A','1112A','1113A','1114A','1115A','1116A','1117A','1118A','1119A','1120A','1121A','1122A','1123A','1124A'],'12A':['1201A','1202A','1203A','1204A','1205A','1206A','1207A','1208A','1209A','1210A','1211A','1212A','1213A','1214A','1215A','1216A','1217A','1218A','1219A','1220A','1221A','1222A','1223A','1224A'],'6B':['6B01','6B02','6B03','6B04','6B05','6B06','6B07','6B08','6B09','6B10','6B11','6B12','6B13','6B14','6B15','6B16','6B17','6B18','6B19','6B20','6B21','6B22','6B23','6B24']};

const SC={
  Med:{bg:'#d8eaf8',tx:'#1a3a6a',br:'#7ab0d8'},Cardio:{bg:'#fce8e8',tx:'#8a1a1a',br:'#d07070'},
  GI:{bg:'#fff3d0',tx:'#7a5200',br:'#e0a020'},ORT:{bg:'#e8e6f8',tx:'#3a3490',br:'#9090d8'},
  PED:{bg:'#d0eedc',tx:'#0a5030',br:'#6ec8a0'},OBG:{bg:'#f8e0ec',tx:'#6a1a3a',br:'#d08aaa'},
  CVT:{bg:'#fce8d8',tx:'#6a3010',br:'#d08040'},Surg:{bg:'#e0f0d0',tx:'#2a5010',br:'#80b840'},
  Neuro:{bg:'#ede8f8',tx:'#2a1a6a',br:'#9080d8'},ENT:{bg:'#fff3d0',tx:'#7a5200',br:'#e0a020'},
  Imaging:{bg:'#e0f0f8',tx:'#1a4060',br:'#60a8c8'},HealthProm:{bg:'#e0f0d0',tx:'#2a5010',br:'#70b030'},
  Dental:{bg:'#f0f0e0',tx:'#4a4a10',br:'#a0a040'},Beauty:{bg:'#f8e0ec',tx:'#6a1a3a',br:'#c86090'},
  GP:{bg:'#e8eef6',tx:'#1a3a6a',br:'#b8cce0'},Mobile:{bg:'#eeeeed',tx:'#3a3a38',br:'#a0a090'},
  Wellness:{bg:'#d0eedc',tx:'#0a5030',br:'#6ec8a0'},ER:{bg:'#fce8d8',tx:'#6a2010',br:'#d07040'},
};

// ════════════════════════════════════════
// STATE
// ════════════════════════════════════════
let dept='CCU', editDept='CCU', showEmpty=false, staffExp=false, swapMode='swap';
let allBeds={}, wards={}, stCfg={}, doctors=[];
let editId=null, editChecks=[], editConsults=[], editDx=[], editSRN=[], editSPN=[];
let rptHist=[], parsedBeds=[], selHistIdx=-1;
let curSpec='All', curWt='all', curSD='CCU', curMode='offline';
let ncuWorkbook=null, ncuFileName='';
let autoRefreshPaused=false, autoRefreshTimer=null, autoRefreshRemaining=300, appStarted=false;

// ════════════════════════════════════════
// DEFAULT DATA
// ════════════════════════════════════════
const DEF_ST={
  CCU:{RN:['ศรีนคร โคทะนา','ฐาวิตรี ศรีศิริ','เจนจุรี ดวงแก้วปั้น','มณัฑนา วัฒนะพล','ไพจิตร หีบแก้ว','ลลิตา แสงส่อง','สโรชา แสงโยธา','กานต์มณี พรมชาติ','สุดารัตน์ สายโสม','สกาย นาดี'],PN:['เปมิกา สอนพงษ์','ละมุล สาลีวงษ์','สุกัญญา เริงเขตการ','ขวัญฤดี มีภักดี','สาวิตรี ชนะค้า','ขวัญชนก ปิ่นหอม','ชลนิภา พุ่มพวง','ศิรินาฎ ชมจันทร์','ขวัญธิดา หงษ์สาพันธ์']},
  NCU:{RN:['กาญจนา ภูมิคำ','วิชุตา กุนอก','มอญ ไชยสุระ','จันทนา เกตุนาค','มนธิรา หาวงศ์','รัญชิดา สนคงนอก','เพ็ญพลอย อุ่นนา','ศศินา ทะนารี','วราลักษณ์ เวฬุวนาธร','ชุติมา ปนคำ','ณัฐพร พันนุมา','มยุรา ไชบุญญา','กัลยาณี พงษ์วัน','จิราภรณ์ นะวะสด'],PN:['พิชญ์สินี เลิศนราวโรจน์','หยาดพิรุณ แสงสว่าง','อรนุช วงศ์ษาบุตร','ประณิตา ศิริวรรณ','ปรัชญา แกมนิล','รติกร จุลพันธ์','หัทยา เผยสง่า','อุลัย จันทร์สว่าง','นิภาพร เกษมศรีสุขสง่า']},
  ICU:{RN:['ศิริลักษณ์ แสนอุบล','บุณยวีร์ กลิ่นเพชร์','พัชรา สายกระสุน','เจนจิรา ศรีสงคราม','จิรเนตร พันธุ์คุ้มเก่า','มารศรี จันทราช','ณัฐนนท์ หลายแห่ง','นิศาชล หงษ์หิน','พัชรพร อินทำ','มุยรา ไชบุญญา','สิริกัลยาภรณ์ พลหาญ','วันทนีย์ สารักษ์','เดือนเพ็ญ บุญแก้ว','อุชเชษินี พิจารณ์','ชญานิศ ชัยฤทธิ์'],PN:['อมรา ทองแสง','ทิพย์พวรรณ สวัสดี','วราภรณ์ ดำนิน','รุ่งนภา พวงจำปา','นัทพร แก้วคำชาติ','มณีรุ่ง สิงห์คะนอง','ชลธิชา ยวนยี','วิจิตรา ไตรยะมูล','ปวีณา แสนเสน','ปัณณรัชต์ บุระเนตร','การัติมา ดีบุปผา','ยลดา พัฒนจักร์']},
};
function mergeStaffFromDefaults(){
  ALL_DEPTS.forEach(d=>{
    if(!stCfg[d])stCfg[d]={RN:[],PN:[]};
    ['RN','PN'].forEach(role=>{
      const def=DEF_ST[d]?.[role]||[];
      const cur=stCfg[d][role]||[];
      def.forEach(n=>{if(n&&!cur.includes(n))cur.push(n);});
      stCfg[d][role]=cur;
    });
  });
}
const DEF_DR=[
  {name:'นพ. กิตติคุณ จอมใจ',spec:'Anes',workType:'Full-Time'},{name:'นพ. ฤทธิชัย พุทธประสิทธิ์',spec:'Anes',workType:'Full-Time'},{name:'นพ. ศักดิ์ดา อำนวยเดชกร',spec:'Anes',workType:'Full-Time'},{name:'นพ. สุเมธ วงศ์พิมพ์',spec:'Anes',workType:'Full-Time'},{name:'พญ. จริยา เลาหสุขไพศาล',spec:'Anes',workType:'Full-Time'},{name:'พญ. อภิญญา ศิริธนากิจ',spec:'Anes',workType:'Full-Time'},
  {name:'นพ. เอกลักษณ์ คูณสิริไพบูลย์',spec:'Cardio',workType:'Full-Time'},{name:'นพ. มนตรี เจริญพานิชสันติ',spec:'Cardio',workType:'Full-Time'},{name:'นพ. สุทิน จันทิมา',spec:'Cardio',workType:'Full-Time'},{name:'นพ. วันชาติ โพธิ์ศรี',spec:'Cardio',workType:'Part-Time'},{name:'พญ. ชนินาถ ผ่องศรี',spec:'Cardio',workType:'Full-Time'},
  {name:'นพ. ณรงค์ นาคเจริญวารี',spec:'Med',workType:'Full-Time'},{name:'นพ. ดุษฎี วิชญชีวินทร์',spec:'Med',workType:'Full-Time'},{name:'นพ. เกรียงไกร บุญประชม',spec:'Med',workType:'Full-Time'},{name:'นพ. นพนาท เทียนทอง',spec:'Med',workType:'Full-Time'},{name:'นพ. บัญชา ยศธนายน',spec:'Med',workType:'Full-Time'},{name:'นพ. สมมิตร ปริยอัครกุล',spec:'Med',workType:'Full-Time'},{name:'พญ. เนตรชนก สามไชย',spec:'Med',workType:'Full-Time'},{name:'พญ. ธนะนันท์ ตรงกมลธรรม',spec:'Med',workType:'Full-Time'},
  {name:'นพ. เฉลิมพล ชคัตตรยาพงษ์',spec:'Neuro',workType:'Full-Time'},{name:'นพ. นิติพร วิศิษฎ์สกุล',spec:'Neuro',workType:'Full-Time'},{name:'นพ. วิโรจน์ เจียมศิริ',spec:'Neuro',workType:'Full-Time'},{name:'นพ. สิปปนนท์ สามไชย',spec:'Neuro',workType:'Full-Time'},
  {name:'นพ. คงพันธ์ เหมือนมยุรฉัตร',spec:'ER',workType:'Full-Time'},{name:'นพ. ธวัชชัย แซ่เตีย',spec:'ER',workType:'Full-Time'},{name:'นพ. ศุภณัฐ โสภณอุดมสิน',spec:'ER',workType:'Full-Time'},
];

// ════════════════════════════════════════
// STORAGE
// ════════════════════════════════════════
function load(){
  try{const r=readLocalJSON(SK,{});allBeds=r.beds||{};wards=r.wards||{};stCfg=r.stCfg||{CCU:{RN:[],PN:[]},NCU:{RN:[],PN:[]},ICU:{RN:[],PN:[]}};doctors=r.doctors||[];}
  catch{allBeds={};wards={};stCfg={CCU:{RN:[],PN:[]},NCU:{RN:[],PN:[]},ICU:{RN:[],PN:[]}};doctors=[];}
  ALL_DEPTS.forEach(d=>{
    if(!allBeds[d])allBeds[d]={};
    if(!wards[d])wards[d]={inCharge:'',teamLead:'',codeBlue:'',doctorNight:'',shiftRN:[],shiftPN:[]};
    if(!stCfg[d])stCfg[d]={RN:[],PN:[]};
    for(let i=1;i<=DEPTS[d].beds;i++){const k=`${i}`;if(!allBeds[d][k])allBeds[d][k]=emptyBed(k,d);else sanitizeBedPrivacy(allBeds[d][k]);}
  });
  mergeStaffFromDefaults();
}
async function persist(){
  const payload={beds:allBeds,wards,stCfg,doctors};
  try{
    writeLocalJSON(SK,payload);
    const bc=new BroadcastChannel('ccu_bc');bc.postMessage('u');
  }catch{}
  const sb=await initCloud();
  if(!sb)return;
  // Placeholder for future sync table; local storage remains the fallback until Supabase is wired.
}
function emptyBed(id,d){return{id,dept:d,deptType:DEPTS[d].types[0],gender:'',classLevel:'',age:'',admitDate:'',dx:[],patientCode:'',master:'',consult:[],rn:'',plan:'อยู่ต่อ',checks:[],transferWard:'',transferRoom:'',transferBed:'',transferRoomType:'',los:'',orNote:'',ccNote:'',presentNote:''};}
function sanitizeBedPrivacy(b){
  if(!b)return b;
  b.hn='';b.an='';if(b.patientName)delete b.patientName;
  return b;
}
function loadAll(){
  try{
    const r=readLocalJSON(SK,{});
    doctors=(r.doctors&&r.doctors.length)?r.doctors:JSON.parse(JSON.stringify(DEF_DR));
    stCfg=r.stCfg||JSON.parse(JSON.stringify(DEF_ST));
    rptHist=r.reportHistory||[];
  }catch{doctors=JSON.parse(JSON.stringify(DEF_DR));stCfg=JSON.parse(JSON.stringify(DEF_ST));rptHist=[];}
  ALL_DEPTS.forEach(d=>{if(!stCfg[d])stCfg[d]={RN:[],PN:[]};});
  mergeStaffFromDefaults();
}
async function saveAll(){
  try{
    const r=readLocalJSON(SK,{});
    r.doctors=doctors;r.stCfg=stCfg;r.reportHistory=rptHist;
    writeLocalJSON(SK,r);
    try{new BroadcastChannel('ccu_bc').postMessage('u');}catch{}
    await cloudSaveState({beds:allBeds,wards,stCfg,doctors,reportHistory:rptHist});
  }catch(e){console.error(e);}
}

// ════════════════════════════════════════
// CLOCK
// ════════════════════════════════════════
function tick(){const n=new Date();document.getElementById('clock').textContent=n.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});document.getElementById('datef').textContent=`${n.getDate()} ${MONTHS[n.getMonth()]} ${n.getFullYear()+543}`;}

// ════════════════════════════════════════
// PILLS
// ════════════════════════════════════════
const pill=(l,bg,tx,br,sz=11)=>`<span class="pill" style="background:${bg};color:${tx};border-color:${br};font-size:${sz}px;">${l}</span>`;
const tpill=t=>{const c=TC[t]||TC['ฝากนอน'];return`<span class="tpill" style="background:${c.bg};color:${c.tx};border-color:${c.br};">${t}</span>`;};
const planpill=p=>{const c=PC[p]||PC['อยู่ต่อ'];const l=PLANS.find(x=>x.v===p)?.l||p;return pill(l,c.bg,c.tx,c.br);};
const dxpill=dx=>{const c=DXC(dx)||{bg:'#e8eef6',tx:'#1a3a6a',br:'#b8cce0'};return pill(dx,c.bg,c.tx,c.br);};

// ════════════════════════════════════════
// DEPT
// ════════════════════════════════════════
function syncDeptFromSelect(){
  const sel=document.getElementById('dept-sel');
  if(sel)dept=sel.value;
}
function isAllView(){syncDeptFromSelect();return dept==='ALL';}
function bedDept(b){return b._dept||b.dept;}
function deptPill(d){const c={CCU:'ccu',NCU:'ncu',ICU:'icu'}[d]||'ccu';return`<span class="dept-pill ${c}">${d}</span>`;}
function statsForDept(beds,d){
  const sub=beds.filter(b=>bedDept(b)===d);
  const occ=sub.filter(b=>b.dx?.length||b.plan==='รอรับใหม่').length;
  return{occ,total:DEPTS[d].beds,dc:sub.filter(b=>['D/C','plan D/C'].includes(b.plan)).length,
    ward:sub.filter(b=>b.plan?.includes('ย้าย')&&b.plan?.includes('รอ')).length,
    got:sub.filter(b=>b.plan?.includes('ย้าย')&&b.plan?.includes('ได้')).length,
    ref:sub.filter(b=>b.plan==='refer').length};
}
function changeDept(){
  syncDeptFromSelect();
  updateAccessUI();
  if(isAllView()){
    document.getElementById('dtitle').textContent='รวม 3 แผนก DASHBOARD';
    document.getElementById('dfull').textContent='CCU · NCU · ICU — ภาพรวมทุกเตียง';
  }else{
    editDept=dept;
    document.getElementById('dtitle').textContent=dept+' DASHBOARD';
    document.getElementById('dfull').textContent=DEPTS[dept].full;
  }
  updateAccessUI();
  const resetBtn=document.querySelector('.breset');
  if(resetBtn)resetBtn.style.display=isAllView()?'none':'';
  renderLegend();renderTable();renderStaff();
}
function renderLegend(){
  const types=isAllView()?['CCU','IMCCU','NCU','IMNCU','ICU','IMCU','ฝากนอน']:DEPTS[dept].types;
  document.getElementById('tleg').innerHTML=types.map(t=>tpill(t)).join('');
}
function updateTableHead(){
  const all=isAllView();
  document.getElementById('tbl-cols').innerHTML=all
    ?'<col style="width:52px"><col style="width:72px"><col style="width:12%"><col style="width:17%"><col style="width:13%"><col style="width:13%"><col style="width:12%"><col>'
    :'<col style="width:78px"><col style="width:13%"><col style="width:18%"><col style="width:14%"><col style="width:14%"><col style="width:13%"><col>';
  document.getElementById('tbl-head').innerHTML=all
    ?'<th>แผนก</th><th>เตียง/ห้อง</th><th>ผู้ป่วย</th><th>Dx.</th><th>Master</th><th>Consult</th><th>Plan</th><th>Checklist</th>'
    :'<th>เตียง/ห้อง</th><th>ผู้ป่วย</th><th>Dx.</th><th>Master</th><th>Consult</th><th>Plan</th><th>Checklist</th>';
}

// ════════════════════════════════════════
// STAFF
// ════════════════════════════════════════
function toggleStaff(){staffExp=!staffExp;document.getElementById('sstrip').style.display=staffExp?'none':'flex';document.getElementById('sexp').style.display=staffExp?'block':'none';if(isAllView())renderStaff();}
function renderStaff(){
  syncDeptFromSelect();
  if(isAllView()){
    const depts=['CCU','NCU','ICU'];
    if(staffExp){
      document.getElementById('se-inc').textContent=depts.map(d=>`${d}: ${(wards[d]||{}).inCharge||'—'}`).join(' · ');
      document.getElementById('se-tl').textContent=depts.map(d=>`${d}: ${(wards[d]||{}).teamLead||'—'}`).join(' · ');
      document.getElementById('se-cb').textContent=depts.map(d=>`${d}: ${(wards[d]||{}).codeBlue||'—'}`).join(' · ');
      document.getElementById('se-dr').textContent=depts.map(d=>`${d}: ${(wards[d]||{}).doctorNight||'—'}`).join(' · ');
      document.getElementById('se-rn').innerHTML=depts.map(d=>{
        const w=wards[d]||{};const sc=stCfg[d]||{};
        const rns=w.shiftRN?.length?w.shiftRN:(sc.RN||[]);
        return`<div style="margin-bottom:5px;"><span style="font-size:10px;font-weight:700;color:var(--blue);">${d}</span> ${rns.length?rns.map(n=>`<span class="ch rn">${n}</span>`).join(''):'<span style="color:var(--txm);">—</span>'}</div>`;
      }).join('');
      document.getElementById('se-pn').innerHTML=depts.map(d=>{
        const w=wards[d]||{};const sc=stCfg[d]||{};
        const pns=w.shiftPN?.length?w.shiftPN:(sc.PN||[]);
        return`<div style="margin-bottom:5px;"><span style="font-size:10px;font-weight:700;color:var(--ambl);">${d}</span> ${pns.length?pns.map(n=>`<span class="ch pn">${n}</span>`).join(''):'<span style="color:var(--txm);">—</span>'}</div>`;
      }).join('');
    }else{
      const parts=depts.map(d=>{
        const w=wards[d]||{};
        const inc=w.inCharge||'—';
        return`<span class="ch" style="border-color:var(--bdr);color:var(--tx);">${d}: <b style="color:#0e8060;">${inc}</b></span>`;
      });
      document.getElementById('s-inc').textContent='รวม 3 แผนก';
      document.getElementById('s-tl').textContent='▼ ขยาย';
      document.getElementById('s-cb').textContent='';
      document.getElementById('s-dr').textContent='';
      document.getElementById('se-rn').innerHTML=parts.join('');
      document.getElementById('se-pn').innerHTML='<span style="font-size:11px;color:var(--txm);">กด ▼ เพื่อดู RN/PN แต่ละแผนก — แก้ไขให้เลือกแผนกก่อน</span>';
    }
    return;
  }
  const w=wards[dept]||{};const sc=stCfg[dept]||{};
  const rns=w.shiftRN?.length?w.shiftRN:(sc.RN||[]);
  const pns=w.shiftPN?.length?w.shiftPN:(sc.PN||[]);
  ['inc','tl','cb','dr'].forEach((k,i)=>{const v=['inCharge','teamLead','codeBlue','doctorNight'][i];['s-','se-'].forEach(p=>{const el=document.getElementById(p+k);if(el)el.textContent=w[v]||'—';});});
  const seRn=document.getElementById('se-rn');if(seRn)seRn.innerHTML=rns.map(n=>`<span class="ch rn">${n}</span>`).join('');
  const sePn=document.getElementById('se-pn');if(sePn)sePn.innerHTML=pns.map(n=>`<span class="ch pn">${n}</span>`).join('');
  const all=[...(sc.RN||[]),...(sc.PN||[])];
  const rnDl=document.getElementById('rn-dl');if(rnDl)rnDl.innerHTML=all.map(n=>`<option value="${n}">`).join('');
  const pnDl=document.getElementById('pn-dl');if(pnDl)pnDl.innerHTML=(sc.PN||[]).map(n=>`<option value="${n}">`).join('');
}
function openStaff(){
  if(isAllView()){toast('เลือกแผนก CCU / NCU / ICU ก่อนแก้ไขบุคลากรเวร','#1a6fcc');return;}
  if(!requireMetaWrite())return;
  const w=wards[dept]||{};document.getElementById('sdlbl').textContent=dept;document.getElementById('w-inc').value=w.inCharge||'';document.getElementById('w-tl').value=w.teamLead||'';document.getElementById('w-cb').value=w.codeBlue||'';document.getElementById('w-dr').value=w.doctorNight||'';editSRN=[...(w.shiftRN||[])];editSPN=[...(w.shiftPN||[])];renderST();document.getElementById('staff-modal').classList.add('open');
}
function closeStaff(){document.getElementById('staff-modal').classList.remove('open');}
function addSM(role){
  const id=role==='RN'?'w-ri':'w-pi';
  const v=document.getElementById(id).value.trim();
  if(!v)return;
  if(role==='RN'&&!editSRN.includes(v))editSRN.push(v);
  if(role==='PN'&&!editSPN.includes(v))editSPN.push(v);
  document.getElementById(id).value='';
  renderST();
}
function remSM(role,n){
  if(role==='RN') editSRN=editSRN.filter(x=>x!==n);
  else editSPN=editSPN.filter(x=>x!==n);
  renderST();
}
function renderST(){
  const srnEl=document.getElementById('srn-t');
  const spnEl=document.getElementById('spn-t');
  if(srnEl){
    srnEl.innerHTML=editSRN.length
      ? editSRN.map(n=>`<span class="stag rntag">${n}<button type="button" class="stagx" data-role="RN" data-name="${n.replace(/"/g,'&quot;')}">✕</button></span>`).join('')
      : '<span style="font-size:11px;color:var(--txm);">ยังไม่มี RN</span>';
    srnEl.querySelectorAll('.stagx').forEach(btn=>{
      btn.onclick=function(){remSM(this.dataset.role,this.dataset.name);};
    });
  }
  if(spnEl){
    spnEl.innerHTML=editSPN.length
      ? editSPN.map(n=>`<span class="stag pntag">${n}<button type="button" class="stagx" data-role="PN" data-name="${n.replace(/"/g,'&quot;')}">✕</button></span>`).join('')
      : '<span style="font-size:11px;color:var(--txm);">ยังไม่มี PN</span>';
    spnEl.querySelectorAll('.stagx').forEach(btn=>{
      btn.onclick=function(){remSM(this.dataset.role,this.dataset.name);};
    });
  }
}
function saveStaff(){
  if(!requireMetaWrite())return;
  wards[dept]={inCharge:document.getElementById('w-inc').value,teamLead:document.getElementById('w-tl').value,codeBlue:document.getElementById('w-cb').value,doctorNight:document.getElementById('w-dr').value,shiftRN:[...editSRN],shiftPN:[...editSPN]};
  persist();renderStaff();closeStaff();
}

// ════════════════════════════════════════
// TABLE
// ════════════════════════════════════════
function toggleEmpty(){showEmpty=!showEmpty;document.getElementById('tbtn').textContent=showEmpty?'ซ่อนว่าง':'แสดงว่าง';renderTable();}
function getBedsForView(){
  syncDeptFromSelect();
  if(isAllView()){
    const beds=[];
    ALL_DEPTS.forEach(d=>Object.values(allBeds[d]||{}).forEach(b=>beds.push({...b,_dept:d})));
    return beds;
  }
  return Object.values(allBeds[dept]||{}).sort((a,b)=>parseInt(a.id)-parseInt(b.id));
}
function totalBedCount(){
  return isAllView()?ALL_DEPTS.reduce((s,d)=>s+DEPTS[d].beds,0):DEPTS[dept].beds;
}
function renderTable(){
  syncDeptFromSelect();
  updateTableHead();
  const all=isAllView();
  const beds=getBedsForView();
  const vis=showEmpty?beds:beds.filter(b=>b.dx?.length||b.plan==='รอรับใหม่');
  let occ=0,dc=0,ward=0,got=0,ref=0;
  beds.forEach(b=>{if(b.dx?.length||b.plan==='รอรับใหม่')occ++;if(['D/C','plan D/C'].includes(b.plan))dc++;if(b.plan?.includes('ย้าย')&&b.plan?.includes('รอ'))ward++;if(b.plan?.includes('ย้าย')&&b.plan?.includes('ได้'))got++;if(b.plan==='refer')ref++;});
  const occLbl=document.getElementById('st-occ-lbl');
  const deptWrap=document.getElementById('st-dept-wrap');
  const deptBrk=document.getElementById('st-dept-brk');
  if(all){
    if(occLbl)occLbl.textContent='ผู้ป่วยรวม';
    document.getElementById('st-occ').textContent=`${occ}/${totalBedCount()}`;
    if(deptWrap)deptWrap.style.display='flex';
    if(deptBrk)deptBrk.innerHTML=ALL_DEPTS.map(d=>{
      const s=statsForDept(beds,d);
      return`${deptPill(d)} ${s.occ}/${s.total}`;
    }).join(' ');
  }else{
    if(occLbl)occLbl.textContent='ผู้ป่วย';
    document.getElementById('st-occ').textContent=`${occ}/${totalBedCount()}`;
    if(deptWrap)deptWrap.style.display='none';
  }
  document.getElementById('st-dc').textContent=dc;document.getElementById('st-ward').textContent=ward;document.getElementById('st-got').textContent=got;document.getElementById('st-ref').textContent=ref;
  const tbody=document.getElementById('tbody');
  const cols=all?8:7;
  if(all){
    let html='';
    ALL_DEPTS.forEach(d=>{
      const sub=beds.filter(x=>bedDept(x)===d).sort((a,b)=>parseInt(a.id)-parseInt(b.id));
      const subVis=showEmpty?sub:sub.filter(b=>b.dx?.length||b.plan==='รอรับใหม่');
      const s=statsForDept(beds,d);
      html+=`<tr class="dept-sec"><td colspan="${cols}">${deptPill(d)} ${DEPTS[d].full} — ผู้ป่วย ${s.occ}/${s.total} เตียง · D/C ${s.dc} · รอย้าย ${s.ward} · ได้ห้อง ${s.got} · Refer ${s.ref}</td></tr>`;
      if(subVis.length)html+=subVis.map(b=>renderRow(b,true)).join('');
      else if(!showEmpty)html+=`<tr><td colspan="${cols}" style="text-align:center;padding:14px;color:var(--txm);font-size:12px;">ไม่มีผู้ป่วยใน ${d}</td></tr>`;
      else html+=sub.map(b=>renderRow(b,true)).join('');
    });
    tbody.innerHTML=html;
    return;
  }
  if(!vis.length){tbody.innerHTML=`<tr><td colspan="${cols}" style="text-align:center;padding:40px;color:var(--txm);">ไม่มีผู้ป่วยในขณะนี้</td></tr>`;return;}
  tbody.innerHTML=vis.map(b=>renderRow(b,false)).join('');
}
function renderRow(b,showDept){
  const occ=b.dx?.length||b.plan==='รอรับใหม่';
  const cl=CL[b.plan]||[];const checks=b.checks||[];
  const isDC=['D/C','plan D/C','refer'].includes(b.plan);
  const chkN=cl.filter(i=>checks.includes(i.id)).length;
  const complete=isDC&&cl.length?cl.every(i=>checks.includes(i.id)):null;
  const pct=cl.length?Math.round(chkN/cl.length*100):0;
  const pc=complete===false?'#c0392b':complete?'#0e8060':'#1a6fcc';
  const showCl=isDC?cl.filter(i=>!checks.includes(i.id)):cl.filter(i=>checks.includes(i.id));
  const dc=isDC?{bg:'#fce8e8',tx:'#8a1a1a',br:'#d07070'}:b.plan?.includes('ย้าย')?{bg:'#d8eaf8',tx:'#1a3a6a',br:'#7ab0d8'}:{bg:'#d0eedc',tx:'#0a5030',br:'#6ec8a0'};
  const clHtml=cl.length?`<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;"><div style="height:3px;background:#d8e4ef;border-radius:3px;width:70px;"><div style="height:3px;width:${pct}%;background:${pc};border-radius:3px;"></div></div><span style="font-size:10px;color:${pc};font-family:monospace;">${chkN}/${cl.length}</span>${complete===false?'<span style="font-size:11px;color:#c0392b;animation:bp 1.5s infinite;">!</span>':''}${complete===true?'<span style="font-size:10px;color:#0e8060;font-weight:700;">✓</span>':''}</div><div class="chkmini">${showCl.slice(0,4).map(i=>`<span class="chkdot" style="background:${dc.bg};color:${dc.tx};border-color:${dc.br};">${isDC?'○ ':'✓ '}${i.l}</span>`).join('')}${showCl.length>4?`<span style="font-size:10px;color:var(--txd);">+${showCl.length-4}</span>`:''}</div>`:'';
  const md=doctors.find(x=>x.name===b.master);
  const mh=b.master?`${b.master}${md?` <span style="font-size:10px;color:var(--txd);">(${md.spec})</span>`:''}`:'';
  const ch=(b.consult||[]).map(c=>{const d=doctors.find(x=>x.name===c);return`<div style="font-size:11px;color:var(--txd);">${c}${d?` (${d.spec})`:''}</div>`;}).join('');
  let planX='';if(b.plan==='ย้ายward รอห้อง'&&b.transferRoomType)planX=`<div style="font-size:10px;color:var(--ambl);margin-top:2px;">${b.transferRoomType}</div>`;if(b.plan==='ย้าย ward ได้ห้องแล้ว'&&(b.transferRoom||b.transferWard))planX=`<div style="font-size:10px;color:var(--blue);margin-top:2px;">Ward ${b.transferWard} ห้อง ${b.transferRoom}${b.transferBed?' เตียง '+b.transferBed:''}</div>`;
  const rb=complete===false?'#f0b8b8':'#d8e4ef';
  const gb=b.gender?`<span class="${b.gender==='ชาย'?'gbm':'gbf'}">${b.gender==='ชาย'?'ช':'ญ'}</span> `:'';
  const dxHtml=(b.dx||[]).length?`<div class="dxrow">${(b.dx||[]).map(d=>dxpill(d)).join('')}</div>`:b.plan==='รอรับใหม่'?pill('รอรับใหม่','#f8e0e8','#8a1a3a','#d87aaa'):`<span style="color:var(--txm);font-size:11px;">—</span>`;
  const d=bedDept(b);
  const openFn=showDept?`openBed('${d}','${b.id}')`:`openBed('${b.id}')`;
  const deptCell=showDept?`<td style="padding:7px 8px;text-align:center;vertical-align:middle;">${deptPill(d)}</td>`:'';
  return`<tr onclick="${openFn}" style="border-bottom:1px solid ${rb};">
    ${deptCell}
    <td style="padding:7px 8px;"><div class="bedc" style="background:${occ?'#1a6fcc':'#d8e8f4'};color:${occ?'#fff':'#8aabcc'};">${b.id}</div>${occ&&b.deptType?`<div style="text-align:center;margin-top:2px;">${tpill(b.deptType)}</div>`:''}</td>
    <td style="padding:7px 8px;">${occ?`${gb}${b.classLevel?`<span style="font-size:11px;color:var(--txd);">Class ${b.classLevel}</span>`:''}${b.age?`<span style="font-size:11px;color:var(--txd);${b.classLevel?'margin-left:4px;':''}">${b.age} ปี</span>`:''}${b.los?`<span style="font-size:10px;color:var(--txd);margin-left:4px;">LOS ${b.los}d</span>`:''}<div style="font-size:10px;color:var(--txm);">${b.admitDate?'Admit '+b.admitDate:''}</div>${b.patientCode?`<span style="background:var(--purd);color:var(--pur);border:1px solid var(--pur);border-radius:999px;padding:1px 5px;font-size:10px;">${b.patientCode}</span>`:''}${b.rn?`<div style="font-size:10px;color:#0e8060;margin-top:2px;">RN: ${b.rn}</div>`:''}`:''}
    </td>
    <td style="padding:7px 8px;">${dxHtml}</td>
    <td style="padding:7px 8px;font-size:12px;">${mh||`<span style="color:var(--txm);">—</span>`}</td>
    <td style="padding:7px 8px;">${ch||`<span style="color:var(--txm);">—</span>`}</td>
    <td style="padding:7px 8px;">${planpill(b.plan||'อยู่ต่อ')}${planX}</td>
    <td style="padding:7px 8px;">${clHtml}</td>
  </tr>`;
}

// ════════════════════════════════════════
// BED MODAL
// ════════════════════════════════════════
function renderBedNav(){
  const nav=document.getElementById('bed-nav');
  const body=document.getElementById('bed-body');
  if(!nav||!body)return;
  const sections=[...body.querySelectorAll('.bed-sec')].filter(sec=>sec.offsetParent!==null);
  nav.innerHTML=sections.map((sec,i)=>`<button type="button" class="${i===0?'on':''}" onclick="goBedSec('${sec.id}',this)">${sec.dataset.nav}</button>`).join('');
}
function goBedSec(id,btn){
  const sec=document.getElementById(id);
  if(sec)sec.scrollIntoView({behavior:'smooth',block:'start'});
  document.querySelectorAll('#bed-nav button').forEach(b=>b.classList.remove('on'));
  if(btn)btn.classList.add('on');
}
function normalizeAdmitDate(v){
  const raw=(v||'').trim();
  if(!raw)return '';
  const m=raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if(!m)return null;
  const d=Number(m[1]),mo=Number(m[2]);let y=Number(m[3]);
  if(d<1||d>31||mo<1||mo>12)return null;
  if(y<100)y+=2500;
  return `${String(d).padStart(2,'0')}/${String(mo).padStart(2,'0')}/${y}`;
}
function openBed(d,id){
  syncDeptFromSelect();
  if(id===undefined){id=d;d=isAllView()?(editDept||'CCU'):dept;}
  editDept=d;editId=id;
  const b=allBeds[editDept][id]||emptyBed(id,editDept);
  editChecks=[...(b.checks||[])];editConsults=[...(b.consult||[])];editDx=[...(b.dx||[])];
  const occ=b.dx?.length||b.plan==='รอรับใหม่';
  document.getElementById('m-title').textContent=`เตียง ${id} — ${editDept}`;
  document.getElementById('m-tb').innerHTML=b.deptType?tpill(b.deptType):'';
  document.getElementById('swbtn').style.display=occ?'inline-block':'none';
  buildTypeBtns(b.deptType||DEPTS[editDept].types[0]);
  document.getElementById('m-gen').value=b.gender||'';
  document.getElementById('m-class').value=b.classLevel||'';
  document.getElementById('m-age').value=b.age||'';
  document.getElementById('m-code').value=b.patientCode||'';
  document.getElementById('m-admit').value=b.admitDate||'';
  document.getElementById('m-admit-err').style.display='none';
  document.getElementById('m-los').value=b.los||'';
  document.getElementById('m-or').value=b.orNote||'';
  document.getElementById('m-cc').value=b.ccNote||'';
  document.getElementById('m-present').value=b.presentNote||'';
  renderDxTags();
  document.getElementById('m-mi').value=b.master||'';
  document.getElementById('m-mv').value=b.master||'';
  renderMasterTag(b.master||'');
  renderConsTags();
  document.getElementById('m-rn').value=b.rn||'';
  buildPlanBtns(b.plan||'อยู่ต่อ');
  updatePlanExtra(b);buildChk(b.plan||'อยู่ต่อ');
  const ownDeptOk=canWriteOwnDept(editDept);
  const saveBtn=document.getElementById('save-bed-btn');
  if(saveBtn){
    saveBtn.disabled=!ownDeptOk;
    saveBtn.style.opacity=ownDeptOk?1:.45;
    saveBtn.style.cursor=ownDeptOk?'pointer':'not-allowed';
    saveBtn.title=ownDeptOk?'':'อ่านได้ทุกแผนก แต่แก้ไขได้เฉพาะแผนกของตัวเอง';
  }
  const clearBtn=document.getElementById('clear-bed-btn');
  if(clearBtn){
    clearBtn.disabled=!ownDeptOk;
    clearBtn.style.opacity=ownDeptOk?1:.45;
    clearBtn.style.cursor=ownDeptOk?'pointer':'not-allowed';
    clearBtn.title=ownDeptOk?'ล้างเตียงนี้เป็นว่าง':'อ่านได้ทุกแผนก แต่แก้ไขได้เฉพาะแผนกของตัวเอง';
  }
  const swapBtn=document.getElementById('swbtn');
  if(swapBtn){
    swapBtn.style.display=ownDeptOk&&occ?'inline-block':'none';
    swapBtn.disabled=!ownDeptOk;
    swapBtn.title=ownDeptOk?'':'อ่านได้ทุกแผนก แต่แก้ไขได้เฉพาะแผนกของตัวเอง';
  }
  document.getElementById('bed-modal').classList.add('open');
  document.getElementById('bed-body').scrollTop=0;
  setTimeout(renderBedNav,20);
}
function closeBed(){document.getElementById('bed-modal').classList.remove('open');}
function clearBedForm(){editChecks=[];editConsults=[];editDx=[];openBed(editId);}
function clearBedNow(){
  if(!confirm(`ล้างเตียง ${editId} เป็นเตียงว่าง?`))return;
  if(!requireDeptWrite(editDept))return;
  const kt=allBeds[editDept][editId]?.deptType||DEPTS[editDept].types[0];
  allBeds[editDept][editId]=emptyBed(editId,editDept);
  allBeds[editDept][editId].deptType=kt;
  persist();renderTable();closeBed();
  toast(`🗑 ล้างเตียง ${editId} เรียบร้อย`,'#0e8060');
}
function buildTypeBtns(sel){document.getElementById('type-btns').innerHTML=DEPTS[editDept].types.map(t=>{const s=sel===t;const c=TC[t]||TC['ฝากนอน'];return`<button onclick="selType('${t}')" style="padding:5px 13px;border-radius:var(--r);border:1px solid ${s?c.br:'var(--bdr)'};background:${s?c.bg:'var(--surf2)'};color:${s?c.tx:'var(--txd)'};font-size:13px;cursor:pointer;font-weight:${s?600:400};font-family:inherit;">${t}</button>`;}).join('');}
function selType(t){allBeds[editDept][editId]=allBeds[editDept][editId]||emptyBed(editId,editDept);allBeds[editDept][editId].deptType=t;buildTypeBtns(t);document.getElementById('m-tb').innerHTML=tpill(t);}
function addDxP(){const v=document.getElementById('m-dxp').value;if(v&&!editDx.includes(v)){editDx.push(v);renderDxTags();}document.getElementById('m-dxp').value='';}
function addDxC(){const v=document.getElementById('m-dxc').value.trim();if(v&&!editDx.includes(v)){editDx.push(v);renderDxTags();}document.getElementById('m-dxc').value='';}
function remDx(d){editDx=editDx.filter(x=>x!==d);renderDxTags();}
function renderDxTags(){document.getElementById('dx-tags').innerHTML=editDx.map(d=>{const c=DXC(d)||{bg:'#e8eef6',tx:'#1a3a6a',br:'#b8cce0'};return`<span class="tagpill" style="background:${c.bg};color:${c.tx};border-color:${c.br};">${d}<span class="tagx" onclick="remDx(${JSON.stringify(d)})">×</span></span>`;}).join('');}
function buildPlanBtns(sel){document.getElementById('plan-btns').innerHTML=PLANS.map(p=>{const s=sel===p.v;const c=PC[p.v]||PC['อยู่ต่อ'];return`<button class="plbtn" onclick="selPlan('${p.v}')" style="${s?`border-color:${c.br};background:${c.bg};color:${c.tx};font-weight:600;`:''}">${p.l}</button>`;}).join('');document.getElementById('m-plan').value=sel;buildChk(sel);}
function selPlan(p){editChecks=[];buildPlanBtns(p);updatePlanExtra({plan:p});}
function updatePlanExtra(b){const r=b.plan==='ย้ายward รอห้อง',g=b.plan==='ย้าย ward ได้ห้องแล้ว';document.getElementById('box-rt').style.display=r?'block':'none';document.getElementById('box-dest').style.display=g?'block':'none';if(r)document.getElementById('m-rtype').value=b.transferRoomType||'';if(g){document.getElementById('m-tw').value=b.transferWard||'';buildRooms(b.transferWard||'');setTimeout(()=>{document.getElementById('m-tr').value=b.transferRoom||'';document.getElementById('m-tbed').value=b.transferBed||'';},30);}}
function buildRooms(w){const rooms=RWD[w]||[];document.getElementById('m-tr').innerHTML='<option value="">— ห้อง —</option>'+rooms.map(r=>`<option>${r}</option>`).join('');}
function buildChk(plan){const cl=CL[plan]||[];const card=document.getElementById('chk-card');if(!cl.length){card.style.display='none';renderBedNav();return;}card.style.display='block';document.getElementById('chk-title').textContent='Checklist — '+(PLANS.find(p=>p.v===plan)?.l||plan);document.getElementById('chk-grid').innerHTML=cl.map(item=>{const on=editChecks.includes(item.id);return`<label class="cklbl ${on?'on':''}" id="cl-${item.id}" onclick="togChk('${item.id}')"><span class="ckbox" id="cb-${item.id}">${on?'✓':''}</span>${item.l}</label>`;}).join('');updChkDone(plan);renderBedNav();}
function togChk(id){if(editChecks.includes(id))editChecks=editChecks.filter(c=>c!==id);else editChecks.push(id);const l=document.getElementById('cl-'+id);const bx=document.getElementById('cb-'+id);if(l&&bx){if(editChecks.includes(id)){l.classList.add('on');bx.textContent='✓';}else{l.classList.remove('on');bx.textContent='';}}updChkDone(document.getElementById('m-plan').value);}
function updChkDone(plan){const isDC=['D/C','refer'].includes(plan);const cl=CL[plan]||[];const all=isDC&&cl.length&&cl.every(i=>editChecks.includes(i.id));document.getElementById('chk-done').style.display=all?'block':'none';}
function filterDr(inpId,dropId,mode){
  const q=document.getElementById(inpId).value.trim();
  const drop=document.getElementById(dropId);
  if(!q){drop.classList.remove('open');return;}
  const ql=q.toLowerCase();
  const flt=doctors.filter(d=>(d.name.toLowerCase().includes(ql)||d.spec?.toLowerCase().includes(ql))&&!(mode==='consult'&&editConsults.includes(d.name)));
  const exactExists=doctors.some(d=>d.name===q);
  let html='';
  if(flt.length){
    html+=flt.map(d=>{
      const safe=d.name.replace(/'/g,"\\'");
      return`<div class="sdi" data-action="${mode==='consult'?'cons':'master'}" data-name="${d.name.replace(/"/g,'&quot;')}">${d.name}<small style="color:var(--txd);margin-left:5px;">(${d.spec})</small></div>`;
    }).join('');
  }
  // ถ้าพิมพ์ชื่อที่ยังไม่มีในรายชื่อ → แสดงปุ่มเพิ่มใหม่
  if(!exactExists && q.length>=2){
    html+=`<div class="sdi sdi-add" data-action="${mode==='consult'?'cons-new':'master-new'}" data-name="${q.replace(/"/g,'&quot;')}">➕ เพิ่ม "<b>${q}</b>" เป็นแพทย์ใหม่</div>`;
  } else if(!flt.length && exactExists){
    html+=`<div class="sdi" style="color:var(--txd);">มีในรายชื่อแล้ว</div>`;
  }
  if(!html) html=`<div class="sdi" style="color:var(--txd);">พิมพ์ชื่อเพื่อค้นหาหรือเพิ่มใหม่</div>`;
  drop.innerHTML=html;
  drop.classList.add('open');
  drop.querySelectorAll('.sdi[data-action]').forEach(el=>{
    el.onclick=function(){
      const act=this.dataset.action, nm=this.dataset.name;
      if(act==='master') pickM(nm);
      else if(act==='cons') addCons(nm);
      else if(act==='master-new') addNewDrAndPickM(nm);
      else if(act==='cons-new') addNewDrAndCons(nm);
    };
  });
}
function addNewDrAndPickM(name){
  if(!requireMetaWrite())return;
  // เพิ่มแพทย์ใหม่ spec=Med ก่อน แล้ว pick
  if(!doctors.find(d=>d.name===name)) doctors.push({name,spec:'Med',workType:'Full-Time'});
  saveAll();
  pickM(name);
  toast(`➕ เพิ่มแพทย์ใหม่: ${name}`,'#0e8060');
}
function addNewDrAndCons(name){
  if(!requireMetaWrite())return;
  if(!doctors.find(d=>d.name===name)) doctors.push({name,spec:'Med',workType:'Full-Time'});
  saveAll();
  addCons(name);
  toast(`➕ เพิ่มแพทย์ใหม่: ${name}`,'#0e8060');
}
function pickM(n){
  document.getElementById('m-mi').value=n;
  document.getElementById('m-mv').value=n;
  document.getElementById('m-md').classList.remove('open');
  renderMasterTag(n);
}
function renderMasterTag(n){
  const wrap=document.getElementById('master-tag');
  if(!wrap)return;
  if(!n){wrap.innerHTML='';return;}
  const d=doctors.find(x=>x.name===n);
  wrap.innerHTML=`<span class="tagpill" style="background:var(--blued);color:var(--blue);border-color:var(--blue);">${n}${d?` <small>(${d.spec})</small>`:''}<span class="tagx" onclick="clearMaster()">×</span></span>`;
}
function clearMaster(){
  document.getElementById('m-mi').value='';
  document.getElementById('m-mv').value='';
  renderMasterTag('');
}
function addConsFromInput(){
  // เรียกเมื่อกด Enter หรือปุ่ม + ใน consult input โดยตรง
  const inp=document.getElementById('m-ci');
  const n=inp.value.trim();
  if(!n)return;
  if(!requireMetaWrite())return;
  if(!doctors.find(d=>d.name===n)) doctors.push({name:n,spec:'Med',workType:'Full-Time'}),saveAll(),toast(`➕ เพิ่มแพทย์ใหม่: ${n}`,'#0e8060');
  addCons(n);
}
function addMasterFromInput(){
  const inp=document.getElementById('m-mi');
  const n=inp.value.trim();
  if(!n)return;
  if(!requireMetaWrite())return;
  if(!doctors.find(d=>d.name===n)){doctors.push({name:n,spec:'Med',workType:'Full-Time'});saveAll();toast(`➕ เพิ่มแพทย์ใหม่: ${n}`,'#0e8060');}
  pickM(n);
}
function addCons(n){
  if(!editConsults.includes(n)){editConsults.push(n);renderConsTags();}
  document.getElementById('m-ci').value='';
  document.getElementById('m-cd').classList.remove('open');
}
function remCons(n){editConsults=editConsults.filter(c=>c!==n);renderConsTags();}
function renderConsTags(){
  const wrap=document.getElementById('cons-tags');
  wrap.innerHTML=editConsults.map(c=>{
    const d=doctors.find(x=>x.name===c);
    return`<span class="tagpill">${c}${d?` <small>(${d.spec})</small>`:''}<span class="tagx" data-name="${c.replace(/"/g,'&quot;')}">×</span></span>`;
  }).join('');
  wrap.querySelectorAll('.tagx').forEach(el=>{
    el.onclick=function(){remCons(this.dataset.name);};
  });
}
function dh(id){setTimeout(()=>document.getElementById(id).classList.remove('open'),200);}
function saveBed(){
  if(!requireDeptWrite(editDept))return;
  const plan=document.getElementById('m-plan').value||'อยู่ต่อ';
  const admitEl=document.getElementById('m-admit');
  const admitErr=document.getElementById('m-admit-err');
  const admit=normalizeAdmitDate(admitEl.value);
  if(admit===null){
    admitErr.style.display='block';
    goBedSec('sec-patient',document.querySelector('#bed-nav button:nth-child(2)'));
    admitEl.focus();
    return;
  }
  admitErr.style.display='none';
  admitEl.value=admit;
  const cur=allBeds[editDept][editId]||emptyBed(editId,editDept);
  allBeds[editDept][editId]=sanitizeBedPrivacy({...cur,gender:document.getElementById('m-gen').value,classLevel:document.getElementById('m-class').value,age:document.getElementById('m-age').value,admitDate:admit,los:document.getElementById('m-los').value.trim(),orNote:document.getElementById('m-or').value.trim(),ccNote:document.getElementById('m-cc').value.trim(),presentNote:document.getElementById('m-present').value.trim(),dx:[...editDx],master:document.getElementById('m-mv').value||document.getElementById('m-mi').value,consult:[...editConsults],rn:document.getElementById('m-rn').value,plan,checks:[...editChecks],transferRoomType:document.getElementById('m-rtype').value||'',transferWard:document.getElementById('m-tw').value||'',transferRoom:document.getElementById('m-tr').value||'',transferBed:document.getElementById('m-tbed').value||''});
  persist();renderTable();closeBed();
  if(['D/C','refer'].includes(plan)){const cl=CL[plan]||[];if(cl.length&&cl.every(i=>(allBeds[editDept][editId]?.checks||[]).includes(i.id)))setTimeout(autoClear,600);}
}

// ════════════════════════════════════════
// RESET BEDS
// ════════════════════════════════════════
function confirmResetBeds(){
  if(isAllView()){toast('เลือกแผนก CCU / NCU / ICU ก่อนล้างเตียงทั้งหมด','#c0392b');return;}
  document.getElementById('reset-dept-lbl').textContent=dept;
  document.getElementById('reset-confirm-text').value='';
  updateResetConfirm();
  document.getElementById('reset-modal').classList.add('open');
  setTimeout(()=>document.getElementById('reset-confirm-text').focus(),50);
}
function closeReset(){document.getElementById('reset-modal').classList.remove('open');}
function updateResetConfirm(){
  const ok=(document.getElementById('reset-confirm-text').value||'').trim().toUpperCase()===dept;
  const btn=document.getElementById('reset-ok');
  btn.disabled=!ok;
  btn.style.opacity=ok?1:.45;
}
function doResetBeds(){
  if(!requireDeptWrite(dept))return;
  if((document.getElementById('reset-confirm-text').value||'').trim().toUpperCase()!==dept)return;
  const d=dept;
  Object.keys(allBeds[d]||{}).forEach(id=>{
    const kt=allBeds[d][id]?.deptType||DEPTS[d].types[0];
    allBeds[d][id]=emptyBed(id,d);
    allBeds[d][id].deptType=kt;
  });
  persist();renderTable();closeReset();
  toast(`🗑 ล้างเตียงทั้งหมด ${d} เป็นเตียงว่างแล้ว`,'#c0392b');
}

// ════════════════════════════════════════
// SWAP
// ════════════════════════════════════════
function openSwap(){const b=allBeds[editDept][editId];document.getElementById('sw-src').innerHTML=`<div style="font-size:10px;color:var(--txd);margin-bottom:4px;">ต้นทาง</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;"><span style="font-size:15px;font-weight:700;color:var(--blue);font-family:monospace;">เตียง ${b.id}</span>${tpill(b.deptType||editDept)}<span style="font-size:11px;color:var(--txd);">${editDept}</span>${(b.dx||[]).map(d=>dxpill(d)).join(' ')}</div>`;setSwapMode('swap');document.getElementById('sw-dept').value=editDept;buildSwapBeds();document.getElementById('sw-prev').style.display='none';document.getElementById('swap-modal').classList.add('open');}
function closeSwap(){document.getElementById('swap-modal').classList.remove('open');}
function setSwapMode(m){swapMode=m;['swap','move'].forEach(x=>{const btn=document.getElementById('sw-'+x);btn.style.background=x===m?'var(--purd)':'var(--surf2)';btn.style.color=x===m?'var(--pur)':'var(--txd)';btn.style.borderColor=x===m?'var(--pur)':'var(--bdr)';});buildSwapBeds();}
function buildSwapBeds(){const td=document.getElementById('sw-dept').value;const beds=Object.values(allBeds[td]||{}).sort((a,b)=>parseInt(a.id)-parseInt(b.id));document.getElementById('sw-bed').innerHTML='<option value="">— เตียง —</option>'+beds.filter(b=>!(b.id===editId&&td===editDept)).map(b=>{const occ=b.dx?.length||b.plan==='รอรับใหม่';return`<option value="${b.id}" ${swapMode==='move'&&occ?'disabled':''}>${b.id} [${b.deptType||td}] ${occ?'— '+((b.dx||[])[0]||'รอรับใหม่'):'— ว่าง'}</option>`;}).join('');document.getElementById('sw-bed').onchange=previewSwap;document.getElementById('sw-prev').style.display='none';}
function previewSwap(){const td=document.getElementById('sw-dept').value;const tid=document.getElementById('sw-bed').value;const prev=document.getElementById('sw-prev');if(!tid){prev.style.display='none';return;}const tb=allBeds[td]?.[tid];if(!tb){prev.style.display='none';return;}const tocc=tb.dx?.length||tb.plan==='รอรับใหม่';prev.style.display='block';prev.style.borderColor=swapMode==='move'&&tocc?'var(--red)':tocc?'var(--blue)':'var(--teal)';prev.innerHTML=`<div style="color:var(--txd);font-size:10px;margin-bottom:4px;">ปลายทาง: เตียง ${tb.id} [${tb.deptType||td}] — ${td}</div><div style="color:${swapMode==='move'&&tocc?'#c0392b':tocc?'var(--blue)':'var(--teal)'};">${swapMode==='move'&&tocc?'⚠ มีผู้ป่วย':tocc?`สลับกับ: ${(tb.dx||[])[0]||'รอรับใหม่'}`:'เตียงว่าง'}</div>`;const ok=!(swapMode==='move'&&tocc);document.getElementById('sw-ok').style.opacity=ok?1:.4;document.getElementById('sw-ok').disabled=!ok;}
function doSwap(){
  const td=document.getElementById('sw-dept').value;
  const tid=document.getElementById('sw-bed').value;
  if(!tid)return;
  if(!requireDeptWrite(editDept))return;
  if(!requireDeptWrite(td))return;
  const sb=allBeds[editDept][editId];
  const tb=allBeds[td][tid];
  if(!tb)return;
  if(swapMode==='move'&&(tb.dx?.length||tb.plan==='รอรับใหม่'))return;
  if(swapMode==='swap'){
    const st=sb.deptType,tt=tb.deptType;
    allBeds[editDept][editId]={...tb,id:editId,dept:editDept,deptType:st};
    allBeds[td][tid]={...sb,id:tid,dept:td,deptType:tt};
  }else{
    allBeds[td][tid]={...sb,id:tid,dept:td,deptType:tb.deptType};
    allBeds[editDept][editId]=emptyBed(editId,editDept);
  }
  persist();renderTable();closeSwap();closeBed();
}

// ════════════════════════════════════════
// AUTO CLEAR
// ════════════════════════════════════════
function autoClear(){
  const CP=['D/C','refer'];let n=0;
  const targetDepts=currentUserRole==='admin'?Object.keys(DEPTS):[currentUserDept];
  targetDepts.forEach(d=>{
    Object.values(allBeds[d]||{}).forEach(b=>{
      if(!CP.includes(b.plan))return;
      const cl=CL[b.plan]||[];if(!cl.length)return;
      if(cl.every(item=>(b.checks||[]).includes(item.id))){
        const kt=b.deptType;allBeds[d][b.id]=emptyBed(b.id,d);allBeds[d][b.id].deptType=kt;n++;
      }
    });
  });
  if(n>0){persist();renderTable();toast(`🧹 ล้างเตียง ${n} เตียง (D/C / Refer checklist ครบ)`,'#0e8060');}
  return n;
}
function manualClear(){if(!autoClear())toast('ไม่มีเตียงที่ checklist D/C / Refer ครบทุกข้อ','#1a6fcc');}
function doRefresh(){load();renderTable();renderStaff();toast('🔄 รีเฟรชข้อมูลแล้ว','#1a6fcc');}
function modalIsOpen(){return !!document.querySelector('.ov.open');}
function renderRefreshClock(){
  const el=document.getElementById('cdt');
  if(!el)return;
  const m=Math.floor(autoRefreshRemaining/60),s=autoRefreshRemaining%60;
  el.textContent=autoRefreshPaused||modalIsOpen()?`⏸ ${m}:${String(s).padStart(2,'0')}`:`🔄 ${m}:${String(s).padStart(2,'0')}`;
}
function toggleAutoRefresh(){
  autoRefreshPaused=!autoRefreshPaused;
  const btn=document.getElementById('pause-refresh-btn');
  if(btn)btn.textContent=autoRefreshPaused?'▶ รีเฟรชต่อ':'⏸ พักรีเฟรช';
  renderRefreshClock();
  toast(autoRefreshPaused?'⏸ พักรีเฟรชอัตโนมัติแล้ว':'▶ เปิดรีเฟรชอัตโนมัติแล้ว','#1a6fcc');
}
function startAutoRefresh(){
  if(autoRefreshTimer)return;
  autoRefreshRemaining=300;
  renderRefreshClock();
  autoRefreshTimer=setInterval(()=>{
    if(autoRefreshPaused||modalIsOpen()){renderRefreshClock();return;}
    autoRefreshRemaining--;
    if(autoRefreshRemaining<=0){
      load();renderTable();renderStaff();autoClear();
      autoRefreshRemaining=300;
      toast('🔄 รีเฟรชอัตโนมัติ','#1a6fcc');
    }
    renderRefreshClock();
  },1000);
}

// ════════════════════════════════════════
// TOAST
// ════════════════════════════════════════
function toast(msg,bg){const n=document.createElement('div');n.textContent=msg;n.style.cssText=`position:fixed;bottom:18px;right:18px;background:${bg||'#1a6fcc'};color:#fff;padding:9px 16px;border-radius:var(--r);font-size:13px;z-index:9999;animation:fi .3s ease;box-shadow:0 4px 16px rgba(0,0,0,.2);font-family:'Sarabun',sans-serif;max-width:300px;`;document.body.appendChild(n);setTimeout(()=>{n.style.opacity='0';n.style.transition='opacity .4s';setTimeout(()=>n.remove(),400);},3000);}

// ════════════════════════════════════════
// ADMIN NAVIGATION
// ════════════════════════════════════════
function gotoPage(p,el){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.ntab').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  if(el)el.classList.add('active');
  if(p==='doctors'){renderSpecTabs();renderDrList();}
  if(p==='staff'){renderAdminStaffList();}
}

// ════════════════════════════════════════
// PARSE MODE
// ════════════════════════════════════════
function setParseMode(m){
  curMode=m;
  const off=document.getElementById('mo-off'),ai=document.getElementById('mo-ai'),d=document.getElementById('mdesc');
  if(m==='offline'){
    off.style.cssText='padding:5px 11px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:500;border:1px solid var(--teal);background:var(--teald);color:var(--teal);';
    ai.style.cssText='padding:5px 11px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:500;border:1px solid var(--bdr);background:var(--surf);color:var(--txd);';
    d.textContent='⚡ อ่านไฟล์ในเครื่อง ไม่ต้องเน็ต';d.style.color='var(--teal)';
  }else{
    ai.style.cssText='padding:5px 11px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:500;border:1px solid var(--blue);background:var(--blued);color:var(--blue);';
    off.style.cssText='padding:5px 11px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:500;border:1px solid var(--bdr);background:var(--surf);color:var(--txd);';
    d.textContent='🌐 Claude AI — ต้องการเน็ต';d.style.color='var(--blue)';
  }
}
function onDrag(e,on){e.preventDefault();document.getElementById('uzone').classList.toggle('drag',on);}
function onDrop(e){e.preventDefault();document.getElementById('uzone').classList.remove('drag');const f=e.dataTransfer.files[0];if(f)handleFile(f);}
async function handleFile(file){
  if(!file)return;
  const ext=file.name.toLowerCase().split('.').pop();
  if(!['pdf','docx','txt','jpg','jpeg','png'].includes(ext)){alert('รองรับ PDF · DOCX · TXT · JPG · PNG เท่านั้น');return;}
  showProgress(true,'กำลังอ่านไฟล์...');
  document.getElementById('res-wrap').style.display='none';
  document.getElementById('rawbox').style.display='none';
  document.getElementById('imgprev').style.display='none';
  try{
    if(['jpg','jpeg','png'].includes(ext))await fileImage(file,ext);
    else if(ext==='txt')await fileTxt(file);
    else if(ext==='docx')await fileDocx(file);
    else if(curMode==='offline')await filePdfOff(file);
    else await filePdfAI(file);
  }catch(e){showProgress(true,'เกิดข้อผิดพลาด: '+e.message,'var(--red)');console.error(e);}
  showProgress(false);
}
function showProgress(show,msg,clr){const w=document.getElementById('pwrap');w.style.display=show?'flex':'none';if(msg){const el=document.getElementById('pmsg');el.textContent=msg;el.style.color=clr||'var(--blue)';}}
async function fileImage(file,ext){
  const url=URL.createObjectURL(file);const img=document.getElementById('imgprev');img.src=url;img.style.display='block';
  if(curMode!=='ai'){alert('รูปภาพต้องใช้โหมด AI — กรุณาเปลี่ยนโหมดเป็น 🤖 AI แล้วลองใหม่');return;}
  showProgress(true,'ส่งรูปให้ Claude Vision...');
  const b64=await toB64(file);const mt=ext==='png'?'image/png':'image/jpeg';
  const prompt=`parse รายงาน Case CCU จากรูปภาพ ตอบ JSON array เท่านั้น (ห้ามชื่อผู้ป่วย HN AN):\n[{"bed":1,"empty":false,"room_type":"IMCCU","gender":"ชาย","age":"77","admit_date":"9/4/69","los":"10","code":"G","dx":["Dx"],"master":["พ.แพทย์"],"consult":[],"orNote":"","ccNote":"","presentNote":"","rn":"","plan":"อยู่ต่อ"}]\nM:=master C:=consult`;
  const resp=await callAnthropic([{type:'image',source:{type:'base64',media_type:mt,data:b64}},{type:'text',text:prompt}]);
  finishParse(resp,file.name,'');
}
async function fileTxt(file){const text=await file.text();setRaw(text);if(curMode==='offline'){const beds=parseCCU(text);finishParse(beds,file.name,text);}else{showProgress(true,'ส่งข้อความให้ Claude AI...');const beds=await aiParseText(text);finishParse(beds,file.name,text);}}
async function fileDocx(file){
  showProgress(true,'กำลังโหลด mammoth.js...');
  if(!window.mammoth)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
  showProgress(true,'กำลังอ่าน DOCX...');
  const ab=await file.arrayBuffer();const result=await mammoth.extractRawText({arrayBuffer:ab});const text=result.value||'';
  setRaw(text);
  if(curMode==='offline'){const beds=parseCCU(text);finishParse(beds,file.name,text);}else{showProgress(true,'ส่งข้อความให้ Claude AI...');const beds=await aiParseText(text);finishParse(beds,file.name,text);}
}
async function filePdfOff(file){
  showProgress(true,'กำลังโหลด PDF.js...');
  if(!window.pdfjsLib){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';}
  showProgress(true,'กำลังอ่าน PDF...');
  const ab=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:ab}).promise;
  let full='';
  for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p);const tc=await page.getTextContent();full+=tc.items.map(i=>i.str).join(' ')+'\n';}
  setRaw(full);const beds=parseCCU(full);finishParse(beds,file.name,full);
}
async function filePdfAI(file){
  showProgress(true,'กำลังโหลด PDF.js สำหรับ AI...');
  if(!window.pdfjsLib){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';}
  showProgress(true,'กำลังอ่าน PDF...');
  const ab=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:ab}).promise;
  let full='';
  for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p);const tc=await page.getTextContent();full+=tc.items.map(i=>i.str).join(' ')+'\n';}
  setRaw(full);showProgress(true,'ส่งข้อความให้ Claude AI...');const beds=await aiParseText(full);finishParse(beds,file.name,full);
}
async function aiParseText(text){
  const prompt=`parse รายงาน Case CCU ต่อไปนี้ ตอบเฉพาะ JSON array เท่านั้น ไม่ต้องมีข้อความอื่น:\n[{"bed":1,"empty":false,"room_type":"IMCCU","gender":"ชาย","age":"77","admit_date":"9/4/69","los":"10","code":"G","dx":["STEMI"],"master":["พ.แพทย์"],"consult":[],"orNote":"","ccNote":"","presentNote":"","rn":"","plan":"อยู่ต่อ"}]\nrule: empty=true ถ้าเตียงว่าง; ห้ามใส่ชื่อผู้ป่วย HN AN; room_type: CCU/IMCCU/NCU/IMNCU/ICU/IMCU/ฝากนอน; plan: อยู่ต่อ/D/C/refer/plan D/C/ย้ายward รอห้อง/ย้าย ward ได้ห้องแล้ว; los=วันนอน\n\nข้อมูล:\n${text.substring(0,6000)}`;
  return await callAnthropic([{type:'text',text:prompt}]);
}
async function callAnthropic(content){
  const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4000,messages:[{role:'user',content}]})});
  const data=await resp.json();
  const text=(data.content||[]).map(c=>c.text||'').join('');
  if(!text)throw new Error('ไม่ได้รับข้อมูล: '+(data.error?.message||'API error'));
  return JSON.parse(text.replace(/```json|```/g,'').trim());
}
function toB64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.onerror=rej;r.readAsDataURL(file);});}
function setRaw(t){document.getElementById('rawpre').textContent=(t||'').substring(0,3000);}
function loadScript(src){return new Promise((res,rej)=>{if(document.querySelector('[src="'+src+'"]')){res();return;}const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);});}

// ════════════════════════════════════════
// BED CODE NORMALIZE  (IMNCU1 = IMNCU01, IMNCCU01 → IMNCU01)
// ════════════════════════════════════════
const ROOM_ALIASES={IMNCCU:'IMNCU',IMMCU:'IMNCU',IMMCCU:'IMCCU',IMCCU:'IMCCU',IMNCU:'IMNCU',IMCU:'IMCU',CCU:'CCU',ICU:'ICU',NCU:'NCU'};
function normalizeRoomToken(rt){
  const u=String(rt||'').toUpperCase().replace(/\s/g,'');
  return ROOM_ALIASES[u]||u;
}
/** @returns {{bed:number,room_type:string,bed_label:string}|null} */
function parseBedCode(raw){
  let s=String(raw||'').trim().toUpperCase().replace(/\s/g,'');
  if(!s)return null;
  s=s.replace(/IMNCCU/g,'IMNCU').replace(/IMMCU/g,'IMNCU').replace(/IMMCCU/g,'IMCCU');
  const m=s.match(/^(IMCCU|IMNCU|IMCU|CCU|ICU|NCU|ฝากนอน)(\d{1,2})$/);
  if(m){
    const room_type=normalizeRoomToken(m[1]);
    const bed=parseInt(m[2],10);
    return{bed,room_type,bed_label:room_type+String(bed).padStart(2,'0')};
  }
  if(/^\d{1,2}$/.test(s)){
    const bed=parseInt(s,10);
    return{bed,room_type:'NCU',bed_label:'NCU'+String(bed).padStart(2,'0')};
  }
  return null;
}
function formatSheetDate(name){
  const d=String(name).replace(/\D/g,'');
  if(d.length>=7&&(d.endsWith('2569')||d.endsWith('69')&&d.length>=7)){
    const day=parseInt(d.slice(0,2),10);
    const month=parseInt(d.slice(2,4),10);
    if(day&&month)return`${day}/${month}/69`;
  }
  if(d.length===5){
    const day=parseInt(d.slice(0,d.length-4),10);
    const month=parseInt(d.slice(-4,-2),10);
    if(day&&month)return`${day}/${month}/69`;
  }
  if(d.length===4){
    const day=parseInt(d.slice(0,1),10);
    const month=parseInt(d.slice(1,2),10);
    if(day&&month)return`${day}/${month}/69`;
  }
  return String(name);
}
function genderFromName(name){
  const n=String(name||'');
  if(/\bนาย\b|\bMr\.?\b/i.test(n))return'ชาย';
  if(/\bนาง\b|\bน\.ส\.|\bนางสาว\b|\bMrs\.?\b|\bMs\.?\b/i.test(n))return'หญิง';
  return'';
}
function parseAgeCell(v){
  const m=String(v||'').match(/(\d{1,3})/);
  return m?m[1]:'';
}
function parseLosCell(v){
  const s=String(v||'').trim();
  const m=s.match(/(\d{1,3})/);
  if(m)return m[1];
  if(/^\d{5,6}$/.test(s)){
    const n=parseInt(s,10);
    if(n>0&&n<500)return String(n);
  }
  return s;
}
function parseAdmitCell(v){
  const s=String(v||'').trim();
  const m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if(m)return`${m[1]}/${m[2]}/${m[3].slice(-2)}`;
  if(/^\d{5,6}$/.test(s)){
    const n=parseInt(s,10);
    if(n>40000){const ex=new Date((n-25569)*86400000);return`${ex.getDate()}/${ex.getMonth()+1}/${String(ex.getFullYear()+543).slice(-2)}`;}
  }
  return s;
}
function parseCodeCell(v){
  const s=String(v||'').trim().toUpperCase();
  if(!s)return'';
  if(/S\+I|S&I/.test(s))return'S+I';
  if(s==='S'||s==='G'||s==='C'||s==='B')return s;
  if(/สปสช/.test(s))return'สปสช.';
  return s;
}
function parseDxCell(v){
  return String(v||'').split(/[,;]\s*/).map(x=>x.trim()).filter(x=>x.length>1&&x.length<80).slice(0,6);
}
function parseDoctorsCell(v){
  const master=[],consult=[];
  const text=String(v||'').replace(/\s{2,}/g,'\n');
  const parts=text.split(/\n+|(?=นพ\.|พญ\.|พ\.|น\.พ\.)/).map(x=>x.trim()).filter(x=>x.length>2);
  parts.forEach(p=>{
    const n=normalizeDrLine(p);
    if(!n)return;
    if(!master.length)master.push(n);
    else if(n!==master[0]&&!consult.includes(n))consult.push(n);
  });
  return{master,consult};
}
function normalizeDrLine(p){
  p=p.trim().replace(/\s+/g,' ');
  if(p.length<3)return'';
  if(/^พ\.|^นพ\.|^พญ\.|^น\.พ\./.test(p))return fuzzyDr(p)||p;
  if(/^พ[\s\.]/.test(p))return fuzzyDr('พ.'+p.replace(/^พ[\s\.]+/,''))||('พ.'+p.replace(/^พ[\s\.]+/,''));
  return fuzzyDr(p)||p;
}
function parsePlanNCU(v){
  const t=String(v||'').toLowerCase();
  if(/refer/.test(t))return'refer';
  if(/plan\s*d\/c|plan\s*dc/.test(t))return'plan D/C';
  if(/\bd\/c\b/.test(t))return'D/C';
  if(/ได้ห้อง|ย้าย.*ได้/.test(t))return'ย้าย ward ได้ห้องแล้ว';
  if(/ย้าย\s*ward|plan\s*ย้าย|ย้ายward/.test(t))return'ย้ายward รอห้อง';
  if(/รอรับ/.test(t))return'รอรับใหม่';
  return'อยู่ต่อ';
}
function sheetToRows(ws){
  if(!window.XLSX||!ws)return[];
  const ref=ws['!ref'];
  if(!ref)return[];
  const range=XLSX.utils.decode_range(ref);
  const rows=[];
  for(let R=range.s.r;R<=range.e.r;R++){
    const row=[];
    for(let C=range.s.c;C<=Math.min(range.e.c,20);C++){
      const cell=ws[XLSX.utils.encode_cell({r:R,c:C})];
      row.push(cell?(cell.w!=null?cell.w:cell.v!=null?String(cell.v):''):'');
    }
    if(row.some(c=>String(c).trim()!==''))rows.push(row);
  }
  return rows;
}
function parseNCUExcelRows(rows){
  let hdr=-1;
  for(let i=0;i<rows.length;i++){
    if(/^เตียง$/i.test(String(rows[i][0]||'').trim())){hdr=i;break;}
  }
  if(hdr<0)return[];
  const out=[];
  for(let i=hdr+1;i<rows.length;i++){
    const r=rows[i];
    const bedRaw=r[0];
    if(!bedRaw||!/NCU|IMNCU|IMMCU|IMNCCU|\d/i.test(String(bedRaw)))continue;
    const bc=parseBedCode(bedRaw);
    if(!bc)continue;
    const name=String(r[2]||'').trim();
    const hasPt=parseAgeCell(r[5])||genderFromName(name)||String(r[9]||'').trim()||String(r[13]||'').trim()||String(r[10]||'').trim()||String(r[11]||'').trim()||String(r[12]||'').trim();
    if(!hasPt){out.push({bed:bc.bed,empty:true,room_type:bc.room_type,bed_label:bc.bed_label,gender:'',classLevel:'',age:'',admit_date:'',code:'',dx:[],master:[],consult:[],plan:'',los:'',orNote:'',ccNote:'',presentNote:'',rn:''});continue;}
    const {master,consult}=parseDoctorsCell(r[8]);
    const dx=parseDxCell(r[9]);
    out.push({
      bed:bc.bed,empty:false,room_type:bc.room_type,bed_label:bc.bed_label,
      gender:genderFromName(name),classLevel:String(r[3]||'').trim(),age:parseAgeCell(r[5]),admit_date:parseAdmitCell(r[6]),
      code:parseCodeCell(r[1]),los:parseLosCell(r[7]),
      orNote:String(r[10]||'').trim(),ccNote:String(r[11]||'').trim(),presentNote:String(r[12]||'').trim(),
      dx,master,consult,plan:parsePlanNCU(r[13]),rn:''
    });
  }
  const byBed={};
  out.forEach(b=>{if(!byBed[b.bed]||!b.empty)byBed[b.bed]=b;});
  return Object.keys(byBed).sort((a,b)=>a-b).map(k=>byBed[k]);
}
async function handleNCUExcel(file){
  if(!file)return;
  showProgress(true,'กำลังโหลด SheetJS...');
  try{
    if(!window.XLSX)await loadScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');
    showProgress(true,'กำลังอ่าน '+file.name+'...');
    const ab=await file.arrayBuffer();
    ncuWorkbook=XLSX.read(ab,{type:'array'});
    ncuFileName=file.name;
    const sel=document.getElementById('ncu-sheet-sel');
    let names=ncuWorkbook.SheetNames.filter(n=>!/export\s*summary/i.test(n));
    names.sort((a,b)=>parseInt(b.replace(/\D/g,''),10)-parseInt(a.replace(/\D/g,''),10));
    sel.innerHTML=names.map(n=>`<option value="${n}">${formatSheetDate(n)} (${n})</option>`).join('');
    sel.style.display=names.length?'inline-block':'none';
    if(names.length)sel.value=names[0];
    document.getElementById('ncu-parse-btn').style.display=names.length?'inline-block':'none';
    document.getElementById('imp-dept').value='NCU';
    if(names.length)parseSelectedNCUSheet();
    toast('📊 โหลด Excel '+names.length+' แผ่น — เลือกวันที่แล้วกดนำเข้า','#0e8060');
  }catch(e){alert('อ่าน Excel ไม่สำเร็จ: '+e.message);console.error(e);}
  showProgress(false);
}
function parseSelectedNCUSheet(){
  if(!ncuWorkbook)return;
  const name=document.getElementById('ncu-sheet-sel').value;
  const ws=ncuWorkbook.Sheets[name];
  const rows=sheetToRows(ws);
  const beds=parseNCUExcelRows(rows);
  const label=ncuFileName+' · แผ่น '+formatSheetDate(name);
  setRaw('แผ่น: '+name+'\n'+rows.slice(0,15).map(r=>r.slice(0,14).join('\t')).join('\n'));
  finishParse(beds,label,'NCU Excel '+name);
}

// ════════════════════════════════════════
// OFFLINE PARSER
// ════════════════════════════════════════
function parseCCU(text){
  const ROOMS=['IMCCU','IMCU','IMNCU','CCU','ICU','NCU','ฝากนอน'];
  const CODES=['S\\+I','สปสช\\.?','UCEP','เครดิต','พรบ\\.','S','G','C'];
  const PMAP={'D\\/C':'D/C','plan\\s*D\\/C':'plan D/C','refer\\s*out':'refer','refer':'refer','อยู่ต่อ':'อยู่ต่อ','อยู่':'อยู่ต่อ','ย้าย\\s*ward\\s*ได้\\s*ห้อง':'ย้าย ward ได้ห้องแล้ว','ย้าย\\s*ward\\s*รอ\\s*ห้อง':'ย้ายward รอห้อง','ย้าย\\s*ward':'ย้ายward รอห้อง'};

  // รองรับทั้ง 2 รูปแบบ:
  // 1) IMCCU07, CCU01, NCU03 ฯลฯ (room_type + เลขเตียง ติดกัน)
  // 2) Bed 1, Bed 2 ฯลฯ (รูปแบบเดิม)
  const roomHints={};
  const codeBlocks={};

  const prefixPat=/(?:^|\n)(IMCCU|IMNCU|IMNCCU|IMMCU|IMCU|CCU|ICU|NCU|ฝากนอน)(\d{1,2})\b/gi;
  const prefixMatches=[];
  let pm;
  while((pm=prefixPat.exec(text))!==null){
    const rt=normalizeRoomToken(pm[1]);
    prefixMatches.push({idx:pm.index+(pm[0].startsWith('\n')?1:0),rt,bn:parseInt(pm[2],10)});
  }

  if(prefixMatches.length>0){
    for(let i=0;i<prefixMatches.length;i++){
      const {idx,rt,bn}=prefixMatches[i];
      const end=i+1<prefixMatches.length?prefixMatches[i+1].idx:text.length;
      codeBlocks[bn]=text.substring(idx,end);
      roomHints[bn]=rt;
    }
  } else {
    const mm=[...text.matchAll(/^Bed\s+(\d+)\b/gm)];
    for(let i=0;i<mm.length;i++){const bn=parseInt(mm[i][1]);codeBlocks[bn]=text.substring(mm[i].index,i+1<mm.length?mm[i+1].index:text.length);}
  }

  if(!Object.keys(codeBlocks).length)return[];
  const maxB=Math.max(...Object.keys(codeBlocks).map(Number));const result=[];
  for(let b=1;b<=maxB;b++){
    if(!codeBlocks[b]){result.push({bed:b,empty:true,room_type:'',gender:'',classLevel:'',age:'',admit_date:'',code:'',dx:[],master:[],consult:[],plan:'',los:'',orNote:'',ccNote:'',presentNote:'',rn:''});continue;}
    const parsed=parseBed(b,codeBlocks[b],ROOMS,CODES,PMAP);
    if(!parsed.room_type&&roomHints[b])parsed.room_type=roomHints[b];
    result.push(parsed);
  }
  return result;
}

function parseBed(bedNo,text,ROOMS,CODES,PMAP){
  const r={bed:bedNo,empty:false,room_type:'',gender:'',classLevel:'',age:'',admit_date:'',code:'',dx:[],master:[],consult:[],plan:'',los:'',orNote:'',ccNote:'',presentNote:'',rn:''};
  if(/ว่าง/.test(text)&&!/นาง|นาย|HN:|M:/i.test(text)){r.empty=true;return r;}
  if(/^Bed\s+\d+\s*$/.test(text.trim())){r.empty=true;return r;}
  for(const rt of ROOMS){if(new RegExp('\\b'+rt+'\\b').test(text)){r.room_type=rt;break;}}
  if(/\bนาย\b/.test(text))r.gender='ชาย';else if(/\bนาง\b|\bนางสาว\b/.test(text))r.gender='หญิง';
  const cl=text.match(/\bclass\s*([1-5])\b/i);if(cl)r.classLevel=cl[1];
  const am=text.match(/อายุ\s+(\d+)\s*ปี/);if(am)r.age=am[1];
  const adm=text.match(/Admit\s+([\d]+\/[\d]+\/[\d]+)/);if(adm)r.admit_date=adm[1];
  const losM=text.match(/LOS[:\s]*(\d{1,3})/i);if(losM)r.los=losM[1];
  r.los=r.los||'';r.orNote='';r.ccNote='';r.presentNote='';
  for(const c of CODES){if(new RegExp('(?:^|\\s)'+c+'(?:\\s|$)','m').test(text)){r.code=c.replace(/\\/g,'');break;}}
  (text.match(/M:\s*[^\n]+/g)||[]).forEach(line=>{line.replace(/^M:\s*/,'').replace(/ราวน์.*$/,'').replace(/\d+[-\/]\d+.*$/,'').trim().split(/\s+ฝาก|ฝากพ\./).forEach(p=>{p=p.trim().replace(/^พ\.\s*/,'').trim();if(p.length>1&&p.length<30&&!/^\d/.test(p)){const n=mkName(p);if(n&&!r.master.includes(n))r.master.push(n);}});});
  (text.match(/^C:\s*[^\n]+/gm)||[]).forEach(line=>{line.replace(/^C:\s*/,'').replace(/\s*[®©]/g,'').trim().split(/\s+(?=พ\.|นพ\.|พญ\.)/).forEach(p=>{p=p.trim().replace(/^พ\.\s*/,'').trim();if(p.length>1&&p.length<30&&!/^\d/.test(p)){const n=mkName(p);if(n&&!r.consult.includes(n)&&!r.master.includes(n))r.consult.push(n);}});});
  const caseM=text.match(/Case\s*[:\s]+([^\n]+)/);if(caseM){caseM[1].replace(/^\s*[-:]\s*/,'').trim().split(/\s+with\s+|\s+[Ww]\/\s*/).forEach(d=>{d=d.trim().replace(/^\d+[\.\)]\s*/,'');if(d.length>2&&d.length<60)r.dx.push(d);});}
  const ndr=/^\s*\d+[\.\)]+\s*([A-Za-zก-๙][^\n]{2,50})/gm;let nm;
  while((nm=ndr.exec(text))!==null){const d=nm[1].trim();if(!/lab|cbc|admit|tx\.|pain|npo|iv |atb|dtx|keep|ua:|v\/s|on |มีแผล/i.test(d)&&d.length<60){if(!r.dx.some(x=>x.toLowerCase().startsWith(d.toLowerCase().substring(0,6))))r.dx.push(d);}}
  r.dx=r.dx.slice(0,6);
  const pt=text.substring(Math.max(0,text.length-200));
  for(const[pat,val]of Object.entries(PMAP)){if(new RegExp(pat,'i').test(pt)){r.plan=val;break;}}
  if(!r.plan)r.plan='อยู่ต่อ';
  r.master=r.master.map(n=>fuzzyDr(n)||n);r.consult=r.consult.map(n=>fuzzyDr(n)||n);
  return r;
}
function mkName(raw){let n=raw.replace(/[®©\*\[\]]/g,'').replace(/\s+\d+[-\/]\d+.*$/,'').replace(/\s{2,}/,' ').trim();n=n.replace(/^(พ\.|นพ\.|พญ\.)\s*/,'');if(!n||n.length<2)return null;return 'พ.'+n;}
function fuzzyDr(raw){const q=(raw||'').replace(/^(นพ\.|พญ\.|พ\.)\s*/,'').trim().toLowerCase();if(!q||q.length<2)return null;let m=doctors.find(d=>d.name.toLowerCase().includes(q)||q.includes(d.name.toLowerCase().replace(/^(นพ\.|พญ\.)\s*/,'').trim()));if(m)return m.name;const toks=q.split(/\s+/).filter(t=>t.length>=3);for(const tok of toks){m=doctors.find(d=>d.name.toLowerCase().includes(tok));if(m)return m.name;}return null;}

// ════════════════════════════════════════
// PARSE RESULT
// ════════════════════════════════════════
function normalizeParsedBed(b){
  const master=Array.isArray(b.master)?b.master:(b.master?[b.master]:[]);
  return{
    bed:b.bed,empty:!!b.empty,room_type:b.room_type||'',bed_label:b.bed_label||'',
    gender:b.gender||'',age:String(b.age||'').trim(),admit_date:b.admit_date||b.admitDate||'',
    classLevel:String(b.classLevel||b.class||'').trim(),code:b.code||b.patientCode||'',dx:b.dx||[],master,consult:b.consult||[],plan:b.plan||'',
    los:String(b.los||'').trim(),orNote:String(b.orNote||b.or_note||'').trim(),
    ccNote:String(b.ccNote||b.cc_note||'').trim(),presentNote:String(b.presentNote||b.present_note||'').trim(),
    rn:String(b.rn||'').trim()
  };
}
function finishParse(beds,fname,raw){
  parsedBeds=(beds||[]).map(normalizeParsedBed);
  saveRpt(fname,parsedBeds);
  showResult(parsedBeds,fname);
}
function saveRpt(fname,beds){
  const n=new Date();const dk=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;const ts=n.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  rptHist=rptHist.filter(h=>h.date!==dk);rptHist.unshift({date:dk,time:ts,fname,beds});
  const cut=new Date();cut.setDate(cut.getDate()-5);rptHist=rptHist.filter(h=>new Date(h.date)>=cut).slice(0,10);
  saveAll();renderHist();
}
function renderHist(){
  const card=document.getElementById('hcard'),list=document.getElementById('hlist');
  if(!rptHist.length){card.style.display='none';return;}card.style.display='block';
  list.innerHTML=rptHist.map((h,i)=>{const occ=h.beds.filter(b=>!b.empty).length;const dc=h.beds.filter(b=>['D/C','plan D/C'].includes(b.plan)).length;const ref=h.beds.filter(b=>b.plan==='refer').length;
  return`<div class="hi ${selHistIdx===i?'sel':''}" onclick="loadHist(${i})"><div style="display:flex;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--blue);">${h.date} ${h.time}</span><span style="font-size:10px;color:var(--txd);">${(h.fname||'').substring(0,28)}</span></div><div style="font-size:10px;color:var(--txd);margin-top:2px;">ผู้ป่วย ${occ} · D/C ${dc} · Refer ${ref}</div><div class="hbeds">${h.beds.filter(b=>!b.empty).map(b=>{const c=PC[b.plan]||PC['อยู่ต่อ'];return`<span class="hb" style="background:${c.bg};color:${c.tx};border-color:${c.br};">เตียง ${b.bed}</span>`;}).join('')}</div></div>`;}).join('');
}
function loadHist(i){selHistIdx=i;const h=rptHist[i];parsedBeds=h.beds;showResult(h.beds,h.fname);renderHist();}
function showResult(beds,fname){
  document.getElementById('res-lbl').textContent=fname||'';
  document.getElementById('res-beds').innerHTML=beds.map((b,i)=>{
    const bedLbl=b.bed_label||((b.room_type||'')+String(b.bed).padStart(2,'0'))||('เตียง '+b.bed);
    if(b.empty)return`<div class="rbed" style="opacity:.5;"><div class="rh"><span style="font-size:15px;font-weight:700;color:var(--txd);font-family:'IBM Plex Mono',monospace;">${bedLbl}</span><span style="font-size:11px;color:var(--txm);font-style:italic;">ว่าง</span></div></div>`;
    const pc=PC[b.plan]||PC['อยู่ต่อ'];
    const dxh=(b.dx||[]).map(d=>{const c=DXC(d)||{bg:'#e8eef6',tx:'#1a3a6a',br:'#b8cce0'};return`<span class="pill" style="background:${c.bg};color:${c.tx};border-color:${c.br};">${d}</span>`;}).join('');
    const rtc=SC[b.room_type]||SC.Med;
    const mh=(b.master||[]).map(m=>{const dr=doctors.find(x=>x.name===m);return`<span style="font-size:11px;color:var(--blue);">M:${m}${dr?` <small style="color:var(--txd);">(${dr.spec})</small>`:''}</span>`;}).join(' ');
    const ch=(b.consult||[]).map(c2=>{const dr=doctors.find(x=>x.name===c2);return`<span style="font-size:11px;color:var(--txd);">C:${c2}${dr?` (${dr.spec})`:''}</span>`;}).join(' ');
    const meta=[b.los?`LOS ${b.los}d`:null,b.rn?`RN ${b.rn}`:null].filter(Boolean).join(' · ');
    const notes=[b.orNote?`OR: ${b.orNote.substring(0,60)}${b.orNote.length>60?'…':''}`:null,b.ccNote?`CC: ${b.ccNote.substring(0,50)}…`:null,b.presentNote?`อาการ: ${b.presentNote.substring(0,50)}…`:null].filter(Boolean);
    return`<div class="rbed"><div class="rh"><input type="checkbox" class="imp" id="ck${i}" checked><span style="font-size:15px;font-weight:700;color:var(--blue);font-family:'IBM Plex Mono',monospace;">${bedLbl}</span><span style="font-size:10px;color:var(--txd);">→ เตียง ${b.bed}</span>${b.room_type?`<span style="background:${rtc.bg};color:${rtc.tx};border:1px solid ${rtc.br};border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600;">${b.room_type}</span>`:''}<span class="pill" style="background:${pc.bg};color:${pc.tx};border-color:${pc.br};">${b.plan||'อยู่ต่อ'}</span></div>${meta?`<div style="font-size:10px;color:var(--txd);margin-top:3px;">${meta}</div>`:''}<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;">${dxh}</div>${mh||ch?`<div style="margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;">${mh}${ch}</div>`:''}${notes.length?`<div style="font-size:10px;color:var(--txm);margin-top:4px;">${notes.join('<br>')}</div>`:''}</div>`;
  }).join('');
  document.getElementById('res-wrap').style.display='block';
}
function selAll(v){document.querySelectorAll('.imp').forEach(c=>c.checked=v);}
function applyParsedToBed(cur,b,dept){
  const DTYPE={CCU:['CCU','IMCCU','ฝากนอน'],NCU:['NCU','IMNCU','ฝากนอน'],ICU:['ICU','IMCU','ฝากนอน']};
  const rt=b.room_type&&(DTYPE[dept]||[]).includes(b.room_type)?b.room_type:cur.deptType;
  const mD=n=>{const dr=doctors.find(x=>x.name===n||(n&&x.name.includes(n.replace(/^(นพ\.|พญ\.|พ\.)\s*/,'').trim())));return dr?dr.name:n;};
  return sanitizeBedPrivacy({...cur,deptType:rt,gender:b.gender||cur.gender,classLevel:b.classLevel||cur.classLevel,age:b.age||cur.age,admitDate:b.admit_date||cur.admitDate,patientCode:b.code||cur.patientCode,dx:b.dx?.length?b.dx:cur.dx,master:b.master?.length?mD(b.master[0]):cur.master,consult:(b.consult||[]).map(mD),plan:b.plan||cur.plan,rn:b.rn||cur.rn,los:b.los||cur.los,orNote:b.orNote||cur.orNote,ccNote:b.ccNote||cur.ccNote,presentNote:b.presentNote||cur.presentNote});
}
function doImport(){
  const td=document.getElementById('imp-dept').value;
  const raw=readLocalJSON(SK,{});
  if(!raw.beds)raw.beds={};if(!raw.beds[td])raw.beds[td]={};
  const DTYPE={CCU:['CCU','IMCCU','ฝากนอน'],NCU:['NCU','IMNCU','ฝากนอน'],ICU:['ICU','IMCU','ฝากนอน']};
  let cnt=0;
  parsedBeds.forEach((b,i)=>{
    const cb=document.getElementById('ck'+i);if(!cb||!cb.checked||b.empty)return;
    const id=`${b.bed}`;const cur=sanitizeBedPrivacy(raw.beds[td][id]||{id,dept:td,deptType:(DTYPE[td]||[])[0]||'',dx:[],patientCode:'',master:'',consult:[],rn:'',plan:'อยู่ต่อ',checks:[],transferWard:'',transferRoom:'',transferBed:'',transferRoomType:'',gender:'',classLevel:'',age:'',admitDate:'',los:'',orNote:'',ccNote:'',presentNote:''});
    raw.beds[td][id]=applyParsedToBed(cur,b,td);cnt++;
  });
  writeLocalJSON(SK,raw);try{new BroadcastChannel('ccu_bc').postMessage('u');}catch{}
  // reload dashboard
  load();renderTable();
  alert(`✓ นำเข้า ${cnt} เตียง → ${td} สำเร็จ`);
}

// ════════════════════════════════════════
// DOCTORS (ADMIN)
// ════════════════════════════════════════
function renderSpecTabs(){
  const specs=['All',...new Set(doctors.map(d=>d.spec))];
  document.getElementById('spec-tabs').innerHTML=specs.map(s=>{const c=SC[s],cnt=s==='All'?doctors.length:doctors.filter(d=>d.spec===s).length;const sel=curSpec===s;const sty=sel&&c?`background:${c.bg};color:${c.tx};border-color:${c.br};`:'';return`<button class="stab ${sel?'on':''}" onclick="setSpec('${s}',this)" style="${sty}">${s} <span style="opacity:.55;">${cnt}</span></button>`;}).join('');
}
function setSpec(s,el){curSpec=s;document.querySelectorAll('#spec-tabs .stab').forEach(t=>{t.classList.remove('on');t.removeAttribute('style');});el.classList.add('on');const c=SC[s];if(c&&s!=='All')el.style.cssText=`padding:4px 10px;border-radius:8px;border:1px solid ${c.br};background:${c.bg};color:${c.tx};`;renderDrList();}
function setWt(f,el){curWt=f;document.querySelectorAll('#wt-all,#wt-ft,#wt-pt').forEach(b=>b.classList.remove('on'));el.classList.add('on');renderDrList();}
function renderDrList(){
  const q=(document.getElementById('drsrch')?.value||'').toLowerCase().trim();
  const list=doctors.filter(d=>{if(curSpec!=='All'&&d.spec!==curSpec)return false;if(curWt!=='all'&&d.workType!==curWt)return false;if(q&&!d.name.toLowerCase().includes(q)&&!d.spec.toLowerCase().includes(q))return false;return true;});
  document.getElementById('dr-cnt').textContent=`(${list.length}/${doctors.length})`;
  const sty=s=>{const c=SC[s];return c?`background:${c.bg};color:${c.tx};border-color:${c.br};`:'';}
  document.getElementById('dr-list').innerHTML=list.length?list.map(d=>`<div class="li"><span class="nm">${d.name}</span><span class="tag" style="${sty(d.spec)}">${d.spec}</span><span class="tag ${d.workType==='Full-Time'?'ft':'pt'}">${d.workType==='Full-Time'?'FT':'PT'}</span><button class="del" onclick="delDr(${JSON.stringify(d.name)})">✕</button></div>`).join(''):`<div style="padding:18px;text-align:center;color:var(--txm);font-size:12px;">ไม่พบแพทย์</div>`;
}
function onDS(){document.getElementById('add-ds-o').style.display=document.getElementById('add-ds').value==='อื่นๆ'?'inline-block':'none';}
function addDr(){
  if(!requireMetaWrite())return;
  const name=document.getElementById('add-dn').value.trim();if(!name){alert('กรุณาใส่ชื่อ');return;}
  const sv=document.getElementById('add-ds').value;const spec=sv==='อื่นๆ'?(document.getElementById('add-ds-o').value.trim()||'อื่นๆ'):sv;const wt=document.getElementById('add-dwt').value;
  if(!doctors.find(d=>d.name===name))doctors.push({name,spec,workType:wt});
  document.getElementById('add-dn').value='';saveAll();curSpec=spec;renderSpecTabs();renderDrList();
}
function delDr(name){
  if(!requireMetaWrite())return;
  if(!confirm('ลบ "'+name+'" ?'))return;
  doctors=doctors.filter(d=>d.name!==name);saveAll();renderSpecTabs();renderDrList();
}
function exportDr(){const b=new Blob([JSON.stringify(doctors,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='doctors.json';a.click();}

// ════════════════════════════════════════
// STAFF (ADMIN)
// ════════════════════════════════════════
function swSD(d,el){curSD=d;document.querySelectorAll('#sdt .stab').forEach(t=>t.classList.remove('on'));el.classList.add('on');renderAdminStaffList();}

function addSt(role){
  if(!requireMetaWrite())return;
  const inp=document.getElementById(role.toLowerCase()+'-inp');
  const name=inp.value.trim();if(!name)return;
  if(!stCfg[curSD])stCfg[curSD]={RN:[],PN:[]};
  if(!stCfg[curSD][role])stCfg[curSD][role]=[];
  if(!stCfg[curSD][role].includes(name))stCfg[curSD][role].push(name);
  inp.value='';saveAll();renderAdminStaffList();
}
function delSt(role,name){
  if(!requireMetaWrite())return;
  if(!stCfg[curSD])return;
  if(!stCfg[curSD][role])return;
  stCfg[curSD][role]=stCfg[curSD][role].filter(n=>n!==name);
  saveAll();renderAdminStaffList();
}
function renderAdminStaffList(){
  const sc2=stCfg[curSD]||{RN:[],PN:[]};
  ['RN','PN'].forEach(role=>{
    const el=document.getElementById(role.toLowerCase()+'-list');
    if(!el)return;
    const list=sc2[role]||[];
    el.innerHTML=list.length
      ? list.map(n=>`<div class="li"><span class="nm">${n}</span><button class="del" data-role="${role}" data-name="${n.replace(/"/g,'&quot;')}">✕</button></div>`).join('')
      : `<div style="padding:12px;text-align:center;color:var(--txm);font-size:12px;">ยังไม่มีรายชื่อ</div>`;
    el.querySelectorAll('.del').forEach(btn=>{
      btn.onclick=function(){delSt(this.dataset.role,this.dataset.name);};
    });
  });
}

// renderStaff defined above

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
function initApp(){
  load();loadAll();
  hydrateFromCloud().then(ok=>{if(ok){renderTable();renderStaff();renderHist();toast('☁️ โหลดข้อมูลจาก cloud แล้ว','#1a6fcc');}});
  const n=new Date();
  document.getElementById('today-lbl').textContent=`${n.getDate()} ${MONTHS[n.getMonth()]} ${n.getFullYear()+543}`;
  changeDept();tick();
  updateAccessUI();
  if(!appStarted){
    appStarted=true;
    setInterval(tick,1000);
    try{const bc=new BroadcastChannel('ccu_bc');bc.onmessage=()=>{load();renderTable();renderStaff();toast('🔄 ข้อมูลอัปเดต','#1a6fcc');};}catch{}
    startAutoRefresh();
  }
}

bootstrapAuth();
