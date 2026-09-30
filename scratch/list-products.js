const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

async function listProducts() {
  console.log("Listing products from Supabase...");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,price,slug,is_active&limit=5`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  console.log("Products status:", res.status);
  const data = await res.json();
  console.log("Main products:", data);

  const sRes = await fetch(`${SUPABASE_URL}/rest/v1/sarojini_products?select=id,name,price,is_active&limit=5`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  console.log("Sarojini products status:", sRes.status);
  const sData = await sRes.json();
  console.log("Sarojini products:", sData);
}

listProducts().catch(console.error);
