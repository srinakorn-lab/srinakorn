-- ════════════════════════════════════════════════════════════
-- RLS ขั้นพื้นฐานสำหรับตาราง ccu_state
-- เป้าหมาย: ปิดไม่ให้คนที่ "ไม่ได้ login" อ่าน/เขียนข้อมูลได้
--          (เดิม anon key ใครก็ยิงตรงเข้าฐานข้อมูลได้)
--
-- วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งหมดนี้ → Run
-- ปลอดภัยกับข้อมูลเดิม: ไม่ลบ/ไม่แก้ข้อมูล แค่เพิ่มกฎการเข้าถึง
-- ════════════════════════════════════════════════════════════

-- 1) เปิด Row Level Security ที่ตาราง
alter table public.ccu_state enable row level security;

-- 2) ลบ policy เดิมชื่อเดียวกัน (กันรันซ้ำแล้ว error)
drop policy if exists "logged_in_read"   on public.ccu_state;
drop policy if exists "logged_in_insert" on public.ccu_state;
drop policy if exists "logged_in_update" on public.ccu_state;

-- 3) อนุญาตเฉพาะผู้ที่ login แล้ว (authenticated) ให้ อ่าน / เพิ่ม / แก้
--    ทุกแผนก — ตรงกับความต้องการ: ทุก user ดูได้ทุกแผนก + นำเข้าได้
create policy "logged_in_read"
  on public.ccu_state for select
  to authenticated
  using ( true );

create policy "logged_in_insert"
  on public.ccu_state for insert
  to authenticated
  with check ( true );

create policy "logged_in_update"
  on public.ccu_state for update
  to authenticated
  using ( true )
  with check ( true );

-- หมายเหตุ:
-- * ไม่เปิด policy สำหรับ DELETE → ปกติแอปไม่ได้ลบทั้งแถวอยู่แล้ว
--   (การ "ล้างเตียง" เป็นการ update ข้อมูลภายในแถว ไม่ใช่ลบแถว)
-- * ผู้ใช้ที่ "ไม่ได้ login" (anon) จะไม่มี policy ใดอนุญาต = เข้าถึงไม่ได้เลย
-- * ขั้นนี้คือพื้นฐาน: กันคนนอกระบบ ส่วนการจำกัด "แต่ละ user เห็นเฉพาะแผนกตัวเอง"
--   เป็นขั้นสูงกว่า ทำเพิ่มภายหลังได้โดยไม่กระทบของเดิม
