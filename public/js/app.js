(() => {
  'use strict';

  const CART_KEY = 'opx_cart';
  let products = [];
  let cart = loadCart();
  let shopSettings = { currency: 'BDT', shipping_fee_cents: 10000 };

  // ---------- helpers ----------
  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }
  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCartUI();
  }
  function fmtCents(v) {
    return (v / 100).toLocaleString('en-US', { style: 'currency', currency: 'BDT' });
  }
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2600);
  }
  function $(s, r = document) { return r.querySelector(s); }
  function $all(s, r = document) { return Array.from(r.querySelectorAll(s)); }

  // ---------- fetch products ----------
  async function loadProducts() {
    try {
      const r = await fetch('/api/products');
      if (!r.ok) throw new Error('API error');
      const data = await r.json();
      if (Array.isArray(data) && data.length) {
        products = data;
        renderProducts();
      }
    } catch (e) {
      console.warn('products fetch failed', e);
      $('#productsGrid').innerHTML = '<div class="product-card"><div class="product-body" style="text-align:center;color:var(--muted)">Could not load products. Make sure the backend is configured.</div></div>';
    }
  }

  async function loadShopSettings() {
    try {
      const r = await fetch('/api/settings/shop');
      if (r.ok) shopSettings = await r.json();
    } catch (_) {}
  }

  const IMG = {
    'opx-demon': '/img/product-demon.png',
    'wifi-devboard': '/img/product-devboard.png',
    'video-game-module': '/img/product-game-module.png',
    'silicone-case': '/img/product-silicone-case.png',
    'screen-protector': '/img/product-screen-protector.png',
    'microsd-card': '/img/product-microsd.png',
  };

  // ---------- render products ----------
  function renderProducts() {
    const grid = $('#productsGrid');
    if (!products.length) return;
    grid.innerHTML = products.map(p => {
      const img = p.image_url || IMG[p.slug] || '/img/product-demon.png';
      const cmp = p.compare_at_price_cents ? `<span class="cmp">${fmtCents(p.compare_at_price_cents)}</span>` : '';
      return `
        <div class="product-card" data-slug="${p.slug}">
          <div class="product-media"><img src="${img}" alt="${esc(p.name)}"></div>
          <div class="product-body">
            <span class="product-cat">${esc(p.category || '')}</span>
            <h3 class="product-name">${esc(p.name)}</h3>
            <p class="product-desc">${esc(p.description || '')}</p>
            <div class="product-price">${fmtCents(p.price_cents)}${cmp}</div>
            <div class="product-actions">
              <button class="btn add-btn" data-add="${p.slug}">Add to cart</button>
            </div>
          </div>
        </div>`;
    }).join('');

    $all('[data-add]').forEach(b => {
      b.addEventListener('click', () => {
        const p = products.find(x => x.slug === b.dataset.add);
        if (p) addToCart(p);
      });
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- cart ----------
  function addToCart(p) {
    const ex = cart.find(i => i.slug === p.slug);
    if (ex) ex.qty += 1;
    else cart.push({ slug: p.slug, name: p.name, price_cents: p.price_cents, qty: 1 });
    saveCart();
    openDrawer();
    toast(`Added ${p.name} to cart`);
  }

  function cartTotalCents() {
    return cart.reduce((s, i) => s + i.price_cents * i.qty, 0);
  }

  function renderCartUI() {
    const count = cart.reduce((s, i) => s + i.qty, 0);
    const cc = $('#cartCount');
    cc.textContent = count;
    cc.classList.toggle('show', count > 0);

    const wrap = $('#drawerItems');
    if (!cart.length) {
      wrap.innerHTML = '<div class="empty-cart">Your cart is empty.</div>';
      $('#drawerTotal').textContent = '0';
      return;
    }
    wrap.innerHTML = cart.map(i => {
      const img = IMG[i.slug] || '/img/product-demon.png';
      return `
        <div class="cart-item" data-slug="${i.slug}">
          <img src="${img}" alt="${esc(i.name)}">
          <div class="ci-info">
            <div class="ci-name">${esc(i.name)}</div>
            <div class="ci-price">${fmtCents(i.price_cents)} each</div>
            <div class="ci-qty">
              <button data-qty="-1">−</button>
              <span>${i.qty}</span>
              <button data-qty="1">+</button>
            </div>
          </div>
          <button class="ci-remove" data-remove="1">Remove</button>
        </div>`;
    }).join('');

    $('#drawerTotal').textContent = fmtCents(cartTotalCents());

    $all('.cart-item', wrap).forEach(item => {
      const slug = item.dataset.slug;
      $all('[data-qty]', item).forEach(b => {
        b.addEventListener('click', () => {
          const it = cart.find(i => i.slug === slug);
          if (!it) return;
          it.qty += Number(b.dataset.qty);
          if (it.qty <= 0) cart = cart.filter(i => i.slug !== slug);
          saveCart();
        });
      });
      const rm = $('[data-remove]', item);
      if (rm) rm.addEventListener('click', () => {
        cart = cart.filter(i => i.slug !== slug);
        saveCart();
      });
    });
  }

  // ---------- drawer ----------
  function openDrawer() { $('#cartDrawer').classList.add('open'); $('#drawerBackdrop').classList.add('open'); }
  function closeDrawer() { $('#cartDrawer').classList.remove('open'); $('#drawerBackdrop').classList.remove('open'); }

  // ---------- checkout modal ----------
  function openModal(html) { $('#modalBody').innerHTML = html; $('#modalBackdrop').classList.add('open'); }
  function closeModal() { $('#modalBackdrop').classList.remove('open'); }

  function showCheckout() {
    if (!cart.length) { toast('Cart is empty'); return; }
    const total = cartTotalCents();
    const ship = shopSettings.shipping_fee_cents || 0;
    const grand = total + ship;
    openModal(`
      <h2>Checkout</h2>
      <p class="modal-sub">Your total is <strong>${fmtCents(grand)}</strong> (incl. shipping ${fmtCents(ship)}).</p>
      <div class="pay-methods" id="payMethods">
        <div class="pay-method" data-pay="bkash">bKash<small>Send Money</small></div>
        <div class="pay-method" data-pay="nagad">Nagad<small>Send Money</small></div>
        <div class="pay-method" data-pay="cod">Cash on Delivery<small>Pay on arrival</small></div>
      </div>
      <div id="payInfo"></div>
      <div class="form-group"><label>Full name</label><input id="fName" placeholder="Your name"></div>
      <div class="form-row">
        <div class="form-group"><label>Phone</label><input id="fPhone" placeholder="01XXXXXXXXX"></div>
        <div class="form-group"><label>City</label><input id="fCity" placeholder="City"></div>
      </div>
      <div class="form-group"><label>Address</label><input id="fAddress" placeholder="Street, area"></div>
      <div class="form-group"><label>Email (optional)</label><input id="fEmail" type="email" placeholder="you@example.com"></div>
      <div class="form-group"><label>Notes (optional)</label><textarea id="fNotes" rows="2"></textarea></div>
      <button class="btn btn-block" id="placeOrder">Place order</button>
    `);

    let pay = 'bkash';

    $all('[data-pay]').forEach(el => {
      el.addEventListener('click', async () => {
        $all('[data-pay]').forEach(x => x.classList.remove('sel'));
        el.classList.add('sel');
        pay = el.dataset.pay;
        if (pay !== 'cod') {
          try {
            const r = await fetch('/api/payments');
            const data = await r.json();
            const num = pay === 'bkash' ? data.bkash : data.nagad;
            $('#payInfo').innerHTML = `
              <div class="pay-instructions">
                <div>Send the amount to this number, then place your order:</div>
                <div class="pay-number">${esc(num || 'Not set yet')}</div>
              </div>`;
          } catch (_) {}
        } else {
          $('#payInfo').innerHTML = '<div class="pay-instructions">You will pay when you receive your order.</div>';
        }
      });
    });
    $('[data-pay="bkash"]').click();

    $('#placeOrder').addEventListener('click', async () => {
      const name = $('#fName').value.trim();
      const phone = $('#fPhone').value.trim();
      const address = $('#fAddress').value.trim();
      const city = $('#fCity').value.trim();
      if (!name || !phone || !address) { toast('Please fill name, phone and address'); return; }
      const btn = $('#placeOrder');
      btn.disabled = true; btn.textContent = 'Placing order…';
      const items = cart.map(i => ({ slug: i.slug, name: i.name, unit_price_cents: i.price_cents, quantity: i.qty }));
      try {
        const r = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: name, phone, address, city,
            email: $('#fEmail').value.trim() || null,
            notes: $('#fNotes').value.trim() || null,
            items,
            total_cents: grand,
            payment_method: pay,
          }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed');
        cart = []; saveCart();
        showSuccess(data, pay);
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Place order';
        toast('Error: ' + e.message);
      }
    });
  }

  function showSuccess(data, pay) {
    const order = data.order;
    let payBlock = '';
    if (pay !== 'cod' && data.payment) {
      const num = pay === 'bkash' ? data.payment.bkash : data.payment.nagad;
      payBlock = `
        <div class="pay-instructions">
          <div>Please pay ${fmtCents(order.total_cents)} to:</div>
          <div class="pay-number">${esc(num || 'Not set yet')}</div>
          <div style="margin-top:8px;font-size:12px">We will confirm your order after payment is verified.</div>
        </div>`;
    }
    openModal(`
      <div class="order-success">
        <div class="big">✓</div>
        <h2>Order placed!</h2>
        <p>Your order number is <span class="order-no">${esc(order.order_number)}</span></p>
        ${payBlock}
        <div class="steps">
          <div class="step done">1. Placed</div>
          <div class="step">2. Payment</div>
          <div class="step">3. Confirmed</div>
        </div>
        <button class="btn btn-block" style="margin-top:20px" onclick="location.reload()">Continue shopping</button>
      </div>`);
  }

  // ---------- init ----------
  function init() {
    loadShopSettings();
    loadProducts();
    renderCartUI();
    $('#year').textContent = new Date().getFullYear();
    $('#heroBg').style.backgroundImage = "url('/img/hero-wide.png')";

    $('#cartBtn').addEventListener('click', openDrawer);
    $('#closeCart').addEventListener('click', closeDrawer);
    $('#drawerBackdrop').addEventListener('click', closeDrawer);
    $('#checkoutBtn').addEventListener('click', () => { closeDrawer(); showCheckout(); });
    $('#modalBackdrop').addEventListener('click', e => { if (e.target.id === 'modalBackdrop') closeModal(); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
