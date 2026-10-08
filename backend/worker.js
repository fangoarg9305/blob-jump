import { createClient } from "@libsql/client/web";
const H = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Content-Type":"application/json"};
const enc = new TextEncoder();
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey("raw", key, {name:"HMAC", hash:"SHA-256"}, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, msg));
}
// Valida initData de Telegram (firma HMAC con el token del bot)
async function check(initData, token) {
  const p = new URLSearchParams(initData), hash = p.get("hash");
  if (!hash) return null;
  p.delete("hash");
  const str = [...p.entries()].map(([k, v]) => k + "=" + v).sort().join("\n");
  const secret = await hmac(enc.encode("WebAppData"), enc.encode(token));
  const sig = [...await hmac(secret, enc.encode(str))].map(b => b.toString(16).padStart(2, "0")).join("");
  if (sig !== hash || Date.now() / 1000 - Number(p.get("auth_date")) > 86400) return null;
  try { return JSON.parse(p.get("user")); } catch { return null; }
}
export default {
  async fetch(req, env) {
    try {
      if (req.method === "OPTIONS") return new Response(null, {headers: H});
      const db = createClient({url: env.TURSO_URL, authToken: env.TURSO_TOKEN}), u = new URL(req.url);
      if (u.pathname === "/top") {
        const r = await db.execute("SELECT name, best AS score FROM scores ORDER BY best DESC LIMIT 10");
        return new Response(JSON.stringify(r.rows.map(x => ({name: x.name, score: x.score}))), {headers: H});
      }
      if (u.pathname === "/score" && req.method === "POST") {
        const b = await req.json().catch(() => ({})), s = Math.floor(+b.score);
        const user = await check(String(b.initData || ""), env.BOT_TOKEN);
        if (!user || !(s >= 0 && s <= 3000)) return new Response("{}", {status: 403, headers: H});
        await db.execute({
          sql: "INSERT INTO scores(tg_id,name,best,updated_at) VALUES(?,?,?,unixepoch()) ON CONFLICT(tg_id) DO UPDATE SET best=MAX(best,excluded.best),name=excluded.name,updated_at=unixepoch()",
          args: [user.id, user.first_name || "Jugador", s]
        });
        return new Response("{}", {headers: H});
      }
      return new Response("{}", {status: 404, headers: H});
    } catch (e) {
      return new Response(JSON.stringify({error: e.message}), {status: 500, headers: H});
    }
  }
};