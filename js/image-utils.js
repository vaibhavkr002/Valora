/**
 * VELORA & SAROJINI BAZAAR - Shared Image Normalization & Resolution Engine
 * Handles robust extraction, context-aware URL normalization, and safe fallbacks
 * across Customer Storefront and Admin Portals.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.VeloraImageUtils = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <rect width="120" height="120" fill="#f8fafc" rx="8"/>
      <rect x="1" y="1" width="118" height="118" fill="none" stroke="#e2e8f0" stroke-width="2" rx="7"/>
      <path d="M40 45a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm-18 45h76L74 58 55 76l-11-11-22 25z" fill="#cbd5e1"/>
      <text x="60" y="104" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="600" fill="#94a3b8" text-anchor="middle">No Image</text>
    </svg>
  `.trim());

  /**
   * Determine if current page context is inside /admin/
   */
  function isCurrentContextAdmin() {
    if (typeof window === 'undefined' || !window.location) return false;
    const path = window.location.pathname || '';
    return path.includes('/admin/') || path.endsWith('/admin') || path.startsWith('admin/');
  }

  /**
   * Safely extract a primary image URL from string, array, JSON string, or object
   */
  function extractImageUrl(input, fallback) {
    if (!input) return fallback || '';

    // If input is an Array
    if (Array.isArray(input)) {
      for (const item of input) {
        const extracted = extractImageUrl(item);
        if (extracted) return extracted;
      }
      return fallback || '';
    }

    // If input is a String
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) return fallback || '';

      // Check if it's a JSON-stringified array or object
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
          (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try {
          const parsed = JSON.parse(trimmed);
          const extracted = extractImageUrl(parsed);
          if (extracted) return extracted;
        } catch (_) {}
      }

      // Return clean string
      return trimmed;
    }

    // If input is an Object
    if (typeof input === 'object') {
      const candidate = input.url || input.src || input.image || input.image_url || input.product_image || input.icon_or_image;
      if (candidate) return extractImageUrl(candidate, fallback);
    }

    return fallback || '';
  }

  /**
   * Normalize image URL based on caller context (Admin vs Customer Storefront)
   * Prevents 404s when accessing relative assets from /admin/ or vice versa.
   */
  function normalizeImageUrl(rawUrl, options) {
    const opts = options || {};
    const isAdmin = (typeof opts.isAdmin === 'boolean') ? opts.isAdmin : isCurrentContextAdmin();
    const fallback = opts.fallback || DEFAULT_PLACEHOLDER_SVG;

    const extracted = extractImageUrl(rawUrl);
    if (!extracted) return fallback;

    // Absolute URLs, protocol-relative, Data URLs, Blob URLs
    if (/^(https?:|\/\/|data:|blob:)/i.test(extracted)) {
      return extracted;
    }

    let path = extracted;

    // If path starts with root slash /assets/...
    if (path.startsWith('/assets/')) {
      // In web server environments, leading slash works everywhere
      return path;
    }

    if (isAdmin) {
      // Admin context: needs ../ prefix for relative assets
      if (path.startsWith('../assets/')) {
        return path;
      }
      if (path.startsWith('assets/')) {
        return '../' + path;
      }
      if (path.startsWith('./assets/')) {
        return '../' + path.slice(2);
      }
    } else {
      // Customer context (root): should not have ../assets/
      if (path.startsWith('../assets/')) {
        return path.slice(3); // remove ../
      }
      if (path.startsWith('./assets/')) {
        return path.slice(2); // remove ./
      }
    }

    return path;
  }

  /**
   * Extract and normalize image from any product or order-item record
   */
  function resolveProductImage(entity, options) {
    if (!entity) return (options && options.fallback) || DEFAULT_PLACEHOLDER_SVG;

    let candidate = entity.product_image;
    if (!candidate && Array.isArray(entity.images) && entity.images.length > 0) {
      candidate = entity.images[0];
    }
    if (!candidate) candidate = entity.image;
    if (!candidate) candidate = entity.image_url;
    if (!candidate) candidate = entity.icon_or_image;

    // If still not found but entity has gallery/images as object/json
    if (!candidate && entity.images) {
      candidate = extractImageUrl(entity.images);
    }

    return normalizeImageUrl(candidate, options);
  }

  return {
    extractImageUrl: extractImageUrl,
    normalizeImageUrl: normalizeImageUrl,
    resolveProductImage: resolveProductImage,
    getPlaceholderSvg: function (text) {
      if (!text) return DEFAULT_PLACEHOLDER_SVG;
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
          <rect width="120" height="120" fill="#f8fafc" rx="8"/>
          <rect x="1" y="1" width="118" height="118" fill="none" stroke="#e2e8f0" stroke-width="2" rx="7"/>
          <path d="M40 45a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm-18 45h76L74 58 55 76l-11-11-22 25z" fill="#cbd5e1"/>
          <text x="60" y="104" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="600" fill="#94a3b8" text-anchor="middle">${text}</text>
        </svg>
      `.trim());
    },
    DEFAULT_PLACEHOLDER_SVG: DEFAULT_PLACEHOLDER_SVG
  };
}));

