/**
 * VELORA - Privacy-Conscious First-Party Storefront Analytics Engine
 * Tracks customer journeys, traffic trends, and conversions without external trackers.
 * Respects customer privacy: strictly zero passwords, tokens, or PII.
 * Never tracks Admin Panel actions.
 */

(function () {
  'use strict';

  // 1. Guard against running in Admin Panel or non-browser environments
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.location.pathname.includes('/admin/')) {
    return; // Admin sessions are completely excluded from customer analytics
  }

  const SUPABASE_PROJECT_URL = "https://brioiujppaaycydndrcp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78";

  // 2. Anonymous Identifiers (Visitor ID across sessions, Session ID per tab/session)
  function getVisitorId() {
    try {
      let vid = localStorage.getItem('velora_analytics_vid');
      if (!vid) {
        vid = 'v_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
        localStorage.setItem('velora_analytics_vid', vid);
      }
      return vid;
    } catch (_) {
      return 'v_anon_' + Date.now().toString(36);
    }
  }

  function getSessionId() {
    try {
      let sid = sessionStorage.getItem('velora_analytics_sid');
      if (!sid) {
        sid = 's_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
        sessionStorage.setItem('velora_analytics_sid', sid);
      }
      return sid;
    } catch (_) {
      return 's_anon_' + Date.now().toString(36);
    }
  }

  // 3. Device Type Detection
  function detectDeviceType() {
    const ua = (navigator.userAgent || '').toLowerCase();
    const width = window.innerWidth || (screen ? screen.width : 1024);

    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua) || (width >= 600 && width <= 960)) {
      return 'tablet';
    }
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua) || width < 600) {
      return 'mobile';
    }
    return 'desktop';
  }

  // 4. In-Memory Queue & Debounce State
  const eventQueue = [];
  let isFlushing = false;
  let flushTimer = null;
  let lastPageView = { path: null, timestamp: 0 };

  // Helper to normalize path
  function getCleanPath() {
    let p = window.location.pathname;
    if (p.endsWith('/index.html') || p === '/') p = '/homepage.html';
    return p + (window.location.search || '');
  }

  // 5. Send Batch to Supabase
  async function flushQueue() {
    if (isFlushing || eventQueue.length === 0) return;
    isFlushing = true;

    // Take current snapshot of items
    const batch = eventQueue.splice(0, 20);

    try {
      // Use standard fetch with keepalive or supabase client
      const restUrl = `${SUPABASE_PROJECT_URL}/rest/v1/customer_analytics`;
      const response = await fetch(restUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(batch),
        keepalive: true
      });

      if (!response.ok) {
        // If error, re-queue up to 20 items to avoid infinite buildup
        if (eventQueue.length < 50) {
          eventQueue.unshift(...batch);
        }
      }
    } catch (err) {
      // Non-blocking silent catch; preserve queue up to reasonable limit
      if (eventQueue.length < 50) {
        eventQueue.unshift(...batch);
      }
    } finally {
      isFlushing = false;
    }
  }

  function scheduleFlush(delay = 3000) {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushQueue, delay);
  }

  // 6. Push Event to Queue
  function recordEvent(eventType, details = {}) {
    try {
      const allowedEvents = ['page_view', 'search', 'add_to_cart', 'wishlist_action', 'checkout_started', 'order_completed', 'product_view'];
      if (!allowedEvents.includes(eventType)) return;

      const pagePath = details.page_path || getCleanPath();

      const eventPayload = {
        session_id: getSessionId(),
        visitor_id: getVisitorId(),
        event_type: eventType,
        page_path: pagePath,
        product_id: details.product_id || null,
        category_slug: details.category_slug || null,
        search_query: details.search_query ? String(details.search_query).slice(0, 100) : null,
        device_type: detectDeviceType(),
        referrer: details.referrer || (document.referrer ? document.referrer.slice(0, 250) : null),
        metadata: details.metadata || {}
      };

      eventQueue.push(eventPayload);

      // Flush immediately if high-value conversion event or queue length > 5
      if (eventType === 'order_completed' || eventType === 'checkout_started' || eventQueue.length >= 5) {
        flushQueue();
      } else {
        scheduleFlush(3000);
      }
    } catch (_) {
      // Analytics must never throw or crash storefront
    }
  }

  // 7. Track Initial Page View with Re-render Guard
  function autoTrackPageView() {
    const currentPath = getCleanPath();
    const now = Date.now();

    // Guard: ignore identical path within 4 seconds (debounce re-renders)
    if (lastPageView.path === currentPath && (now - lastPageView.timestamp) < 4000) {
      return;
    }

    lastPageView = { path: currentPath, timestamp: now };

    // Extract product ID or category from query string if available
    let prodId = null;
    let catSlug = null;
    try {
      const params = new URLSearchParams(window.location.search);
      prodId = params.get('id') || params.get('productId');
      catSlug = params.get('category') || params.get('cat');
      
      // If on product.html and UUID format, mark as product_view as well
      const isUUID = prodId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prodId);
      if (window.location.pathname.includes('product.html') && isUUID) {
        recordEvent('product_view', { product_id: prodId, category_slug: catSlug });
      }
    } catch (_) {}

    recordEvent('page_view', {
      product_id: prodId,
      category_slug: catSlug
    });
  }

  // Flush on page visibility change and unload
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushQueue();
      }
    });
  }
  window.addEventListener('pagehide', () => {
    flushQueue();
  });

  // 8. Public Analytics API
  window.VeloraAnalytics = {
    trackPageView: (customPath, metadata) => {
      recordEvent('page_view', { page_path: customPath, metadata });
    },
    trackProductView: (productId, categorySlug, metadata) => {
      recordEvent('product_view', { product_id: productId, category_slug: categorySlug, metadata });
    },
    trackAddToCart: (productId, categorySlug, metadata) => {
      recordEvent('add_to_cart', { product_id: productId, category_slug: categorySlug, metadata });
    },
    trackWishlist: (productId, action = 'toggle') => {
      recordEvent('wishlist_action', { product_id: productId, metadata: { action } });
    },
    trackSearch: (query, resultsCount = 0) => {
      if (!query || !query.trim()) return;
      recordEvent('search', { search_query: query.trim(), metadata: { results_count: resultsCount } });
    },
    trackCheckoutStarted: (itemsCount = 0, totalAmount = 0) => {
      recordEvent('checkout_started', { metadata: { items_count: itemsCount, total: totalAmount } });
    },
    trackOrderCompleted: (orderId, totalAmount = 0, metadata = {}) => {
      recordEvent('order_completed', { metadata: { order_id: orderId, total: totalAmount, ...metadata } });
    },
    flush: flushQueue
  };

  // 9. Initialize Auto-Tracking on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoTrackPageView);
  } else {
    autoTrackPageView();
  }
})();

