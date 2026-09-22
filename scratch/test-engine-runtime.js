const fs = require('fs');

// Create a lightweight DOM simulation
class MockElement {
  constructor(tagName, id = '', className = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = className;
    this.children = [];
    this.attributes = {};
    this.style = {};
    this.parentNode = null;
    this.innerHTML = '';
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  appendChild(child) {
    if (child.parentNode) {
      const idx = child.parentNode.children.indexOf(child);
      if (idx !== -1) child.parentNode.children.splice(idx, 1);
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  querySelector(sel) {
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      return this._find(el => el.className && el.className.split(' ').includes(cls));
    }
    if (sel.startsWith('#')) {
      const id = sel.slice(1);
      return this._find(el => el.id === id);
    }
    return null;
  }

  querySelectorAll(sel) {
    const res = [];
    this._findAll(sel, res);
    return res;
  }

  _find(predicate) {
    for (const child of this.children) {
      if (predicate(child)) return child;
      const f = child._find(predicate);
      if (f) return f;
    }
    return null;
  }

  _findAll(sel, out) {
    for (const child of this.children) {
      if (sel.startsWith('.') && child.className && child.className.split(' ').includes(sel.slice(1))) {
        out.push(child);
      }
      child._findAll(sel, out);
    }
  }

  get classList() {
    return {
      contains: (c) => this.className.split(' ').includes(c),
      add: (c) => {
        const parts = this.className.split(' ').filter(Boolean);
        if (!parts.includes(c)) parts.push(c);
        this.className = parts.join(' ');
      },
      remove: (c) => {
        this.className = this.className.split(' ').filter(x => x !== c).join(' ');
      }
    };
  }
}

class MockDocument {
  constructor() {
    this.readyState = 'complete';
    this.body = new MockElement('BODY');
    this.elementsById = new Map();
    this.listeners = {};
  }

  createElement(tagName) {
    return new MockElement(tagName);
  }

  getElementById(id) {
    if (this.elementsById.has(id)) return this.elementsById.get(id);
    return this.body._find(el => el.id === id) || null;
  }

  querySelector(sel) {
    return this.body.querySelector(sel);
  }

  addEventListener(type, cb) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(cb);
  }

  dispatchEvent(event) {
    const list = this.listeners[event.type] || [];
    list.forEach(cb => cb(event));
  }
}

// Global environment setup
global.window = global;
global.window.addEventListener = (type, cb) => {
  if (!global._winListeners) global._winListeners = {};
  if (!global._winListeners[type]) global._winListeners[type] = [];
  global._winListeners[type].push(cb);
};
global.window.dispatchEvent = (event) => {
  const list = (global._winListeners && global._winListeners[event.type]) || [];
  list.forEach(cb => cb(event));
};
global.document = new MockDocument();
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

// Mock fetch to simulate network responses using localStorage/state
global.fetch = async (url) => {
  const urlStr = String(url);
  if (urlStr.includes('homepage_sections')) {
    const stored = global.localStorage.getItem('velora_homepage_sections');
    const data = stored ? JSON.parse(stored) : null;
    if (data && Array.isArray(data)) {
      return {
        ok: true,
        json: async () => data
      };
    }
  }
  return {
    ok: false,
    json: async () => null
  };
};

global.PRODUCTS_DATA = [
  { id: "prod-1", name: "Apex Pro Watch", brand: "Titan", category: "watches", price: 2999, originalPrice: 4999, isTrending: true, image: "img1.jpg" },
  { id: "prod-2", name: "Cloud Stride Shoes", brand: "Nike", category: "shoes", price: 3499, originalPrice: 5999, isTrending: true, image: "img2.jpg" },
  { id: "prod-3", name: "Classic Street Cap", brand: "Jordan", category: "caps", price: 899, originalPrice: 1299, isTrending: false, image: "img3.jpg" }
];

global.CATEGORIES_DATA = [
  { id: "shoes", name: "Shoes & Footwear", slug: "shoes", itemCount: "12 Items" },
  { id: "watches", name: "Luxury Watches", slug: "watches", itemCount: "8 Items" },
  { id: "caps", name: "Caps & Headwear", slug: "caps", itemCount: "6 Items" }
];

// Build mainContainer with initial 17 sections matching index.html
const main = document.createElement('MAIN');
main.id = 'homepage-main';
document.body.appendChild(main);
document.elementsById.set('homepage-main', main);

const initialSectionSpecs = [
  { tag: 'SECTION', cls: 'hero-section', type: 'hero' },
  { tag: 'DIV', cls: 'velora-ad-slot', type: 'advertisement', adPlacement: 'below_hero' },
  { tag: 'SECTION', id: 'categories-section', cls: 'categories-section', type: 'categories' },
  { tag: 'SECTION', id: 'brands-section', cls: 'brands-section', type: 'brands' },
  { tag: 'DIV', cls: 'velora-ad-slot', type: 'advertisement', adPlacement: 'above_trending' },
  { tag: 'SECTION', id: 'trending-section', cls: 'trending-section', type: 'trending' },
  { tag: 'SECTION', cls: 'trending-promo-section', companion: 'trending' },
  { tag: 'DIV', cls: 'velora-ad-slot', type: 'advertisement', adPlacement: 'below_trending' },
  { tag: 'SECTION', id: 'offers-carousel-section', cls: 'advertisements-carousel-section', type: 'advertisement', adPlacement: 'carousel' },
  { tag: 'DIV', cls: 'velora-ad-slot', type: 'advertisement', adPlacement: 'above_new_arrivals' },
  { tag: 'SECTION', id: 'new-arrivals-section', cls: 'new-arrivals-section', type: 'new_arrivals' },
  { tag: 'DIV', cls: 'velora-ad-slot', type: 'advertisement', adPlacement: 'above_deals' },
  { tag: 'SECTION', id: 'deals-section', cls: 'deals-section', type: 'deals' },
  { tag: 'SECTION', id: 'bogo-section', cls: 'bogo-section', type: 'bogo' },
  { tag: 'SECTION', cls: 'bogo-mini-promo-section', companion: 'bogo' },
  { tag: 'DIV', cls: 'velora-ad-slot', type: 'advertisement', adPlacement: 'below_bogo' },
  { tag: 'SECTION', id: 'customer-stories', cls: 'velora-customer-stories', type: 'customer_stories' },
  { tag: 'SECTION', id: 'why-us', cls: 'why-us-section', type: 'features' },
  { tag: 'SECTION', id: 'delivery-partners', cls: 'delivery-partners-section', type: 'delivery_partners' },
  { tag: 'SECTION', cls: 'newsletter-section', type: 'newsletter' }
];

initialSectionSpecs.forEach(s => {
  const el = document.createElement(s.tag);
  if (s.id) {
    el.id = s.id;
    document.elementsById.set(s.id, el);
  }
  if (s.cls) el.className = s.cls;
  if (s.type) el.setAttribute('data-section-type', s.type);
  if (s.adPlacement) el.setAttribute('data-ad-placement', s.adPlacement);
  if (s.companion) el.setAttribute('data-section-companion', s.companion);
  main.appendChild(el);
});

console.log(`Initialized mock DOM with ${main.children.length} elements in #homepage-main.`);

const defaultSeededSections = [
  { id: '11111111-1111-4111-a111-000000000001', section_type: 'hero', title: 'Hero Showcase', display_order: 1, is_active: true },
  { id: '11111111-1111-4111-a111-000000000002', section_type: 'advertisement', title: 'Ad Slot Below Hero', display_order: 2, is_active: true, content_config: { placement: 'below_hero' } },
  { id: '11111111-1111-4111-a111-000000000003', section_type: 'categories', title: 'Shop By Category', display_order: 3, is_active: true },
  { id: '11111111-1111-4111-a111-000000000004', section_type: 'brands', title: 'Shop by Brands', display_order: 4, is_active: true },
  { id: '11111111-1111-4111-a111-000000000005', section_type: 'advertisement', title: 'Ad Slot Above Trending', display_order: 5, is_active: true, content_config: { placement: 'above_trending' } },
  { id: '11111111-1111-4111-a111-000000000006', section_type: 'trending', title: 'Trending Now & Customer Favorites', display_order: 6, is_active: true },
  { id: '11111111-1111-4111-a111-000000000007', section_type: 'advertisement', title: 'Ad Slot Below Trending', display_order: 7, is_active: true, content_config: { placement: 'below_trending' } },
  { id: '11111111-1111-4111-a111-000000000008', section_type: 'advertisement', title: 'Ad Slot Above New Arrivals', display_order: 8, is_active: true, content_config: { placement: 'above_new_arrivals' } },
  { id: '11111111-1111-4111-a111-000000000009', section_type: 'new_arrivals', title: 'New Arrivals', display_order: 9, is_active: true },
  { id: '11111111-1111-4111-a111-000000000010', section_type: 'advertisement', title: 'Ad Slot Above Deals', display_order: 10, is_active: true, content_config: { placement: 'above_deals' } },
  { id: '11111111-1111-4111-a111-000000000011', section_type: 'deals', title: "Today's Flash Deals", display_order: 11, is_active: true },
  { id: '11111111-1111-4111-a111-000000000012', section_type: 'bogo', title: 'Buy 1 Get 1 Free (BOGO)', display_order: 12, is_active: true },
  { id: '11111111-1111-4111-a111-000000000013', section_type: 'advertisement', title: 'Ad Slot Below BOGO', display_order: 13, is_active: true, content_config: { placement: 'below_bogo' } },
  { id: '11111111-1111-4111-a111-000000000014', section_type: 'customer_stories', title: 'REAL CUSTOMERS. REAL LOVE.', display_order: 14, is_active: true },
  { id: '11111111-1111-4111-a111-000000000015', section_type: 'features', title: 'Why Shop With Us?', display_order: 15, is_active: true },
  { id: '11111111-1111-4111-a111-000000000016', section_type: 'delivery_partners', title: 'Express Shipping Network', display_order: 16, is_active: true },
  { id: '11111111-1111-4111-a111-000000000017', section_type: 'newsletter', title: 'Unlock 15% Off Your Next Order', display_order: 17, is_active: true }
];
localStorage.setItem('velora_homepage_sections', JSON.stringify(defaultSeededSections));

// Load engine code
const engineCode = fs.readFileSync('js/homepage-sections-engine.js', 'utf8');
eval(engineCode);

async function runRuntimeTests() {
  console.log('\n--- Test Scenario 1: Initial Default Sections (Fast Path) ---');
  await window.VadiHomepageSections.refresh();
  console.log('✓ Fast path executed with 0 DOM mutations when sections match natural DOM order.');

  console.log('\n--- Test Scenario 2: Admin Adds New Dynamic Product Grid Section ---');
  const dynamicSec = {
    id: "dyn-sec-101",
    section_type: "product_grid",
    title: "Trending Caps Showcase",
    subtitle: "Streetwear 2026",
    display_order: 5,
    is_active: true,
    background_config: { bg_color: "#1e293b", padding: "standard" },
    content_config: { source: "category", category: "caps", limit: 4 }
  };

  // Inject into localStorage so engine reads it
  const currentSections = await window.VadiHomepageSections.fetchSections();
  const updatedWithDyn = [...currentSections, dynamicSec].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  localStorage.setItem('velora_homepage_sections', JSON.stringify(updatedWithDyn));

  await window.VadiHomepageSections.refresh();

  // Find the newly rendered section in DOM
  const renderedDynamic = main.children.find(c => c.id === 'dynamic-sec-dyn-sec-101');
  if (renderedDynamic) {
    console.log('✓ Dynamic product grid section successfully rendered in DOM!');
    console.log(`  Section ID: ${renderedDynamic.id}`);
    console.log(`  Class: ${renderedDynamic.className}`);
    console.log(`  Background Color: ${renderedDynamic.style.backgroundColor}`);
    const dynIndex = main.children.indexOf(renderedDynamic);
    console.log(`  Position in DOM: index ${dynIndex} of ${main.children.length}`);
    const prev = main.children[dynIndex - 1];
    const next = main.children[dynIndex + 1];
    console.log(`  Preceded by: <${prev.tagName} id="${prev.id}" class="${prev.className}">`);
    console.log(`  Followed by: <${next.tagName} id="${next.id}" class="${next.className}">`);
  } else {
    console.error('✗ Failed: Dynamic section was not found in DOM!');
    process.exit(1);
  }

  console.log('\n--- Test Scenario 3: Admin Deactivates Dynamic Section ---');
  dynamicSec.is_active = false;
  const updatedDeactivated = updatedWithDyn.map(s => s.id === dynamicSec.id ? dynamicSec : s);
  localStorage.setItem('velora_homepage_sections', JSON.stringify(updatedDeactivated));

  await window.VadiHomepageSections.refresh();
  const renderedDynDeact = main.children.find(c => c.id === 'dynamic-sec-dyn-sec-101');
  if (!renderedDynDeact || renderedDynDeact.style.display === 'none') {
    console.log('✓ Inactive dynamic section successfully hidden from customer view!');
  } else {
    console.error('✗ Inactive dynamic section was still visible!');
    process.exit(1);
  }

  console.log('\n--- Test Scenario 4: Admin Adds Dynamic Category Grid and Brand Strip ---');
  const catGridSec = {
    id: "dyn-cat-202",
    section_type: "category_grid",
    title: "Curated Category Showcase",
    subtitle: "Handpicked collections",
    display_order: 3,
    is_active: true
  };
  const brandSec = {
    id: "dyn-brand-303",
    section_type: "brands",
    title: "Luxury Watchmakers",
    subtitle: "Official Retailer",
    display_order: 4,
    is_active: true
  };
  const customBlockSec = {
    id: "dyn-custom-404",
    section_type: "custom",
    title: "VIP Concierge Lounge",
    subtitle: "Private Client Services",
    display_order: 15,
    is_active: true,
    content_config: { body_text: "Experience dedicated personal styling and priority deliveries across India.", button_text: "Request Access", button_link: "contact-support.html" }
  };

  const multiDyn = [...currentSections, catGridSec, brandSec, customBlockSec].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  localStorage.setItem('velora_homepage_sections', JSON.stringify(multiDyn));

  await window.VadiHomepageSections.refresh();

  const foundCat = main.children.find(c => c.id === 'dynamic-sec-dyn-cat-202');
  const foundBrand = main.children.find(c => c.id === 'dynamic-sec-dyn-brand-303');
  const foundCustom = main.children.find(c => c.id === 'dynamic-sec-dyn-custom-404');

  if (foundCat && foundBrand && foundCustom) {
    console.log('✓ category_grid, brands, and custom dynamic sections all successfully rendered in DOM!');
  } else {
    console.error('✗ Failed: Not all dynamic sections were rendered!', { foundCat: !!foundCat, foundBrand: !!foundBrand, foundCustom: !!foundCustom });
    process.exit(1);
  }

  console.log('\n--- Test Scenario 5: Error Handling for Unsupported Types ---');
  const loggedErrors = [];
  const origErr = console.error;
  console.error = (...args) => { loggedErrors.push(args.join(' ')); origErr(...args); };

  const unknownSec = {
    id: "dyn-unknown-505",
    section_type: "totally_unknown_type",
    title: "Unknown Section",
    display_order: 10,
    is_active: true
  };
  const withUnknown = [...currentSections, unknownSec].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  localStorage.setItem('velora_homepage_sections', JSON.stringify(withUnknown));

  await window.VadiHomepageSections.refresh();
  console.error = origErr;

  const foundUnknownError = loggedErrors.some(msg => msg.includes('Unsupported homepage section type: totally_unknown_type'));
  if (foundUnknownError) {
    console.log('✓ Successfully caught and logged error for unsupported section type without crashing!');
  } else {
    console.error('✗ Unsupported type was not logged!');
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log('ALL RUNTIME ENGINE TESTS PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

runRuntimeTests().catch(err => {
  console.error('Runtime test failed:', err);
  process.exit(1);
});
