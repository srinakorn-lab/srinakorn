// ════════════════════════════════════════════════════════════
// Supabase Edge Function: admin-users
// จัดการผู้ใช้อย่างปลอดภัย — service_role อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น
//
// Deploy:
//   supabase functions deploy admin-users
// (SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติใน Edge Functions)
//
// การตรวจสิทธิ์: ผู้เรียกต้องเป็นผู้ใช้ที่ login แล้ว และมี
//   user_metadata.role === 'admin' เท่านั้น
// ════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── ตรวจว่าผู้เรียกเป็น admin ──
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "ไม่มี token" }, 401);
    const { data: caller, error: cErr } = await admin.auth.getUser(token);
    if (cErr || !caller?.user) return json({ error: "token ไม่ถูกต้อง" }, 401);
    if ((caller.user.user_metadata?.role) !== "admin") {
      return json({ error: "เฉพาะผู้ดูแลระบบ (admin) เท่านั้น" }, 403);
    }

    const body = await req.json();
    const action = body?.action;

    if (action === "list") {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) throw error;
      const users = data.users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.user_metadata?.role || "staff",
        dept: u.user_metadata?.dept || "",
        last_sign_in_at: u.last_sign_in_at,
        created_at: u.created_at,
      }));
      return json({ users });
    }

    if (action === "create") {
      const { email, password, role, dept } = body;
      if (!email || !password) return json({ error: "ต้องมีอีเมลและรหัสผ่าน" }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // สร้างใช้งานได้ทันที ไม่ต้องยืนยันอีเมล
        user_metadata: { role: role || "staff", dept: dept || null },
      });
      if (error) throw error;
      return json({ user: { id: data.user?.id, email: data.user?.email } });
    }

    if (action === "setPassword") {
      const { userId, password } = body;
      if (!userId || !password) return json({ error: "ข้อมูลไม่ครบ" }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "setMeta") {
      const { userId, role, dept } = body;
      if (!userId) return json({ error: "ไม่มี userId" }, 400);
      const { data: cur } = await admin.auth.admin.getUserById(userId);
      const meta = { ...(cur?.user?.user_metadata || {}), role, dept: dept || null };
      const { error } = await admin.auth.admin.updateUserById(userId, { user_metadata: meta });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete") {
      const { userId } = body;
      if (!userId) return json({ error: "ไม่มี userId" }, 400);
      if (userId === caller.user.id) return json({ error: "ลบบัญชีตัวเองไม่ได้" }, 400);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "action ไม่ถูกต้อง" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
