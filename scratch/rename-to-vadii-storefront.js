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
  content = content.replace(/<span>VALORA<span class="dot">\.<\/span><\/span>/g, '<span>VADII<span class="dot">.</span></span>');
  content = content.replace(/aria-label="VALORA Homepage"/g, 'aria-label="VADII Homepage"');
  content = content.replace(/<span class="mobile-nav-logo-text">VALORA<\/span>/g, '<span class="mobile-nav-logo-text">VADII</span>');
  content = content.replace(/<div class="mobile-nav-brand">\s*<span>VALORA<\/span>/g, '<div class="mobile-nav-brand">\n          <span>VADII</span>');
  content = content.replace(/<div class="nav-drawer-brand">\s*<span>VALORA<\/span>/g, '<div class="nav-drawer-brand">\n          <span>VADII</span>');
  content = content.replace(/<span>VALORA<\/span>\s*<\/div>\s*<button class="nav-drawer-close"/g, '<span>VADII</span>\n      </div>\n      <button class="nav-drawer-close"');
  content = content.replace(/<span class="footer-logo">VALORA <small>Sarojini Bazaar<\/small><\/span>/g, '<span class="footer-logo">VADII <small>Sarojini Bazaar</small></span>');
  content = content.replace(/<span>VALORA<\/span>/g, '<span>VADII</span>');

  // Titles & Metas
  content = content.replace(/VALORA \| Everything\. Simply Yours\. - Modern Fashion & Lifestyle/g, 'VADII — Everything. Simply Yours. - Modern Fashion & Lifestyle');
  content = content.replace(/\| VALORA - Everything\. Simply Yours\./g, '| VADII — Everything. Simply Yours.');
  content = content.replace(/\| VALORA Online Shopping/g, '| VADII Online Shopping');
  content = content.replace(/Sarojini Bazaar — VALORA Online Shopping/g, 'Sarojini Bazaar — VADII Online Shopping');
  content = content.replace(/VALORA - Curated Fashion & Modern Living\./g, 'VADII — Curated Fashion & Modern Living.');
  content = content.replace(/Shop VALORA's curated collection/g, 'Shop VADII\'s curated collection');
  content = content.replace(/online on VALORA\./g, 'online on VADII.');
  content = content.replace(/verified reviews at VALORA\./g, 'verified reviews at VADII.');
  content = content.replace(/fashion on VALORA\./g, 'fashion on VADII.');
  content = content.replace(/View your VALORA shopping cart, review items from Main VALORA and Sarojini Bazaar/g, 'View your VADII shopping cart, review items from Main VADII and Sarojini Bazaar');
  content = content.replace(/purchase safely at VALORA\./g, 'purchase safely at VADII.');
  content = content.replace(/essentials at VALORA\./g, 'essentials at VADII.');
  content = content.replace(/Manage your VALORA profile, review your orders/g, 'Manage your VADII profile, review your orders');
  content = content.replace(/shopping with VALORA\./g, 'shopping with VADII.');
  content = content.replace(/Sign in to your VALORA account/g, 'Sign in to your VADII account');
  content = content.replace(/Create your VALORA account today/g, 'Create your VADII account today');
  content = content.replace(/Reset your VALORA account password safely\./g, 'Reset your VADII account password safely.');

  // About & Brand links
  content = content.replace(/About VALORA <span>→<\/span>/g, 'About VADII <span>→</span>');
  content = content.replace(/>About VALORA <span>/g, '>About VADII <span>');
  content = content.replace(/>About VALORA<\/a>/g, '>About VADII</a>');
  content = content.replace(/alt="VALORA Contemporary High Fashion Lookbook"/g, 'alt="VADII Contemporary High Fashion Lookbook"');
  content = content.replace(/aria-label="Enter VALORA Sarojini Bazaar Virtual Street"/g, 'aria-label="Enter VADII Sarojini Bazaar Virtual Street"');
  content = content.replace(/alt="Delhi ki Sarojini Bazaar - VALORA Collection"/g, 'alt="Delhi ki Sarojini Bazaar - VADII Collection"');
  content = content.replace(/VALORA SAROJINI BAZAAR SECTION/g, 'VADII SAROJINI BAZAAR SECTION');
  content = content.replace(/Premium Modern VALORA E-commerce/g, 'Premium Modern VADII E-commerce');
  content = content.replace(/Bazaar Wale Prices, VALORA Wali Quality/g, 'Bazaar Wale Prices, VADII Wali Quality');
  content = content.replace(/⚡ VALORA CURATED RADAR/g, '⚡ VADII CURATED RADAR');
  content = content.replace(/a VALORA experience/g, 'a VADII experience');
  content = content.replace(/Real VALORA moments/g, 'Real VADII moments');
  content = content.replace(/The VALORA Standard/g, 'The VADII Standard');
  content = content.replace(/Subscribe to the VALORA newsletter/g, 'Subscribe to the VADII newsletter');
  content = content.replace(/VALORA is an independent modern lifestyle brand bringing curated footwear, luxury timepieces, tailored apparel, and timeless accessories to discerning customers worldwide\. Everything\. Simply Yours\./g,
    'VADII is an independent modern lifestyle brand bringing curated footwear, luxury timepieces, tailored apparel, and timeless accessories to discerning customers worldwide. Everything. Simply Yours.');

  // Sarojini cross references
  content = content.replace(/<span class="brand-tagline">VALORA CURATED<\/span>/g, '<span class="brand-tagline">VADII CURATED</span>');
  content = content.replace(/title="Return to Main VALORA Store"/g, 'title="Return to Main VADII Store"');
  content = content.replace(/<span class="kicker-brand">VALORA PRESENTS<\/span>/g, '<span class="kicker-brand">VADII PRESENTS</span>');
  content = content.replace(/SAROJINI STYLE \/ VALORA LOOKS/g, 'SAROJINI STYLE / VADII LOOKS');
  content = content.replace(/WHY SHOP WITH VALORA/g, 'WHY SHOP WITH VADII');
  content = content.replace(/Why Shop With VALORA/g, 'Why Shop With VADII');
  content = content.replace(/<h4>VALORA Quality Guarantee<\/h4>/g, '<h4>VADII Quality Guarantee</h4>');
  content = content.replace(/division of VALORA India\./g, 'division of VADII India.');
  content = content.replace(/main VALORA luxury products\./g, 'main VADII luxury products.');
  content = content.replace(/main VALORA products\./g, 'main VADII products.');
  content = content.replace(/hand-inspected and verified by VALORA\./g, 'hand-inspected and verified by VADII.');
  content = content.replace(/<div class="swm-title"><span class="swm-dot">●<\/span> VALORA STORE<\/div>/g, '<div class="swm-title"><span class="swm-dot">●</span> VADII STORE</div>');
  content = content.replace(/\(PARITY WITH MAIN VALORA\)/g, '(PARITY WITH MAIN VADII)');
  content = content.replace(/\(Parity with Main VALORA\)/g, '(Parity with Main VADII)');

  // Specific copy
  content = content.replace(/Review your curated selections from Main VALORA and Sarojini Bazaar\./g, 'Review your curated selections from Main VADII and Sarojini Bazaar.');
  content = content.replace(/★ VALORA Privé Member/g, '★ VADII Privé Member');
  content = content.replace(/VALORA Member/g, 'VADII Member');
  content = content.replace(/"VALORA sets a new standard for online luxury shopping/g, '"VADII sets a new standard for online luxury shopping');
  content = content.replace(/Sign in with your verified VALORA account/g, 'Sign in with your verified VADII account');
  content = content.replace(/Become a VALORA member/g, 'Become a VADII member');
  content = content.replace(/"Joining VALORA changed the way I shop/g, '"Joining VADII changed the way I shop');
  content = content.replace(/Join VALORA and start discovering products/g, 'Join VADII and start discovering products');
  content = content.replace(/I agree to VALORA's/g, 'I agree to VADII\'s');
  content = content.replace(/Enter the email address associated with your VALORA account/g, 'Enter the email address associated with your VADII account');
  content = content.replace(/new password for your VALORA account\./g, 'new password for your VADII account.');
  content = content.replace(/<span id="detail-brand-badge" class="detail-brand-badge">VALORA Atelier<\/span>/g, '<span id="detail-brand-badge" class="detail-brand-badge">VADII Atelier</span>');

  // Coupon codes
  content = content.replace(/data-code="VELORA10"/g, 'data-code="VADII10"');
  content = content.replace(/>VELORA10</g, '>VADII10<');
  content = content.replace(/data-code="VALORA10"/g, 'data-code="VADII10"');
  content = content.replace(/>VALORA10</g, '>VADII10<');

  // Copyrights
  content = content.replace(/© 2026 VALORA Inc\. All rights reserved\./g, '© 2026 VADII Inc. All rights reserved.');
  content = content.replace(/&copy; 2026 VALORA Inc\. All rights reserved\./g, '&copy; 2026 VADII Inc. All rights reserved.');
  content = content.replace(/&copy; 2026 VALORA\. Everything\. Simply Yours\./g, '&copy; 2026 VADII. Everything. Simply Yours.');
  content = content.replace(/&copy; 2026 VALORA\. Sarojini Bazaar/g, '&copy; 2026 VADII. Sarojini Bazaar');

  // Fallbacks for any remaining VALORA / Valora in text
  content = content.replace(/\bVALORA STORE\b/g, 'VADII STORE');
  content = content.replace(/\bValora Store\b/g, 'Vadii Store');
  content = content.replace(/\bVALORA\b/g, 'VADII');
  content = content.replace(/\bValora\b/g, 'Vadii');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', relPath);
  } else {
    console.log('Unchanged:', relPath);
  }
}

storefrontFiles.forEach(updateFile);
