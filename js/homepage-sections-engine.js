/**
 * VADI - Dynamic Homepage Sections Engine
 * Pure Vanilla JavaScript (ES6+)
 * 
 * Fetches configured sections from Supabase (public.homepage_sections or store_settings),
 * sorts them by display_order, dynamically renders custom product grids, promo banners,
 * category showcases, brand strips, and custom content blocks, and reorders/hides
 * standard storefront sections according to Admin Panel settings without layout shifts
 * or stranded DOM nodes.
 */

(function () {
  'use strict';

  const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";
  const STORAGE_KEY = "velora_homepage_sections";

  const formatPrice = (amt) => (window.formatINR ? window.formatINR(amt) : ('₹' + Math.round(amt).toLocaleString('en-IN')));

  function getSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof window.getSupabase === 'function') return window.getSupabase();
    return null;
  }

  // --- 1. Fetch Configured Sections ---
  async function fetchHomepageSections(forceFresh = false) {
    // 1a. Try dedicated public.homepage_sections table via Supabase Client or REST
    try {
      const client = getSupabaseClient();
      if (client) {
        const { data, error } = await client
          .from('homepage_sections')
          .select('*')
          .order('display_order', { ascending: true });
        if (!error && Array.isArray(data) && data.length > 0) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
          return data;
        }
      }

      // Direct REST fetch
      const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/homepage_sections?select=*&order=display_order.asc`, {
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
        cache: forceFresh ? "no-store" : "default"
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(json)); } catch (_) {}
          return json;
        }
      }
    } catch (err) {
      console.warn("homepage_sections fetch notice:", err);
    }

    // 1b. Fallback: store_settings table (key = 'homepage_sections')
    try {
      const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/store_settings?key=eq.homepage_sections&select=value`, {
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
        cache: forceFresh ? "no-store" : "default"
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows[0] && Array.isArray(rows[0].value) && rows[0].value.length > 0) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows[0].value)); } catch (_) {}
          return rows[0].value;
        }
      }
    } catch (err) {
      console.warn("store_settings fallback notice:", err);
    }

    // 1c. Fallback: localStorage
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}

    return null;
  }

  // --- 2. Check Active & Schedule Window ---
  function isSectionActive(section) {
    if (section.is_active === false) return false;
    const now = Date.now();
    if (section.start_date && new Date(section.start_date).getTime() > now) return false;
    if (section.end_date && new Date(section.end_date).getTime() < now) return false;
    return true;
  }

  // Primary static seeded IDs for standard sections
  const SEEDED_STATIC_IDS = new Set([
    '11111111-1111-4111-a111-000000000001', // hero
    '11111111-1111-4111-a111-000000000002', // ad:below_hero
    '11111111-1111-4111-a111-000000000003', // categories
    '11111111-1111-4111-a111-000000000004', // brands
    '11111111-1111-4111-a111-000000000005', // ad:above_trending
    '11111111-1111-4111-a111-000000000006', // trending
    '11111111-1111-4111-a111-000000000007', // ad:below_trending
    '11111111-1111-4111-a111-000000000008', // ad:above_new_arrivals
    '11111111-1111-4111-a111-000000000009', // new_arrivals
    '11111111-1111-4111-a111-000000000010', // ad:above_deals
    '11111111-1111-4111-a111-000000000011', // deals
    '11111111-1111-4111-a111-000000000012', // bogo
    '11111111-1111-4111-a111-000000000013', // ad:below_bogo
    '11111111-1111-4111-a111-000000000014', // customer_stories
    '11111111-1111-4111-a111-000000000015', // features
    '11111111-1111-4111-a111-000000000016', // delivery_partners
    '11111111-1111-4111-a111-000000000017'  // newsletter
  ]);

  // Helper to identify DOM element section key from existing HTML
  function getDomElementKey(el) {
    const type = el.getAttribute('data-section-type');
    const placement = el.getAttribute('data-ad-placement');
    if (type === 'advertisement' && placement) {
      return `advertisement:${placement}`;
    }
    if (type) return type;

    // Fallback to IDs / classes for backward resilience
    const id = el.id || '';
    if (id === 'categories-section') return 'categories';
    if (id === 'brands-section') return 'brands';
    if (id === 'trending-section') return 'trending';
    if (id === 'new-arrivals-section') return 'new_arrivals';
    if (id === 'deals-section') return 'deals';
    if (id === 'bogo-section') return 'bogo';
    if (id === 'customer-stories') return 'customer_stories';
    if (id === 'why-us' || id === 'features-section') return 'features';
    if (id === 'delivery-partners' || id === 'delivery-partners-section') return 'delivery_partners';
    if (id === 'offers-carousel-section') return 'advertisement:carousel';
    if (el.classList.contains('hero-section')) return 'hero';
    if (el.classList.contains('newsletter-section')) return 'newsletter';
    if (el.classList.contains('velora-ad-slot') && placement) return `advertisement:${placement}`;

    return null;
  }

  // Determine if a section record maps to an existing static DOM unit or is dynamic
  function resolveSectionBinding(sec, domUnitMap, claimedDomKeys) {
    const type = sec.section_type;

    // Explicit dynamic types
    if (type === 'product_grid' || type === 'promotional_banner' || type === 'category_grid' || type === 'custom') {
      return { isDynamic: true, key: `dynamic:${sec.id}` };
    }

    // Advertisement slots
    if (type === 'advertisement') {
      const p = sec.content_config && sec.content_config.placement;
      const adKey = p ? `advertisement:${p}` : `advertisement:${sec.id}`;
      if (domUnitMap.has(adKey) && !claimedDomKeys.has(adKey)) {
        return { isDynamic: false, key: adKey };
      }
      return { isDynamic: true, key: `dynamic:${sec.id}` };
    }

    // Standard static components
    let domKey = type;
    if (type === 'categories') domKey = 'categories';
    if (type === 'brands') domKey = 'brands';

    // If matching unclaimed DOM unit exists
    if (domUnitMap.has(domKey) && (!claimedDomKeys.has(domKey) || SEEDED_STATIC_IDS.has(sec.id))) {
      return { isDynamic: false, key: domKey };
    }

    // Otherwise, treat as a dynamic section
    return { isDynamic: true, key: `dynamic:${sec.id}` };
  }

  // --- 3. Dynamic Section Renderers ---

  // 3a. Dynamic Product Grid
  function buildProductGridSection(sec) {
    const config = sec.content_config || {};
    const bg = sec.background_config || {};
    const secId = `dynamic-sec-${sec.id || Math.random().toString(36).slice(2, 9)}`;

    let existing = document.getElementById(secId);
    if (!existing) {
      existing = document.createElement('section');
      existing.id = secId;
      existing.className = 'custom-product-grid-section';
    }

    // Background & Spacing
    existing.style.padding = bg.padding === 'compact' ? '40px 0' : (bg.padding === 'spacious' ? '90px 0' : '64px 0');
    if (bg.bg_color) {
      existing.style.backgroundColor = bg.bg_color;
    }

    // Products resolution
    let products = Array.isArray(window.PRODUCTS_DATA) ? [...window.PRODUCTS_DATA] : [];
    const source = config.source || 'all';

    if (source === 'category' && config.category) {
      products = products.filter(p => (p.category || '').toLowerCase() === config.category.toLowerCase() || (p.category_id && String(p.category_id) === String(config.category)));
    } else if (source === 'brand' && config.brand) {
      products = products.filter(p => (p.brand || '').toLowerCase() === config.brand.toLowerCase());
    } else if (source === 'trending') {
      products = products.filter(p => p.isTrending || p.is_trending || p.rating >= 4.7);
    } else if (source === 'deals') {
      products = products.filter(p => (p.discount || 0) > 0 || (p.originalPrice && p.originalPrice > p.price));
    } else if (source === 'new_arrivals') {
      products = products.filter(p => p.isNew || p.is_new);
    } else if (source === 'specific' && Array.isArray(config.product_ids) && config.product_ids.length > 0) {
      const idSet = new Set(config.product_ids.map(id => String(id).toLowerCase()));
      products = products.filter(p => idSet.has(String(p.id).toLowerCase()) || (p.legacyId && idSet.has(String(p.legacyId).toLowerCase())) || (p.supabase_id && idSet.has(String(p.supabase_id).toLowerCase())));
    }

    const limit = parseInt(config.limit, 10) || 8;
    const displayProducts = products.slice(0, limit);

    if (displayProducts.length === 0) {
      existing.style.display = 'none';
      return existing;
    }
    existing.style.display = '';

    const showPrice = config.show_price !== false;
    const showRating = config.show_rating !== false;
    const showDiscount = config.show_discount !== false;
    const showWishlist = config.show_wishlist !== false;
    const showAddToCart = config.show_add_to_cart !== false;

    const viewAllHtml = (config.view_all_link && config.view_all_text) ? `
      <a href="${config.view_all_link}" class="view-all-link">
        <span>${config.view_all_text}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      </a>` : '';

    existing.innerHTML = `
      <div class="container">
        <div class="section-header" style="margin-bottom: 32px;">
          <div class="section-title-wrap">
            ${sec.subtitle ? `
              <span class="section-eyebrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>
                ${sec.subtitle}
              </span>` : ''}
            <h2 class="section-title">${sec.title || 'Curated Collection'}</h2>
          </div>
          ${viewAllHtml}
        </div>
        <div class="products-grid products-grid-5col">
          ${displayProducts.map(p => {
            if (typeof window.createProductCardHTML === 'function') {
              return window.createProductCardHTML(p);
            }
            const discountBadge = (showDiscount && (p.discount || 0) > 0) 
              ? `<span class="product-badge badge-sale">-${p.discount}%</span>` : '';
            const ratingHtml = showRating ? `
              <div class="product-card-rating">
                <span class="stars-list">★</span>
                <span class="stars-score">${p.rating || '4.8'}</span>
                <span class="reviews-count">(${p.reviewsCount || 24})</span>
              </div>` : '';
            const priceHtml = showPrice ? `
              <div class="product-card-price-row">
                <span class="price-current">${formatPrice(p.price)}</span>
                ${(p.originalPrice && p.originalPrice > p.price) ? `<span class="price-original">${formatPrice(p.originalPrice)}</span>` : ''}
              </div>` : '';

            const isSaved = (window.VadiWishlist && typeof window.VadiWishlist.has === 'function') ? window.VadiWishlist.has(p.id) : false;

            return `
              <div class="product-card" data-product-id="${p.id}">
                <div class="product-card-media">
                  ${discountBadge}
                  ${showWishlist ? `
                    <button type="button" class="wishlist-btn ${isSaved ? 'active' : ''}" data-wishlist-id="${p.id}" aria-label="Add to Wishlist">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    </button>` : ''}
                  <a href="product.html?id=${p.id}" class="product-img-link">
                    <img src="${p.image}" alt="${p.name}" loading="lazy" class="product-card-img" />
                  </a>
                  <button type="button" class="quick-view-overlay-btn" data-quickview-id="${p.id}" aria-label="Quick View">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    <span>Quick View</span>
                  </button>
                </div>
                <div class="product-card-body">
                  <span class="product-category-label">${p.brand || 'VADI'}</span>
                  <h4 class="product-card-name" title="${p.name}">
                    <a href="product.html?id=${p.id}">${p.name}</a>
                  </h4>
                  ${ratingHtml}
                  ${priceHtml}
                  ${showAddToCart ? `
                    <button type="button" class="btn-add-to-cart" data-cart-id="${p.id}" style="width: 100%; margin-top: 10px;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                      <span>Add to Bag</span>
                    </button>` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;

    return existing;
  }

  // 3b. Dynamic Promotional Feature Banner
  function buildPromotionalBannerSection(sec) {
    const config = sec.content_config || {};
    const secId = `dynamic-sec-${sec.id || Math.random().toString(36).slice(2, 9)}`;

    let existing = document.getElementById(secId);
    if (!existing) {
      existing = document.createElement('section');
      existing.id = secId;
      existing.className = 'custom-promo-banner-section';
    }

    const imgUrl = config.image_url || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80';
    const ctaLink = config.cta_link || 'shop.html';
    const ctaText = config.cta_text || 'Explore Offer';
    const align = config.text_align || 'left';

    existing.style.padding = '40px 0';
    existing.innerHTML = `
      <div class="container">
        <div class="custom-promo-card" style="position: relative; overflow: hidden; border-radius: 16px; min-height: 280px; display: flex; align-items: center; padding: 40px; background: linear-gradient(rgba(10,14,26,0.85), rgba(10,14,26,0.92)), url('${imgUrl}') center/cover no-repeat; border: 1px solid rgba(255,255,255,0.08);">
          <div style="max-width: 620px; z-index: 2; text-align: ${align}; ${align === 'center' ? 'margin: 0 auto;' : ''}">
            ${sec.subtitle ? `<div class="section-eyebrow" style="display:inline-flex; margin-bottom:12px; background: rgba(220,38,38,0.15); color: #f87171; border: 1px solid rgba(220,38,38,0.3); border-radius: 999px; padding: 4px 14px; font-size: 0.8rem; font-weight: 600;">${sec.subtitle}</div>` : ''}
            <h3 style="font-family: var(--font-display); font-size: clamp(1.6rem, 3vw, 2.4rem); font-weight: 700; color: #fff; line-height: 1.2; margin-bottom: 12px;">${sec.title || 'Exclusive Seasonal Feature'}</h3>
            ${config.body_text ? `<p style="font-size: 1rem; color: #94a3b8; line-height: 1.6; margin-bottom: 24px;">${config.body_text}</p>` : ''}
            <a href="${ctaLink}" class="btn-primary" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; border-radius: 8px; font-weight: 600;">
              <span>${ctaText}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </a>
          </div>
        </div>
      </div>`;

    return existing;
  }

  // 3c. Dynamic Category Grid Showcase
  function buildCategoryGridSection(sec) {
    const config = sec.content_config || {};
    const bg = sec.background_config || {};
    const secId = `dynamic-sec-${sec.id || Math.random().toString(36).slice(2, 9)}`;

    let existing = document.getElementById(secId);
    if (!existing) {
      existing = document.createElement('section');
      existing.id = secId;
      existing.className = 'custom-category-grid-section';
    }

    existing.style.padding = bg.padding === 'compact' ? '40px 0' : (bg.padding === 'spacious' ? '90px 0' : '64px 0');
    if (bg.bg_color) existing.style.backgroundColor = bg.bg_color;

    // Categories list from window.CATEGORIES_DATA
    let categories = Array.isArray(window.CATEGORIES_DATA) ? [...window.CATEGORIES_DATA] : [];
    if (Array.isArray(config.categories) && config.categories.length > 0) {
      const catSet = new Set(config.categories.map(c => String(c).toLowerCase()));
      categories = categories.filter(c => catSet.has(String(c.id).toLowerCase()) || catSet.has(String(c.name).toLowerCase()) || catSet.has(String(c.slug).toLowerCase()));
    }

    const viewAllHtml = (config.view_all_link && config.view_all_text) ? `
      <a href="${config.view_all_link}" class="view-all-link">
        <span>${config.view_all_text}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      </a>` : '';

    existing.innerHTML = `
      <div class="container">
        <div class="section-header" style="margin-bottom: 32px;">
          <div class="section-title-wrap">
            ${sec.subtitle ? `
              <span class="section-eyebrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>
                ${sec.subtitle}
              </span>` : ''}
            <h2 class="section-title">${sec.title || 'Shop By Category'}</h2>
          </div>
          ${viewAllHtml}
        </div>
        <div class="categories-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px;">
          ${categories.map(cat => {
            const img = cat.image || cat.image_url || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80';
            const link = `shop.html?category=${cat.slug || cat.id}`;
            const count = cat.itemCount || 'Curated';

            return `
              <a href="${link}" class="category-card" style="text-decoration: none; border-radius: 12px; overflow: hidden; position: relative; display: block; aspect-ratio: 4/5; border: 1px solid var(--border-color, rgba(255,255,255,0.08));">
                <img src="${img}" alt="${cat.name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease;" class="category-card-img" />
                <div style="position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba(10,14,26,0.92) 100%); display: flex; flex-direction: column; justify-content: flex-end; padding: 18px;">
                  <span style="font-size: 0.78rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${count}</span>
                  <h3 style="font-size: 1.15rem; font-weight: 700; color: #ffffff; margin: 0;">${cat.name}</h3>
                </div>
              </a>`;
          }).join('')}
        </div>
      </div>`;

    return existing;
  }

  // 3d. Dynamic Brand Showcase Strip
  function buildBrandStripSection(sec) {
    const config = sec.content_config || {};
    const bg = sec.background_config || {};
    const secId = `dynamic-sec-${sec.id || Math.random().toString(36).slice(2, 9)}`;

    let existing = document.getElementById(secId);
    if (!existing) {
      existing = document.createElement('section');
      existing.id = secId;
      existing.className = 'custom-brand-strip-section';
    }

    existing.style.padding = bg.padding === 'compact' ? '32px 0' : '56px 0';
    if (bg.bg_color) existing.style.backgroundColor = bg.bg_color;

    // Sourced brands
    const defaultBrands = [
      { name: "Casio", sub: "Precision Time", badge: "CS", grad: "linear-gradient(135deg, #1e293b, #334155)" },
      { name: "G-Shock", sub: "Tough Shock-Resist", badge: "GS", grad: "linear-gradient(135deg, #000000, #dc2626)" },
      { name: "Titan", sub: "Contemporary Luxury", badge: "TT", grad: "linear-gradient(135deg, #1e1b4b, #4338ca)" },
      { name: "Nike", sub: "Footwear & Sports", badge: "NK", grad: "linear-gradient(135deg, #18181b, #3f3f46)" },
      { name: "Jordan", sub: "Iconic Streetwear", badge: "JD", grad: "linear-gradient(135deg, #991b1b, #dc2626)" },
      { name: "Adidas", sub: "Originals & Speed", badge: "AD", grad: "linear-gradient(135deg, #09090b, #27272a)" },
      { name: "Calvin Klein", sub: "Modern Minimalist", badge: "CK", grad: "linear-gradient(135deg, #09090b, #27272a)" },
      { name: "Lavie", sub: "Chic Totes & Bags", badge: "LV", grad: "linear-gradient(135deg, #831843, #db2777)" }
    ];

    existing.innerHTML = `
      <div class="container">
        <div class="section-header" style="margin-bottom: 24px;">
          <div class="section-title-wrap">
            ${sec.subtitle ? `
              <span class="section-eyebrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>
                ${sec.subtitle}
              </span>` : ''}
            <h2 class="section-title">${sec.title || 'Curated Labels & Brands'}</h2>
          </div>
        </div>
        <div class="brand-chips-strip" style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
          ${defaultBrands.map(b => `
            <a href="shop.html?brand=${encodeURIComponent(b.name)}" class="brand-card-chip" style="text-decoration: none;">
              <span class="brand-chip-badge" style="background: ${b.grad};">${b.badge}</span>
              <div class="brand-chip-info">
                <span class="brand-chip-name">${b.name}</span>
                <span class="brand-chip-sub">${b.sub}</span>
              </div>
              <span class="brand-chip-arrow">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </span>
            </a>
          `).join('')}
        </div>
      </div>`;

    return existing;
  }

  // 3e. Dynamic Custom Content Block
  function buildCustomSection(sec) {
    const config = sec.content_config || {};
    const bg = sec.background_config || {};
    const secId = `dynamic-sec-${sec.id || Math.random().toString(36).slice(2, 9)}`;

    let existing = document.getElementById(secId);
    if (!existing) {
      existing = document.createElement('section');
      existing.id = secId;
      existing.className = 'custom-content-block-section';
    }

    existing.style.padding = bg.padding === 'compact' ? '32px 0' : (bg.padding === 'spacious' ? '80px 0' : '56px 0');
    if (bg.bg_color) existing.style.backgroundColor = bg.bg_color;

    if (config.html_content) {
      existing.innerHTML = `
        <div class="container">
          <div class="custom-block-inner">${config.html_content}</div>
        </div>`;
      return existing;
    }

    const ctaHtml = (config.button_link && config.button_text) ? `
      <a href="${config.button_link}" class="btn-primary" style="display: inline-flex; align-items: center; gap: 8px; margin-top: 20px;">
        <span>${config.button_text}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </a>` : '';

    existing.innerHTML = `
      <div class="container">
        <div class="custom-block-card" style="border-radius: 16px; padding: 40px; background: var(--bg-surface, #131b2e); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); text-align: ${config.alignment || 'left'};">
          ${sec.subtitle ? `<span class="section-eyebrow" style="margin-bottom: 12px; display: inline-flex;">${sec.subtitle}</span>` : ''}
          <h2 class="section-title" style="margin-bottom: 14px;">${sec.title || 'Curated Feature'}</h2>
          ${config.body_text ? `<p style="font-size: 1.05rem; color: #94a3b8; line-height: 1.6; max-width: 700px; ${config.alignment === 'center' ? 'margin: 0 auto;' : ''}">${config.body_text}</p>` : ''}
          ${ctaHtml}
        </div>
      </div>`;

    return existing;
  }

  // --- 4. Main Dynamic Section Engine Controller ---
  async function applyDynamicHomepageSections(forceFresh = false) {
    const mainContainer = document.getElementById('homepage-main') || document.querySelector('main');
    if (!mainContainer) return;

    // Scan existing DOM children into logical units
    const domUnits = [];
    let activeUnit = null;

    Array.from(mainContainer.children).forEach(child => {
      const isDivider = child.classList.contains('p3d-scene-divider');
      const companionFor = child.getAttribute('data-section-companion');
      const key = getDomElementKey(child);

      if (companionFor && activeUnit && activeUnit.key === companionFor) {
        // Companion section (e.g. trending promo or bogo promo card)
        activeUnit.elements.push(child);
      } else if (isDivider && activeUnit) {
        // Scene divider attached to preceding section
        activeUnit.elements.push(child);
      } else if (key) {
        activeUnit = { key, elements: [child] };
        domUnits.push(activeUnit);
      } else if (activeUnit) {
        // Trailing elements attached to active unit
        activeUnit.elements.push(child);
      }
    });

    const domUnitMap = new Map(domUnits.map(u => [u.key, u]));

    const sections = await fetchHomepageSections(forceFresh);
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      // Keep static HTML structure untouched
      return;
    }

    // Sort strictly by integer display_order
    const sorted = [...sections].sort((a, b) => {
      const orderA = parseInt(a.display_order, 10) || 0;
      const orderB = parseInt(b.display_order, 10) || 0;
      return orderA - orderB;
    });

    // Save to local storage for immediate next load
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    } catch (_) {}

    // Resolve binding for each section
    const claimedDomKeys = new Set();
    const resolvedSections = sorted.map(sec => {
      const binding = resolveSectionBinding(sec, domUnitMap, claimedDomKeys);
      if (!binding.isDynamic) {
        claimedDomKeys.add(binding.key);
      }
      return {
        sec,
        isDynamic: binding.isDynamic,
        key: binding.key,
        active: isSectionActive(sec)
      };
    });

    // Check if there are ANY dynamic sections or unmapped sections
    const hasDynamic = resolvedSections.some(r => r.isDynamic);

    // Check if order of static sections matches natural DOM order
    const staticKeysInOrder = resolvedSections.filter(r => !r.isDynamic).map(r => r.key);
    const domKeys = domUnits.map(u => u.key);

    let isStaticOrderUnchanged = true;
    let lastDomIndex = -1;
    for (const key of staticKeysInOrder) {
      const domIndex = domKeys.indexOf(key);
      if (domIndex < lastDomIndex) {
        isStaticOrderUnchanged = false;
        break;
      }
      lastDomIndex = domIndex;
    }

    // =========================================================================
    // FAST PATH: If NO dynamic sections and static order is completely untouched,
    // NEVER re-append DOM elements! Guarantees 0ms layout shift on default load.
    // =========================================================================
    if (!hasDynamic && isStaticOrderUnchanged) {
      resolvedSections.forEach(({ sec, key, active }) => {
        const unit = domUnitMap.get(key);
        if (!unit) return;

        unit.elements.forEach(el => {
          el.style.display = active ? '' : 'none';
        });

        // Update custom title / subtitle if modified in Admin Panel
        if (active && sec.title && sec.section_type !== 'hero' && sec.section_type !== 'advertisement') {
          const mainEl = unit.elements[0];
          const titleEl = mainEl.querySelector('.section-title, .brands-section-title');
          if (titleEl) titleEl.textContent = sec.title;
        }
        if (active && sec.subtitle && sec.section_type !== 'hero' && sec.section_type !== 'advertisement') {
          const mainEl = unit.elements[0];
          const subEl = mainEl.querySelector('.section-subtitle, .section-eyebrow');
          if (subEl) {
            if (subEl.classList.contains('section-eyebrow')) {
              subEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg> ${sec.subtitle}`;
            } else {
              subEl.textContent = sec.subtitle;
            }
          }
        }
      });
      return;
    }

    // =========================================================================
    // REORDER & DYNAMIC RENDER PATH:
    // Reorders DOM units and renders custom dynamic sections in exact display order
    // =========================================================================
    const orderedUnits = [];
    const usedUnitKeys = new Set();

    resolvedSections.forEach(({ sec, isDynamic, key, active }) => {
      if (isDynamic) {
        let dynEl = null;
        const type = sec.section_type;

        if (type === 'product_grid') {
          dynEl = buildProductGridSection(sec);
        } else if (type === 'promotional_banner') {
          dynEl = buildPromotionalBannerSection(sec);
        } else if (type === 'category_grid' || type === 'categories') {
          dynEl = buildCategoryGridSection(sec);
        } else if (type === 'brands') {
          dynEl = buildBrandStripSection(sec);
        } else if (type === 'custom') {
          dynEl = buildCustomSection(sec);
        } else {
          console.error("Unsupported homepage section type: " + type, sec);
          return;
        }

        if (dynEl) {
          if (!active) {
            dynEl.style.display = 'none';
            if (dynEl.parentNode && typeof dynEl.parentNode.removeChild === 'function') {
              dynEl.parentNode.removeChild(dynEl);
            }
          } else {
            dynEl.style.display = '';
            orderedUnits.push({ key, elements: [dynEl] });
          }
        }
        return;
      }

      // Static DOM Section
      const unit = domUnitMap.get(key);
      if (unit) {
        usedUnitKeys.add(key);
        unit.elements.forEach(el => {
          el.style.display = active ? '' : 'none';
        });

        if (active && sec.title && sec.section_type !== 'hero' && sec.section_type !== 'advertisement') {
          const mainEl = unit.elements[0];
          const titleEl = mainEl.querySelector('.section-title, .brands-section-title');
          if (titleEl) titleEl.textContent = sec.title;
        }
        if (active && sec.subtitle && sec.section_type !== 'hero' && sec.section_type !== 'advertisement') {
          const mainEl = unit.elements[0];
          const subEl = mainEl.querySelector('.section-subtitle, .section-eyebrow');
          if (subEl) {
            if (subEl.classList.contains('section-eyebrow')) {
              subEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg> ${sec.subtitle}`;
            } else {
              subEl.textContent = sec.subtitle;
            }
          }
        }

        // Ensure Sarojini Bazaar section is ordered right before Shop by Category
        if (key === 'categories' && domUnitMap.has('sarojini_bazaar') && !usedUnitKeys.has('sarojini_bazaar')) {
          const sarojiniUnit = domUnitMap.get('sarojini_bazaar');
          usedUnitKeys.add('sarojini_bazaar');
          orderedUnits.push(sarojiniUnit);
        }

        orderedUnits.push(unit);

        // Keep carousel attached to below_trending if not placed separately
        if (key === 'advertisement:below_trending' && domUnitMap.has('advertisement:carousel') && !usedUnitKeys.has('advertisement:carousel')) {
          const carouselUnit = domUnitMap.get('advertisement:carousel');
          usedUnitKeys.add('advertisement:carousel');
          orderedUnits.push(carouselUnit);
        }
      }
    });

    // Append any unplaced standard DOM units in their natural sequence (e.g. newsletter)
    domUnits.forEach(u => {
      if (!usedUnitKeys.has(u.key)) {
        orderedUnits.push(u);
        usedUnitKeys.add(u.key);
      }
    });

    // Re-parent all units in correct display order
    orderedUnits.forEach(unit => {
      unit.elements.forEach(el => {
        mainContainer.appendChild(el);
      });
    });

    // Clean up any stale or inactive dynamic sections left in mainContainer
    const activeDynamicElements = new Set(orderedUnits.flatMap(u => u.elements));
    const allDynamicInDom = mainContainer.querySelectorAll ? 
      mainContainer.querySelectorAll('.custom-product-grid-section, .custom-promo-banner-section, .custom-category-grid-section, .custom-brand-strip-section, .custom-content-block-section') : [];
    Array.from(allDynamicInDom).forEach(el => {
      if (!activeDynamicElements.has(el)) {
        if (el.parentNode && typeof el.parentNode.removeChild === 'function') {
          el.parentNode.removeChild(el);
        }
      }
    });

    // Synchronize product card buttons state with cart if available
    if (typeof window.syncProductCartButtons === 'function') {
      window.syncProductCartButtons();
    }
  }

  // --- 5. Delegated Event Handlers for Dynamic Sections ---
  document.addEventListener('click', (e) => {
    // Add to Bag click in dynamic section
    const addCartBtn = e.target.closest('.custom-product-grid-section .btn-add-to-cart');
    if (addCartBtn) {
      e.preventDefault();
      const pid = addCartBtn.getAttribute('data-cart-id');
      if (pid) {
        if (typeof window.toggleCart === 'function') {
          window.toggleCart(pid);
        } else if (typeof window.addToCart === 'function') {
          window.addToCart(pid);
        }
      }
      return;
    }

    // Wishlist click in dynamic section
    const wishBtn = e.target.closest('.custom-product-grid-section .wishlist-btn, .custom-product-grid-section .btn-wishlist-toggle');
    if (wishBtn) {
      e.preventDefault();
      const wid = wishBtn.getAttribute('data-wishlist-id');
      if (wid && typeof window.toggleWishlist === 'function') {
        window.toggleWishlist(wid);
      }
      return;
    }

    // Quick View click in dynamic section
    const qvBtn = e.target.closest('.custom-product-grid-section .quick-view-overlay-btn, .custom-product-grid-section .btn-quick-view');
    if (qvBtn) {
      e.preventDefault();
      const qid = qvBtn.getAttribute('data-quickview-id') || qvBtn.getAttribute('data-product-id');
      if (qid && typeof window.openQuickView === 'function') {
        window.openQuickView(qid);
      }
    }
  });

  // --- 6. Initialization & Reactive Listeners ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyDynamicHomepageSections();
    });
  } else {
    applyDynamicHomepageSections();
  }

  // Reactive listener for Admin Panel saves
  window.addEventListener('velora:homepage-sections-updated', () => {
    applyDynamicHomepageSections(true);
  });

  // Reactive listener for product data synchronization
  window.addEventListener('velora:products-synced', () => {
    applyDynamicHomepageSections(false);
  });

  // Cross-tab storage updates
  window.addEventListener('storage', (e) => {
    if (e.key === 'velora_global_cache_invalidated' || e.key === STORAGE_KEY) {
      applyDynamicHomepageSections(true);
    }
  });

  // Export engine helper
  window.VadiHomepageSections = {
    refresh: () => applyDynamicHomepageSections(true),
    fetchSections: fetchHomepageSections
  };
})();
