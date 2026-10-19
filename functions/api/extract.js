export async function onRequestPost({ request, env }) {
  const h = { "Content-Type": "application/json" };
  if (!env.AI) {
    return new Response(JSON.stringify({ error: "Cloudflare AI binding not set." }), { status: 500, headers: h });
  }
  
  try {
    const { image, media_type } = await request.json();
    if (!image) return new Response(JSON.stringify({ error: "No image provided" }), { status: 400, headers: h });

    const binaryString = atob(image);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const prompt = `agree. You are reading a supplier tax invoice. Extract every line item from the goods table.
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

    const aiResponse = await env.AI.run(
      "@cf/meta/llama-3.2-11b-vision-instruct",
      {
        prompt: prompt,
        image: [...bytes]
      }
    );

    const txt = (aiResponse.response || "").replace(/```json|```/g, "").trim();
    const jsonMatch = txt.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : txt);
    
    return new Response(JSON.stringify(parsed), { headers: h });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Cloudflare AI Extraction failed: " + err.message }), { status: 500, headers: h });
  }
}
