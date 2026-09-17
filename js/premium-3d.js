/**
 * VELORA Premium 3D Micro-Interactions & Visual Enhancements
 * Purely presentational layer — zero database, cart, auth, or backend logic.
 * Respects prefers-reduced-motion, uses event delegation for dynamic Supabase cards.
 */
(function () {
  'use strict';

  /* -------------------------------------------------------------------------
     SAFE INITIAL PAGE SCROLL POSITION
     Ensures page load and refresh cleanly starts at the top (0, 0)
     unless an intentional hash anchor (e.g. #orders) is present.
  ------------------------------------------------------------------------- */
  try {
    if ('scrollRestoration' in history) {
      if (!window.location.hash) {
        history.scrollRestoration = 'manual';
      }
    }
    if (!window.location.hash) {
      window.scrollTo(0, 0);
    }
    window.addEventListener('load', () => {
      if (!window.location.hash) {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: 'auto'
        });
      }
    });
  } catch (err) {
    // Non-critical browser feature check
  }

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------------------------------------------------------------
     1. CARD 3D TILT WITH EVENT DELEGATION
     Applies subtle 3D perspective tilt to static and dynamic cards on desktop
  ------------------------------------------------------------------------- */
  function initCardTilt() {
    if (prefersReduced) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const TILT_MAX = 6; // max tilt degrees (subtle & elegant)
    const SCALE = 1.015;
    let activeCard = null;

    function resetTilt(card) {
      if (!card) return;
      card.style.transform = '';
      card.style.setProperty('--glare-opacity', '0');
      card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s ease';
      setTimeout(() => {
        if (card) card.style.transition = '';
      }, 500);
    }

    document.addEventListener('mousemove', (e) => {
      const card = e.target.closest('.product-card, .trust-card, .category-card, .delivery-partner-card, .brand-card-chip');
      if (card) {
        if (activeCard && activeCard !== card) {
          resetTilt(activeCard);
        }
        activeCard = card;

        // Ensure glare overlay exists for dynamic Supabase cards
        if (card.classList.contains('product-card') && !card.querySelector('.p3d-card-glare')) {
          const glare = document.createElement('div');
          glare.className = 'p3d-card-glare';
          glare.setAttribute('aria-hidden', 'true');
          card.appendChild(glare);
        }

        const rect = card.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / (rect.width / 2);
        const dy = (e.clientY - cy) / (rect.height / 2);
        const rotateX = -dy * TILT_MAX;
        const rotateY = dx * TILT_MAX;

        // Calculate specular glare position in percentage
        const glareX = ((e.clientX - rect.left) / rect.width) * 100;
        const glareY = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--glare-x', `${glareX.toFixed(1)}%`);
        card.style.setProperty('--glare-y', `${glareY.toFixed(1)}%`);
        card.style.setProperty('--glare-opacity', '1');

        card.style.transform =
          `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-8px) scale(${SCALE})`;
      } else if (activeCard) {
        resetTilt(activeCard);
        activeCard = null;
      }
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
      if (activeCard) {
        resetTilt(activeCard);
        activeCard = null;
      }
    });
  }

  /* -------------------------------------------------------------------------
     2. HERO SHOWROOM FLOATING CAMERA & CURSOR PARALLAX
     Subtle continuous 3D breathing float with interactive cursor tracking
  ------------------------------------------------------------------------- */
  function initHeroParallax() {
    if (prefersReduced) return;

    const heroSection = document.querySelector('.hero-section');
    const heroCard = document.querySelector('.hero-image-card');
    const shadowPlate = document.querySelector('.hero-card-shadow-plate');
    const floatingCards = document.querySelectorAll('.floating-glass-card');

    if (!heroSection || !heroCard) return;

    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;
    let isHovering = false;

    if (hasFinePointer) {
      heroSection.addEventListener('mousemove', (e) => {
        isHovering = true;
        const rect = heroSection.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        targetX = (e.clientX - cx) / rect.width;
        targetY = (e.clientY - cy) / rect.height;
      }, { passive: true });

      heroSection.addEventListener('mouseleave', () => {
        isHovering = false;
        targetX = 0;
        targetY = 0;
      });
    }

    // Continuous 60fps showroom animation loop
    function renderShowroom(timestamp) {
      const time = timestamp || performance.now();
      
      // Calculate gentle continuous breathing float
      const idleFloatY = Math.sin(time * 0.0016) * 5.5;
      const idleRotX = Math.cos(time * 0.0012) * 1.8;
      const idleRotY = Math.sin(time * 0.001) * 1.5;

      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      const cursorMoveX = currentX * 14;
      const cursorMoveY = currentY * 10;
      const cursorRotY = currentX * 3.5;
      const cursorRotX = -currentY * 3;

      const finalRotX = cursorRotX + (isHovering ? idleRotX * 0.4 : idleRotX);
      const finalRotY = cursorRotY + (isHovering ? idleRotY * 0.4 : idleRotY);
      const finalTransY = (cursorMoveY * 0.35) + idleFloatY;
      const finalTransX = (cursorMoveX * 0.35);

      heroCard.style.transform =
        `perspective(1400px) rotateX(${finalRotX.toFixed(2)}deg) rotateY(${finalRotY.toFixed(2)}deg) translateX(${finalTransX.toFixed(2)}px) translateY(${finalTransY.toFixed(2)}px)`;

      if (shadowPlate) {
        const shadowScale = 1 - (idleFloatY / 40);
        const shadowOpacity = 0.25 - (idleFloatY * 0.015);
        shadowPlate.style.transform = `rotateX(75deg) scale(${shadowScale.toFixed(3)}) translateX(${(finalTransX * 0.5).toFixed(2)}px)`;
        shadowPlate.style.opacity = Math.max(0.1, Math.min(0.35, shadowOpacity)).toFixed(3);
      }

      floatingCards.forEach((card, i) => {
        const factor = i === 0 ? 1.3 : 0.8;
        const badgeIdleY = Math.sin(time * 0.002 + (i * 1.5)) * 4;
        card.style.transform =
          `translateX(${((cursorMoveX * factor)).toFixed(2)}px) translateY(${((cursorMoveY * factor) + badgeIdleY).toFixed(2)}px)`;
      });

      requestAnimationFrame(renderShowroom);
    }

    requestAnimationFrame(renderShowroom);
  }

  /* -------------------------------------------------------------------------
     3. TACTILE BUTTON RIPPLE EFFECT
  ------------------------------------------------------------------------- */
  function initButtonRipple() {
    if (prefersReduced) return;

    document.addEventListener('click', (e) => {
      const btn = e.target.closest(
        '.btn-primary, .btn-secondary, .btn-add-to-cart, .btn-promo-cta, ' +
        '.btn-checkout, .cart-checkout-btn, .filter-tab-btn, .btn-track-order, .btn-buy-now'
      );
      if (!btn) return;

      const ripple = document.createElement('span');
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.8;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.28);
        transform: scale(0);
        animation: p3dRipple 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        pointer-events: none;
        z-index: 1;
      `;

      const pos = window.getComputedStyle(btn).position;
      if (pos === 'static') btn.style.position = 'relative';
      btn.style.overflow = 'hidden';

      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });

    if (!document.getElementById('p3d-ripple-style')) {
      const style = document.createElement('style');
      style.id = 'p3d-ripple-style';
      style.textContent = `
        @keyframes p3dRipple {
          0%   { transform: scale(0); opacity: 0.5; }
          100% { transform: scale(1); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /* -------------------------------------------------------------------------
     4. HEADER SCROLL DEPTH
  ------------------------------------------------------------------------- */
  function initHeaderScroll() {
    const header = document.querySelector('.header-nav-wrapper');
    if (!header) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrolled = window.scrollY > 20;
          header.classList.toggle('scrolled', scrolled);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* -------------------------------------------------------------------------
     5. HERO STATS NUMBER COUNTER (Supports integers & decimals e.g. 4.9★)
  ------------------------------------------------------------------------- */
  function initCounterAnimation() {
    if (prefersReduced) return;

    const numbers = document.querySelectorAll('.hero-stat-number');
    if (!numbers.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const text = el.textContent.trim();
          
          // Match numbers with optional decimal point and suffix
          const match = text.match(/^([\d.]+)(\+?[A-Za-z%★]*)/);
          if (!match) return;

          const numStr = match[1];
          const suffix = match[2] || '';
          const isDecimal = numStr.includes('.');
          const endVal = parseFloat(numStr);
          if (isNaN(endVal)) return;

          const duration = 1200;
          const startTime = performance.now();

          function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = eased * endVal;

            el.textContent = isDecimal
              ? current.toFixed(1) + suffix
              : Math.floor(current).toLocaleString() + suffix;

            if (progress < 1) {
              requestAnimationFrame(step);
            } else {
              el.textContent = text; // Final exact text
            }
          }

          requestAnimationFrame(step);
          obs.unobserve(el);
        });
      },
      { threshold: 0.5 }
    );

    numbers.forEach((el) => obs.observe(el));
  }

  /* -------------------------------------------------------------------------
     6. TOP ANNOUNCEMENT AUTO-ROTATING CAROUSEL
  ------------------------------------------------------------------------- */
  function initTopAnnouncementCarousel() {
    const topBar = document.querySelector('.top-announcement-bar');
    if (!topBar) return;

    const inner = topBar.querySelector('.inner');
    if (!inner) return;

    // Standardize right links in DOM so they always work reliably
    const rightLinks = inner.querySelector('.top-bar-right-links');
    if (rightLinks) {
      const links = rightLinks.querySelectorAll('a');
      links.forEach(a => {
        const text = a.textContent.trim().toLowerCase();
        if (text.includes('story') || text.includes('about')) {
          a.setAttribute('href', 'about.html');
          if (window.location.pathname.endsWith('about.html')) a.classList.add('active');
        } else if (text.includes('track') || text.includes('order')) {
          a.setAttribute('href', 'account.html#orders');
          if (window.location.pathname.endsWith('account.html') && window.location.hash === '#orders') a.classList.add('active');
        } else if (text.includes('support') || text.includes('contact') || text.includes('concierge')) {
          a.setAttribute('href', 'contact-support.html');
          if (window.location.pathname.endsWith('contact-support.html') || window.location.pathname.endsWith('contact.html')) a.classList.add('active');
        }
      });
    }

    // Yield to dynamic AdsEngine if active or present
    if (window.AdsEngine || topBar.dataset.adsEngineManaged === 'true' || window.AdsEngineActive) {
      return;
    }

    const announcements = [
      {
        badge: 'EXCLUSIVE',
        text: 'Free Express Delivery Across India on All Orders',
        code: 'VELORA10',
        link: 'shop.html'
      },
      {
        badge: 'LIMITED TIME',
        text: 'Extra 10% Off on Selected Products',
        code: 'VELORA10',
        link: 'shop.html?deals=true'
      },
      {
        badge: 'NEW ARRIVALS',
        text: 'Discover the Latest Styles',
        code: null,
        link: 'new-arrivals.html'
      },
      {
        badge: 'WEEKEND OFFER',
        text: 'Special Prices on Selected Products',
        code: null,
        link: 'deals.html'
      },
      {
        badge: 'BUY 1 GET 1',
        text: 'Shop Eligible Products & Choose Your Free Item',
        code: null,
        link: 'bogo.html'
      },
      {
        badge: 'EASY SHOPPING',
        text: 'COD Available on Eligible Products',
        code: null,
        link: 'shipping-policy.html'
      },
      {
        badge: 'PREMIUM DELIVERY',
        text: 'Track Your Order Anytime',
        code: null,
        link: 'account.html#orders'
      },
      {
        badge: 'SPECIAL DEALS',
        text: 'Explore Today’s Deals',
        code: null,
        link: 'deals.html'
      }
    ];

    // Find or create carousel container
    let carousel = inner.querySelector('.announcement-carousel');
    if (!carousel) {
      carousel = document.createElement('div');
      carousel.className = 'announcement-carousel';
      carousel.id = 'announcement-carousel';
      const existingText = inner.querySelector('.announcement-text');
      if (existingText) {
        inner.replaceChild(carousel, existingText);
      } else {
        inner.insertBefore(carousel, inner.firstChild);
      }
    }

    // Build slides HTML
    carousel.innerHTML = announcements.map((item, idx) => `
      <div class="announcement-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}" data-link="${item.link || ''}">
        <span class="announcement-badge">${item.badge}</span>
        <span class="announcement-content">
          <span class="announcement-text-label">${item.text}</span>
          ${item.code ? `
            <span class="announcement-sep">|</span>
            <span class="announcement-code-wrap">Use Code: <strong class="announcement-code" data-code="${item.code}" title="Click to copy code">${item.code}</strong></span>
          ` : ''}
          ${item.link ? `<a href="${item.link}" class="announcement-action-link" aria-label="${item.badge}: ${item.text}">Shop Now →</a>` : ''}
        </span>
      </div>
    `).join('');

    const slides = carousel.querySelectorAll('.announcement-slide');
    if (slides.length <= 1) return;

    let currentIndex = 0;
    let isPaused = false;
    let timer = null;

    function goToSlide(nextIndex) {
      if (nextIndex === currentIndex) return;
      const currentSlide = slides[currentIndex];
      const nextSlide = slides[nextIndex];

      if (currentSlide) {
        currentSlide.classList.remove('active');
        currentSlide.classList.add('leaving');
        setTimeout(() => {
          currentSlide.classList.remove('leaving');
        }, 450);
      }

      if (nextSlide) {
        nextSlide.classList.add('active');
      }

      currentIndex = nextIndex;
    }

    function startAutoRotation() {
      stopAutoRotation();
      timer = setInterval(() => {
        if (!isPaused && document.visibilityState === 'visible') {
          const nextIndex = (currentIndex + 1) % slides.length;
          goToSlide(nextIndex);
        }
      }, 4200);
    }

    function stopAutoRotation() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    // Hover pause
    carousel.addEventListener('mouseenter', () => { isPaused = true; });
    carousel.addEventListener('mouseleave', () => { isPaused = false; });

    // Touch support: pause briefly on touch
    carousel.addEventListener('touchstart', () => {
      isPaused = true;
    }, { passive: true });
    carousel.addEventListener('touchend', () => {
      setTimeout(() => { isPaused = false; }, 2000);
    }, { passive: true });

    // Copy code delegated click
    carousel.addEventListener('click', (e) => {
      const codeElem = e.target.closest('.announcement-code');
      if (codeElem) {
        e.preventDefault();
        e.stopPropagation();
        const code = codeElem.dataset.code || codeElem.textContent.trim();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(() => {
            const originalText = codeElem.textContent;
            codeElem.textContent = '✓ Copied!';
            codeElem.style.background = 'rgba(16, 185, 129, 0.4)';
            codeElem.style.borderColor = '#34d399';
            codeElem.style.color = '#ffffff';
            setTimeout(() => {
              codeElem.textContent = originalText;
              codeElem.style.background = '';
              codeElem.style.borderColor = '';
              codeElem.style.color = '';
            }, 1800);
          }).catch(() => {});
        }
        return;
      }

      // If clicked on slide itself (outside links/code), navigate to slide link
      const slide = e.target.closest('.announcement-slide');
      if (slide && !e.target.closest('a')) {
        const targetLink = slide.dataset.link;
        if (targetLink) {
          window.location.href = targetLink;
        }
      }
    });

    // Visibility change handling
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopAutoRotation();
      } else {
        startAutoRotation();
      }
    });

    startAutoRotation();
  }

  /* -------------------------------------------------------------------------
     7. COMPACT MOBILE NAVBAR & DRAWER POLISH
     Ensures Search, Wishlist, Cart & Hamburger are arranged cleanly on phones,
     and the drawer behaves like a smooth shopping app navigation panel.
  ------------------------------------------------------------------------- */
  function initMobileNavbarEnhancements() {
    const navActions = document.querySelector('.nav-actions');
    const mobileToggle = document.getElementById('mobile-toggle-btn');
    const drawer = document.getElementById('mobile-drawer');

    function closeDrawer() {
      if (!drawer) return;
      drawer.classList.remove('open');
      drawer.classList.remove('active');
      if (mobileToggle) mobileToggle.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (drawer) {
      const closeBtn = document.getElementById('mobile-drawer-close');
      const backdrop = document.getElementById('mobile-drawer-backdrop');
      if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
      if (backdrop) backdrop.addEventListener('click', closeDrawer);

      const navLinks = drawer.querySelectorAll('.mobile-nav-links a');
      navLinks.forEach(link => {
        link.addEventListener('click', closeDrawer);
      });
    }

    if (!navActions) return;

    if (!document.getElementById('mobile-nav-search-trigger')) {
      const searchBtn = document.createElement('button');
      searchBtn.id = 'mobile-nav-search-trigger';
      searchBtn.className = 'action-btn mobile-search-btn';
      searchBtn.setAttribute('aria-label', 'Search Products');
      searchBtn.setAttribute('title', 'Search');
      searchBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      `;

      searchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (drawer) {
          drawer.classList.add('open');
          drawer.classList.add('active');
          if (mobileToggle) mobileToggle.classList.add('active');
          document.body.style.overflow = 'hidden';
          const mobileInput = document.getElementById('mobile-search-input');
          if (mobileInput) {
            setTimeout(() => mobileInput.focus(), 320);
          }
        }
      });

      navActions.insertBefore(searchBtn, navActions.firstChild);
    }
  }

  /* -------------------------------------------------------------------------
     8. CINEMATIC 3D SCENE TRANSITIONS (Scroll-Linked Observer)
  ------------------------------------------------------------------------- */
  function initSceneTransitions() {
    if (prefersReduced) return;

    const scenes = document.querySelectorAll(
      '.hero-section, .categories-section, .brands-section, .trending-section, ' +
      '.advertisements-carousel-section, .deals-section, .bogo-section, .new-arrivals-section, ' +
      '.why-us-section, .delivery-partners-section, .newsletter-section'
    );

    if (!scenes.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('p3d-scene-active');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    scenes.forEach(scene => observer.observe(scene));
  }

  /* -------------------------------------------------------------------------
     INIT — run on DOMContentLoaded
  ------------------------------------------------------------------------- */
  function init() {
    initHeaderScroll();
    initTopAnnouncementCarousel();
    initCardTilt();
    initHeroParallax();
    initButtonRipple();
    initCounterAnimation();
    initMobileNavbarEnhancements();
    initSceneTransitions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
