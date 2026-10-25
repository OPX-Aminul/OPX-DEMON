(() => {
  'use strict';

  let token = sessionStorage.getItem('opx_admin_token') || '';
  let lastAdminProducts = [];

  const $ = (s, r = document) => r.querySelector(s);
  const $all = (s, r = document) => Array.from(r.querySelectorAll(s));

  function api(path, opts = {}) {
    opts.headers = Object.assign({}, opts.headers);
    if (token) opts.headers['x-admin-token'] = token;
    if (opts.body && typeof opts.body !== 'string') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    return fetch(path, opts).then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Request failed');
      return data;
    });
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtCents(v) { return (v / 100).toLocaleString('en-US', { style: 'currency', currency: 'BDT' }); }
  function badge(st) { return `<span class="badge ${esc(st)}">${esc(st)}</span>`; }

  function show(sel) {
    $all('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === sel));
    ['orders', 'payments', 'products'].forEach(t => { $('#tab-' + t).style.display = t === sel ? '' : 'none'; });
  }

  // ---------- login ----------
  async function login() {
    const pass = $('#loginPass').value;
    if (!pass) return;
    try {
      const data = await api('/api/admin/login', { method: 'POST', body: { password: pass } });
      token = data.token;
      sessionStorage.setItem('opx_admin_token', token);
      enter();
    } catch (e) {
      alert(e.message);
    }
  }

  function enter() {
    $('#loginScreen').style.display = 'none';
    $('#dashScreen').style.display = '';
    loadOrders();
    loadPayments();
    loadAdminProducts();
  }

  // ---------- orders ----------
  async function loadOrders() {
    const status = $('#orderFilter').value;
    try {
      const data = await api('/api/admin/orders' + (status ? '?status=' + encodeURIComponent(status) : ''));
      renderOrders(data);
    } catch (e) {
      $('#ordersList').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
  }

  function renderOrders(orders) {
    const wrap = $('#ordersList');
    if (!orders.length) { wrap.innerHTML = '<div class="empty">No orders.</div>'; return; }
    wrap.innerHTML = orders.map(o => {
      const items = (o.items || []).map(i => `
        <div class="order-item"><span>${esc(i.name)} × ${i.quantity}</span><span>${fmtCents((i.unit_price_cents || 0) * (i.quantity || 1))}</span></div>`).join('');
      const pay = o.payment_method === 'cod' ? 'Cash on delivery' : (o.payment_method === 'bkash' ? 'bKash' : 'Nagad');
      return `
        <div class="order-row" data-id="${o.id}">
          <div class="order-top">
            <div>
              <div class="order-no">${esc(o.order_number)}</div>
              <div class="order-cust">${esc(o.customer_name)} • ${esc(o.phone)}${o.email ? ' • ' + esc(o.email) : ''}</div>
              <div class="order-cust">${esc(o.address)}${o.city ? ', ' + esc(o.city) : ''}</div>
              <div class="order-cust">Payment: ${esc(pay)} • ${badge(o.status)}</div>
              ${o.admin_note ? `<div class="order-cust" style="color:var(--accent)">Note: ${esc(o.admin_note)}</div>` : ''}
            </div>
            <div style="text-align:right;font-weight:800">${fmtCents(o.total_cents)}<div class="order-cust">${esc(new Date(o.created_at).toLocaleString())}</div></div>
          </div>
          <div class="order-items">${items}</div>
          ${(o.notes ? `<div class="order-cust">Cust. notes: ${esc(o.notes)}</div>` : '')}
          <div class="order-actions">
            ${o.status !== 'confirmed' ? `<button class="btn btn-success btn-sm" data-act="confirmed">Confirm</button>` : ''}
            ${o.status !== 'completed' ? `<button class="btn btn-sm" data-act="completed">Mark complete</button>` : ''}
            ${o.status !== 'cancelled' ? `<button class="btn btn-danger btn-sm" data-act="cancelled">Cancel</button>` : ''}
            <input placeholder="Admin note" style="flex:1;min-width:140px;background:var(--bg);border:1px solid var(--line);color:var(--text);padding:8px 12px;border-radius:8px" data-note>
          </div>
        </div>`;
    }).join('');

    $all('[data-act]', wrap).forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.closest('.order-row').dataset.id;
        const note = b.closest('.order-row').querySelector('[data-note]').value.trim();
        try {
          await api('/api/admin/orders/' + id, { method: 'PATCH', body: { status: b.dataset.act, admin_note: note || undefined } });
          loadOrders();
        } catch (e) { alert(e.message); }
      });
    });
  }

  // ---------- payments ----------
  async function loadPayments() {
    try {
      const data = await api('/api/admin/settings');
      const p = (data.payments || {});
      $('#setBkash').value = p.bkash || '';
      $('#setNagad').value = p.nagad || '';
      $('#setInstructions').value = p.instructions || '';
      const s = data.shop || {};
      if (s.shipping_fee_cents) $('#setShip') && ($('#setShip').value = s.shipping_fee_cents);
    } catch (e) { alert(e.message); }
  }

  // ---------- products ----------
  async function loadAdminProducts() {
    try {
      const data = await api('/api/admin/products');
      lastAdminProducts = data;
      $('#productsList').innerHTML = data.map(p => `
        <div class="order-row" data-id="${p.id}">
          <div class="order-top">
            <div>
              <div style="font-weight:700">${esc(p.name)}</div>
              <div class="order-cust">${esc(p.slug)} • ${fmtCents(p.price_cents)} • ${badge(p.active ? 'active' : 'inactive')}</div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-ghost btn-sm" data-toggle="${p.id}">${p.active ? 'Deactivate' : 'Activate'}</button>
              <button class="btn btn-danger btn-sm" data-del="${p.id}">Delete</button>
            </div>
          </div>
        </div>`).join('');
      $all('[data-toggle]').forEach(b => b.addEventListener('click', () => toggleProduct(b.dataset.toggle)));
      $all('[data-del]').forEach(b => b.addEventListener('click', () => delProduct(b.dataset.del)));
    } catch (e) { $('#productsList').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  async function toggleProduct(id) {
    const p = lastAdminProducts.find(x => x.id === id);
    if (!p) return;
    try {
      await api('/api/admin/products/' + id, { method: 'PATCH', body: { active: !p.active } });
      loadAdminProducts();
    } catch (e) { alert(e.message); }
  }

  async function delProduct(id) {
    if (!confirm('Delete this product?')) return;
    try { await api('/api/admin/products/' + id, { method: 'DELETE' }); loadAdminProducts(); }
    catch (e) { alert(e.message); }
  }

  // ---------- wire events ----------
  function init() {
    $('#loginBtn').addEventListener('click', login);
    $('#loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

    $('#logoutBtn').addEventListener('click', () => {
      token = ''; sessionStorage.removeItem('opx_admin_token');
      $('#dashScreen').style.display = 'none';
      $('#loginScreen').style.display = '';
    });

    $all('.admin-tab').forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
    $('#orderFilter').addEventListener('change', loadOrders);
    $('#refreshOrders').addEventListener('click', loadOrders);

    $('#savePayments').addEventListener('click', async () => {
      try {
        await api('/api/admin/settings/payments', {
          method: 'PUT',
          body: { value: { bkash: $('#setBkash').value.trim(), nagad: $('#setNagad').value.trim(), instructions: $('#setInstructions').value.trim() } },
        });
        alert('Payment settings saved');
      } catch (e) { alert(e.message); }
    });

    $('#addProduct').addEventListener('click', async () => {
      const body = {
        name: $('#npName').value.trim(),
        slug: $('#npSlug').value.trim(),
        price_cents: Number($('#npPrice').value) || 0,
        compare_at_price_cents: Number($('#npCmp').value) || null,
        image_url: $('#npImg').value.trim() || null,
        category: $('#npCat').value.trim() || null,
        description: $('#npDesc').value.trim(),
        active: true,
      };
      if (!body.name || !body.slug) { alert('Name and slug required'); return; }
      try { await api('/api/admin/products', { method: 'POST', body }); loadAdminProducts(); }
      catch (e) { alert(e.message); }
    });

    if (token) enter();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
