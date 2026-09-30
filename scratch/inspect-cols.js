const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

async function inspectColumns() {
  const testEmail = "testuser" + Math.floor(Math.random() * 10000) + "@vadii-test.com";
  const testPass = "VadiiSecurePass123!";

  const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPass })
  });
  const { access_token: token, user } = await signupRes.json();

  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&limit=1`, {
    headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
  });

  console.log("Status:", res.status);
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) {
    console.log("Orders table actual columns:", Object.keys(data[0]));
  } else {
    console.log("No orders found, data:", data);
  }
}

inspectColumns().catch(console.error);
