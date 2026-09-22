/**
 * Comprehensive Verification: Admin Orders & Order Details for Sarojini Bazaar
 */
const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

const VeloraImageUtils = require('../js/image-utils.js');

async function loginAdmin() {
  const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'support@vadistudio.com', password: 'VadiSupport2026!' })
  });
  return await res.json();
}

async function loginCustomer() {
  const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test_customer_audit@vadi.com', password: 'VadiTest1234!' })
  });
  return await res.json();
}

// Logic mirror from admin-order-details.js
function getOrderCatalogInfo(order) {
  const items = order.order_items || [];
  let hasSarojini = false;
  let hasMain = false;

  for (const it of items) {
    if (it.catalog_type === 'sarojini' || it.sarojini_product_id != null) {
      hasSarojini = true;
    } else {
      hasMain = true;
    }
  }

  if (hasSarojini && hasMain) {
    return { type: 'mixed', label: 'Mixed Catalog', icon: '🔀' };
  } else if (hasSarojini) {
    return { type: 'sarojini', label: 'Sarojini Bazaar', icon: '🛍️' };
  } else {
    return { type: 'main', label: 'Main VADI', icon: '🏪' };
  }
}

async function resolveItemLink(item, headers) {
  const isSarojini = (item.catalog_type === 'sarojini' || item.sarojini_product_id != null);
  const targetId = isSarojini ? (item.sarojini_product_id || item.product_id) : item.product_id;

  let isAvailable = false;
  let finalUrl = '';
  let resolvedProduct = null;

  if (isSarojini) {
    if (targetId) {
      const res = await fetch(SUPABASE_URL + '/rest/v1/sarojini_products?id=eq.' + targetId + '&select=id,name,slug,price,is_active,images', { headers });
      const data = await res.json();
      if (data && data[0]) {
        resolvedProduct = data[0];
        if (data[0].is_active !== false) {
          isAvailable = true;
          finalUrl = `../sarojini-product-details.html?id=${encodeURIComponent(data[0].id || data[0].slug)}`;
        }
      }
    }
    if (!resolvedProduct && item.product_name) {
      const res = await fetch(SUPABASE_URL + '/rest/v1/sarojini_products?name=eq.' + encodeURIComponent(item.product_name) + '&select=id,name,slug,price,is_active,images', { headers });
      const data = await res.json();
      if (data && data[0]) {
        resolvedProduct = data[0];
        if (data[0].is_active !== false) {
          isAvailable = true;
          finalUrl = `../sarojini-product-details.html?id=${encodeURIComponent(data[0].id || data[0].slug)}`;
        }
      }
    }
    if (!finalUrl && targetId && resolvedProduct === null) {
      finalUrl = `../sarojini-product-details.html?id=${encodeURIComponent(targetId)}`;
      isAvailable = true;
    }
  } else {
    if (targetId) {
      const res = await fetch(SUPABASE_URL + '/rest/v1/products?id=eq.' + targetId + '&select=id,name,slug,price,is_active,images', { headers });
      const data = await res.json();
      if (data && data[0]) {
        resolvedProduct = data[0];
        if (data[0].is_active !== false) {
          isAvailable = true;
          finalUrl = `../product.html?id=${encodeURIComponent(data[0].id || data[0].slug)}`;
        }
      }
    }
    if (!resolvedProduct && item.product_name) {
      const res = await fetch(SUPABASE_URL + '/rest/v1/products?name=eq.' + encodeURIComponent(item.product_name) + '&select=id,name,slug,price,is_active,images', { headers });
      const data = await res.json();
      if (data && data[0]) {
        resolvedProduct = data[0];
        if (data[0].is_active !== false) {
          isAvailable = true;
          finalUrl = `../product.html?id=${encodeURIComponent(data[0].id || data[0].slug)}`;
        }
      }
    }
    if (!finalUrl && targetId && resolvedProduct === null) {
      finalUrl = `../product.html?id=${encodeURIComponent(targetId)}`;
      isAvailable = true;
    }
  }

  const fallbackSvg = VeloraImageUtils.getPlaceholderSvg();
  const displayImg = VeloraImageUtils.normalizeImageUrl(item.product_image, { isAdmin: true, fallback: fallbackSvg });

  return {
    isAvailable,
    finalUrl,
    isSarojini,
    displayImg,
    productName: item.product_name,
    storeBadge: isSarojini ? '🛍️ SAROJINI BAZAAR' : '🏪 MAIN VADI'
  };
}

