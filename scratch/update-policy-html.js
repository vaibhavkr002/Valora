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
  content = content.replace(/<span>VADI<span class="dot">\.<\/span><\/span>/g, '<span>VALORA<span class="dot">.</span></span>');
  content = content.replace(/aria-label="VADI Homepage"/g, 'aria-label="VALORA Homepage"');
  content = content.replace(/<div class="brand-icon">V<\/div>\s*<span>VADI<\/span>/g, '<div class="brand-icon">V</div>\n          <span>VALORA</span>');
  content = content.replace(/<div class="brand-icon">V<\/div>\s*<span>VADI<\/span>/g, '<div class="brand-icon">V</div>\n            <span>VALORA</span>');
  content = content.replace(/<span>VADI<\/span>/g, '<span>VALORA</span>');

  // Titles & Metas
  content = content.replace(/<title>(.*?) \| VADI - Everything\. Simply Yours\.<\/title>/g, '<title>$1 | VALORA - Everything. Simply Yours.</title>');
  content = content.replace(/<title>VADI Affiliate Program \| VADI - Everything\. Simply Yours\.<\/title>/g, '<title>VALORA Affiliate Program | VALORA - Everything. Simply Yours.</title>');
  content = content.replace(/content="VADI (.*?)"/g, 'content="VALORA $1"');
  content = content.replace(/content="Careers at VADI:/g, 'content="Careers at VALORA:');
  content = content.replace(/content="Join the VADI Affiliate Partner Program:/g, 'content="Join the VALORA Affiliate Partner Program:');

  // Hero & Subtitles
  content = content.replace(/Careers at VADI/g, 'Careers at VALORA');
  content = content.replace(/VADI Affiliate Program/g, 'VALORA Affiliate Program');
  content = content.replace(/The VADI Narrative/g, 'The VALORA Narrative');
  content = content.replace(/from the VADI design studio\./g, 'from the VALORA design studio.');
  content = content.replace(/Why Join the VADI Team\?/g, 'Why Join the VALORA Team?');
  content = content.replace(/excited to contribute to VADI\?/g, 'excited to contribute to VALORA?');
  content = content.replace(/favorite VADI shoes/g, 'favorite VALORA shoes');
  content = content.replace(/applying to the VADI Affiliate Program/g, 'applying to the VALORA Affiliate Program');
  content = content.replace(/plan to feature VADI items/g, 'plan to feature VALORA items');
  content = content.replace(/Founded in 2026, VADI is/g, 'Founded in 2026, VALORA is');
  content = content.replace(/"VADI represents/g, '"VALORA represents');
  content = content.replace(/chronographs, VADI proves/g, 'chronographs, VALORA proves');
  content = content.replace(/At VADI,/g, 'At VALORA,');
  content = content.replace(/Launch the VADI "Pre-Loved"/g, 'Launch the VALORA "Pre-Loved"');
  content = content.replace(/VADI footwear/g, 'VALORA footwear');
  content = content.replace(/All VADI timepieces/g, 'All VALORA timepieces');
  content = content.replace(/Returning an item with VADI/g, 'Returning an item with VALORA');
  content = content.replace(/VADI \("we", "our", or "us"\)/g, 'VALORA ("we", "our", or "us")');
  content = content.replace(/using the VADI website/g, 'using the VALORA website');
  content = content.replace(/for a VADI member account/g, 'for a VALORA member account');
  content = content.replace(/VADI never stores/g, 'VALORA never stores');
  content = content.replace(/When accessing VADI,/g, 'When accessing VALORA,');
  content = content.replace(/VADI utilizes modern/g, 'VALORA utilizes modern');
  content = content.replace(/within VADI is used/g, 'within VALORA is used');
  content = content.replace(/VADI does not monetize/g, 'VALORA does not monetize');
  content = content.replace(/controls on VADI\./g, 'controls on VALORA.');
  content = content.replace(/VADI is designed/g, 'VALORA is designed');
  content = content.replace(/access to the VADI digital platform\./g, 'access to the VALORA digital platform.');
  content = content.replace(/utilizing the VADI e-commerce website/g, 'utilizing the VALORA e-commerce website');
  content = content.replace(/member account on VADI\./g, 'member account on VALORA.');
  content = content.replace(/When using VADI,/g, 'When using VALORA,');
  content = content.replace(/property of VADI Inc\./g, 'property of VALORA Inc.');
  content = content.replace(/third-party sites \(e\.g\. social platforms\)\. VADI assumes/g, 'third-party sites (e.g. social platforms). VALORA assumes');
  content = content.replace(/THE VADI SITE/g, 'THE VALORA SITE');
  content = content.replace(/APPLICABLE LAW, VADI DISCLAIMS/g, 'APPLICABLE LAW, VALORA DISCLAIMS');
  content = content.replace(/All orders placed on VADI/g, 'All orders placed on VALORA');
  content = content.replace(/VADI offers <strong>/g, 'VALORA offers <strong>');
  content = content.replace(/VADI proudly ships/g, 'VALORA proudly ships');

  // Brand description & Copyright
  content = content.replace(/VADI is an independent modern lifestyle brand bringing curated footwear, luxury timepieces, tailored apparel, and timeless accessories to discerning customers worldwide\. Everything\. Simply Yours\./g,
    'VALORA is an independent modern lifestyle brand bringing curated footwear, luxury timepieces, tailored apparel, and timeless accessories to discerning customers worldwide. Everything. Simply Yours.');
  content = content.replace(/© 2026 VADI Inc\. All rights reserved\./g, '© 2026 VALORA Inc. All rights reserved.');
  content = content.replace(/&copy; 2026 VADI Inc\. All rights reserved\./g, '&copy; 2026 VALORA Inc. All rights reserved.');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', relPath);
  } else {
    console.log('Unchanged:', relPath);
  }
}

policyFiles.forEach(updateFile);

