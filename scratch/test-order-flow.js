const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

async function testOrderFlow() {
  console.log("=== TESTING FULL ORDER INSERTION & RETRIEVAL FLOW ===");

  // 1. Authenticate test customer
  const testEmail = "test_customer_audit@vadi.com";
  const testPass = "VadiTest1234!";

  const lRes = await fetch(`${SUPABASE_PROJECT_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPass })
  });
  const lData = await lRes.json();
  const token = lData.access_token;
  const user = lData.user;
  console.log("Authenticated as:", user.id);

  // 2. Insert test order
  const orderNum = "TEST-ORD-" + Date.now();
  const orderPayload = {
    user_id: user.id,
    order_number: orderNum,
    subtotal: 999,
    discount: 0,
    shipping_charge: 0,
    tax: 0,
    total: 999,
    payment_method: "Cash on Delivery",
    payment_status: "pending",
    order_status: "placed",
    advance_amount: 0,
    advance_paid: 0,
    cod_balance: 999,
    advance_payment_status: "not_required",
    cod_payment_status: "pending",
    delivery_full_name: "Audit Tester",
    delivery_phone: "+91 98765 43210",
    delivery_address: "123 Market Street",
    delivery_city: "New Delhi",
    delivery_state: "Delhi",
    delivery_country: "India",
    delivery_pincode: "110023",
    estimated_delivery: "3-5 Days"
  };

  const oRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/orders`, {
    method: "POST",
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify([orderPayload])
  });

  const oData = await oRes.json();
  console.log("Order Insert Status:", oRes.status);
  if (oRes.status !== 201) {
    console.error("Order insert error:", oData);
    return;
  }

  const createdOrder = oData[0];
  console.log("Created order ID:", createdOrder.id);

  // 3. Insert order item
  const itemPayload = {
    order_id: createdOrder.id,
    product_id: null,
    catalog_type: "sarojini",
    sarojini_product_id: null,
    product_name: "Sarojini Vintage Graphic Tee",
    product_image: "assets/sarojni/prod-1-graphic-tee.png",
    price: 999,
    quantity: 1,
    selected_size: "M",
    selected_color: "Black",
    subtotal: 999,
    advance_amount: 0,
    cod_balance: 999,
    advance_payment_enabled: false
  };

  const itRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/order_items`, {
    method: "POST",
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify([itemPayload])
  });

  const itData = await itRes.json();
  console.log("Item Insert Status:", itRes.status);
  if (itRes.status !== 201) {
    console.error("Item insert error:", itData);
  } else {
    console.log("Created item ID:", itData[0].id);
  }

  // 4. Fetch orders for customer using the fixed query
  const fixedOrderCols = "id,order_number,total,subtotal,discount,shipping_charge,payment_method,payment_status,order_status,advance_amount,advance_paid,cod_balance,delivery_preference,free_gifts_eligible,free_gifts_items,is_full_online_payment,estimated_delivery,tracking_data,created_at,order_items(id,product_name,product_image,price,quantity,selected_size,selected_color,subtotal,catalog_type,sarojini_product_id,advance_amount,cod_balance)";

  const fRes = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/orders?select=${encodeURIComponent(fixedOrderCols)}&user_id=eq.${user.id}`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    }
  });

  console.log("Customer Fetch Orders Status:", fRes.status);
  const fetchedOrders = await fRes.json();
  console.log("Fetched Orders Count:", fetchedOrders.length);
  if (fetchedOrders.length > 0) {
    console.log("First Order Number:", fetchedOrders[0].order_number);
    console.log("First Order Items Count:", fetchedOrders[0].order_items?.length);
    console.log("First Order Item Name:", fetchedOrders[0].order_items?.[0]?.product_name);
    console.log("First Order Item Catalog:", fetchedOrders[0].order_items?.[0]?.catalog_type);
  }
}

testOrderFlow().catch(console.error);

