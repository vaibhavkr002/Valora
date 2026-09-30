const fs = require('fs');
const path = require('path');

const accountFilePath = path.join(__dirname, '..', 'account.html');
let content = fs.readFileSync(accountFilePath, 'utf8');

// 1. Add qrcode-generator to head if not present
if (!content.includes('qrcode-generator')) {
  content = content.replace(
    '<title>My Account | VADII — Everything. Simply Yours.</title>',
    '<title>My Account | VADII — Everything. Simply Yours.</title>\n  <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>'
  );
}

// 2. Update modal css for #retry-upi-modal-overlay
const oldModalCss = `#cancel-order-modal-overlay,
    #return-order-modal-overlay {`;
const newModalCss = `#cancel-order-modal-overlay,
    #return-order-modal-overlay,
    #retry-upi-modal-overlay {`;
if (content.includes(oldModalCss)) {
  content = content.replace(oldModalCss, newModalCss);
}

const oldModalNotActive = `#cancel-order-modal-overlay:not(.active),
    #return-order-modal-overlay:not(.active) {`;
const newModalNotActive = `#cancel-order-modal-overlay:not(.active),
    #return-order-modal-overlay:not(.active),
    #retry-upi-modal-overlay:not(.active) {`;
if (content.includes(oldModalNotActive)) {
  content = content.replace(oldModalNotActive, newModalNotActive);
}

const oldModalActive = `#cancel-order-modal-overlay.active,
    #return-order-modal-overlay.active {`;
const newModalActive = `#cancel-order-modal-overlay.active,
    #return-order-modal-overlay.active,
    #retry-upi-modal-overlay.active {`;
if (content.includes(oldModalActive)) {
  content = content.replace(oldModalActive, newModalActive);
}

// 3. Add UPI Verification & Rejection badges and notice in renderOrders
const targetBadgesHook = `              if (returnReqs.length > 0) {
                returnReqs.forEach(rr => {
                  badgesHtml += \`<span style="background: rgba(79, 70, 229, 0.12); color: #4f46e5; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-left: 6px; border: 1px solid rgba(79, 70, 229, 0.3);">↩️ Return: \${formatReturnStatus(rr.status)}</span>\`;
                });
              }`;

const replacementBadgesHook = `              if (returnReqs.length > 0) {
                returnReqs.forEach(rr => {
                  badgesHtml += \`<span style="background: rgba(79, 70, 229, 0.12); color: #4f46e5; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-left: 6px; border: 1px solid rgba(79, 70, 229, 0.3);">↩️ Return: \${formatReturnStatus(rr.status)}</span>\`;
                });
              }

              // Direct UPI payment verification badges
              const isVerificationPending = ord.order_status === "PAYMENT_VERIFICATION_PENDING" || ord.payment_status === "customer_submitted";
              const isPaymentRejected = ord.payment_status === "rejected";
              const isPaymentVerified = ord.payment_status === "verified";

              if (isVerificationPending) {
                badgesHtml += \`<span style="background: rgba(245, 158, 11, 0.15); color: #d97706; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-left: 6px; border: 1px solid rgba(245, 158, 11, 0.35);">⏳ Verification Pending</span>\`;
              } else if (isPaymentRejected) {
                badgesHtml += \`<span style="background: rgba(239, 68, 68, 0.12); color: #dc2626; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-left: 6px; border: 1px solid rgba(239, 68, 68, 0.3);">✕ Payment Rejected</span>\`;
              } else if (isPaymentVerified) {
                badgesHtml += \`<span style="background: rgba(16, 185, 129, 0.15); color: #059669; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-left: 6px; border: 1px solid rgba(16, 185, 129, 0.3);">✓ UPI Verified</span>\`;
              }

              let upiRejectedNoticeHtml = '';
              if (isPaymentRejected) {
                const rejReason = ord.rejection_reason || (ord.tracking_data && ord.tracking_data.rejection_reason) || 'Transaction not found in merchant bank records.';
                upiRejectedNoticeHtml = \`
                  <div style="margin-top: 10px; padding: 10px 14px; background: rgba(239, 68, 68, 0.06); border: 1.5px solid rgba(239, 68, 68, 0.3); border-radius: 8px; font-size: 0.82rem;">
                    <div style="color: #dc2626; font-weight: 700; margin-bottom: 3px;">⚠️ Payment Verification Declined</div>
                    <div style="color: #991b1b; margin-bottom: 6px;">Reason: \${escapeHTML(rejReason)}</div>
                    <div style="font-size: 0.78rem; color: #7f1d1d;">Please retry paying via UPI or re-submit your correct 12-digit UTR reference number below.</div>
                  </div>
                \`;
              }`;

