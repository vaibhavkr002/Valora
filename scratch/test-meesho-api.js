async function testMeeshoApi() {
  const pidSlug = '6n3h2k';
  const numericId = parseInt(pidSlug, 36);
  console.log('Numeric ID:', numericId);

  const endpoints = [
    `https://www.meesho.com/api/v1/products/${pidSlug}`,
    `https://www.meesho.com/api/v1/products/${numericId}`,
    `https://api.meesho.com/v1/products/${numericId}`,
    `https://supplier.meesho.com/api/v1/products/${numericId}`
  ];

  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });
      console.log(ep, 'status:', r.status);
      if (r.ok) {
        const text = await r.text();
        console.log('Response:', text.substring(0, 300));
      }
    } catch (e) {
      console.log(ep, 'error:', e.message);
    }
  }
}

testMeeshoApi();

