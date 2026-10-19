CREATE TABLE IF NOT EXISTS stock(
  part TEXT PRIMARY KEY, description TEXT, hsn TEXT, unit TEXT, rate REAL,
  qty REAL NOT NULL DEFAULT 0, updated_at TEXT);
CREATE TABLE IF NOT EXISTS inward_txns(
  no TEXT PRIMARY KEY, invoice_no TEXT, invoice_date TEXT, invoice_total REAL,
  user TEXT, confirmed_at TEXT, extracted_json TEXT);
CREATE TABLE IF NOT EXISTS inward_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT, txn_no TEXT NOT NULL, sno INTEGER,
  part TEXT, description TEXT, hsn TEXT, qty REAL, unit TEXT, rate REAL, amount REAL);
CREATE TABLE IF NOT EXISTS invoice_images(txn_no TEXT PRIMARY KEY, data TEXT);