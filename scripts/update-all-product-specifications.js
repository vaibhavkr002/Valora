#!/usr/bin/env node
/**
 * VALORA & Sarojini Bazaar - Master Product Specification Synchronization CLI
 * 
 * Generates and updates authentic, detailed, category-coordinated specifications
 * for EVERY product in:
 * 1. Main Store (public.product_specifications table)
 * 2. Sarojini Bazaar (public.sarojini_products.specifications JSONB column)
 * 
 * STRICT COMPLIANCE:
 * - Never fabricates technical specs, exact weights, or unverified claims.
 * - Extracts only verified details from titles, descriptions, categories, variants, and existing attributes.
 * - Purges mismatched/irrelevant legacy fields.
 * - Keeps genuine product attributes and promotional metadata intact.
 */

const { getAdminToken } = require('./seed-product-reviews');
const {
  detectArchetype,
  generateProductSpecifications,
  formatSarojiniJsonbSpecifications
} = require('./lib/specification-builder');

const SUPABASE_PROJECT_URL = process.env.SUPABASE_URL || 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

function getHeaders(token) {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

async function fetchAllProducts(table) {
  const token = await getAdminToken();
  const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/${table}?select=*&limit=1000`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error(`Failed to fetch ${table}: ${res.status}`);
  return await res.json();
}

async function updateMainProductSpecs(product, token) {
  const specs = generateProductSpecifications(product);
  if (specs.length === 0) return { skipped: true };

  // 1. Delete existing rows for this product
  await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/product_specifications?product_id=eq.${product.id}`, {
    method: 'DELETE',
    headers: getHeaders(token)
  });

  // 2. Insert clean, categorized rows
  const payload = specs.map((s, idx) => ({
    product_id: product.id,
    name: s.name,
    value: s.value,
    group_name: s.group_name || 'General',
    display_order: idx,
    is_active: true
  }));

  const insRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/product_specifications`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(payload)
  });

  if (!insRes.ok) {
    const errText = await insRes.text();
    throw new Error(`Failed to insert specs for ${product.id}: ${insRes.status} - ${errText}`);
  }

  return { success: true, count: payload.length };
}

async function updateSarojiniProductSpecs(product, token) {
  const specs = generateProductSpecifications(product);
  const jsonb = formatSarojiniJsonbSpecifications(product.specifications, specs, product);

  const patchRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/sarojini_products?id=eq.${product.id}`, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify({ specifications: jsonb })
  });

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    throw new Error(`Failed to patch sarojini product ${product.id}: ${patchRes.status} - ${errText}`);
  }

  return { success: true, count: specs.length };
}

async function main() {
  console.log('================================================================');
  console.log('=== VALORA & SAROJINI BAZAAR PRODUCT SPECIFICATIONS SYNC ===');
  console.log('================================================================\n');

  const token = await getAdminToken();

  // 1. Process Main Store Products
  console.log('Step 1: Fetching Main Store products...');
  const mainProducts = await fetchAllProducts('products');
  console.log(`Found ${mainProducts.length} Main Store products to process.`);

  let mainSuccess = 0;
  let mainTotalSpecs = 0;
  const mainConcurrency = 6;

  async function mainWorker(chunk) {
    for (const p of chunk) {
      try {
        const res = await updateMainProductSpecs(p, token);
        if (res.success) {
          mainSuccess++;
          mainTotalSpecs += res.count;
        }
      } catch (err) {
        console.error(`Error on Main Product "${p.name}" (${p.id}):`, err.message);
      }
    }
  }

  const mainChunks = Array.from({ length: mainConcurrency }, () => []);
  mainProducts.forEach((p, i) => mainChunks[i % mainConcurrency].push(p));
  await Promise.all(mainChunks.map(c => mainWorker(c)));

  console.log(`\n>>> MAIN STORE COMPLETE: Updated ${mainSuccess}/${mainProducts.length} products (${mainTotalSpecs} total specification rows inserted).\n`);

  // 2. Process Sarojini Bazaar Products
  console.log('Step 2: Fetching Sarojini Bazaar products...');
  const sarojiniProducts = await fetchAllProducts('sarojini_products');
  console.log(`Found ${sarojiniProducts.length} Sarojini Bazaar products to process.`);

  let sarSuccess = 0;
  let sarTotalSpecs = 0;
  const sarConcurrency = 6;

  async function sarWorker(chunk) {
    for (const p of chunk) {
      try {
        const res = await updateSarojiniProductSpecs(p, token);
        if (res.success) {
          sarSuccess++;
          sarTotalSpecs += res.count;
        }
      } catch (err) {
        console.error(`Error on Sarojini Product "${p.name}" (${p.id}):`, err.message);
      }
    }
  }

  const sarChunks = Array.from({ length: sarConcurrency }, () => []);
  sarojiniProducts.forEach((p, i) => sarChunks[i % sarConcurrency].push(p));
  await Promise.all(sarChunks.map(c => sarWorker(c)));

  console.log(`\n>>> SAROJINI BAZAAR COMPLETE: Updated ${sarSuccess}/${sarojiniProducts.length} products (${sarTotalSpecs} total specification entries coordinated).\n`);

  console.log('================================================================');
  console.log(`ALL PRODUCTS SYNCHRONIZED SUCCESSFULLY:`);
  console.log(`- Main Store Products: ${mainSuccess}/${mainProducts.length}`);
  console.log(`- Sarojini Bazaar Products: ${sarSuccess}/${sarojiniProducts.length}`);
  console.log(`- Total Products Processed: ${mainSuccess + sarSuccess}/${mainProducts.length + sarojiniProducts.length}`);
  console.log('================================================================');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal CLI Error:', err);
    process.exit(1);
  });
}

module.exports = {
  updateMainProductSpecs,
  updateSarojiniProductSpecs
};

