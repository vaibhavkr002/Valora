const fs = require('fs');
const path = require('path');

// Load image-utils.js in Node environment
const webuDir = path.resolve('c:/Users/saanv/OneDrive/Desktop/Website/webu');
const imageUtilsPath = path.join(webuDir, 'js/image-utils.js');
const VeloraImageUtils = require(imageUtilsPath);

const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

async function runTests() {
  console.log('--- STARTING SAROJINI ORDER PRODUCT-IMAGE VERIFICATION ---\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. VeloraImageUtils Unit Tests
  console.log('1. Testing VeloraImageUtils functions:');
  
  // extractImageUrl
  assert(
    VeloraImageUtils.extractImageUrl('assets/sarojni/test.png') === 'assets/sarojni/test.png',
    'extractImageUrl returns simple string url'
  );
  assert(
    VeloraImageUtils.extractImageUrl(['assets/img1.png', 'assets/img2.png']) === 'assets/img1.png',
    'extractImageUrl extracts first item from array'
  );
  assert(
    VeloraImageUtils.extractImageUrl('["assets/json1.png", "assets/json2.png"]') === 'assets/json1.png',
    'extractImageUrl extracts first item from JSON string array'
  );
  assert(
    VeloraImageUtils.extractImageUrl({ url: 'assets/obj.png' }) === 'assets/obj.png',
    'extractImageUrl extracts url property from object'
  );
  assert(
    VeloraImageUtils.extractImageUrl('', 'fallback.png') === 'fallback.png',
    'extractImageUrl falls back when empty'
  );

  // normalizeImageUrl
  assert(
    VeloraImageUtils.normalizeImageUrl('assets/sarojni/test.png', { isAdmin: true }) === '../assets/sarojni/test.png',
    'normalizeImageUrl prefixes ../ in admin context'
  );
  assert(
    VeloraImageUtils.normalizeImageUrl('../assets/sarojni/test.png', { isAdmin: false }) === 'assets/sarojni/test.png',
    'normalizeImageUrl strips ../ in customer context'
  );
  assert(
    VeloraImageUtils.normalizeImageUrl('https://example.com/photo.jpg', { isAdmin: true }) === 'https://example.com/photo.jpg',
    'normalizeImageUrl leaves HTTPS URLs intact for admin'
  );
  assert(
    VeloraImageUtils.normalizeImageUrl('https://example.com/photo.jpg', { isAdmin: false }) === 'https://example.com/photo.jpg',
    'normalizeImageUrl leaves HTTPS URLs intact for customer'
  );

  // resolveProductImage
  const dummySarojini = {
    title: 'Vintage Denim Jacket',
    images: ['assets/sarojni/jacket1.jpg', 'assets/sarojni/jacket2.jpg'],
    image: 'assets/sarojni/jacket_legacy.jpg'
  };
  assert(
    VeloraImageUtils.resolveProductImage(dummySarojini, { isAdmin: false }) === 'assets/sarojni/jacket1.jpg',
    'resolveProductImage picks first item from images array for customer'
  );
  assert(
    VeloraImageUtils.resolveProductImage(dummySarojini, { isAdmin: true }) === '../assets/sarojni/jacket1.jpg',
    'resolveProductImage picks first item and prefixes ../ for admin'
  );

  // 2. Physical File System Check
  console.log('\n2. Testing Physical Image Files on Disk:');
  const teePath = path.join(webuDir, 'assets/sarojni/prod-1-graphic-tee.png');
  const topPath = path.join(webuDir, 'assets/sarojni/prod-2-ribbed-top.png');
  const altTeePath = path.join(webuDir, 'assets/sarojini/prod-1-graphic-tee.png');

  assert(fs.existsSync(teePath), `File exists: ${teePath}`);
  assert(fs.existsSync(topPath), `File exists: ${topPath}`);
  assert(fs.existsSync(altTeePath), `Junction/Alias accessible: ${altTeePath}`);

  // Sign in as admin to access REST API
  const adminAuthRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'support@vadistudio.com',
      password: 'VadiSupport2026!'
    })
  });
  const adminAuthData = await adminAuthRes.json();
  const adminToken = adminAuthData.access_token;
  const adminHeaders = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // Sign in as customer to simulate customer actions under RLS
  const custAuthRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test_customer_audit@vadi.com',
      password: 'VadiTest1234!'
    })
  });
  const custAuthData = await custAuthRes.json();
  const custToken = custAuthData.access_token;
  const customerUser = custAuthData.user;
  const customerHeaders = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${custToken}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // 3. Database & Live Sarojini Product
  console.log('\n3. Testing Database Sarojini Product Fetch:');
  const spRes = await fetch(`${SUPABASE_URL}/rest/v1/sarojini_products?select=id,name,images,price,department,is_active&limit=5`, {
    headers: customerHeaders
  });
  const sarojiniProducts = await spRes.json();
  if (!Array.isArray(sarojiniProducts)) {
    console.error('sarojini_products query response:', sarojiniProducts);
  }

  assert(Array.isArray(sarojiniProducts) && sarojiniProducts.length > 0, 'Fetched active sarojini_products from database');
  const targetSarojini = sarojiniProducts[0];
  console.log(`Using Sarojini Product: "${targetSarojini.name}" (ID: ${targetSarojini.id})`);

  const resolvedImageCustomer = VeloraImageUtils.resolveProductImage(targetSarojini, { isAdmin: false });
  const resolvedImageAdmin = VeloraImageUtils.resolveProductImage(targetSarojini, { isAdmin: true });
  assert(!!resolvedImageCustomer && !resolvedImageCustomer.startsWith('data:image/svg+xml'), `Customer image resolved: ${resolvedImageCustomer}`);
  assert(!!resolvedImageAdmin && resolvedImageAdmin.startsWith('../') && !resolvedImageAdmin.startsWith('data:image/svg+xml'), `Admin image resolved: ${resolvedImageAdmin}`);

  // 4. End-to-End Order Creation & Image Snapshot Verification
  console.log('\n4. Simulating Sarojini Order Placement & order_items Snapshot:');
  const testOrderNumber = `TEST-SAR-${Date.now().toString(36).toUpperCase()}`;

  const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: customerHeaders,
    body: JSON.stringify({
      user_id: customerUser.id,
      order_number: testOrderNumber,
      total: Number(targetSarojini.price) || 299,
      subtotal: Number(targetSarojini.price) || 299,
      order_status: 'confirmed',
      payment_method: 'COD',
      payment_status: 'pending',
      delivery_full_name: 'Sarojini Image Test',
      delivery_address: '123 Fashion Street',
      delivery_city: 'New Delhi',
      delivery_state: 'Delhi',
      delivery_pincode: '110024',
      delivery_phone: '9876543210'
    })
  });
  const createdOrders = await orderRes.json();
  const newOrder = createdOrders[0];

  assert(newOrder && newOrder.id, `Created test order: ${testOrderNumber} (ID: ${newOrder?.id})`);

  // Insert order_item with resolved product_image snapshot as checkout.js now does
  const itemPayload = {
    order_id: newOrder.id,
    sarojini_product_id: targetSarojini.id,
    catalog_type: 'sarojini',
    product_name: targetSarojini.name,
    product_image: resolvedImageCustomer, // saved as clean root-relative or URL snapshot
    quantity: 1,
    price: Number(targetSarojini.price) || 299,
    subtotal: Number(targetSarojini.price) || 299,
    selected_size: 'M',
    selected_color: 'Default'
  };

  const itemRes = await fetch(`${SUPABASE_URL}/rest/v1/order_items`, {
    method: 'POST',
    headers: customerHeaders,
    body: JSON.stringify(itemPayload)
  });
  const insertedItems = await itemRes.json();
  const insertedItem = insertedItems[0];

  assert(insertedItem && insertedItem.id, 'Inserted order_item with snapshot image');
  assert(insertedItem.product_image === resolvedImageCustomer, `order_items.product_image accurately stored: "${insertedItem?.product_image}"`);

  // 5. Test Customer My Orders Query & Render Flow (account.html simulation)
  console.log('\n5. Simulating Customer My Orders flow (account.html):');
  const custRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${newOrder.id}&select=id,order_number,created_at,total,order_status,order_items(id,product_id,sarojini_product_id,catalog_type,product_name,quantity,price,selected_size,selected_color,product_image)`, {
    headers: customerHeaders
  });
  const customerOrders = await custRes.json();
  const customerOrderData = customerOrders[0];

  assert(customerOrderData && customerOrderData.order_items.length > 0, 'Retrieved order for Customer My Orders');
  const custItem = customerOrderData.order_items[0];
  const renderedCustomerImage = VeloraImageUtils.normalizeImageUrl(custItem.product_image, { isAdmin: false });
  assert(renderedCustomerImage === resolvedImageCustomer, `Rendered customer image matches snapshot: ${renderedCustomerImage}`);

  // 6. Test Admin Order Details Query & Render Flow (admin/order-details.html simulation)
  console.log('\n6. Simulating Admin Order Details flow (admin-order-details.js):');
  const admRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${newOrder.id}&select=*,order_items(*)`, {
    headers: adminHeaders
  });
  const adminOrders = await admRes.json();
  const adminOrderData = adminOrders[0];

  assert(adminOrderData && adminOrderData.order_items.length > 0, 'Retrieved order for Admin Order Details');
  const admItem = adminOrderData.order_items[0];
  const renderedAdminImage = VeloraImageUtils.normalizeImageUrl(admItem.product_image, { isAdmin: true });
  assert(
    renderedAdminImage.startsWith('../assets/sarojni/') || renderedAdminImage.startsWith('http'),
    `Admin rendered image correctly prefixed for /admin/ context: ${renderedAdminImage}`
  );

  // 7. Test Historical Order Recovery Flow (when product_image in order_items was NULL/empty)
  console.log('\n7. Testing Historical Order Recovery Flow (missing product_image in DB):');
  const legOrderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: customerHeaders,
    body: JSON.stringify({
      user_id: customerUser.id,
      order_number: `LEGACY-${Date.now().toString(36).toUpperCase()}`,
      total: 199,
      subtotal: 199,
      order_status: 'delivered',
      payment_method: 'COD',
      payment_status: 'paid',
      delivery_full_name: 'Historical Order User',
      delivery_address: '456 Heritage Road',
      delivery_city: 'New Delhi',
      delivery_state: 'Delhi',
      delivery_pincode: '110024',
      delivery_phone: '9876543210'
    })
  });
  const legacyOrders = await legOrderRes.json();
  const legacyOrder = legacyOrders[0];

  // Insert item with NULL product_image
  const legItemRes = await fetch(`${SUPABASE_URL}/rest/v1/order_items`, {
    method: 'POST',
    headers: customerHeaders,
    body: JSON.stringify({
      order_id: legacyOrder.id,
      sarojini_product_id: targetSarojini.id,
      catalog_type: 'sarojini',
      product_name: targetSarojini.name,
      product_image: null, // intentionally null like old legacy orders
      quantity: 1,
      price: 199,
      subtotal: 199
    })
  });
  const legacyItems = await legItemRes.json();
  const legacyItem = legacyItems[0];

  assert(legacyItem && legacyItem.id, 'Created legacy order item with null product_image');

  // Simulate account.html recovery pass:
  const recRes = await fetch(`${SUPABASE_URL}/rest/v1/sarojini_products?id=in.(${legacyItem.sarojini_product_id})&select=id,images,name`, {
    headers: customerHeaders
  });
  const recoveredSarojiniData = await recRes.json();

  const sarMap = {};
  (recoveredSarojiniData || []).forEach(p => { sarMap[p.id] = p; });
  const recoveredItem = { ...legacyItem };
  if (!recoveredItem.product_image && sarMap[recoveredItem.sarojini_product_id]) {
    recoveredItem.product_image = VeloraImageUtils.resolveProductImage(sarMap[recoveredItem.sarojini_product_id], { isAdmin: false });
  }

  assert(
    !!recoveredItem.product_image && !recoveredItem.product_image.startsWith('data:image/svg+xml'),
    `Historical item recovered image from sarojini_products: ${recoveredItem.product_image}`
  );

  // Simulate admin-order-details.js recovery pass:
  const adminResolvedProduct = sarMap[legacyItem.sarojini_product_id];
  const adminRecoveredImage = VeloraImageUtils.resolveProductImage(adminResolvedProduct, { isAdmin: true });
  assert(
    !!adminRecoveredImage && adminRecoveredImage.startsWith('../assets/sarojni/'),
    `Historical item recovered image for admin: ${adminRecoveredImage}`
  );

  // 8. Main VADI Product Flow Verification (No Regressions)
  console.log('\n8. Testing Main VADI Product Image Flow:');
  const prodRes = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,images,price,is_active&limit=1`, {
    headers: customerHeaders
  });
  const mainProducts = await prodRes.json();
  assert(Array.isArray(mainProducts) && mainProducts.length > 0, 'Fetched active products from database');
  const targetMain = mainProducts[0];
  console.log(`Using Main VADI Product: "${targetMain.name}" (ID: ${targetMain.id})`);

  const mainResolvedCustomer = VeloraImageUtils.resolveProductImage(targetMain, { isAdmin: false });
  const mainResolvedAdmin = VeloraImageUtils.resolveProductImage(targetMain, { isAdmin: true });
  assert(!!mainResolvedCustomer && !mainResolvedCustomer.startsWith('data:image/svg+xml'), `Main VADI customer image resolved: ${mainResolvedCustomer}`);
  assert(!!mainResolvedAdmin && !mainResolvedAdmin.startsWith('data:image/svg+xml'), `Main VADI admin image resolved: ${mainResolvedAdmin}`);

  const mainOrderNumber = `TEST-MAIN-${Date.now().toString(36).toUpperCase()}`;
  const mainOrderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: customerHeaders,
    body: JSON.stringify({
      user_id: customerUser.id,
      order_number: mainOrderNumber,
      total: Number(targetMain.price) || 999,
      subtotal: Number(targetMain.price) || 999,
      order_status: 'confirmed',
      payment_method: 'COD',
      payment_status: 'pending',
      delivery_full_name: 'Main Vadi Customer',
      delivery_address: '789 Main Blvd',
      delivery_city: 'Mumbai',
      delivery_state: 'Maharashtra',
      delivery_pincode: '400001',
      delivery_phone: '9876543210'
    })
  });
  const mainOrders = await mainOrderRes.json();
  const mainOrder = mainOrders[0];

  const mainItemRes = await fetch(`${SUPABASE_URL}/rest/v1/order_items`, {
    method: 'POST',
    headers: customerHeaders,
    body: JSON.stringify({
      order_id: mainOrder.id,
      product_id: targetMain.id,
      catalog_type: 'main',
      product_name: targetMain.name,
      product_image: mainResolvedCustomer,
      quantity: 1,
      price: Number(targetMain.price) || 999,
      subtotal: Number(targetMain.price) || 999,
      selected_size: 'L',
      selected_color: 'Default'
    })
  });
  const mainItems = await mainItemRes.json();
  const mainItem = mainItems[0];
  assert(mainItem && mainItem.id, 'Main VADI order_item inserted');
  assert(mainItem.product_image === mainResolvedCustomer, 'Main VADI product_image accurately snapshotted');

  // 9. Clean up test records
  console.log('\n9. Cleaning up test orders:');
  await fetch(`${SUPABASE_URL}/rest/v1/order_items?order_id=in.(${newOrder.id},${legacyOrder.id},${mainOrder.id})`, {
    method: 'DELETE',
    headers: customerHeaders
  });
  await fetch(`${SUPABASE_URL}/rest/v1/orders?id=in.(${newOrder.id},${legacyOrder.id},${mainOrder.id})`, {
    method: 'DELETE',
    headers: customerHeaders
  });
  console.log('All test orders successfully cleaned up.');

  // Summary
  console.log(`\n========================================`);
  console.log(`Total tests passed: ${passed}`);
  console.log(`Total tests failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
