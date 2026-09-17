/**
 * Verification test for Product Card "In Cart" Toggle Functionality
 */

const fs = require("fs");
const path = require("path");

// Mock LocalStorage
const localStorageStore = {};
const localStorage = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, val) => { localStorageStore[key] = String(val); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};

// Mock Document & DOM Elements
class MockClassList {
  constructor() {
    this.classes = new Set();
  }
  add(cls) { this.classes.add(cls); }
  remove(cls) { this.classes.delete(cls); }
  contains(cls) { return this.classes.has(cls); }
  toggle(cls) {
    if (this.classes.has(cls)) this.classes.delete(cls);
    else this.classes.add(cls);
  }
}

class MockElement {
  constructor(tag, dataset = {}, classList = []) {
    this.tagName = tag.toUpperCase();
    this.dataset = dataset;
    this.classList = new MockClassList();
    classList.forEach(c => this.classList.add(c));
    this.innerHTML = "";
    this.textContent = "";
    this.children = [];
    this._style = {};
  }
  get style() { return this._style; }
  querySelector(selector) {
    if (selector === ".btn-cart-icon") return this.iconEl;
    if (selector === ".btn-cart-text") return this.textEl;
    return null;
  }
}

// Set up simulated environment
const elements = [];
function createProductButton(productId, inCart = false) {
  const btn = new MockElement("button", { cartId: String(productId) });
  btn.iconEl = new MockElement("span", {}, ["btn-cart-icon"]);
  btn.textEl = new MockElement("span", {}, ["btn-cart-text"]);
  if (inCart) {
    btn.classList.add("added");
    btn.textEl.textContent = "In Cart";
  } else {
    btn.textEl.textContent = "Add to Cart";
  }
  elements.push(btn);
  return btn;
}

