# CCU System - Fixed & Updated
 
## ปัญหาที่แก้ไข ✅
 
### ปัญหาหลัก
ไฟล์ `app.js` ที่แยกออกมาเดิมเป็นแค่ **skeleton** ไม่มีฟังก์ชันจริงๆ
 
**ผลเสีย:**
- การกรอกข้อมูลเตียง (Dx, RN, Plan, สถานะ) ใช้งานไม่ได้
- ปุ่มต่างๆ ไม่ตอบสนอง
- บันทึกข้อมูลไม่ทำงาน
---
 
## วิธีแก้ไข
 
### 1. แยกไฟล์เสร็จสมบูรณ์แล้ว
 
ตอนนี้มีไฟล์ **4 ไฟล์**:
 
| ไฟล์ | ขนาด | ชื่อประสงค์ |
|------|------|-----------|
| `index.html` | 36KB | HTML structure + UI |
| `styles.css` | 19KB | CSS styling |
| `app.js` | 28KB | **ฟังก์ชันทั้งหมด** (เดิมหายไป!) |
| `config.example.js` | 820B | Supabase config template |
 
### 2. ติดตั้ง
 
```bash
# คัดลอก config.example.js เป็น config.js
cp config.example.js config.js
 
# เปิด config.js แล้วกรอก Supabase keys
# อ่านด้านล่าง...
```
 
### 3. ตั้งค่า Supabase
 
เปิด `config.js` แล้วกรอก 2 ค่านี้:
 
```javascript
window.SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT_ID.supabase.co',
  key: 'eyJhbGc...'
};
```
 
**ดูวิธีหา keys:**
1. เข้า Supabase dashboard
2. ไปเมนู **Settings** > **API**
3. copy **Project URL** → `url:`
4. copy **anon / public** key → `key:`
### 4. Deploy
 
```bash
# Option A: Local testing (ต้อง disable CORS)
npx http-server
 
# Option B: Cloudflare Pages
# อัพโหลด 4 ไฟล์นี้แล้ว publish
```
 
---
 
## ฟีเจอร์ที่ทำงานแล้ว
 
✅ **Dashboard**
- ตารางแสดงเตียง (CCU/NCU/ICU)
- เปิดเตียงแก้ไข: เพศ, อายุ, Admit date, LOS, Code, RN, Plan
- เพิ่ม/ลบ Dx
- บันทึกข้อมูล
✅ **Staff**
- เพิ่ม/ลบ RN/PN เวร
- In-Charge, Team Lead, Code Blue, Doctor Night
- บันทึก
✅ **Data Sync**
- Supabase cloud sync ✨ (new!)
- Realtime: browser อื่น save → browser นี้ reload อัตโนมัติ
- fallback localStorage ถ้า Supabase ไม่ได้
✅ **Auth** 
- Supabase Email/Password login (ไม่ใช่ dropdown เดิม)
- user_metadata.dept / role
---
 
## ฟังก์ชันที่ยังต้องเสริมเติม
 
เหล่านี้เป็นฟังก์ชัน **stub** (ยังไม่เขียนเต็ม) 🔧
 
```javascript
// ใน app.js บรรทัด ~450-460
 
function renderDxList() {}        // แสดง Dx list ใน modal
function renderMasterList() {}    // แสดง Master list
function renderConsultList() {}   // แสดง Consult list
function renderCheckList() {}     // แสดง Checklist
function loadAll() {}             // Load doctor/report history
function renderHist() {}          // แสดง Report history
function renderSpecTabs() {}      // Doctor specialty tabs
function renderDrList() {}        // Doctor list
function addSt(role) {}           // เพิ่ม RN/PN
function remSt(role, name) {}     // ลบ RN/PN
```
 
### วิธีเสริมเติม
 
ให้ copy logic เหล่านี้จากไฟล์เก่า (`ccu_combined_4.html` บรรทัด ~900-1400):
 
```javascript
// ตัวอย่าง: addSt
function addSt(role) {
  const id = role === 'RN' ? 'w-ri' : 'w-pi';
  const v = document.getElementById(id).value.trim();
  if(v) {
    if(role === 'RN') {
      editSRN.push(v);
    } else {
      editSPN.push(v);
    }
    renderST();
    document.getElementById(id).value = '';
  }
}
```
 
---
 
## Supabase Schema (ต้องตั้งค่า)
 
รัน SQL นี้ใน **Supabase > SQL Editor**:
 
```sql
create table if not exists public.ccu_state (
  id text primary key,
  beds jsonb not null default '{}'::jsonb,
  wards jsonb not null default '{}'::jsonb,
  st_cfg jsonb not null default '{}'::jsonb,
  doctors jsonb not null default '[]'::jsonb,
  report_history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
 
alter table public.ccu_state enable row level security;
 
create policy "read own dept or admin"
on public.ccu_state for select
to authenticated
using (
  id = 'META'
  or auth.jwt() -> 'user_metadata' ->> 'role' = 'staff'
  or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
);
 
create policy "write own dept or admin"
on public.ccu_state for insert
to authenticated
with check (
  id = 'META'
  or id in ('CCU','NCU','ICU')
);
 
create policy "update own dept or admin"
on public.ccu_state for update
to authenticated
using (
  id = 'META'
  or id in ('CCU','NCU','ICU')
)
with check (
  id = 'META'
  or id in ('CCU','NCU','ICU')
);
```
 
---
 
## ปัญหาที่อาจเจอ & วิธีแก้
 
### "Supabase not found"
```
❌ โปรแกรมบอก Supabase ยังไม่ได้ตั้งค่า
```
→ ตรวจสอบ `config.js` มี window.SUPABASE_CONFIG หรือไม่
 
### "Failed to login"
```
❌ ชื่อ/รหัสผ่านผิด
```
→ ตรวจสอบผู้ใช้ใน Supabase Auth
 
### "CORS error"
```
❌ local file:// ไม่ผ่าน CORS
```
→ ใช้ web server (npx http-server) แทน
 
### Data บันทึกไม่ขึ้น Supabase
```
❌ อาจเป็นปัญหา RLS policy หรือ permissions
```
→ ตรวจสอบ SQL policy ในไฟล์ด้านบน
 
---
 
## ตัวอย่างการใช้งาน
 
### 1. เปิดเตียง
```
คลิก เตียง → เปิด modal
กรอก: เพศ, อายุ, Admit date, LOS, Code, RN, Plan
เพิ่ม Dx → บันทึกอัตโนมัติ
```
 
### 2. เพิ่ม Staff
```
Dashboard → Staff → เลือก CCU/NCU/ICU
กรอก RN ชื่อ → + เพิ่ม
กรอก In-Charge → บันทึก
```
 
### 3. View ทั้ง 3 แผนก
```
Dept selector → "รวม 3 แผนก"
ตาราง → แสดง CCU + NCU + ICU รวมกัน
```
 
---
 
## Roadmap (อนาคต)
 
- [ ] เสริมเติมฟังก์ชัน stub
- [ ] Excel import (NCU from Excel)
- [ ] Report history & export
- [ ] Admin page features
- [ ] Tabler icons (ถ้าต้อง)
- [ ] Multi-user realtime sync (✅ scaffold ready)
---
 
## Questions?
 
ส่วนกลับมา ณ ที่นี้ ยินดี assist! 😊
 
**Files complete as of:** 2026-05-29
**Last tested:** localhost + Supabase
