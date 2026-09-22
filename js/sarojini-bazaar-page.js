/**
 * VADI - Sarojini Bazaar Storefront Page Controller
 * Connects to Supabase sarojini_products, sarojini_categories, and banners tables
 * Full support for shared Wishlist (VadiWishlist) and Cart Drawer (CartDrawer)
 */

(function () {
  'use strict';

  function formatINR(amount) {
    if (typeof window.formatINR === 'function') return window.formatINR(amount);
    const n = Math.round(Number(amount) || 0);
    return '₹' + n.toLocaleString('en-IN');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  // --------------------------------------------------------------------------
  // 1. DYNAMIC TOP ANNOUNCEMENT BAR (From Supabase banners table / store_settings)
  // --------------------------------------------------------------------------
  async function initAnnouncementBar() {
    const barEl = document.getElementById('sarojini-top-announcement');
    if (!barEl) return;

    try {
      const client = window.supabaseClient || (window.supabase && typeof window.supabase.createClient === 'function' ? window.supabase : null);
      let announcements = [];

      if (client && typeof client.from === 'function') {
        const { data, error } = await client
          .from('banners')
          .select('title, cta_text, cta_link, badge_text, is_active')
          .eq('is_active', true)
          .eq('placement', 'top_announcement')
          .order('sort_order', { ascending: true })
          .limit(5);

        if (!error && Array.isArray(data) && data.length > 0) {
          announcements = data;
        }
      }

      if (announcements.length > 0) {
        let currentIndex = 0;
        const renderAd = (ad) => {
          const badgeHtml = ad.badge_text ? `<span class="announcement-badge">${escapeHtml(ad.badge_text)}</span>` : `<span class="announcement-badge">🔥 BAZAAR ALERT</span>`;
          const ctaHtml = ad.cta_link ? `<a href="${escapeHtml(ad.cta_link)}">${escapeHtml(ad.cta_text || 'Shop Now →')}</a>` : '';
          barEl.innerHTML = `
            <div class="sarojini-announcement-inner">
              ${badgeHtml}
              <span class="announcement-text">${escapeHtml(ad.title)} ${ctaHtml}</span>
            </div>
          `;
        };

        renderAd(announcements[0]);

        if (announcements.length > 1) {
          setInterval(() => {
            currentIndex = (currentIndex + 1) % announcements.length;
            renderAd(announcements[currentIndex]);
          }, 6000);
        }
      } else {
        // Authentic default Sarojini banner
        barEl.innerHTML = `
          <div class="sarojini-announcement-inner">
            <span class="announcement-badge">🛍️ DELHI BAZAAR</span>
            <span class="announcement-text">
              Direct Street Rates Across India • 7-Day Easy Replacements • Cash on Delivery &amp; Open Box Delivery
              <a href="sarojini-shop.html">Explore Street Drops →</a>
            </span>
          </div>
        `;
      }
    } catch (e) {
      console.warn('Sarojini announcement notice:', e);
    }
  }

  // --------------------------------------------------------------------------
  // 2. LOAD TRENDING & CURATED SAROJINI FINDS (STRICT ADMIN-CONTROLLED)
  // --------------------------------------------------------------------------
  async function loadTrendingSarojiniProducts() {
    const grid = document.getElementById('trending-products-grid');
    if (!grid) return;

    function renderEmptyState() {
      grid.innerHTML = `
        <div class="sarojini-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: var(--bazaar-surface); border-radius: 20px; border: 1px dashed var(--bazaar-border-strong);">
          <div style="font-size: 3.2rem; margin-bottom: 12px;">🛍️</div>
          <h3 style="font-family: var(--font-serif); font-size: 1.5rem; font-weight: 800; color: var(--bazaar-dark); margin: 0 0 8px 0;">No Finds Curated Yet</h3>
          <p style="color: var(--bazaar-text-muted); font-size: 0.95rem; max-width: 480px; margin: 0 auto 24px auto;">
            Our fashion scouts are currently curating this week's export surplus and street styles directly from Delhi's iconic market lanes.
          </p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <a href="sarojini-shop.html?department=WOMEN" class="btn-hero-primary" style="padding: 10px 24px; font-size: 0.88rem;">Explore Women's Lane</a>
            <a href="sarojini-shop.html?department=MEN" class="btn-hero-secondary" style="padding: 10px 24px; font-size: 0.88rem;">Explore Men's Lane</a>
          </div>
        </div>
      `;
    }

    try {
      const client = window.supabaseClient || (window.supabase && typeof window.supabase.createClient === 'function' ? window.supabase : null);
      let sectionData = null;

      // 1. Fetch configured Sarojini trending section from homepage_sections or store_settings
      if (client && typeof client.from === 'function') {
        try {
          const { data, error } = await client
            .from('homepage_sections')
            .select('*')
            .or('id.eq.22222222-2222-4222-a222-000000000001,section_type.eq.sarojini_trending')
            .limit(1)
            .maybeSingle();

          if (!error && data) {
            sectionData = data;
          }
        } catch (_) {}

        // Fallback: store_settings (key = sarojini_featured_section)
        if (!sectionData) {
          try {
            const { data: sRow } = await client
              .from('store_settings')
              .select('value')
              .eq('key', 'sarojini_featured_section')
              .maybeSingle();

            if (sRow && sRow.value) {
              sectionData = sRow.value;
            }
          } catch (_) {}
        }
      }

      // If no section found or inactive
      if (!sectionData || sectionData.is_active === false) {
        renderEmptyState();
        return;
      }

      // Check scheduling window if configured
      const now = Date.now();
      if (sectionData.start_date && new Date(sectionData.start_date).getTime() > now) {
        renderEmptyState();
        return;
      }
      if (sectionData.end_date && new Date(sectionData.end_date).getTime() < now) {
        renderEmptyState();
        return;
      }

      // Update Section Header if customized by Admin
      if (sectionData.title) {
        const h = document.getElementById('trending-section-heading');
        if (h) h.textContent = sectionData.title;
      }
      if (sectionData.subtitle) {
        const sub = document.getElementById('trending-section-subheading');
        if (sub) sub.textContent = sectionData.subtitle;
      }

      // Extract Admin-selected product IDs
      const cfg = sectionData.content_config || {};
      const configuredProductIds = Array.isArray(cfg.product_ids) ? cfg.product_ids.filter(Boolean) : [];

      // 2. Fetch active products from sarojini_products table
      let fetchedProducts = [];
      if (client && typeof client.from === 'function') {
        try {
          let query = client.from('sarojini_products').select('*').eq('is_active', true);
          if (configuredProductIds.length > 0) {
            query = query.in('id', configuredProductIds);
          } else {
            query = query.eq('is_featured', true);
          }
          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            fetchedProducts = data;
          }
        } catch (_) {}

        // Fallback: store_settings if direct table read fails
        if (fetchedProducts.length === 0) {
          try {
            const { data: sRow } = await client
              .from('store_settings')
              .select('value')
              .eq('key', 'sarojini_products')
              .maybeSingle();

            if (sRow && Array.isArray(sRow.value)) {
              fetchedProducts = sRow.value.filter(p => p.is_active !== false && (configuredProductIds.includes(p.id) || p.is_featured === true));
            }
          } catch (_) {}
        }
      }

      if (fetchedProducts.length === 0) {
        renderEmptyState();
        return;
      }

      // 3. STRICT ORDER PRESERVATION: Map products to exact order, supporting newly featured items
      const productMap = new Map();
      fetchedProducts.forEach(p => productMap.set(String(p.id), p));

      const orderedProducts = [];
      const addedIds = new Set();

      // Configured products in exact sequence
      configuredProductIds.forEach(id => {
        const p = productMap.get(String(id));
        if (p && !addedIds.has(String(p.id))) {
          orderedProducts.push(p);
          addedIds.add(String(p.id));
        }
      });

      // Newly featured products appear at front
      fetchedProducts.forEach(p => {
        if (p.is_featured && !addedIds.has(String(p.id))) {
          orderedProducts.unshift(p);
          addedIds.add(String(p.id));
        }
      });

      const maxLimit = parseInt(cfg.limit, 10) || 6;
      const finalProducts = orderedProducts.slice(0, maxLimit);

      if (finalProducts.length === 0) {
        renderEmptyState();
        return;
      }

      // 4. Render product cards
      renderProductCards(grid, finalProducts);

    } catch (err) {
      console.warn('Sarojini trending load notice:', err);
      renderEmptyState();
    }
  }

  // --------------------------------------------------------------------------
  // 2B. LOAD UNDER ₹299 STEALS (INDEPENDENT BUDGET CATEGORY QUERY)
  // --------------------------------------------------------------------------
  async function loadBudgetSarojiniProducts() {
    const budgetGrid = document.getElementById('budget-products-grid');
    if (!budgetGrid) return;

    try {
      const client = window.supabaseClient || (window.supabase && typeof window.supabase.createClient === 'function' ? window.supabase : null);
      let budgetProducts = [];

      if (client && typeof client.from === 'function') {
        try {
          const { data, error } = await client
            .from('sarojini_products')
            .select('*')
            .eq('is_active', true)
            .lte('price', 299)
            .order('price', { ascending: true })
            .limit(6);

          if (!error && Array.isArray(data) && data.length > 0) {
            budgetProducts = data;
          }
        } catch (_) {}
      }

      if (budgetProducts.length > 0) {
        renderProductCards(budgetGrid, budgetProducts);
      } else {
        const sec = document.getElementById('budget-steals-section');
        if (sec) sec.style.display = 'none';
      }
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 3. RENDER PRODUCT CARDS COMPONENT
  // --------------------------------------------------------------------------
  function renderProductCards(container, productsList) {
    container.innerHTML = productsList.map(prod => {
      const firstImg = (window.VeloraImageUtils && typeof window.VeloraImageUtils.resolveProductImage === 'function')
        ? window.VeloraImageUtils.resolveProductImage(prod, { isAdmin: false })
        : ((Array.isArray(prod.images) && prod.images.length > 0) ? prod.images[0] : (prod.image || 'assets/sarojni/prod-2-graphic-tee.png'));
      
      const fallbackSvg = window.VeloraImageUtils ? window.VeloraImageUtils.getPlaceholderSvg() : 'assets/sarojni/prod-2-graphic-tee.png';
      const price = Number(prod.price) || 0;
      const origPrice = Number(prod.original_price) || price;
      const discount = prod.discount_percentage || (origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0);

      const isWishlisted = (window.VadiWishlist && typeof window.VadiWishlist.has === 'function')
        ? window.VadiWishlist.has(prod.id)
        : false;

      // Real stock indicator (scarcity only if real stock is low)
      const stockCount = Number(prod.stock);
      const isLowStock = !isNaN(stockCount) && stockCount > 0 && stockCount <= 5;
      const stockBadge = isLowStock ? `<span class="product-card-stock-tag">Only ${stockCount} left</span>` : '';

      const deptLabel = prod.department ? `${prod.department}'S LANE` : 'BAZAAR FIND';

      return `
        <div class="sarojini-product-card" data-product-id="${prod.id}">
          <div class="product-card-media">
            <a href="sarojini-product-details.html?id=${encodeURIComponent(prod.id)}">
              <img src="${firstImg}" alt="${escapeHtml(prod.name)}" loading="lazy" onerror="this.onerror=null; this.src='${fallbackSvg}';">
            </a>
            ${discount > 0 ? `<span class="product-card-badge">${discount}% OFF</span>` : `<span class="product-card-badge" style="background: var(--bazaar-ochre);">STEAL</span>`}
            ${stockBadge}
            <button type="button" class="product-card-wishlist ${isWishlisted ? 'active' : ''}" data-prod-id="${prod.id}" aria-label="Save to Wishlist">
              <i class="${isWishlisted ? 'fas' : 'far'} fa-heart"></i>
            </button>
          </div>
          <div class="product-card-body">
            <span class="product-card-dept">${escapeHtml(deptLabel)}</span>
            <a href="sarojini-product-details.html?id=${encodeURIComponent(prod.id)}" class="product-card-title">${escapeHtml(prod.name)}</a>
            <div class="product-card-price-row">
              <span class="price-selling">${formatINR(price)}</span>
              ${origPrice > price ? `<span class="price-original">${formatINR(origPrice)}</span>` : ''}
              ${discount > 0 ? `<span class="price-discount">${discount}% OFF</span>` : ''}
            </div>
            <button type="button" class="btn-card-add-bag" data-prod-id="${prod.id}" data-prod-name="${encodeURIComponent(prod.name)}" data-prod-price="${price}" data-prod-img="${encodeURIComponent(firstImg)}">
              <i class="fas fa-shopping-bag"></i>
              <span>Add to Bag</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Wire Wishlist buttons
    container.querySelectorAll('.product-card-wishlist').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const prodId = btn.getAttribute('data-prod-id');
        const prod = productsList.find(p => String(p.id) === String(prodId));
        
        if (window.VadiWishlist && typeof window.VadiWishlist.toggle === 'function') {
          window.VadiWishlist.toggle(prodId, 'sarojini', prod);
          const isNowActive = window.VadiWishlist.has(prodId);
          btn.classList.toggle('active', isNowActive);
          const icon = btn.querySelector('i');
          if (icon) {
            icon.className = isNowActive ? 'fas fa-heart' : 'far fa-heart';
          }
        } else {
          const isLiked = btn.classList.toggle('active');
          const icon = btn.querySelector('i');
          if (icon) {
            icon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
          }
        }
        syncBadges();
      });
    });

    // Wire Quick Add to Bag buttons
    container.querySelectorAll('.btn-card-add-bag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const prodId = btn.getAttribute('data-prod-id');
        const prodName = decodeURIComponent(btn.getAttribute('data-prod-name'));
        const prodPrice = Number(btn.getAttribute('data-prod-price'));
        const prodImg = decodeURIComponent(btn.getAttribute('data-prod-img'));

        const itemPayload = {
          id: prodId,
          name: prodName,
          price: prodPrice,
          image: prodImg,
          quantity: 1,
          catalog_type: 'sarojini'
        };

        if (window.CartDrawer && typeof window.CartDrawer.addItem === 'function') {
          window.CartDrawer.addItem(itemPayload);
          window.CartDrawer.open();
        } else {
          const cart = JSON.parse(localStorage.getItem('velora_cart') || '[]');
          const existing = cart.find(i => String(i.id) === String(prodId) && i.catalog_type === 'sarojini');
          if (existing) {
            existing.quantity = (Number(existing.quantity) || 1) + 1;
          } else {
            cart.push(itemPayload);
          }
          localStorage.setItem('velora_cart', JSON.stringify(cart));
          window.dispatchEvent(new CustomEvent('velora:cart-updated', { detail: { cart } }));
          syncBadges();
        }

        // Button feedback
        const origText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> <span>Added!</span>';
        setTimeout(() => {
          btn.innerHTML = origText;
        }, 1500);
      });
    });
  }

  // --------------------------------------------------------------------------
  // 4. SYNC BADGES (Cart & Wishlist)
  // --------------------------------------------------------------------------
  function syncBadges() {
    // Cart Count
    try {
      const cart = JSON.parse(localStorage.getItem('velora_cart') || '[]');
      const count = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
      document.querySelectorAll('.cart-count-badge, #nav-cart-count').forEach(el => {
        el.textContent = count;
      });
    } catch (_) {}

    // Wishlist Count
    try {
      let wCount = 0;
      if (window.VadiWishlist && typeof window.VadiWishlist.getAll === 'function') {
        wCount = window.VadiWishlist.getAll().length;
      } else {
        const stored = JSON.parse(localStorage.getItem('velora_wishlist') || '[]');
        wCount = Array.isArray(stored) ? stored.length : 0;
      }
      document.querySelectorAll('.wishlist-count-badge').forEach(el => {
        el.textContent = wCount;
      });
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 5. INITIALIZE ON DOM READY
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    syncBadges();
    initAnnouncementBar();
    loadTrendingSarojiniProducts();
    loadBudgetSarojiniProducts();

    // Wire search form
    const searchForm = document.getElementById('sarojini-search-form');
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        const val = document.getElementById('sarojini-search-input').value.trim();
        if (!val) {
          e.preventDefault();
        }
      });
    }

    // Wire cart trigger button
    const cartBtn = document.getElementById('btn-open-cart');
    if (cartBtn) {
      cartBtn.addEventListener('click', () => {
        if (window.CartDrawer && typeof window.CartDrawer.open === 'function') {
          window.CartDrawer.open();
        }
      });
    }
  });

  window.addEventListener('velora:cart-updated', syncBadges);
  window.addEventListener('vadi:wishlist-updated', syncBadges);
  window.addEventListener('velora:homepage-sections-updated', () => {
    loadTrendingSarojiniProducts();
  });
  window.addEventListener('storage', (e) => {
    if (e.key === 'sarojini_global_cache_invalidated' || e.key === 'velora_global_cache_invalidated') {
      loadTrendingSarojiniProducts();
      loadBudgetSarojiniProducts();
    }
  });
})();
