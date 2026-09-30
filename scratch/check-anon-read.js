const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

async function checkInsertedOrder() {
  const orderId = "e3149f79-1ca2-473c-934f-e75adc2c9763";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}&select=*,order_items(*)`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  const data = await res.json();
  console.log("Query status with anon key:", res.status);
  console.log("Data count:", data.length);
}

checkInsertedOrder().catch(console.error);
