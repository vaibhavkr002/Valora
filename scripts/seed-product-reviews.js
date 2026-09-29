#!/usr/bin/env node
/**
 * VADI & Sarojini Bazaar - Product Review Seeding & Management CLI
 * 
 * Developer / Admin utility to seed and manage realistic, product-specific reviews.
 * 
 * USAGE:
 *   node scripts/seed-product-reviews.js --product=<product_uuid> [--count=14] [--force]
 *   node scripts/seed-product-reviews.js --catalog=main [--limit=10] [--count=14]
 *   node scripts/seed-product-reviews.js --catalog=sarojini [--limit=10] [--count=14]
 *   node scripts/seed-product-reviews.js --all [--limit=10] [--count=14]
 *   node scripts/seed-product-reviews.js --cleanup --product=<product_uuid>
 *   node scripts/seed-product-reviews.js --cleanup-all
 */

const {
  detectProductCategory,
  generateSeedReviewId,
  isSeedReviewId,
  generateReviewsForProduct,
  calculateProductReviewStats
} = require('./lib/review-generator');

const SUPABASE_PROJECT_URL = process.env.SUPABASE_URL || 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

// Admin authentication helper (signs in as admin to pass RLS for insert/update/delete)
let cachedAuthToken = null;

async function getAdminToken() {
  if (cachedAuthToken) return cachedAuthToken;

  try {
    const lRes = await fetch(`${SUPABASE_PROJECT_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@vadi.com', password: 'AdminPassword2026!' })
    });
    const lData = await lRes.json();
    if (lData.access_token) {
      cachedAuthToken = lData.access_token;
      return cachedAuthToken;
    }
  } catch (err) {
    console.warn('Could not authenticate as admin, falling back to anon key:', err.message);
  }

  return SUPABASE_ANON_KEY;
}

function getHeaders(token) {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function fetchProductById(productId) {
  const token = await getAdminToken();

  // Try Main VADI products
  const mRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/products?id=eq.${productId}&select=*`, {
    headers: getHeaders(token)
  });
  if (mRes.ok) {
    const mData = await mRes.json();
    if (mData && mData.length > 0) {
      return { product: mData[0], catalogType: 'main' };
    }
  }

  // Try Sarojini products
  const sRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/sarojini_products?id=eq.${productId}&select=*`, {
    headers: getHeaders(token)
  });
  if (sRes.ok) {
    const sData = await sRes.json();
    if (sData && sData.length > 0) {
      return { product: sData[0], catalogType: 'sarojini' };
    }
  }

  return null;
}

async function fetchProducts(catalogType = 'main', limit = 20) {
  const token = await getAdminToken();
  const table = catalogType === 'sarojini' ? 'sarojini_products' : 'products';

  const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/${table}?select=*&is_active=eq.true&order=created_at.desc&limit=${limit}`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error(`Failed to fetch ${catalogType} products: ${res.status}`);
  return await res.json();
}

async function fetchExistingReviewsForProduct(productId, catalogType = 'main') {
  const token = await getAdminToken();
  const col = catalogType === 'sarojini' ? 'sarojini_product_id' : 'product_id';

  const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/reviews?${col}=eq.${productId}&select=*`, {
    headers: getHeaders(token)
  });
  if (!res.ok) return [];
  return await res.json();
}

async function insertReviewsBatch(reviews) {
  const token = await getAdminToken();
  const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/reviews`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(reviews)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to insert reviews: ${res.status} - ${errText}`);
  }

  return await res.json();
}

async function deleteSeededReviewsForProduct(productId, catalogType = 'main') {
  const token = await getAdminToken();
  const col = catalogType === 'sarojini' ? 'sarojini_product_id' : 'product_id';

  // Seed reviews have ID starting with 00005eed-
  // PostgREST query: id=gte.00005eed-0000-0000-0000-000000000000&id=lte.00005eed-ffff-ffff-ffff-ffffffffffff
  const res = await fetch(
    `${SUPABASE_PROJECT_URL}/rest/v1/reviews?${col}=eq.${productId}&id=gte.00005eed-0000-0000-0000-000000000000&id=lte.00005eed-ffff-ffff-ffff-ffffffffffff`,
    {
      method: 'DELETE',
      headers: getHeaders(token)
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to delete seeded reviews: ${res.status} - ${err}`);
  }

  return true;
}

