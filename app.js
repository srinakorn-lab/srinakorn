// ════════════════════════════════════════
// Critical SYSTEM — app.js
// ผสาน logic ทั้งหมดจาก ccu_combined_4
// พร้อม Supabase Auth + Realtime
// ════════════════════════════════════════

// ════════════════════════════════════════
// SUPABASE CLIENT (โหลดจาก CDN)
// ════════════════════════════════════════
let _sb = null;
async function getSupabase() {
  if (_sb) return _sb;
  if (window.supabase && window.CFG?.supabaseUrl && window.CFG?.supabaseKey) {
    _sb = window.supabase.createClient(window.CFG.supabaseUrl, window.CFG.supabaseKey);
  }
  return _sb;
}

// ════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════
const SK = 'ccu_v3';
const MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const ALL_DEPTS = ['CCU','NCU','ICU'];
const DEPTS = {
  CCU:{full:'หอผู้ป่วยวิกฤตโรคหัวใจ',beds:9,types:['CCU','IMCCU','ฝากนอน']},
  NCU:{full:'หอผู้ป่วยวิกฤตระบบประสาท',beds:7,types:['NCU','IMNCU','ฝากนอน']},
  ICU:{full:'หอผู้ป่วยวิกฤตอายุรกรรม',beds:13,types:['ICU','IMCU','ฝากนอน']}
};
const TC = {
  CCU:{bg:'#cce0f8',tx:'#1a3a6a',br:'#7ab0d8'},
  IMCCU:{bg:'#e8e6f8',tx:'#3a3490',br:'#9090d8'},
  NCU:{bg:'#d0eedc',tx:'#0a5030',br:'#6ec8a0'},
  IMNCU:{bg:'#c8eed8',tx:'#0a6040',br:'#50b888'},
  ICU:{bg:'#fff3d0',tx:'#7a5200',br:'#e0a020'},
  IMCU:{bg:'#fce8d8',tx:'#6a3010',br:'#d08040'},
  ฝากนอน:{bg:'#e8e8e8',tx:'#4a4a4a',br:'#b0b0b0'}
};
const PC = {
  'อยู่ต่อ':{bg:'#e8eef6',tx:'#3a5570',br:'#b8cce0'},
  'รอรับใหม่':{bg:'#f8e0e8',tx:'#8a1a3a',br:'#d87aaa'},
  'plan D/C':{bg:'#d8f0e8',tx:'#0a5030',br:'#50b888'},
  'D/C':{bg:'#c8eed8',tx:'#0a5030',br:'#0e8060'},
  'refer':{bg:'#e8e6f8',tx:'#3a3490',br:'#9090d8'},
  'ย้ายward รอห้อง':{bg:'#fff3d0',tx:'#7a5200',br:'#e0a020'},
  'ย้าย ward ได้ห้องแล้ว':{bg:'#d8eaf8',tx:'#1a3a6a',br:'#7ab0d8'}
};
const DXC = dx => {
  if(!dx) return null;
  const d = dx.toLowerCase();
  if(d.includes('stemi') && !d.includes('nstemi')) return {bg:'#fce8e8',tx:'#8a1a1a',br:'#d88080'};
  if(d.includes('nstemi')) return {bg:'#fff3d0',tx:'#7a5200',br:'#e0a020'};
  if(d.includes('hf') || d.includes('chf')) return {bg:'#d8eaf8',tx:'#1a3a6a',br:'#7ab0d8'};
  if(d.includes('vt') || d.includes('code')) return {bg:'#fce0e0',tx:'#7a1a1a',br:'#d07070'};
  if(d.includes('pe') || d.includes('sepsis')) return {bg:'#e8e6f8',tx:'#3a3490',br:'#9090d8'};
  if(d.includes('open') || d.includes('cabg')) return {bg:'#fce8d8',tx:'#6a3010',br:'#d08040'};
  return {bg:'#e8eef6',tx:'#1a3a6a',br:'#b8cce0'};
};
const PLANS = [
  {v:'อยู่ต่อ',l:'อยู่ต่อ'},{v:'รอรับใหม่',l:'รอรับใหม่'},
  {v:'plan D/C',l:'plan D/C'},{v:'D/C',l:'D/C'},
  {v:'refer',l:'Refer'},{v:'ย้ายward รอห้อง',l:'ย้ายวอร์ด รอห้อง'},
  {v:'ย้าย ward ได้ห้องแล้ว',l:'ได้ห้องแล้ว'}
];
const CL = {
  'อยู่ต่อ':[{id:'lab',l:'Lab/X-ray'},{id:'or',l:'OR'},{id:'cag',l:'Plan CAG'},{id:'npo',l:'NPO'},{id:'liq',l:'จำกัดน้ำ'},{id:'fall',l:'Fall/Bleed'},{id:'flat',l:'นอนราบ/ห้ามงอขา'}],
  'ย้ายward รอห้อง':[{id:'w1',l:'ญาติ'},{id:'w2',l:'ยา'},{id:'w3',l:'ยาเดิม'},{id:'w4',l:'ทรัพย์สิน'},{id:'w5',l:'ยาในตู้เย็น'}],
  'ย้าย ward ได้ห้องแล้ว':[{id:'g1',l:'รอ Lab'},{id:'g2',l:'รอแพทย์'},{id:'g3',l:'รอ criteria'},{id:'g4',l:'รอ obs.'},{id:'g5',l:'รอญาติ'},{id:'g6',l:'รอทำห้อง'},{id:'g7',l:'รอส่งเวร'},{id:'g8',l:'รอห้องว่าง'},{id:'g9',l:'ยาในตู้เย็น'}],
  'plan D/C':[{id:'a1',l:'บัตรนัด'},{id:'a2',l:'ยา H/M'},{id:'a3',l:'คืนยา (ยาในตู้เย็น)'},{id:'a4',l:'ตรวจสอบเอกสาร'},{id:'a5',l:'ใบยินยอม'},{id:'a6',l:'Investigation'},{id:'a7',l:'ส่งการเงิน'},{id:'a8',l:'ยาในตู้เย็น'}],
  'D/C':[{id:'a1',l:'บัตรนัด'},{id:'a2',l:'ยา H/M'},{id:'a3',l:'คืนยา (ยาในตู้เย็น)'},{id:'a4',l:'ตรวจสอบเอกสาร'},{id:'a5',l:'ใบยินยอม'},{id:'a6',l:'Investigation'},{id:'a7',l:'ส่งการเงิน'},{id:'a8',l:'ยาในตู้เย็น'}],
  'refer':[{id:'r1',l:'ใบ Refer'},{id:'r2',l:'ประวัติ/Lab/X-ray/CAG'},{id:'r3',l:'เตรียมเอกสาร'},{id:'r4',l:'รอติดต่อ'},{id:'r5',l:'รอตอบกลับ'},{id:'r6',l:'ไป รพ.'},{id:'r7',l:'จองรถ Amb'},{id:'r8',l:'รอการเงิน'},{id:'r9',l:'ญาติพร้อม'},{id:'r10',l:'เวชระเบียน'},{id:'r11',l:'คืนยา (ยาในตู้เย็น) / ยกเลิก Lab'},{id:'r12',l:'ยาในตู้เย็น'}]
};
const RWD = {
  '5A':['501A','502A','503A','504A','505A','506A','507A','508A','509A','510A','511A','512A','513A','514A','515A','516A','517A','518A','519A','520A','521A','522A','523A','524A'],
  '6A':['601A','602A','603A','604A','605A','606A','607A','608A','609A','610A','611A','612A','613A','614A','615A','616A','617A','618A','619A','620A','621A','622A','623A','624A'],
  '7A':['701A','702A','703A','704A','705A','706A','707A','708A','709A','710A','711A','712A','713A','714A','715A','716A','717A','718A','719A','720A','721A','722A','723A','724A'],
  '8A':['801A','802A','803A','804A','805A','806A','807A','808A','809A','810A','811A','812A','813A','814A','815A','816A','817A','818A','819A','820A','821A','822A','823A','824A'],
  '9A':['901A','902A','903A','904A','905A','906A','907A','908A','909A','910A','911A','912A','913A','914A','915A','916A','917A','918A','919A','920A','921A','922A','923A','924A'],
  '10A':['1001A','1002A','1003A','1004A','1005A','1006A','1007A','1008A','1009A','1010A','1011A','1012A','1013A','1014A','1015A','1016A','1017A','1018A','1019A','1020A','1021A','1022A','1023A','1024A'],
  '11A':['1101A','1102A','1103A','1104A','1105A','1106A','1107A','1108A','1109A','1110A','1111A','1112A','1113A','1114A','1115A','1116A','1117A','1118A','1119A','1120A','1121A','1122A','1123A','1124A'],
  '12A':['1201A','1202A','1203A','1204A','1205A','1206A','1207A','1208A','1209A','1210A','1211A','1212A','1213A','1214A','1215A','1216A','1217A','1218A','1219A','1220A','1221A','1222A','1223A','1224A'],
  '6B':['6B01','6B02','6B03','6B04','6B05','6B06','6B07','6B08','6B09','6B10','6B11','6B12','6B13','6B14','6B15','6B16','6B17','6B18','6B19','6B20','6B21','6B22','6B23','6B24']
};
const SC = {
  Med:{bg:'#d8eaf8',tx:'#1a3a6a',br:'#7ab0d8'},Cardio:{bg:'#fce8e8',tx:'#8a1a1a',br:'#d07070'},
  GI:{bg:'#fff3d0',tx:'#7a5200',br:'#e0a020'},ORT:{bg:'#e8e6f8',tx:'#3a3490',br:'#9090d8'},
  PED:{bg:'#d0eedc',tx:'#0a5030',br:'#6ec8a0'},OBG:{bg:'#f8e0ec',tx:'#6a1a3a',br:'#d08aaa'},
  CVT:{bg:'#fce8d8',tx:'#6a3010',br:'#d08040'},Surg:{bg:'#e0f0d0',tx:'#2a5010',br:'#80b840'},
  Neuro:{bg:'#ede8f8',tx:'#2a1a6a',br:'#9080d8'},ENT:{bg:'#fff3d0',tx:'#7a5200',br:'#e0a020'},
  Imaging:{bg:'#e0f0f8',tx:'#1a4060',br:'#60a8c8'},HealthProm:{bg:'#e0f0d0',tx:'#2a5010',br:'#70b030'},
  Dental:{bg:'#f0f0e0',tx:'#4a4a10',br:'#a0a040'},Beauty:{bg:'#f8e0ec',tx:'#6a1a3a',br:'#c86090'},
  GP:{bg:'#e8eef6',tx:'#1a3a6a',br:'#b8cce0'},Mobile:{bg:'#eeeeed',tx:'#3a3a38',br:'#a0a090'},
  Wellness:{bg:'#d0eedc',tx:'#0a5030',br:'#6ec8a0'},ER:{bg:'#fce8d8',tx:'#6a2010',br:'#d07040'}
};

// ════════════════════════════════════════
// STATE
// ════════════════════════════════════════
let dept = 'CCU', editDept = 'CCU', showEmpty = false, staffExp = false, swapMode = 'swap';
let allBeds = {}, wards = {}, stCfg = {}, doctors = [];
let editId = null, editChecks = [], editConsults = [], editDx = [], editSRN = [], editSPN = [], editClass5Items = [];
let rptHist = [], parsedBeds = [], selHistIdx = -1;
let curSpec = 'All', curWt = 'all', curSD = 'CCU', curMode = 'offline';
let ncuWorkbook = null, ncuFileName = '';
let autoRefreshPaused = false;
let transferDeptFilter = 'ALL';
let currentUser = '';
let currentUserMeta = {};

// ════════════════════════════════════════
// DEFAULT DATA
// ════════════════════════════════════════
const DEF_ST = {
  CCU:{RN:['ศรีนคร โคทะนา','ฐาวิตรี ศรีศิริ','เจนจุรี ดวงแก้วปั้น','มณัฑนา วัฒนะพล','ไพจิตร หีบแก้ว','ลลิตา แสงส่อง','สโรชา แสงโยธา','กานต์มณี พรมชาติ','สุดารัตน์ สายโสม','สกาย นาดี'],PN:['เปมิกา สอนพงษ์','ละมุล สาลีวงษ์','สุกัญญา เริงเขตการ','ขวัญฤดี มีภักดี','สาวิตรี ชนะค้า','ขวัญชนก ปิ่นหอม','ชลนิภา พุ่มพวง','ศิรินาฎ ชมจันทร์','ขวัญธิดา หงษ์สาพันธ์']},
  NCU:{RN:['กาญจนา ภูมิคำ','วิชุตา กุนอก','มอญ ไชยสุระ','จันทนา เกตุนาค','มนธิรา หาวงศ์','รัญชิดา สนคงนอก','เพ็ญพลอย อุ่นนา','ศศินา ทะนารี','วราลักษณ์ เวฬุวนาธร','ชุติมา ปนคำ','ณัฐพร พันนุมา','มยุรา ไชบุญญา','กัลยาณี พงษ์วัน','จิราภรณ์ นะวะสด'],PN:['พิชญ์สินี เลิศนราวโรจน์','หยาดพิรุณ แสงสว่าง','อรนุช วงศ์ษาบุตร','ประณิตา ศิริวรรณ','ปรัชญา แกมนิล','รติกร จุลพันธ์','หัทยา เผยสง่า','อุลัย จันทร์สว่าง','นิภาพร เกษมศรีสุขสง่า']},
  ICU:{RN:['ศิริลักษณ์ แสนอุบล','บุณยวีร์ กลิ่นเพชร์','พัชรา สายกระสุน','เจนจิรา ศรีสงคราม','จิรเนตร พันธุ์คุ้มเก่า','มารศรี จันทราช','ณัฐนนท์ หลายแห่ง','นิศาชล หงษ์หิน','พัชรพร อินทำ','มุยรา ไชบุญญา','สิริกัลยาภรณ์ พลหาญ','วันทนีย์ สารักษ์','เดือนเพ็ญ บุญแก้ว','อุชเชษินี พิจารณ์','ชญานิศ ชัยฤทธิ์'],PN:['อมรา ทองแสง','ทิพย์พวรรณ สวัสดี','วราภรณ์ ดำนิน','รุ่งนภา พวงจำปา','นัทพร แก้วคำชาติ','มณีรุ่ง สิงห์คะนอง','ชลธิชา ยวนยี','วิจิตรา ไตรยะมูล','ปวีณา แสนเสน','ปัณณรัชต์ บุระเนตร','การัติมา ดีบุปผา','ยลดา พัฒนจักร์']}
};
const DEF_DR = [
  {name:'นพ. กิตติคุณ จอมใจ',spec:'Anes',workType:'Full-Time'},{name:'นพ. ฤทธิชัย พุทธประสิทธิ์',spec:'Anes',workType:'Full-Time'},{name:'นพ. ศักดิ์ดา อำนวยเดชกร',spec:'Anes',workType:'Full-Time'},{name:'นพ. สุเมธ วงศ์พิมพ์',spec:'Anes',workType:'Full-Time'},{name:'พญ. จริยา เลาหสุขไพศาล',spec:'Anes',workType:'Full-Time'},{name:'พญ. อภิญญา ศิริธนากิจ',spec:'Anes',workType:'Full-Time'},
  {name:'นพ. เอกลักษณ์ คูณสิริไพบูลย์',spec:'Cardio',workType:'Full-Time'},{name:'นพ. มนตรี เจริญพานิชสันติ',spec:'Cardio',workType:'Full-Time'},{name:'นพ. สุทิน จันทิมา',spec:'Cardio',workType:'Full-Time'},{name:'นพ. วันชาติ โพธิ์ศรี',spec:'Cardio',workType:'Part-Time'},{name:'พญ. ชนินาถ ผ่องศรี',spec:'Cardio',workType:'Full-Time'},
  {name:'นพ. ณรงค์ นาคเจริญวารี',spec:'Med',workType:'Full-Time'},{name:'นพ. ดุษฎี วิชญชีวินทร์',spec:'Med',workType:'Full-Time'},{name:'นพ. เกรียงไกร บุญประชม',spec:'Med',workType:'Full-Time'},{name:'นพ. นพนาท เทียนทอง',spec:'Med',workType:'Full-Time'},{name:'นพ. บัญชา ยศธนายน',spec:'Med',workType:'Full-Time'},{name:'นพ. สมมิตร ปริยอัครกุล',spec:'Med',workType:'Full-Time'},{name:'พญ. เนตรชนก สามไชย',spec:'Med',workType:'Full-Time'},{name:'พญ. ธนะนันท์ ตรงกมลธรรม',spec:'Med',workType:'Full-Time'},
  {name:'นพ. เฉลิมพล ชคัตตรยาพงษ์',spec:'Neuro',workType:'Full-Time'},{name:'นพ. นิติพร วิศิษฎ์สกุล',spec:'Neuro',workType:'Full-Time'},{name:'นพ. วิโรจน์ เจียมศิริ',spec:'Neuro',workType:'Full-Time'},{name:'นพ. สิปปนนท์ สามไชย',spec:'Neuro',workType:'Full-Time'},
  {name:'นพ. คงพันธ์ เหมือนมยุรฉัตร',spec:'ER',workType:'Full-Time'},{name:'นพ. ธวัชชัย แซ่เตีย',spec:'ER',workType:'Full-Time'},{name:'นพ. ศุภณัฐ โสภณอุดมสิน',spec:'ER',workType:'Full-Time'}
];

function mergeStaffFromDefaults() {
  ALL_DEPTS.forEach(d => {
    if(!stCfg[d]) stCfg[d] = {RN:[],PN:[]};
    ['RN','PN'].forEach(role => {
      const def = DEF_ST[d]?.[role] || [];
      const cur = stCfg[d][role] || [];
      def.forEach(n => { if(n && !cur.includes(n)) cur.push(n); });
      stCfg[d][role] = cur;
    });
  });
}

