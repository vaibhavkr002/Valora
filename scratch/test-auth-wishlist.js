const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

async function testAuthWishlist() {
  console.log("=== TESTING AUTH & WISHLIST INSERT ===");

  // 1. Sign in or sign up a test customer
  const testEmail = "test_customer_audit@vadi.com";
  const testPass = "VadiTest1234!";

  let token = null;
  let user = null;

  // Try login
  let res = await fetch(`${SUPABASE_PROJECT_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: testEmail, password: testPass })
  });

  let data = await res.json();
  if (data.access_token) {
    token = data.access_token;
    user = data.user;
    console.log("Logged in existing test user:", user.id);
  } else {
    // Try sign up
    res = await fetch(`${SUPABASE_PROJECT_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPass,
        data: { full_name: "Audit Test Customer" }
      })
    });
    data = await res.json();
    if (data.access_token) {
      token = data.access_token;
      user = data.user;
      console.log("Created test user with token:", user.id);
    } else if (data.id) {
      user = data;
      console.log("Signed up user, attempting login...");
      const lRes = await fetch(`${SUPABASE_PROJECT_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: testPass })
      });
      const lData = await lRes.json();
      token = lData.access_token;
      console.log("Login token acquired:", Boolean(token));
    }
  }

  if (!token) {
    console.error("Could not authenticate test user:", data);
    return;
  }

  // 2. Test inserting into wishlist with null product_id (Sarojini product)
  console.log("\n--- INSERTING SAROJINI PRODUCT INTO WISHLIST ---");
  const wishInsertRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/wishlist`, {
    method: "POST",
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      user_id: user.id,
      catalog_type: "sarojini",
      product_id: null,
      sarojini_product_id: "00000000-0000-0000-0000-000000000001"
    })
  });

  const wishInsertData = await wishInsertRes.json();
  console.log("Sarojini Wishlist Insert Status:", wishInsertRes.status);
  console.log("Sarojini Wishlist Insert Response:", wishInsertData);

  // 3. Test querying customer orders with token
  console.log("\n--- QUERYING CUSTOMER ORDERS WITH FIXED QUERY ---");
  const fixedOrderCols = "id,order_number,total,subtotal,discount,shipping_charge,payment_method,payment_status,order_status,advance_amount,advance_paid,cod_balance,delivery_preference,free_gifts_eligible,free_gifts_items,is_full_online_payment,estimated_delivery,tracking_data,created_at,order_items(id,product_name,product_image,price,quantity,selected_size,selected_color,subtotal,catalog_type,sarojini_product_id,advance_amount,cod_balance)";

  const ordersRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/orders?select=${encodeURIComponent(fixedOrderCols)}&user_id=eq.${user.id}`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    }
  });
  console.log("Orders query status:", ordersRes.status);
  const ordersData = await ordersRes.json();
  console.log("Orders query result:", ordersData);
}

testAuthWishlist().catch(console.error);

