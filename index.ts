// ════════════════════════════════════════════════════════════
// Supabase Edge Function: ai-parse
// เรียก Claude API แทนเบราว์เซอร์ — เก็บ ANTHROPIC_API_KEY ไว้ฝั่งเซิร์ฟเวอร์
// ผู้เรียกต้องเป็นผู้ใช้ที่ login แล้วเท่านั้น
//
// Deploy:
//   supabase functions deploy ai-parse
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx
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
    // ── ตรวจว่าผู้เรียก login แล้ว ──
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "ต้องเข้าสู่ระบบก่อน" }, 401);
    const authClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u, error: uErr } = await authClient.auth.getUser();
    if (uErr || !u?.user) return json({ error: "token ไม่ถูกต้อง" }, 401);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" }, 500);

    const body = await req.json();
    const content = body?.content;
    if (!content) return json({ error: "ไม่มีเนื้อหา (content)" }, 400);

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{ role: "user", content }],
      }),
    });
    const data = await resp.json();
    if (!resp.ok) return json({ error: data?.error?.message || "Anthropic API error" }, resp.status);
    return json({ content: data.content });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
