/**
 * VADI & Sarojini Bazaar - Standardized Product Card Rating Helper
 * Renders compact, high-trust star rating and review count:
 * Format: ★★★★★ 4.6 (128)
 * Empty state: ☆☆☆☆☆ No reviews yet
 * Uses strictly real backend data, zero fake ratings or counts.
 */
(function () {
  'use strict';

  window.renderProductCardRating = function (rating, reviewCount) {
    const r = Number(rating) || 0;
    const c = Number(reviewCount) || 0;

    // Strict requirement: If no reviews / rating 0, show clean empty state instead of fake data
    if (c <= 0 || r <= 0) {
      return `
        <div class="product-card-rating product-card-rating-empty" aria-label="No reviews yet">
          <span class="stars-stars stars-stars-empty" aria-hidden="true">☆☆☆☆☆</span>
          <span class="no-reviews-label">No reviews yet</span>
        </div>
      `;
    }

    const rounded = Math.round(r);
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      stars += (i <= rounded) ? '★' : '☆';
    }

    return `
      <div class="product-card-rating" aria-label="${r.toFixed(1)} out of 5 stars from ${c} reviews">
        <span class="stars-stars" aria-hidden="true">${stars}</span>
        <span class="stars-score">${r.toFixed(1)}</span>
        <span class="reviews-count">(${c})</span>
      </div>
    `;
  };
})();