if (content.includes(targetBadgesHook)) {
  content = content.replace(targetBadgesHook, replacementBadgesHook);
}

// 4. Add Retry UPI button in actionButtonsHtml if payment rejected or pending
const targetActionButtonsHook = `              if (canReturn) {
                actionButtonsHtml += \`
                  <button type="button" class="btn-return-order" data-order-id="\${ord.id}" data-order-number="\${ord.order_number}" style="background: rgba(79, 70, 229, 0.08); color: #4f46e5; border: 1px solid rgba(79, 70, 229, 0.3); padding: 7px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                    <span>↩️ Return Order</span>
                  </button>
                \`;
              }`;

const replacementActionButtonsHook = `              if (canReturn) {
                actionButtonsHtml += \`
                  <button type="button" class="btn-return-order" data-order-id="\${ord.id}" data-order-number="\${ord.order_number}" style="background: rgba(79, 70, 229, 0.08); color: #4f46e5; border: 1px solid rgba(79, 70, 229, 0.3); padding: 7px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                    <span>↩️ Return Order</span>
                  </button>
                \`;
              }

              if (isPaymentRejected || ord.order_status === "PAYMENT_PENDING") {
                actionButtonsHtml += \`
                  <button type="button" class="btn-retry-upi" data-order-id="\${ord.id}" data-order-number="\${ord.order_number}" style="background: #4f46e5; color: #ffffff; border: none; padding: 7px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);">
                    <span>⚡ Retry UPI Payment</span>
                  </button>
                \`;
              }`;

if (content.includes(targetActionButtonsHook)) {
  content = content.replace(targetActionButtonsHook, replacementActionButtonsHook);
}

// Insert ${upiRejectedNoticeHtml} in the card template
if (content.includes('${refundInfoHtml}') && !content.includes('${upiRejectedNoticeHtml}')) {
  content = content.replace('${refundInfoHtml}', '${refundInfoHtml}\n                  ${upiRejectedNoticeHtml}');
}

// 5. Add Retry UPI Modal HTML right after return-order-modal-overlay
const returnModalCloseTag = `        </div>
      </form>
    </div>
  </div>`;

const retryUpiModalHtml = `        </div>
      </form>
    </div>
  </div>

  <!-- ========================================================================
       RETRY DIRECT UPI PAYMENT MODAL
       ======================================================================== -->
  <div id="retry-upi-modal-overlay" class="modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); z-index: 100000; align-items: center; justify-content: center; padding: 16px;">
    <div class="cancel-modal-content" style="background: #ffffff; border-radius: 16px; max-width: 480px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; position: relative;">
      
      <!-- Modal Header -->
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; background: #eef2ff; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 36px; height: 36px; border-radius: 50%; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; font-weight: 800; flex-shrink: 0;">⚡</div>
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: #312e81; margin: 0; line-height: 1.2;">Direct UPI Payment</h3>
            <span style="font-size: 0.78rem; font-weight: 700; color: #4338ca;" id="retry-upi-order-number">Order #...</span>
          </div>
        </div>
        <button type="button" id="btn-close-retry-upi" style="background: none; border: none; font-size: 1.4rem; color: #94a3b8; cursor: pointer; line-height: 1; padding: 4px;" aria-label="Close UPI Modal">✕</button>
      </div>

      <!-- Modal Body -->
      <div style="padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px; text-align: center;">
        
        <!-- Payable Amount Banner -->
        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 18px;">
          <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Payable Amount</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #0f172a; margin: 2px 0;" id="retry-upi-amount">₹0</div>
          <div style="font-size: 0.78rem; color: #059669; font-weight: 600;" id="retry-upi-payment-desc">Official Merchant Payment</div>
        </div>

        <!-- Mobile Instant App Pay -->
        <div id="retry-upi-mobile-box" style="display: block;">
          <a id="retry-upi-deep-link" href="#" class="btn-auth-submit" style="display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; padding: 12px 20px; font-size: 0.95rem; font-weight: 700; background: #4f46e5; color: #ffffff; border-radius: 10px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
            <span>⚡ Open UPI App to Pay</span>
          </a>
          <p style="font-size: 0.75rem; color: #64748b; margin-top: 6px;">Supported: GPay, PhonePe, Paytm, CRED, BHIM, etc.</p>
        </div>

        <!-- Desktop QR Code Box -->
        <div id="retry-upi-qr-box" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center;">
          <div id="retry-upi-qr-container" style="background: #ffffff; padding: 10px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); display: inline-block;"></div>
          <p style="font-size: 0.78rem; color: #64748b; margin-top: 8px; margin-bottom: 0;">Scan QR with any UPI app to pay</p>
        </div>

        <!-- Manual Details & Copy -->
        <div style="background: #f1f5f9; border-radius: 10px; padding: 12px 14px; text-align: left; font-size: 0.82rem; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #64748b;">Merchant UPI ID:</span>
            <div style="display: flex; align-items: center; gap: 6px;">
              <strong style="font-family: monospace; color: #0f172a;" id="retry-upi-vpa-text">vadii@ptaxis</strong>
              <button type="button" id="btn-copy-retry-vpa" style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 8px; font-size: 0.72rem; cursor: pointer;">Copy</button>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #64748b;">Merchant Name:</span>
            <strong style="color: #0f172a;">VADI</strong>
          </div>
        </div>

        <!-- UTR / Confirmation Field -->
        <div style="text-align: left; background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 12px 14px;">
          <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #92400e; margin-bottom: 6px;" for="retry-upi-utr-input">
            Enter 12-Digit UPI Ref / UTR Number (Optional):
          </label>
          <input type="text" id="retry-upi-utr-input" placeholder="e.g. 427819284721" maxlength="20" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: monospace; font-size: 0.9rem; box-sizing: border-box;">
          <div style="font-size: 0.73rem; color: #b45309; margin-top: 4px;">Provides instant reference for faster admin bank verification.</div>
        </div>

        <button type="button" id="btn-confirm-retry-payment" class="btn-auth-submit" style="padding: 12px; font-size: 0.95rem; font-weight: 700; background: #059669; color: #ffffff; border: none; border-radius: 8px; cursor: pointer;">
          ✓ I Have Paid — Submit for Verification
        </button>

      </div>
    </div>
  </div>`;