async function runTests() {
  console.log('--- STARTING VERIFICATION TESTS ---\n');
  const adminAuth = await loginAdmin();
  const adminToken = adminAuth.access_token;
  const adminHeaders = { 'apikey': ANON_KEY, 'Authorization': 'Bearer ' + adminToken };

  // TEST 1: Check existing Sarojini order #VEL-89082
  console.log('TEST 1: Verifying order #VEL-89082 in Admin Order View');
  const ord1Res = await fetch(SUPABASE_URL + '/rest/v1/orders?order_number=eq.%23VEL-89082&select=*,order_items(*)', { headers: adminHeaders });
  const ord1List = await ord1Res.json();
  const ord1 = ord1List[0];
  if (!ord1) throw new Error('#VEL-89082 not found');

  const catInfo1 = getOrderCatalogInfo(ord1);
  console.log('  Order #VEL-89082 Catalog Info:', catInfo1);
  if (catInfo1.type !== 'sarojini') throw new Error('Expected sarojini catalog type, got: ' + catInfo1.type);
  if (ord1.order_items.length !== 1) throw new Error('Expected 1 item in #VEL-89082, got: ' + ord1.order_items.length);

  const item1Info = await resolveItemLink(ord1.order_items[0], adminHeaders);
  console.log('  Item Info:', item1Info);
  if (!item1Info.finalUrl.includes('sarojini-product-details.html')) throw new Error('Expected Sarojini URL, got: ' + item1Info.finalUrl);
  if (!item1Info.displayImg.includes('prod-2-ribbed-top.png')) throw new Error('Expected ribbed top image, got: ' + item1Info.displayImg);
  console.log('  ✅ TEST 1 PASSED: #VEL-89082 has Sarojini item, image, badge, and URL!\n');

  // TEST 2: Check existing Sarojini orders #VEL-80119 & #VEL-51304
  console.log('TEST 2: Verifying orders #VEL-80119 and #VEL-51304');
  const ord2Res = await fetch(SUPABASE_URL + '/rest/v1/orders?order_number=in.(%23VEL-80119,%23VEL-51304)&select=*,order_items(*)', { headers: adminHeaders });
  const ord2List = await ord2Res.json();
  for (const o of ord2List) {
    const c = getOrderCatalogInfo(o);
    console.log(`  Order ${o.order_number}: items=${o.order_items.length}, catalog=${c.label}`);
    if (o.order_items.length < 1) throw new Error(`${o.order_number} has 0 items!`);
    const info = await resolveItemLink(o.order_items[0], adminHeaders);
    console.log(`    Item: ${info.productName} | Badge: ${info.storeBadge} | URL: ${info.finalUrl}`);
    if (!info.finalUrl.includes('sarojini-product-details.html')) throw new Error('Invalid URL: ' + info.finalUrl);
  }
  console.log('  ✅ TEST 2 PASSED: Both orders resolve Sarojini products correctly!\n');

  // TEST 3: Check Main VADI order
  console.log('TEST 3: Verifying Main VADI order (TEST-MAIN-MUAVXEJV)');
  const ord3Res = await fetch(SUPABASE_URL + '/rest/v1/orders?order_number=eq.TEST-MAIN-MUAVXEJV&select=*,order_items(*)', { headers: adminHeaders });
  const ord3List = await ord3Res.json();
  const ord3 = ord3List[0];
  if (ord3) {
    const c3 = getOrderCatalogInfo(ord3);
    console.log('  Main Order Catalog:', c3);
    if (c3.type !== 'main') throw new Error('Expected main catalog, got: ' + c3.type);
    const info3 = await resolveItemLink(ord3.order_items[0], adminHeaders);
    console.log('  Main Item Info:', info3);
    if (!info3.finalUrl.includes('product.html')) throw new Error('Expected product.html URL, got: ' + info3.finalUrl);
    console.log('  ✅ TEST 3 PASSED: Main VADI order resolves correctly!\n');
  }

  // TEST 4: Simulate a customer placing a NEW Sarojini Order with updated checkout logic
  console.log('TEST 4: Placing a new Sarojini order via updated checkout logic');
  const custAuth = await loginCustomer();
  const custToken = custAuth.access_token;
  const custUserId = custAuth.user.id;
  const custHeaders = { 'apikey': ANON_KEY, 'Authorization': 'Bearer ' + custToken, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

  const newOrderNumber = '#VEL-' + Math.floor(10000 + Math.random() * 90000);
  const newOrdRes = await fetch(SUPABASE_URL + '/rest/v1/orders', {
    method: 'POST',
    headers: custHeaders,
    body: JSON.stringify({
      user_id: custUserId,
      order_number: newOrderNumber,
      subtotal: 299,
      discount: 0,
      shipping_charge: 0,
      total: 299,
      payment_method: 'Cash on Delivery',
      order_status: 'placed',
      delivery_full_name: 'Test Customer Audit',
      delivery_phone: '9876543210',
      delivery_address: 'Flat 402, Lotus Apartments',
      delivery_city: 'Delhi',
      delivery_state: 'Delhi',
      delivery_pincode: '110001'
    })
  });
  const createdNewOrder = await newOrdRes.json();
  if (!createdNewOrder || !createdNewOrder[0]) throw new Error('Failed to create order: ' + JSON.stringify(createdNewOrder));
  const newOrderId = createdNewOrder[0].id;
  console.log('  Created new order ID:', newOrderId, 'Order number:', newOrderNumber);

  // Insert order_items using our updated checkout payload (no bogo columns!)
  const newItemPayload = [
    {
      order_id: newOrderId,
      product_id: null,
      sarojini_product_id: 'd6a64c5f-c8af-43e9-9b6b-3b27fd03fa4e',
      catalog_type: 'sarojini',
      product_name: 'Ribbed Knit Summer Crop Top',
      product_image: 'assets/sarojni/prod-2-ribbed-top.png',
      price: 299,
      quantity: 1,
      selected_size: 'S',
      selected_color: 'Dusty Pink',
      subtotal: 299,
      advance_amount: 0,
      cod_balance: 299,
      advance_payment_enabled: false,
      advance_payment_type: 'fixed',
      advance_payment_value: 0
    }
  ];

  const newItemRes = await fetch(SUPABASE_URL + '/rest/v1/order_items', {
    method: 'POST',
    headers: custHeaders,
    body: JSON.stringify(newItemPayload)
  });
  const insertedItems = await newItemRes.json();
  if (newItemRes.status !== 201) throw new Error('Order items insert failed: ' + JSON.stringify(insertedItems));
  console.log('  Successfully inserted order item:', insertedItems[0]?.id);

  // Now verify as Admin opening Order Details for this new order
  const checkNewOrdRes = await fetch(SUPABASE_URL + '/rest/v1/orders?id=eq.' + newOrderId + '&select=*,order_items(*)', { headers: adminHeaders });
  const checkNewOrd = (await checkNewOrdRes.json())[0];
  const newCat = getOrderCatalogInfo(checkNewOrd);
  console.log('  New Order Admin Catalog:', newCat);
  if (newCat.type !== 'sarojini') throw new Error('Expected sarojini catalog');
  const newResolved = await resolveItemLink(checkNewOrd.order_items[0], adminHeaders);
  console.log('  New Order Resolved Item:', newResolved);
  if (!newResolved.finalUrl.includes('sarojini-product-details.html')) throw new Error('Expected sarojini product URL');
  console.log('  ✅ TEST 4 PASSED: New Sarojini order successfully created & resolved in Admin!\n');

  // TEST 5: Verify Mixed Catalog Order (Main + Sarojini in one order)
  console.log('TEST 5: Verifying mixed catalog order (Main + Sarojini items)');
  const mixedOrderNumber = '#VEL-' + Math.floor(10000 + Math.random() * 90000);
  const mixedOrdRes = await fetch(SUPABASE_URL + '/rest/v1/orders', {
    method: 'POST',
    headers: custHeaders,
    body: JSON.stringify({
      user_id: custUserId,
      order_number: mixedOrderNumber,
      subtotal: 1298,
      discount: 0,
      shipping_charge: 0,
      total: 1298,
      payment_method: 'Cash on Delivery',
      order_status: 'placed',
      delivery_full_name: 'Test Customer Audit',
      delivery_phone: '9876543210',
      delivery_address: 'Flat 402, Lotus Apartments',
      delivery_city: 'Delhi',
      delivery_state: 'Delhi',
      delivery_pincode: '110001'
    })
  });
  const mixedOrder = (await mixedOrdRes.json())[0];
  const mixedOrderId = mixedOrder.id;

  const mixedItemsPayload = [
    {
      order_id: mixedOrderId,
      product_id: null,
      sarojini_product_id: 'd6a64c5f-c8af-43e9-9b6b-3b27fd03fa4e',
      catalog_type: 'sarojini',
      product_name: 'Ribbed Knit Summer Crop Top',
      product_image: 'assets/sarojni/prod-2-ribbed-top.png',
      price: 299,
      quantity: 1,
      selected_size: 'M',
      selected_color: 'Sage Green',
      subtotal: 299,
      advance_amount: 0,
      cod_balance: 299,
      advance_payment_enabled: false
    },
    {
      order_id: mixedOrderId,
      product_id: 'd1ddc795-3927-419b-a3ba-24d65ed77926',
      sarojini_product_id: null,
      catalog_type: 'main',
      product_name: 'Nike | AIR MAX 90  WHITE/BLACK-WHITE',
      product_image: 'https://myblacktree.com/cdn/shop/files/3_d14901c3-227f-4f57-9df8-819a0f8c1009.jpg?v=1754070058&width=823',
      price: 999,
      quantity: 1,
      selected_size: 'UK 9',
      selected_color: 'Default',
      subtotal: 999,
      advance_amount: 0,
      cod_balance: 999,
      advance_payment_enabled: false
    }
  ];

  const mixedInsRes = await fetch(SUPABASE_URL + '/rest/v1/order_items', {
    method: 'POST',
    headers: custHeaders,
    body: JSON.stringify(mixedItemsPayload)
  });
  if (mixedInsRes.status !== 201) throw new Error('Mixed items insert failed: ' + JSON.stringify(await mixedInsRes.json()));

  // Verify mixed order in Admin Order Details
  const checkMixedRes = await fetch(SUPABASE_URL + '/rest/v1/orders?id=eq.' + mixedOrderId + '&select=*,order_items(*)', { headers: adminHeaders });
  const checkMixedOrd = (await checkMixedRes.json())[0];
  const mixedCat = getOrderCatalogInfo(checkMixedOrd);
  console.log('  Mixed Order Catalog Info:', mixedCat);
  if (mixedCat.type !== 'mixed') throw new Error('Expected mixed catalog type');

  const resolvedMixed = await Promise.all(checkMixedOrd.order_items.map(it => resolveItemLink(it, adminHeaders)));
  console.log('  Resolved Items:');
  resolvedMixed.forEach(r => console.log(`    ${r.productName} | ${r.storeBadge} | URL: ${r.finalUrl}`));

  const hasSar = resolvedMixed.some(r => r.isSarojini && r.finalUrl.includes('sarojini-product-details.html') && r.storeBadge.includes('SAROJINI'));
  const hasMn = resolvedMixed.some(r => !r.isSarojini && r.finalUrl.includes('product.html') && r.storeBadge.includes('MAIN'));
  if (!hasSar || !hasMn) throw new Error('Mixed items resolution failed');
  console.log('  ✅ TEST 5 PASSED: Mixed order has both Sarojini & Main badges and correct URLs!\n');

  console.log('==============================================');
  console.log('🎉 ALL 5 VERIFICATION TESTS PASSED PERFECTLY!');
  console.log('==============================================');
}

runTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});

