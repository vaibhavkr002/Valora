const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

async function listAll() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sarojini_products?select=id,name,department,price,original_price,is_featured,is_active,images&order=created_at.asc`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  const data = await res.json();
  console.log(`Total sarojini_products: ${data.length}`);
  data.forEach((p, idx) => {
    console.log(`${idx + 1}. [${p.id}] ${p.name} (${p.department}) - ₹${p.price} (orig ₹${p.original_price}) | active: ${p.is_active} | featured: ${p.is_featured} | img: ${JSON.stringify(p.images)}`);
  });
}

listAll();

