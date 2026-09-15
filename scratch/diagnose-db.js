const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

async function checkTable(table, query = "") {
  try {
    const url = `${SUPABASE_PROJECT_URL}/rest/v1/${table}${query ? '?' + query : ''}`;
    const res = await fetch(url, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "count=exact"
      }
    });
    const status = res.status;
    const contentRange = res.headers.get("content-range");
    const data = await res.json();
    return { status, contentRange, count: Array.isArray(data) ? data.length : null, data, error: !res.ok ? data : null };
  } catch (err) {
    return { error: err.message };
  }
}

async function run() {
  console.log("=== SUPABASE DATABASE AUDIT ===");

  // 1. Check products count and rows without filters
  const productsAll = await checkTable("products", "select=id,name,is_active,price,stock,created_at");
  console.log("\n1. All Products in DB:", {
    status: productsAll.status,
    range: productsAll.contentRange,
    count: productsAll.count,
    items: Array.isArray(productsAll.data) ? productsAll.data.map(p => ({ id: p.id, name: p.name, is_active: p.is_active })) : productsAll.data
  });

  // 2. Check active products
  const productsActive = await checkTable("products", "is_active=eq.true&select=id,name,price");
  console.log("\n2. Active Products in DB:", {
    status: productsActive.status,
    range: productsActive.contentRange,
    count: productsActive.count,
    items: Array.isArray(productsActive.data) ? productsActive.data.map(p => ({ id: p.id, name: p.name })) : productsActive.data
  });

  // 3. Check categories
  const categories = await checkTable("categories", "select=id,name,slug,is_active");
  console.log("\n3. Categories in DB:", {
    status: categories.status,
    count: categories.count,
    items: categories.data
  });

  // 4. Check profiles
  const profiles = await checkTable("profiles", "select=id,full_name,role");
  console.log("\n4. Profiles in DB (via anon):", {
    status: profiles.status,
    count: profiles.count,
    items: profiles.data
  });

  // 5. Check product specifications table
  const specs = await checkTable("product_specifications", "select=*");
  console.log("\n5. Product Specifications in DB:", {
    status: specs.status,
    count: specs.count,
    error: specs.error
  });

  // 6. Check customer analytics table
  const analytics = await checkTable("customer_analytics", "select=id");
  console.log("\n6. Customer Analytics in DB (SELECT attempt via anon):", {
    status: analytics.status,
    error: analytics.error
  });
}

run();

