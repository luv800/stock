export async function onRequestGet({ env }) {
  const r = await env.DB.prepare(`SELECT t.no,t.invoice_no,t.invoice_date,t.invoice_total,t.confirmed_at,
    (SELECT COUNT(*) FROM inward_items i WHERE i.txn_no=t.no) AS items FROM inward_txns t ORDER BY t.confirmed_at DESC LIMIT 200`).all();
  return new Response(JSON.stringify(r.results), { headers: { "Content-Type": "application/json" } });
}
