

const fs = require('fs');
const path = require('path');

const ROOT = 'c:\\Users\\saanv\\OneDrive\\Desktop\\Website\\webu';

const policyFiles = [
  'about.html',
  'contact.html',
  'contact-support.html',
  'faq.html',
  'privacy-policy.html',
  'terms-conditions.html',
  'shipping-policy.html',
  'returns-exchanges.html',
  'careers.html',
  'affiliate-program.html',
  'press-media.html',
  'sustainability.html',
  'size-guide.html'
];

function updateFile(relPath) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Header & Logo text
  content = content.replace(/<span>VALORA<span class="dot">\.<\/span><\/span>/g, '<span>VADII<span class="dot">.</span></span>');
  content = content.replace(/aria-label="VALORA Homepage"/g, 'aria-label="VADII Homepage"');
  content = content.replace(/<div class="brand-icon">V<\/div>\s*<span>VALORA<\/span>/g, '<div class="brand-icon">V</div>\n            <span>VADII</span>');
  content = content.replace(/<div class="brand-icon">V<\/div>\s*<span>VALORA<\/span>/g, '<div class="brand-icon">V</div>\n          <span>VADII</span>');
  content = content.replace(/<span>VALORA<\/span>/g, '<span>VADII</span>');

  // Titles & Metas
  content = content.replace(/VALORA \| Everything\. Simply Yours\. - Modern Fashion & Lifestyle/g, 'VADII — Everything. Simply Yours. - Modern Fashion & Lifestyle');
  content = content.replace(/\| VALORA - Everything\. Simply Yours\./g, '| VADII — Everything. Simply Yours.');
  content = content.replace(/VALORA Affiliate Program \| VALORA - Everything\. Simply Yours\./g, 'VADII Affiliate Program | VADII — Everything. Simply Yours.');
  content = content.replace(/content="VALORA (.*?)"/g, 'content="VADII $1"');
  content = content.replace(/content="Careers at VALORA:/g, 'content="Careers at VADII:');
  content = content.replace(/content="Join the VALORA Affiliate Partner Program:/g, 'content="Join the VADII Affiliate Partner Program:');

  // Hero & Subtitles
  content = content.replace(/Careers at VALORA/g, 'Careers at VADII');
  content = content.replace(/VADII Affiliate Program/g, 'VADII Affiliate Program');
  content = content.replace(/The VALORA Narrative/g, 'The VADII Narrative');
  content = content.replace(/from the VALORA design studio\./g, 'from the VADII design studio.');
  content = content.replace(/Why Join the VALORA Team\?/g, 'Why Join the VADII Team?');
  content = content.replace(/excited to contribute to VALORA\?/g, 'excited to contribute to VADII?');
  content = content.replace(/favorite VALORA shoes/g, 'favorite VADII shoes');
  content = content.replace(/applying to the VALORA Affiliate Program/g, 'applying to the VADII Affiliate Program');
  content = content.replace(/plan to feature VALORA items/g, 'plan to feature VADII items');
  content = content.replace(/Founded in 2026, VALORA is/g, 'Founded in 2026, VADII is');
  content = content.replace(/"VALORA represents/g, '"VADII represents');
  content = content.replace(/chronographs, VALORA proves/g, 'chronographs, VADII proves');
  content = content.replace(/At VALORA,/g, 'At VADII,');
  content = content.replace(/Launch the VALORA "Pre-Loved"/g, 'Launch the VADII "Pre-Loved"');
  content = content.replace(/VALORA footwear/g, 'VADII footwear');
  content = content.replace(/All VALORA timepieces/g, 'All VADII timepieces');
  content = content.replace(/Returning an item with VALORA/g, 'Returning an item with VADII');
  content = content.replace(/VALORA \("we", "our", or "us"\)/g, 'VADII ("we", "our", or "us")');
  content = content.replace(/using the VALORA website/g, 'using the VADII website');
  content = content.replace(/for a VALORA member account/g, 'for a VADII member account');
  content = content.replace(/VALORA never stores/g, 'VADII never stores');
  content = content.replace(/When accessing VALORA,/g, 'When accessing VADII,');
  content = content.replace(/VALORA utilizes modern/g, 'VADII utilizes modern');
  content = content.replace(/within VALORA is used/g, 'within VADII is used');
  content = content.replace(/VALORA does not monetize/g, 'VADII does not monetize');
  content = content.replace(/controls on VALORA\./g, 'controls on VADII.');
  content = content.replace(/VALORA is designed/g, 'VADII is designed');
  content = content.replace(/access to the VALORA digital platform\./g, 'access to the VADII digital platform.');
  content = content.replace(/utilizing the VALORA e-commerce website/g, 'utilizing the VADII e-commerce website');
  content = content.replace(/member account on VALORA\./g, 'member account on VADII.');
  content = content.replace(/When using VALORA,/g, 'When using VADII,');
  content = content.replace(/property of VALORA Inc\./g, 'property of VADII Inc.');
  content = content.replace(/third-party sites \(e\.g\. social platforms\)\. VALORA assumes/g, 'third-party sites (e.g. social platforms). VADII assumes');
  content = content.replace(/THE VALORA SITE/g, 'THE VADII SITE');
  content = content.replace(/APPLICABLE LAW, VALORA DISCLAIMS/g, 'APPLICABLE LAW, VADII DISCLAIMS');
  content = content.replace(/All orders placed on VALORA/g, 'All orders placed on VADII');
  content = content.replace(/VALORA offers <strong>/g, 'VADII offers <strong>');
  content = content.replace(/VALORA proudly ships/g, 'VADII proudly ships');

  // About specific
  content = content.replace(/behind VALORA —/g, 'behind VADII —');
  content = content.replace(/The VALORA Heritage/g, 'The VADII Heritage');
  content = content.replace(/precision, VALORA bridges/g, 'precision, VADII bridges');
  content = content.replace(/About VALORA/g, 'About VADII');
  content = content.replace(/<strong>VALORA<\/strong>/g, '<strong>VADII</strong>');
  content = content.replace(/accessory on VALORA is/g, 'accessory on VADII is');
  content = content.replace(/Explore VALORA Collections →/g, 'Explore VADII Collections →');

  // Contact specific
  content = content.replace(/Redirecting to VALORA Support\.\.\./g, 'Redirecting to VADII Support...');
  content = content.replace(/Connecting to VALORA 24\/7 Concierge Support\.\.\./g, 'Connecting to VADII 24/7 Concierge Support...');
  content = content.replace(/Contact VALORA Customer Support/g, 'Contact VADII Customer Support');
  content = content.replace(/VALORA Lifestyle Studio:/g, 'VADII Lifestyle Studio:');

  // FAQ specific
  content = content.replace(/free VALORA member account/g, 'free VADII member account');
  content = content.replace(/Yes! VALORA delivers worldwide/g, 'Yes! VADII delivers worldwide');

  // Coupon codes
  content = content.replace(/data-code="VELORA10"/g, 'data-code="VADII10"');
  content = content.replace(/>VELORA10</g, '>VADII10<');
  content = content.replace(/data-code="VALORA10"/g, 'data-code="VADII10"');
  content = content.replace(/>VALORA10</g, '>VADII10<');
  content = content.replace(/VELORA10<\/code>/g, 'VADII10</code>');

  // Brand description & Copyright
  content = content.replace(/VALORA is an independent modern lifestyle brand bringing curated footwear, luxury timepieces, tailored apparel, and timeless accessories to discerning customers worldwide\. Everything\. Simply Yours\./g,
    'VADII is an independent modern lifestyle brand bringing curated footwear, luxury timepieces, tailored apparel, and timeless accessories to discerning customers worldwide. Everything. Simply Yours.');
  content = content.replace(/© 2026 VALORA Inc\. All rights reserved\./g, '© 2026 VADII Inc. All rights reserved.');
  content = content.replace(/&copy; 2026 VALORA Inc\. All rights reserved\./g, '&copy; 2026 VADII Inc. All rights reserved.');

  // Catch-all
  content = content.replace(/\bVALORA STORE\b/gi, 'VADII Store');
  content = content.replace(/\bValora Store\b/gi, 'VADII Store');
  content = content.replace(/\bVALORA\b/gi, 'VADII');
  content = content.replace(/\bValora\b/gi, 'VADII');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', relPath);
  } else {
    console.log('Unchanged:', relPath);
  }
}

policyFiles.forEach(updateFile);
