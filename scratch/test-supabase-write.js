const https = require('https');

const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

async function testWrite() {
  const payload = JSON.stringify([{
    id: 'a0000000-0000-4000-a000-000000000001',
    section_type: 'product_grid',
    title: 'Test Anonymous Write',
    display_order: 99,
    is_active: true
  }]);

  const url = new URL('/rest/v1/homepage_sections', SUPABASE_PROJECT_URL);
  const options = {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = https.request(url, options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('HTTP Status:', res.statusCode);
      console.log('Response Body:', body);
    });
  });

  req.on('error', (e) => {
    console.error('Request Error:', e);
  });

  req.write(payload);
  req.end();
}

testWrite();

