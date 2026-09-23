/**
 * VADI - Universal Product Search Engine (search-utils.js)
 * High-performance, multi-attribute, variation-tolerant search engine shared across
 * both VADI Main Store and Sarojini Bazaar.
 *
 * Capabilities:
 * - Case-insensitive & whitespace-tolerant matching.
 * - Punctuation & hyphen normalization (e.g. "t-shirt" ↔ "tshirt" ↔ "t shirt" ↔ "tee").
 * - Multi-word intelligent matching across fields (AND logic for query terms across corpus).
 * - Comprehensive metadata compilation: name, brand, category, subcategory, department,
 *   description, tags, keywords, materials, fit, colors, sizes, badges, collections.
 * - Automatic searchability for any new product added via Admin without code changes.
 * - UMD wrapper: works in browser and Node.js test suites.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.VadiSearchUtils = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Common fashion synonym & variation groups
  const SYNONYM_GROUPS = [
    ['tshirt', 't-shirt', 't shirt', 'tee', 'tees', 't-shirts', 'tshirts'],
    ['sneaker', 'sneakers', 'kicks', 'trainer', 'trainers', 'shoe', 'shoes', 'footwear'],
    ['hoodie', 'hoodies', 'sweatshirt', 'sweatshirts', 'pullover'],
    ['pant', 'pants', 'trouser', 'trousers', 'jean', 'jeans', 'denim', 'bottoms'],
    ['cargo', 'cargos', 'cargo pant', 'cargo pants'],
    ['jacket', 'jackets', 'coat', 'coats', 'outerwear', 'windbreaker'],
    ['oversized', 'oversize', 'baggy', 'loose', 'relaxed'],
    ['jewellery', 'jewelry', 'earring', 'earrings', 'pendant', 'necklace', 'ring', 'kodi'],
    ['bag', 'bags', 'backpack', 'backpacks', 'tote', 'handbag', 'shoulder bag', 'crossbody'],
    ['sunglasses', 'sunglass', 'shades', 'eyewear', 'goggles', 'glasses'],
    ['watch', 'watches', 'timepiece', 'chronograph', 'horology'],
    ['cap', 'caps', 'hat', 'hats', 'beanie', 'headwear'],
    ['dress', 'dresses', 'gown', 'frock'],
    ['top', 'tops', 'crop top', 'croptop', 'blouse', 'shirt', 'shirts']
  ];

  // Quick lookup map: word -> array of synonym tokens
  const SYNONYM_MAP = new Map();
  SYNONYM_GROUPS.forEach(group => {
    group.forEach(term => {
      const cleanTerm = term.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!cleanTerm) return;
      let set = SYNONYM_MAP.get(cleanTerm);
      if (!set) {
        set = new Set();
        SYNONYM_MAP.set(cleanTerm, set);
      }
      group.forEach(alt => {
        const altLower = alt.toLowerCase();
        set.add(altLower);
        const altClean = altLower.replace(/[^a-z0-9]/g, '');
        if (altClean) set.add(altClean);
      });
    });
  });

  // Convert Sets to Arrays for fast iteration
  for (const [key, set] of SYNONYM_MAP.entries()) {
    SYNONYM_MAP.set(key, Array.from(set));
  }

  /**
   * Cleans and normalizes text for reliable matching.
   */
  function normalizeText(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[^\w\s-]/g, ' ') // replace punctuation other than hyphen with space
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generates token variations for a given string (including hyphens removed and hyphenated versions).
   */
  function getTokenVariations(token) {
    const clean = token.toLowerCase().trim();
    if (!clean) return [];

    const variations = new Set();
    variations.add(clean);

    // Variation without hyphens / spaces (e.g. "t-shirt" -> "tshirt")
    const alphanumeric = clean.replace(/[^a-z0-9]/g, '');
    if (alphanumeric && alphanumeric !== clean) {
      variations.add(alphanumeric);
    }

    // Singular / Plural variation (e.g. "shoes" -> "shoe", "jeans" -> "jean", "tees" -> "tee")
    if (clean.endsWith('s') && clean.length > 3) {
      const singular = clean.slice(0, -1);
      variations.add(singular);
      variations.add(singular.replace(/[^a-z0-9]/g, ''));
    }

    // Synonym expansions
    const syns = SYNONYM_MAP.get(alphanumeric);
    if (syns) {
      syns.forEach(s => variations.add(s));
    }

    return Array.from(variations);
  }

  /**
   * Tokenizes a search query string into clean individual terms.
   */
  function tokenizeQuery(query) {
    if (!query) return [];
    const normalized = normalizeText(query);
    if (!normalized) return [];

    // Split on whitespace
    return normalized.split(/\s+/).filter(Boolean);
  }

  /**
   * Builds a comprehensive searchable text corpus from all present product attributes.
   * Works seamlessly on both Main VADI and Sarojini Bazaar product models.
   */
  function buildSearchCorpus(product, options = {}) {
    if (!product || typeof product !== 'object') return '';

    const parts = [];

    // 1. Core Identification
    if (product.name) parts.push(product.name);
    if (product.title) parts.push(product.title);
    if (product.brand) parts.push(product.brand);
    if (product.department) parts.push(product.department);
    if (product.slug) parts.push(product.slug.replace(/-/g, ' '));

    // 2. Categories & Subcategories
    if (product.category) parts.push(product.category);
    if (product.categoryLabel) parts.push(product.categoryLabel);
    if (product.category_slug) parts.push(product.category_slug.replace(/-/g, ' '));
    if (product.subcategory) parts.push(product.subcategory);
    if (product.subcategory_slug) parts.push(product.subcategory_slug.replace(/-/g, ' '));

    // Category lookup from options if category_id exists
    if (product.category_id && options.categories && Array.isArray(options.categories)) {
      const cat = options.categories.find(c => 
        String(c.id).toLowerCase() === String(product.category_id).toLowerCase()
      );
      if (cat) {
        if (cat.name) parts.push(cat.name);
        if (cat.slug) parts.push(cat.slug.replace(/-/g, ' '));
        if (cat.department) parts.push(cat.department);
      }
    }

    // 3. Product Description
    if (product.description) parts.push(product.description);

    // 4. Tags & Keywords
    if (Array.isArray(product.tags)) {
      parts.push(...product.tags);
    } else if (typeof product.tags === 'string') {
      parts.push(product.tags);
    }

    if (Array.isArray(product.keywords)) {
      parts.push(...product.keywords);
    } else if (typeof product.keywords === 'string') {
      parts.push(product.keywords);
    }

    if (product.search_keywords) parts.push(String(product.search_keywords));
    if (product.product_type) parts.push(String(product.product_type));
    if (product.type) parts.push(String(product.type));
    if (product.collection) parts.push(String(product.collection));

    // 5. Colors
    if (Array.isArray(product.colors)) {
      parts.push(...product.colors);
    } else if (typeof product.colors === 'string') {
      parts.push(product.colors);
    }

    // 6. Sizes
    if (Array.isArray(product.sizes)) {
      parts.push(...product.sizes);
    } else if (typeof product.sizes === 'string') {
      parts.push(product.sizes);
    }

    // 7. Specifications / Materials / Fit
    if (product.specifications) {
      if (typeof product.specifications === 'object') {
        if (Array.isArray(product.specifications)) {
          product.specifications.forEach(s => {
            if (s.name) parts.push(s.name);
            if (s.value) parts.push(s.value);
            if (s.group_name) parts.push(s.group_name);
          });
        } else {
          Object.entries(product.specifications).forEach(([k, v]) => {
            if (k !== 'original_images' && v && typeof v === 'string') {
              parts.push(k, v);
            }
          });
        }
      }
    }

    // 8. Badges & Promo status
    if (product.badge) parts.push(product.badge);
    if (product.badgeType) parts.push(product.badgeType);
    if (product.is_deal || product.isDeal) parts.push('deal', 'special deal');
    if (product.is_new || product.isNew) parts.push('new', 'new arrival');
    if (product.is_featured || product.isFeatured || product.isTrending) parts.push('featured', 'trending');
    if (product.is_bogo || product.isBogo) parts.push('bogo', 'buy 1 get 1 free');

    // 9. Dynamic Schema Indexing: automatically index any existing or future fields added in Admin
    const IGNORED_KEYS = new Set([
      'id', 'image', 'images', 'created_at', 'updated_at', 'source_url', 'source_name',
      'is_active', 'stock', 'price', 'original_price', 'discount_percentage', 'rating',
      'review_count', 'return_policy', 'parent_id', 'display_order'
    ]);

    for (const [key, val] of Object.entries(product)) {
      if (IGNORED_KEYS.has(key)) continue;
      if (typeof val === 'string' && val.trim()) {
        parts.push(val);
      } else if (Array.isArray(val)) {
        val.forEach(item => {
          if (typeof item === 'string' && item.trim()) parts.push(item);
        });
      } else if (val && typeof val === 'object') {
        Object.entries(val).forEach(([subKey, subVal]) => {
          if (typeof subVal === 'string' && subVal.trim() && subKey !== 'original_images') {
            parts.push(subVal);
          }
        });
      }
    }

    // Return joined normalized corpus
    return normalizeText(parts.join(' '));
  }

  /**
   * Determines if a single token matches inside the product corpus text or its tokens.
   */
  function tokenMatchesCorpus(token, corpusText, corpusCompact) {
    if (!token) return true;

    // Check direct substring
    if (corpusText.includes(token)) return true;

    // Check compact alphanumeric version (e.g. "tshirt" vs "t shirt")
    const cleanToken = token.replace(/[^a-z0-9]/g, '');
    if (cleanToken && corpusCompact.includes(cleanToken)) return true;

    // Check variations & synonyms
    const variations = getTokenVariations(token);
    for (let i = 0; i < variations.length; i++) {
      const v = variations[i];
      if (corpusText.includes(v)) return true;
      const vClean = v.replace(/[^a-z0-9]/g, '');
      if (vClean && corpusCompact.includes(vClean)) return true;
    }

    return false;
  }

  /**
   * Evaluates if a product satisfies the search query.
   * Multi-word queries: EVERY query token must match somewhere in the product's corpus.
   *
   * @param {Object} product - Product object from either Main VADI or Sarojini Bazaar
   * @param {string} query - Raw search query string from user
   * @param {Object} options - Optional configuration (e.g. { categories: [] })
   * @returns {boolean} True if product matches the query
   */
  function matchesProduct(product, query, options = {}) {
    if (!product) return false;
    if (!query || !query.trim()) return true;

    const queryTokens = tokenizeQuery(query);
    if (queryTokens.length === 0) return true;

    // Build or retrieve cached corpus on the product object
    let corpus = product._searchCorpus;
    let corpusCompact = product._searchCorpusCompact;

    if (!corpus) {
      corpus = buildSearchCorpus(product, options);
      corpusCompact = corpus.replace(/[^a-z0-9]/g, '');
      // Cache non-enumerably if possible to prevent polluting JSON serialization
      try {
        Object.defineProperty(product, '_searchCorpus', { value: corpus, writable: true, configurable: true });
        Object.defineProperty(product, '_searchCorpusCompact', { value: corpusCompact, writable: true, configurable: true });
      } catch (_) {
        product._searchCorpus = corpus;
        product._searchCorpusCompact = corpusCompact;
      }
    }

    // Every query token must match somewhere in the corpus
    for (let i = 0; i < queryTokens.length; i++) {
      if (!tokenMatchesCorpus(queryTokens[i], corpus, corpusCompact)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Filters an array of products against a search query.
   * Respects active status (is_active !== false).
   */
  function filterProducts(products, query, options = {}) {
    if (!Array.isArray(products)) return [];
    if (!query || !query.trim()) {
      return products.filter(p => p.is_active !== false);
    }
    return products.filter(p => p.is_active !== false && matchesProduct(p, query, options));
  }

  return {
    normalizeText,
    getTokenVariations,
    tokenizeQuery,
    buildSearchCorpus,
    matchesProduct,
    filterProducts
  };
}));
