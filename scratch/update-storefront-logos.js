const fs = require('fs');

const files = [
  'index.html', 'homepage.html', 'shop.html', 'product.html', 'cart.html',
  'checkout.html', 'wishlist.html', 'account.html', 'order-success.html',
  'login.html', 'signup.html', 'forgot-password.html', 'deals.html',
  'bogo.html', 'trending.html', 'new-arrivals.html', 'about.html', 'contact.html',
  'contact-support.html', 'faq.html', 'privacy-policy.html', 'terms-conditions.html',
  'shipping-policy.html', 'returns-exchanges.html', 'careers.html', 'affiliate-program.html',
  'press-media.html', 'sustainability.html', 'size-guide.html',
  'sarojini-bazaar.html', 'sarojini-shop.html', 'sarojini-product-details.html'
];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let c = fs.readFileSync(f, 'utf8');
  let orig = c;

  // brand logos
  c = c.replace(/<span>VADI<\/span>/g, '<span>VALORA</span>');

  // specific to about.html
  c = c.replace(/behind VADI —/g, 'behind VALORA —');
  c = c.replace(/The VADI Heritage/g, 'The VALORA Heritage');
  c = c.replace(/precision, VADI bridges/g, 'precision, VALORA bridges');
  c = c.replace(/About VADI/g, 'About VALORA');
  c = c.replace(/<strong>VADI<\/strong>/g, '<strong>VALORA</strong>');
  c = c.replace(/accessory on VADI is/g, 'accessory on VALORA is');
  c = c.replace(/Explore VADI Collections →/g, 'Explore VALORA Collections →');

  // specific to contact.html
  c = c.replace(/Redirecting to VADI Support\.\.\./g, 'Redirecting to VALORA Support...');
  c = c.replace(/Connecting to VADI 24\/7 Concierge Support\.\.\./g, 'Connecting to VALORA 24/7 Concierge Support...');

  if (c !== orig) {
    fs.writeFileSync(f, c, 'utf8');
    console.log('Updated:', f);
  }
});