// ════════════════════════════════════════
// STORAGE — Supabase + localStorage fallback
// ════════════════════════════════════════
function emptyBed(id, d) {
  return {id, dept:d, deptType:(DEPTS[d]?.types[0]||''), dx:[], patientCode:'', master:'', consult:[], rn:'', plan:'อยู่ต่อ', checks:[], transferWard:'', transferRoom:'', transferBed:'', transferRoomType:'', transferMonitor:'', transferGenderPref:'', transferTime:'', gender:'', age:'', admitDate:'', los:'', orNote:'', ccNote:'', presentNote:'', class:'', class5Items:[], class5Other:''};
}
function sanitizeBedPrivacy(b) {
  const {id,dept:d,deptType,dx,patientCode,master,consult,rn,plan,checks,transferWard,transferRoom,transferBed,transferRoomType,transferMonitor,transferGenderPref,transferTime,gender,age,admitDate,los,orNote,ccNote,presentNote} = b;
  return {id,dept:d,deptType,dx:dx||[],patientCode:patientCode||'',master:master||'',consult:consult||[],rn:rn||'',plan:plan||'อยู่ต่อ',checks:checks||[],transferWard:transferWard||'',transferRoom:transferRoom||'',transferBed:transferBed||'',transferRoomType:transferRoomType||'',transferMonitor:transferMonitor||'',transferGenderPref:transferGenderPref||'',transferTime:transferTime||'',gender:gender||'',age:age||'',admitDate:admitDate||'',los:los||'',orNote:orNote||'',ccNote:ccNote||'',presentNote:presentNote||'',class:b.class||'',class5Items:Array.isArray(b.class5Items)?b.class5Items:[],class5Other:b.class5Other||''};
}
function initBeds() {
  ALL_DEPTS.forEach(d => {
    if(!allBeds[d]) allBeds[d] = {};
    for(let i = 1; i <= DEPTS[d].beds; i++) {
      const sid = String(i);
      if(!allBeds[d][sid]) {
        allBeds[d][sid] = emptyBed(sid, d);
        allBeds[d][sid].deptType = DEPTS[d].types[0];
      }
    }
  });
}

// load: อ่านจาก Supabase (แผนกที่ user ของตัวเอง) หรือ localStorage
async function load() {
  const sb = await getSupabase();
  if(sb) {
    try {
      const depts = ALL_DEPTS;
      for(const d of depts) {
        const {data, error} = await sb.from('ccu_state').select('beds,wards,st_cfg,doctors,report_history').eq('id', d).single();
        if(!error && data) {
          if(data.beds) allBeds[d] = data.beds;
          if(data.wards) wards[d] = data.wards[d] || wards[d] || {};
          if(data.st_cfg) stCfg[d] = data.st_cfg[d] || stCfg[d] || {};
          if(data.doctors && data.doctors.length) doctors = data.doctors;
          if(data.report_history && data.report_history.length) rptHist = data.report_history;
        }
      }
      initBeds();
      return;
    } catch(e) { console.warn('Supabase load error, using localStorage:', e); }
  }
  // Fallback: localStorage
  try {
    const raw = JSON.parse(localStorage.getItem(SK) || '{}');
    if(raw.beds) allBeds = raw.beds;
    if(raw.wards) wards = raw.wards;
    if(raw.stCfg) stCfg = raw.stCfg;
    if(raw.doctors && raw.doctors.length) doctors = raw.doctors;
    if(raw.rptHist) rptHist = raw.rptHist;
  } catch(e) {}
  initBeds();
}

// loadAll: load doctors + stCfg + rptHist (ใช้ใน admin mode)
async function loadAll() {
  await load();
  mergeStaffFromDefaults();
  if(!doctors.length) {
    doctors = [...DEF_DR];
  } else {
    DEF_DR.forEach(d => { if(!doctors.find(x => x.name === d.name)) doctors.push(d); });
  }
}

// persist: บันทึกข้อมูลเตียง+เวร (เรียกบ่อย)
async function persist() {
  const sb = await getSupabase();
  const d = editDept || dept;
  const payload = {
    id: d,
    beds: allBeds[d] || {},
    wards: {[d]: wards[d] || {}},
    st_cfg: {[d]: stCfg[d] || {}},
    doctors: doctors,
    report_history: rptHist,
    updated_at: new Date().toISOString()
  };
  let dbFailed = false;
  if(sb) {
    try {
      const {error} = await sb.from('ccu_state').upsert(payload, {onConflict:'id'});
      if(error) throw error;
      return true;
    } catch(e) { console.warn('Supabase persist error, falling back:', e); dbFailed = true; }
  }
  // Fallback: localStorage
  const raw = JSON.parse(localStorage.getItem(SK) || '{}');
  if(!raw.beds) raw.beds = {};
  raw.beds[d] = allBeds[d] || {};
  raw.wards = {...(raw.wards||{}), [d]: wards[d]||{}};
  raw.stCfg = {...(raw.stCfg||{}), [d]: stCfg[d]||{}};
  raw.doctors = doctors;
  raw.rptHist = rptHist;
  localStorage.setItem(SK, JSON.stringify(raw));
  try { new BroadcastChannel('ccu_bc').postMessage('u'); } catch{}
  // true = บันทึกเข้าที่เก็บที่ตั้งใจไว้สำเร็จ (โหมด local) ; false = ตั้งใจเขียน DB กลางแต่โดนปฏิเสธสิทธิ์
  return sb && dbFailed ? false : true;
}

// saveAll: บันทึก doctors + stCfg + rptHist ทุกแผนก
async function saveAll() {
  const sb = await getSupabase();
  if(sb) {
    try {
      for(const d of ALL_DEPTS) {
        const {error} = await sb.from('ccu_state').upsert({
          id: d,
          beds: allBeds[d] || {},
          wards: {[d]: wards[d] || {}},
          st_cfg: {[d]: stCfg[d] || {}},
          doctors: doctors,
          report_history: rptHist,
          updated_at: new Date().toISOString()
        }, {onConflict:'id'});
        if(error) console.warn('saveAll error for', d, error);
      }
      return;
    } catch(e) { console.warn('Supabase saveAll error:', e); }
  }
  const raw = JSON.parse(localStorage.getItem(SK) || '{}');
  raw.beds = allBeds;
  raw.wards = wards;
  raw.stCfg = stCfg;
  raw.doctors = doctors;
  raw.rptHist = rptHist;
  localStorage.setItem(SK, JSON.stringify(raw));
  try { new BroadcastChannel('ccu_bc').postMessage('u'); } catch{}
}

// ════════════════════════════════════════
// SUPABASE AUTH + REALTIME
// ════════════════════════════════════════
async function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  const err = document.getElementById('login-err');
  const btn = document.getElementById('login-btn');
  if(!u) { showLoginErr('❌ กรุณากรอกอีเมล'); return; }
  if(!p) { showLoginErr('❌ กรุณากรอกรหัสผ่าน'); return; }

  btn.disabled = true;
  document.getElementById('login-btn-icon').textContent = '⏳';
  document.getElementById('login-btn-text').textContent = 'กำลังเข้าสู่ระบบ...';
  err.style.display = 'none';

  const sb = await getSupabase();
  if(sb) {
    try {
      const {data, error} = await sb.auth.signInWithPassword({email: u, password: p});
      if(error) throw error;
      const meta = data.user?.user_metadata || {};
      currentUser = data.user?.email || u;
      currentUserMeta = meta;
      afterLogin(meta.dept || guessDeptFromEmail(u), meta.role || 'staff');
      return;
    } catch(e) {
      showLoginErr('❌ ' + (e.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'));
      btn.disabled = false;
      document.getElementById('login-btn-icon').textContent = '🔐';
      document.getElementById('login-btn-text').textContent = 'เข้าสู่ระบบ';
      return;
    }
  }
  // Fallback local login
  const USERS = {admin:'1234',ccu:'1234',icu:'1234',ncu:'1234'};
  const uKey = u.split('@')[0].toLowerCase();
  if(USERS[uKey] !== p) { showLoginErr('❌ รหัสผ่านไม่ถูกต้อง'); btn.disabled = false; document.getElementById('login-btn-icon').textContent = '🔐'; document.getElementById('login-btn-text').textContent = 'เข้าสู่ระบบ'; return; }
  currentUser = uKey;
  currentUserMeta = {dept: uKey.toUpperCase() === 'ADMIN' ? null : uKey.toUpperCase(), role: uKey === 'admin' ? 'admin' : 'staff'};
  afterLogin(currentUserMeta.dept, currentUserMeta.role);
}

function showLoginErr(msg) {
  const err = document.getElementById('login-err');
  err.textContent = msg;
  err.style.display = 'block';
}
function guessDeptFromEmail(email) {
  const prefix = (email || '').split('@')[0].toUpperCase();
  if(prefix.includes('CCU')) return 'CCU';
  if(prefix.includes('NCU')) return 'NCU';
  if(prefix.includes('ICU')) return 'ICU';
  return null;
}
function isAdminUser() {
  return currentUserMeta.role === 'admin';
}
function afterLogin(deptHint, role) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
  const pill = document.getElementById('user-pill-wrap');
  pill.textContent = '👤 ' + (currentUser || '');
  pill.style.display = 'inline-block';

  if(role !== 'admin') {
    document.getElementById('mode-admin').style.display = 'none';
  }
  const deptSel = document.getElementById('dept-sel');
  deptSel.value = 'ALL';
  dept = 'ALL';
  const note = document.getElementById('access-note');
  if(note) note.textContent = role === 'admin' ? '' : 'ดูได้ทุกแผนก · นำเข้ารายงานได้';
  initApp();
}
async function doLogout() {
  if(!confirm('ต้องการออกจากระบบ?')) return;
  const sb = await getSupabase();
  if(sb) { try { await sb.auth.signOut(); } catch{} }
  currentUser = '';
  currentUserMeta = {};
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-user').value = '';
  document.getElementById('login-btn').disabled = false;
  document.getElementById('login-btn-icon').textContent = '🔐';
  document.getElementById('login-btn-text').textContent = 'เข้าสู่ระบบ';
}
async function setupRealtime() {
  const sb = await getSupabase();
  if(!sb) return;
  sb.channel('ccu_realtime')
    .on('postgres_changes', {event:'*', schema:'public', table:'ccu_state'}, payload => {
      load().then(() => {
        renderTable(); renderStaff();
        if(document.getElementById('transfer-mode')?.style.display === 'flex') renderTransferDashboard();
        toast('🔄 ข้อมูลอัปเดต (realtime)','#1a6fcc');
      });
    })
    .subscribe();
}

// ════════════════════════════════════════
// MODE SWITCH
// ════════════════════════════════════════
function switchMode(m) {
  const adminLike = (m === 'admin' || m === 'import');
  document.getElementById('dash-mode').style.display = m === 'dashboard' ? 'flex' : 'none';
  document.getElementById('admin-mode').style.display = adminLike ? 'flex' : 'none';
  const tm = document.getElementById('transfer-mode'); if(tm) tm.style.display = m === 'transfer' ? 'flex' : 'none';
  document.getElementById('mode-dash').classList.toggle('active', m === 'dashboard');
  document.getElementById('mode-admin').classList.toggle('active', m === 'admin');
  const miBtn = document.getElementById('mode-import'); if(miBtn) miBtn.classList.toggle('active', m === 'import');
  const mtBtn = document.getElementById('mode-transfer'); if(mtBtn) mtBtn.classList.toggle('active', m === 'transfer');
  // Show admin-only nav tabs only for admins; staff in import mode see import tab only
  const adminOnlyTabs = ['nav-doctors','nav-staff','nav-users'];
  adminOnlyTabs.forEach(id => { const el = document.getElementById(id); if(el) el.style.display = isAdminUser() ? '' : 'none'; });
  if(m === 'dashboard') { renderTable(); renderStaff(); }
  if(m === 'admin') { loadAll().then(() => { renderHist(); renderSpecTabs(); renderDrList(); renderAdminStaffList(); gotoPage('import', document.getElementById('nav-import')); }); }
  if(m === 'import') { loadAll().then(() => { renderHist(); gotoPage('import', document.getElementById('nav-import')); }); }
  if(m === 'transfer') { load().then(() => renderTransferDashboard()); }
}

// ════════════════════════════════════════
// CLOCK
// ════════════════════════════════════════
function tick() {
  const n = new Date();
  const cl = document.getElementById('clock');
  const df = document.getElementById('datef');
  if(cl) cl.textContent = n.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  if(df) df.textContent = `${n.getDate()} ${MONTHS[n.getMonth()]} ${n.getFullYear()+543}`;
}

// ════════════════════════════════════════
// PILLS
// ════════════════════════════════════════
const pill = (l,bg,tx,br,sz=11) => `<span class="pill" style="background:${bg};color:${tx};border-color:${br};font-size:${sz}px;">${l}</span>`;
const tpill = t => { const c = TC[t]||TC['ฝากนอน']; return `<span class="tpill" style="background:${c.bg};color:${c.tx};border-color:${c.br};">${t}</span>`; };
const planpill = p => { const c = PC[p]||PC['อยู่ต่อ']; const l = PLANS.find(x=>x.v===p)?.l||p; return pill(l,c.bg,c.tx,c.br); };
const dxpill = dx => { const c = DXC(dx)||{bg:'#e8eef6',tx:'#1a3a6a',br:'#b8cce0'}; return pill(dx,c.bg,c.tx,c.br); };

// ════════════════════════════════════════
// DEPT
// ════════════════════════════════════════
function syncDeptFromSelect() {
  const sel = document.getElementById('dept-sel');
  if(sel) dept = sel.value;
}
function isAllView() { syncDeptFromSelect(); return dept === 'ALL'; }
function bedDept(b) { return b._dept || b.dept; }
function deptPill(d) { const c = {CCU:'ccu',NCU:'ncu',ICU:'icu'}[d]||'ccu'; return `<span class="dept-pill ${c}">${d}</span>`; }
function statsForDept(beds, d) {
  const sub = beds.filter(b => bedDept(b) === d);
  const occ = sub.filter(b => b.dx?.length || b.plan === 'รอรับใหม่').length;
  return {occ, total:DEPTS[d].beds, dc:sub.filter(b=>['D/C','plan D/C'].includes(b.plan)).length, ward:sub.filter(b=>b.plan?.includes('ย้าย')&&b.plan?.includes('รอ')).length, got:sub.filter(b=>b.plan?.includes('ย้าย')&&b.plan?.includes('ได้')).length, ref:sub.filter(b=>b.plan==='refer').length};
}
function changeDept() {
  syncDeptFromSelect();
  if(isAllView()) {
    document.getElementById('dtitle').textContent = 'รวม 3 แผนก DASHBOARD';
    document.getElementById('dfull').textContent = 'CCU · NCU · ICU — ภาพรวมทุกเตียง';
  } else {
    editDept = dept;
    document.getElementById('dtitle').textContent = dept + ' DASHBOARD';
    document.getElementById('dfull').textContent = DEPTS[dept]?.full || '';
  }
  const resetBtn = document.querySelector('.breset');
  if(resetBtn) resetBtn.style.display = isAllView() ? 'none' : '';
  renderLegend(); renderTable(); renderStaff();
}
function renderLegend() {
  const types = isAllView() ? ['CCU','IMCCU','NCU','IMNCU','ICU','IMCU','ฝากนอน'] : (DEPTS[dept]?.types || []);
  const el = document.getElementById('tleg');
  if(el) el.innerHTML = types.map(t => tpill(t)).join('');
}

