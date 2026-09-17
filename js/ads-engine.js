/**
 * VELORA - Dynamic Advertisement System & Storefront Engine
 * Single source of truth for all customer-facing advertisements and promotional bars.
 * Fetches from Supabase (banners / store_settings), validates scheduling and page targeting,
 * and renders advertisements dynamically strictly where configured by the Admin.
 */

(function () {
  'use strict';

  const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";
  const STORAGE_KEY = 'velora_ads_cache_v2';
  const CACHE_TTL_MS = 120000; // 2 minutes

  // Default seed fallback if Supabase is offline or not yet configured
  const DEFAULT_FALLBACK_ADS = [
    {
      id: 'default_top_bogo',
      title: 'Buy 1 Get 1 on Selected Products',
      subtitle: 'Unlock a complimentary companion piece automatically at checkout.',
      badge_text: '🔥 BOGO SALE',
      image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
      cta_text: 'Shop BOGO →',
      cta_link: 'bogo.html',
      ad_type: 'bogo',
      placement: 'top_announcement',
      target_pages: ['all'],
      priority: 5,
      sort_order: 1,
      is_active: true
    },
    {
      id: 'default_top_trending',
      title: 'Discover What\'s Trending This Week',
      subtitle: 'Handcrafted luxury footwear, precision chronographs, and curated essentials.',
      badge_text: '⚡ TRENDING NOW',
      image_url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80',
      cta_text: 'Explore Trending →',
      cta_link: 'trending.html',
      ad_type: 'trending',
      placement: 'top_announcement',
      target_pages: ['all'],
      priority: 4,
      sort_order: 2,
      is_active: true
    },
    {
      id: 'default_top_deals',
      title: 'Special Savings Across Curated Collections',
      subtitle: 'Limited-time seasonal prices on certified luxury goods.',
      badge_text: '🏷️ WEEKEND OFFER',
      image_url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80',
      cta_text: 'Shop Now →',
      cta_link: 'shop.html',
      ad_type: 'deals',
      placement: 'top_announcement',
      target_pages: ['all'],
      priority: 3,
      sort_order: 3,
      is_active: true
    },
    {
      id: 'default_hero_bogo',
      title: 'Double Your Style — Buy 1, Get 1 Free',
      subtitle: 'Add any qualifying luxury product to your bag and unlock an instant companion piece 100% free.',
      badge_text: '🔥 EXCLUSIVE CAMPAIGN',
      image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
      cta_text: 'Shop BOGO Collection',
      cta_link: 'bogo.html',
      ad_type: 'bogo',
      placement: 'below_hero',
      target_pages: ['homepage', 'shop'],
      priority: 5,
      sort_order: 1,
      is_active: true
    },
    {
      id: 'default_trending_radar',
      title: 'Trending Now & Customer Favorites',
      subtitle: 'Discover standout styles capturing nationwide attention with uncompromised craftsmanship.',
      badge_text: '⚡ VELORA RADAR',
      image_url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80',
      cta_text: 'View All Trending',
      cta_link: 'trending.html',
      ad_type: 'trending',
      placement: 'above_trending',
      target_pages: ['homepage'],
      priority: 4,
      sort_order: 1,
      is_active: true
    },
    {
      id: 'default_auth_trending',
      title: 'Discover What\'s Trending at VELORA',
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
    },
    {
      id: 'default_auth_bogo',
      title: 'Buy 1, Get 1 Complimentary',
      subtitle: 'Claim an exclusive companion piece on qualifying orders.',
      badge_text: '🔥 BOGO SALE',
      image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80',
      cta_text: 'Shop BOGO →',
      cta_link: 'bogo.html',
      ad_type: 'bogo',
      placement: 'auth_visual',
      target_pages: ['auth', 'login', 'signup', 'all'],
      priority: 9,
      sort_order: 2,
      is_active: true
    }
  ];

  let cachedAds = null;
  let topBarTimer = null;
  let currentTopBarIdx = 0;
  let isTopBarHovered = false;

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

  // Detect current page key
  function detectCurrentPage() {
    const path = window.location.pathname.toLowerCase();
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

  // Validate if ad is currently inside schedule
  function isAdScheduled(ad) {
    const now = new Date().getTime();
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
    if ((currentPage === 'login' || currentPage === 'signup') && (ad.target_pages.includes('auth') || ad.target_pages.includes('authentication'))) {
      return true;
    }
    return ad.target_pages.includes(currentPage);
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

    // 1. Try querying public.banners with full schema
    try {
      const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/banners?select=*&is_active=eq.true&order=display_order.asc`, {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          loadedAds = data.map(b => normalizeAdRecord(b));
        }
      }
    } catch (err) {
      console.warn("VeloraAds: Notice fetching banners table:", err.message);
    }

    // 2. Try store_settings key 'advertisements' (custom admin backup)
    if (loadedAds.length === 0) {
      try {
        const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/store_settings?key=eq.advertisements`, {
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data[0] && data[0].value && Array.isArray(data[0].value)) {
            loadedAds = data[0].value
              .filter(ad => ad.is_active !== false)
              .map(ad => normalizeAdRecord(ad));
          }
        }
      } catch (err) {
        console.warn("VeloraAds: Notice fetching store_settings ads:", err.message);
      }
    }

    // 3. Supplement placements not returned from DB with default fallback ads if available
    const existingPlacements = new Set(loadedAds.map(a => a.placement));
    DEFAULT_FALLBACK_ADS.forEach(fb => {
      if (!existingPlacements.has(fb.placement)) {
        loadedAds.push(fb);
      }
    });

    if (loadedAds.length === 0) {
      loadedAds = DEFAULT_FALLBACK_ADS;
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

  // Normalize record fields ensuring backward and forward compatibility
  function normalizeAdRecord(raw) {
    let targetPages = ['all'];
    if (Array.isArray(raw.target_pages)) {
      targetPages = raw.target_pages;
    } else if (typeof raw.target_pages === 'string') {
      try { targetPages = JSON.parse(raw.target_pages); } catch (_) { targetPages = [raw.target_pages]; }
    }

    return {
      id: raw.id || 'ad_' + Math.random().toString(36).substring(2, 9),
      title: raw.title || '',
      subtitle: raw.subtitle || '',
      badge_text: raw.badge_text || (raw.badge ? raw.badge : ''),
      image_url: raw.image_url || '',
      mobile_image_url: raw.mobile_image_url || raw.image_url || '',
      cta_text: raw.cta_text || raw.button_text || 'Shop Now →',
      cta_link: raw.cta_link || raw.button_link || 'shop.html',
      ad_type: raw.ad_type || 'standard',
      placement: raw.placement || 'top_announcement',
      target_pages: targetPages,
      priority: Number(raw.priority) || 1,
      sort_order: Number(raw.sort_order !== undefined ? raw.sort_order : (raw.display_order !== undefined ? raw.display_order : 1)),
      start_at: raw.start_at || null,
      end_at: raw.end_at || null,
      is_active: raw.is_active !== false
    };
  }

  // Filter and sort ads for a specific placement on the current page
  function getAdsForPlacement(allAds, placement, currentPage) {
    return allAds
      .filter(ad => {
        if (!ad.is_active) return false;
        if (ad.placement !== placement) return false;
        if (!isPageTargeted(ad, currentPage)) return false;
        if (!isAdScheduled(ad)) return false;
        return true;
      })
      .sort((a, b) => {
        // Sort order ascending (1, 2, 3...), then priority descending (5, 4, 3...)
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return b.priority - a.priority;
      });
  }

  // ==========================================================================
  // RENDERER 1: SINGLE TOP ANNOUNCEMENT BAR (MERGED & DYNAMIC)
  // ==========================================================================
  function renderTopAnnouncementBar(ads) {
    const bar = document.querySelector('.top-announcement-bar');
    if (!bar) return;

    bar.dataset.adsEngineManaged = 'true';
    window.AdsEngineActive = true;

    if (topBarTimer) {
      clearInterval(topBarTimer);
      topBarTimer = null;
    }

    if (ads.length === 0) {
      // Clean collapse if no announcement ads configured
      bar.style.display = 'none';
      bar.setAttribute('aria-hidden', 'true');
      return;
    }

    bar.style.display = '';
    bar.removeAttribute('aria-hidden');

    let inner = bar.querySelector('.inner');
    if (!inner) {
      inner = document.createElement('div');
      inner.className = 'inner';
      bar.appendChild(inner);
    }

    // Preserve right links (Our Story, Track Order, Support) if present
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

    // Build announcement carousel items
    const slidesHtml = ads.map((ad, idx) => {
      const activeClass = (idx === 0) ? 'active' : '';
      const badgeHtml = ad.badge_text ? `<span class="announcement-badge">${escapeHTML(ad.badge_text)}</span>` : '';
      const subtitleSep = (ad.title && ad.subtitle) ? '<span class="announcement-sep">|</span>' : '';
      const subtitleHtml = ad.subtitle ? `<span class="announcement-sub-label">${escapeHTML(ad.subtitle)}</span>` : '';
      const ctaHtml = ad.cta_text ? `<a href="${escapeHTML(ad.cta_link)}" class="announcement-action-link">${escapeHTML(ad.cta_text)}</a>` : '';

      return `
        <div class="announcement-slide ${activeClass}" data-index="${idx}" data-link="${escapeHTML(ad.cta_link)}">
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

    // Rotation cycle if more than 1 ad
    if (ads.length > 1) {
      const carouselEl = inner.querySelector('#announcement-carousel');
      currentTopBarIdx = 0;

      carouselEl.addEventListener('mouseenter', () => { isTopBarHovered = true; });
      carouselEl.addEventListener('mouseleave', () => { isTopBarHovered = false; });
      carouselEl.addEventListener('touchstart', () => { isTopBarHovered = true; }, { passive: true });

      topBarTimer = setInterval(() => {
        if (isTopBarHovered) return;
        const slides = carouselEl.querySelectorAll('.announcement-slide');
        if (slides.length <= 1) return;

        slides[currentTopBarIdx].classList.remove('active');
        currentTopBarIdx = (currentTopBarIdx + 1) % slides.length;
        slides[currentTopBarIdx].classList.add('active');
      }, 5000); // 5 seconds rotation interval
    }
  }

  // ==========================================================================
  // RENDERER 2: FULL-WIDTH / SECTION SLOTS (3:1 / 3.5:1 E-COMMERCE DESIGN)
  // ==========================================================================
  function renderAdSlots(allAds, currentPage) {
    const slots = document.querySelectorAll('.velora-ad-slot');

    slots.forEach(slot => {
      const placement = slot.dataset.adPlacement;
      if (!placement) return;

      const matchingAds = getAdsForPlacement(allAds, placement, currentPage);

      if (matchingAds.length === 0) {
        slot.innerHTML = '';
        slot.style.display = 'none';
        return;
      }

      const ad = matchingAds[0]; // Primary ad for this slot
      slot.style.display = '';

      const isBogo = (ad.ad_type === 'bogo');
      const isTrending = (ad.ad_type === 'trending');

      let themeClass = 'theme-standard';
      if (isBogo) themeClass = 'theme-bogo';
      if (isTrending) themeClass = 'theme-trending';

      const bgImg = ad.image_url ? `style="background-image: linear-gradient(90deg, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.65) 60%, rgba(15,23,42,0.3) 100%), url('${escapeHTML(ad.image_url)}');"` : '';
      const badgeHtml = ad.badge_text ? `<span class="velora-ad-badge">${escapeHTML(ad.badge_text)}</span>` : '';
      const subtitleHtml = ad.subtitle ? `<p class="velora-ad-desc">${escapeHTML(ad.subtitle)}</p>` : '';
      const ctaHtml = ad.cta_text ? `
        <a href="${escapeHTML(ad.cta_link)}" class="velora-ad-btn">
          <span>${escapeHTML(ad.cta_text)}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </a>
      ` : '';

      slot.innerHTML = `
        <div class="container">
          <div class="velora-ad-card ${themeClass}" ${bgImg}>
            <div class="velora-ad-content">
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
    });
  }

  // ==========================================================================
  // RENDERER 3: FLOATING PROMOTIONAL CARD
  // ==========================================================================
  function renderFloatingPromoCard(allAds, currentPage) {
    const floatingAds = getAdsForPlacement(allAds, 'floating', currentPage);
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
      <div class="floating-ad-card">
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
  let authAdTimer = null;
  let currentAuthIdx = 0;
  let isAuthAdHovered = false;

  function renderAuth3DPromoCard(allAds, currentPage) {
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

    // Filter matching ads for auth visual panel
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

    // 3D subtle mouse tracking on desktop
    const cardWrappers = slot.querySelectorAll('.auth-3d-card-wrapper');
    cardWrappers.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const rotX = -(y / rect.height) * 8;
        const rotY = (x / rect.width) * 8;
        card.style.transform = `translateY(-4px) rotateX(${rotX.toFixed(1)}deg) rotateY(${rotY.toFixed(1)}deg)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });

    // Rotation cycle if multiple ads
    if (matchingAds.length > 1) {
      const carousel = slot.querySelector('#auth-3d-carousel');
      currentAuthIdx = 0;

      carousel.addEventListener('mouseenter', () => { isAuthAdHovered = true; });
      carousel.addEventListener('mouseleave', () => { isAuthAdHovered = false; });
      carousel.addEventListener('touchstart', () => { isAuthAdHovered = true; }, { passive: true });

      const dots = slot.querySelectorAll('.auth-3d-dot');
      dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetIdx = parseInt(dot.dataset.index, 10);
          if (isNaN(targetIdx) || targetIdx === currentAuthIdx) return;
          showAuthSlide(targetIdx);
        });
      });

      authAdTimer = setInterval(() => {
        if (isAuthAdHovered) return;
        const nextIdx = (currentAuthIdx + 1) % matchingAds.length;
        showAuthSlide(nextIdx);
      }, 6000);
    }

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
  }

  // ==========================================================================
  // MASTER INITIALIZATION
  // ==========================================================================
  async function initAdsEngine() {
    const currentPage = detectCurrentPage();
    const allAds = await fetchAllAdvertisements();

    // 1. Render dynamic single top announcement bar
    const topAds = getAdsForPlacement(allAds, 'top_announcement', currentPage);
    renderTopAnnouncementBar(topAds);

    // 2. Render all configured dynamic slots
    renderAdSlots(allAds, currentPage);

    // 3. Render floating card if targeted
    renderFloatingPromoCard(allAds, currentPage);

    // 4. Render Authentication Left Visual 3D Card
    renderAuth3DPromoCard(allAds, currentPage);
  }

  // Teardown timers on page unload
  window.addEventListener('beforeunload', () => {
    if (topBarTimer) clearInterval(topBarTimer);
    if (authAdTimer) clearInterval(authAdTimer);
  });

  // Boot on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAdsEngine());
  } else {
    initAdsEngine();
  }

  // Expose global controller
  window.VeloraAds = {
    version: '2.0.0',
    init: initAdsEngine,
    refresh: () => initAdsEngine(true),
    detectPage: detectCurrentPage,
    getAds: () => cachedAds || []
  };

})();
