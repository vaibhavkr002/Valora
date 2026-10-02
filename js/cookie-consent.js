/**
 * VALORA - Production Cookie & Privacy Consent Engine
 * Standard-compliant, DPDP-aligned, persistent, zero dark patterns.
 * Exposes window.VeloraConsent API for analytics & marketing guards.
 */

(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Never display on Admin Panel
  if (window.location.pathname.includes('/admin/')) return;

  const STORAGE_KEY = 'velora_cookie_consent';
  const CONSENT_VERSION = '1.0';

  // 1. Consent State Management
  function getSavedConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === CONSENT_VERSION) {
          return parsed;
        }
      }
    } catch (_) {}
    return null;
  }

  function saveConsent(preferences) {
    const consentObj = {
      essential: true, // Always active
      analytics: Boolean(preferences.analytics),
      marketing: Boolean(preferences.marketing),
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consentObj));
    } catch (_) {}

    // Dispatch event for reactive listeners (e.g. analytics)
    window.dispatchEvent(new CustomEvent('velora:consent-updated', { detail: consentObj }));

    dismissBanner();
    closeSettingsModal();
    return consentObj;
  }

  function hasConsent(category) {
    if (category === 'essential') return true;
    const consent = getSavedConsent();
    if (!consent) return false;
    return Boolean(consent[category]);
  }

  // 2. Auto-load CSS if not already present
  function ensureStylesheet() {
    if (!document.querySelector('link[href*="cookie-consent.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'css/cookie-consent.css';
      document.head.appendChild(link);
    }
  }

  // 3. Render Cookie Consent Banner
  function renderBanner() {
    if (getSavedConsent()) return; // Already consented
    if (document.getElementById('velora-cookie-banner')) return; // Already rendered

    ensureStylesheet();

    const banner = document.createElement('div');
    banner.id = 'velora-cookie-banner';
    banner.className = 'velora-cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie and Privacy Consent');

    banner.innerHTML = `
      <div class="velora-cookie-header">
        <div class="velora-cookie-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
            <path d="M8.5 8.5v.01"></path>
            <path d="M16 15.5v.01"></path>
            <path d="M12 12v.01"></path>
            <path d="M11 17v.01"></path>
            <path d="M7 13v.01"></path>
          </svg>
        </div>
        <h3 class="velora-cookie-title">We Value Your Privacy</h3>
      </div>
      <p class="velora-cookie-desc">
        We use cookies and similar technologies to keep VALORA secure, remember preferences, improve your shopping experience, and understand storefront usage. Learn more in our <a href="privacy-policy.html">Privacy Policy</a>.
      </p>
      <div class="velora-cookie-actions">
        <button type="button" class="velora-cookie-btn velora-cookie-btn-accept" id="velora-cookie-btn-accept">Accept All</button>
        <button type="button" class="velora-cookie-btn velora-cookie-btn-reject" id="velora-cookie-btn-reject">Reject Non-Essential</button>
        <button type="button" class="velora-cookie-btn velora-cookie-btn-settings" id="velora-cookie-btn-settings">Cookie Settings</button>
      </div>
    `;

    document.body.appendChild(banner);

    // Event Bindings
    document.getElementById('velora-cookie-btn-accept').addEventListener('click', () => {
      saveConsent({ analytics: true, marketing: true });
    });

    document.getElementById('velora-cookie-btn-reject').addEventListener('click', () => {
      saveConsent({ analytics: false, marketing: false });
    });

    document.getElementById('velora-cookie-btn-settings').addEventListener('click', () => {
      openSettingsModal();
    });
  }

  function dismissBanner() {
    const banner = document.getElementById('velora-cookie-banner');
    if (banner) {
      banner.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(15px)';
      setTimeout(() => banner.remove(), 200);
    }
  }

  // 4. Render Cookie Settings Modal
  function openSettingsModal() {
    ensureStylesheet();

    let backdrop = document.getElementById('velora-cookie-modal-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'velora-cookie-modal-backdrop';
      backdrop.className = 'velora-cookie-modal-backdrop';
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');
      backdrop.setAttribute('aria-labelledby', 'velora-cookie-modal-title');

      const current = getSavedConsent() || { analytics: false, marketing: false };

      backdrop.innerHTML = `
        <div class="velora-cookie-modal">
          <div class="velora-cookie-modal-header">
            <h3 class="velora-cookie-modal-title" id="velora-cookie-modal-title">Cookie & Privacy Preferences</h3>
            <button type="button" class="velora-cookie-modal-close" id="velora-cookie-modal-close" aria-label="Close Modal">✕</button>
          </div>
          <div class="velora-cookie-modal-body">
            <!-- Essential -->
            <div class="velora-cookie-category-card">
              <div class="velora-cookie-category-header">
                <span class="velora-cookie-category-title">
                  Strictly Essential
                  <span class="velora-cookie-badge-locked">Always Active</span>
                </span>
                <label class="velora-cookie-toggle" aria-label="Strictly Essential cookies toggle (locked)">
                  <input type="checkbox" checked disabled>
                  <span class="velora-cookie-slider"></span>
                </label>
              </div>
              <p class="velora-cookie-category-desc">
                Necessary for security, account authentication, cart operations, checkout processing, fraud protection, and core storefront functionality. These cannot be switched off.
              </p>
            </div>

            <!-- Analytics -->
            <div class="velora-cookie-category-card">
              <div class="velora-cookie-category-header">
                <span class="velora-cookie-category-title">First-Party Analytics & Telemetry</span>
                <label class="velora-cookie-toggle" aria-label="Analytics cookies toggle">
                  <input type="checkbox" id="velora-consent-toggle-analytics" ${current.analytics ? 'checked' : ''}>
                  <span class="velora-cookie-slider"></span>
                </label>
              </div>
              <p class="velora-cookie-category-desc">
                Helps us understand anonymous store traffic patterns, popular products, and journey conversion rates via our internal telemetry. We never share or sell this data to external ad brokers.
              </p>
            </div>

            <!-- Marketing / Promotional -->
            <div class="velora-cookie-category-card">
              <div class="velora-cookie-category-header">
                <span class="velora-cookie-category-title">Promotional & Personalization</span>
                <label class="velora-cookie-toggle" aria-label="Promotional cookies toggle">
                  <input type="checkbox" id="velora-consent-toggle-marketing" ${current.marketing ? 'checked' : ''}>
                  <span class="velora-cookie-slider"></span>
                </label>
              </div>
              <p class="velora-cookie-category-desc">
                Enables tailored promotional announcements, coupon banners, and seasonal product showcase recommendations customized to your browsing preferences.
              </p>
            </div>
          </div>
          <div class="velora-cookie-modal-footer">
            <button type="button" class="velora-cookie-btn-modal-save" id="velora-cookie-modal-save">Save Preferences</button>
            <button type="button" class="velora-cookie-btn-modal-accept" id="velora-cookie-modal-accept-all">Accept All</button>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);

      // Modal event handlers
      document.getElementById('velora-cookie-modal-close').addEventListener('click', closeSettingsModal);
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeSettingsModal();
      });

      document.getElementById('velora-cookie-modal-save').addEventListener('click', () => {
        const analytics = document.getElementById('velora-consent-toggle-analytics')?.checked || false;
        const marketing = document.getElementById('velora-consent-toggle-marketing')?.checked || false;
        saveConsent({ analytics, marketing });
      });

      document.getElementById('velora-cookie-modal-accept-all').addEventListener('click', () => {
        saveConsent({ analytics: true, marketing: true });
      });
    } else {
      backdrop.style.display = 'flex';
    }
  }

  function closeSettingsModal() {
    const backdrop = document.getElementById('velora-cookie-modal-backdrop');
    if (backdrop) {
      backdrop.remove();
    }
  }

  // 5. Expose Global API
  window.VeloraConsent = {
    hasConsent,
    getConsent: getSavedConsent,
    setConsent: saveConsent,
    showBanner: renderBanner,
    showSettings: openSettingsModal,
    closeSettings: closeSettingsModal
  };

  // 6. Delayed Entrance for smooth UX (800ms)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(renderBanner, 800);
    });
  } else {
    setTimeout(renderBanner, 800);
  }
})();
