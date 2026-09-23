async function testProxies() {
  const targetUrl = 'https://www.meesho.com/men-oversized-cotton-t-shirt/p/6n3h2k';
  
  // Test 1: allorigins
  try {
    console.log('Testing allorigins...');
    const r1 = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`);
    console.log('allorigins status:', r1.status);
    const text1 = await r1.text();
    console.log('allorigins length:', text1.length, text1.substring(0, 200));
  } catch (e) {
    console.log('allorigins error:', e.message);
  }

  // Test 2: corsproxy.io
  try {
    console.log('\nTesting corsproxy.io...');
    const r2 = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
    console.log('corsproxy.io status:', r2.status);
    const text2 = await r2.text();
    console.log('corsproxy.io length:', text2.length, text2.substring(0, 200));
  } catch (e) {
    console.log('corsproxy.io error:', e.message);
  }

  // Test 3: jina.ai reader
  try {
    console.log('\nTesting r.jina.ai...');
    const r3 = await fetch(`https://r.jina.ai/${targetUrl}`, {
      headers: { 'Accept': 'application/json' }
    });
    console.log('jina status:', r3.status);
    const text3 = await r3.text();
    console.log('jina length:', text3.length, text3.substring(0, 300));
  } catch (e) {
    console.log('jina error:', e.message);
  }
}

testProxies();

