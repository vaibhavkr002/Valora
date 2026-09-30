const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

async function checkOrders() {
  console.log("Checking Supabase orders table with anon key...");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc&limit=10`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  console.log("Response status:", res.status);
  const data = await res.json();
  console.log("Orders count returned with anon key:", Array.isArray(data) ? data.length : data);
  if (Array.isArray(data) && data.length > 0) {
    console.log("Latest order sample:", JSON.stringify(data[0], null, 2));
  }

  // Also check order_items
  const itemsRes = await fetch(`${SUPABASE_URL}/rest/v1/order_items?select=*&limit=10`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  console.log("order_items response status:", itemsRes.status);
  const itemsData = await itemsRes.json();
  console.log("order_items count returned:", Array.isArray(itemsData) ? itemsData.length : itemsData);
}

checkOrders().catch(console.error);
