const PROMPT = `You are reading a supplier tax invoice. Extract every line item from the goods table.
Return ONLY JSON, no markdown, in this shape:
{"invoice_no":"","invoice_date":"YYYY-MM-DD or ''","total":null,
"items":[{"part":"","desc":"","hsn":"","qty":1,"unit":"PC","rate":0}]}
Rules:
- part = the exact text BEFORE the "-" symbol in the "Description of Goods / Services" column.
- desc = the exact text AFTER the "-" symbol in the "Description of Goods / Services" column.
- hsn = the HSN/SAC code column.
- qty = quantity column value as a number.
- unit = unit column (e.g. PC, NOS).
- rate = rate per item column value as a number.
- Numbers must be plain numbers without commas. Include every row, in order. Do not invent values; use "" or null if unreadable.`;

export async function onRequestPost({ request, env }) {
  const h = { "Content-Type": "application/json" };
  const apiKey = env.OPENROUTER_API_KEY || env.OPENAI_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "API Key not set in Cloudflare Environment Variables" }), { status: 500, headers: h });
  
  try {
    const { image, media_type } = await request.json();
    if (!image) return new Response(JSON.stringify({ error: "No image provided" }), { status: 400, headers: h });

    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${apiKey}`, 
        "HTTP-Referer": "https://mangalamstock.pages.dev",
        "X-Title": "Stock Scanner",
        "content-type": "application/json" 
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: `data:${media_type || "image/jpeg"};base64,${image}` } }
        ]}]
      })
    });
    
    const d = await r.json();
    if (!r.ok) return new Response(JSON.stringify({ error: d.error?.message || "OpenRouter API error" }), { status: 502, headers: h });
    
    const txt = (d.choices[0]?.message?.content || "").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(txt);
    return new Response(JSON.stringify(parsed), { headers: h });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Extraction failed: " + err.message }), { status: 500, headers: h });
  }
}
