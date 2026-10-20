// POST /api/extract  { image: <base64>, media_type: "image/jpeg" }
// Uses RAPID_API_KEY, else OPENAI_API_KEY, else ANTHROPIC_API_KEY.
// Models can be overridden with OPENROUTER_MODEL / OPENAI_MODEL / ANTHROPIC_MODEL.
const PROMPT = `You are reading a supplier tax invoice. Extract every line item from the goods table.
Return ONLY a JSON object, no markdown, in this shape:
{"invoice_no":"","invoice_date":"YYYY-MM-DD or ''","total":number|null,
"items":[{"part":"","desc":"","hsn":"","qty":number,"unit":"","rate":number}]}
Rules:
- part = the part number or item code column.
- desc = the description of goods.
- hsn = the HSN/SAC code column.
- qty = quantity column.
- unit = unit column (e.g. PCS, NOS).
- rate = rate per item column (before tax).
- total = the grand total printed on the invoice.
- Skip tax, freight, round-off and total rows; they are not items.
- Numbers must be plain numbers without commas or currency symbols. Include every row, in order. Do not invent values; use "" or null if unreadable.`;

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

const toNum = v => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[,₹\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const str = v => String(v ?? "").trim();

// OpenRouter uses the same request format as OpenAI.
async function callOpenAICompatible(url, key, model, image, mediaType) {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Mangalam Stock Scanner" },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: [
        { type: "text", text: PROMPT },
        { type: "image_url", image_url: { url: `data:${mediaType};base64,${image}`, detail: "high" } }
      ] }]
    })
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) throw new Error("AI API key is invalid or revoked. Create a new key and update RAPID_API_KEY / RAPID_API_KEY in Cloudflare.");
  if (r.status === 402) throw new Error("AI account has no credits left. Add credits to your OpenRouter/OpenAI account.");
  if (!r.ok) throw new Error(d.error?.message || `AI error ${r.status}`);
  return d.choices?.[0]?.message?.content || "";
}

async function callAnthropic(env, image, mediaType) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      max_tokens: 8192,
      temperature: 0,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
        { type: "text", text: PROMPT }
      ] }]
    })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error?.message || `Anthropic error ${r.status}`);
  return (d.content || []).filter(c => c.type === "text").map(c => c.text).join("");
}

function parse(txt) {
  const s = txt.indexOf("{"), e = txt.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("AI did not return JSON");
  const o = JSON.parse(txt.slice(s, e + 1));
  const date = str(o.invoice_date);
  return {
    invoice_no: str(o.invoice_no),
    invoice_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
    total: toNum(o.total),
    items: (Array.isArray(o.items) ? o.items : [])
      .map(i => ({
        part: str(i.part),
        desc: str(i.desc),
        hsn: str(i.hsn).replace(/\s/g, ""),
        qty: toNum(i.qty) ?? 0,
        unit: str(i.unit) || "Pcs",
        rate: toNum(i.rate) ?? 0
      }))
      .filter(i => i.part || i.desc)
  };
}

export async function onRequestPost({ request, env }) {
  if (!env.RAPID_API_KEY && !env.OPENAI_API_KEY && !env.ANTHROPIC_API_KEY)
    return J({ error: "AI API key not set. Add RAPID_API_KEY (or RAPID_API_KEY / ANTHROPIC_API_KEY) in Cloudflare Pages environment variables." }, 500);

  let body;
  try { body = await request.json(); } catch { return J({ error: "Invalid request body" }, 400); }
  const { image, media_type } = body || {};
  if (!image) return J({ error: "No image provided" }, 400);
  const mediaType = /^image\/(jpeg|png|webp|gif)$/.test(media_type) ? media_type : "image/jpeg";

  try {
    const txt = env.RAPID_API_KEY
      ? await callOpenAICompatible("https://rapidapi.com/nCoreFauG/api/rapid_api_key4", env.RAPID_API_KEY, env.OPENROUTER_MODEL || "openai/gpt-4o-mini", image, mediaType)
      : env.OPENAI_API_KEY
        ? await callOpenAICompatible("https://rapidapi.com/nCoreFauG/api/rapid_api_key4", env.RAPID_API_KEY, env.OPENAI_MODEL || "gpt-4o-mini", image, mediaType)
        : await callAnthropic(env, image, mediaType);
    return J(parse(txt));
  } catch (err) {
    return J({ error: "Extraction failed: " + err.message }, 502);
  }
}
