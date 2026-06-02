-- ════════════════════════════════════════════════════════════
-- RLS สำหรับตาราง ccu_state
-- เป้าหมาย: ทุกคนที่ "login แล้ว" (admin + staff) อ่าน/เพิ่ม/แก้ ได้ทุกแผนก
--          ส่วนคนที่ "ไม่ได้ login" (anon) เข้าไม่ได้เลย
--
-- วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งหมดนี้ → Run
-- ปลอดภัยกับข้อมูลเดิม: ไม่ลบ/ไม่แก้ข้อมูลในตาราง แค่ตั้งกฎการเข้าถึงใหม่
-- ════════════════════════════════════════════════════════════

-- 1) เปิด Row Level Security ที่ตาราง
alter table public.ccu_state enable row level security;

-- 2) ลบ policy เดิมทั้งหมดบนตารางนี้ (รวม policy เก่าที่อาจล็อกให้เฉพาะ admin
--    เขียนได้ ซึ่งเป็นสาเหตุที่ staff กดนำเข้าแล้ว error / ไม่บันทึก)
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'ccu_state'
  loop
    execute format('drop policy if exists %I on public.ccu_state', pol.policyname);
  end loop;
end $$;

-- 3) สร้าง policy ใหม่: อนุญาตเฉพาะผู้ที่ login แล้ว (authenticated)
--    ให้ อ่าน / เพิ่ม / แก้ ได้ทุกแผนก — ไม่แยก admin/staff
create policy "all_auth_read"
  on public.ccu_state for select
  to authenticated
  using ( true );

create policy "all_auth_insert"
  on public.ccu_state for insert
  to authenticated
  with check ( true );

create policy "all_auth_update"
  on public.ccu_state for update
  to authenticated
  using ( true )
  with check ( true );

-- หมายเหตุ:
-- * ไม่เปิด policy สำหรับ DELETE → แอปไม่ได้ลบทั้งแถวอยู่แล้ว
--   ("ล้างเตียง" เป็นการ update ภายในแถว ไม่ใช่ลบแถว)
-- * anon (ไม่ได้ login) ไม่มี policy ใดอนุญาต = เข้าไม่ได้เลย
-- * ตรวจผลได้: รัน  select * from pg_policies where tablename='ccu_state';
--   ควรเห็น 3 policy ด้านบน และไม่มี policy เก่าที่ล็อกเฉพาะ admin หลงเหลือ
