import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { initDb, isMock, listActiveProducts, getPayments, getShopSettings, createOrder, listOrders, updateOrder, getAdminSettings, putSetting, listAdminProducts, addProduct, patchProduct, deleteProduct } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PUB_DIR = PUBLIC_DIR;

const dbMode = initDb();
console.log(`[db] backend mode: ${dbMode.mode === 'mock' ? 'MOCK (in-memory) — set SUPABASE_URL/SUPABASE_SERVICE_KEY to go live' : 'Supabase'}`);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUB_DIR));

// ---------------- Public API ----------------

app.get('/api/products', async (_req, res) => {
  try { res.json(await listActiveProducts()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/settings/shop', async (_req, res) => {
  try { res.json(await getShopSettings()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/payments', async (_req, res) => {
  try { res.json(await getPayments()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { customer_name, phone, email, address, city, notes, items, total_cents, payment_method } = req.body || {};
    if (!customer_name || !phone || !address || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    if (!['bkash', 'nagad', 'cod'].includes(payment_method)) {
      return res.status(400).json({ error: 'Invalid payment method.' });
    }
    const order = await createOrder({
      customer_name, phone, email, address, city, notes,
      items, total_cents, payment_method, status: 'pending',
    });
    let payment = null;
    if (payment_method !== 'cod') payment = await getPayments();
    res.status(201).json({ order, payment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------- Admin auth ----------------
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const TOKEN_TTL_MS = 12 * 3600 * 1000;

function makeToken() {
  const exp = Date.now() + TOKEN_TTL_MS;
  const sig = crypto.createHmac('sha256', ADMIN_PASSWORD).update(String(exp)).digest('hex');
  return `${exp}.${sig}`;
}
function verifyToken(token) {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  if (Date.now() > Number(exp)) return false;
  const expect = crypto.createHmac('sha256', ADMIN_PASSWORD).update(exp).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect));
}
function requireAdmin(req, res, next) {
  if (!verifyToken(req.headers['x-admin-token'])) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'Admin password not configured on server.' });
  if (typeof password === 'string' && password === ADMIN_PASSWORD) {
    return res.json({ token: makeToken() });
  }
  res.status(401).json({ error: 'Wrong password.' });
});

// ---------------- Admin API ----------------
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try { res.json(await listOrders(req.query.status)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  try {
    const { status, admin_note } = req.body || {};
    const patch = {};
    if (status && ['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) patch.status = status;
    if (typeof admin_note === 'string') patch.admin_note = admin_note;
    res.json(await updateOrder(req.params.id, patch));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/settings', requireAdmin, async (_req, res) => {
  try { res.json(await getAdminSettings()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/settings/:key', requireAdmin, async (req, res) => {
  try {
    const value = req.body?.value;
    if (value === undefined) return res.status(400).json({ error: 'value required' });
    res.json(await putSetting(req.params.key, value));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/products', requireAdmin, async (_req, res) => {
  try { res.json(await listAdminProducts()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  try { res.status(201).json(await addProduct(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try { res.json(await patchProduct(req.params.id, req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try { await deleteProduct(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`OPX-DEMON server listening on http://localhost:${PORT}${isMock() ? ' (mock mode)' : ''}`);
});
