const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
export async function onRequestPost({ request, env }) {
  if (!env.DB) return J({ error: "D1 database (binding DB) not connected" }, 500);
  const b = await request.json();
  const items = (b.items || []).filter(i => i.part && i.qty > 0);
  if (!items.length) return J({ error: "No valid items" }, 400);
  const year = new Date().getFullYear();
  const c = await env.DB.prepare("SELECT COUNT(*) c FROM inward_txns WHERE no LIKE ?").bind(`INW-${year}-%`).first();
  const no = `INW-${year}-${String((c?.c || 0) + 1).padStart(4, "0")}`;
  const now = new Date().toISOString();
  const st = [env.DB.prepare("INSERT INTO inward_txns(no,invoice_no,invoice_date,invoice_total,user,confirmed_at,extracted_json) VALUES(?,?,?,?,?,?,?)")
    .bind(no, b.invoiceNo || "", b.invoiceDate || "", Number(b.invoiceTotal) || null, b.user || "", now, JSON.stringify(b.extracted || []))];
  if (b.image) st.push(env.DB.prepare("INSERT INTO invoice_images(txn_no,data) VALUES(?,?)").bind(no, b.image));
  items.forEach((i, n) => {
    st.push(env.DB.prepare("INSERT INTO inward_items(txn_no,sno,part,description,hsn,qty,unit,rate,amount) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(no, n + 1, i.part, i.desc || '', i.hsn || '', i.qty, i.unit || 'Pcs', Number(i.rate) || 0, Number(i.qty) * (Number(i.rate) || 0)));
    st.push(env.DB.prepare(`INSERT INTO stock(part,description,hsn,unit,rate,qty,updated_at) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(part) DO UPDATE SET qty=qty+excluded.qty, description=excluded.description, hsn=excluded.hsn,
      unit=excluded.unit, rate=excluded.rate, updated_at=excluded.updated_at`)
      .bind(i.part, i.desc || '', i.hsn || '', i.unit || 'Pcs', Number(i.rate) || 0, i.qty, now));
  });
  try { await env.DB.batch(st); } catch (e) { return J({ error: "Save failed: " + e.message }, 500); }
  return J({ no, items });
}