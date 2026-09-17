/**
 * VELORA - Real Customer Experiences 3D Carousel & Lightbox
 * Pure Vanilla JS, Zero external dependencies
 */

(function () {
  'use strict';

  // Static array of exact filenames inside /assets/customerreviews/
  const CUSTOMER_REVIEWS = [
    "WhatsApp Image 2026-09-17 at 1.34.56 AM (1).jpeg",
    "WhatsApp Image 2026-09-17 at 1.34.56 AM.jpeg",
    "WhatsApp Image 2026-09-17 at 1.34.57 AM.jpeg",
    "WhatsApp Image 2026-09-17 at 1.34.59 AM.jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.00 AM (1).jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.00 AM (2).jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.00 AM.jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.01 AM (1).jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.01 AM.jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.02 AM (1).jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.02 AM.jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.03 AM (1).jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.03 AM.jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.04 AM (1).jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.04 AM.jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.05 AM.jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.06 AM (1).jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.06 AM.jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.07 AM (1).jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.07 AM (2).jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.07 AM.jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.08 AM (1).jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.08 AM.jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.09 AM (1).jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.09 AM (2).jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.09 AM (3).jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.09 AM.jpeg",
    "WhatsApp Image 2026-09-17 at 1.35.10 AM.jpeg"
  ];

  const ASSET_BASE = 'assets/customerreviews/';
  const TOTAL = CUSTOMER_REVIEWS.length;

  let currentIndex = 0;
  let autoPlayTimer = null;
  let isPaused = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let cardsElements = [];

  // DOM Elements cache
  let viewportEl, stageEl, prevBtn, nextBtn, currentNumEl, totalNumEl, dotsContainer;
  let lightboxEl, lightboxImg, lightboxCurrent, lightboxTotal, lightboxCloseBtn, lightboxPrevBtn, lightboxNextBtn;

  function init() {
    viewportEl = document.querySelector('.velora-cs-viewport');
    stageEl = document.getElementById('velora-cs-stage');
    prevBtn = document.getElementById('velora-cs-prev');
    nextBtn = document.getElementById('velora-cs-next');
    currentNumEl = document.getElementById('velora-cs-current-num');
    totalNumEl = document.getElementById('velora-cs-total-num');
    dotsContainer = document.getElementById('velora-cs-dots');

    if (!stageEl || !viewportEl) return;

    if (totalNumEl) {
      totalNumEl.textContent = String(TOTAL).padStart(2, '0');
    }

    buildCards();
    buildDots();
    buildLightbox();
    bindEvents();
    updatePositions();
    startAutoPlay();
  }

  /**
   * Build 28 3D cards
   */
  function buildCards() {
    stageEl.innerHTML = '';
    cardsElements = [];

    CUSTOMER_REVIEWS.forEach((filename, i) => {
      const card = document.createElement('div');
      card.className = 'velora-cs-card';
      card.setAttribute('data-index', i);
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `View customer feedback screenshot ${i + 1} of ${TOTAL}`);

      const encodedUrl = ASSET_BASE + encodeURIComponent(filename);

      card.innerHTML = `
        <div class="velora-cs-card-inner">
          <div class="velora-cs-card-glare"></div>
          <div class="velora-cs-card-topbar">
            <span class="velora-cs-card-badge">
              <svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              Verified Buyer
            </span>
            <span class="velora-cs-card-zoom-hint">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              View Full
            </span>
          </div>
          <div class="velora-cs-card-img-wrap">
            <img class="velora-cs-card-img" 
                 src="${encodedUrl}" 
                 alt="Customer review WhatsApp screenshot ${i + 1}" 
                 loading="${i < 5 ? 'eager' : 'lazy'}" />
          </div>
        </div>
      `;

      // Click behavior
      card.addEventListener('click', () => {
        if (card.classList.contains('is-center')) {
          openLightbox(i);
        } else {
          goToIndex(i);
        }
      });

      // Keyboard accessibility
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (card.classList.contains('is-center')) {
            openLightbox(i);
          } else {
            goToIndex(i);
          }
        }
      });

      stageEl.appendChild(card);
      cardsElements.push(card);
    });
  }

  /**
   * Build dot indicators (grouped or paginated)
   */
  function buildDots() {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = '';
    
    // Create dots representing 14 or 28 checkpoints
    for (let i = 0; i < TOTAL; i++) {
      const dot = document.createElement('span');
      dot.className = 'velora-cs-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('data-index', i);
      dot.setAttribute('title', `Story ${i + 1}`);
      dot.addEventListener('click', () => goToIndex(i));
      dotsContainer.appendChild(dot);
    }
  }

  /**
   * Update 3D transforms for all cards
   */
  function updatePositions() {
    const width = window.innerWidth;
    const isDesktop = width >= 1024;
    const isTablet = width >= 768 && width < 1024;

    cardsElements.forEach((card, i) => {
      let diff = i - currentIndex;
      if (diff > TOTAL / 2) diff -= TOTAL;
      if (diff < -TOTAL / 2) diff += TOTAL;

      card.classList.remove('is-center');

      if (diff === 0) {
        card.classList.add('is-center');
        const scale = isDesktop ? 1.05 : (isTablet ? 1.02 : 1);
        const z = isDesktop ? 90 : (isTablet ? 60 : 40);
        card.style.transform = `translate3d(0, 0, ${z}px) rotateY(0deg) scale(${scale})`;
        card.style.opacity = '1';
        card.style.zIndex = '10';
        card.style.pointerEvents = 'auto';
        card.style.visibility = 'visible';
      } else if (isDesktop) {
        if (Math.abs(diff) === 1) {
          const x = diff * 240;
          const rotY = diff * -18;
          card.style.transform = `translate3d(${x}px, 0, 10px) rotateY(${rotY}deg) scale(0.92)`;
          card.style.opacity = '0.84';
          card.style.zIndex = '8';
          card.style.pointerEvents = 'auto';
          card.style.visibility = 'visible';
        } else if (Math.abs(diff) === 2) {
          const x = diff * 430;
          const rotY = diff * -28;
          card.style.transform = `translate3d(${x}px, 0, -70px) rotateY(${rotY}deg) scale(0.78)`;
          card.style.opacity = '0.52';
          card.style.zIndex = '6';
          card.style.pointerEvents = 'auto';
          card.style.visibility = 'visible';
        } else if (Math.abs(diff) === 3) {
          const x = diff * 590;
          const rotY = diff * -36;
          card.style.transform = `translate3d(${x}px, 0, -140px) rotateY(${rotY}deg) scale(0.66)`;
          card.style.opacity = '0.2';
          card.style.zIndex = '4';
          card.style.pointerEvents = 'auto';
          card.style.visibility = 'visible';
        } else {
          card.style.opacity = '0';
          card.style.pointerEvents = 'none';
          card.style.visibility = 'hidden';
          card.style.transform = `translate3d(${diff > 0 ? 680 : -680}px, 0, -200px) scale(0.5)`;
        }
      } else if (isTablet) {
        if (Math.abs(diff) === 1) {
          const x = diff * 185;
          const rotY = diff * -16;
          card.style.transform = `translate3d(${x}px, 0, 5px) rotateY(${rotY}deg) scale(0.88)`;
          card.style.opacity = '0.8';
          card.style.zIndex = '8';
          card.style.pointerEvents = 'auto';
          card.style.visibility = 'visible';
        } else if (Math.abs(diff) === 2) {
          const x = diff * 330;
          const rotY = diff * -25;
          card.style.transform = `translate3d(${x}px, 0, -60px) rotateY(${rotY}deg) scale(0.74)`;
          card.style.opacity = '0.35';
          card.style.zIndex = '6';
          card.style.pointerEvents = 'auto';
          card.style.visibility = 'visible';
        } else {
          card.style.opacity = '0';
          card.style.pointerEvents = 'none';
          card.style.visibility = 'hidden';
          card.style.transform = `translate3d(${diff > 0 ? 450 : -450}px, 0, -150px) scale(0.5)`;
        }
      } else {
        // Mobile layout
        if (Math.abs(diff) === 1) {
          const x = diff * 76;
          const rotY = diff * -12;
          card.style.transform = `translate3d(${x}%, 0, -35px) rotateY(${rotY}deg) scale(0.86)`;
          card.style.opacity = '0.42';
          card.style.zIndex = '6';
          card.style.pointerEvents = 'auto';
          card.style.visibility = 'visible';
        } else {
          card.style.opacity = '0';
          card.style.pointerEvents = 'none';
          card.style.visibility = 'hidden';
          card.style.transform = `translate3d(${diff > 0 ? 120 : -120}%, 0, -100px) scale(0.6)`;
        }
      }
    });

    // Update Counter
    if (currentNumEl) {
      currentNumEl.textContent = String(currentIndex + 1).padStart(2, '0');
    }

    // Update Dots & ensure active dot is visible inside dotsContainer without scrolling the window
    if (dotsContainer) {
      const dots = dotsContainer.querySelectorAll('.velora-cs-dot');
      dots.forEach((dot, idx) => {
        if (idx === currentIndex) {
          dot.classList.add('active');
          // Scroll ONLY the internal dots container horizontally, NEVER scroll the window or page
          const targetLeft = dot.offsetLeft - (dotsContainer.clientWidth / 2) + (dot.clientWidth / 2);
          if (typeof dotsContainer.scrollTo === 'function') {
            dotsContainer.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
          } else {
            dotsContainer.scrollLeft = Math.max(0, targetLeft);
          }
        } else {
          dot.classList.remove('active');
        }
      });
    }
  }

  function goToIndex(index) {
    currentIndex = ((index % TOTAL) + TOTAL) % TOTAL;
    updatePositions();
    resetAutoPlay();
  }

  function nextSlide() {
    goToIndex(currentIndex + 1);
  }

  function prevSlide() {
    goToIndex(currentIndex - 1);
  }

  function startAutoPlay() {
    stopAutoPlay();
    autoPlayTimer = setInterval(() => {
      if (!isPaused && (!lightboxEl || !lightboxEl.classList.contains('is-open'))) {
        nextSlide();
      }
    }, 4500);
  }

  function stopAutoPlay() {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
  }

  function resetAutoPlay() {
    startAutoPlay();
  }

  /**
   * Build Fullscreen Lightbox DOM
   */
  function buildLightbox() {
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'velora-cs-lightbox';
    lightboxEl.setAttribute('role', 'dialog');
    lightboxEl.setAttribute('aria-modal', 'true');
    lightboxEl.setAttribute('aria-label', 'Customer Story Fullscreen View');

    lightboxEl.innerHTML = `
      <button class="velora-cs-lightbox-close" id="velora-cs-lightbox-close" aria-label="Close modal">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      <button class="velora-cs-lightbox-nav prev" id="velora-cs-lb-prev" aria-label="Previous customer story">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <button class="velora-cs-lightbox-nav next" id="velora-cs-lb-next" aria-label="Next customer story">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
      <div class="velora-cs-lightbox-dialog">
        <div class="velora-cs-lightbox-img-wrapper">
          <img class="velora-cs-lightbox-img" id="velora-cs-lb-img" src="" alt="Customer WhatsApp Feedback" />
        </div>
        <div class="velora-cs-lightbox-info">
          <span class="pill">Verified Purchase Chat</span>
          <span>Story <span id="velora-cs-lb-curr">1</span> of <span id="velora-cs-lb-tot">${TOTAL}</span></span>
        </div>
      </div>
    `;

    document.body.appendChild(lightboxEl);

    lightboxImg = document.getElementById('velora-cs-lb-img');
    lightboxCurrent = document.getElementById('velora-cs-lb-curr');
    lightboxTotal = document.getElementById('velora-cs-lb-tot');
    lightboxCloseBtn = document.getElementById('velora-cs-lightbox-close');
    lightboxPrevBtn = document.getElementById('velora-cs-lb-prev');
    lightboxNextBtn = document.getElementById('velora-cs-lb-next');

    // Close on backdrop click
    lightboxEl.addEventListener('click', (e) => {
      if (e.target === lightboxEl) {
        closeLightbox();
      }
    });

    lightboxCloseBtn.addEventListener('click', closeLightbox);
    
    lightboxPrevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateLightbox(-1);
    });

    lightboxNextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateLightbox(1);
    });
  }

  let lightboxIndex = 0;

  function openLightbox(index) {
    lightboxIndex = index;
    updateLightboxContent();
    lightboxEl.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    isPaused = true;
  }

  function closeLightbox() {
    if (!lightboxEl) return;
    lightboxEl.classList.remove('is-open');
    document.body.style.overflow = '';
    isPaused = false;
  }

  function navigateLightbox(step) {
    lightboxIndex = ((lightboxIndex + step) % TOTAL + TOTAL) % TOTAL;
    updateLightboxContent();
    // Synchronize carousel position behind lightbox
    goToIndex(lightboxIndex);
  }

  function updateLightboxContent() {
    if (!lightboxImg) return;
    const filename = CUSTOMER_REVIEWS[lightboxIndex];
    lightboxImg.src = ASSET_BASE + encodeURIComponent(filename);
    if (lightboxCurrent) {
      lightboxCurrent.textContent = lightboxIndex + 1;
    }
  }

  /**
   * Bind event listeners
   */
  function bindEvents() {
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);

    // Hover pause
    viewportEl.addEventListener('mouseenter', () => { isPaused = true; });
    viewportEl.addEventListener('mouseleave', () => {
      isPaused = false;
      // Reset parallax tilt
      stageEl.style.transform = 'rotateY(0deg) rotateX(0deg)';
    });

    // Parallax mouse tilt on stage for desktop
    viewportEl.addEventListener('mousemove', (e) => {
      if (window.innerWidth < 1024) return;
      const rect = viewportEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      const tiltX = -y * 6; // Max 3 deg
      const tiltY = x * 8;  // Max 4 deg
      stageEl.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    });

    // Touch events for mobile swiping
    viewportEl.addEventListener('touchstart', (e) => {
      isPaused = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    viewportEl.addEventListener('touchend', (e) => {
      isPaused = false;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;

      // Ensure horizontal swipe dominant
      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
    }, { passive: true });

    // Keyboard support
    window.addEventListener('keydown', (e) => {
      if (lightboxEl && lightboxEl.classList.contains('is-open')) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') navigateLightbox(-1);
        if (e.key === 'ArrowRight') navigateLightbox(1);
      }
    });

    // Window resize recalculations
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updatePositions, 100);
    });
  }

  // Initialize on DOMContentLoaded or immediate
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

