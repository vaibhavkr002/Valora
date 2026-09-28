const fs = require('fs');
const path = require('path');

const files = ['sarojini-bazaar.html', 'sarojini-shop.html', 'sarojini-product-details.html'];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  console.log('\n=============================================');
  console.log('FILE:', file);
  console.log('=============================================');

  const cssMatches = content.match(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi) || [];
  console.log('CSS links:');
  cssMatches.forEach(c => console.log(' ', c));

  const jsMatches = content.match(/<script[^>]+src=[^>]*>/gi) || [];
  console.log('JS scripts:');
  jsMatches.forEach(j => console.log(' ', j));
});
