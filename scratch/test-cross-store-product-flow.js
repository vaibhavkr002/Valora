const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

// Create a Supabase-compatible client over native Node fetch
function createSupabaseFetchClient(authToken) {
  const baseHeaders = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + authToken,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  return {
    from(table) {
      let queryParams = [];
      let currentFilters = [];

      const builder = {
        select(columns = '*') {
          queryParams.push(`select=${encodeURIComponent(columns)}`);
          return builder;
        },
        eq(column, value) {
          currentFilters.push(`${column}=eq.${encodeURIComponent(value)}`);
          return builder;
        },
        in(column, values) {
          currentFilters.push(`${column}=in.(${values.map(encodeURIComponent).join(',')})`);
          return builder;
        },
        order(column, { ascending = true } = {}) {
          queryParams.push(`order=${column}.${ascending ? 'asc' : 'desc'}`);
          return builder;
        },
        limit(n) {
          queryParams.push(`limit=${n}`);
          return builder;
        },
        async then(resolve, reject) {
          const qs = [...queryParams, ...currentFilters].join('&');
          const url = `${SUPABASE_URL}/rest/v1/${table}?${qs}`;
          const res = await fetch(url, { headers: baseHeaders });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ message: res.statusText }));
            resolve({ data: null, error: err });
          } else {
            const arr = await res.json();
            resolve({ data: arr, error: null });
          }
        },
        async maybeSingle() {
          const qs = [...queryParams, ...currentFilters].join('&');
          const url = `${SUPABASE_URL}/rest/v1/${table}?${qs}`;
          const res = await fetch(url, { headers: baseHeaders });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ message: res.statusText }));
            return { data: null, error: err };
          }
          const arr = await res.json();
          return { data: Array.isArray(arr) && arr.length > 0 ? arr[0] : null, error: null };
        },
        async single() {
          const qs = [...queryParams, ...currentFilters].join('&');
          const url = `${SUPABASE_URL}/rest/v1/${table}?${qs}`;
          const headers = { ...baseHeaders, 'Accept': 'application/vnd.pgrst.object+json' };
          const res = await fetch(url, { headers });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ message: res.statusText }));
            return { data: null, error: err };
          }
          const obj = await res.json();
          return { data: obj, error: null };
        },
        insert(records) {
          let isSingle = false;
          const execute = async () => {
            const url = `${SUPABASE_URL}/rest/v1/${table}`;
            const headers = { ...baseHeaders };
            if (isSingle) {
              headers['Accept'] = 'application/vnd.pgrst.object+json';
            }
            const res = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(records)
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
              return { data: null, error: json };
            }
            return { data: json, error: null };
          };

          return {
            select() {
              return {
                async single() {
                  isSingle = true;
                  return await execute();
                },
                then(resolve, reject) {
                  return execute().then(resolve, reject);
                }
              };
            },
            then(resolve, reject) {
              return execute().then(resolve, reject);
            }
          };
        },
        async upsert(payload, { onConflict } = {}) {
          let url = `${SUPABASE_URL}/rest/v1/${table}`;
          if (onConflict) url += `?on_conflict=${encodeURIComponent(onConflict)}`;
          const headers = {
            ...baseHeaders,
            'Prefer': 'resolution=merge-duplicates,return=representation'
          };
          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(Array.isArray(payload) ? payload : [payload])
          });
          const json = await res.json().catch(() => null);
          return { data: json, error: res.ok ? null : json };
        },
        update(payload) {
          const updateBuilder = {
            eq(column, value) {
              currentFilters.push(`${column}=eq.${encodeURIComponent(value)}`);
              return updateBuilder;
            },
            async then(resolve, reject) {
              const qs = currentFilters.join('&');
              const url = `${SUPABASE_URL}/rest/v1/${table}?${qs}`;
              const res = await fetch(url, {
                method: 'PATCH',
                headers: baseHeaders,
                body: JSON.stringify(payload)
              });
              const json = await res.json().catch(() => null);
              resolve({ data: json, error: res.ok ? null : json });
            }
          };
          return updateBuilder;
        },
        delete() {
          const deleteBuilder = {
            eq(column, value) {
              currentFilters.push(`${column}=eq.${encodeURIComponent(value)}`);
              return deleteBuilder;
            },
            async then(resolve, reject) {
              const qs = currentFilters.join('&');
              const url = `${SUPABASE_URL}/rest/v1/${table}?${qs}`;
              const res = await fetch(url, {
                method: 'DELETE',
                headers: baseHeaders
              });
              const json = await res.json().catch(() => null);
              resolve({ data: json, error: res.ok ? null : json });
            }
          };
          return deleteBuilder;
        }
      };

      return builder;
    }
  };
}

