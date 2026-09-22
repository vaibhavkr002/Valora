const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

async function testOrderColumns() {
  console.log("=== TESTING ORDERS COLUMNS ===");

  const candidateCols = [
    "transaction_reference",
    "coupon_code",
    "idempotency_key",
    "delivery_preference",
    "free_gifts_eligible",
    "free_gifts_items",
    "is_full_online_payment"
  ];

  for (const c of candidateCols) {
    const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/orders?select=${c}&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    console.log(`Column orders.${c}: status ${res.status}`);
  }
}

testOrderColumns().catch(console.error);

