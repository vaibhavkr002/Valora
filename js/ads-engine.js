/**
 * VELORA & SAROJINI BAZAAR - Dynamic Multi-Store Advertisement System & Storefront Engine
 * Single source of truth for customer-facing advertisements and promotional bars.
 * Strictly isolates advertisements between Main VALORA and Sarojini Bazaar, with controlled cross-promotion.
 * Fetches from Supabase (store_settings / banners), validates scheduling and page targeting,
 * supports multi-ad smooth rotation, responsive mobile visuals, and clean zero-ad collapse.
 */

(function () {
  'use strict';

  const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";
  const STORAGE_KEY = 'velora_ads_cache_v3';
  const CACHE_TTL_MS = 120000; // 2 minutes

  // Default seed fallback ONLY if Supabase is completely unreachable and cache is empty
  const DEFAULT_FALLBACK_ADS = [
    {
      id: 'default_vadi_hero_bogo',
      store: 'vadi',
      is_cross_promotion: false,
      title: 'Double Your Style — Buy 1, Get 1 Free',
      subtitle: 'Add any qualifying luxury product to your bag and unlock an instant companion piece 100% free.',
      badge_text: '🔥 EXCLUSIVE CAMPAIGN',
      image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
      mobile_image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=640&q=80',
      cta_text: 'Shop BOGO Collection',
      cta_link: 'bogo.html',
      ad_type: 'bogo',
      placement: 'hero',
      target_pages: ['homepage', 'shop'],
      priority: 5,
      sort_order: 1,
      is_active: true
    },
    {
      id: 'default_vadi_trending_radar',
      store: 'vadi',
      is_cross_promotion: false,
      title: 'Trending Now & Customer Favorites',
      subtitle: 'Discover standout styles capturing nationwide attention with uncompromised craftsmanship.',
      badge_text: '⚡ VELORA RADAR',
      image_url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80',
      mobile_image_url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=640&q=80',
      cta_text: 'View All Trending',
      cta_link: 'trending.html',
      ad_type: 'trending',
      placement: 'between_sections_1',
      target_pages: ['homepage'],
      priority: 4,
      sort_order: 1,
      is_active: true
    },
    {
      id: 'default_sarojini_announcement',
      store: 'sarojini',
      is_cross_promotion: false,
      title: 'Direct Delhi Street Rates Across India',
      subtitle: '7-Day Easy Replacements • Cash on Delivery & Open Box Delivery',
      badge_text: '🛍️ DELHI BAZAAR',
      cta_text: 'Explore Street Drops →',
      cta_link: 'sarojini-shop.html',
      placement: 'top_announcement',
      target_pages: ['all'],
      priority: 5,
      sort_order: 1,
      is_active: true
    },
    {
      id: 'default_sarojini_between_1',
      store: 'sarojini',
      is_cross_promotion: false,
      title: 'Viral Streetwear Drops — Under ₹299',
      subtitle: 'Export surplus tees, cargo joggers, and oversized fits fresh from Sarojini Nagar lanes.',
      badge_text: '🔥 HOT BAZAAR DEAL',
      image_url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=80',
      mobile_image_url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=640&q=80',
      cta_text: 'Shop Street Drops',
      cta_link: 'sarojini-shop.html?department=WOMEN',
      placement: 'between_sections_1',
      target_pages: ['homepage', 'sarojini_homepage'],
      priority: 5,
      sort_order: 1,
      is_active: true
    },
    {
      id: 'default_auth_trending',
      store: 'vadi',
      is_cross_promotion: false,
      title: "Discover What's Trending at VELORA",
      subtitle: 'Handcrafted luxury footwear and precision horology.',
      badge_text: '⚡ TRENDING NOW',
      image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80',
      cta_text: 'Explore Now →',
      cta_link: 'trending.html',
      ad_type: 'floating_card',
      placement: 'auth_visual',
      target_pages: ['auth', 'login', 'signup', 'all'],
      priority: 10,
      sort_order: 1,
      is_active: true
    }
  ];

  // Placement alias mappings to support both simplified and legacy slots
  const PLACEMENT_ALIASES = {
    'top_announcement': ['top_announcement'],
    'hero': ['hero', 'below_hero'],
    'below_hero': ['hero', 'below_hero'],
    'between_sections_1': ['between_sections_1', 'above_trending', 'below_trending'],
    'above_trending': ['between_sections_1', 'above_trending'],
    'below_trending': ['between_sections_1', 'below_trending'],
    'between_sections_2': ['between_sections_2', 'above_new_arrivals', 'above_deals', 'below_bogo'],
    'above_new_arrivals': ['between_sections_2', 'above_new_arrivals'],
    'above_deals': ['between_sections_2', 'above_deals'],
    'below_bogo': ['between_sections_2', 'below_bogo'],
    'product_grid': ['product_grid'],
    'category_page': ['category_page', 'shop_top'],
    'shop_top': ['category_page', 'shop_top'],
    'product_page': ['product_page', 'product_contextual'],
    'product_contextual': ['product_page', 'product_contextual'],
    'cart_checkout': ['cart_checkout', 'checkout_secure', 'cart_drawer'],
    'checkout_secure': ['cart_checkout', 'checkout_secure'],
    'cart_drawer': ['cart_checkout', 'cart_drawer'],
    'floating': ['floating'],
    'auth_visual': ['auth_visual']
  };

  let cachedAds = null;
  let topBarTimer = null;
  let authAdTimer = null;
  const slotTimers = new Map();

  // Helper to escape HTML characters safely
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Detect current store: 'sarojini' vs 'vadi'
  function detectCurrentStore() {
    const path = (window.location.pathname || '').toLowerCase();
    const href = (window.location.href || '').toLowerCase();
    const body = document.body;

    if (
      path.includes('sarojini') ||
      href.includes('sarojini') ||
      (body && (
        body.classList.contains('sarojini-storefront-body') ||
        body.classList.contains('sarojini-body') ||
        body.classList.contains('sarojini-shop-page') ||
        body.classList.contains('sarojini-pdp-page') ||
        body.dataset.store === 'sarojini'
      ))
    ) {
      return 'sarojini';
    }
    return 'vadi';
  }

  // Detect current page key
  function detectCurrentPage() {
    const path = (window.location.pathname || '').toLowerCase();
    const store = detectCurrentStore();

    if (store === 'sarojini') {
      if (path.includes('sarojini-bazaar.html') || path.endsWith('/sarojini') || path.endsWith('/sarojini/')) {
        return 'sarojini_homepage';
      }
      if (path.includes('sarojini-shop.html')) return 'sarojini_shop';
      if (path.includes('sarojini-product-details.html')) return 'sarojini_product';
    }

    if (path.endsWith('index.html') || path.endsWith('homepage.html') || path === '/' || path.endsWith('/')) {
      return 'homepage';
    }
    if (path.includes('login.html')) return 'login';
    if (path.includes('signup.html')) return 'signup';
    if (path.includes('shop.html')) return 'shop';
    if (path.includes('product.html')) return 'product';
    if (path.includes('trending.html')) return 'trending';
    if (path.includes('bogo.html')) return 'bogo';
    if (path.includes('new-arrivals.html')) return 'new_arrivals';
    if (path.includes('deals.html')) return 'deals';
    if (path.includes('wishlist.html')) return 'wishlist';
    if (path.includes('cart')) return 'cart';
    if (path.includes('checkout.html')) return 'checkout';
    if (path.includes('account.html')) return 'account';
    if (path.includes('orders')) return 'orders';
    if (path.includes('about.html')) return 'about';
    if (path.includes('contact')) return 'contact';
    if (path.includes('faq.html')) return 'faq';
    return 'other';
  }

  // Check if placement names match directly or via known aliases
  function isPlacementMatch(adPlacement, slotPlacement) {
    if (!adPlacement || !slotPlacement) return false;
    if (adPlacement === slotPlacement) return true;
    const aliases = PLACEMENT_ALIASES[slotPlacement] || [];
    if (aliases.includes(adPlacement)) return true;
    const adAliases = PLACEMENT_ALIASES[adPlacement] || [];
    return adAliases.includes(slotPlacement);
  }

  // Validate if ad is currently inside schedule window
  function isAdScheduled(ad) {
    const now = Date.now();
    if (ad.start_at) {
      const start = new Date(ad.start_at).getTime();
      if (!isNaN(start) && now < start) return false;
    }
    if (ad.end_at) {
      const end = new Date(ad.end_at).getTime();
      if (!isNaN(end) && now > end) return false;
    }
    return true;
  }

  // Validate if ad targets current page
  function isPageTargeted(ad, currentPage) {
    if (!ad.target_pages || !Array.isArray(ad.target_pages) || ad.target_pages.length === 0) {
      return true; // Default to all if unspecified
    }
    if (ad.target_pages.includes('all')) return true;
    if (currentPage === 'sarojini_homepage' && (ad.target_pages.includes('homepage') || ad.target_pages.includes('sarojini_homepage'))) {
      return true;
    }
    if (currentPage === 'sarojini_shop' && (ad.target_pages.includes('shop') || ad.target_pages.includes('sarojini_shop'))) {
      return true;
    }
    if (currentPage === 'sarojini_product' && (ad.target_pages.includes('product') || ad.target_pages.includes('sarojini_product'))) {
      return true;
    }
    if ((currentPage === 'login' || currentPage === 'signup') && (ad.target_pages.includes('auth') || ad.target_pages.includes('authentication'))) {
      return true;
    }
    return ad.target_pages.includes(currentPage);
  }

  // Normalize ad record ensuring backward and forward compatibility
  function normalizeAdRecord(raw) {
    let targetPages = ['all'];
    if (Array.isArray(raw.target_pages)) {
      targetPages = raw.target_pages;
    } else if (typeof raw.target_pages === 'string') {
      try { targetPages = JSON.parse(raw.target_pages); } catch (_) { targetPages = [raw.target_pages]; }
    }

    const store = (raw.store || 'vadi').toLowerCase();
    const isCrossPromotion = Boolean(raw.is_cross_promotion);
    const targetStore = (raw.target_store || (store === 'sarojini' ? 'vadi' : 'sarojini')).toLowerCase();

    // Default CTA link depending on store
    let defaultLink = (store === 'sarojini') ? 'sarojini-shop.html' : 'shop.html';

    return {
      id: raw.id || 'ad_' + Math.random().toString(36).substring(2, 9),
      store: store,
      is_cross_promotion: isCrossPromotion,
      target_store: targetStore,
      title: raw.title || '',
      subtitle: raw.subtitle || '',
      badge_text: raw.badge_text || raw.badge || '',
      image_url: raw.image_url || '',
      mobile_image_url: raw.mobile_image_url || raw.image_url || '',
      cta_text: raw.cta_text || raw.button_text || 'Shop Now →',
      cta_link: raw.cta_link || raw.button_link || defaultLink,
      ad_type: raw.ad_type || 'standard',
      placement: raw.placement || 'top_announcement',
      target_pages: targetPages,
      priority: Number(raw.priority) || 1,
      sort_order: Number(raw.sort_order !== undefined ? raw.sort_order : (raw.display_order !== undefined ? raw.display_order : 1)),
      start_at: raw.start_at || null,
      end_at: raw.end_at || null,
      is_active: raw.is_active !== false,
      destination_type: raw.destination_type || 'custom',
      product_id: raw.product_id || null,
      category_id: raw.category_id || null,
      style_filter: raw.style_filter || null
    };
  }

  // Fetch all ads from Supabase or cache
  async function fetchAllAdvertisements(forceRefresh = false) {
    if (!forceRefresh && cachedAds) {
      return cachedAds;
    }

    // Check localStorage cache
    if (!forceRefresh) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp < CACHE_TTL_MS)) {
            cachedAds = parsed.ads;
            return cachedAds;
          }
        }
      } catch (_) {}
    }

    let loadedAds = [];
    let dbConnected = false;

    // 1. Authoritative query to store_settings (key: 'advertisements') — rich store & cross-promo support
    try {
      const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/store_settings?key=eq.advertisements`, {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        dbConnected = true;
        const data = await res.json();
        if (data && data[0] && Array.isArray(data[0].value)) {
          loadedAds = data[0].value
            .filter(ad => ad.is_active !== false)
            .map(ad => normalizeAdRecord(ad));
        }
      }
    } catch (err) {
      console.warn("VeloraAds: Notice fetching store_settings ads:", err.message);
    }

    // 2. Also query public.banners table to merge any banners added directly
    try {
      const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/banners?select=*&is_active=eq.true&order=sort_order.asc`, {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }
      });

      if (res.ok) {
        dbConnected = true;
        const data = await res.json();
        if (Array.isArray(data)) {
          const existingIds = new Set(loadedAds.map(a => a.id));
          data.forEach(b => {
            if (!existingIds.has(b.id)) {
              loadedAds.push(normalizeAdRecord(b));
            }
          });
        }
      }
    } catch (err) {
      console.warn("VeloraAds: Notice fetching banners table:", err.message);
    }

    // 3. Ensure both stores have initial ads available even if store_settings has not been saved yet
    const hasSarojiniAd = loadedAds.some(a => (a.store || '').toLowerCase() === 'sarojini');
    if (!hasSarojiniAd) {
      const sarojiniFallbacks = DEFAULT_FALLBACK_ADS.filter(a => a.store === 'sarojini');
      loadedAds.push(...sarojiniFallbacks);
    }
    const hasVadiAd = loadedAds.some(a => (a.store || '').toLowerCase() === 'vadi');
    if (!hasVadiAd) {
      const vadiFallbacks = DEFAULT_FALLBACK_ADS.filter(a => a.store === 'vadi');
      loadedAds.push(...vadiFallbacks);
    }

    cachedAds = loadedAds;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        timestamp: Date.now(),
        ads: loadedAds
      }));
    } catch (_) {}

    return cachedAds;
  }

  // Filter and sort ads for a specific placement on the current page and store
  function getAdsForPlacement(allAds, placement, currentPage, currentStore) {
    return allAds
      .filter(ad => {
        if (!ad.is_active) return false;

        // Store isolation logic
        const adStore = (ad.store || 'vadi').toLowerCase();
        const isCrossPromo = Boolean(ad.is_cross_promotion);

        if (!isCrossPromo) {
          // Native ad: MUST match current storefront
          if (adStore !== currentStore) return false;
        } else {
          // Cross-promotion ad: MUST match explicit target store
          const targetStore = (ad.target_store || (adStore === 'sarojini' ? 'vadi' : 'sarojini')).toLowerCase();
          if (targetStore !== currentStore) return false;
        }

        // Placement match
        if (!isPlacementMatch(ad.placement, placement)) return false;

        // Page targeting match
        if (!isPageTargeted(ad, currentPage)) return false;

        // Scheduling window match
        if (!isAdScheduled(ad)) return false;

        return true;
      })
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return b.priority - a.priority;
      });
  }

  // Clear all running timers
  function clearAllTimers() {
    if (topBarTimer) {
      clearInterval(topBarTimer);
      topBarTimer = null;
    }
    if (authAdTimer) {
      clearInterval(authAdTimer);
      authAdTimer = null;
    }
    slotTimers.forEach(timer => clearInterval(timer));
    slotTimers.clear();
  }

  // ==========================================================================
  // RENDERER 1: TOP ANNOUNCEMENT BAR (VADI & SAROJINI)
  // ==========================================================================
  function renderTopAnnouncementBar(ads, currentStore) {
    // 1. Identify announcement bar element for current store
    let bar = null;
    if (currentStore === 'sarojini') {
      bar = document.getElementById('sarojini-top-announcement') || document.querySelector('.sarojini-announcement-bar');
    } else {
      bar = document.querySelector('.top-announcement-bar');
    }

    if (!bar) return;

    if (topBarTimer) {
      clearInterval(topBarTimer);
      topBarTimer = null;
    }

    // Clean collapse if 0 ads configured
    if (ads.length === 0) {
      bar.style.display = 'none';
      bar.setAttribute('aria-hidden', 'true');
      return;
    }

    bar.style.display = '';
    bar.removeAttribute('aria-hidden');

    // Sarojini top announcement rendering
    if (currentStore === 'sarojini') {
      renderSarojiniTopBar(bar, ads);
    } else {
      renderVadiTopBar(bar, ads);
    }
  }

  function renderSarojiniTopBar(bar, ads) {
    let inner = bar.querySelector('.sarojini-announcement-inner');
    if (!inner) {
      inner = document.createElement('div');
      inner.className = 'sarojini-announcement-inner';
      bar.appendChild(inner);
    }

    const slidesHtml = ads.map((ad, idx) => {
      const activeClass = (idx === 0) ? 'active' : '';
      const crossPill = ad.is_cross_promotion ? `<span class="sarojini-cross-promo-pill">VALORA LUXURY DROP</span>` : '';
      const badgeHtml = ad.badge_text ? `<span class="announcement-badge">${escapeHTML(ad.badge_text)}</span>` : '';
      const titleHtml = `<span class="sarojini-announcement-title">${escapeHTML(ad.title)}</span>`;
      const subtitleHtml = ad.subtitle ? ` • <span>${escapeHTML(ad.subtitle)}</span>` : '';
      const ctaHtml = ad.cta_text ? `<a href="${escapeHTML(ad.cta_link)}" class="sarojini-announcement-link">${escapeHTML(ad.cta_text)}</a>` : '';

      return `
        <div class="sarojini-announcement-slide ${activeClass}" data-index="${idx}">
          ${crossPill}
          ${badgeHtml}
          <span class="announcement-text">
            ${titleHtml}${subtitleHtml}
            ${ctaHtml}
          </span>
        </div>
      `;
    }).join('');

    inner.innerHTML = `
      <div class="sarojini-announcement-carousel" id="sarojini-announcement-carousel">
        ${slidesHtml}
      </div>
    `;

    // Multi-ad smooth rotation
    if (ads.length > 1) {
      const carouselEl = inner.querySelector('#sarojini-announcement-carousel');
      let currentIdx = 0;
      let isHovered = false;

      carouselEl.addEventListener('mouseenter', () => { isHovered = true; });
      carouselEl.addEventListener('mouseleave', () => { isHovered = false; });
      carouselEl.addEventListener('touchstart', () => { isHovered = true; }, { passive: true });

      topBarTimer = setInterval(() => {
        if (isHovered) return;
        const slides = carouselEl.querySelectorAll('.sarojini-announcement-slide');
        if (slides.length <= 1) return;

        slides[currentIdx].classList.remove('active');
        currentIdx = (currentIdx + 1) % slides.length;
        slides[currentIdx].classList.add('active');
      }, 5000);
    }
  }

  function renderVadiTopBar(bar, ads) {
    let inner = bar.querySelector('.inner');
    if (!inner) {
      inner = document.createElement('div');
      inner.className = 'inner';
      bar.appendChild(inner);
    }

    // Preserve right links (Our Story, Track Order, Support)
    let rightLinksHtml = '';
    const existingRight = inner.querySelector('.top-bar-right-links');
    if (existingRight) {
      rightLinksHtml = existingRight.outerHTML;
    } else {
      rightLinksHtml = `
        <div class="top-bar-right-links">
          <a href="about.html">Our Story</a>
          <span>•</span>
          <a href="account.html#orders">Track Order</a>
          <span>•</span>
          <a href="contact-support.html">Support 24/7</a>
        </div>
      `;
    }

    const slidesHtml = ads.map((ad, idx) => {
      const activeClass = (idx === 0) ? 'active' : '';
      const crossPill = ad.is_cross_promotion ? `<span class="vadi-cross-promo-pill">🛍️ SAROJINI BAZAAR</span>` : '';
      const badgeHtml = ad.badge_text ? `<span class="announcement-badge">${escapeHTML(ad.badge_text)}</span>` : '';
      const subtitleSep = (ad.title && ad.subtitle) ? '<span class="announcement-sep">|</span>' : '';
      const subtitleHtml = ad.subtitle ? `<span class="announcement-sub-label">${escapeHTML(ad.subtitle)}</span>` : '';
      const ctaHtml = ad.cta_text ? `<a href="${escapeHTML(ad.cta_link)}" class="announcement-action-link">${escapeHTML(ad.cta_text)}</a>` : '';

      return `
        <div class="announcement-slide ${activeClass}" data-index="${idx}" data-link="${escapeHTML(ad.cta_link)}">
          ${crossPill}
          ${badgeHtml}
          <span class="announcement-content">
            <span class="announcement-text-label">${escapeHTML(ad.title)}</span>
            ${subtitleSep}
            ${subtitleHtml}
            ${ctaHtml}
          </span>
        </div>
      `;
    }).join('');

    inner.innerHTML = `
      <div class="announcement-carousel" id="announcement-carousel">
        ${slidesHtml}
      </div>
      ${rightLinksHtml}
    `;

    // Multi-ad smooth rotation
    if (ads.length > 1) {
      const carouselEl = inner.querySelector('#announcement-carousel');
      let currentIdx = 0;
      let isHovered = false;

      carouselEl.addEventListener('mouseenter', () => { isHovered = true; });
      carouselEl.addEventListener('mouseleave', () => { isHovered = false; });
      carouselEl.addEventListener('touchstart', () => { isHovered = true; }, { passive: true });

      topBarTimer = setInterval(() => {
        if (isHovered) return;
        const slides = carouselEl.querySelectorAll('.announcement-slide');
        if (slides.length <= 1) return;

        slides[currentIdx].classList.remove('active');
        currentIdx = (currentIdx + 1) % slides.length;
        slides[currentIdx].classList.add('active');
      }, 5000);
    }
  }

  // ==========================================================================
  // RENDERER 2: SECTION ADVERTISEMENT SLOTS (SINGLE & MULTI-AD ROTATION)
  // ==========================================================================
  function renderAdSlots(allAds, currentPage, currentStore) {
    const slots = document.querySelectorAll('.velora-ad-slot, .sarojini-ad-slot, [data-ad-placement]');

    slots.forEach((slot, slotIndex) => {
      // Avoid re-processing the top bar via generic slot logic
      const placement = slot.dataset.adPlacement;
      if (!placement || placement === 'top_announcement' || placement === 'floating' || placement === 'auth_visual') {
        return;
      }

      // Clear any prior rotation timer for this slot
      const timerKey = `slot_${slotIndex}_${placement}`;
      if (slotTimers.has(timerKey)) {
        clearInterval(slotTimers.get(timerKey));
        slotTimers.delete(timerKey);
      }

      const matchingAds = getAdsForPlacement(allAds, placement, currentPage, currentStore);

      // Clean Collapse if 0 ads configured
      if (matchingAds.length === 0) {
        slot.innerHTML = '';
        slot.style.display = 'none';
        slot.setAttribute('aria-hidden', 'true');
        return;
      }

      slot.style.display = '';
      slot.removeAttribute('aria-hidden');

      // SINGLE AD: Static render, zero timers
      if (matchingAds.length === 1) {
        slot.innerHTML = renderSingleAdHtml(matchingAds[0], currentStore);
        return;
      }

      // MULTIPLE ADS: Smooth auto-rotation slider
      slot.innerHTML = renderMultiAdSliderHtml(matchingAds, currentStore, timerKey);
      initSlotSlider(slot, matchingAds.length, timerKey);
    });
  }

  // Generate HTML for a single ad card
  function renderSingleAdHtml(ad, currentStore) {
    const isSarojini = (currentStore === 'sarojini');
    const cardClass = isSarojini ? 'sarojini-ad-card' : 'velora-ad-card';
    const isBogo = (ad.ad_type === 'bogo');
    const isTrending = (ad.ad_type === 'trending');

    let themeClass = 'theme-standard';
    if (isBogo) themeClass = 'theme-bogo';
    if (isTrending) themeClass = 'theme-trending';

    // Cross-promotion pill if promoted from the other store
    let crossPromoHtml = '';
    if (ad.is_cross_promotion) {
      if (isSarojini) {
        crossPromoHtml = `<span class="ad-cross-promo-pill vadi-pill"><i class="fas fa-gem"></i> Curated from Main VALORA Store</span>`;
      } else {
        crossPromoHtml = `<span class="ad-cross-promo-pill sarojini-pill"><i class="fas fa-store-alt"></i> Sarojini Street Bazaar Find</span>`;
      }
    }

    const badgeHtml = ad.badge_text ? `<span class="velora-ad-badge ${isSarojini ? 'sarojini-badge' : ''}">${escapeHTML(ad.badge_text)}</span>` : '';
    const subtitleHtml = ad.subtitle ? `<p class="velora-ad-desc">${escapeHTML(ad.subtitle)}</p>` : '';
    const ctaHtml = ad.cta_text ? `
      <a href="${escapeHTML(ad.cta_link)}" class="velora-ad-btn ${isSarojini ? 'sarojini-btn' : ''}">
        <span>${escapeHTML(ad.cta_text)}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </a>
    ` : '';

    // Responsive background visual
    const desktopImg = ad.image_url;
    const mobileImg = ad.mobile_image_url || desktopImg;
    let visualHtml = '';

    if (desktopImg) {
      visualHtml = `
        <picture class="ad-bg-picture">
          ${mobileImg ? `<source media="(max-width: 640px)" srcset="${escapeHTML(mobileImg)}">` : ''}
          <img src="${escapeHTML(desktopImg)}" alt="${escapeHTML(ad.title)}" class="ad-bg-image" loading="lazy">
        </picture>
        <div class="ad-overlay-gradient"></div>
      `;
    }

    return `
      <div class="container ad-slot-container">
        <div class="${cardClass} ${themeClass}">
          ${visualHtml}
          <div class="velora-ad-content">
            ${crossPromoHtml}
            ${badgeHtml}
            <h2 class="velora-ad-title">${escapeHTML(ad.title)}</h2>
            ${subtitleHtml}
            <div class="velora-ad-actions">
              ${ctaHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Generate HTML for a multi-ad slider track
  function renderMultiAdSliderHtml(ads, currentStore, sliderId) {
    const isSarojini = (currentStore === 'sarojini');
    const cardClass = isSarojini ? 'sarojini-ad-card' : 'velora-ad-card';

    const slidesHtml = ads.map((ad, idx) => {
      const activeClass = (idx === 0) ? 'active' : '';
      const isBogo = (ad.ad_type === 'bogo');
      const isTrending = (ad.ad_type === 'trending');

      let themeClass = 'theme-standard';
      if (isBogo) themeClass = 'theme-bogo';
      if (isTrending) themeClass = 'theme-trending';

      let crossPromoHtml = '';
      if (ad.is_cross_promotion) {
        if (isSarojini) {
          crossPromoHtml = `<span class="ad-cross-promo-pill vadi-pill"><i class="fas fa-gem"></i> Curated from Main VALORA Store</span>`;
        } else {
          crossPromoHtml = `<span class="ad-cross-promo-pill sarojini-pill"><i class="fas fa-store-alt"></i> Sarojini Street Bazaar Find</span>`;
        }
      }

      const badgeHtml = ad.badge_text ? `<span class="velora-ad-badge ${isSarojini ? 'sarojini-badge' : ''}">${escapeHTML(ad.badge_text)}</span>` : '';
      const subtitleHtml = ad.subtitle ? `<p class="velora-ad-desc">${escapeHTML(ad.subtitle)}</p>` : '';
      const ctaHtml = ad.cta_text ? `
        <a href="${escapeHTML(ad.cta_link)}" class="velora-ad-btn ${isSarojini ? 'sarojini-btn' : ''}">
          <span>${escapeHTML(ad.cta_text)}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </a>
      ` : '';

      const desktopImg = ad.image_url;
      const mobileImg = ad.mobile_image_url || desktopImg;
      let visualHtml = '';

      if (desktopImg) {
        visualHtml = `
          <picture class="ad-bg-picture">
            ${mobileImg ? `<source media="(max-width: 640px)" srcset="${escapeHTML(mobileImg)}">` : ''}
            <img src="${escapeHTML(desktopImg)}" alt="${escapeHTML(ad.title)}" class="ad-bg-image" loading="lazy">
          </picture>
          <div class="ad-overlay-gradient"></div>
        `;
      }

      return `
        <div class="ad-slide ${activeClass}" data-slide-index="${idx}">
          <div class="${cardClass} ${themeClass}">
            ${visualHtml}
            <div class="velora-ad-content">
              ${crossPromoHtml}
              ${badgeHtml}
              <h2 class="velora-ad-title">${escapeHTML(ad.title)}</h2>
              ${subtitleHtml}
              <div class="velora-ad-actions">
                ${ctaHtml}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const dotsHtml = `
      <div class="ad-slider-dots">
        ${ads.map((_, i) => `<button type="button" class="ad-slider-dot ${i === 0 ? 'active' : ''}" data-dot-index="${i}" aria-label="Slide ${i + 1}"></button>`).join('')}
      </div>
    `;

    return `
      <div class="container ad-slot-container">
        <div class="ad-slider-wrap" id="${sliderId}">
          <div class="ad-slides-track">
            ${slidesHtml}
          </div>
          ${dotsHtml}
        </div>
      </div>
    `;
  }

  // Initialize auto-rotation slider with hover pause and dot clicking
  function initSlotSlider(slot, totalSlides, timerKey) {
    const wrap = slot.querySelector('.ad-slider-wrap');
    if (!wrap || totalSlides <= 1) return;

    let currentIdx = 0;
    let isHovered = false;

    wrap.addEventListener('mouseenter', () => { isHovered = true; });
    wrap.addEventListener('mouseleave', () => { isHovered = false; });
    wrap.addEventListener('touchstart', () => { isHovered = true; }, { passive: true });

    function goToSlide(targetIdx) {
      const slides = wrap.querySelectorAll('.ad-slide');
      const dots = wrap.querySelectorAll('.ad-slider-dot');
      if (slides.length <= 1) return;

      slides[currentIdx].classList.remove('active');
      if (dots[currentIdx]) dots[currentIdx].classList.remove('active');

      currentIdx = (targetIdx + slides.length) % slides.length;

      slides[currentIdx].classList.add('active');
      if (dots[currentIdx]) dots[currentIdx].classList.add('active');
    }

    // Dot click support
    const dots = wrap.querySelectorAll('.ad-slider-dot');
    dots.forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(dot.dataset.dotIndex, 10);
        if (!isNaN(idx) && idx !== currentIdx) {
          goToSlide(idx);
        }
      });
    });

    // 5-second interval timer
    const timer = setInterval(() => {
      if (isHovered) return;
      goToSlide(currentIdx + 1);
    }, 5000);

    slotTimers.set(timerKey, timer);
  }

  // ==========================================================================
  // RENDERER 3: FLOATING PROMOTIONAL CARD
  // ==========================================================================
  function renderFloatingPromoCard(allAds, currentPage, currentStore) {
    const floatingAds = getAdsForPlacement(allAds, 'floating', currentPage, currentStore);
    if (floatingAds.length === 0) return;

    if (sessionStorage.getItem('velora_floating_ad_dismissed') === 'true') return;

    const ad = floatingAds[0];
    let container = document.getElementById('velora-floating-ad-wrap');
    if (!container) {
      container = document.createElement('div');
      container.id = 'velora-floating-ad-wrap';
      container.className = 'velora-floating-ad-wrap';
      document.body.appendChild(container);
    }

    const badgeHtml = ad.badge_text ? `<span class="floating-ad-badge">${escapeHTML(ad.badge_text)}</span>` : '';

    container.innerHTML = `
      <div class="floating-ad-card ${currentStore === 'sarojini' ? 'sarojini-floating' : ''}">
        <button type="button" class="floating-ad-close" id="floating-ad-close-btn" aria-label="Dismiss">✕</button>
        ${badgeHtml}
        <div class="floating-ad-title">${escapeHTML(ad.title)}</div>
        <p class="floating-ad-desc">${escapeHTML(ad.subtitle || '')}</p>
        <a href="${escapeHTML(ad.cta_link)}" class="floating-ad-btn">${escapeHTML(ad.cta_text || 'Explore →')}</a>
      </div>
    `;

    setTimeout(() => {
      container.classList.add('is-visible');
    }, 1800);

    const closeBtn = document.getElementById('floating-ad-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        container.classList.remove('is-visible');
        sessionStorage.setItem('velora_floating_ad_dismissed', 'true');
      });
    }
  }

  // ==========================================================================
  // RENDERER 4: AUTHENTICATION LEFT VISUAL 3D PROMOTIONAL CARD
  // ==========================================================================
  function renderAuth3DPromoCard(allAds, currentPage, currentStore) {
    const slot = document.getElementById('auth-3d-ad-slot');
    if (!slot) return;

    if (authAdTimer) {
      clearInterval(authAdTimer);
      authAdTimer = null;
    }

    // Only render on login or signup pages
    if (currentPage !== 'login' && currentPage !== 'signup') {
      slot.style.display = 'none';
      slot.innerHTML = '';
      return;
    }

    const matchingAds = allAds
      .filter(ad => {
        if (!ad.is_active) return false;
        if (!isAdScheduled(ad)) return false;
        if (!isPageTargeted(ad, currentPage)) return false;
        if (ad.placement === 'auth_visual') return true;
        if (['auth', 'login', 'signup'].some(p => ad.target_pages && ad.target_pages.includes(p)) && ad.placement !== 'top_announcement' && ad.placement !== 'below_hero') {
          return true;
        }
        return false;
      })
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return b.priority - a.priority;
      });

    if (matchingAds.length === 0) {
      slot.style.display = 'none';
      slot.innerHTML = '';
      return;
    }

    slot.style.display = '';

    const slidesHtml = matchingAds.map((ad, idx) => {
      const activeClass = (idx === 0) ? 'active' : '';
      const badgeHtml = ad.badge_text ? `<span class="auth-3d-badge">${escapeHTML(ad.badge_text)}</span>` : '';
      const subtitleHtml = ad.subtitle ? `<p class="auth-3d-subtitle">${escapeHTML(ad.subtitle)}</p>` : '';
      const ctaHtml = ad.cta_text ? `
        <span class="auth-3d-cta">
          <span>${escapeHTML(ad.cta_text)}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </span>
      ` : '';
      const imgHtml = ad.image_url ? `
        <div class="auth-3d-image-wrap">
          <img src="${escapeHTML(ad.image_url)}" alt="${escapeHTML(ad.title)}" class="auth-3d-image" loading="lazy">
        </div>
      ` : '';

      return `
        <div class="auth-3d-slide ${activeClass}" data-index="${idx}">
          <a href="${escapeHTML(ad.cta_link || 'shop.html')}" class="auth-3d-card-wrapper" role="button" aria-label="${escapeHTML(ad.title)}">
            <div class="auth-3d-card-content">
              ${badgeHtml}
              <h3 class="auth-3d-title">${escapeHTML(ad.title)}</h3>
              ${subtitleHtml}
              ${ctaHtml}
            </div>
            ${imgHtml}
          </a>
        </div>
      `;
    }).join('');

    let dotsHtml = '';
    if (matchingAds.length > 1) {
      dotsHtml = `
        <div class="auth-3d-dots">
          ${matchingAds.map((_, i) => `<span class="auth-3d-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('')}
        </div>
      `;
    }

    slot.innerHTML = `
      <div class="auth-3d-carousel" id="auth-3d-carousel">
        ${slidesHtml}
        ${dotsHtml}
      </div>
    `;

    // Rotation cycle if multiple ads
    if (matchingAds.length > 1) {
      const carousel = slot.querySelector('#auth-3d-carousel');
      let currentAuthIdx = 0;
      let isAuthAdHovered = false;

      carousel.addEventListener('mouseenter', () => { isAuthAdHovered = true; });
      carousel.addEventListener('mouseleave', () => { isAuthAdHovered = false; });
      carousel.addEventListener('touchstart', () => { isAuthAdHovered = true; }, { passive: true });

      function showAuthSlide(newIdx) {
        const slides = slot.querySelectorAll('.auth-3d-slide');
        const dots = slot.querySelectorAll('.auth-3d-dot');
        if (slides.length <= 1) return;

        slides[currentAuthIdx].classList.remove('active');
        if (dots[currentAuthIdx]) dots[currentAuthIdx].classList.remove('active');

        currentAuthIdx = newIdx;

        slides[currentAuthIdx].classList.add('active');
        if (dots[currentAuthIdx]) dots[currentAuthIdx].classList.add('active');
      }

      const dots = slot.querySelectorAll('.auth-3d-dot');
      dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetIdx = parseInt(dot.dataset.index, 10);
          if (!isNaN(targetIdx) && targetIdx !== currentAuthIdx) {
            showAuthSlide(targetIdx);
          }
        });
      });

      authAdTimer = setInterval(() => {
        if (isAuthAdHovered) return;
        const nextIdx = (currentAuthIdx + 1) % matchingAds.length;
        showAuthSlide(nextIdx);
      }, 6000);
    }
  }

  // ==========================================================================
  // MASTER INITIALIZATION
  // ==========================================================================
  async function initAdsEngine(forceRefresh = false) {
    const currentStore = detectCurrentStore();
    const currentPage = detectCurrentPage();
    const allAds = await fetchAllAdvertisements(forceRefresh);

    // 1. Dynamic Top Announcement Bar (VADI or Sarojini)
    const topAds = getAdsForPlacement(allAds, 'top_announcement', currentPage, currentStore);
    renderTopAnnouncementBar(topAds, currentStore);

    // 2. Dynamic Placed Slots
    renderAdSlots(allAds, currentPage, currentStore);

    // 3. Floating Promo Card
    renderFloatingPromoCard(allAds, currentPage, currentStore);

    // 4. Authentication Visual Card
    renderAuth3DPromoCard(allAds, currentPage, currentStore);
  }

  // Real-time synchronization event listeners
  window.addEventListener('velora:ads-updated', () => {
    cachedAds = null;
    clearAllTimers();
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    initAdsEngine(true);
  });

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      cachedAds = null;
      clearAllTimers();
      initAdsEngine(true);
    }
  });

  // Teardown timers on page unload
  window.addEventListener('beforeunload', () => {
    clearAllTimers();
  });

  // Boot on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAdsEngine());
  } else {
    initAdsEngine();
  }

  // Expose global controller
  window.VeloraAds = {
    version: '3.0.0',
    init: initAdsEngine,
    refresh: () => {
      cachedAds = null;
      clearAllTimers();
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      return initAdsEngine(true);
    },
    detectPage: detectCurrentPage,
    detectStore: detectCurrentStore,
    getAds: () => cachedAds || []
  };

})();
