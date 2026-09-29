const fs = require('fs');

// 1. contact-support.html
let cs = fs.readFileSync('contact-support.html', 'utf8');
cs = cs.replace(/Contact VADI Customer Support/g, 'Contact VALORA Customer Support');
cs = cs.replace(/VADI Lifestyle Studio:/g, 'VALORA Lifestyle Studio:');
fs.writeFileSync('contact-support.html', cs, 'utf8');

// 2. faq.html
let faq = fs.readFileSync('faq.html', 'utf8');
faq = faq.replace(/free VADI member account/g, 'free VALORA member account');
faq = faq.replace(/Yes! VADI delivers worldwide/g, 'Yes! VALORA delivers worldwide');
fs.writeFileSync('faq.html', faq, 'utf8');

// 3. homepage.html and index.html comments
['homepage.html', 'index.html'].forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/VADI SAROJINI BAZAAR SECTION/g, 'VALORA SAROJINI BAZAAR SECTION');
  c = c.replace(/Premium Modern VADI E-commerce/g, 'Premium Modern VALORA E-commerce');
  fs.writeFileSync(f, c, 'utf8');
});

// 4. sarojini-product-details.html comments
let sp = fs.readFileSync('sarojini-product-details.html', 'utf8');
sp = sp.replace(/\(PARITY WITH MAIN VADI\)/g, '(PARITY WITH MAIN VALORA)');
sp = sp.replace(/\(Parity with Main VADI\)/g, '(Parity with Main VALORA)');
fs.writeFileSync('sarojini-product-details.html', sp, 'utf8');

console.log('Fixed final root html files.');

