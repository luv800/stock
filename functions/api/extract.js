// Cloudflare Pages Function: POST /api/extract  { image: <base64>, media_type: "image/jpeg" }
// Set ANTHROPIC_API_KEY in Pages > Settings > Environment variables (Secret).
const PROMPT = `You are reading a supplier tax invoice. Extract every line item from the goods table.
Return ONLY JSON, no markdown, in this shape:
{"invoice_no":"","invoice_date":"YYYY-MM-DD or ''","total":number|null,
"items":[{"part":"","desc":"","hsn":"","qty":number,"unit":"","rate":number}]}
Rules:
- The "Description of Goods/Service" cell is "<PartNumber> - <Description>". part = text before the FIRST "-", desc = text after it. If there is no "-", put everything in desc and leave part "".
- hsn = the "HSN/SAC" column. qty = "Qty." column. unit = "Unit" column (e.g. NOS, PCS). rate = "Rate (Per Item)" column.
- Numbers must be plain numbers without commas. Include every row, in order. Do not invent values; use "" or null if unreadable.`;

export async function onRequestPost({ request, env }) {
  const h = { "Content-Type": "application/json" };
  if (!env.ANTHROPIC_API_KEY) return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), { status: 500, headers: h });
  const { image, media_type } = await request.json();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL || "claude-sonnet-5-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: media_type || "image/jpeg", data: image } },
        { type: "text", text: PROMPT } ] }]
    })
  });
  const d = await r.json();
  if (!r.ok) return new Response(JSON.stringify({ error: d.error?.message || "API error" }), { status: 502, headers: h });
  const txt = (d.content || []).map(c => c.text || "").join("").replace(/```json|```/g, "").trim();
  try { JSON.parse(txt); } catch { return new Response(JSON.stringify({ error: "Unreadable response" }), { status: 502, headers: h }); }
  return new Response(txt, { headers: h });
}