// Load CrossStoreService
const crossStoreServiceCode = fs.readFileSync(path.join(ROOT, 'admin/js/cross-store-service.js'), 'utf8');
const fakeWindow = {};
const evalFn = new Function('window', crossStoreServiceCode);
evalFn(fakeWindow);
const CrossStoreService = fakeWindow.CrossStoreService;

if (!CrossStoreService) {
  console.error("Failed to instantiate CrossStoreService");
  process.exit(1);
}

async function runTests() {
  console.log("====================================================================");
  console.log("   VADI & SAROJINI CROSS-STORE AVAILABILITY SYSTEM VERIFICATION");
  console.log("====================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
    }
  }

  // 1. Authenticate Admin
  console.log("Step 1: Admin Authentication");
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'support@vadistudio.com', password: 'VadiSupport2026!' })
  });
  const authData = await authRes.json();
  const token = authData.access_token;
  assert(Boolean(token), "Admin authentication succeeded");

  const client = createSupabaseFetchClient(token);

  // 2. Mapping Registry
  console.log("\nStep 2: Normalized Registry (store_settings.cross_store_mapping)");
  const initialMapping = await CrossStoreService.getMapping(client);
  assert(initialMapping && typeof initialMapping === 'object', "getMapping returned valid mapping object");
  assert(typeof initialMapping.main_available_in_sarojini === 'object', "main_available_in_sarojini exists in mapping");
  assert(typeof initialMapping.sarojini_available_in_main === 'object', "sarojini_available_in_main exists in mapping");

  // Initial table row counts
  const { data: initialSarojiniProducts } = await client.from('sarojini_products').select('id');
  const initialSarojiniCount = Array.isArray(initialSarojiniProducts) ? initialSarojiniProducts.length : 0;
  console.log(`  Initial sarojini_products count in database: ${initialSarojiniCount}`);

  const { data: initialMainProducts } = await client.from('products').select('id');
  const initialMainCount = Array.isArray(initialMainProducts) ? initialMainProducts.length : 0;
  console.log(`  Initial products count in database: ${initialMainCount}`);

  // Fetch an existing Main product to test
  const { data: sampleMainProduct } = await client
    .from('products')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single();

  assert(sampleMainProduct && sampleMainProduct.id, `Loaded existing Main product: "${sampleMainProduct.name}" (${sampleMainProduct.id})`);

  // Fetch an existing Sarojini product to test
  const { data: sampleSarojiniProduct } = await client
    .from('sarojini_products')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single();

  assert(sampleSarojiniProduct && sampleSarojiniProduct.id, `Loaded existing Sarojini product: "${sampleSarojiniProduct.name}" (${sampleSarojiniProduct.id})`);

  // =========================================================================
  // TEST 1 — Main -> Sarojini
  // =========================================================================
  console.log("\n--- TEST 1: Main -> Sarojini Availability ---");
  const addMainRes = await CrossStoreService.addMainToSarojini(client, sampleMainProduct, {
    department: 'MEN',
    isFeatured: true
  });

  assert(addMainRes.success === true, "addMainToSarojini returned success: true");

  // Verify NO duplicate row in sarojini_products!
  const { data: postSarojiniProducts } = await client.from('sarojini_products').select('id');
  assert(postSarojiniProducts.length === initialSarojiniCount, `sarojini_products count is STILL ${initialSarojiniCount} (Zero duplicate rows inserted!)`);

  // Verify mapping registry has the product ID with metadata
  const mappingAfterMain = await CrossStoreService.getMapping(client);
  const mainEntry = mappingAfterMain.main_available_in_sarojini[sampleMainProduct.id];
  assert(mainEntry && mainEntry.available === true, "main_available_in_sarojini contains main product id");
  assert(mainEntry.department === 'MEN', "Assigned department is MEN");
  assert(mainEntry.is_featured === true, "Assigned is_featured is true");

  // Verify helper availability checks
  assert(CrossStoreService.isAvailableInMain(mappingAfterMain, { ...sampleMainProduct, origin_catalog: 'main' }), "Product is available in Main Store");
  assert(CrossStoreService.isAvailableInSarojini(mappingAfterMain, { ...sampleMainProduct, origin_catalog: 'main' }), "Product is now available in Sarojini Bazaar");

  // =========================================================================
  // TEST 2 — Sarojini -> Main
  // =========================================================================
  console.log("\n--- TEST 2: Sarojini -> Main Availability ---");
  const addSarojiniRes = await CrossStoreService.addSarojiniToMain(client, sampleSarojiniProduct, {
    isFeatured: true
  });

  assert(addSarojiniRes.success === true, "addSarojiniToMain returned success: true");

  // Verify NO duplicate row in products!
  const { data: postMainProducts } = await client.from('products').select('id');
  assert(postMainProducts.length === initialMainCount, `products count is STILL ${initialMainCount} (Zero duplicate rows inserted!)`);

  // Verify mapping registry has the product ID with metadata
  const mappingAfterSarojini = await CrossStoreService.getMapping(client);
  const sarojiniEntry = mappingAfterSarojini.sarojini_available_in_main[sampleSarojiniProduct.id];
  assert(sarojiniEntry && sarojiniEntry.available === true, "sarojini_available_in_main contains sarojini product id");

  // Verify helper availability checks
  assert(CrossStoreService.isAvailableInSarojini(mappingAfterSarojini, { ...sampleSarojiniProduct, origin_catalog: 'sarojini' }), "Product is available in Sarojini Bazaar");
  assert(CrossStoreService.isAvailableInMain(mappingAfterSarojini, { ...sampleSarojiniProduct, origin_catalog: 'sarojini' }), "Product is now available in Main Store");

  // =========================================================================
  // TEST 3 — Duplicate Protection (Idempotency)
  // =========================================================================
  console.log("\n--- TEST 3: Duplicate Protection (Idempotency) ---");
  const secondMainRes = await CrossStoreService.addMainToSarojini(client, sampleMainProduct, { department: 'MEN' });
  assert(secondMainRes.alreadyExists === true, "Repeated Main -> Sarojini call returned alreadyExists: true");

  const secondSarojiniRes = await CrossStoreService.addSarojiniToMain(client, sampleSarojiniProduct);
  assert(secondSarojiniRes.alreadyExists === true, "Repeated Sarojini -> Main call returned alreadyExists: true");

  const { data: countCheckSarojini } = await client.from('sarojini_products').select('id');
  const { data: countCheckMain } = await client.from('products').select('id');
  assert(countCheckSarojini.length === initialSarojiniCount, `sarojini_products row count still exactly ${initialSarojiniCount}`);
  assert(countCheckMain.length === initialMainCount, `products row count still exactly ${initialMainCount}`);

  // =========================================================================
  // TEST 4 — Existing Products Catalog Identity
  // =========================================================================
  console.log("\n--- TEST 4: Existing Products Catalog Identity ---");
  // Check that origin Main product remains in products
  const { data: verifyMain } = await client.from('products').select('id, name').eq('id', sampleMainProduct.id).single();
  assert(verifyMain && verifyMain.id === sampleMainProduct.id, "Origin Main product remains in products table with identical ID");

  // Check that origin Sarojini product remains in sarojini_products
  const { data: verifySarojini } = await client.from('sarojini_products').select('id, name').eq('id', sampleSarojiniProduct.id).single();
  assert(verifySarojini && verifySarojini.id === sampleSarojiniProduct.id, "Origin Sarojini product remains in sarojini_products table with identical ID");

  // =========================================================================
  // TEST 5 — Customer Storefront Lookups (Direct REST)
  // =========================================================================
  console.log("\n--- TEST 5: Customer Storefront Functionality ---");
  // 5.1 Main product accessible via PDP URL / query
  const mainPdpRes = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${sampleMainProduct.id}&select=id,name,price,images`, {
    headers: { 'apikey': SUPABASE_ANON_KEY }
  });
  const mainPdpData = await mainPdpRes.json();
  assert(Array.isArray(mainPdpData) && mainPdpData.length === 1 && mainPdpData[0].id === sampleMainProduct.id, "Main product resolves cleanly from Supabase");

  // 5.2 Sarojini product accessible via PDP URL / query
  const sarojiniPdpRes = await fetch(`${SUPABASE_URL}/rest/v1/sarojini_products?id=eq.${sampleSarojiniProduct.id}&select=id,name,price,images`, {
    headers: { 'apikey': SUPABASE_ANON_KEY }
  });
  const sarojiniPdpData = await sarojiniPdpRes.json();
  assert(Array.isArray(sarojiniPdpData) && sarojiniPdpData.length === 1 && sarojiniPdpData[0].id === sampleSarojiniProduct.id, "Sarojini product resolves cleanly from Supabase");

  // =========================================================================
  // TEST 6 — Historical Orders
  // =========================================================================
  console.log("\n--- TEST 6: Historical Orders Untouched ---");
  const { data: ordersData } = await client.from('orders').select('id').limit(5);
  assert(Array.isArray(ordersData), "Orders table queried successfully without disruption");

  // =========================================================================
  // TEST 7 — Safe Removal of Availability (Zero Product Deletion)
  // =========================================================================
  console.log("\n--- TEST 7: Safe Removal of Availability ---");
  const removeMainFromSarojini = await CrossStoreService.removeFromStore(client, {
    originCatalog: 'main',
    productId: sampleMainProduct.id,
    targetStore: 'sarojini'
  });
  assert(removeMainFromSarojini.success === true, "Removed Main product from Sarojini Bazaar successfully");

  const mappingAfterMainRemoval = await CrossStoreService.getMapping(client);
  assert(!mappingAfterMainRemoval.main_available_in_sarojini[sampleMainProduct.id], "Mapping link main_available_in_sarojini removed");

  // Origin product must still exist in products!
  const { data: checkMainStillExists } = await client.from('products').select('id, name').eq('id', sampleMainProduct.id).single();
  assert(checkMainStillExists && checkMainStillExists.id === sampleMainProduct.id, "Main product row in `products` is 100% INTACT!");

  const removeSarojiniFromMain = await CrossStoreService.removeFromStore(client, {
    originCatalog: 'sarojini',
    productId: sampleSarojiniProduct.id,
    targetStore: 'main'
  });
  assert(removeSarojiniFromMain.success === true, "Removed Sarojini product from Main Store successfully");

  const mappingAfterSarojiniRemoval = await CrossStoreService.getMapping(client);
  assert(!mappingAfterSarojiniRemoval.sarojini_available_in_main[sampleSarojiniProduct.id], "Mapping link sarojini_available_in_main removed");

  // Origin product must still exist in sarojini_products!
  const { data: checkSarojiniStillExists } = await client.from('sarojini_products').select('id, name').eq('id', sampleSarojiniProduct.id).single();
  assert(checkSarojiniStillExists && checkSarojiniStillExists.id === sampleSarojiniProduct.id, "Sarojini product row in `sarojini_products` is 100% INTACT!");

  // Final count check
  const { data: finalSarojiniProducts } = await client.from('sarojini_products').select('id');
  const { data: finalMainProducts } = await client.from('products').select('id');
  assert(finalSarojiniProducts.length === initialSarojiniCount, `Final sarojini_products count == ${initialSarojiniCount}`);
  assert(finalMainProducts.length === initialMainCount, `Final products count == ${initialMainCount}`);

  console.log(`\n====================================================================`);
  console.log(`Test Summary: ${passed} / ${total} passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`====================================================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Fatal test runner failure:", err);
  process.exit(1);
});
