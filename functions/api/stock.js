export async function onRequestGet({ env }) {
  const r = await env.DB.prepare("SELECT part,description,hsn,unit,rate,qty,updated_at FROM stock ORDER BY part").all();
  return new Response(JSON.stringify(r.results), { headers: { "Content-Type": "application/json" } });
}