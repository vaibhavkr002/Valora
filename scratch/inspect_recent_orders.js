const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

async function main() {
  const authRes = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'support@vadistudio.com', password: 'VadiSupport2026!' })
  });
  const { access_token } = await authRes.json();
  const res = await fetch(SUPABASE_URL + '/rest/v1/orders?select=id,order_number,created_at,delivery_full_name,order_status,order_items(*)&order=created_at.desc&limit=15', {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + access_token }
  });
  const orders = await res.json();
  console.log('Total orders fetched:', orders.length);
  orders.forEach((o, i) => {
    console.log(`[Order ${i+1}] ID: ${o.id}, Number: ${o.order_number}, Items count: ${o.order_items?.length}`);
    if (o.order_items?.length) {
      o.order_items.forEach(it => {
        console.log(`   -> Item: "${it.product_name}", catalog: ${it.catalog_type}, prod_id: ${it.product_id}, sar_prod_id: ${it.sarojini_product_id}, img: ${it.product_image}`);
      });
    } else {
      console.log('   -> NO ITEMS IN order_items!');
    }
  });
}
main().catch(console.error);

