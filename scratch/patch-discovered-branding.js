const fs = require('fs');

// 1. js/gift-engine.js
let ge = fs.readFileSync('js/gift-engine.js', 'utf8');
ge = ge.replace(/Signature VADI Keychain/g, 'Signature VALORA Keychain');
fs.writeFileSync('js/gift-engine.js', ge, 'utf8');
console.log('Updated: js/gift-engine.js');

// 2. js/info-pages.js
let ip = fs.readFileSync('js/info-pages.js', 'utf8');
ip = ip.replace(/applying to VADI\./g, 'applying to VALORA.');
ip = ip.replace(/Downloading VADI Brand Assets Kit/g, 'Downloading VALORA Brand Assets Kit');
fs.writeFileSync('js/info-pages.js', ip, 'utf8');
console.log('Updated: js/info-pages.js');

// 3. js/wishlist.js
let wl = fs.readFileSync('js/wishlist.js', 'utf8');
wl = wl.replace(/🏪 MAIN VADI/g, '🏪 MAIN VALORA');
wl = wl.replace(/:\s*'VADI'\)}<\/span>/g, ": 'VALORA')}</span>");
fs.writeFileSync('js/wishlist.js', wl, 'utf8');
console.log('Updated: js/wishlist.js');

// 4. scripts/seed-product-reviews.js
let sr = fs.readFileSync('scripts/seed-product-reviews.js', 'utf8');
sr = sr.replace(/=== VADI & SAROJINI BAZAAR REVIEW SEEDING SYSTEM ===/g, '=== VALORA & SAROJINI BAZAAR REVIEW SEEDING SYSTEM ===');
fs.writeFileSync('scripts/seed-product-reviews.js', sr, 'utf8');
console.log('Updated: scripts/seed-product-reviews.js');