// ════════════════════════════════════════
// STAFF
// ════════════════════════════════════════
function toggleStaff() {
  staffExp = !staffExp;
  document.getElementById('sstrip').style.display = staffExp ? 'none' : 'flex';
  document.getElementById('sexp').style.display = staffExp ? 'block' : 'none';
  if(isAllView()) renderStaff();
}
function renderStaff() {
  syncDeptFromSelect();
  if(isAllView()) {
    const depts = ['CCU','NCU','ICU'];
    if(staffExp) {
      document.getElementById('se-inc').textContent = depts.map(d=>`${d}: ${(wards[d]||{}).inCharge||'—'}`).join(' · ');
      document.getElementById('se-tl').textContent  = depts.map(d=>`${d}: ${(wards[d]||{}).teamLead||'—'}`).join(' · ');
      document.getElementById('se-cb').textContent  = depts.map(d=>`${d}: ${(wards[d]||{}).codeBlue||'—'}`).join(' · ');
      document.getElementById('se-dr').textContent  = depts.map(d=>`${d}: ${(wards[d]||{}).doctorNight||'—'}`).join(' · ');
      document.getElementById('se-rn').innerHTML = depts.map(d=>{const w=wards[d]||{};const sc=stCfg[d]||{};const rns=w.shiftRN?.length?w.shiftRN:(sc.RN||[]);return`<div style="margin-bottom:5px;"><span style="font-size:10px;font-weight:700;color:var(--blue);">${d}</span> ${rns.length?rns.map(n=>`<span class="ch rn">${n}</span>`).join(''):'<span style="color:var(--txm);">—</span>'}</div>`;}).join('');
      document.getElementById('se-pn').innerHTML = depts.map(d=>{const w=wards[d]||{};const sc=stCfg[d]||{};const pns=w.shiftPN?.length?w.shiftPN:(sc.PN||[]);return`<div style="margin-bottom:5px;"><span style="font-size:10px;font-weight:700;color:var(--ambl);">${d}</span> ${pns.length?pns.map(n=>`<span class="ch pn">${n}</span>`).join(''):'<span style="color:var(--txm);">—</span>'}</div>`;}).join('');
    } else {
      document.getElementById('s-inc').textContent = 'รวม 3 แผนก';
      document.getElementById('s-tl').textContent = '▼ ขยาย';
      document.getElementById('s-cb').textContent = '';
      document.getElementById('s-dr').textContent = '';
    }
    return;
  }
  const w = wards[dept]||{}; const sc = stCfg[dept]||{};
  const rns = w.shiftRN?.length ? w.shiftRN : (sc.RN||[]);
  const pns = w.shiftPN?.length ? w.shiftPN : (sc.PN||[]);
  ['inc','tl','cb','dr'].forEach((k,i) => {
    const v = ['inCharge','teamLead','codeBlue','doctorNight'][i];
    ['s-','se-'].forEach(p => { const el = document.getElementById(p+k); if(el) el.textContent = w[v]||'—'; });
  });
  const seRn = document.getElementById('se-rn'); if(seRn) seRn.innerHTML = rns.map(n=>`<span class="ch rn">${n}</span>`).join('');
  const sePn = document.getElementById('se-pn'); if(sePn) sePn.innerHTML = pns.map(n=>`<span class="ch pn">${n}</span>`).join('');
  const all = [...(sc.RN||[]),...(sc.PN||[])];
  const rnDl = document.getElementById('rn-dl'); if(rnDl) rnDl.innerHTML = all.map(n=>`<option value="${n}">`).join('');
  const pnDl = document.getElementById('pn-dl'); if(pnDl) pnDl.innerHTML = (sc.PN||[]).map(n=>`<option value="${n}">`).join('');
}
function openStaff() {
  if(isAllView()) { toast('เลือกแผนก CCU / NCU / ICU ก่อนแก้ไขบุคลากรเวร','#1a6fcc'); return; }
  const w = wards[dept]||{};
  document.getElementById('sdlbl').textContent = dept;
  document.getElementById('w-inc').value = w.inCharge||'';
  document.getElementById('w-tl').value  = w.teamLead||'';
  document.getElementById('w-cb').value  = w.codeBlue||'';
  document.getElementById('w-dr').value  = w.doctorNight||'';
  editSRN = [...(w.shiftRN||[])]; editSPN = [...(w.shiftPN||[])];
  renderST();
  document.getElementById('staff-modal').classList.add('open');
}
function closeStaff() { document.getElementById('staff-modal').classList.remove('open'); }
function addSM(role) {
  const id = role === 'RN' ? 'w-ri' : 'w-pi';
  const v = document.getElementById(id).value.trim();
  if(!v) return;
  if(role === 'RN' && !editSRN.includes(v)) editSRN.push(v);
  if(role === 'PN' && !editSPN.includes(v)) editSPN.push(v);
  document.getElementById(id).value = '';
  renderST();
}
function remSM(role, n) {
  if(role === 'RN') editSRN = editSRN.filter(x => x !== n);
  else editSPN = editSPN.filter(x => x !== n);
  renderST();
}
function renderST() {
  const srnEl = document.getElementById('srn-t');
  const spnEl = document.getElementById('spn-t');
  if(srnEl) {
    srnEl.innerHTML = editSRN.length ? editSRN.map(n=>`<span class="stag rntag">${n}<button type="button" class="stagx" data-role="RN" data-name="${n.replace(/"/g,'&quot;')}">✕</button></span>`).join('') : '<span style="font-size:11px;color:var(--txm);">ยังไม่มี RN</span>';
    srnEl.querySelectorAll('.stagx').forEach(btn => { btn.onclick = function(){remSM(this.dataset.role,this.dataset.name);}; });
  }
  if(spnEl) {
    spnEl.innerHTML = editSPN.length ? editSPN.map(n=>`<span class="stag pntag">${n}<button type="button" class="stagx" data-role="PN" data-name="${n.replace(/"/g,'&quot;')}">✕</button></span>`).join('') : '<span style="font-size:11px;color:var(--txm);">ยังไม่มี PN</span>';
    spnEl.querySelectorAll('.stagx').forEach(btn => { btn.onclick = function(){remSM(this.dataset.role,this.dataset.name);}; });
  }
}
function saveStaff() {
  wards[dept] = {inCharge:document.getElementById('w-inc').value,teamLead:document.getElementById('w-tl').value,codeBlue:document.getElementById('w-cb').value,doctorNight:document.getElementById('w-dr').value,shiftRN:[...editSRN],shiftPN:[...editSPN]};
  persist(); renderStaff(); closeStaff();
}

// ════════════════════════════════════════
// TABLE
// ════════════════════════════════════════
function toggleEmpty() { showEmpty = !showEmpty; document.getElementById('tbtn').textContent = showEmpty ? 'ซ่อนว่าง' : 'แสดงว่าง'; renderTable(); }
function getBedsForView() {
  syncDeptFromSelect();
  if(isAllView()) { const beds=[]; ALL_DEPTS.forEach(d=>Object.values(allBeds[d]||{}).forEach(b=>beds.push({...b,_dept:d}))); return beds; }
  return Object.values(allBeds[dept]||{}).sort((a,b)=>parseInt(a.id)-parseInt(b.id));
}
function totalBedCount() { return isAllView() ? ALL_DEPTS.reduce((s,d)=>s+DEPTS[d].beds,0) : (DEPTS[dept]?.beds||0); }
function renderTable() {
  syncDeptFromSelect(); updateTableHead();
  const all = isAllView(); const beds = getBedsForView();
  const vis = showEmpty ? beds : beds.filter(b=>b.dx?.length||b.plan==='รอรับใหม่');
  let occ=0,dc=0,ward=0,got=0,ref=0;
  beds.forEach(b=>{if(b.dx?.length||b.plan==='รอรับใหม่')occ++;if(['D/C','plan D/C'].includes(b.plan))dc++;if(b.plan?.includes('ย้าย')&&b.plan?.includes('รอ'))ward++;if(b.plan?.includes('ย้าย')&&b.plan?.includes('ได้'))got++;if(b.plan==='refer')ref++;});
  const occLbl = document.getElementById('st-occ-lbl'); const deptWrap = document.getElementById('st-dept-wrap'); const deptBrk = document.getElementById('st-dept-brk');
  if(all) {
    if(occLbl) occLbl.textContent = 'ผู้ป่วยรวม';
    document.getElementById('st-occ').textContent = `${occ}/${totalBedCount()}`;
    if(deptWrap) deptWrap.style.display = 'flex';
    if(deptBrk) deptBrk.innerHTML = ALL_DEPTS.map(d=>{const s=statsForDept(beds,d);return`${deptPill(d)} ${s.occ}/${s.total}`;}).join(' ');
  } else {
    if(occLbl) occLbl.textContent = 'ผู้ป่วย';
    document.getElementById('st-occ').textContent = `${occ}/${totalBedCount()}`;
    if(deptWrap) deptWrap.style.display = 'none';
  }
  document.getElementById('st-dc').textContent=dc; document.getElementById('st-ward').textContent=ward; document.getElementById('st-got').textContent=got; document.getElementById('st-ref').textContent=ref;
  const tbody = document.getElementById('tbody'); const cols = all ? 8 : 7;
  if(all) {
    let html = '';
    ALL_DEPTS.forEach(d=>{
      const sub = beds.filter(x=>bedDept(x)===d).sort((a,b)=>parseInt(a.id)-parseInt(b.id));
      const subVis = showEmpty ? sub : sub.filter(b=>b.dx?.length||b.plan==='รอรับใหม่');
      const s = statsForDept(beds,d);
      html += `<tr class="dept-sec"><td colspan="${cols}">${deptPill(d)} ${DEPTS[d].full} — ผู้ป่วย ${s.occ}/${s.total} เตียง · D/C ${s.dc} · รอย้าย ${s.ward} · ได้ห้อง ${s.got} · Refer ${s.ref}</td></tr>`;
      if(subVis.length) html += subVis.map(b=>renderRow(b,true)).join('');
      else if(!showEmpty) html += `<tr><td colspan="${cols}" style="text-align:center;padding:14px;color:var(--txm);font-size:12px;">ไม่มีผู้ป่วยใน ${d}</td></tr>`;
      else html += sub.map(b=>renderRow(b,true)).join('');
    });
    tbody.innerHTML = html; return;
  }
  if(!vis.length) { tbody.innerHTML=`<tr><td colspan="${cols}" style="text-align:center;padding:40px;color:var(--txm);">ไม่มีผู้ป่วยในขณะนี้</td></tr>`; return; }
  tbody.innerHTML = vis.map(b=>renderRow(b,false)).join('');
}
function renderRow(b, showDept) {
  const occ = b.dx?.length || b.plan === 'รอรับใหม่';
  const cl = CL[b.plan]||[]; const checks = b.checks||[];
  const isDC = ['D/C','plan D/C','refer'].includes(b.plan);
  const chkN = cl.filter(i=>checks.includes(i.id)).length;
  const complete = isDC && cl.length ? cl.every(i=>checks.includes(i.id)) : null;
  const pct = cl.length ? Math.round(chkN/cl.length*100) : 0;
  const pc = complete===false?'#c0392b':complete?'#0e8060':'#1a6fcc';
  const showCl = isDC ? cl.filter(i=>!checks.includes(i.id)) : cl.filter(i=>checks.includes(i.id));
  const dc2 = isDC?{bg:'#fce8e8',tx:'#8a1a1a',br:'#d07070'}:b.plan?.includes('ย้าย')?{bg:'#d8eaf8',tx:'#1a3a6a',br:'#7ab0d8'}:{bg:'#d0eedc',tx:'#0a5030',br:'#6ec8a0'};
  const clHtml = cl.length ? `<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;"><div style="height:3px;background:#d8e4ef;border-radius:3px;width:70px;"><div style="height:3px;width:${pct}%;background:${pc};border-radius:3px;"></div></div><span style="font-size:10px;color:${pc};font-family:monospace;">${chkN}/${cl.length}</span>${complete===false?'<span style="font-size:11px;color:#c0392b;animation:bp 1.5s infinite;">!</span>':''}${complete===true?'<span style="font-size:10px;color:#0e8060;font-weight:700;">✓</span>':''}</div><div class="chkmini">${showCl.slice(0,4).map(i=>`<span class="chkdot" style="background:${dc2.bg};color:${dc2.tx};border-color:${dc2.br};">${isDC?'○ ':'✓ '}${i.l}</span>`).join('')}${showCl.length>4?`<span style="font-size:10px;color:var(--txd);">+${showCl.length-4}</span>`:''}</div>` : '';
  const md = doctors.find(x=>x.name===b.master);
  const mh = b.master ? `${b.master}${md?` <span style="font-size:10px;color:var(--txd);">(${md.spec})</span>`:''}` : '';
  const ch = (b.consult||[]).map(c=>{const dr=doctors.find(x=>x.name===c);return`<div style="font-size:11px;color:var(--txd);">${c}${dr?` (${dr.spec})`:''}</div>`;}).join('');
  let planX = '';
  if(b.plan==='ย้ายward รอห้อง'&&b.transferRoomType) planX=`<div style="font-size:10px;color:var(--ambl);margin-top:2px;">${b.transferRoomType}</div>`;
  if(b.plan==='ย้าย ward ได้ห้องแล้ว'&&(b.transferRoom||b.transferWard)) planX=`<div style="font-size:10px;color:var(--blue);margin-top:2px;">Ward ${b.transferWard} ห้อง ${b.transferRoom}${b.transferBed?' เตียง '+b.transferBed:''}</div>`;
  const rb = complete===false?'#f0b8b8':'#d8e4ef';
  const gb = b.gender ? `<span class="${b.gender==='ชาย'?'gbm':'gbf'}">${b.gender==='ชาย'?'ช':'ญ'}</span> ` : '';
  // Class pill (C1-C5) — shown AFTER Dx
  const clsTag = b.class ? (()=>{
    const c = CLASS_COLORS[String(b.class)]; if(!c) return '';
    return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:${c.bg};color:${c.tx};border:1px solid ${c.br};" title="${c.l}">C${b.class}</span>`;
  })() : '';
  // Class 5 critical items — shown only when class=5
  const c5ItemsHtml = (String(b.class)==='5' && (b.class5Items||[]).length) ? (b.class5Items.map(id=>{
    const opt = CLASS5_OPTIONS.find(o=>o.id===id);
    return opt ? `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;background:#fce8e8;color:#8a1a1a;border:1px solid #d88080;" title="${opt.l}">${opt.icon} ${opt.l}</span>` : '';
  }).join('')) : '';
  const c5OtherHtml = (String(b.class)==='5' && b.class5Other) ? `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;background:#fce8e8;color:#8a1a1a;border:1px solid #d88080;">+ ${b.class5Other}</span>` : '';
  const classRow = (clsTag || c5ItemsHtml || c5OtherHtml)
    ? `<div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:3px;align-items:center;">${clsTag}${c5ItemsHtml}${c5OtherHtml}</div>`
    : '';
  const dxHtml = (b.dx||[]).length ? `<div class="dxrow">${(b.dx||[]).map(d=>dxpill(d)).join('')}</div>` : b.plan==='รอรับใหม่' ? pill('รอรับใหม่','#f8e0e8','#8a1a3a','#d87aaa') : `<span style="color:var(--txm);font-size:11px;">—</span>`;
  const d = bedDept(b);
  const openFn = showDept ? `openBed('${d}','${b.id}')` : `openBed('${b.id}')`;
  const deptCell = showDept ? `<td style="padding:7px 8px;text-align:center;vertical-align:middle;">${deptPill(d)}</td>` : '';
  return `<tr onclick="${openFn}" style="border-bottom:1px solid ${rb};">
    ${deptCell}
    <td style="padding:7px 8px;"><div class="bedc" style="background:${occ?'#1a6fcc':'#d8e8f4'};color:${occ?'#fff':'#8aabcc'};">${b.id}</div>${occ&&b.deptType?`<div style="text-align:center;margin-top:2px;">${tpill(b.deptType)}</div>`:''}</td>
    <td style="padding:7px 8px;">${occ?`${gb}${b.age?`<span style="font-size:11px;color:var(--txd);">${b.age} ปี</span>`:''}${b.los?`<span style="font-size:10px;color:var(--txd);margin-left:4px;">LOS ${b.los}d</span>`:''}<div style="font-size:10px;color:var(--txm);">${b.admitDate?'Admit '+b.admitDate:''}</div>${b.patientCode?`<span style="background:var(--purd);color:var(--pur);border:1px solid var(--pur);border-radius:999px;padding:1px 5px;font-size:10px;">${b.patientCode}</span>`:''}${b.rn?`<div style="font-size:10px;color:#0e8060;margin-top:2px;">RN: ${b.rn}</div>`:''}`:''}
    </td>
    <td style="padding:7px 8px;">${dxHtml}${classRow}</td>
    <td style="padding:7px 8px;font-size:12px;">${mh||`<span style="color:var(--txm);">—</span>`}</td>
    <td style="padding:7px 8px;">${ch||`<span style="color:var(--txm);">—</span>`}</td>
    <td style="padding:7px 8px;">${planpill(b.plan||'อยู่ต่อ')}${planX}</td>
    <td style="padding:7px 8px;">${clHtml}</td>
  </tr>`;
}
function updateTableHead() {
  const all = isAllView();
  document.getElementById('tbl-cols').innerHTML = all
    ? '<col style="width:52px"><col style="width:72px"><col style="width:12%"><col style="width:17%"><col style="width:13%"><col style="width:13%"><col style="width:12%"><col>'
    : '<col style="width:78px"><col style="width:13%"><col style="width:18%"><col style="width:14%"><col style="width:14%"><col style="width:13%"><col>';
  document.getElementById('tbl-head').innerHTML = all
    ? '<th>แผนก</th><th>เตียง/ห้อง</th><th>ผู้ป่วย</th><th>Dx.</th><th>Master</th><th>Consult</th><th>Plan</th><th>Checklist</th>'
    : '<th>เตียง/ห้อง</th><th>ผู้ป่วย</th><th>Dx.</th><th>Master</th><th>Consult</th><th>Plan</th><th>Checklist</th>';
}