if (content.includes(returnModalCloseTag) && !content.includes('id="retry-upi-modal-overlay"')) {
  content = content.replace(returnModalCloseTag, retryUpiModalHtml);
}

// 6. Add Retry UPI script controller and delegation
const targetDelegationHook = `        const returnBtn = e.target.closest(".btn-return-order");
        if (returnBtn) {
          e.preventDefault();
          e.stopPropagation();
          const ordId = returnBtn.dataset.orderId;`;

const replacementDelegationHook = `        const retryUpiBtn = e.target.closest(".btn-retry-upi");
        if (retryUpiBtn) {
          e.preventDefault();
          e.stopPropagation();
          const ordId = retryUpiBtn.dataset.orderId;
          const order = dbOrdersCache.find(o => o.id === ordId || o.order_number === ordId);
          if (order) openRetryUpiModal(order);
          return;
        }

        const returnBtn = e.target.closest(".btn-return-order");
        if (returnBtn) {
          e.preventDefault();
          e.stopPropagation();
          const ordId = returnBtn.dataset.orderId;`;

if (content.includes(targetDelegationHook)) {
  content = content.replace(targetDelegationHook, replacementDelegationHook);
}

// Add the openRetryUpiModal function before Universal Modal Event Delegation
const targetBeforeDelegation = `      // ========================================================================
      // UNIVERSAL MODAL EVENT DELEGATION (Open, Close, Escape)`;

