const fs = require('fs');

// admin/add-product.html
let ap = fs.readFileSync('admin/add-product.html', 'utf8');
ap = ap.replace(/value="VADI Atelier"/g, 'value="VALORA Atelier"');
fs.writeFileSync('admin/add-product.html', ap, 'utf8');

// admin/advertisements.html
let ad = fs.readFileSync('admin/advertisements.html', 'utf8');
ad = ad.replace(/All Stores \(VADI & Sarojini\)/g, 'All Stores (VALORA & Sarojini)');
ad = ad.replace(/Explore VADI Premium/g, 'Explore VALORA Premium');
fs.writeFileSync('admin/advertisements.html', ad, 'utf8');

// admin/sarojini-categories.html
let sc = fs.readFileSync('admin/sarojini-categories.html', 'utf8');
sc = sc.replace(/main VADI catalog/g, 'main VALORA catalog');
fs.writeFileSync('admin/sarojini-categories.html', sc, 'utf8');

// admin/sarojini-dashboard.html
let sd = fs.readFileSync('admin/sarojini-dashboard.html', 'utf8');
sd = sd.replace(/main VADI inventory/g, 'main VALORA inventory');
fs.writeFileSync('admin/sarojini-dashboard.html', sd, 'utf8');

// admin/sarojini-products.html
let sp = fs.readFileSync('admin/sarojini-products.html', 'utf8');
sp = sp.replace(/main VADI products/g, 'main VALORA products');
fs.writeFileSync('admin/sarojini-products.html', sp, 'utf8');

console.log('Fixed additional admin files.');