// ════════════════════════════════════════
// BED MODAL
// ════════════════════════════════════════
function openBed(d, id) {
  syncDeptFromSelect();
  if(id === undefined) { id = d; d = isAllView() ? (editDept||'CCU') : dept; }
  editDept = d; editId = id;
  const b = allBeds[editDept]?.[id] || emptyBed(id, editDept);
  editChecks=[...(b.checks||[])]; editConsults=[...(b.consult||[])]; editDx=[...(b.dx||[])];
  editClass5Items = [...(b.class5Items||[])];
  const occ = b.dx?.length || b.plan === 'รอรับใหม่';
  document.getElementById('m-title').textContent = `เตียง ${id} — ${editDept}`;
  document.getElementById('m-tb').innerHTML = b.deptType ? tpill(b.deptType) : '';
  document.getElementById('swbtn').style.display = occ ? 'inline-block' : 'none';
  buildTypeBtns(b.deptType||DEPTS[editDept].types[0]);
  document.getElementById('m-gen').value   = b.gender||'';
  document.getElementById('m-age').value   = b.age||'';
  document.getElementById('m-code').value  = b.patientCode||'';
  document.getElementById('m-admit').value = b.admitDate||'';
  document.getElementById('m-los').value   = b.los||'';
  document.getElementById('m-or').value    = b.orNote||'';
  document.getElementById('m-cc').value    = b.ccNote||'';
  document.getElementById('m-present').value = b.presentNote||'';
  renderDxTags();
  document.getElementById('m-mi').value = b.master||'';
  document.getElementById('m-mv').value = b.master||'';
  renderMasterTag(b.master||'');
  renderConsTags();
  document.getElementById('m-rn').value = b.rn||'';
  // Populate RN/PN datalist for THIS bed's department (works in ALL view too)
  const sc = stCfg[editDept] || {};
  const allNurses = [...(sc.RN||[]), ...(sc.PN||[])];
  const rnDl = document.getElementById('rn-dl');
  if(rnDl) rnDl.innerHTML = allNurses.map(n => `<option value="${n}">`).join('');
  buildClassBtns(b.class||'');
  buildClass5Items(editClass5Items);
  const c5o = document.getElementById('m-class5-other'); if(c5o) c5o.value = b.class5Other || '';
  const c5box = document.getElementById('box-class5'); if(c5box) c5box.style.display = String(b.class) === '5' ? 'block' : 'none';
  buildPlanBtns(b.plan||'อยู่ต่อ');
  updatePlanExtra(b); buildChk(b.plan||'อยู่ต่อ');
  document.getElementById('bed-modal').classList.add('open');
}
function closeBed() { document.getElementById('bed-modal').classList.remove('open'); }
function clearBedForm() { editChecks=[]; editConsults=[]; editDx=[]; editClass5Items=[]; openBed(editDept, editId); }
function clearBedNow() {
  if(!confirm(`ล้างเตียง ${editId} เป็นเตียงว่าง?`)) return;
  const kt = allBeds[editDept]?.[editId]?.deptType || DEPTS[editDept].types[0];
  allBeds[editDept][editId] = emptyBed(editId, editDept);
  allBeds[editDept][editId].deptType = kt;
  persist(); renderTable(); closeBed();
  toast(`🗑 ล้างเตียง ${editId} เรียบร้อย`,'#0e8060');
}
function buildTypeBtns(sel) {
  document.getElementById('type-btns').innerHTML = DEPTS[editDept].types.map(t=>{const s=sel===t;const c=TC[t]||TC['ฝากนอน'];return`<button onclick="selType('${t}')" style="padding:5px 13px;border-radius:var(--r);border:1px solid ${s?c.br:'var(--bdr)'};background:${s?c.bg:'var(--surf2)'};color:${s?c.tx:'var(--txd)'};font-size:13px;cursor:pointer;font-weight:${s?600:400};font-family:inherit;">${t}</button>`;}).join('');
}
function selType(t) {
  if(!allBeds[editDept]) allBeds[editDept] = {};
  allBeds[editDept][editId] = allBeds[editDept][editId] || emptyBed(editId, editDept);
  allBeds[editDept][editId].deptType = t;
  buildTypeBtns(t);
  document.getElementById('m-tb').innerHTML = tpill(t);
}
function addDxP() { const v=document.getElementById('m-dxp').value; if(v&&!editDx.includes(v)){editDx.push(v);renderDxTags();} document.getElementById('m-dxp').value=''; }
function addDxC() { const v=document.getElementById('m-dxc').value.trim(); if(v&&!editDx.includes(v)){editDx.push(v);renderDxTags();} document.getElementById('m-dxc').value=''; }
function remDx(d) { editDx=editDx.filter(x=>x!==d); renderDxTags(); }
function renderDxTags() { document.getElementById('dx-tags').innerHTML=editDx.map(d=>{const c=DXC(d)||{bg:'#e8eef6',tx:'#1a3a6a',br:'#b8cce0'};return`<span class="tagpill" style="background:${c.bg};color:${c.tx};border-color:${c.br};">${d}<span class="tagx" onclick="remDx(${JSON.stringify(d)})">×</span></span>`;}).join(''); }
function buildPlanBtns(sel) { document.getElementById('plan-btns').innerHTML=PLANS.map(p=>{const s=sel===p.v;const c=PC[p.v]||PC['อยู่ต่อ'];return`<button class="plbtn" onclick="selPlan('${p.v}')" style="${s?`border-color:${c.br};background:${c.bg};color:${c.tx};font-weight:600;`:''}">${p.l}</button>`;}).join(''); document.getElementById('m-plan').value=sel; buildChk(sel); }
function selPlan(p) { editChecks=[]; buildPlanBtns(p); updatePlanExtra({plan:p}); }
function updatePlanExtra(b) {
  const r=b.plan==='ย้ายward รอห้อง', g=b.plan==='ย้าย ward ได้ห้องแล้ว';
  document.getElementById('box-rt').style.display=r?'block':'none';
  document.getElementById('box-dest').style.display=g?'block':'none';
  if(r) {
    buildRoomTypeBtns(b.transferRoomType||'');
    const monEl = document.getElementById('m-mon'); if(monEl) monEl.value = b.transferMonitor || '';
    const tgEl = document.getElementById('m-tgen'); if(tgEl) tgEl.value = b.transferGenderPref || b.gender || '';
  }
  if(g) { document.getElementById('m-tw').value=b.transferWard||''; buildRooms(b.transferWard||''); setTimeout(()=>{document.getElementById('m-tr').value=b.transferRoom||''; document.getElementById('m-tbed').value=b.transferBed||'';},30); }
}
// Class 1-5 buttons (severity)
const CLASS_COLORS = {
  '1':{bg:'#d0eedc',tx:'#0a5030',br:'#6ec8a0',l:'1 — น้อย'},
  '2':{bg:'#d8eaf8',tx:'#1a3a6a',br:'#7ab0d8',l:'2 — เฝ้า'},
  '3':{bg:'#fff3d0',tx:'#7a5200',br:'#e0a020',l:'3 — ปานกลาง'},
  '4':{bg:'#fce8d8',tx:'#6a3010',br:'#d08040',l:'4 — รุนแรง'},
  '5':{bg:'#fce8e8',tx:'#8a1a1a',br:'#d07070',l:'5 — วิกฤต'}
};
// Class 5 — critical care items (multi-select)
const CLASS5_OPTIONS = [
  {id:'vent',  l:'Ventilator',                icon:'🫁'},
  {id:'ino',   l:'Inotrop',                   icon:'💉'},
  {id:'resus', l:'Resuscitate',               icon:'⚡'},
  {id:'cm',    l:'Close monitor (v/s<1hr)',   icon:'⏱'},
  {id:'ap',    l:'Active problems',           icon:'❗'},
  {id:'watch', l:'เฝ้าระวังเฉพาะโรค',         icon:'👁'}
];
function buildClassBtns(sel) {
  const el = document.getElementById('class-btns');
  if(!el) return;
  el.innerHTML = ['1','2','3','4','5'].map(n=>{
    const c = CLASS_COLORS[n]; const s = String(sel)===n;
    return `<button type="button" onclick="selClass('${n}')" style="padding:6px 14px;border-radius:var(--r);border:1.5px solid ${s?c.br:'var(--bdr)'};background:${s?c.bg:'var(--surf2)'};color:${s?c.tx:'var(--txd)'};font-size:14px;cursor:pointer;font-weight:${s?700:500};font-family:inherit;min-width:38px;">${n}</button>`;
  }).join('') + `<button type="button" onclick="selClass('')" style="padding:5px 10px;border-radius:var(--r);border:1px solid var(--bdr);background:none;color:var(--txm);font-size:11px;cursor:pointer;font-family:inherit;margin-left:4px;">ล้าง</button>`;
  document.getElementById('m-class').value = sel || '';
}
function selClass(n) {
  document.getElementById('m-class').value = n || '';
  buildClassBtns(n || '');
  // Show/hide Class 5 critical items box
  const c5box = document.getElementById('box-class5');
  if(c5box) c5box.style.display = String(n) === '5' ? 'block' : 'none';
}
function buildClass5Items(items) {
  const grid = document.getElementById('class5-grid');
  if(!grid) return;
  grid.innerHTML = CLASS5_OPTIONS.map(o => {
    const on = items.includes(o.id);
    return `<label class="cklbl ${on?'on':''}" id="c5-${o.id}" onclick="togClass5('${o.id}')" style="font-size:12px;">
      <span class="ckbox">${on?'✓':''}</span><span style="margin-right:4px;">${o.icon}</span>${o.l}
    </label>`;
  }).join('');
}
function togClass5(id) {
  if(editClass5Items.includes(id)) editClass5Items = editClass5Items.filter(x => x !== id);
  else editClass5Items.push(id);
  buildClass5Items(editClass5Items);
}
// Room type buttons (รวม / เดี่ยว / suite)
const ROOM_TYPE_OPTS = [
  {v:'รวม', l:'1. รวม',     icon:'🏠'},
  {v:'เดี่ยว', l:'2. เดี่ยว', icon:'🚪'},
  {v:'suite', l:'3. Suite',   icon:'🛋'}
];
function buildRoomTypeBtns(sel) {
  const el = document.getElementById('rt-btns');
  if(!el) return;
  el.innerHTML = ROOM_TYPE_OPTS.map(o=>{
    const s = sel===o.v;
    return `<button type="button" onclick="selRoomType('${o.v}')" style="padding:8px 14px;border-radius:var(--r);border:1.5px solid ${s?'var(--ambl)':'var(--bdr)'};background:${s?'var(--ambd)':'var(--surf2)'};color:${s?'var(--ambl)':'var(--txd)'};font-size:13px;cursor:pointer;font-weight:${s?700:500};font-family:inherit;flex:1;min-width:90px;">${o.icon} ${o.l}</button>`;
  }).join('');
  document.getElementById('m-rtype').value = sel || '';
}
function selRoomType(v) {
  document.getElementById('m-rtype').value = v || '';
  buildRoomTypeBtns(v || '');
}
function buildRooms(w) { const rooms=RWD[w]||[]; document.getElementById('m-tr').innerHTML='<option value="">— ห้อง —</option>'+rooms.map(r=>`<option>${r}</option>`).join(''); }
function buildChk(plan) {
  const cl=CL[plan]||[]; const card=document.getElementById('chk-card');
  if(!cl.length){card.style.display='none';return;}
  card.style.display='block';
  document.getElementById('chk-title').textContent='Checklist — '+(PLANS.find(p=>p.v===plan)?.l||plan);
  document.getElementById('chk-grid').innerHTML=cl.map(item=>{const on=editChecks.includes(item.id);return`<label class="cklbl ${on?'on':''}" id="cl-${item.id}" onclick="togChk('${item.id}')"><span class="ckbox" id="cb-${item.id}">${on?'✓':''}</span>${item.l}</label>`;}).join('');
  updChkDone(plan);
}
function togChk(id) {
  if(editChecks.includes(id)) editChecks=editChecks.filter(c=>c!==id); else editChecks.push(id);
  const l=document.getElementById('cl-'+id); const bx=document.getElementById('cb-'+id);
  if(l&&bx){if(editChecks.includes(id)){l.classList.add('on');bx.textContent='✓';}else{l.classList.remove('on');bx.textContent='';}}
  updChkDone(document.getElementById('m-plan').value);
}
function updChkDone(plan) {
  const isDC=['D/C','refer'].includes(plan); const cl=CL[plan]||[];
  const all=isDC&&cl.length&&cl.every(i=>editChecks.includes(i.id));
  document.getElementById('chk-done').style.display=all?'block':'none';
}
function filterDr(inpId, dropId, mode) {
  const q=document.getElementById(inpId).value.trim(); const drop=document.getElementById(dropId);
  if(!q){drop.classList.remove('open');return;}
  const ql=q.toLowerCase();
  const flt=doctors.filter(d=>(d.name.toLowerCase().includes(ql)||d.spec?.toLowerCase().includes(ql))&&!(mode==='consult'&&editConsults.includes(d.name)));
  const exactExists=doctors.some(d=>d.name===q);
  let html='';
  if(flt.length) html+=flt.map(d=>`<div class="sdi" data-action="${mode==='consult'?'cons':'master'}" data-name="${d.name.replace(/"/g,'&quot;')}">${d.name}<small style="color:var(--txd);margin-left:5px;">(${d.spec})</small></div>`).join('');
  if(!exactExists && q.length>=2) html+=`<div class="sdi sdi-add" data-action="${mode==='consult'?'cons-new':'master-new'}" data-name="${q.replace(/"/g,'&quot;')}">➕ เพิ่ม "<b>${q}</b>" เป็นแพทย์ใหม่</div>`;
  else if(!flt.length && exactExists) html+=`<div class="sdi" style="color:var(--txd);">มีในรายชื่อแล้ว</div>`;
  if(!html) html=`<div class="sdi" style="color:var(--txd);">พิมพ์ชื่อเพื่อค้นหาหรือเพิ่มใหม่</div>`;
  drop.innerHTML=html; drop.classList.add('open');
  drop.querySelectorAll('.sdi[data-action]').forEach(el=>{
    el.onclick=function(){const act=this.dataset.action,nm=this.dataset.name;if(act==='master')pickM(nm);else if(act==='cons')addCons(nm);else if(act==='master-new')addNewDrAndPickM(nm);else if(act==='cons-new')addNewDrAndCons(nm);};
  });
}
function addNewDrAndPickM(name){if(!doctors.find(d=>d.name===name))doctors.push({name,spec:'Med',workType:'Full-Time'});saveAll();pickM(name);toast(`➕ เพิ่มแพทย์ใหม่: ${name}`,'#0e8060');}
function addNewDrAndCons(name){if(!doctors.find(d=>d.name===name))doctors.push({name,spec:'Med',workType:'Full-Time'});saveAll();addCons(name);toast(`➕ เพิ่มแพทย์ใหม่: ${name}`,'#0e8060');}
function pickM(n){document.getElementById('m-mi').value=n;document.getElementById('m-mv').value=n;document.getElementById('m-md').classList.remove('open');renderMasterTag(n);}
function renderMasterTag(n){const wrap=document.getElementById('master-tag');if(!wrap)return;if(!n){wrap.innerHTML='';return;}const d=doctors.find(x=>x.name===n);wrap.innerHTML=`<span class="tagpill" style="background:var(--blued);color:var(--blue);border-color:var(--blue);">${n}${d?` <small>(${d.spec})</small>`:''}<span class="tagx" onclick="clearMaster()">×</span></span>`;}
function clearMaster(){document.getElementById('m-mi').value='';document.getElementById('m-mv').value='';renderMasterTag('');}
function addConsFromInput(){const inp=document.getElementById('m-ci');const n=inp.value.trim();if(!n)return;if(!doctors.find(d=>d.name===n))doctors.push({name:n,spec:'Med',workType:'Full-Time'}),saveAll(),toast(`➕ เพิ่มแพทย์ใหม่: ${n}`,'#0e8060');addCons(n);}
function addMasterFromInput(){const inp=document.getElementById('m-mi');const n=inp.value.trim();if(!n)return;if(!doctors.find(d=>d.name===n)){doctors.push({name:n,spec:'Med',workType:'Full-Time'});saveAll();toast(`➕ เพิ่มแพทย์ใหม่: ${n}`,'#0e8060');}pickM(n);}
function addCons(n){if(!editConsults.includes(n)){editConsults.push(n);renderConsTags();}document.getElementById('m-ci').value='';document.getElementById('m-cd').classList.remove('open');}
function remCons(n){editConsults=editConsults.filter(c=>c!==n);renderConsTags();}
function renderConsTags(){const wrap=document.getElementById('cons-tags');wrap.innerHTML=editConsults.map(c=>{const d=doctors.find(x=>x.name===c);return`<span class="tagpill">${c}${d?` <small>(${d.spec})</small>`:''}<span class="tagx" data-name="${c.replace(/"/g,'&quot;')}">×</span></span>`;}).join('');wrap.querySelectorAll('.tagx').forEach(el=>{el.onclick=function(){remCons(this.dataset.name);};});}
function dh(id){setTimeout(()=>document.getElementById(id)?.classList.remove('open'),200);}
function saveBed(){
  const plan=document.getElementById('m-plan').value||'อยู่ต่อ';
  if(!allBeds[editDept]) allBeds[editDept]={};
  const cur=allBeds[editDept][editId]||emptyBed(editId,editDept);
  // ตีตราเวลาเมื่อเข้าสู่สถานะ "ย้ายward รอห้อง" หรือ "ย้าย ward ได้ห้องแล้ว"
  let transferTime = cur.transferTime || '';
  const isTransferPlan = plan==='ย้ายward รอห้อง' || plan==='ย้าย ward ได้ห้องแล้ว';
  const wasTransferPlan = cur.plan==='ย้ายward รอห้อง' || cur.plan==='ย้าย ward ได้ห้องแล้ว';
  if(isTransferPlan && (!wasTransferPlan || cur.plan !== plan)) {
    transferTime = new Date().toISOString();
  } else if(!isTransferPlan) {
    transferTime = '';
  }
  allBeds[editDept][editId]=sanitizeBedPrivacy({
    ...cur,
    gender:document.getElementById('m-gen').value,
    age:document.getElementById('m-age').value,
    patientCode:document.getElementById('m-code').value,
    admitDate:document.getElementById('m-admit').value,
    los:document.getElementById('m-los').value.trim(),
    orNote:document.getElementById('m-or').value.trim(),
    ccNote:document.getElementById('m-cc').value.trim(),
    presentNote:document.getElementById('m-present').value.trim(),
    dx:[...editDx],
    master:document.getElementById('m-mv').value||document.getElementById('m-mi').value,
    consult:[...editConsults],
    rn:document.getElementById('m-rn').value,
    plan,
    checks:[...editChecks],
    class:document.getElementById('m-class')?.value || '',
    class5Items: String(document.getElementById('m-class')?.value || '') === '5' ? [...editClass5Items] : [],
    class5Other: String(document.getElementById('m-class')?.value || '') === '5' ? (document.getElementById('m-class5-other')?.value || '').trim() : '',
    transferRoomType:document.getElementById('m-rtype').value||'',
    transferMonitor:document.getElementById('m-mon')?.value||'',
    transferGenderPref:document.getElementById('m-tgen')?.value||'',
    transferTime,
    transferWard:document.getElementById('m-tw').value||'',
    transferRoom:document.getElementById('m-tr').value||'',
    transferBed:document.getElementById('m-tbed').value||''
  });
  persist();renderTable();closeBed();
  // ถ้ามีหน้าสรุปย้ายวอร์ดเปิดอยู่ ให้รีเฟรชด้วย
  if(document.getElementById('transfer-mode')?.style.display === 'flex') renderTransferDashboard();
  if(['D/C','refer'].includes(plan)){const cl=CL[plan]||[];if(cl.length&&cl.every(i=>(allBeds[editDept][editId]?.checks||[]).includes(i.id)))setTimeout(autoClear,600);}
}

