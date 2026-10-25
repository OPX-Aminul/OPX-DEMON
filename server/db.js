// Data layer: uses Supabase when credentials are configured, otherwise falls back
// to in-memory mock data so the app is fully previewable before real credentials
// are supplied. Set SUPABASE_URL + SUPABASE_SERVICE_KEY to switch to Supabase.

import { createClient } from '@supabase/supabase-js';

const mockProducts = [
  { id: 'p1', slug: 'opx-demon', name: 'OPX-DEMON', description: 'The main device of the OPX-DEMON ecosystem.', price_cents: 16900, compare_at_price_cents: null, image_url: null, category: 'device', featured: true, in_stock: true, active: true, sort_order: 1 },
  { id: 'p2', slug: 'wifi-devboard', name: 'WiFi Devboard', description: 'WiFi/Bluetooth development board companion.', price_cents: 3500, compare_at_price_cents: null, image_url: null, category: 'accessory', featured: false, in_stock: true, active: true, sort_order: 2 },
  { id: 'p3', slug: 'video-game-module', name: 'Video Game Module', description: 'A module for retro gaming and custom demos.', price_cents: 4900, compare_at_price_cents: null, image_url: null, category: 'module', featured: false, in_stock: true, active: true, sort_order: 3 },
  { id: 'p4', slug: 'silicone-case', name: 'Silicone Case', description: 'Protective silicone case.', price_cents: 1500, compare_at_price_cents: null, image_url: null, category: 'accessory', featured: false, in_stock: true, active: true, sort_order: 4 },
  { id: 'p5', slug: 'screen-protector', name: 'Screen Protectors', description: 'Tempered screen protector set.', price_cents: 1000, compare_at_price_cents: null, image_url: null, category: 'accessory', featured: false, in_stock: true, active: true, sort_order: 5 },
  { id: 'p6', slug: 'microsd-card', name: 'microSD Card', description: 'Class 10 microSD card for storage. 32GB.', price_cents: 800, compare_at_price_cents: null, image_url: null, category: 'accessory', featured: false, in_stock: true, active: true, sort_order: 6 },
];

const mockSettings = {
  shop: { name: 'OPX-DEMON', currency: 'BDT', shipping_fee_cents: 10000 },
  payments: { bkash: '01700-000000', nagad: '01700-000000', instructions: 'Send the amount to the number above, then place your order. We will confirm after payment.' },
};

const mockOrders = [];
let mockOrderSeq = 1000;

let useMock = false;
let sb = null;

export function initDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key && !url.includes('placeholder') && key !== 'placeholder') {
    try {
      sb = createClient(url, key);
      useMock = false;
      return { mode: 'supabase' };
    } catch {
      useMock = true;
      return { mode: 'mock' };
    }
  }
  useMock = true;
  return { mode: 'mock' };
}

export function isMock() { return useMock; }

export async function listActiveProducts() {
  if (!useMock) {
    const { data, error } = await sb.from('products').select('id, slug, name, description, price_cents, compare_at_price_cents, image_url, category, featured, in_stock').eq('active', true).order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  }
  return mockProducts.filter(p => p.active);
}

export async function getPayments() {
  if (!useMock) {
    const { data, error } = await sb.from('settings').select('value').eq('key', 'payments').single();
    if (error && error.code !== 'PGRST116') throw error;
    return data?.value ?? {};
  }
  return mockSettings.payments;
}

export async function getShopSettings() {
  if (!useMock) {
    const { data, error } = await sb.from('settings').select('value').eq('key', 'shop').single();
    if (error && error.code !== 'PGRST116') throw error;
    return data?.value ?? {};
  }
  return mockSettings.shop;
}

export async function createOrder(order) {
  if (!useMock) {
    const { data, error } = await sb.from('orders').insert(order).select().single();
    if (error) throw error;
    return data;
  }
  mockOrderSeq += 1;
  const created = Object.assign({}, order, {
    id: 'o' + mockOrderSeq,
    order_number: 'OPXD-' + String(mockOrderSeq).padStart(5, '0'),
    status: 'pending',
    admin_note: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  mockOrders.unshift(created);
  return created;
}

export async function listOrders(status) {
  if (!useMock) {
    let q = sb.from('orders').select('*').order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }
  let out = [...mockOrders];
  if (status) out = out.filter(o => o.status === status);
  return out;
}

export async function updateOrder(id, patch) {
  if (!useMock) {
    const { data, error } = await sb.from('orders').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
  const o = mockOrders.find(x => x.id === id);
  if (!o) throw new Error('Order not found');
  Object.assign(o, patch, { updated_at: new Date().toISOString() });
  return o;
}

export async function getAdminSettings() {
  if (!useMock) {
    const { data, error } = await sb.from('settings').select('key, value').in('key', ['payments', 'shop']);
    if (error) throw error;
    const out = {};
    for (const row of data || []) out[row.key] = row.value;
    return out;
  }
  return { payments: mockSettings.payments, shop: mockSettings.shop };
}

export async function putSetting(key, value) {
  if (!useMock) {
    const { data, error } = await sb.from('settings').upsert({ key, value }, { onConflict: 'key' }).select().single();
    if (error) throw error;
    return data;
  }
  mockSettings[key] = value;
  return { key, value };
}

export async function listAdminProducts() {
  if (!useMock) {
    const { data, error } = await sb.from('products').select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  }
  return mockProducts;
}

export async function addProduct(p) {
  if (!useMock) {
    const { data, error } = await sb.from('products').insert(p).select().single();
    if (error) throw error;
    return data;
  }
  const created = Object.assign({}, p, { id: 'p' + Date.now(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  mockProducts.push(created);
  return created;
}

export async function patchProduct(id, patch) {
  if (!useMock) {
    const { data, error } = await sb.from('products').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
  const p = mockProducts.find(x => x.id === id);
  if (!p) throw new Error('Product not found');
  Object.assign(p, patch, { updated_at: new Date().toISOString() });
  return p;
}

export async function deleteProduct(id) {
  if (!useMock) {
    const { error } = await sb.from('products').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const i = mockProducts.findIndex(x => x.id === id);
  if (i >= 0) mockProducts.splice(i, 1);
}