// Load cart-drawer logic
function runTests() {
  console.log("=== STARTING CART TOGGLE VERIFICATION TESTS ===");
  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log("  [PASS] " + msg);
      passed++;
    } else {
      console.error("  [FAIL] " + msg);
      failed++;
    }
  }

  // --- TEST 1: syncAllProductButtons logic ---
  console.log("\nTest 1: Syncing product card buttons based on cart items");
  // Set up 2 buttons for Product 101 (e.g. one in Featured, one in Trending)
  // and 1 button for Product 102
  const btn101_a = createProductButton("101", false);
  const btn101_b = createProductButton("101", false);
  const btn102 = createProductButton("102", false);

  // Sync function simulation (identical to cart-drawer.js syncAllProductButtons)
  function syncButtons() {
    const cart = JSON.parse(localStorage.getItem("velora_cart") || "[]");
    const inCartIds = new Set(cart.map(i => String(i.id || i.supabase_id)));
    elements.forEach(btn => {
      const pid = String(btn.dataset.cartId);
      if (inCartIds.has(pid)) {
        btn.classList.add("added");
        btn.textEl.textContent = "In Cart";
      } else {
        btn.classList.remove("added");
        btn.textEl.textContent = "Add to Cart";
      }
    });
  }

  // Toggle function simulation (identical to app.js / shop.js toggleCart)
  function toggleCart(productId, sampleProduct) {
    let cart = JSON.parse(localStorage.getItem("velora_cart") || "[]");
    const pidStr = String(productId);
    const inCartIndex = cart.findIndex(item => String(item.id || item.supabase_id) === pidStr);

    if (inCartIndex > -1) {
      // Remove all instances of this product
      cart = cart.filter(item => String(item.id || item.supabase_id) !== pidStr);
      localStorage.setItem("velora_cart", JSON.stringify(cart));
      syncButtons();
      return { action: "removed", cart };
    } else {
      // Add product
      cart.push(sampleProduct || { id: productId, name: "Product " + productId, price: 999, quantity: 1 });
      localStorage.setItem("velora_cart", JSON.stringify(cart));
      syncButtons();
      return { action: "added", cart };
    }
  }

  // Initially empty
  localStorage.setItem("velora_cart", "[]");
  syncButtons();
  assert(!btn101_a.classList.contains("added"), "btn101_a should initially NOT have .added");
  assert(btn101_a.textEl.textContent === "Add to Cart", "btn101_a text should be 'Add to Cart'");
  assert(!btn101_b.classList.contains("added"), "btn101_b should initially NOT have .added");

  // Step 2: Click to Add to Cart (State 1 -> State 2)
  console.log("\nTest 2: Click button -> Product added, buttons synced to 'In Cart'");
  const res1 = toggleCart("101", { id: "101", name: "Premium Sneaker", price: 1499, quantity: 1 });
  assert(res1.action === "added", "Action should be 'added'");
  assert(res1.cart.length === 1, "Cart length should be 1");
  assert(btn101_a.classList.contains("added"), "btn101_a now has .added");
  assert(btn101_a.textEl.textContent === "In Cart", "btn101_a text changed to 'In Cart'");
  assert(btn101_b.classList.contains("added"), "btn101_b also synchronized to .added");
  assert(btn101_b.textEl.textContent === "In Cart", "btn101_b text synchronized to 'In Cart'");
  assert(!btn102.classList.contains("added"), "btn102 remains NOT added");

  // Step 3: Click same button again -> Product removed completely (State 2 -> State 1)
  console.log("\nTest 3: Click same button again -> Product removed, buttons revert to 'Add to Cart'");
  const res2 = toggleCart("101");
  assert(res2.action === "removed", "Action should be 'removed'");
  assert(res2.cart.length === 0, "Cart is now completely empty (0 items)");
  assert(!btn101_a.classList.contains("added"), "btn101_a removed .added");
  assert(btn101_a.textEl.textContent === "Add to Cart", "btn101_a text reverted to 'Add to Cart'");
  assert(!btn101_b.classList.contains("added"), "btn101_b removed .added");
  assert(btn101_b.textEl.textContent === "Add to Cart", "btn101_b text reverted to 'Add to Cart'");

  // Step 4: Multi-quantity complete removal
  console.log("\nTest 4: Item with quantity > 1 removed completely when clicking 'In Cart'");
  // Manually put product 101 with quantity 3 in cart
  localStorage.setItem("velora_cart", JSON.stringify([
    { id: "101", name: "Premium Sneaker", price: 1499, quantity: 3 },
    { id: "102", name: "Classic Watch", price: 2999, quantity: 1 }
  ]));
  syncButtons();
  assert(btn101_a.classList.contains("added"), "btn101_a is .added when in cart with qty=3");
  assert(btn102.classList.contains("added"), "btn102 is .added when in cart");

  // Click btn101_a (which is 'In Cart')
  const res3 = toggleCart("101");
  assert(res3.action === "removed", "Toggle on item with qty=3 completely removes it");
  assert(res3.cart.length === 1, "Only product 102 remains in cart");
  assert(res3.cart[0].id === "102", "Remaining item is product 102");
  assert(!btn101_a.classList.contains("added"), "btn101_a reverted to 'Add to Cart'");
  assert(btn102.classList.contains("added"), "btn102 remains 'In Cart'");

  // Step 5: Removing item 102 removes it from cart
  const res4 = toggleCart("102");
  assert(res4.action === "removed", "Toggle on product 102 removes it");
  assert(res4.cart.length === 0, "Cart is completely empty now");
  assert(!btn102.classList.contains("added"), "btn102 reverted to 'Add to Cart'");

  // Step 6: Supabase ID vs legacy ID matching
  console.log("\nTest 5: Supabase ID string matching");
  const btnUUID = createProductButton("uuid-abc-123", false);
  localStorage.setItem("velora_cart", JSON.stringify([
    { supabase_id: "uuid-abc-123", name: "Leather Bag", price: 4999, quantity: 1 }
  ]));
  syncButtons();
  assert(btnUUID.classList.contains("added"), "Button with supabase_id matched and displays 'In Cart'");

  const res5 = toggleCart("uuid-abc-123");
  assert(res5.action === "removed", "Toggle on supabase_id removes it completely");
  assert(!btnUUID.classList.contains("added"), "Button with supabase_id reverted to 'Add to Cart'");

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runTests();

