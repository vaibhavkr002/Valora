#!/usr/bin/env node
/**
 * VALORA & Sarojini Bazaar - Master Product Content Synchronization CLI
 * 
 * Generates and updates authentic, detailed, category-coordinated:
 * 1. Product Overview (short, attractive summary)
 * 2. Product Highlights (4–7 relevant, verified bullet points)
 * 3. Product Description (detailed, polished e-commerce narrative)
 * 
 * Applies to:
 * 1. Main Store (public.products table - description column)
 * 2. Sarojini Bazaar (public.sarojini_products table - description and specifications JSONB)
 * 
 * STRICT COMPLIANCE:
 * - 100% PRODUCT-SPECIFIC.
 * - ZERO FABRICATION: Never invents technical specs, water resistance, exact weights, or materials not in the data.
 * - Perfect coordination with category, title, colors, sizes, and specifications.
 */

const { getAdminToken } = require('./seed-product-reviews');
const { generateProductContent } = require('./lib/product-content-generator');

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

async function updateMainProductContent(product, token, isDryRun = false) {
  const content = generateProductContent(product);

  if (isDryRun) {
    return { success: true, dryRun: true, content };
  }

  const patchRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/products?id=eq.${product.id}`, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify({
      description: content.description,
      updated_at: new Date().toISOString()
    })
  });

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    throw new Error(`Failed to patch product ${product.id}: ${patchRes.status} - ${errText}`);
  }

  return { success: true, content };
}

async function updateSarojiniProductContent(product, token, isDryRun = false) {
  const content = generateProductContent(product);

  const updatedSpecs = {
    ...(product.specifications || {}),
    overview: content.overview,
    highlights: content.highlights
  };

  if (isDryRun) {
    return { success: true, dryRun: true, content };
  }

  const patchRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/sarojini_products?id=eq.${product.id}`, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify({
      description: content.description,
      specifications: updatedSpecs,
      updated_at: new Date().toISOString()
    })
  });

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    throw new Error(`Failed to patch sarojini product ${product.id}: ${patchRes.status} - ${errText}`);
  }

  return { success: true, content };
}

async function runPool(items, concurrency, workerFn) {
  let index = 0;
  const results = [];

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      try {
        const res = await workerFn(item, currentIndex);
        results[currentIndex] = { status: 'fulfilled', value: res };
      } catch (err) {
        results[currentIndex] = { status: 'rejected', reason: err };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
  const catalogArg = args.find(a => a.startsWith('--catalog='));
  const targetCatalog = catalogArg ? catalogArg.split('=')[1].toLowerCase() : 'all';

  console.log('================================================================');
  console.log('=== VALORA & SAROJINI BAZAAR PRODUCT CONTENT SYNCHRONIZATION ===');
  console.log('================================================================');
  console.log(`Dry Run: ${isDryRun ? 'YES (No DB changes)' : 'NO (Writing to DB)'}`);
  console.log(`Target Catalog: ${targetCatalog.toUpperCase()}`);
  if (limit) console.log(`Limit per catalog: ${limit}`);
  console.log('----------------------------------------------------------------\n');

  const token = await getAdminToken();
  let totalUpdated = 0;
  let totalErrors = 0;

  // 1. Process Main Store Products
  if (targetCatalog === 'all' || targetCatalog === 'main') {
    console.log('Fetching Main Store products...');
    let mainProducts = await fetchAllProducts('products');
    console.log(`Found ${mainProducts.length} Main Store products in database.`);

    if (limit) mainProducts = mainProducts.slice(0, limit);

    console.log(`Processing ${mainProducts.length} Main Store products (Concurrency: 6)...`);
    const startTime = Date.now();

    const results = await runPool(mainProducts, 6, async (p, idx) => {
      const res = await updateMainProductContent(p, token, isDryRun);
      if ((idx + 1) % 25 === 0 || idx + 1 === mainProducts.length) {
        process.stdout.write(`  [Main Store] Processed ${idx + 1}/${mainProducts.length}\n`);
      }
      return res;
    });

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected');
    totalUpdated += succeeded;
    totalErrors += failed.length;

    console.log(`Main Store completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s.`);
    console.log(`  ✓ Succeeded: ${succeeded}`);
    if (failed.length > 0) {
      console.error(`  ✕ Failed: ${failed.length}`);
      failed.forEach((f, i) => console.error(`    Error ${i + 1}: ${f.reason.message}`));
    }
    console.log('');
  }

  // 2. Process Sarojini Bazaar Products
  if (targetCatalog === 'all' || targetCatalog === 'sarojini') {
    console.log('Fetching Sarojini Bazaar products...');
    let sarojiniProducts = await fetchAllProducts('sarojini_products');
    console.log(`Found ${sarojiniProducts.length} Sarojini Bazaar products in database.`);

    if (limit) sarojiniProducts = sarojiniProducts.slice(0, limit);

    console.log(`Processing ${sarojiniProducts.length} Sarojini Bazaar products (Concurrency: 6)...`);
    const startTime = Date.now();

    const results = await runPool(sarojiniProducts, 6, async (p, idx) => {
      const res = await updateSarojiniProductContent(p, token, isDryRun);
      if ((idx + 1) % 50 === 0 || idx + 1 === sarojiniProducts.length) {
        process.stdout.write(`  [Sarojini Bazaar] Processed ${idx + 1}/${sarojiniProducts.length}\n`);
      }
      return res;
    });

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected');
    totalUpdated += succeeded;
    totalErrors += failed.length;

    console.log(`Sarojini Bazaar completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s.`);
    console.log(`  ✓ Succeeded: ${succeeded}`);
    if (failed.length > 0) {
      console.error(`  ✕ Failed: ${failed.length}`);
      failed.forEach((f, i) => console.error(`    Error ${i + 1}: ${f.reason.message}`));
    }
    console.log('');
  }

  console.log('================================================================');
  console.log(`SUMMARY: Total Products Processed: ${totalUpdated} | Errors: ${totalErrors}`);
  console.log('================================================================\n');

  if (totalErrors > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
  });
}

module.exports = {
  updateMainProductContent,
  updateSarojiniProductContent
};

