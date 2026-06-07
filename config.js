// ════════════════════════════════════════
// config.js — critical System
// คัดลอกไฟล์นี้เป็น config.js แล้วใส่ค่าจริง
// ห้าม commit ไฟล์นี้ขึ้น Git (ใส่ใน .gitignore)
// ════════════════════════════════════════

window.CFG = {
  // --- Supabase ---
  // ดูค่าได้จาก: Supabase Dashboard → Project Settings → API
  supabaseUrl:  "https://yqlwxlfgwjjtomqukazs.supabase.co",
  supabaseKey:  "sb_publishable_w6TdkZkc0COHD772Qsn5vw_oSpa48KO",   // anon / public key (ไม่ใช่ service_role)

  // --- Claude AI (สำหรับ parse รายงาน โหมด AI) ---
  // ดูค่าได้จาก: console.anthropic.com → API Keys
  // ถ้าไม่ใช้โหมด AI ปล่อยว่างได้
  anthropicKey: "sk-ant-YOUR_KEY_HERE",
};
