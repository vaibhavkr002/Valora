const assert = require('assert');

// Simulate DOM and Bulk Importer state
let stagedProducts = [
  {
    id: 'stg_1',
    name: 'Sample Oversized Tee',
    description: 'Cotton vintage tee',
    price: 399,
    original_price: 799,
    advance_payment_value: 80,
    stock: 15,
    department: 'WOMEN',
    category_id: 'cat_tops',
    images: ['https://images.meesho.com/images/products/123/s-1084290722_1024.jpg'],
    sizes: ['S', 'M', 'L'],
    colors: ['Black', 'White'],
    status: 'Ready',
    selected: true,
    specs: {
      material: '100% Cotton',
      fabric: 'Jersey',
      fit: 'Oversized',
      pattern: 'Graphic',
      neck: 'Round Neck',
      sleeve: 'Half Sleeve',
      gender: 'Women',
      country_of_origin: 'India',
      care_instructions: 'Machine Wash',
      brand: 'Sarojini Bazaar',
      custom: [{ name: 'Occasion', value: 'Casual' }]
    }
  }
];

// Mock SarojiniWatermark
const SarojiniWatermark = {
  detectSupplierCode: function(url) {
    if (url.includes('s-') || url.includes('code_')) {
      return { detected: true, code: 's-1084290722' };
    }
    return { detected: false };
  }
};

// 1. Verify initial state
assert.strictEqual(stagedProducts[0].images.length, 1);
assert.strictEqual(stagedProducts[0].price, 399);

// 2. Simulate user typing new price, title, sizes, and specs into DOM inputs before picking files
const simulatedDomEdits = {
  name: 'Updated Oversized Tee Vintage',
  description: 'Updated description',
  price: 449,
  original_price: 899,
  stock: 30,
  sizes: ['M', 'L', 'XL', 'XXL'],
  colors: ['Charcoal', 'Ecru'],
  specs: {
    material: 'Organic Cotton',
    fit: 'Relaxed Oversized'
  }
};

// Simulate syncStagingRowInputs
function mockSyncStagingRowInputs(idx, edits) {
  const p = stagedProducts[idx];
  if (edits.name !== undefined) p.name = edits.name;
  if (edits.description !== undefined) p.description = edits.description;
  if (edits.price !== undefined) p.price = edits.price;
  if (edits.original_price !== undefined) p.original_price = edits.original_price;
  if (edits.stock !== undefined) p.stock = edits.stock;
  if (edits.sizes !== undefined) p.sizes = edits.sizes;
  if (edits.colors !== undefined) p.colors = edits.colors;
  if (edits.specs) {
    Object.assign(p.specs, edits.specs);
  }
}

// 3. User selects 3 files from PC
const pickedFiles = [
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD_file1',
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD_file2_with_code_s-1084290722',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA_file3'
];

// Apply sync before file processing
mockSyncStagingRowInputs(0, simulatedDomEdits);

// Append files
const prod = stagedProducts[0];
let addedCount = 0;
let detectedWatermarks = 0;

pickedFiles.forEach(dataUrl => {
  if (!prod.images.includes(dataUrl)) {
    prod.images.push(dataUrl);
    addedCount++;
    const d = SarojiniWatermark.detectSupplierCode(dataUrl);
    if (d && d.detected) {
      detectedWatermarks++;
      if (!prod.detected_code) prod.detected_code = d.code;
    }
  }
});

// Assertions on image addition and field preservation
assert.strictEqual(addedCount, 3, 'Must add 3 new images');
assert.strictEqual(prod.images.length, 4, 'Total gallery must be 4 images (1 existing + 3 new)');
assert.strictEqual(prod.name, 'Updated Oversized Tee Vintage', 'Name was preserved');
assert.strictEqual(prod.price, 449, 'Price was preserved');
assert.strictEqual(prod.original_price, 899, 'MRP was preserved');
assert.strictEqual(prod.stock, 30, 'Stock was preserved');
assert.deepStrictEqual(prod.sizes, ['M', 'L', 'XL', 'XXL'], 'Sizes were preserved');
assert.strictEqual(prod.specs.material, 'Organic Cotton', 'Material was preserved');
assert.strictEqual(prod.specs.fit, 'Relaxed Oversized', 'Fit was preserved');
assert.strictEqual(detectedWatermarks, 1, 'Detected supplier code on file 2');

// 4. Test Set as Main on the 2nd image (index 1)
const [moved] = prod.images.splice(1, 1);
prod.images.unshift(moved);
assert.strictEqual(prod.images[0], 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD_file1', 'Set as main placed image at index 0');

// 5. Test Move Left & Move Right
const imgTemp = prod.images[1];
prod.images[1] = prod.images[2];
prod.images[2] = imgTemp;
assert.strictEqual(prod.images.length, 4, 'Length stays 4 after reordering');

// 6. Test Remove image
prod.images.splice(3, 1);
assert.strictEqual(prod.images.length, 3, 'Length becomes 3 after removing 1 image');

// 7. Verify all product data intact for batch import
assert.strictEqual(prod.price, 449);
assert.strictEqual(prod.images.length, 3);
assert.strictEqual(prod.selected, true);

console.log('--- ALL DYNAMIC SIMULATION TESTS PASSED! ---');
console.log('Gallery image count:', prod.images.length);
console.log('Main image:', prod.images[0].substring(0, 30) + '...');
console.log('Preserved product name:', prod.name);
console.log('Preserved product price: ₹' + prod.price);

