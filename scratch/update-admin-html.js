const fs = require('fs');
const path = require('path');

const adminDir = path.join(process.cwd(), 'admin');

fs.readdirSync(adminDir).forEach(f => {
  if (f.endsWith('.html')) {
    const fullPath = path.join(adminDir, f);
    let c = fs.readFileSync(fullPath, 'utf8');
    const orig = c;

    // Titles
    c = c.replace(/<title>(.*?) \| VADI Admin<\/title>/g, '<title>$1 | VALORA Admin</title>');
    c = c.replace(/<title>Admin Portal \| VADI Luxury Fashion<\/title>/g, '<title>Admin Portal | VALORA Luxury Fashion</title>');
    c = c.replace(/<title>Redirecting to Advertisements \| VADI Admin<\/title>/g, '<title>Redirecting to Advertisements | VALORA Admin</title>');

    // Logos & Navigation
    c = c.replace(/<a href="dashboard\.html" class="sidebar-logo">VADI<\/a>/g, '<a href="dashboard.html" class="sidebar-logo">VALORA</a>');
    c = c.replace(/<a href="dashboard\.html">VADI Admin<\/a>/g, '<a href="dashboard.html">VALORA Admin</a>');
    c = c.replace(/<h1>VADI<\/h1>/g, '<h1>VALORA</h1>');
    c = c.replace(/Sign in with verified VADI administrator credentials/g, 'Sign in with verified VALORA administrator credentials');
    c = c.replace(/Return to VADI Customer Storefront/g, 'Return to VALORA Customer Storefront');
    c = c.replace(/Redirecting to VADI Advertisements/g, 'Redirecting to VALORA Advertisements');

    // Storefront and Store naming
    c = c.replace(/Main VADI Store/g, 'Main VALORA Store');
    c = c.replace(/Main VADI Only/g, 'Main VALORA Only');
    c = c.replace(/Main VADI product/g, 'Main VALORA product');
    c = c.replace(/Main VADI catalog/g, 'Main VALORA catalog');
    c = c.replace(/Main VADI Storefront/g, 'Main VALORA Storefront');
    c = c.replace(/Main VADI/g, 'Main VALORA');
    c = c.replace(/VADI storefront/g, 'VALORA storefront');
    c = c.replace(/VADI Sarojini Bazaar/g, 'VALORA Sarojini Bazaar');
    c = c.replace(/VADI Luxury Fashion/g, 'VALORA Luxury Fashion');
    c = c.replace(/VADI Lifestyle Studio/g, 'VALORA Lifestyle Studio');

    // Watermarks
    c = c.replace(/VADI STORE Watermark/g, 'VALORA STORE Watermark');
    c = c.replace(/VADI STORE watermark/g, 'VALORA STORE watermark');
    c = c.replace(/Final VADI Watermarked/g, 'Final VALORA Watermarked');
    c = c.replace(/● VADI STORE Watermark Applied/g, '● VALORA STORE Watermark Applied');

    // Coupon code placeholders (keep as VALORA or VALORA10 / VALORA20)
    c = c.replace(/placeholder="e\.g\. VADI10"/g, 'placeholder="e.g. VALORA10"');
    c = c.replace(/placeholder="e\.g\. VADI20"/g, 'placeholder="e.g. VALORA20"');

    if (c !== orig) {
      fs.writeFileSync(fullPath, c, 'utf8');
      console.log('Updated: admin/' + f);
    }
  }
});

