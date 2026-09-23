/**
 * VADI - Sarojini Bazaar Interactive Controller
 * Dynamically fetches and renders real Sarojini products from Supabase.
 * Pure Vanilla JavaScript
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

  async function fetchSarojiniFeaturedProducts() {
    const client = window.supabaseClient || (window.supabase && typeof window.supabase.createClient === 'function' ? window.supabase : null);
    let products = [];

    // 1. Try querying homepage_sections configured row
    if (client && typeof client.from === 'function') {
      try {
        const { data: sec } = await client
          .from('homepage_sections')
          .select('*')
          .eq('id', '22222222-2222-4222-a222-000000000001')
          .maybeSingle();

        if (sec && sec.content_config && Array.isArray(sec.content_config.product_ids) && sec.content_config.product_ids.length > 0) {
          const pids = sec.content_config.product_ids.filter(Boolean);
          const { data: pData } = await client
            .from('sarojini_products')
            .select('*')
            .in('id', pids)
            .eq('is_active', true);

          const pMap = new Map();
          if (Array.isArray(pData)) {
            pData.forEach(p => pMap.set(String(p.id), p));
          }

          // Check if any pids are missing (cross-store Main products)
          const missingPids = pids.filter(id => !pMap.has(String(id)));
          if (missingPids.length > 0) {
            try {
              const { data: mData } = await client
                .from('products')
                .select('*')
                .in('id', missingPids)
                .eq('is_active', true);
              if (Array.isArray(mData)) {
                mData.forEach(m => pMap.set(String(m.id), {
                  ...m,
                  department: m.department || 'MEN',
                  brand: m.brand || 'Sarojini Bazaar'
                }));
              }
            } catch (_) {}
          }

          products = pids.map(id => pMap.get(String(id))).filter(Boolean);
        }
      } catch (_) {}
    }

    // 2. If no products yet, query all active featured products from sarojini_products
    if (products.length === 0 && client && typeof client.from === 'function') {
      try {
        const { data: pData } = await client
          .from('sarojini_products')
          .select('*')
          .eq('is_active', true)
          .eq('is_featured', true)
          .order('created_at', { ascending: false })
          .limit(8);

        if (Array.isArray(pData) && pData.length > 0) {
          products = pData;
        }
      } catch (_) {}
    }

    // 3. Fallback: store_settings if direct table read fails
    if (products.length === 0 && client && typeof client.from === 'function') {
      try {
        const { data: sRow } = await client
          .from('store_settings')
          .select('value')
          .eq('key', 'sarojini_featured_section')
          .maybeSingle();

        if (sRow && sRow.value && sRow.value.content_config && Array.isArray(sRow.value.content_config.product_ids)) {
          const pids = sRow.value.content_config.product_ids;
          const { data: sProds } = await client.from('store_settings').select('value').eq('key', 'sarojini_products').maybeSingle();
          if (sProds && Array.isArray(sProds.value)) {
            const pMap = new Map();
            sProds.value.forEach(p => {
              if (p.is_active !== false) pMap.set(String(p.id), p);
            });
            products = pids.map(id => pMap.get(String(id))).filter(Boolean);
          }
        }
      } catch (_) {}
    }

    return products;
  }

  function renderCarouselCards(track, products) {
    if (!track) return;

    if (!Array.isArray(products) || products.length === 0) {
      track.innerHTML = `
        <div style="grid-column: 1/-1; width: 100%; text-align: center; padding: 40px 16px; color: #78716c;">
          <p style="font-weight: 600; font-size: 0.95rem; margin: 0;">New street drops arriving soon!</p>
          <p style="font-size: 0.82rem; margin-top: 4px; color: #a8a29e;">Check back for fresh curated pieces.</p>
        </div>
      `;
      return;
    }

    track.innerHTML = products.map(prod => {
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

      return `
        <div class="sarojini-product-card" data-product-id="${prod.id}">
          <div class="sarojini-card-media">
            <button type="button" class="sarojini-card-wishlist-btn ${isWishlisted ? 'active' : ''}" data-wishlist-id="${prod.id}" aria-label="Add to Wishlist">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${isWishlisted ? '#ef4444' : 'none'}" stroke="${isWishlisted ? '#ef4444' : 'currentColor'}" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <a href="sarojini-product-details.html?id=${encodeURIComponent(prod.id)}" class="sarojini-card-img-wrap" style="position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
              <img src="${firstImg}" alt="${escapeHtml(prod.name)}" class="sarojini-card-img" loading="lazy" onerror="this.onerror=null; this.src='${fallbackSvg}';">
            </a>
          </div>
          <div class="sarojini-card-body">
            <a href="sarojini-product-details.html?id=${encodeURIComponent(prod.id)}" style="text-decoration:none; color:inherit;">
              <h4 class="sarojini-card-title">${escapeHtml(prod.name)}</h4>
            </a>
            <div class="sarojini-card-price-row">
              <span class="sarojini-price-current">${formatINR(price)}</span>
              ${origPrice > price ? `<span class="sarojini-price-original">${formatINR(origPrice)}</span>` : ''}
            </div>
            ${discount > 0 ? `<span class="sarojini-discount-badge">${discount}% OFF</span>` : `<span class="sarojini-discount-badge" style="background:#f59e0b;">STEAL</span>`}
          </div>
        </div>
      `;
    }).join('');

    // Dynamically attach and position branded code-cover watermarks on Sarojini cards
    if (window.SarojiniWatermark && typeof window.SarojiniWatermark.attachCardWatermarks === 'function') {
      window.SarojiniWatermark.attachCardWatermarks(track);
    }

    // Attach premium 3D animated promotional offer stickers to Sarojini cards
    if (window.SarojiniCardAds && typeof window.SarojiniCardAds.init === 'function') {
      window.SarojiniCardAds.init(track);
    }
  }

  function setupCarouselInteraction(section) {
    const track = section.querySelector('.sarojini-carousel-track');
    const btnPrev = section.querySelector('.sarojini-carousel-btn.btn-prev');
    const btnNext = section.querySelector('.sarojini-carousel-btn.btn-next');

    if (track && btnPrev && btnNext) {
      function getScrollAmount() {
        const card = track.querySelector('.sarojini-product-card');
        if (!card) return 240;
        return card.offsetWidth + 16;
      }

      btnPrev.onclick = () => {
        track.scrollBy({
          left: -getScrollAmount() * 2,
          behavior: 'smooth'
        });
      };

      btnNext.onclick = () => {
        track.scrollBy({
          left: getScrollAmount() * 2,
          behavior: 'smooth'
        });
      };

      function updateButtons() {
        const maxScroll = track.scrollWidth - track.clientWidth;
        btnPrev.style.opacity = track.scrollLeft <= 5 ? '0.4' : '1';
        btnPrev.style.pointerEvents = track.scrollLeft <= 5 ? 'none' : 'auto';
        btnNext.style.opacity = track.scrollLeft >= maxScroll - 5 ? '0.4' : '1';
        btnNext.style.pointerEvents = track.scrollLeft >= maxScroll - 5 ? 'none' : 'auto';
      }

      track.addEventListener('scroll', updateButtons, { passive: true });
      window.addEventListener('resize', updateButtons, { passive: true });
      setTimeout(updateButtons, 150);
    }

    // Wishlist Toggle
    const wishlistBtns = section.querySelectorAll('.sarojini-card-wishlist-btn');
    wishlistBtns.forEach(btn => {
      const prodId = btn.dataset.wishlistId || btn.dataset.prodId || btn.closest('[data-product-id]')?.dataset.productId;
      if (prodId && window.VadiWishlist && typeof window.VadiWishlist.has === 'function') {
        const isSaved = window.VadiWishlist.has(prodId);
        btn.classList.toggle('active', isSaved);
        const icon = btn.querySelector('svg');
        if (icon) {
          icon.setAttribute('fill', isSaved ? '#ef4444' : 'none');
          icon.setAttribute('stroke', isSaved ? '#ef4444' : 'currentColor');
        }
      }

      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pid = btn.dataset.wishlistId || btn.dataset.prodId || btn.closest('[data-product-id]')?.dataset.productId;
        if (pid && window.VadiWishlist && typeof window.VadiWishlist.toggle === 'function') {
          window.VadiWishlist.toggle(pid, 'sarojini');
          const isNowActive = window.VadiWishlist.has(pid);
          btn.classList.toggle('active', isNowActive);
          const icon = btn.querySelector('svg');
          if (icon) {
            icon.setAttribute('fill', isNowActive ? '#ef4444' : 'none');
            icon.setAttribute('stroke', isNowActive ? '#ef4444' : 'currentColor');
          }
        }
      };
    });
  }

  async function initSarojiniBazaar() {
    const section = document.getElementById('sarojini-bazaar-section');
    if (!section) return;

    const track = section.querySelector('.sarojini-carousel-track');
    const products = await fetchSarojiniFeaturedProducts();
    renderCarouselCards(track, products);
    setupCarouselInteraction(section);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSarojiniBazaar);
  } else {
    initSarojiniBazaar();
  }

  // Listen for live updates
  window.addEventListener('velora:homepage-sections-updated', initSarojiniBazaar);
  window.addEventListener('storage', (e) => {
    if (e.key === 'sarojini_global_cache_invalidated' || e.key === 'velora_global_cache_invalidated') {
      initSarojiniBazaar();
    }
  });

  window.VadiSarojiniBazaar = {
    init: initSarojiniBazaar,
    refresh: initSarojiniBazaar
  };
})();
