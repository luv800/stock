// Cloudflare Pages Function: POST /api/extract  { image: <base64>, media_type: "image/jpeg" }
const PROMPT = `You are reading a supplier tax invoice. Extract every line item from the goods table.
Return ONLY JSON, no markdown, in this shape:
{"invoice_no":"","invoice_date":"YYYY-MM-DD or ''","total":number|null,
"items":[{"part":"","desc":"","hsn":"","qty":number,"unit":"","rate":number}]}
Rules:
- part = the part number or item code column.
- desc = the description of goods.
- hsn = the HSN/SAC code column.
- qty = quantity column.
- unit = unit column (e.g. PCS, NOS).
- rate = rate per item column.
- Numbers must be plain numbers without commas. Include every row, in order. Do not invent values; use "" or null if unreadable.`;

export async function onRequestPost({ request, env }) {
  const h = { "Content-Type": "application/json" };
  const apiKey = env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "AI API Key not set in Cloudflare Environment Variables" }), { status: 500, headers: h });
  
  try {
    const { image, media_type } = await request.json();
    if (!image) return new Response(JSON.stringify({ error: "No image provided" }), { status: 400, headers: h });

    // Using OpenAI GPT-4o-mini for fast, accurate vision extraction
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: `data:${media_type || "image/jpeg"};base64,${image}` } }
        ]}]
      })
    });
    
    const d = await r.json();
    if (!r.ok) return new Response(JSON.stringify({ error: d.error?.message || "API error" }), { status: 502, headers: h });
    
    const txt = (d.choices[0]?.message?.content || "").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(txt);
    return new Response(JSON.stringify(parsed), { headers: h });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Extraction failed: " + err.message }), { status: 500, headers: h });
  }
}
