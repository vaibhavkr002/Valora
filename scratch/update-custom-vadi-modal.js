const fs = require('fs');
const path = require('path');

// 1. UPDATE CHECKOUT.HTML
const checkoutHtmlPath = path.join(__dirname, '..', 'checkout.html');
let html = fs.readFileSync(checkoutHtmlPath, 'utf8');

const oldModalRegex = /<!--\s*={5,}\s*UPI VERIFICATION MODAL[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const newModalMarkup = `<!-- ========================================================================
       CUSTOM VADII UPI PAYMENT MODAL (DIRECT UPI — NO GATEWAY)
       ======================================================================== -->
  <div id="upi-payment-modal" class="upi-modal-overlay" aria-hidden="true">
    <div class="upi-modal-card vadi-upi-modal-card" role="dialog" aria-modal="true" aria-labelledby="upi-modal-title">
      
      <!-- Modal Header -->
      <div class="vadi-modal-header">
        <div class="vadi-modal-header-left">
          <div class="vadi-modal-logo-badge">
            <span>V</span>
          </div>
          <div class="vadi-modal-header-text">
            <div class="vadi-modal-brand-line">
              <span class="vadi-brand-name">VADII</span>
              <span class="vadi-trust-chip">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                DIRECT UPI
              </span>
            </div>
            <h3 class="vadi-modal-title" id="upi-modal-title">Complete UPI Payment</h3>
          </div>
        </div>
        <button type="button" class="vadi-modal-close-btn" id="btn-upi-modal-close" aria-label="Close modal">✕</button>
      </div>

      <!-- Modal Body -->
      <div class="upi-modal-body vadi-modal-body">

        <!-- Status / Alert Box -->
        <div class="vadi-status-box" id="upi-status-box">
          <div class="vadi-status-indicator" id="upi-status-icon">⚡</div>
          <div class="vadi-status-info">
            <h4 class="vadi-status-heading" id="upi-status-heading">Direct UPI to Merchant Account</h4>
            <p class="vadi-status-desc" id="upi-status-desc">Pay directly to merchant account (vadii@ptaxis) via any UPI app or scan the QR code.</p>
          </div>
        </div>

        <!-- Dynamic Amount Hero Card -->
        <div class="vadi-amount-card">
          <div class="vadi-amount-top">
            <div>
              <span class="vadi-amount-label" id="modal-upi-label">Payable Now</span>
              <div class="vadi-amount-val" id="modal-upi-amount">₹0</div>
            </div>
            <div style="text-align: right;">
              <span class="vadi-pay-type-badge" id="modal-upi-type-badge">100% Full Payment</span>
            </div>
          </div>
          <div class="vadi-amount-breakdown" id="modal-upi-breakdown-row">
            100% Online Payment • Zero COD Balance
          </div>
        </div>

        <!-- Merchant & Order Metadata Strip -->
        <div class="vadi-merchant-strip">
          <div class="vadi-merchant-row">
            <span class="vadi-strip-label">Merchant</span>
            <span class="vadi-strip-val"><strong>VADII</strong></span>
          </div>
          <div class="vadi-merchant-row">
            <span class="vadi-strip-label">UPI ID</span>
            <div class="vadi-copy-inline">
              <strong id="modal-merchant-vpa" class="vadi-mono-val">vadii@ptaxis</strong>
              <button type="button" class="vadi-btn-copy-sm" id="btn-copy-upi" title="Copy UPI ID">Copy</button>
            </div>
          </div>
          <div class="vadi-merchant-row">
            <span class="vadi-strip-label">Order Ref</span>
            <div class="vadi-copy-inline">
              <strong id="modal-upi-ref" class="vadi-mono-val">VAD-ORD-...</strong>
              <button type="button" class="vadi-btn-copy-sm" id="btn-copy-ref" title="Copy Reference">Copy</button>
            </div>
          </div>
        </div>

        <!-- Mode Switcher Tabs (Mobile UPI App vs Scan QR) -->
        <div class="vadi-mode-tabs" id="vadi-mode-tabs">
          <button type="button" class="vadi-tab-btn active" id="tab-btn-app">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
            <span>Pay via UPI App</span>
          </button>
          <button type="button" class="vadi-tab-btn" id="tab-btn-qr">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            <span>Scan QR Code</span>
          </button>
        </div>

        <!-- VIEW 1: Mobile UPI App Launch Section -->
        <div class="vadi-upi-view" id="upi-view-app">
          <a href="#" class="vadi-btn-open-upi" id="btn-launch-upi-app">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span id="btn-launch-text">Open UPI App to Pay</span>
          </a>

          <!-- Quick App Select Cards -->
          <div class="vadi-app-grid-title">Or choose your preferred UPI app:</div>
          <div class="vadi-app-grid">
            <button type="button" class="vadi-app-chip" data-app="gpay">
              <span class="vadi-app-icon" style="color: #4285f4; font-weight: 900;">G</span>
              <span>Google Pay</span>
            </button>
            <button type="button" class="vadi-app-chip" data-app="phonepe">
              <span class="vadi-app-icon" style="color: #5f259f; font-weight: 900;">पे</span>
              <span>PhonePe</span>
            </button>
            <button type="button" class="vadi-app-chip" data-app="paytm">
              <span class="vadi-app-icon" style="color: #00baf2; font-weight: 900;">P</span>
              <span>Paytm</span>
            </button>
            <button type="button" class="vadi-app-chip" data-app="bhim">
              <span class="vadi-app-icon" style="color: #00796b; font-weight: 900;">B</span>
              <span>BHIM</span>
            </button>
            <button type="button" class="vadi-app-chip" data-app="other">
              <span class="vadi-app-icon">⚡</span>
              <span>Other App</span>
            </button>
          </div>
          <p class="vadi-app-notice">Clicking launches your device's UPI intent. No money is auto-captured; return here after payment to submit confirmation.</p>
        </div>

        <!-- VIEW 2: Desktop / QR Code Section -->
        <div class="vadi-upi-view" id="upi-view-qr" style="display: none;">
          <div class="vadi-qr-card">
            <div class="vadi-qr-frame">
              <div id="upi-qr-container" class="upi-qr-container"></div>
            </div>
            <p class="vadi-qr-hint">Scan using <strong>Google Pay</strong>, <strong>PhonePe</strong>, <strong>Paytm</strong>, <strong>CRED</strong>, or <strong>BHIM</strong></p>
            <div class="vadi-qr-actions">
              <button type="button" class="vadi-btn-secondary-sm" id="btn-copy-payment-link">
                <i class="fas fa-link"></i> Copy Payment Link
              </button>
              <button type="button" class="vadi-btn-secondary-sm" id="btn-copy-upi-desktop">
                <i class="fas fa-copy"></i> Copy UPI ID
              </button>
            </div>
          </div>
        </div>

        <!-- Post-Payment Verification Section (Did You Complete Payment?) -->
        <div class="vadi-verify-card" id="vadi-verify-card">
          <div class="vadi-verify-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>Did you complete the payment?</span>
          </div>
          <p class="vadi-verify-desc">
            After completing transfer to <strong>vadii@ptaxis</strong>, submit your confirmation below so our admin team can verify your payment against merchant bank credits.
          </p>
          
          <div class="vadi-utr-input-wrap">
            <label for="input-customer-utr" class="vadi-utr-label">
              UPI Reference / UTR Number <span class="vadi-opt-badge">(Optional but recommended)</span>
            </label>
            <input type="text" id="input-customer-utr" class="vadi-utr-input" placeholder="e.g. 427819283741 (12 digits)" maxlength="25" autocomplete="off">
            <div class="vadi-utr-help">Found in your UPI app payment receipt under 'UPI Ref No' or 'UTR'.</div>
          </div>
        </div>

        <!-- Verification Action Buttons -->
        <div class="upi-modal-actions">
          <button type="button" class="vadi-btn-confirm-paid" id="btn-confirm-payment">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span id="btn-confirm-paid-text">I HAVE PAID</span>
          </button>
          <button type="button" class="vadi-btn-cancel-modal" id="btn-cancel-payment">
            Cancel & Return to Checkout
          </button>
        </div>

      </div>
    </div>
  </div>`;

if (oldModalRegex.test(html)) {
  html = html.replace(oldModalRegex, newModalMarkup);
  fs.writeFileSync(checkoutHtmlPath, html, 'utf8');
  console.log('Successfully updated checkout.html modal markup!');
} else {
  console.warn('Could not match old modal in checkout.html with regex, attempting direct replacement...');
  const startMarker = '<div id="upi-payment-modal" class="upi-modal-overlay" aria-hidden="true">';
  const endMarker = '<!-- ========================================================================\n       TOAST CONTAINER';
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx !== -1 && endIdx !== -1) {
    html = html.slice(0, startIdx) + newModalMarkup + '\n\n  ' + html.slice(endIdx);
    fs.writeFileSync(checkoutHtmlPath, html, 'utf8');
    console.log('Successfully updated checkout.html modal markup via substring markers!');
  } else {
    console.error('Markers not found in checkout.html!');
  }
}
