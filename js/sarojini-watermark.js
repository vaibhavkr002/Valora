/**
 * js/sarojini-watermark.js
 * Universal Watermark Detection & Rendering Engine for Sarojini Bazaar.
 *
 * Guarantees that embedded supplier codes (e.g. S-1084290722, S-990006640)
 * are completely covered by a dynamic, luxury branded:
 *   ● VADI STORE
 *   SAROJINI BAZAAR
 * watermark overlay placed INSIDE the image wrapper, strictly relative to the image itself.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SarojiniWatermark = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Analyzes an image URL or metadata to detect embedded supplier codes.
   * Returns:
   * {
   *   detected: boolean,
   *   source: string,
   *   code: string,
   *   zone: 'bottom-left' | 'bottom-right' | 'bottom-center',
   *   css: { left, bottom, right, top, minWidth, maxWidth, transform }
   * }
   */
  function detectSupplierCode(imageUrl, options = {}) {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return { detected: false };
    }

    const url = imageUrl.trim();

    // 1. Meesho CDN pattern: /images/products/<id>/
    const meeshoMatch = url.match(/images\.meesho\.com\/images\/products\/([0-9]+)\//i);
    if (meeshoMatch) {
      const codeId = meeshoMatch[1];
      const codeText = `S-${codeId}`;
      return {
        detected: true,
        source: 'meesho',
        code: codeText,
        zone: 'bottom-left',
        css: {
          left: '0%',
          bottom: '0%',
          right: 'auto',
          top: 'auto',
          minWidth: '160px',
          maxWidth: '48%',
          transform: 'none'
        }
      };
    }

    // 2. Explicit S-XXXXXXXX pattern in URL or filename
    const sCodeMatch = url.match(/(?:^|[^a-z0-9])(S-[0-9]{6,12})(?:[^a-z0-9]|$)/i);
    if (sCodeMatch) {
      const codeText = sCodeMatch[1].toUpperCase();
      return {
        detected: true,
        source: 'code-pattern',
        code: codeText,
        zone: options.zone || 'bottom-left',
        css: {
          left: '0%',
          bottom: '0%',
          right: 'auto',
          top: 'auto',
          minWidth: '160px',
          maxWidth: '48%',
          transform: 'none'
        }
      };
    }

    // 3. Forced zone via options
    if (options.zone === 'bottom-right' || url.includes('zone=bottom-right')) {
      return {
        detected: true,
        source: 'option',
        code: options.code || '',
        zone: 'bottom-right',
        css: {
          right: '0%',
          bottom: '0%',
          left: 'auto',
          top: 'auto',
          minWidth: '160px',
          maxWidth: '48%',
          transform: 'none'
        }
      };
    }

    if (options.force && options.zone) {
      const z = options.zone;
      let css = { minWidth: '160px', maxWidth: '48%' };
      if (z === 'bottom-right') {
        css.right = '0%';
        css.bottom = '0%';
        css.left = 'auto';
        css.top = 'auto';
      } else if (z === 'bottom-center') {
        css.left = '50%';
        css.bottom = '0%';
        css.transform = 'translateX(-50%)';
      } else {
        css.left = '0%';
        css.bottom = '0%';
        css.right = 'auto';
        css.top = 'auto';
      }
      return {
        detected: true,
        source: 'forced',
        code: options.code || '',
        zone: z,
        css: css
      };
    }

    // Clean image without supplier codes
    return { detected: false };
  }

  /**
   * Generates the luxury branded watermark badge HTML:
   * ● VADI STORE
   * SAROJINI BAZAAR
   */
  function getWatermarkBadgeHtml(options = {}) {
    const extraClass = options.className ? ` ${options.className}` : '';
    const styleAttr = options.style ? ` style="${options.style}"` : '';
    return `
      <div class="sarojini-watermark-overlay${extraClass}"${styleAttr} aria-label="Authentic Sarojini Bazaar Find">
        <div class="swm-title"><span class="swm-dot">●</span> VADI STORE</div>
        <div class="swm-sub">SAROJINI BAZAAR</div>
      </div>
    `.trim();
  }

  /**
   * Calculates precise coordinates of the code on the rendered image
   * taking into account object-fit: contain letterboxing and responsive zoom.
   */
  function positionOverlay(imgEl, wrapperEl, overlayEl, detection, options = {}) {
    if (!imgEl || !overlayEl || !detection || !detection.detected) {
      if (overlayEl) overlayEl.style.display = 'none';
      return;
    }

    const containerW = wrapperEl ? wrapperEl.clientWidth : imgEl.clientWidth;
    const containerH = wrapperEl ? wrapperEl.clientHeight : imgEl.clientHeight;

    const naturalW = imgEl.naturalWidth || containerW;
    const naturalH = imgEl.naturalHeight || containerH;

    if (!containerW || !containerH) return;

    // Detect if this is thumbnail or card context
    const hasThumbClass = overlayEl && overlayEl.classList && typeof overlayEl.classList.contains === 'function' && overlayEl.classList.contains('thumb-watermark');
    const isThumb = Boolean(options.isThumb || hasThumbClass || (wrapperEl && wrapperEl.classList && wrapperEl.classList.contains('pdp-thumb-item')) || containerW <= 100);

    const hasCardClass = overlayEl && overlayEl.classList && typeof overlayEl.classList.contains === 'function' && overlayEl.classList.contains('card-watermark');
    const isCard = Boolean(!isThumb && (options.isCard || hasCardClass || (containerW < 380 && wrapperEl && (
      (typeof wrapperEl.closest === 'function' && wrapperEl.closest('.product-card, .sarojini-product-card, .sarojini-card-media, .product-card-media')) ||
      (wrapperEl.classList && typeof wrapperEl.classList.contains === 'function' && wrapperEl.classList.contains('sarojini-card-img-wrap'))
    ))));

    // Calculate actual rendered image box inside object-fit: contain container
    let imgBoxW = imgEl.clientWidth || containerW;
    let imgBoxH = imgEl.clientHeight || containerH;
    let baseOffsetX = 0;
    let baseOffsetY = 0;

    if (wrapperEl && typeof wrapperEl.getBoundingClientRect === 'function' && typeof imgEl.getBoundingClientRect === 'function') {
      const wRect = wrapperEl.getBoundingClientRect();
      const iRect = imgEl.getBoundingClientRect();
      if (wRect.width > 0 && iRect.width > 0) {
        baseOffsetX = Math.max(0, iRect.left - wRect.left);
        baseOffsetY = Math.max(0, iRect.top - wRect.top);
        imgBoxW = iRect.width;
        imgBoxH = iRect.height;
      }
    } else if (imgEl && typeof imgEl.offsetLeft === 'number' && typeof imgEl.offsetTop === 'number' && (imgEl.offsetLeft > 0 || imgEl.offsetTop > 0)) {
      baseOffsetX = imgEl.offsetLeft;
      baseOffsetY = imgEl.offsetTop;
    } else if (wrapperEl && typeof window !== 'undefined' && window.getComputedStyle) {
      const compStyle = window.getComputedStyle(wrapperEl);
      const padL = parseFloat(compStyle.paddingLeft) || 0;
      const padT = parseFloat(compStyle.paddingTop) || 0;
      const padR = parseFloat(compStyle.paddingRight) || 0;
      const padB = parseFloat(compStyle.paddingBottom) || 0;
      baseOffsetX = padL;
      baseOffsetY = padT;
      imgBoxW = Math.max(0, containerW - padL - padR);
      imgBoxH = Math.max(0, containerH - padT - padB);
    } else if ((isThumb || isCard) && containerW > imgBoxW) {
      baseOffsetX = Math.max(0, Math.round((containerW - imgBoxW) / 2));
      baseOffsetY = Math.max(0, Math.round((containerH - imgBoxH) / 2));
    }

    if (!imgBoxW || !imgBoxH) {
      imgBoxW = containerW;
      imgBoxH = containerH;
    }

    const imgRatio = naturalW / naturalH;
    const boxRatio = imgBoxW / imgBoxH;

    let renderedW, renderedH, offsetX, offsetY;
    if (imgRatio > boxRatio) {
      renderedW = imgBoxW;
      renderedH = imgBoxW / imgRatio;
      offsetX = baseOffsetX;
      offsetY = baseOffsetY + (imgBoxH - renderedH) / 2;
    } else {
      renderedH = imgBoxH;
      renderedW = imgBoxH * imgRatio;
      offsetX = baseOffsetX + (imgBoxW - renderedW) / 2;
      offsetY = baseOffsetY;
    }

    const zone = detection.zone || 'bottom-left';
    const codeStr = (detection.code && typeof detection.code === 'string') ? detection.code : 'S-1084290722';
    const codeLen = Math.max(8, codeStr.length);

    // Calculate code width dynamically based on code length
    // Condensed grotesque printed code characters span ~2.4-2.7% of image width each
    const rawCodeWidthRatio = Math.max(0.30, Math.min(0.42, 0.02 + codeLen * 0.027));

    // Expand by 12-15% safety margin beyond the code bounding box on all sides
    const expandedWidthRatio = Math.min(0.48, rawCodeWidthRatio * 1.15);

    let badgeW, badgeH;
    if (isThumb) {
      // Compact micro-badge for thumbnail previews (~78x96px)
      const minW = Math.max(36, Math.round(renderedW * 0.44));
      badgeW = Math.max(minW, Math.round(renderedW * Math.max(0.48, expandedWidthRatio)));
      const minH = 12;
      badgeH = Math.max(minH, Math.min(16, Math.round(renderedH * 0.16)));
    } else if (isCard) {
      // Proportional and compact on cards: covers entire code with safety margins
      const minW = Math.max(65, Math.round(renderedW * 0.38));
      badgeW = Math.max(minW, Math.round(renderedW * Math.max(0.40, expandedWidthRatio)));
      const minH = Math.max(18, Math.round(renderedH * 0.08));
      badgeH = Math.max(minH, Math.round(renderedH * 0.092));
    } else {
      // Large PDP Main Gallery display & Zoom Lightbox
      const minW = renderedW < 360 ? 130 : 160;
      badgeW = Math.max(minW, Math.round(renderedW * expandedWidthRatio));
      const minH = renderedH < 360 ? 28 : 34;
      badgeH = Math.max(minH, Math.round(renderedH * 0.085));
    }

    let badgeX, badgeY;
    // Bottom anchor: flush to the bottom of the rendered image with +1px bleed for subpixel safety
    const targetBottom = Math.ceil(offsetY + renderedH);
    badgeY = Math.round(targetBottom - badgeH);

    if (overlayEl.classList && typeof overlayEl.classList.remove === 'function') {
      overlayEl.classList.remove('zone-bottom-left', 'zone-bottom-right', 'zone-bottom-center');
    }

    if (zone === 'bottom-right') {
      if (overlayEl.classList && typeof overlayEl.classList.add === 'function') {
        overlayEl.classList.add('zone-bottom-right');
      }
      // Anchor flush to right edge of rendered image with leftward extension
      badgeX = Math.round(offsetX + renderedW - badgeW);
    } else if (zone === 'bottom-center') {
      if (overlayEl.classList && typeof overlayEl.classList.add === 'function') {
        overlayEl.classList.add('zone-bottom-center');
      }
      badgeX = Math.round(offsetX + (renderedW - badgeW) / 2);
    } else {
      // bottom-left (default): Anchor flush to left edge of rendered image
      if (overlayEl.classList && typeof overlayEl.classList.add === 'function') {
        overlayEl.classList.add('zone-bottom-left');
      }
      badgeX = Math.max(0, Math.floor(offsetX));
    }

    overlayEl.style.display = 'flex';
    overlayEl.style.left = `${Math.round(badgeX)}px`;
    overlayEl.style.top = `${Math.round(badgeY)}px`;
    overlayEl.style.right = 'auto';
    overlayEl.style.bottom = 'auto';
    overlayEl.style.width = `${badgeW}px`;
    overlayEl.style.height = `${badgeH}px`;
    overlayEl.style.transform = 'none';
  }

  /**
   * Applies the Sarojini watermark to any image element and its containing wrapper.
   * Universal implementation for:
   * - Main PDP image
   * - Every gallery / additional image
   * - Thumbnail previews
   * - Lightbox / zoom modals
   * - Product cards in listings and recommendations
   *
   * @param {HTMLImageElement} imgEl - The image DOM element to inspect and cover
   * @param {HTMLElement} [containerEl] - Parent container element (defaults to imgEl.parentElement)
   * @param {Object} [options] - Options:
   *   @param {boolean} [options.isThumb=false] - If true, scales for thumbnail display
   *   @param {boolean} [options.isCard=false] - If true, scales for product card display
   *   @param {boolean} [options.isMain=false] - If true, scales for main PDP image display
   *   @param {string} [options.zone] - Forced zone: 'bottom-left' | 'bottom-right' | 'bottom-center'
   *   @param {boolean} [options.force=false] - Force watermark even if code not detected in URL
   *   @param {string} [options.code] - Supplier code string override
   * @returns {HTMLElement|null} The overlay element if created/updated, or null if clean
   */
  function applySarojiniWatermark(imgEl, containerEl, options = {}) {
    if (!imgEl) return null;
    const wrapperEl = containerEl || imgEl.parentElement;
    if (!wrapperEl) return null;

    // Ensure wrapper establishes a positioning context and hides overflow
    if (wrapperEl.style) {
      if (!wrapperEl.style.position || wrapperEl.style.position === 'static') {
        const computedPos = (typeof window !== 'undefined' && window.getComputedStyle)
          ? window.getComputedStyle(wrapperEl).position
          : '';
        if (!computedPos || computedPos === 'static') {
          wrapperEl.style.position = 'relative';
        }
      }
      wrapperEl.style.overflow = 'hidden';
    }

    const currentSrc = imgEl.currentSrc || imgEl.src || imgEl.getAttribute('src') || '';
    const detection = detectSupplierCode(currentSrc, options);

    let overlayEl = wrapperEl.querySelector('.sarojini-watermark-overlay');

    if (!detection.detected) {
      if (overlayEl) overlayEl.style.display = 'none';
      return null;
    }

    const isThumb = Boolean(
      options.isThumb ||
      (wrapperEl.classList && wrapperEl.classList.contains('pdp-thumb-item')) ||
      (wrapperEl.clientWidth > 0 && wrapperEl.clientWidth <= 110)
    );

    const isCard = Boolean(
      !isThumb && (
        options.isCard ||
        (overlayEl && overlayEl.classList && overlayEl.classList.contains('card-watermark')) ||
        (wrapperEl.classList && (
          wrapperEl.classList.contains('sarojini-card-img-wrap') ||
          wrapperEl.classList.contains('sarojini-card-media') ||
          wrapperEl.classList.contains('product-card-media')
        )) ||
        (typeof wrapperEl.closest === 'function' && wrapperEl.closest('.product-card, .sarojini-product-card'))
      )
    );

    let extraClass = '';
    if (isThumb) {
      extraClass = ' thumb-watermark';
    } else if (isCard) {
      extraClass = ' card-watermark';
    }

    if (!overlayEl) {
      wrapperEl.insertAdjacentHTML('beforeend', getWatermarkBadgeHtml({ className: extraClass.trim() }));
      overlayEl = wrapperEl.querySelector('.sarojini-watermark-overlay');
    } else {
      if (isThumb) {
        overlayEl.classList.remove('card-watermark');
        overlayEl.classList.add('thumb-watermark');
      } else if (isCard) {
        overlayEl.classList.remove('thumb-watermark');
        overlayEl.classList.add('card-watermark');
      } else {
        overlayEl.classList.remove('thumb-watermark', 'card-watermark');
      }
    }

    const recompute = () => {
      positionOverlay(imgEl, wrapperEl, overlayEl, detection, { isThumb, isCard, isMain: options.isMain });
    };

    // Run initial positioning
    if (imgEl.complete && imgEl.naturalWidth > 0) {
      recompute();
    } else {
      imgEl.addEventListener('load', recompute, { once: true });
    }

    // Clean up any existing watermark listener to prevent stale closures when image src changes
    if (imgEl._sarojiniWatermarkListener) {
      imgEl.removeEventListener('load', imgEl._sarojiniWatermarkListener);
    }
    imgEl._sarojiniWatermarkListener = recompute;
    imgEl.addEventListener('load', recompute);

    // Global resize and observer
    if (!wrapperEl._sarojiniWatermarkObserved) {
      wrapperEl._sarojiniWatermarkObserved = true;
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', recompute);
      }
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(recompute);
        ro.observe(wrapperEl);
      }
    }

    return overlayEl;
  }

  const _processedImageCache = new Map();

  /**
   * Processes a Sarojini image URL or image metadata, returning detection
   * parameters and normalized information for rendering with code-cover protection.
   */
  function processSarojiniImage(imageUrl, options = {}) {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return { url: imageUrl, detected: false };
    }

    const cacheKey = `${imageUrl.trim()}_${options.zone || ''}_${options.force ? '1' : '0'}`;
    if (_processedImageCache.has(cacheKey)) {
      return _processedImageCache.get(cacheKey);
    }

    const detection = detectSupplierCode(imageUrl, options);
    const result = {
      url: imageUrl,
      detected: detection.detected,
      source: detection.source || null,
      code: detection.code || null,
      zone: detection.zone || 'bottom-left',
      css: detection.css || null
    };

    _processedImageCache.set(cacheKey, result);
    return result;
  }

  /**
   * Attaches or updates the watermark overlay directly inside an image wrapper (PDP).
   * Maintained for backwards compatibility.
   */
  function updateImageWatermark(imgEl, wrapperEl, overlayEl, options = {}) {
    return applySarojiniWatermark(imgEl, wrapperEl, { isMain: true, ...options });
  }

  /**
   * Attaches or updates the watermark overlay on a single card image element.
   * Maintained for backwards compatibility.
   */
  function attachCardWatermark(imgEl, options = {}) {
    if (!imgEl) return null;
    const wrapperEl = imgEl.parentElement;
    return applySarojiniWatermark(imgEl, wrapperEl, { isCard: true, ...options });
  }

  /**
   * Scans a container (or document) and attaches card watermarks to all Sarojini product card images.
   */
  function attachCardWatermarks(root) {
    const container = root || (typeof document !== 'undefined' ? document : null);
    if (!container || typeof container.querySelectorAll !== 'function') return;

    const cardSelectors = [
      '.sarojini-product-card .product-card-media img',
      '.sarojini-product-card .sarojini-card-media img',
      '.product-card-media a img',
      '.sarojini-card-img-wrap img'
    ];
    const images = container.querySelectorAll(cardSelectors.join(', '));
    images.forEach(img => attachCardWatermark(img));
  }

  // Auto-initialize card watermarks on DOM load if running in browser
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => attachCardWatermarks());
    } else {
      setTimeout(() => attachCardWatermarks(), 50);
    }
  }

  const exportObj = {
    detectSupplierCode,
    getWatermarkBadgeHtml,
    positionOverlay,
    applySarojiniWatermark,
    processSarojiniImage,
    updateImageWatermark,
    attachCardWatermark,
    attachCardWatermarks
  };

  if (typeof window !== 'undefined') {
    window.SarojiniWatermark = exportObj;
    window.applySarojiniWatermark = applySarojiniWatermark;
    window.processSarojiniImage = processSarojiniImage;
  }

  return exportObj;
}));

