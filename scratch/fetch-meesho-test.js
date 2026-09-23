const fs = require('fs');

async function testFetchMeesho() {
  const url = 'https://www.meesho.com/men-oversized-cotton-t-shirt/p/6n3h2k';
  console.log('Fetching', url);
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    console.log('Status:', resp.status, resp.statusText);
    const html = await resp.text();
    console.log('HTML Length:', html.length);
    fs.writeFileSync('scratch/meesho-sample.html', html);

    // 1. JSON-LD
    const jsonLdRegex = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      console.log('Found JSON-LD block:');
      try {
        const parsed = JSON.parse(match[1]);
        console.log(JSON.stringify(parsed, null, 2).substring(0, 500));
      } catch (e) {
        console.log('Raw JSON-LD:', match[1].substring(0, 200));
      }
    }

    // 2. OpenGraph
    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
    const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
    const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i);
    console.log('OG Title:', ogTitle ? ogTitle[1] : null);
    console.log('OG Image:', ogImage ? ogImage[1] : null);
    console.log('OG Desc:', ogDesc ? ogDesc[1] : null);

    // 3. __NEXT_DATA__
    const nextDataMatch = html.match(/<script\s+id=["']__NEXT_DATA__["']\s+type=["']application\/json["']>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      console.log('Found __NEXT_DATA__!');
      const nextData = JSON.parse(nextDataMatch[1]);
      fs.writeFileSync('scratch/meesho-nextdata.json', JSON.stringify(nextData, null, 2));
      console.log('Saved __NEXT_DATA__ to scratch/meesho-nextdata.json');
      console.log('Keys in pageProps:', Object.keys(nextData.props?.pageProps || {}));
    } else {
      console.log('No __NEXT_DATA__ script found.');
    }

  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testFetchMeesho();

