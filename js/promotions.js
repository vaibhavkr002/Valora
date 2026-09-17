/**
 * VELORA — Dynamic Promotional Campaigns Engine
 * 
 * Drives dynamic promotional banners, the global rotating strip, contextual
 * product badges, and floating discovery toasts using existing Supabase/Admin data.
 */

(function () {
  'use strict';

  function formatINR(val) {
    if (typeof window.formatINR === 'function') return window.formatINR(val);
    const n = Math.round(Number(val) || 0);
    return '₹' + n.toLocaleString('en-IN');
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==========================================================================
  // 1. DYNAMIC CATALOG HELPERS (ZERO HARDCODED PRODUCTS)
  // ==========================================================================

  function getBogoConfigIds() {
    let bogoIds = (window.VELORA_SETTINGS && window.VELORA_SETTINGS.bogo_config && Array.isArray(window.VELORA_SETTINGS.bogo_config.product_ids))
      ? window.VELORA_SETTINGS.bogo_config.product_ids
      : [];

    if (!bogoIds || bogoIds.length === 0) {
      try {
        const cached = localStorage.getItem('velora_bogo_config');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.product_ids)) bogoIds = parsed.product_ids;
        }
      } catch (e) {}
    }

    if (!bogoIds || bogoIds.length === 0) {
      const dealIds = (window.PRODUCTS_DATA || [])
        .filter(p => p.badgeType === 'deal' || p.discountPercent >= 20 || p.isBogo || p.is_bogo)
        .map(p => p.id);
      if (dealIds.length > 0) bogoIds = dealIds;
    }

    return bogoIds || [];
  }

  function getBogoEligibleProducts() {
    if (!window.PRODUCTS_DATA || !Array.isArray(window.PRODUCTS_DATA)) return [];
    const bogoIds = getBogoConfigIds();
    return window.PRODUCTS_DATA.filter(p => {
      if (!p || (!p.name && !p.title) || (!p.image && (!p.images || !p.images[0]))) return false;
      return Boolean(
        p.isBogo ||
        p.is_bogo ||
        (bogoIds.length > 0 && (
          bogoIds.includes(p.id) ||
          (p.supabase_id && bogoIds.includes(p.supabase_id)) ||
          (p.legacyId && bogoIds.includes(p.legacyId))
        ))
      );
    });
  }

  function getTrendingProducts() {
    if (!window.PRODUCTS_DATA || !Array.isArray(window.PRODUCTS_DATA)) return [];
    const trending = window.PRODUCTS_DATA.filter(p => p && (p.isTrending || p.badgeType === 'trending'));
    if (trending.length > 0) return trending;
    // Fallback if catalog not flagged: highest rated or first few
    return window.PRODUCTS_DATA.slice(0, 6);
  }

  // ==========================================================================
  // 2. GLOBAL PROMOTIONAL AD STRIP ROTATOR
  // ==========================================================================
  let stripInterval = null;
  let currentStripIndex = 0;

  function initPromoStrip() {
    const track = document.getElementById('velora-promo-strip-track');
    if (!track) return;

    const items = track.querySelectorAll('.velora-promo-strip-item');
    if (items.length <= 1) return;

    let isStripHovered = false;
    track.addEventListener('mouseenter', () => { isStripHovered = true; });
    track.addEventListener('mouseleave', () => { isStripHovered = false; });

    if (stripInterval) clearInterval(stripInterval);

    stripInterval = setInterval(() => {
      if (isStripHovered) return;

      const prev = items[currentStripIndex];
      currentStripIndex = (currentStripIndex + 1) % items.length;
      const next = items[currentStripIndex];

      prev.classList.remove('is-active');
      prev.classList.add('is-exiting');

      setTimeout(() => {
        prev.classList.remove('is-exiting');
        next.classList.add('is-active');
      }, 300);
    }, 5000);
  }

  // ==========================================================================
  // 3. DYNAMIC HERO BOGO 3D ADVERTISEMENT
  // ==========================================================================
  function renderBogoHeroAd() {
    const container = document.getElementById('bogo-promo-visual');
    if (!container) return;

    const bogoProducts = getBogoEligibleProducts();
    if (bogoProducts.length === 0) return;

    const primary = bogoProducts[0];
    const secondary = bogoProducts[1] || bogoProducts[0];

    const pImg = primary.image || (primary.images && primary.images[0]) || '';
    const sImg = secondary.image || (secondary.images && secondary.images[0]) || '';

    container.innerHTML = `
      <div class="bogo-promo-card-pair">
        <a href="product.html?id=${encodeURIComponent(primary.id)}" class="bogo-float-item primary" title="${escapeHTML(primary.name)}">
          <span class="bogo-float-tag">BUY THIS</span>
          <div class="bogo-float-img-wrap">
            <img src="${pImg}" alt="${escapeHTML(primary.name)}" loading="lazy" />
          </div>
          <div class="bogo-float-title">${escapeHTML(primary.name)}</div>
          <div class="bogo-float-price">${formatINR(primary.price)}</div>
        </a>

        <div class="bogo-plus-circle">+</div>

        <a href="product.html?id=${encodeURIComponent(secondary.id)}" class="bogo-float-item secondary" title="${escapeHTML(secondary.name)}">
          <span class="bogo-float-tag">GET FREE</span>
          <div class="bogo-float-img-wrap">
            <img src="${sImg}" alt="${escapeHTML(secondary.name)}" loading="lazy" />
          </div>
          <div class="bogo-float-title">${escapeHTML(secondary.name)}</div>
          <div class="bogo-float-price"><s style="color:#94a3b8; font-weight:400;">${formatINR(secondary.price)}</s> ₹0</div>
        </a>
      </div>
    `;
  }

  // ==========================================================================
  // 4. DYNAMIC TRENDING NOW 3D SHOWCASE ADVERTISEMENT
  // ==========================================================================
  function renderTrendingShowcaseAd() {
    const grid = document.getElementById('trending-promo-mini-grid');
    if (!grid) return;

    const trending = getTrendingProducts().slice(0, 4);
    if (trending.length === 0) return;

    grid.innerHTML = trending.map(p => {
      const img = p.image || (p.images && p.images[0]) || '';
      return `
        <a href="product.html?id=${encodeURIComponent(p.id)}" class="trending-mini-card" title="${escapeHTML(p.name)}">
          <div class="trending-mini-thumb">
            <span class="trending-mini-pill">🔥 Trending</span>
            <img src="${img}" alt="${escapeHTML(p.name)}" loading="lazy" />
          </div>
          <div class="trending-mini-title">${escapeHTML(p.name)}</div>
          <div class="trending-mini-bottom">
            <span class="trending-mini-price">${formatINR(p.price)}</span>
            <span class="trending-mini-rating">★ ${p.rating || '4.9'}</span>
          </div>
        </a>
      `;
    }).join('');
  }

  // ==========================================================================
  // 5. PRODUCT DETAILS CONTEXTUAL PROMOTIONS
  // ==========================================================================
  function renderContextualProductPromo() {
    const container = document.getElementById('product-contextual-promo');
    if (!container) return;

    // Determine current product from URL or global details
    const urlParams = new URLSearchParams(window.location.search);
    const prodId = urlParams.get('id') || '';

    if (!prodId || !window.PRODUCTS_DATA) return;

    const product = window.PRODUCTS_DATA.find(p => p.id === prodId || p.supabase_id === prodId || (p.legacyId && p.legacyId === prodId));
    if (!product) return;

    const bogoConfigIds = getBogoConfigIds();
    const isBogo = Boolean(
      product.isBogo ||
      product.is_bogo ||
      bogoConfigIds.includes(product.id) ||
      (product.supabase_id && bogoConfigIds.includes(product.supabase_id)) ||
      (product.legacyId && bogoConfigIds.includes(product.legacyId))
    );

    const isTrending = Boolean(product.isTrending || product.badgeType === 'trending');

    if (isBogo) {
      container.innerHTML = `
        <div class="product-contextual-promo promo-bogo">
          <div class="promo-context-left">
            <span class="promo-context-icon">🔥</span>
            <div>
              <div class="promo-context-title">BOGO SALE ELIGIBLE</div>
              <p class="promo-context-desc">Buy this item today & claim an eligible companion gift 100% free.</p>
            </div>
          </div>
          <a href="bogo.html" class="btn-promo-context">Explore BOGO →</a>
        </div>
      `;
      container.style.display = 'block';
    } else if (isTrending) {
      container.innerHTML = `
        <div class="product-contextual-promo promo-trending">
          <div class="promo-context-left">
            <span class="promo-context-icon">⚡</span>
            <div>
              <div class="promo-context-title">TRENDING NOW PICK</div>
              <p class="promo-context-desc">High demand product with limited seasonal production run.</p>
            </div>
          </div>
          <a href="trending.html" class="btn-promo-context">See Trending →</a>
        </div>
      `;
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }
  }

  // ==========================================================================
  // 6. OPTIONAL FLOATING PROMOTIONAL NOTIFICATION
  // ==========================================================================
  let floatingTimer = null;
  let floatingHideTimer = null;

  function initFloatingPromoToast() {
    // Only inject on shopping/product pages, not checkout
    if (window.location.pathname.includes('checkout.html') || window.location.pathname.includes('admin')) {
      return;
    }

    if (sessionStorage.getItem('velora_promo_toast_dismissed') === 'true') {
      return;
    }

    if (document.getElementById('velora-floating-promo')) return;

    const wrap = document.createElement('div');
    wrap.id = 'velora-floating-promo';
    wrap.className = 'velora-floating-promo';

    wrap.innerHTML = `
      <div class="floating-promo-card" id="floating-promo-card">
        <span class="floating-promo-icon" id="floating-promo-icon">🎁</span>
        <div class="floating-promo-content">
          <div class="floating-promo-title" id="floating-promo-title">BOGO SALE IS LIVE</div>
          <p class="floating-promo-desc" id="floating-promo-desc">Buy 1 item, get an eligible companion 100% free.</p>
        </div>
        <a href="bogo.html" class="floating-promo-btn bogo-theme" id="floating-promo-btn">Shop</a>
        <button type="button" class="floating-promo-close" id="floating-promo-close" aria-label="Dismiss">✕</button>
      </div>
    `;

    document.body.appendChild(wrap);

    const closeBtn = document.getElementById('floating-promo-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        wrap.classList.remove('is-visible');
        wrap.classList.add('is-exiting');
        sessionStorage.setItem('velora_promo_toast_dismissed', 'true');
        if (floatingTimer) clearTimeout(floatingTimer);
        if (floatingHideTimer) clearTimeout(floatingHideTimer);
      });
    }

    let isPromoBogo = true;

    function cycleFloatingToast() {
      if (sessionStorage.getItem('velora_promo_toast_dismissed') === 'true') return;

      const titleEl = document.getElementById('floating-promo-title');
      const descEl = document.getElementById('floating-promo-desc');
      const iconEl = document.getElementById('floating-promo-icon');
      const btnEl = document.getElementById('floating-promo-btn');

      if (isPromoBogo) {
        if (iconEl) iconEl.textContent = '🎁';
        if (titleEl) titleEl.textContent = 'BOGO SALE IS LIVE';
        if (descEl) descEl.textContent = 'Buy 1, get eligible piece 100% free';
        if (btnEl) {
          btnEl.textContent = 'Shop BOGO';
          btnEl.href = 'bogo.html';
          btnEl.className = 'floating-promo-btn bogo-theme';
        }
      } else {
        if (iconEl) iconEl.textContent = '⚡';
        if (titleEl) titleEl.textContent = 'TRENDING NOW PICKS';
        if (descEl) descEl.textContent = 'Discover what customers love this week';
        if (btnEl) {
          btnEl.textContent = 'Explore';
          btnEl.href = 'trending.html';
          btnEl.className = 'floating-promo-btn trending-theme';
        }
      }

      isPromoBogo = !isPromoBogo;

      wrap.classList.remove('is-exiting');
      wrap.classList.add('is-visible');

      // Hide after 6.5 seconds
      floatingHideTimer = setTimeout(() => {
        wrap.classList.remove('is-visible');
        wrap.classList.add('is-exiting');
        // Re-appear after 28 seconds
        floatingTimer = setTimeout(cycleFloatingToast, 28000);
      }, 6500);
    }

    // Initial appearance after 5.5s
    floatingTimer = setTimeout(cycleFloatingToast, 5500);
  }

  // ==========================================================================
  // 7. INITIALIZATION CONTROLLER
  // ==========================================================================
  function bootPromotions() {
    initPromoStrip();
    renderBogoHeroAd();
    renderTrendingShowcaseAd();
    renderContextualProductPromo();
    initFloatingPromoToast();
  }

  // Expose API globally
  window.VeloraPromotions = {
    version: '1.0.0',
    getBogoEligibleProducts,
    getBogoProducts: getBogoEligibleProducts,
    getTrendingProducts,
    refresh: bootPromotions
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPromotions);
  } else {
    bootPromotions();
  }

  // Also retry once products are ready
  if (typeof window !== 'undefined') {
    window.addEventListener('productsLoaded', bootPromotions);
  }

})();