async function deleteAllSeededReviews() {
  const token = await getAdminToken();
  const res = await fetch(
    `${SUPABASE_PROJECT_URL}/rest/v1/reviews?id=gte.00005eed-0000-0000-0000-000000000000&id=lte.00005eed-ffff-ffff-ffff-ffffffffffff`,
    {
      method: 'DELETE',
      headers: getHeaders(token)
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to delete all seeded reviews: ${res.status} - ${err}`);
  }

  return true;
}

async function updateProductRatingStats(productId, catalogType = 'main') {
  const token = await getAdminToken();
  const col = catalogType === 'sarojini' ? 'sarojini_product_id' : 'product_id';
  const table = catalogType === 'sarojini' ? 'sarojini_products' : 'products';

  // 1. Fetch all approved reviews currently in DB for this product
  const rRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/reviews?${col}=eq.${productId}&status=eq.approved&select=rating`, {
    headers: getHeaders(token)
  });
  const reviews = rRes.ok ? await rRes.json() : [];

  const stats = calculateProductReviewStats(reviews);

  // 2. Update product row with calculated values
  const patchRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/${table}?id=eq.${productId}`, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify({
      rating: stats.rating,
      review_count: stats.count
    })
  });

  if (!patchRes.ok) {
    console.warn(`Could not update stats on ${table} for ${productId}: ${patchRes.status}`);
  }

  return stats;
}

// ============================================================================
// CORE SEED & CLEANUP WORKFLOWS
// ============================================================================

async function seedProduct(product, catalogType, options = {}) {
  const targetCount = options.count || 14;
  const force = Boolean(options.force);

  console.log(`\nProcessing: "${product.name}" [ID: ${product.id}] (${catalogType.toUpperCase()})`);

  // 1. Check existing reviews
  const existingReviews = await fetchExistingReviewsForProduct(product.id, catalogType);
  const seededCount = existingReviews.filter(r => isSeedReviewId(r.id)).length;
  const genuineCount = existingReviews.length - seededCount;

  if (seededCount > 0 && !force) {
    console.log(`  -> Already has ${seededCount} seeded reviews (${genuineCount} genuine). Skipping. Use --force to replace.`);
    return { skipped: true, seededCount, genuineCount };
  }

  if (seededCount > 0 && force) {
    console.log(`  -> Removing ${seededCount} existing seeded reviews before re-seeding...`);
    await deleteSeededReviewsForProduct(product.id, catalogType);
  }

  // 2. Generate 12-15 reviews
  const reviews = generateReviewsForProduct(product, catalogType, targetCount);
  console.log(`  -> Generated ${reviews.length} product-specific reviews (Category: ${detectProductCategory(product)}).`);

  // 3. Batch insert into Supabase
  await insertReviewsBatch(reviews);
  console.log(`  -> Successfully inserted ${reviews.length} review records into public.reviews.`);

  // 4. Recalculate stats and update product
  const stats = await updateProductRatingStats(product.id, catalogType);
  console.log(`  -> Updated ${catalogType} product stats: Rating = ${stats.rating} ★, Total Reviews = ${stats.count}`);

  return { success: true, inserted: reviews.length, stats };
}

async function cleanupProduct(product, catalogType) {
  console.log(`\nCleaning up seeded reviews for: "${product.name}" [ID: ${product.id}]`);
  await deleteSeededReviewsForProduct(product.id, catalogType);
  const stats = await updateProductRatingStats(product.id, catalogType);
  console.log(`  -> Seeded reviews removed. Updated product stats: Rating = ${stats.rating} ★, Remaining Reviews = ${stats.count}`);
  return stats;
}

// ============================================================================
// CLI ARGS PARSER & RUNNER
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const flags = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const parts = arg.slice(2).split('=');
      flags[parts[0]] = parts.length > 1 ? parts[1] : true;
    }
  }

  console.log('================================================================');
  console.log('=== VALORA & SAROJINI BAZAAR REVIEW SEEDING SYSTEM ===');
  console.log('================================================================');

  // Case 1: Global cleanup
  if (flags['cleanup-all']) {
    console.log('Executing global cleanup of ALL seeded test reviews...');
    await deleteAllSeededReviews();
    console.log('Global cleanup completed: All reviews with prefix 00005eed- removed.');
    console.log('Genuine customer reviews remain 100% untouched.');
    return;
  }

  // Case 2: Specific product cleanup
  if (flags.cleanup && flags.product) {
    const found = await fetchProductById(flags.product);
    if (!found) {
      console.error(`Product not found with ID: ${flags.product}`);
      process.exit(1);
    }
    await cleanupProduct(found.product, found.catalogType);
    return;
  }

  // Case 3: Seed single product
  if (flags.product) {
    const found = await fetchProductById(flags.product);
    if (!found) {
      console.error(`Product not found with ID: ${flags.product}`);
      process.exit(1);
    }
    await seedProduct(found.product, found.catalogType, {
      count: parseInt(flags.count, 10) || 14,
      force: flags.force
    });
    return;
  }

  // Case 4: Seed by catalog or all
  const targetCatalog = flags.catalog || (flags.all ? 'all' : 'main');
  const limit = flags.limit ? parseInt(flags.limit, 10) : 500;
  const count = parseInt(flags.count, 10) || 14;

  let productsToSeed = [];

  if (targetCatalog === 'main' || targetCatalog === 'all') {
    const mainList = await fetchProducts('main', limit);
    productsToSeed.push(...mainList.map(p => ({ product: p, catalogType: 'main' })));
  }

  if (targetCatalog === 'sarojini' || targetCatalog === 'all') {
    const sarList = await fetchProducts('sarojini', limit);
    productsToSeed.push(...sarList.map(p => ({ product: p, catalogType: 'sarojini' })));
  }

  console.log(`Found ${productsToSeed.length} active products to process.`);

  let totalInserted = 0;
  for (const item of productsToSeed) {
    try {
      const res = await seedProduct(item.product, item.catalogType, { count, force: flags.force });
      if (res && res.inserted) totalInserted += res.inserted;
    } catch (err) {
      console.error(`Failed to seed product ${item.product.id}:`, err.message);
    }
  }

  console.log('\n================================================================');
  console.log(`COMPLETED: Inserted ${totalInserted} reviews across ${productsToSeed.length} products.`);
  console.log('================================================================');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal CLI Error:', err);
    process.exit(1);
  });
}

module.exports = {
  seedProduct,
  cleanupProduct,
  fetchProductById,
  fetchProducts,
  getAdminToken,
  deleteSeededReviewsForProduct,
  deleteAllSeededReviews,
  updateProductRatingStats
};
