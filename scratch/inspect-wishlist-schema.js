const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

async function check() {
  const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/wishlist?select=*&limit=1`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Data:", data);

  // Check which columns are valid by selecting them one by one
  const cols = ["id", "user_id", "product_id", "sarojini_product_id", "catalog_type", "created_at"];
  for (const c of cols) {
    const cRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/wishlist?select=${c}&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    console.log(`Column ${c}: status ${cRes.status}`);
  }
}

check().catch(console.error);