const retryModalControllerCode = `      // ========================================================================
      // RETRY DIRECT UPI PAYMENT CONTROLLER
      // ========================================================================
      const retryUpiModal = document.getElementById("retry-upi-modal-overlay");
      const retryUpiOrderNum = document.getElementById("retry-upi-order-number");
      const retryUpiAmount = document.getElementById("retry-upi-amount");
      const retryUpiPaymentDesc = document.getElementById("retry-upi-payment-desc");
      const retryUpiDeepLink = document.getElementById("retry-upi-deep-link");
      const retryUpiQrContainer = document.getElementById("retry-upi-qr-container");
      const retryUpiUtrInput = document.getElementById("retry-upi-utr-input");
      const btnConfirmRetry = document.getElementById("btn-confirm-retry-payment");
      const btnCloseRetryUpi = document.getElementById("btn-close-retry-upi");
      const btnCopyRetryVpa = document.getElementById("btn-copy-retry-vpa");
      let currentRetryOrder = null;

      async function openRetryUpiModal(order) {
        if (!retryUpiModal || !order) return;
        currentRetryOrder = order;

        if (retryUpiOrderNum) retryUpiOrderNum.textContent = \`Order #\${order.order_number}\`;

        let payable = Math.round(Number(order.total || 0));
        const advAmt = Math.round(Number(order.advance_paid || order.advance_amount || 0));
        if (advAmt > 0 && order.payment_method?.toLowerCase().includes("advance")) {
          payable = advAmt;
          if (retryUpiPaymentDesc) retryUpiPaymentDesc.textContent = "Prepaid Advance Amount (Balance on Delivery)";
        } else {
          if (retryUpiPaymentDesc) retryUpiPaymentDesc.textContent = "Full Order Payment";
        }

        if (retryUpiAmount) retryUpiAmount.textContent = \`₹\${payable.toLocaleString("en-IN")}\`;
        if (retryUpiUtrInput) retryUpiUtrInput.value = "";

        const merchantVpa = "vadii@ptaxis";
        const merchantName = "VADI";
        const upiUri = \`upi://pay?pa=\${merchantVpa}&pn=\${encodeURIComponent(merchantName)}&am=\${payable.toFixed(2)}&cu=INR&tn=\${encodeURIComponent(order.order_number)}\`;

        if (retryUpiDeepLink) {
          retryUpiDeepLink.href = upiUri;
        }

        if (retryUpiQrContainer) {
          try {
            if (typeof qrcode === "function") {
              const qr = qrcode(0, "M");
              qr.addData(upiUri);
              qr.make();
              retryUpiQrContainer.innerHTML = qr.createSvgTag({ scalable: true, cellSize: 4 });
            } else {
              retryUpiQrContainer.innerHTML = \`<div style="font-size:0.8rem; color:#64748b; padding:12px;">Scan via UPI app to: <strong>\${merchantVpa}</strong></div>\`;
            }
          } catch (qrErr) {
            console.warn("QR render fallback:", qrErr);
            retryUpiQrContainer.innerHTML = \`<div style="font-size:0.8rem; color:#64748b; padding:12px;">UPI ID: <strong>\${merchantVpa}</strong></div>\`;
          }
        }

        document.body.classList.add("velora-modal-open");
        retryUpiModal.classList.add("active");
        retryUpiModal.style.display = "flex";
      }

      function closeRetryUpiModal() {
        if (!retryUpiModal) return;
        retryUpiModal.classList.remove("active");
        retryUpiModal.style.display = "none";
        document.body.classList.remove("velora-modal-open");
        currentRetryOrder = null;
      }

      if (btnCloseRetryUpi) {
        btnCloseRetryUpi.addEventListener("click", closeRetryUpiModal);
      }
      if (retryUpiModal) {
        retryUpiModal.addEventListener("click", (e) => {
          if (e.target === retryUpiModal) closeRetryUpiModal();
        });
      }

      if (btnCopyRetryVpa) {
        btnCopyRetryVpa.addEventListener("click", () => {
          navigator.clipboard.writeText("vadii@ptaxis").then(() => {
            showToast("Merchant UPI ID vadii@ptaxis copied to clipboard!", "success");
          }).catch(() => {
            showToast("Merchant UPI ID: vadii@ptaxis", "info");
          });
        });
      }

      if (btnConfirmRetry) {
        btnConfirmRetry.addEventListener("click", async () => {
          if (!currentRetryOrder) return;
          btnConfirmRetry.disabled = true;
          btnConfirmRetry.textContent = "Submitting verification...";

          try {
            const utr = retryUpiUtrInput ? retryUpiUtrInput.value.trim() : "";
            const res = await fetch("/api/orders/submit-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                order_id: currentRetryOrder.id,
                order_number: currentRetryOrder.order_number,
                customer_utr: utr || null,
                payment_method: currentRetryOrder.payment_method
              })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
              throw new Error(data.error || "Failed to submit payment verification.");
            }

            showToast("Payment submitted! Our admin team will verify it against the merchant account.", "success");
            closeRetryUpiModal();
            await renderOrders();
          } catch (err) {
            console.error("Payment retry error:", err);
            showToast(err.message || "Could not submit payment. Please try again.", "error");
          } finally {
            if (btnConfirmRetry) {
              btnConfirmRetry.disabled = false;
              btnConfirmRetry.textContent = "✓ I Have Paid — Submit for Verification";
            }
          }
        });
      }

      // ========================================================================
      // UNIVERSAL MODAL EVENT DELEGATION (Open, Close, Escape)`;

if (content.includes(targetBeforeDelegation) && !content.includes('RETRY DIRECT UPI PAYMENT CONTROLLER')) {
  content = content.replace(targetBeforeDelegation, retryModalControllerCode);
}

fs.writeFileSync(accountFilePath, content, 'utf8');
console.log('Successfully updated account.html with direct UPI support!');
