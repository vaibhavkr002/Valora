const fs = require('fs');

// --- 1. UPDATE admin/order-details.html ---
let html = fs.readFileSync('admin/order-details.html', 'utf8');

const oldPaymentCardRegex = /<div class="admin-card">\s*<h3 class="card-title" style="margin-bottom: 16px;">Payment Information<\/h3>[\s\S]*?<!-- Advance Status Details -->[\s\S]*?<\/div>\s*<\/div>/;

const newPaymentCardHtml = `<div class="admin-card" id="card-payment-verification">
              <h3 class="card-title" style="margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
                <span><i class="fas fa-qrcode" style="color: #6366f1; margin-right: 6px;"></i> Payment & Verification</span>
                <span id="detail-payment-status" class="badge badge-warning">-</span>
              </h3>
              
              <div style="font-size: 0.9rem; line-height: 1.8;">
                <p><strong>Payment Method:</strong> <span id="detail-payment-method" style="text-transform: uppercase; font-weight: 600; color: #fff;">-</span></p>
                <p><strong>Merchant UPI ID:</strong> <code style="color: #a5b4fc; background: rgba(99,102,241,0.15); padding: 2px 7px; border-radius: 4px; font-weight: 700;">vadii@ptaxis</code></p>
                <p><strong>Payment Reference:</strong> <code id="detail-transaction-ref" style="color: #94a3b8; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">-</code></p>
                
                <div id="row-customer-utr" style="margin-top: 8px; padding: 10px 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;">
                  <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 700;">Customer Submitted UTR / Ref:</div>
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                    <strong id="detail-customer-utr" style="font-family: monospace; font-size: 1rem; color: #38bdf8;">None Provided</strong>
                    <button type="button" id="btn-copy-utr" class="btn-copy-upi" style="padding: 2px 8px; font-size: 0.72rem; display: none;">Copy</button>
                  </div>
                </div>

                <!-- Admin Manual Verification Action Buttons -->
                <div id="admin-payment-actions-wrap" style="margin-top: 14px; display: flex; flex-direction: column; gap: 8px;">
                  <button type="button" id="btn-admin-verify-payment" class="btn-admin-primary" style="width: 100%; background: #059669; border-color: #059669; justify-content: center; padding: 10px;">
                    <i class="fas fa-check-circle"></i>
                    <span>VERIFY PAYMENT (Bank Confirmed)</span>
                  </button>
                  <button type="button" id="btn-admin-reject-payment" class="btn-admin-danger" style="width: 100%; justify-content: center; padding: 8px; font-size: 0.82rem;">
                    <i class="fas fa-times-circle"></i>
                    <span>REJECT PAYMENT (Not Received)</span>
                  </button>
                </div>

                <!-- Verification Audit Record -->
                <div id="payment-audit-box" style="display: none; margin-top: 12px; padding: 10px; border-radius: 8px; font-size: 0.8rem; line-height: 1.5;">
                  <div id="payment-audit-content"></div>
                </div>

                <!-- Historical Razorpay Record Display (for legacy orders) -->
                <div id="row-rzp-legacy-info" style="display: none; margin-top: 12px; padding: 8px 10px; background: rgba(37,99,235,0.06); border: 1px dashed rgba(37,99,235,0.3); border-radius: 6px; font-size: 0.76rem;">
                  <span style="color: #60a5fa; font-weight: 700;">Historical Gateway Payment:</span>
                  <div id="detail-rzp-payment-id" style="font-family: monospace; color: #94a3b8; word-break: break-all;">-</div>
                </div>
              </div>

              <!-- Advance Status Details -->
              <div id="detail-advance-status-box" style="display: none; margin-top: 14px; padding: 12px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 8px;">
                <div style="font-size: 0.85rem; color: #818cf8; font-weight: 700; margin-bottom: 6px;">⚡ Advance Payment Split</div>
                <div style="font-size: 0.8rem; color: var(--admin-text-muted); line-height: 1.6;">
                  Advance Status: <span id="detail-advance-status" class="badge badge-success">Pending</span><br>
                  COD Balance Status: <span id="detail-cod-status" class="badge badge-warning">Pending</span>
                </div>
                <div id="cod-collection-control" style="margin-top: 10px; display: none;">
                  <button type="button" id="btn-mark-cod-collected" class="btn-admin-secondary" style="width: 100%; font-size: 0.78rem; padding: 6px;">
                    <i class="fas fa-check-circle" style="color: #10b981;"></i> Mark COD Balance Collected
                  </button>
                </div>
              </div>
            </div>`;

if (oldPaymentCardRegex.test(html)) {
  html = html.replace(oldPaymentCardRegex, newPaymentCardHtml);
  fs.writeFileSync('admin/order-details.html', html, 'utf8');
  console.log('Successfully updated admin/order-details.html with payment verification card!');
} else {
  console.error('Could not match old payment card in admin/order-details.html');
}
