const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

async function check() {
  const prodRes = await fetch(SUPABASE_URL + '/rest/v1/sarojini_products?is_active=eq.true&order=created_at.desc', {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
  });
  const data = await prodRes.json();
  console.log('Total products:', data.length);
  data.forEach(p => {
    if (Array.isArray(p.images) && p.images.length > 1) {
      console.log('\nID:', p.id, '| Name:', p.name);
      console.log('Images (' + p.images.length + '):', p.images);
    }
  });
}

check();

