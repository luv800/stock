const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const str = v => String(v ?? "").trim();

export async function onRequestPost({ request, env }) {
  if (!env.DB) return J({ error: "D1 database (binding DB) not connected" }, 500);
  let b;
  try { b = await request.json(); } catch { return J({ error: "Invalid request body" }, 400); }

  const items = (Array.isArray(b.items) ? b.items : [])
    .map(i => ({
      part: str(i.part),
      desc: str(i.desc),
      hsn: str(i.hsn),
      qty: Number(i.qty) || 0,
      unit: str(i.unit) || "Pcs",
      rate: Number(i.rate) || 0,
      rack: str(i.rack)
    }))
    .filter(i => i.part && i.qty > 0);
  if (!items.length) return J({ error: "No valid items (each item needs a part number and quantity above 0)" }, 400);

  const prefix = `INW-${new Date().getFullYear()}-`;
  const now = new Date().toISOString();

  try {
    // Single atomic statement so two saves at the same moment can never get the same number.
    // First use of a year seeds the counter from any existing INW numbers.
    const seq = await env.DB.prepare(`INSERT INTO counters(name,val) VALUES(?1,
        (SELECT COALESCE(MAX(CAST(substr(no, ?2) AS INTEGER)), 0) + 1 FROM inward_txns WHERE no LIKE ?3))
      ON CONFLICT(name) DO UPDATE SET val = val + 1 RETURNING val`)
      .bind(prefix, prefix.length + 1, prefix + "%").first("val");
    const no = prefix + String(seq).padStart(4, "0");

    const st = [env.DB.prepare("INSERT INTO inward_txns(no,invoice_no,invoice_date,invoice_total,user,confirmed_at,extracted_json) VALUES(?,?,?,?,?,?,?)")
      .bind(no, str(b.invoiceNo), str(b.invoiceDate), Number(b.invoiceTotal) || null, str(b.user), now, JSON.stringify(b.extracted || []))];
    if (b.image) st.push(env.DB.prepare("INSERT INTO invoice_images(txn_no,data) VALUES(?,?)").bind(no, b.image));

    items.forEach((i, n) => {
      st.push(env.DB.prepare("INSERT INTO inward_items(txn_no,sno,part,description,hsn,qty,unit,rate,amount,rack) VALUES(?,?,?,?,?,?,?,?,?,?)")
        .bind(no, n + 1, i.part, i.desc, i.hsn, i.qty, i.unit, i.rate, i.qty * i.rate, i.rack));
      // Blank values from a new entry never wipe existing details (rack, HSN, description, rate).
      st.push(env.DB.prepare(`INSERT INTO stock(part,description,hsn,unit,rate,rack,qty,updated_at) VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(part) DO UPDATE SET
          qty = stock.qty + excluded.qty,
          description = COALESCE(NULLIF(excluded.description, ''), stock.description),
          hsn = COALESCE(NULLIF(excluded.hsn, ''), stock.hsn),
          unit = excluded.unit,
          rate = CASE WHEN excluded.rate > 0 THEN excluded.rate ELSE stock.rate END,
          rack = COALESCE(NULLIF(excluded.rack, ''), stock.rack),
          updated_at = excluded.updated_at`)
        .bind(i.part, i.desc, i.hsn, i.unit, i.rate, i.rack, i.qty, now));
    });

    await env.DB.batch(st);
    return J({ no, items });
  } catch (e) {
    return J({ error: "Save failed: " + e.message }, 500);
  }
}
