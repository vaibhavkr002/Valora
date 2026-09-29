const fs = require('fs');
const path = require('path');

const ROOT = 'c:\\Users\\saanv\\OneDrive\\Desktop\\Website\\webu';

const storefrontFiles = [
  'index.html',
  'homepage.html',
  'shop.html',
  'product.html',
  'cart.html',
  'checkout.html',
  'wishlist.html',
  'account.html',
  'order-success.html',
  'login.html',
  'signup.html',
  'forgot-password.html',
  'deals.html',
  'bogo.html',
  'trending.html',
  'new-arrivals.html',
  'sarojini-bazaar.html',
  'sarojini-shop.html',
  'sarojini-product-details.html'
];

function updateFile(relPath) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Header & Logo text
  content = content.replace(/<span>VADI<span class="dot">\.<\/span><\/span>/g, '<span>VALORA<span class="dot">.</span></span>');
  content = content.replace(/aria-label="VADI Homepage"/g, 'aria-label="VALORA Homepage"');
  content = content.replace(/<span class="mobile-nav-logo-text">VADI<\/span>/g, '<span class="mobile-nav-logo-text">VALORA</span>');
  content = content.replace(/<div class="mobile-nav-brand">\s*<span>VADI<\/span>/g, '<div class="mobile-nav-brand">\n          <span>VALORA</span>');
  content = content.replace(/<div class="nav-drawer-brand">\s*<span>VADI<\/span>/g, '<div class="nav-drawer-brand">\n          <span>VALORA</span>');
  content = content.replace(/<span>VADI<\/span>\s*<\/div>\s*<button class="nav-drawer-close"/g, '<span>VALORA</span>\n      </div>\n      <button class="nav-drawer-close"');
  content = content.replace(/<span class="footer-logo">VADI <small>Sarojini Bazaar<\/small><\/span>/g, '<span class="footer-logo">VALORA <small>Sarojini Bazaar</small></span>');

  // Titles & Metas
  content = content.replace(/<title>VADI \| Everything\. Simply Yours\. - Modern Fashion & Lifestyle<\/title>/g, '<title>VALORA | Everything. Simply Yours. - Modern Fashion & Lifestyle</title>');
  content = content.replace(/<title>(.*?) \| VADI - Everything\. Simply Yours\.<\/title>/g, '<title>$1 | VALORA - Everything. Simply Yours.</title>');
  content = content.replace(/<title>(.*?) \| VADI Online Shopping<\/title>/g, '<title>$1 | VALORA Online Shopping</title>');
  content = content.replace(/<title>Sarojini Bazaar — VADI Online Shopping<\/title>/g, '<title>Sarojini Bazaar — VALORA Online Shopping</title>');
  content = content.replace(/content="VADI - Curated Fashion & Modern Living\./g, 'content="VALORA - Curated Fashion & Modern Living.');
  content = content.replace(/content="Shop VADI's curated collection/g, 'content="Shop VALORA\'s curated collection');
  content = content.replace(/content="Shop Delhi's famous Sarojini Nagar market online on VADI\./g, 'content="Shop Delhi\'s famous Sarojini Nagar market online on VALORA.');
  content = content.replace(/content="View product details, specifications, high-resolution imagery, and verified reviews at VADI\./g, 'content="View product details, specifications, high-resolution imagery, and verified reviews at VALORA.');
  content = content.replace(/content="View product specifications, sizes, prices, and high-resolution photos for Sarojini Bazaar fashion on VADI\./g, 'content="View product specifications, sizes, prices, and high-resolution photos for Sarojini Bazaar fashion on VALORA.');
  content = content.replace(/content="View your VADI shopping cart, review items from Main VADI and Sarojini Bazaar/g, 'content="View your VALORA shopping cart, review items from Main VALORA and Sarojini Bazaar');
  content = content.replace(/content="Secure Checkout - Complete your luxury fashion and lifestyle purchase safely at VADI\./g, 'content="Secure Checkout - Complete your luxury fashion and lifestyle purchase safely at VALORA.');
  content = content.replace(/content="View your saved products and favorite luxury essentials at VADI\./g, 'content="View your saved products and favorite luxury essentials at VALORA.');
  content = content.replace(/content="Manage your VADI profile, review your orders/g, 'content="Manage your VALORA profile, review your orders');
  content = content.replace(/content="Order Confirmed - Thank you for shopping with VADI\./g, 'content="Order Confirmed - Thank you for shopping with VALORA.');
  content = content.replace(/content="Sign in to your VADI account/g, 'content="Sign in to your VALORA account');
  content = content.replace(/content="Create your VADI account today/g, 'content="Create your VALORA account today');
  content = content.replace(/content="Reset your VADI account password safely\./g, 'content="Reset your VALORA account password safely.');

  // About & Brand links
  content = content.replace(/About VADI <span>→<\/span>/g, 'About VALORA <span>→</span>');
  content = content.replace(/>About VADI <span>/g, '>About VALORA <span>');
  content = content.replace(/>About VADI<\/a>/g, '>About VALORA</a>');
  content = content.replace(/alt="VADI Contemporary High Fashion Lookbook"/g, 'alt="VALORA Contemporary High Fashion Lookbook"');
  content = content.replace(/aria-label="Enter VADI Sarojini Bazaar Virtual Street"/g, 'aria-label="Enter VALORA Sarojini Bazaar Virtual Street"');
  content = content.replace(/alt="Delhi ki Sarojini Bazaar - VADI Collection"/g, 'alt="Delhi ki Sarojini Bazaar - VALORA Collection"');
  content = content.replace(/Bazaar Wale Prices, VADI Wali Quality/g, 'Bazaar Wale Prices, VALORA Wali Quality');
  content = content.replace(/⚡ VADI CURATED RADAR/g, '⚡ VALORA CURATED RADAR');
  content = content.replace(/a VADI experience/g, 'a VALORA experience');
  content = content.replace(/Real VADI moments/g, 'Real VALORA moments');
  content = content.replace(/The VADI Standard/g, 'The VALORA Standard');
  content = content.replace(/Subscribe to the VADI newsletter/g, 'Subscribe to the VALORA newsletter');
  content = content.replace(/VADI is an independent modern lifestyle brand bringing curated footwear, luxury timepieces, tailored apparel, and timeless accessories to discerning customers worldwide\. Everything\. Simply Yours\./g,
    'VALORA is an independent modern lifestyle brand bringing curated footwear, luxury timepieces, tailored apparel, and timeless accessories to discerning customers worldwide. Everything. Simply Yours.');

  // Sarojini cross references
  content = content.replace(/<span class="brand-tagline">VADI CURATED<\/span>/g, '<span class="brand-tagline">VALORA CURATED</span>');
  content = content.replace(/title="Return to Main VADI Store"/g, 'title="Return to Main VALORA Store"');
  content = content.replace(/<span class="kicker-brand">VADI PRESENTS<\/span>/g, '<span class="kicker-brand">VALORA PRESENTS</span>');
  content = content.replace(/SAROJINI STYLE \/ VADI LOOKS/g, 'SAROJINI STYLE / VALORA LOOKS');
  content = content.replace(/WHY SHOP WITH VADI/g, 'WHY SHOP WITH VALORA');
  content = content.replace(/Why Shop With VADI/g, 'Why Shop With VALORA');
  content = content.replace(/<h4>VADI Quality Guarantee<\/h4>/g, '<h4>VALORA Quality Guarantee</h4>');
  content = content.replace(/division of VADI India\./g, 'division of VALORA India.');
  content = content.replace(/main VADI luxury products\./g, 'main VALORA luxury products.');
  content = content.replace(/main VADI products\./g, 'main VALORA products.');
  content = content.replace(/hand-inspected and verified by VADI\./g, 'hand-inspected and verified by VALORA.');
  content = content.replace(/<div class="swm-title"><span class="swm-dot">●<\/span> VADI STORE<\/div>/g, '<div class="swm-title"><span class="swm-dot">●</span> VALORA STORE</div>');

  // Specific copy
  content = content.replace(/Review your curated selections from Main VADI and Sarojini Bazaar\./g, 'Review your curated selections from Main VALORA and Sarojini Bazaar.');
  content = content.replace(/★ VADI Privé Member/g, '★ VALORA Privé Member');
  content = content.replace(/VADI Member/g, 'VALORA Member');
  content = content.replace(/"VADI sets a new standard for online luxury shopping/g, '"VALORA sets a new standard for online luxury shopping');
  content = content.replace(/Sign in with your verified VADI account/g, 'Sign in with your verified VALORA account');
  content = content.replace(/Become a VADI member/g, 'Become a VALORA member');
  content = content.replace(/"Joining VADI changed the way I shop/g, '"Joining VALORA changed the way I shop');
  content = content.replace(/Join VADI and start discovering products/g, 'Join VALORA and start discovering products');
  content = content.replace(/I agree to VADI's/g, 'I agree to VALORA\'s');
  content = content.replace(/Enter the email address associated with your VADI account/g, 'Enter the email address associated with your VALORA account');
  content = content.replace(/new password for your VADI account\./g, 'new password for your VALORA account.');
  content = content.replace(/<span id="detail-brand-badge" class="detail-brand-badge">VADI Atelier<\/span>/g, '<span id="detail-brand-badge" class="detail-brand-badge">VALORA Atelier</span>');

  // Copyrights
  content = content.replace(/© 2026 VADI Inc\. All rights reserved\./g, '© 2026 VALORA Inc. All rights reserved.');
  content = content.replace(/&copy; 2026 VADI Inc\. All rights reserved\./g, '&copy; 2026 VALORA Inc. All rights reserved.');
  content = content.replace(/&copy; 2026 VADI\. Everything\. Simply Yours\./g, '&copy; 2026 VALORA. Everything. Simply Yours.');
  content = content.replace(/&copy; 2026 VADI\. Sarojini Bazaar/g, '&copy; 2026 VALORA. Sarojini Bazaar');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', relPath);
  } else {
    console.log('Unchanged:', relPath);
  }
}

storefrontFiles.forEach(updateFile);

