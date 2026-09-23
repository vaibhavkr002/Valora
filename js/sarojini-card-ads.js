/**
 * js/sarojini-card-ads.js
 * Premium Rotating 3D Animated Advertisement Board for Sarojini Bazaar Product Cards.
 *
 * Implements a mini physical 3D advertising billboard that continuously rotates
 * around its vertical Y-axis, showcasing distinct Delhi street-fashion promotional designs:
 * 1. ❤️ SAROJINI BAZAAR / REAL STREET FINDS (Ruby Red)
 * 2. 🔥 UP TO 70% OFF / BAZAAR SPECIAL (Obsidian Charcoal)
 * 3. 🏷️ ₹199+ STREET DROPS / LIMITED FINDS (Delhi Terracotta)
 * 4. ⚡ NEW STREET DROP / JUST LANDED (Bazaar Emerald)
 * 5. ✦ BAZAAR PRICE / VADI QUALITY (Midnight Slate)
 *
 * Features:
 * - 3D depth with perspective, preserve-3d, and realistic beveled edges.
 * - Continuous smooth rotateY() animation with ~2.7s pause on each face.
 * - Soft floating elevation shadow beneath the rotating board.
 * - Staggered initial face and rotation delays across cards so cards do not turn simultaneously.
 * - Collision-free placement: anchored in the bottom-right corner, leaving product center,
 *   discount badge, wishlist heart, and source-code watermark completely unobstructed.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SarojiniCardAds = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 5 Curated Delhi street-fashion & bazaar promotional faces
  const AD_FACES = [
    {
      theme: 'face-ruby',
      icon: '❤️',
      title: 'SAROJINI BAZAAR',
      sub: 'REAL STREET FINDS'
    },
    {
      theme: 'face-charcoal',
      icon: '🔥',
      title: 'UP TO 70% OFF',
      sub: 'BAZAAR SPECIAL'
    },
    {
      theme: 'face-terracotta',
      icon: '🏷️',
      title: '₹199+ STREET DROPS',
      sub: 'LIMITED FINDS'
    },
    {
      theme: 'face-emerald',
      icon: '⚡',
      title: 'NEW STREET DROP',
      sub: 'JUST LANDED'
    },
    {
      theme: 'face-slate',
      icon: '✦',
      title: 'BAZAAR PRICE',
      sub: 'VADI QUALITY'
    }
  ];

  /**
   * Builds inner HTML for a specific face preset
   */
  function renderFaceContent(face) {
    return `
      <div class="s3d-face-content">
        <div class="s3d-face-title"><span class="s3d-face-icon">${face.icon}</span> ${face.title}</div>
        <div class="s3d-face-sub">${face.sub}</div>
      </div>
      <div class="s3d-face-shine"></div>
    `.trim();
  }

  /**
   * Applies face theme classes and content to an element
   */
  function applyFace(el, face) {
    if (!el || !face) return;
    el.className = el.className.replace(/face-[a-z0-9_-]+/g, '').trim();
    el.classList.add(face.theme);
    el.innerHTML = renderFaceContent(face);
  }

  /**
   * Generates the 3D rotating board HTML element
   */
  function createBoardElement(frontFace, backFace, zoneClass = '') {
    const el = document.createElement('div');
    el.className = `sarojini-card-3d-board ${zoneClass}`.trim();
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="s3d-board-wrapper">
        <div class="s3d-rotator" style="transform: rotateY(0deg);">
          <div class="s3d-side s3d-front ${frontFace.theme}">
            ${renderFaceContent(frontFace)}
          </div>
          <div class="s3d-side s3d-back ${backFace.theme}">
            ${renderFaceContent(backFace)}
          </div>
        </div>
      </div>
      <div class="s3d-board-shadow"></div>
    `.trim();
    return el;
  }

  /**
   * Attaches the 3D rotating board to a single Sarojini card media container
   */
  function attachCardAd(cardMediaEl, cardIndex = 0) {
    if (!cardMediaEl) return;

    // Avoid duplicating on the same card
    if (cardMediaEl.querySelector('.sarojini-card-3d-board')) {
      return;
    }

    // Determine corner placement avoiding watermark
    let zoneClass = 'zone-bottom-right';
    const watermark = cardMediaEl.querySelector('.sarojini-watermark-overlay');
    if (watermark && watermark.classList.contains('zone-bottom-right')) {
      zoneClass = 'zone-bottom-left';
    }

    // Stagger starting face across cards so cards do not all show identical designs
    let frontIdx = cardIndex % AD_FACES.length;
    let backIdx = (frontIdx + 1) % AD_FACES.length;

    const boardEl = createBoardElement(AD_FACES[frontIdx], AD_FACES[backIdx], zoneClass);

    // Stagger the floating motion delay for organic life
    const randomFloatDelay = (Math.random() * 2.5).toFixed(2);
    boardEl.style.animationDelay = `-${randomFloatDelay}s`;

    cardMediaEl.appendChild(boardEl);

    const rotatorEl = boardEl.querySelector('.s3d-rotator');
    const frontEl = boardEl.querySelector('.s3d-front');
    const backEl = boardEl.querySelector('.s3d-back');
    const shadowEl = boardEl.querySelector('.s3d-board-shadow');

    if (!rotatorEl || !frontEl || !backEl) return;

    let currentAngle = 0;
    let step = 0;

    // Rotation timer: show each face for ~2.7s - 3.2s, then smooth 0.65s 3D rotation
    const restDuration = 2700 + (cardIndex % 3) * 350;

    let timer = setInterval(() => {
      if (!boardEl.isConnected) {
        clearInterval(timer);
        return;
      }

      // Step forward by 180 degrees
      step++;
      currentAngle += 180;
      rotatorEl.style.transform = `rotateY(${currentAngle}deg)`;

      // Subtle shadow pulse during 3D flip
      if (shadowEl) {
        shadowEl.classList.add('s3d-shadow-turning');
        setTimeout(() => {
          if (shadowEl) shadowEl.classList.remove('s3d-shadow-turning');
        }, 620);
      }

      // While the hidden opposite face is resting out of view, update it to the next face
      setTimeout(() => {
        if (!boardEl.isConnected) return;
        if (step % 2 === 1) {
          // Front face is now hidden on the back side -> prepare it for next appearance
          frontIdx = (frontIdx + 2) % AD_FACES.length;
          applyFace(frontEl, AD_FACES[frontIdx]);
        } else {
          // Back face is now hidden -> prepare it
          backIdx = (backIdx + 2) % AD_FACES.length;
          applyFace(backEl, AD_FACES[backIdx]);
        }
      }, 450); // halfway through rotation

    }, restDuration);

    boardEl._adTimer = timer;
  }

  /**
   * Scans a container (or document) and initializes 3D ad boards on all Sarojini cards
   */
  function init(root) {
    const container = root || (typeof document !== 'undefined' ? document : null);
    if (!container || typeof container.querySelectorAll !== 'function') return;

    // Target Sarojini Bazaar product cards specifically
    const mediaSelectors = [
      '.sarojini-product-card .product-card-media',
      '.sarojini-product-card .sarojini-card-media',
      '.vadi-sarojini-bazaar .sarojini-card-media'
    ];

    const cardMediaElements = container.querySelectorAll(mediaSelectors.join(', '));
    cardMediaElements.forEach((mediaEl, idx) => {
      attachCardAd(mediaEl, idx);
    });
  }

  // Auto-init on DOMContentLoaded if in browser
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => init());
    } else {
      setTimeout(() => init(), 100);
    }
  }

  return {
    AD_FACES,
    renderFaceContent,
    createBoardElement,
    attachCardAd,
    init
  };
}));