// ════════════════════════════════════════
// RESET BEDS
// ════════════════════════════════════════
function confirmResetBeds(){if(isAllView()){toast('เลือกแผนก CCU / NCU / ICU ก่อนล้างเตียงทั้งหมด','#c0392b');return;}document.getElementById('reset-dept-lbl').textContent=dept;document.getElementById('reset-modal').classList.add('open');}
function closeReset(){document.getElementById('reset-modal').classList.remove('open');}
function doResetBeds(){
  const d=dept;
  Object.keys(allBeds[d]||{}).forEach(id=>{const kt=allBeds[d][id]?.deptType||DEPTS[d].types[0];allBeds[d][id]=emptyBed(id,d);allBeds[d][id].deptType=kt;});
  persist();renderTable();closeReset();toast(`🗑 ล้างเตียงทั้งหมด ${d} เป็นเตียงว่างแล้ว`,'#c0392b');
}

// ════════════════════════════════════════
// SWAP
// ════════════════════════════════════════
function openSwap(){const b=allBeds[editDept][editId];document.getElementById('sw-src').innerHTML=`<div style="font-size:10px;color:var(--txd);margin-bottom:4px;">ต้นทาง</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;"><span style="font-size:15px;font-weight:700;color:var(--blue);font-family:monospace;">เตียง ${b.id}</span>${tpill(b.deptType||editDept)}<span style="font-size:11px;color:var(--txd);">${editDept}</span>${(b.dx||[]).map(d=>dxpill(d)).join(' ')}</div>`;setSwapMode('swap');document.getElementById('sw-dept').value=editDept;buildSwapBeds();document.getElementById('sw-prev').style.display='none';document.getElementById('swap-modal').classList.add('open');}
function closeSwap(){document.getElementById('swap-modal').classList.remove('open');}
function setSwapMode(m){swapMode=m;['swap','move'].forEach(x=>{const btn=document.getElementById('sw-'+x);btn.style.background=x===m?'var(--purd)':'var(--surf2)';btn.style.color=x===m?'var(--pur)':'var(--txd)';btn.style.borderColor=x===m?'var(--pur)':'var(--bdr)';});buildSwapBeds();}
function buildSwapBeds(){const td=document.getElementById('sw-dept').value;const beds=Object.values(allBeds[td]||{}).sort((a,b)=>parseInt(a.id)-parseInt(b.id));document.getElementById('sw-bed').innerHTML='<option value="">— เตียง —</option>'+beds.filter(b=>!(b.id===editId&&td===editDept)).map(b=>{const occ=b.dx?.length||b.plan==='รอรับใหม่';return`<option value="${b.id}" ${swapMode==='move'&&occ?'disabled':''}>${b.id} [${b.deptType||td}] ${occ?'— '+((b.dx||[])[0]||'รอรับใหม่'):'— ว่าง'}</option>`;}).join('');document.getElementById('sw-bed').onchange=previewSwap;document.getElementById('sw-prev').style.display='none';}
function previewSwap(){const td=document.getElementById('sw-dept').value;const tid=document.getElementById('sw-bed').value;const prev=document.getElementById('sw-prev');if(!tid){prev.style.display='none';return;}const tb=allBeds[td]?.[tid];if(!tb){prev.style.display='none';return;}const tocc=tb.dx?.length||tb.plan==='รอรับใหม่';prev.style.display='block';prev.style.borderColor=swapMode==='move'&&tocc?'var(--red)':tocc?'var(--blue)':'var(--teal)';prev.innerHTML=`<div style="color:var(--txd);font-size:10px;margin-bottom:4px;">ปลายทาง: เตียง ${tb.id} [${tb.deptType||td}] — ${td}</div><div style="color:${swapMode==='move'&&tocc?'#c0392b':tocc?'var(--blue)':'var(--teal)'};">${swapMode==='move'&&tocc?'⚠ มีผู้ป่วย':tocc?`สลับกับ: ${(tb.dx||[])[0]||'รอรับใหม่'}`:'เตียงว่าง'}</div>`;const ok=!(swapMode==='move'&&tocc);document.getElementById('sw-ok').style.opacity=ok?1:.4;document.getElementById('sw-ok').disabled=!ok;}
function doSwap(){const td=document.getElementById('sw-dept').value;const tid=document.getElementById('sw-bed').value;if(!tid)return;const sb2=allBeds[editDept][editId];const tb=allBeds[td][tid];if(!tb)return;if(swapMode==='move'&&(tb.dx?.length||tb.plan==='รอรับใหม่'))return;if(swapMode==='swap'){const st=sb2.deptType,tt=tb.deptType;allBeds[editDept][editId]={...tb,id:editId,dept:editDept,deptType:st};allBeds[td][tid]={...sb2,id:tid,dept:td,deptType:tt};}else{allBeds[td][tid]={...sb2,id:tid,dept:td,deptType:tb.deptType};allBeds[editDept][editId]=emptyBed(editId,editDept);}persist();renderTable();closeSwap();closeBed();}

// ════════════════════════════════════════
// AUTO CLEAR
// ════════════════════════════════════════
function autoClear(){const CP=['D/C','refer'];let n=0;Object.keys(DEPTS).forEach(d=>{Object.values(allBeds[d]||{}).forEach(b=>{if(!CP.includes(b.plan))return;const cl=CL[b.plan]||[];if(!cl.length)return;if(cl.every(item=>(b.checks||[]).includes(item.id))){const kt=b.deptType;allBeds[d][b.id]=emptyBed(b.id,d);allBeds[d][b.id].deptType=kt;n++;}});});if(n>0){persist();renderTable();toast(`🧹 ล้างเตียง ${n} เตียง (D/C / Refer checklist ครบ)`,'#0e8060');}return n;}
function manualClear(){if(!autoClear())toast('ไม่มีเตียงที่ checklist D/C / Refer ครบทุกข้อ','#1a6fcc');}
function doRefresh(){load().then(()=>{renderTable();renderStaff();toast('🔄 รีเฟรชข้อมูลแล้ว','#1a6fcc');});}
function toggleAutoRefresh(){autoRefreshPaused=!autoRefreshPaused;const btn=document.getElementById('pause-refresh-btn');if(btn)btn.textContent=autoRefreshPaused?'▶ เปิดรีเฟรช':'⏸ พักรีเฟรช';}

// ════════════════════════════════════════
// TOAST
// ════════════════════════════════════════
function toast(msg,bg){const n=document.createElement('div');n.textContent=msg;n.style.cssText=`position:fixed;bottom:18px;right:18px;background:${bg||'#1a6fcc'};color:#fff;padding:9px 16px;border-radius:var(--r);font-size:13px;z-index:9999;animation:fi .3s ease;box-shadow:0 4px 16px rgba(0,0,0,.2);font-family:'Sarabun',sans-serif;max-width:300px;`;document.body.appendChild(n);setTimeout(()=>{n.style.opacity='0';n.style.transition='opacity .4s';setTimeout(()=>n.remove(),400);},3000);}

