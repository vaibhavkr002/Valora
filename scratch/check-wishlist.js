const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

async function checkWishlist() {
  console.log("=== CHECKING WISHLIST INSERT WITH NULL product_id ===");

  // Try an insert with null product_id to see what error Postgres gives
  const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/wishlist`, {
    method: "POST",
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      user_id: "00000000-0000-0000-0000-000000000000",
      catalog_type: "sarojini",
      product_id: null,
      sarojini_product_id: "00000000-0000-0000-0000-000000000001"
    })
  });

  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", JSON.stringify(data, null, 2));
}

checkWishlist().catch(console.error);

