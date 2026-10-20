const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

export async function onRequestGet({ env }) {
  if (!env.DB) return J({ error: "D1 database (binding DB) not connected" }, 500);
  try {
    const r = await env.DB.prepare("SELECT part,description,hsn,unit,rate,rack,qty,updated_at FROM stock ORDER BY part").all();
    return J(r.results);
  } catch (e) {
    return J({ error: "Could not load stock: " + e.message }, 500);
  }
}
