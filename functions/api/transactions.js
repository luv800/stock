const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

export async function onRequestGet({ env }) {
  if (!env.DB) return J({ error: "D1 database (binding DB) not connected" }, 500);
  try {
    const r = await env.DB.prepare(`SELECT t.no,t.invoice_no,t.invoice_date,t.invoice_total,t.confirmed_at,
      (SELECT COUNT(*) FROM inward_items i WHERE i.txn_no=t.no) AS items FROM inward_txns t ORDER BY t.confirmed_at DESC LIMIT 200`).all();
    return J(r.results);
  } catch (e) {
    return J({ error: "Could not load history: " + e.message }, 500);
  }
}