// ════════════════════════════════════════
// ADMIN NAVIGATION
// ════════════════════════════════════════
function gotoPage(p,el){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.ntab').forEach(x=>x.classList.remove('active'));document.getElementById('page-'+p).classList.add('active');if(el)el.classList.add('active');if(p==='doctors'){renderSpecTabs();renderDrList();}if(p==='staff'){renderAdminStaffList();}if(p==='users'){renderUsersPage();}}

// ════════════════════════════════════════
// PARSE MODE
// ════════════════════════════════════════
function setParseMode(m){curMode=m;const off=document.getElementById('mo-off'),ai=document.getElementById('mo-ai'),d=document.getElementById('mdesc');if(m==='offline'){off.style.cssText='padding:5px 11px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:500;border:1px solid var(--teal);background:var(--teald);color:var(--teal);';ai.style.cssText='padding:5px 11px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:500;border:1px solid var(--bdr);background:var(--surf);color:var(--txd);';d.textContent='⚡ อ่านไฟล์ในเครื่อง ไม่ต้องเน็ต';d.style.color='var(--teal)';}else{ai.style.cssText='padding:5px 11px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:500;border:1px solid var(--blue);background:var(--blued);color:var(--blue);';off.style.cssText='padding:5px 11px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:500;border:1px solid var(--bdr);background:var(--surf);color:var(--txd);';d.textContent='🌐 Claude AI — ต้องการเน็ต';d.style.color='var(--blue)';}}
function onDrag(e,on){e.preventDefault();document.getElementById('uzone').classList.toggle('drag',on);}
function onDrop(e){e.preventDefault();document.getElementById('uzone').classList.remove('drag');const f=e.dataTransfer.files[0];if(f)handleFile(f);}
async function handleFile(file){
  if(!file)return;const ext=file.name.toLowerCase().split('.').pop();
  if(!['pdf','docx','txt','jpg','jpeg','png'].includes(ext)){alert('รองรับ PDF · DOCX · TXT · JPG · PNG เท่านั้น');return;}
  showProgress(true,'กำลังอ่านไฟล์...');document.getElementById('res-wrap').style.display='none';document.getElementById('rawbox').style.display='none';document.getElementById('imgprev').style.display='none';
  try{if(['jpg','jpeg','png'].includes(ext))await fileImage(file,ext);else if(ext==='txt')await fileTxt(file);else if(ext==='docx')await fileDocx(file);else if(curMode==='offline')await filePdfOff(file);else await filePdfAI(file);}catch(e){showProgress(true,'เกิดข้อผิดพลาด: '+e.message,'var(--red)');console.error(e);}
  showProgress(false);
}
function showProgress(show,msg,clr){const w=document.getElementById('pwrap');w.style.display=show?'flex':'none';if(msg){const el=document.getElementById('pmsg');el.textContent=msg;el.style.color=clr||'var(--blue)';}}
async function fileImage(file,ext){const url=URL.createObjectURL(file);const img=document.getElementById('imgprev');img.src=url;img.style.display='block';if(curMode!=='ai'){alert('รูปภาพต้องใช้โหมด AI');return;}showProgress(true,'ส่งรูปให้ Claude Vision...');const b64=await toB64(file);const mt=ext==='png'?'image/png':'image/jpeg';const prompt=`parse รายงาน Case CCU จากรูปภาพ ตอบ JSON array เท่านั้น (ห้ามชื่อผู้ป่วย HN AN):\n[{"bed":1,"empty":false,"room_type":"IMCCU","gender":"ชาย","age":"77","admit_date":"9/4/69","los":"10","code":"G","dx":["Dx"],"master":["พ.แพทย์"],"consult":[],"orNote":"","ccNote":"","presentNote":"","rn":"","plan":"อยู่ต่อ"}]\nM:=master C:=consult`;const resp=await callAnthropic([{type:'image',source:{type:'base64',media_type:mt,data:b64}},{type:'text',text:prompt}]);finishParse(resp,file.name,'');}
async function fileTxt(file){const text=await file.text();setRaw(text);if(curMode==='offline'){const beds=parseCCU(text);finishParse(beds,file.name,text);}else{showProgress(true,'ส่งข้อความให้ Claude AI...');const beds=await aiParseText(text);finishParse(beds,file.name,text);}}
async function fileDocx(file){showProgress(true,'กำลังโหลด mammoth.js...');if(!window.mammoth)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');showProgress(true,'กำลังอ่าน DOCX...');const ab=await file.arrayBuffer();const result=await mammoth.extractRawText({arrayBuffer:ab});const text=result.value||'';setRaw(text);if(curMode==='offline'){const beds=parseCCU(text);finishParse(beds,file.name,text);}else{showProgress(true,'ส่งข้อความให้ Claude AI...');const beds=await aiParseText(text);finishParse(beds,file.name,text);}}
async function filePdfOff(file){showProgress(true,'กำลังโหลด PDF.js...');if(!window.pdfjsLib){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';}showProgress(true,'กำลังอ่าน PDF...');const ab=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:ab}).promise;let full='';for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p);const tc=await page.getTextContent();full+=tc.items.map(i=>i.str).join(' ')+'\n';}setRaw(full);const beds=parseCCU(full);finishParse(beds,file.name,full);}
async function filePdfAI(file){showProgress(true,'กำลังโหลด PDF.js สำหรับ AI...');if(!window.pdfjsLib){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';}showProgress(true,'กำลังอ่าน PDF...');const ab=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:ab}).promise;let full='';for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p);const tc=await page.getTextContent();full+=tc.items.map(i=>i.str).join(' ')+'\n';}setRaw(full);showProgress(true,'ส่งข้อความให้ Claude AI...');const beds=await aiParseText(full);finishParse(beds,file.name,full);}
async function aiParseText(text){const prompt=`parse รายงาน Case CCU ต่อไปนี้ ตอบเฉพาะ JSON array เท่านั้น ไม่ต้องมีข้อความอื่น:\n[{"bed":1,"empty":false,"room_type":"IMCCU","gender":"ชาย","age":"77","admit_date":"9/4/69","los":"10","code":"G","dx":["STEMI"],"master":["พ.แพทย์"],"consult":[],"orNote":"","ccNote":"","presentNote":"","rn":"","plan":"อยู่ต่อ"}]\nrule: empty=true ถ้าเตียงว่าง; ห้ามใส่ชื่อผู้ป่วย HN AN; room_type: CCU/IMCCU/NCU/IMNCU/ICU/IMCU/ฝากนอน; plan: อยู่ต่อ/D/C/refer/plan D/C/ย้ายward รอห้อง/ย้าย ward ได้ห้องแล้ว; los=วันนอน\n\nข้อมูล:\n${text.substring(0,6000)}`;return await callAnthropic([{type:'text',text:prompt}]);}
async function callAnthropic(content){
  // วิธีปลอดภัย (แนะนำ): เรียกผ่าน Edge Function 'ai-parse' — key อยู่ฝั่งเซิร์ฟเวอร์
  // ถ้ายังไม่ได้ deploy ฟังก์ชัน จะ fallback ไปเรียกตรงด้วย key ใน config (เหมือนเดิม)
  const sb = await getSupabase();
  if(sb && window.CFG?.supabaseUrl){
    try{
      const { data:{ session } } = await sb.auth.getSession();
      const resp = await fetch(`${window.CFG.supabaseUrl}/functions/v1/ai-parse`,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Bearer ${session?.access_token||''}`,
          'apikey': window.CFG.supabaseKey
        },
        body: JSON.stringify({ content })
      });
      if(resp.status!==404){
        const data = await resp.json();
        if(!resp.ok) throw new Error(data.error||('HTTP '+resp.status));
        const text=(data.content||[]).map(c=>c.text||'').join('');
        if(!text) throw new Error('ไม่ได้รับข้อมูลจาก AI');
        return JSON.parse(text.replace(/```json|```/g,'').trim());
      }
      // 404 = ยังไม่ได้ deploy ฟังก์ชัน → ใช้วิธีเดิมด้านล่าง
    }catch(e){
      // ถ้าเรียก Edge Function ล้มเหลวด้วยเหตุอื่น ให้ลองวิธีเดิมต่อ
      console.warn('ai-parse function unavailable, falling back to direct call:', e);
    }
  }
  // วิธีเดิม: เรียก Anthropic ตรงจากเบราว์เซอร์ด้วย key ใน config
  const key = window.CFG?.anthropicKey || '';
  const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4000,messages:[{role:'user',content}]})});
  const data=await resp.json();const text=(data.content||[]).map(c=>c.text||'').join('');
  if(!text)throw new Error('ไม่ได้รับข้อมูล: '+(data.error?.message||'API error'));
  return JSON.parse(text.replace(/```json|```/g,'').trim());
}
function toB64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.onerror=rej;r.readAsDataURL(file);});}
function setRaw(t){document.getElementById('rawpre').textContent=(t||'').substring(0,3000);}
function loadScript(src){return new Promise((res,rej)=>{if(document.querySelector(`[src="${src}"]`)){res();return;}const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);});}

// ════════════════════════════════════════
// BED CODE NORMALIZE
// ════════════════════════════════════════
const ROOM_ALIASES={IMNCCU:'IMNCU',IMMCU:'IMNCU',IMMCCU:'IMCCU',IMCCU:'IMCCU',IMNCU:'IMNCU',IMCU:'IMCU',CCU:'CCU',ICU:'ICU',NCU:'NCU'};
function normalizeRoomToken(rt){const u=String(rt||'').toUpperCase().replace(/\s/g,'');return ROOM_ALIASES[u]||u;}
function parseBedCode(raw){let s=String(raw||'').trim().toUpperCase().replace(/\s/g,'');if(!s)return null;s=s.replace(/IMNCCU/g,'IMNCU').replace(/IMMCU/g,'IMNCU').replace(/IMMCCU/g,'IMCCU');const m=s.match(/^(IMCCU|IMNCU|IMCU|CCU|ICU|NCU|ฝากนอน)(\d{1,2})$/);if(m){const room_type=normalizeRoomToken(m[1]);const bed=parseInt(m[2],10);return{bed,room_type,bed_label:room_type+String(bed).padStart(2,'0')};}if(/^\d{1,2}$/.test(s)){const bed=parseInt(s,10);return{bed,room_type:'NCU',bed_label:'NCU'+String(bed).padStart(2,'0')};}return null;}
function formatSheetDate(name){const d=String(name).replace(/\D/g,'');if(d.length>=7&&(d.endsWith('2569')||d.endsWith('69')&&d.length>=7)){const day=parseInt(d.slice(0,2),10);const month=parseInt(d.slice(2,4),10);if(day&&month)return`${day}/${month}/69`;}if(d.length===5){const day=parseInt(d.slice(0,d.length-4),10);const month=parseInt(d.slice(-4,-2),10);if(day&&month)return`${day}/${month}/69`;}if(d.length===4){const day=parseInt(d.slice(0,1),10);const month=parseInt(d.slice(1,2),10);if(day&&month)return`${day}/${month}/69`;}return String(name);}
function genderFromName(name){const n=String(name||'');if(/\bนาย\b|\bMr\.?\b/i.test(n))return'ชาย';if(/\bนาง\b|\bน\.ส\.|\bนางสาว\b|\bMrs\.?\b|\bMs\.?\b/i.test(n))return'หญิง';return'';}
function parseAgeCell(v){const m=String(v||'').match(/(\d{1,3})/);return m?m[1]:'';}
function parseLosCell(v){const s=String(v||'').trim();const m=s.match(/(\d{1,3})/);if(m)return m[1];if(/^\d{5,6}$/.test(s)){const n=parseInt(s,10);if(n>0&&n<500)return String(n);}return s;}
function parseAdmitCell(v){const s=String(v||'').trim();const m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(m)return`${m[1]}/${m[2]}/${m[3].slice(-2)}`;if(/^\d{5,6}$/.test(s)){const n=parseInt(s,10);if(n>40000){const ex=new Date((n-25569)*86400000);return`${ex.getDate()}/${ex.getMonth()+1}/${String(ex.getFullYear()+543).slice(-2)}`;}}return s;}
function parseCodeCell(v){const s=String(v||'').trim().toUpperCase();if(!s)return'';if(/S\+I|S&I/.test(s))return'S+I';if(s==='S'||s==='G'||s==='C'||s==='B')return s;if(/สปสช/.test(s))return'สปสช.';return s;}
function parseDxCell(v){return String(v||'').split(/[,;]\s*/).map(x=>x.trim()).filter(x=>x.length>1&&x.length<80).slice(0,6);}
function parseDoctorsCell(v){const master=[],consult=[];const text=String(v||'').replace(/\s{2,}/g,'\n');const parts=text.split(/\n+|(?=นพ\.|พญ\.|พ\.|น\.พ\.)/).map(x=>x.trim()).filter(x=>x.length>2);parts.forEach(p=>{const n=normalizeDrLine(p);if(!n)return;if(!master.length)master.push(n);else if(n!==master[0]&&!consult.includes(n))consult.push(n);});return{master,consult};}
function normalizeDrLine(p){p=p.trim().replace(/\s+/g,' ');if(p.length<3)return'';if(/^พ\.|^นพ\.|^พญ\.|^น\.พ\./.test(p))return fuzzyDr(p)||p;if(/^พ[\s\.]/.test(p))return fuzzyDr('พ.'+p.replace(/^พ[\s\.]+/,''))||('พ.'+p.replace(/^พ[\s\.]+/,''));return fuzzyDr(p)||p;}
function parsePlanNCU(v){const t=String(v||'').toLowerCase();if(/refer/.test(t))return'refer';if(/plan\s*d\/c|plan\s*dc/.test(t))return'plan D/C';if(/\bd\/c\b/.test(t))return'D/C';if(/ได้ห้อง|ย้าย.*ได้/.test(t))return'ย้าย ward ได้ห้องแล้ว';if(/ย้าย\s*ward|plan\s*ย้าย|ย้ายward/.test(t))return'ย้ายward รอห้อง';if(/รอรับ/.test(t))return'รอรับใหม่';return'อยู่ต่อ';}
function sheetToRows(ws){if(!window.XLSX||!ws)return[];const ref=ws['!ref'];if(!ref)return[];const range=XLSX.utils.decode_range(ref);const rows=[];for(let R=range.s.r;R<=range.e.r;R++){const row=[];for(let C=range.s.c;C<=Math.min(range.e.c,20);C++){const cell=ws[XLSX.utils.encode_cell({r:R,c:C})];row.push(cell?(cell.w!=null?cell.w:cell.v!=null?String(cell.v):''):'');}if(row.some(c=>String(c).trim()!==''))rows.push(row);}return rows;}
function parseNCUExcelRows(rows){let hdr=-1;for(let i=0;i<rows.length;i++){if(/^เตียง$/i.test(String(rows[i][0]||'').trim())){hdr=i;break;}}if(hdr<0)return[];const out=[];for(let i=hdr+1;i<rows.length;i++){const r=rows[i];const bedRaw=r[0];if(!bedRaw||!/NCU|IMNCU|IMMCU|IMNCCU|\d/i.test(String(bedRaw)))continue;const bc=parseBedCode(bedRaw);if(!bc)continue;const name=String(r[2]||'').trim();const hasPt=parseAgeCell(r[5])||genderFromName(name)||String(r[9]||'').trim()||String(r[13]||'').trim()||String(r[10]||'').trim()||String(r[11]||'').trim()||String(r[12]||'').trim();if(!hasPt){out.push({bed:bc.bed,empty:true,room_type:bc.room_type,bed_label:bc.bed_label,gender:'',age:'',admit_date:'',code:'',dx:[],master:[],consult:[],plan:'',los:'',orNote:'',ccNote:'',presentNote:'',rn:''});continue;}const {master,consult}=parseDoctorsCell(r[8]);const dx=parseDxCell(r[9]);out.push({bed:bc.bed,empty:false,room_type:bc.room_type,bed_label:bc.bed_label,gender:genderFromName(name),age:parseAgeCell(r[5]),admit_date:parseAdmitCell(r[6]),code:parseCodeCell(r[1]),los:parseLosCell(r[7]),orNote:String(r[10]||'').trim(),ccNote:String(r[11]||'').trim(),presentNote:String(r[12]||'').trim(),dx,master,consult,plan:parsePlanNCU(r[13]),rn:''});}const byBed={};out.forEach(b=>{if(!byBed[b.bed]||!b.empty)byBed[b.bed]=b;});return Object.keys(byBed).sort((a,b)=>a-b).map(k=>byBed[k]);}
async function handleNCUExcel(file){if(!file)return;showProgress(true,'กำลังโหลด SheetJS...');try{if(!window.XLSX)await loadScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');showProgress(true,'กำลังอ่าน '+file.name+'...');const ab=await file.arrayBuffer();ncuWorkbook=XLSX.read(ab,{type:'array'});ncuFileName=file.name;const sel=document.getElementById('ncu-sheet-sel');let names=ncuWorkbook.SheetNames.filter(n=>!/export\s*summary/i.test(n));names.sort((a,b)=>parseInt(b.replace(/\D/g,''),10)-parseInt(a.replace(/\D/g,''),10));sel.innerHTML=names.map(n=>`<option value="${n}">${formatSheetDate(n)} (${n})</option>`).join('');sel.style.display=names.length?'inline-block':'none';if(names.length)sel.value=names[0];document.getElementById('ncu-parse-btn').style.display=names.length?'inline-block':'none';const xd=document.getElementById('xls-dept');const tgt=(xd&&xd.value)||'NCU';document.getElementById('imp-dept').value=tgt;if(names.length)parseSelectedNCUSheet();toast('📊 โหลด Excel '+names.length+' แผ่น — เลือกวันที่แล้วกดนำเข้า','#0e8060');}catch(e){alert('อ่าน Excel ไม่สำเร็จ: '+e.message);console.error(e);}showProgress(false);}
function parseSelectedNCUSheet(){if(!ncuWorkbook)return;const name=document.getElementById('ncu-sheet-sel').value;const ws=ncuWorkbook.Sheets[name];const rows=sheetToRows(ws);const beds=parseNCUExcelRows(rows);const label=ncuFileName+' · แผ่น '+formatSheetDate(name);setRaw('แผ่น: '+name+'\n'+rows.slice(0,15).map(r=>r.slice(0,14).join('\t')).join('\n'));finishParse(beds,label,'NCU Excel '+name);}

// ════════════════════════════════════════
// OFFLINE PARSER
// ════════════════════════════════════════
function parseCCU(text){const ROOMS=['IMCCU','IMCU','IMNCU','CCU','ICU','NCU','ฝากนอน'];const CODES=['S\\+I','สปสช\\.?','UCEP','เครดิต','พรบ\\.','S','G','C'];const PMAP={'D\\/C':'D/C','plan\\s*D\\/C':'plan D/C','refer\\s*out':'refer','refer':'refer','อยู่ต่อ':'อยู่ต่อ','อยู่':'อยู่ต่อ','ย้าย\\s*ward\\s*ได้\\s*ห้อง':'ย้าย ward ได้ห้องแล้ว','ย้าย\\s*ward\\s*รอ\\s*ห้อง':'ย้ายward รอห้อง','ย้าย\\s*ward':'ย้ายward รอห้อง'};const roomHints={};const codeBlocks={};const prefixPat=/(?:^|\n)(IMCCU|IMNCU|IMNCCU|IMMCU|IMCU|CCU|ICU|NCU|ฝากนอน)(\d{1,2})\b/gi;const prefixMatches=[];let pm;while((pm=prefixPat.exec(text))!==null){const rt=normalizeRoomToken(pm[1]);prefixMatches.push({idx:pm.index+(pm[0].startsWith('\n')?1:0),rt,bn:parseInt(pm[2],10)});}if(prefixMatches.length>0){for(let i=0;i<prefixMatches.length;i++){const {idx,rt,bn}=prefixMatches[i];const end=i+1<prefixMatches.length?prefixMatches[i+1].idx:text.length;codeBlocks[bn]=text.substring(idx,end);roomHints[bn]=rt;}}else{const mm=[...text.matchAll(/^Bed\s+(\d+)\b/gm)];for(let i=0;i<mm.length;i++){const bn=parseInt(mm[i][1]);codeBlocks[bn]=text.substring(mm[i].index,i+1<mm.length?mm[i+1].index:text.length);}}if(!Object.keys(codeBlocks).length)return[];const maxB=Math.max(...Object.keys(codeBlocks).map(Number));const result=[];for(let b=1;b<=maxB;b++){if(!codeBlocks[b]){result.push({bed:b,empty:true,room_type:'',gender:'',age:'',admit_date:'',code:'',dx:[],master:[],consult:[],plan:'',los:'',orNote:'',ccNote:'',presentNote:'',rn:''});continue;}const parsed=parseBed(b,codeBlocks[b],ROOMS,CODES,PMAP);if(!parsed.room_type&&roomHints[b])parsed.room_type=roomHints[b];result.push(parsed);}return result;}
function parseBed(bedNo,text,ROOMS,CODES,PMAP){const r={bed:bedNo,empty:false,room_type:'',gender:'',age:'',admit_date:'',code:'',dx:[],master:[],consult:[],plan:'',los:'',orNote:'',ccNote:'',presentNote:'',rn:''};if(/ว่าง/.test(text)&&!/นาง|นาย|HN:|M:/i.test(text)){r.empty=true;return r;}if(/^Bed\s+\d+\s*$/.test(text.trim())){r.empty=true;return r;}for(const rt of ROOMS){if(new RegExp('\\b'+rt+'\\b').test(text)){r.room_type=rt;break;}}if(/\bนาย\b/.test(text))r.gender='ชาย';else if(/\bนาง\b|\bนางสาว\b/.test(text))r.gender='หญิง';const am=text.match(/อายุ\s+(\d+)\s*ปี/);if(am)r.age=am[1];const adm=text.match(/Admit\s+([\d]+\/[\d]+\/[\d]+)/);if(adm)r.admit_date=adm[1];const losM=text.match(/LOS[:\s]*(\d{1,3})/i);if(losM)r.los=losM[1];r.los=r.los||'';r.orNote='';r.ccNote='';r.presentNote='';for(const c of CODES){if(new RegExp('(?:^|\\s)'+c+'(?:\\s|$)','m').test(text)){r.code=c.replace(/\\/g,'');break;}}(text.match(/M:\s*[^\n]+/g)||[]).forEach(line=>{line.replace(/^M:\s*/,'').replace(/ราวน์.*$/,'').replace(/\d+[-\/]\d+.*$/,'').trim().split(/\s+ฝาก|ฝากพ\./).forEach(p=>{p=p.trim().replace(/^พ\.\s*/,'').trim();if(p.length>1&&p.length<30&&!/^\d/.test(p)){const n=mkName(p);if(n&&!r.master.includes(n))r.master.push(n);}});});(text.match(/^C:\s*[^\n]+/gm)||[]).forEach(line=>{line.replace(/^C:\s*/,'').replace(/\s*[®©]/g,'').trim().split(/\s+(?=พ\.|นพ\.|พญ\.)/).forEach(p=>{p=p.trim().replace(/^พ\.\s*/,'').trim();if(p.length>1&&p.length<30&&!/^\d/.test(p)){const n=mkName(p);if(n&&!r.consult.includes(n)&&!r.master.includes(n))r.consult.push(n);}});});const caseM=text.match(/Case\s*[:\s]+([^\n]+)/);if(caseM){caseM[1].replace(/^\s*[-:]\s*/,'').trim().split(/\s+with\s+|\s+[Ww]\/\s*/).forEach(d=>{d=d.trim().replace(/^\d+[\.\)]\s*/,'');if(d.length>2&&d.length<60)r.dx.push(d);});}const ndr=/^\s*\d+[\.\)]+\s*([A-Za-zก-๙][^\n]{2,50})/gm;let nm;while((nm=ndr.exec(text))!==null){const d=nm[1].trim();if(!/lab|cbc|admit|tx\.|pain|npo|iv |atb|dtx|keep|ua:|v\/s|on |มีแผล/i.test(d)&&d.length<60){if(!r.dx.some(x=>x.toLowerCase().startsWith(d.toLowerCase().substring(0,6))))r.dx.push(d);}}r.dx=r.dx.slice(0,6);const pt=text.substring(Math.max(0,text.length-200));for(const[pat,val]of Object.entries(PMAP)){if(new RegExp(pat,'i').test(pt)){r.plan=val;break;}}if(!r.plan)r.plan='อยู่ต่อ';r.master=r.master.map(n=>fuzzyDr(n)||n);r.consult=r.consult.map(n=>fuzzyDr(n)||n);return r;}
function mkName(raw){let n=raw.replace(/[®©\*\[\]]/g,'').replace(/\s+\d+[-\/]\d+.*$/,'').replace(/\s{2,}/g,' ').trim();n=n.replace(/^(พ\.|นพ\.|พญ\.)\s*/,'');if(!n||n.length<2)return null;return'พ.'+n;}
function fuzzyDr(raw){const q=(raw||'').replace(/^(นพ\.|พญ\.|พ\.)\s*/,'').trim().toLowerCase();if(!q||q.length<2)return null;let m=doctors.find(d=>d.name.toLowerCase().includes(q)||q.includes(d.name.toLowerCase().replace(/^(นพ\.|พญ\.)\s*/,'').trim()));if(m)return m.name;const toks=q.split(/\s+/).filter(t=>t.length>=3);for(const tok of toks){m=doctors.find(d=>d.name.toLowerCase().includes(tok));if(m)return m.name;}return null;}

// ════════════════════════════════════════
// PARSE RESULT
// ════════════════════════════════════════
function normalizeParsedBed(b){const master=Array.isArray(b.master)?b.master:(b.master?[b.master]:[]);return{bed:b.bed,empty:!!b.empty,room_type:b.room_type||'',bed_label:b.bed_label||'',gender:b.gender||'',age:String(b.age||'').trim(),admit_date:b.admit_date||b.admitDate||'',code:b.code||b.patientCode||'',dx:b.dx||[],master,consult:b.consult||[],plan:b.plan||'',los:String(b.los||'').trim(),orNote:String(b.orNote||b.or_note||'').trim(),ccNote:String(b.ccNote||b.cc_note||'').trim(),presentNote:String(b.presentNote||b.present_note||'').trim(),rn:String(b.rn||'').trim()};}
function finishParse(beds,fname,raw){parsedBeds=(beds||[]).map(normalizeParsedBed);saveRpt(fname,parsedBeds,(raw||'').substring(0,3000));showResult(parsedBeds,fname);}
function saveRpt(fname,beds,raw){const n=new Date();const dk=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;const ts=n.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});rptHist=rptHist.filter(h=>h.date!==dk);rptHist.unshift({date:dk,time:ts,fname,beds,raw});const cut=new Date();cut.setDate(cut.getDate()-5);rptHist=rptHist.filter(h=>new Date(h.date)>=cut).slice(0,10);saveAll();renderHist();}
function renderHist(){const card=document.getElementById('hcard'),list=document.getElementById('hlist');if(!rptHist.length){card.style.display='none';return;}card.style.display='block';list.innerHTML=rptHist.map((h,i)=>{const occ=h.beds.filter(b=>!b.empty).length;const dc=h.beds.filter(b=>['D/C','plan D/C'].includes(b.plan)).length;const ref=h.beds.filter(b=>b.plan==='refer').length;return`<div class="hi ${selHistIdx===i?'sel':''}" onclick="loadHist(${i})"><div style="display:flex;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--blue);">${h.date} ${h.time}</span><span style="font-size:10px;color:var(--txd);">${(h.fname||'').substring(0,28)}</span></div><div style="font-size:10px;color:var(--txd);margin-top:2px;">ผู้ป่วย ${occ} · D/C ${dc} · Refer ${ref}</div><div class="hbeds">${h.beds.filter(b=>!b.empty).map(b=>{const c=PC[b.plan]||PC['อยู่ต่อ'];return`<span class="hb" style="background:${c.bg};color:${c.tx};border-color:${c.br};">เตียง ${b.bed}</span>`;}).join('')}</div></div>`;}).join('');}
function loadHist(i){selHistIdx=i;const h=rptHist[i];parsedBeds=h.beds;if(h.raw)setRaw(h.raw);showResult(h.beds,h.fname);renderHist();}
function showResult(beds,fname){document.getElementById('res-lbl').textContent=fname||'';document.getElementById('res-beds').innerHTML=beds.map((b,i)=>{const bedLbl=b.bed_label||((b.room_type||'')+String(b.bed).padStart(2,'0'))||('เตียง '+b.bed);if(b.empty)return`<div class="rbed" style="opacity:.5;"><div class="rh"><span style="font-size:15px;font-weight:700;color:var(--txd);font-family:'IBM Plex Mono',monospace;">${bedLbl}</span><span style="font-size:11px;color:var(--txm);font-style:italic;">ว่าง</span></div></div>`;const pc=PC[b.plan]||PC['อยู่ต่อ'];const dxh=(b.dx||[]).map(d=>{const c=DXC(d)||{bg:'#e8eef6',tx:'#1a3a6a',br:'#b8cce0'};return`<span class="pill" style="background:${c.bg};color:${c.tx};border-color:${c.br};">${d}</span>`;}).join('');const rtc=SC[b.room_type]||SC.Med;const mh=(b.master||[]).map(m=>{const dr=doctors.find(x=>x.name===m);return`<span style="font-size:11px;color:var(--blue);">M:${m}${dr?` <small style="color:var(--txd);">(${dr.spec})</small>`:''}</span>`;}).join(' ');const ch=(b.consult||[]).map(c2=>{const dr=doctors.find(x=>x.name===c2);return`<span style="font-size:11px;color:var(--txd);">C:${c2}${dr?` (${dr.spec})`:''}</span>`;}).join(' ');const meta=[b.los?`LOS ${b.los}d`:null,b.rn?`RN ${b.rn}`:null].filter(Boolean).join(' · ');const notes=[b.orNote?`OR: ${b.orNote.substring(0,60)}`:null,b.ccNote?`CC: ${b.ccNote.substring(0,50)}`:null,b.presentNote?`อาการ: ${b.presentNote.substring(0,50)}`:null].filter(Boolean);return`<div class="rbed"><div class="rh"><input type="checkbox" class="imp" id="ck${i}" checked><span style="font-size:15px;font-weight:700;color:var(--blue);font-family:'IBM Plex Mono',monospace;">${bedLbl}</span><span style="font-size:10px;color:var(--txd);">→ เตียง ${b.bed}</span>${b.room_type?`<span style="background:${rtc.bg};color:${rtc.tx};border:1px solid ${rtc.br};border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600;">${b.room_type}</span>`:''}<span class="pill" style="background:${pc.bg};color:${pc.tx};border-color:${pc.br};">${b.plan||'อยู่ต่อ'}</span></div>${meta?`<div style="font-size:10px;color:var(--txd);margin-top:3px;">${meta}</div>`:''}<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;">${dxh}</div>${mh||ch?`<div style="margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;">${mh}${ch}</div>`:''}${notes.length?`<div style="font-size:10px;color:var(--txm);margin-top:4px;">${notes.join('<br>')}</div>`:''}</div>`;}).join('');document.getElementById('res-wrap').style.display='block';}
function selAll(v){document.querySelectorAll('.imp').forEach(c=>c.checked=v);}
function applyParsedToBed(cur,b,dept){const DTYPE={CCU:['CCU','IMCCU','ฝากนอน'],NCU:['NCU','IMNCU','ฝากนอน'],ICU:['ICU','IMCU','ฝากนอน']};const rt=b.room_type&&(DTYPE[dept]||[]).includes(b.room_type)?b.room_type:cur.deptType;const mD=n=>{const dr=doctors.find(x=>x.name===n||(n&&x.name.includes(n.replace(/^(นพ\.|พญ\.|พ\.)\s*/,'').trim())));return dr?dr.name:n;};return sanitizeBedPrivacy({...cur,deptType:rt,gender:b.gender||cur.gender,age:b.age||cur.age,admitDate:b.admit_date||cur.admitDate,patientCode:b.code||cur.patientCode,dx:b.dx?.length?b.dx:cur.dx,master:b.master?.length?mD(b.master[0]):cur.master,consult:(b.consult||[]).map(mD),plan:b.plan||cur.plan,rn:b.rn||cur.rn,los:b.los||cur.los,orNote:b.orNote||cur.orNote,ccNote:b.ccNote||cur.ccNote,presentNote:b.presentNote||cur.presentNote});}
async function doImport(){
  const td=document.getElementById('imp-dept').value;
  if(!allBeds[td]) allBeds[td]={};
  const DTYPE={CCU:['CCU','IMCCU','ฝากนอน'],NCU:['NCU','IMNCU','ฝากนอน'],ICU:['ICU','IMCU','ฝากนอน']};
  let cnt=0;
  parsedBeds.forEach((b,i)=>{
    const cb=document.getElementById('ck'+i);if(!cb||!cb.checked||b.empty)return;
    const id=`${b.bed}`;
    const cur=sanitizeBedPrivacy(allBeds[td][id]||{id,dept:td,deptType:(DTYPE[td]||[])[0]||'',dx:[],patientCode:'',master:'',consult:[],rn:'',plan:'อยู่ต่อ',checks:[],transferWard:'',transferRoom:'',transferBed:'',transferRoomType:'',gender:'',age:'',admitDate:'',los:'',orNote:'',ccNote:'',presentNote:''});
    allBeds[td][id]=applyParsedToBed(cur,b,td);cnt++;
  });
  editDept=td;
  const okSaved=await persist();
  load().then(()=>{renderTable();
    if(okSaved) toast(`✓ นำเข้า ${cnt} เตียง → ${td} สำเร็จ`,'#0e8060');
    else toast(`⚠ นำเข้า ${cnt} เตียงแล้ว แต่บันทึกขึ้นฐานข้อมูลกลางไม่ได้ (สิทธิ์ไม่พอ) — คนอื่นจะยังไม่เห็น แจ้งแอดมินรัน RLS`,'#c0392b');
  });
}

// ════════════════════════════════════════
// DOCTORS (ADMIN)
// ════════════════════════════════════════
function renderSpecTabs(){const specs=['All',...new Set(doctors.map(d=>d.spec))];document.getElementById('spec-tabs').innerHTML=specs.map(s=>{const c=SC[s],cnt=s==='All'?doctors.length:doctors.filter(d=>d.spec===s).length;const sel=curSpec===s;const sty=sel&&c?`background:${c.bg};color:${c.tx};border-color:${c.br};`:'';return`<button class="stab ${sel?'on':''}" onclick="setSpec('${s}',this)" style="${sty}">${s} <span style="opacity:.55;">${cnt}</span></button>`;}).join('');}
function setSpec(s,el){curSpec=s;document.querySelectorAll('#spec-tabs .stab').forEach(t=>{t.classList.remove('on');t.removeAttribute('style');});el.classList.add('on');const c=SC[s];if(c&&s!=='All')el.style.cssText=`padding:4px 10px;border-radius:8px;border:1px solid ${c.br};background:${c.bg};color:${c.tx};`;renderDrList();}
function setWt(f,el){curWt=f;document.querySelectorAll('#wt-all,#wt-ft,#wt-pt').forEach(b=>b.classList.remove('on'));el.classList.add('on');renderDrList();}
function renderDrList(){const q=(document.getElementById('drsrch')?.value||'').toLowerCase().trim();const list=doctors.filter(d=>{if(curSpec!=='All'&&d.spec!==curSpec)return false;if(curWt!=='all'&&d.workType!==curWt)return false;if(q&&!d.name.toLowerCase().includes(q)&&!d.spec.toLowerCase().includes(q))return false;return true;});document.getElementById('dr-cnt').textContent=`(${list.length}/${doctors.length})`;const sty=s=>{const c=SC[s];return c?`background:${c.bg};color:${c.tx};border-color:${c.br};`:'';}; document.getElementById('dr-list').innerHTML=list.length?list.map(d=>`<div class="li"><span class="nm">${d.name}</span><span class="tag" style="${sty(d.spec)}">${d.spec}</span><span class="tag ${d.workType==='Full-Time'?'ft':'pt'}">${d.workType==='Full-Time'?'FT':'PT'}</span><button class="del" onclick="delDr(${JSON.stringify(d.name)})">✕</button></div>`).join(''):`<div style="padding:18px;text-align:center;color:var(--txm);font-size:12px;">ไม่พบแพทย์</div>`;}
function onDS(){document.getElementById('add-ds-o').style.display=document.getElementById('add-ds').value==='อื่นๆ'?'inline-block':'none';}
function addDr(){const name=document.getElementById('add-dn').value.trim();if(!name){alert('กรุณาใส่ชื่อ');return;}const sv=document.getElementById('add-ds').value;const spec=sv==='อื่นๆ'?(document.getElementById('add-ds-o').value.trim()||'อื่นๆ'):sv;const wt=document.getElementById('add-dwt').value;if(!doctors.find(d=>d.name===name))doctors.push({name,spec,workType:wt});document.getElementById('add-dn').value='';saveAll();curSpec=spec;renderSpecTabs();renderDrList();}
function delDr(name){if(!confirm('ลบ "'+name+'" ?'))return;doctors=doctors.filter(d=>d.name!==name);saveAll();renderSpecTabs();renderDrList();}
function exportDr(){const b=new Blob([JSON.stringify(doctors,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='doctors.json';a.click();}

// ════════════════════════════════════════
// STAFF (ADMIN)
// ════════════════════════════════════════
function swSD(d,el){curSD=d;document.querySelectorAll('#sdt .stab').forEach(t=>t.classList.remove('on'));el.classList.add('on');renderAdminStaffList();}
function addSt(role){const inp=document.getElementById(role.toLowerCase()+'-inp');const name=inp.value.trim();if(!name)return;if(!stCfg[curSD])stCfg[curSD]={RN:[],PN:[]};if(!stCfg[curSD][role])stCfg[curSD][role]=[];if(!stCfg[curSD][role].includes(name))stCfg[curSD][role].push(name);inp.value='';saveAll();renderAdminStaffList();}
function delSt(role,name){if(!stCfg[curSD])return;if(!stCfg[curSD][role])return;stCfg[curSD][role]=stCfg[curSD][role].filter(n=>n!==name);saveAll();renderAdminStaffList();}
function renderAdminStaffList(){const sc2=stCfg[curSD]||{RN:[],PN:[]};['RN','PN'].forEach(role=>{const el=document.getElementById(role.toLowerCase()+'-list');if(!el)return;const list=sc2[role]||[];el.innerHTML=list.length?list.map(n=>`<div class="li"><span class="nm">${n}</span><button class="del" data-role="${role}" data-name="${n.replace(/"/g,'&quot;')}">✕</button></div>`).join(''):`<div style="padding:12px;text-align:center;color:var(--txm);font-size:12px;">ยังไม่มีรายชื่อ</div>`;el.querySelectorAll('.del').forEach(btn=>{btn.onclick=function(){delSt(this.dataset.role,this.dataset.name);};});});}

// ════════════════════════════════════════
// USER MANAGEMENT (Admin) + เปลี่ยนรหัสผ่านตัวเอง
// - เปลี่ยนรหัสตัวเอง: ทำใน browser ได้ (auth.updateUser)
// - เพิ่ม/รีเซ็ต/ลบ ผู้ใช้: เรียก Edge Function 'admin-users'
//   (service_role อยู่ฝั่ง server เท่านั้น — ไม่ฝังในหน้าเว็บ)
// ════════════════════════════════════════

// ---- เปลี่ยนรหัสผ่านของฉัน (ทุก user) ----
function openMyPassword(){
  const sb0 = window.CFG?.supabaseUrl && window.CFG?.supabaseKey;
  document.getElementById('mypw-who').textContent = currentUser || '';
  document.getElementById('myp-1').value = '';
  document.getElementById('myp-2').value = '';
  document.getElementById('mypw-warn').style.display = sb0 ? 'none' : 'block';
  document.getElementById('mypw-modal').classList.add('open');
}
function closeMyPassword(){ document.getElementById('mypw-modal').classList.remove('open'); }
async function saveMyPassword(){
  const p1 = document.getElementById('myp-1').value;
  const p2 = document.getElementById('myp-2').value;
  if(p1.length < 6){ toast('รหัสผ่านอย่างน้อย 6 ตัวอักษร','#c0392b'); return; }
  if(p1 !== p2){ toast('รหัสผ่านยืนยันไม่ตรงกัน','#c0392b'); return; }
  const sb = await getSupabase();
  if(!sb){ toast('ต้องเชื่อม Supabase ก่อนจึงจะเปลี่ยนรหัสได้','#c0392b'); return; }
  try{
    const { error } = await sb.auth.updateUser({ password: p1 });
    if(error) throw error;
    toast('✅ เปลี่ยนรหัสผ่านเรียบร้อย','#0e8060');
    closeMyPassword();
  }catch(e){ toast('❌ '+(e.message||e),'#c0392b'); }
}

// ---- เรียก Edge Function สำหรับงาน admin ----
async function callAdminFn(action, payload={}){
  const sb = await getSupabase();
  if(!sb) throw new Error('ระบบยังไม่ได้เชื่อม Supabase');
  const { data:{ session } } = await sb.auth.getSession();
  if(!session) throw new Error('ยังไม่ได้เข้าสู่ระบบ (ไม่มี session)');
  const res = await fetch(`${window.CFG.supabaseUrl}/functions/v1/admin-users`, {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${session.access_token}`,
      'apikey': window.CFG.supabaseKey
    },
    body: JSON.stringify({ action, ...payload })
  });
  let j; try{ j = await res.json(); }catch{ j = { error:'อ่านผลลัพธ์จากเซิร์ฟเวอร์ไม่ได้' }; }
  if(!res.ok) throw new Error(j.error || ('HTTP '+res.status));
  return j;
}

// ---- หน้า "ผู้ใช้" ----
let _usersCache = [];
async function renderUsersPage(){
  const box = document.getElementById('users-list');
  const note = document.getElementById('users-note');
  if(!isAdminUser()){ box.innerHTML = '<div style="padding:14px;color:var(--txm);">เฉพาะผู้ดูแลระบบ (admin)</div>'; return; }
  if(!(window.CFG?.supabaseUrl && window.CFG?.supabaseKey)){
    box.innerHTML = '';
    note.style.display = 'block';
    note.innerHTML = '⚠ ยังไม่ได้เชื่อม Supabase — การจัดการผู้ใช้ใช้ได้เฉพาะเมื่อเชื่อม Supabase แล้ว (โหมด login สำรองในเครื่องไม่รองรับ)';
    return;
  }
  note.style.display = 'none';
  box.innerHTML = '<div style="padding:14px;color:var(--txd);font-size:12px;">⏳ กำลังโหลดรายชื่อผู้ใช้...</div>';
  try{
    const { users } = await callAdminFn('list');
    _usersCache = users || [];
    if(!_usersCache.length){ box.innerHTML = '<div style="padding:14px;color:var(--txm);">ยังไม่มีผู้ใช้</div>'; return; }
    box.innerHTML = _usersCache.map(u=>{
      const isAdmin = u.role==='admin';
      const dept = u.dept || '—';
      const last = u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('th-TH') : 'ยังไม่เคยเข้า';
      return `<div class="uli">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;color:var(--tx);font-size:13px;word-break:break-all;">${u.email||'(ไม่มีอีเมล)'}</div>
          <div style="font-size:11px;color:var(--txd);margin-top:2px;">
            <span class="ubadge ${isAdmin?'uadm':'usta'}">${isAdmin?'admin':'staff'}</span>
            <span class="ubadge udept">${dept}</span>
            <span style="margin-left:6px;color:var(--txm);">เข้าล่าสุด: ${last}</span>
          </div>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          <button class="ubtn" onclick="adminResetPw('${u.id}','${(u.email||'').replace(/'/g,'')}')">🔑 รีเซ็ตรหัส</button>
          <button class="ubtn" onclick="adminEditMeta('${u.id}')">⚙️ สิทธิ์</button>
          <button class="ubtn udel" onclick="adminDeleteUser('${u.id}','${(u.email||'').replace(/'/g,'')}')">🗑</button>
        </div>
      </div>`;
    }).join('');
  }catch(e){
    box.innerHTML = '';
    note.style.display = 'block';
    note.innerHTML = '⚠ เรียกระบบจัดการผู้ใช้ไม่สำเร็จ: '+(e.message||e)+
      '<br><span style="color:var(--txm);">ตรวจสอบว่าได้ deploy Edge Function ชื่อ <b>admin-users</b> แล้ว (ดูวิธีในไฟล์ SETUP_USER_MANAGEMENT.md)</span>';
  }
}

async function adminCreateUser(){
  const email = document.getElementById('nu-email').value.trim();
  const pass  = document.getElementById('nu-pass').value;
  const role  = document.getElementById('nu-role').value;
  const dept  = document.getElementById('nu-dept').value;
  if(!email || !/.+@.+\..+/.test(email)){ toast('กรอกอีเมลให้ถูกต้อง','#c0392b'); return; }
  if(pass.length < 6){ toast('รหัสผ่านอย่างน้อย 6 ตัวอักษร','#c0392b'); return; }
  try{
    await callAdminFn('create', { email, password: pass, role, dept: dept==='ALL'?null:dept });
    toast('✅ เพิ่มผู้ใช้: '+email,'#0e8060');
    document.getElementById('nu-email').value='';
    document.getElementById('nu-pass').value='';
    renderUsersPage();
  }catch(e){ toast('❌ '+(e.message||e),'#c0392b'); }
}

async function adminResetPw(userId, email){
  const np = prompt('ตั้งรหัสผ่านใหม่ให้ '+email+' (อย่างน้อย 6 ตัว):');
  if(np===null) return;
  if(np.length < 6){ toast('รหัสผ่านสั้นเกินไป','#c0392b'); return; }
  try{ await callAdminFn('setPassword', { userId, password: np }); toast('✅ รีเซ็ตรหัสผ่านแล้ว','#0e8060'); }
  catch(e){ toast('❌ '+(e.message||e),'#c0392b'); }
}

function adminEditMeta(userId){
  const u = _usersCache.find(x=>x.id===userId); if(!u) return;
  document.getElementById('em-id').value = userId;
  document.getElementById('em-who').textContent = u.email||'';
  document.getElementById('em-role').value = u.role==='admin'?'admin':'staff';
  document.getElementById('em-dept').value = u.dept || 'ALL';
  document.getElementById('editmeta-modal').classList.add('open');
}
function closeEditMeta(){ document.getElementById('editmeta-modal').classList.remove('open'); }
async function saveEditMeta(){
  const userId = document.getElementById('em-id').value;
  const role = document.getElementById('em-role').value;
  const dept = document.getElementById('em-dept').value;
  try{
    await callAdminFn('setMeta', { userId, role, dept: dept==='ALL'?null:dept });
    toast('✅ อัปเดตสิทธิ์เรียบร้อย (ผู้ใช้ต้อง login ใหม่จึงจะมีผลเต็มที่)','#0e8060');
    closeEditMeta();
    renderUsersPage();
  }catch(e){ toast('❌ '+(e.message||e),'#c0392b'); }
}

async function adminDeleteUser(userId, email){
  if(!confirm('ลบผู้ใช้ '+email+' ?\nการกระทำนี้ย้อนกลับไม่ได้')) return;
  try{ await callAdminFn('delete', { userId }); toast('🗑 ลบผู้ใช้แล้ว','#0e8060'); renderUsersPage(); }
  catch(e){ toast('❌ '+(e.message||e),'#c0392b'); }
}

// ════════════════════════════════════════
// TRANSFER DASHBOARD (สรุปย้ายวอร์ด)
// แสดงผู้ป่วยที่ "ย้ายward รอห้อง" และ "ย้าย ward ได้ห้องแล้ว"
// ทุกแผนกในหน้าเดียว แก้ไขได้
// ════════════════════════════════════════
function getAllTransferBeds() {
  const out = [];
  const depts = transferDeptFilter === 'ALL' ? ALL_DEPTS : [transferDeptFilter];
  depts.forEach(d => {
    Object.values(allBeds[d]||{}).forEach(b => {
      if(b.plan === 'ย้ายward รอห้อง' || b.plan === 'ย้าย ward ได้ห้องแล้ว') {
        out.push({...b, _dept:d});
      }
    });
  });
  return out;
}
function setTransferDeptFilter(d) {
  transferDeptFilter = d;
  document.querySelectorAll('.tr-dept-btn').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.dept === d);
  });
  renderTransferDashboard();
}
// Sub-summary inside "รอห้อง" column — counts by room type, monitor, gender
function renderWaitingSubSummary(waiting) {
  if(!waiting.length) return '';
  const rt = {'รวม':0,'เดี่ยว':0,'suite':0,'(ไม่ระบุ)':0};
  const mon = {'ต้องการ':0,'ไม่ต้องการ':0,'(ไม่ระบุ)':0};
  const gen = {'ชาย':0,'หญิง':0,'(ไม่ระบุ)':0};
  waiting.forEach(b => {
    const r = b.transferRoomType || '(ไม่ระบุ)';
    rt[r] = (rt[r]||0) + 1;
    const m = b.transferMonitor || '(ไม่ระบุ)';
    mon[m] = (mon[m]||0) + 1;
    const g = b.transferGenderPref || b.gender || '(ไม่ระบุ)';
    gen[g] = (gen[g]||0) + 1;
  });
  return `
    <div class="tr-subsum">
      <div class="tr-subsum-row">
        <span class="tr-subsum-lbl">🏠 ประเภท:</span>
        <span class="tr-subsum-pill" style="background:var(--ambd);color:var(--ambl);border-color:#e0a020;">รวม <b>${rt['รวม']||0}</b></span>
        <span class="tr-subsum-pill" style="background:var(--ambd);color:var(--ambl);border-color:#e0a020;">เดี่ยว <b>${rt['เดี่ยว']||0}</b></span>
        <span class="tr-subsum-pill" style="background:var(--ambd);color:var(--ambl);border-color:#e0a020;">Suite <b>${rt['suite']||0}</b></span>
        ${rt['(ไม่ระบุ)']?`<span class="tr-subsum-pill" style="background:var(--surf2);color:var(--txm);border-color:var(--bdr);">ไม่ระบุ <b>${rt['(ไม่ระบุ)']}</b></span>`:''}
      </div>
      <div class="tr-subsum-row">
        <span class="tr-subsum-lbl">📺 Monitor:</span>
        <span class="tr-subsum-pill" style="background:var(--blued);color:var(--blue);border-color:var(--blue);">ต้องการ <b>${mon['ต้องการ']||0}</b></span>
        <span class="tr-subsum-pill" style="background:var(--surf2);color:var(--txd);border-color:var(--bdr);">ไม่ต้องการ <b>${mon['ไม่ต้องการ']||0}</b></span>
        ${mon['(ไม่ระบุ)']?`<span class="tr-subsum-pill" style="background:var(--surf2);color:var(--txm);border-color:var(--bdr);">ไม่ระบุ <b>${mon['(ไม่ระบุ)']}</b></span>`:''}
      </div>
      <div class="tr-subsum-row">
        <span class="tr-subsum-lbl">👤 เพศ:</span>
        <span class="tr-subsum-pill" style="background:#d0e8f8;color:#1a3a6a;border-color:#7ab0d8;">ชาย <b>${gen['ชาย']||0}</b></span>
        <span class="tr-subsum-pill" style="background:#f8d8e8;color:#6a1a3a;border-color:#d87aaa;">หญิง <b>${gen['หญิง']||0}</b></span>
        ${gen['(ไม่ระบุ)']?`<span class="tr-subsum-pill" style="background:var(--surf2);color:var(--txm);border-color:var(--bdr);">ไม่ระบุ <b>${gen['(ไม่ระบุ)']}</b></span>`:''}
      </div>
    </div>`;
}
// Sub-summary inside "ได้ห้องแล้ว" column — counts of each checklist item
function renderGotSubSummary(got) {
  if(!got.length) return '';
  const items = CL['ย้าย ward ได้ห้องแล้ว'] || [];
  const counts = {};
  items.forEach(it => counts[it.id] = 0);
  got.forEach(b => (b.checks||[]).forEach(cid => { if(counts.hasOwnProperty(cid)) counts[cid]++; }));
  const active = items.filter(it => counts[it.id] > 0).sort((a,b) => counts[b.id] - counts[a.id]);
  if(!active.length) return `<div class="tr-subsum"><span style="font-size:11px;color:var(--txm);">ยังไม่มีการ check รายการ checklist</span></div>`;
  return `
    <div class="tr-subsum">
      <div class="tr-subsum-row">
        <span class="tr-subsum-lbl">⏳ รอ:</span>
        ${active.map(it => `<span class="tr-subsum-pill" style="background:var(--blued);color:var(--blue);border-color:var(--blue);">${it.l} <b>${counts[it.id]}</b></span>`).join('')}
      </div>
    </div>`;
}
function timeAgo(iso) {
  if(!iso) return '—';
  try {
    const t = new Date(iso); if(isNaN(t)) return '—';
    const diff = (Date.now() - t.getTime()) / 1000;
    if(diff < 60) return `${Math.floor(diff)} วินาทีที่แล้ว`;
    if(diff < 3600) return `${Math.floor(diff/60)} นาทีที่แล้ว`;
    if(diff < 86400) return `${Math.floor(diff/3600)} ชม.ที่แล้ว`;
    return `${Math.floor(diff/86400)} วันที่แล้ว`;
  } catch { return '—'; }
}
function renderTransferDashboard() {
  const all = getAllTransferBeds();
  const waiting = all.filter(b => b.plan === 'ย้ายward รอห้อง');
  const got = all.filter(b => b.plan === 'ย้าย ward ได้ห้องแล้ว');
  const filterLbl = transferDeptFilter === 'ALL' ? 'ทุกแผนก' : transferDeptFilter;
  // Top summary cards
  const sum = document.getElementById('tr-summary');
  if(sum) {
    const byDeptWait = (transferDeptFilter === 'ALL' ? ALL_DEPTS : [transferDeptFilter]).map(d=>{const n=waiting.filter(b=>b._dept===d).length;return `${deptPill(d)} ${n}`;}).join(' ');
    const byDeptGot  = (transferDeptFilter === 'ALL' ? ALL_DEPTS : [transferDeptFilter]).map(d=>{const n=got.filter(b=>b._dept===d).length;return `${deptPill(d)} ${n}`;}).join(' ');
    sum.innerHTML = `
      <div class="tr-sum-card" style="border-color:var(--ambl);">
        <div class="tr-sum-lbl" style="color:var(--ambl);">🟡 รอห้อง</div>
        <div class="tr-sum-val">${waiting.length}</div>
        <div class="tr-sum-brk">${byDeptWait}</div>
      </div>
      <div class="tr-sum-card" style="border-color:var(--blue);">
        <div class="tr-sum-lbl" style="color:var(--blue);">🔵 ได้ห้องแล้ว</div>
        <div class="tr-sum-val">${got.length}</div>
        <div class="tr-sum-brk">${byDeptGot}</div>
      </div>
      <div class="tr-sum-card" style="border-color:var(--teal);">
        <div class="tr-sum-lbl" style="color:var(--teal);">📊 รวม (${filterLbl})</div>
        <div class="tr-sum-val">${waiting.length + got.length}</div>
        <div class="tr-sum-brk">ผู้ป่วยที่กำลังย้ายวอร์ด</div>
      </div>`;
  }
  // Column header counts
  const wc = document.getElementById('tr-wait-cnt'); if(wc) wc.textContent = `(${waiting.length})`;
  const gc = document.getElementById('tr-got-cnt'); if(gc) gc.textContent = `(${got.length})`;
  // Sub-summaries
  const wsEl = document.getElementById('tr-wait-summary'); if(wsEl) wsEl.innerHTML = renderWaitingSubSummary(waiting);
  const gsEl = document.getElementById('tr-got-summary'); if(gsEl) gsEl.innerHTML = renderGotSubSummary(got);
  // Card lists
  document.getElementById('tr-waiting').innerHTML = waiting.length
    ? waiting.map(renderTransferCard).join('')
    : '<div class="tr-empty">ไม่มีผู้ป่วยที่รอห้อง</div>';
  document.getElementById('tr-got').innerHTML = got.length
    ? got.map(renderTransferCard).join('')
    : '<div class="tr-empty">ไม่มีผู้ป่วยที่ได้ห้องแล้ว</div>';
}
function renderTransferCard(b) {
  const d = b._dept;
  const clsH = b.class ? (()=>{const c=CLASS_COLORS[String(b.class)]; if(!c) return ''; return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:${c.bg};color:${c.tx};border:1px solid ${c.br};">C${b.class}</span>`;})() : '';
  const gb = b.gender ? `<span class="${b.gender==='ชาย'?'gbm':'gbf'}">${b.gender==='ชาย'?'ช':'ญ'}</span>` : '';
  const dxH = (b.dx||[]).slice(0,2).map(dx=>dxpill(dx)).join(' ');
  const moreDx = (b.dx||[]).length > 2 ? `<span style="font-size:10px;color:var(--txd);">+${b.dx.length-2}</span>` : '';
  const ago = b.transferTime ? `<span style="font-size:11px;color:var(--txd);">⏱ ${timeAgo(b.transferTime)}</span>` : '';
  let detail = '';
  if(b.plan === 'ย้ายward รอห้อง') {
    const rt = b.transferRoomType ? `<span style="background:var(--ambd);color:var(--ambl);border:1px solid #e0a020;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">🏠 ${b.transferRoomType}</span>` : '';
    const mon = b.transferMonitor ? `<span style="background:var(--blued);color:var(--blue);border:1px solid var(--blue);border-radius:4px;padding:2px 8px;font-size:11px;">📺 ${b.transferMonitor}</span>` : '';
    const tgen = b.transferGenderPref ? `<span style="background:${b.transferGenderPref==='ชาย'?'#d0e8f8':'#f8d8e8'};color:${b.transferGenderPref==='ชาย'?'#1a3a6a':'#6a1a3a'};border:1px solid ${b.transferGenderPref==='ชาย'?'#7ab0d8':'#d87aaa'};border-radius:4px;padding:2px 8px;font-size:11px;">👤 ${b.transferGenderPref}</span>` : '';
    detail = `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px;">${rt}${mon}${tgen}${!rt && !mon && !tgen ? '<span style="color:var(--txm);font-size:11px;">ยังไม่ได้ระบุประเภทห้อง</span>' : ''}</div>`;
  } else {
    const dest = (b.transferWard || b.transferRoom) ? `<div style="margin-top:6px;background:var(--blued);border:1px solid var(--blue);border-radius:var(--r);padding:6px 10px;font-size:12px;color:var(--blue);font-weight:600;">📍 Ward ${b.transferWard||'—'} · ห้อง ${b.transferRoom||'—'}${b.transferBed?' · เตียง '+b.transferBed:''}</div>` : '';
    detail = dest;
  }
  // Checked items (สถานะ checklist) — แสดงรายการที่เลือกไว้
  const cl = CL[b.plan] || [];
  const checked = cl.filter(i => (b.checks||[]).includes(i.id));
  const checkRow = checked.length
    ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:3px;">${checked.map(i => {
        const color = b.plan==='ย้ายward รอห้อง' ? {bg:'#d0eedc',tx:'#0a5030',br:'#6ec8a0'} : {bg:'#d8eaf8',tx:'#1a3a6a',br:'#7ab0d8'};
        return `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;background:${color.bg};color:${color.tx};border:1px solid ${color.br};">✓ ${i.l}</span>`;
      }).join('')}</div>`
    : '';
  return `
    <div class="tr-card" onclick="openBed('${d}','${b.id}')">
      <div class="tr-card-head">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
          ${deptPill(d)}
          <span class="bedc" style="width:34px;height:34px;font-size:13px;background:#1a6fcc;color:#fff;">${b.id}</span>
          ${b.deptType ? tpill(b.deptType) : ''}
          ${clsH}
        </div>
        ${ago}
      </div>
      <div style="margin-top:6px;font-size:12px;color:var(--tx);">
        ${gb} ${b.age?b.age+' ปี':''} ${b.los?`<span style="color:var(--txd);">· LOS ${b.los}d</span>`:''}
        ${b.rn?`<span style="color:#0e8060;margin-left:6px;">RN: ${b.rn}</span>`:''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:5px;">${dxH}${moreDx}</div>
      ${(String(b.class)==='5' && ((b.class5Items||[]).length || b.class5Other)) ? `<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:3px;">${(b.class5Items||[]).map(id=>{const opt=CLASS5_OPTIONS.find(o=>o.id===id);return opt?`<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;background:#fce8e8;color:#8a1a1a;border:1px solid #d88080;">${opt.icon} ${opt.l}</span>`:'';}).join('')}${b.class5Other?`<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;background:#fce8e8;color:#8a1a1a;border:1px solid #d88080;">+ ${b.class5Other}</span>`:''}</div>` : ''}
      ${b.master?`<div style="font-size:11px;color:var(--blue);margin-top:4px;">M: ${b.master}</div>`:''}
      ${detail}
      ${checkRow}
    </div>`;
}

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
function initApp() {
  loadAll().then(() => {
    const n = new Date();
    const lbl = document.getElementById('today-lbl');
    if(lbl) lbl.textContent = `${n.getDate()} ${MONTHS[n.getMonth()]} ${n.getFullYear()+543}`;
    changeDept(); tick(); setInterval(tick, 1000);
    setupRealtime();
    // BroadcastChannel fallback (same-origin tabs without Supabase)
    try { const bc=new BroadcastChannel('ccu_bc'); bc.onmessage=()=>{load().then(()=>{renderTable();renderStaff();if(document.getElementById('transfer-mode')?.style.display==='flex')renderTransferDashboard();toast('🔄 ข้อมูลอัปเดต','#1a6fcc');});}; } catch{}
    // Auto-refresh countdown
    const TOTAL = 300; let cd = TOTAL;
    const el = document.getElementById('cdt');
    setInterval(() => {
      if(autoRefreshPaused){if(el)el.textContent='⏸ พักรีเฟรช';return;}
      cd--;
      if(cd <= 0) { load().then(()=>{renderTable();renderStaff();autoClear();if(document.getElementById('transfer-mode')?.style.display==='flex')renderTransferDashboard();}); cd=TOTAL; toast('🔄 รีเฟรชอัตโนมัติ','#1a6fcc'); }
      const m=Math.floor(cd/60),s=cd%60;
      if(el) el.textContent=`🔄 ${m}:${String(s).padStart(2,'0')}`;
    }, 1000);
  });
}
