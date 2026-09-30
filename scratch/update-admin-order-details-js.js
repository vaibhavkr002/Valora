const fs = require('fs');

let js = fs.readFileSync('admin/js/admin-order-details.js', 'utf8');

// Replace Razorpay payment ID and refund logic with Direct UPI verification
const oldBlockRegex = /\/\/\s*Razorpay Transaction and Refund Data[\s\S]*?if\s*\(rowRefundAction\)\s*\{\s*rowRefundAction\.style\.display\s*=\s*"none";\s*\}/;

const newBlock = `// Direct UPI Payment & Verification Data
    const customerUtr = order.customer_utr || (order.tracking_data && order.tracking_data.customer_utr) || null;
    const elUtr = document.getElementById("detail-customer-utr");
    const btnCopyUtr = document.getElementById("btn-copy-utr");
    const elTxRef = document.getElementById("detail-transaction-ref");
    const auditBox = document.getElementById("payment-audit-box");
    const auditContent = document.getElementById("payment-audit-content");
    const actionsWrap = document.getElementById("admin-payment-actions-wrap");
    const btnVerify = document.getElementById("btn-admin-verify-payment");
    const btnReject = document.getElementById("btn-admin-reject-payment");

    if (elTxRef) elTxRef.textContent = order.transaction_reference || order.order_number || "-";

    if (elUtr) {
      if (customerUtr) {
        elUtr.textContent = customerUtr;
        if (btnCopyUtr) {
          btnCopyUtr.style.display = "inline-block";
          btnCopyUtr.onclick = () => {
            navigator.clipboard.writeText(customerUtr).then(() => {
              btnCopyUtr.textContent = "Copied!";
              setTimeout(() => { btnCopyUtr.textContent = "Copy"; }, 2000);
            });
          };
        }
      } else {
        elUtr.textContent = "None Provided";
        if (btnCopyUtr) btnCopyUtr.style.display = "none";
      }
    }

    // Payment Status Badge Styling
    const elPayStatus = document.getElementById("detail-payment-status");
    const rawPayStatus = (order.payment_status || "pending").toLowerCase();
    const rawOrdStatus = (order.order_status || "placed").toLowerCase();
    const isVerified = rawPayStatus === "verified" || rawPayStatus === "paid" || rawOrdStatus === "confirmed" || (order.tracking_data && order.tracking_data.payment_verified);
    const isRejected = rawPayStatus === "rejected" || rawOrdStatus === "payment_rejected";
    const isPendingVerification = (rawPayStatus === "customer_submitted" || rawOrdStatus === "payment_verification_pending" || rawPayStatus === "pending") && !isVerified && !isRejected;

    if (elPayStatus) {
      if (isVerified) {
        elPayStatus.className = "badge badge-success";
        elPayStatus.textContent = "✓ VERIFIED";
      } else if (isRejected) {
        elPayStatus.className = "badge badge-danger";
        elPayStatus.textContent = "✕ REJECTED";
      } else if (order.payment_method && order.payment_method.toLowerCase().includes("cash on delivery")) {
        elPayStatus.className = "badge badge-info";
        elPayStatus.textContent = "COD PENDING";
      } else {
        elPayStatus.className = "badge badge-warning";
        elPayStatus.textContent = "⏳ VERIFICATION PENDING";
      }
    }

    // Verification Audit Box
    if (auditBox && auditContent) {
      if (isVerified && (order.verified_by || (order.tracking_data && order.tracking_data.verified_by))) {
        auditBox.style.display = "block";
        auditBox.style.background = "rgba(16, 185, 129, 0.1)";
        auditBox.style.border = "1px solid rgba(16, 185, 129, 0.3)";
        auditBox.style.color = "#34d399";
        const vBy = order.verified_by || (order.tracking_data && order.tracking_data.verified_by) || "Admin";
        const vAt = order.verified_at || (order.tracking_data && order.tracking_data.verified_at);
        const vDate = vAt ? new Date(vAt).toLocaleString("en-IN") : "Recorded";
        auditContent.innerHTML = \`<i class="fas fa-check-circle"></i> <strong>Verified against bank records</strong><br>Verified by: \${vBy}<br>Time: \${vDate}\`;
      } else if (isRejected) {
        auditBox.style.display = "block";
        auditBox.style.background = "rgba(239, 68, 68, 0.1)";
        auditBox.style.border = "1px solid rgba(239, 68, 68, 0.3)";
        auditBox.style.color = "#f87171";
        const rReason = order.rejection_reason || (order.tracking_data && order.tracking_data.rejection_reason) || "Transaction not found in merchant bank ledger";
        auditContent.innerHTML = \`<i class="fas fa-times-circle"></i> <strong>Payment Verification Rejected</strong><br>Reason: \${rReason}\`;
      } else {
        auditBox.style.display = "none";
      }
    }

    // Actions buttons visibility & event handlers
    const isCodOnly = order.payment_method && order.payment_method.toLowerCase().includes("cash on delivery") && !Number(order.advance_amount || order.advance_paid || 0);
    if (actionsWrap) {
      if (isCodOnly) {
        actionsWrap.style.display = "none";
      } else {
        actionsWrap.style.display = "flex";
      }
    }

    if (btnVerify) {
      if (isVerified) {
        btnVerify.disabled = true;
        btnVerify.style.opacity = "0.6";
        btnVerify.innerHTML = '<i class="fas fa-check-double"></i> Payment Already Verified';
      } else {
        btnVerify.disabled = false;
        btnVerify.style.opacity = "1";
        btnVerify.innerHTML = '<i class="fas fa-check-circle"></i> VERIFY PAYMENT (Bank Confirmed)';
        btnVerify.onclick = async () => {
          const advVal = Number(order.advance_amount || order.advance_paid || 0);
          const verifyAmt = advVal > 0 ? advVal : Number(order.total);
          const confirmMsg = \`Have you verified this payment of \${window.formatINR(verifyAmt)} in the merchant UPI/bank transaction history for vadii@ptaxis?\\n\\nCustomer UTR: \${customerUtr || 'None'}\\nOrder: \${order.order_number}\`;
          if (!confirm(confirmMsg)) return;

          btnVerify.disabled = true;
          btnVerify.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

          try {
            const { data: { session } } = await client.auth.getSession();
            const token = session?.access_token || "";

            const resp = await fetch("/api/admin/verify-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": \`Bearer \${token}\`
              },
              body: JSON.stringify({
                order_id: order.id,
                action: "verify"
              })
            });

            const resData = await resp.json();
            if (!resp.ok || !resData.success) {
              throw new Error(resData.error || "Verification failed");
            }
            window.showToast("Payment verified! Order is now confirmed.", "success");
            await loadOrder();
          } catch (err) {
            alert("Verification Error: " + err.message);
            btnVerify.disabled = false;
            btnVerify.innerHTML = '<i class="fas fa-check-circle"></i> VERIFY PAYMENT (Bank Confirmed)';
          }
        };
      }
    }

    if (btnReject) {
      if (isRejected) {
        btnReject.disabled = true;
        btnReject.style.opacity = "0.6";
        btnReject.innerHTML = '<i class="fas fa-ban"></i> Payment Already Rejected';
      } else {
        btnReject.disabled = false;
        btnReject.style.opacity = "1";
        btnReject.innerHTML = '<i class="fas fa-times-circle"></i> REJECT PAYMENT (Not Received)';
        btnReject.onclick = async () => {
          const reason = prompt("Enter reason for rejecting this payment (e.g. Payment not received in bank account, Incorrect amount, UTR not found, Duplicate payment):", "Payment transaction not found in merchant bank ledger");
          if (reason === null) return;

          btnReject.disabled = true;
          btnReject.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rejecting...';

          try {
            const { data: { session } } = await client.auth.getSession();
            const token = session?.access_token || "";

            const resp = await fetch("/api/admin/verify-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": \`Bearer \${token}\`
              },
              body: JSON.stringify({
                order_id: order.id,
                action: "reject",
                rejection_reason: reason
              })
            });

            const resData = await resp.json();
            if (!resp.ok || !resData.success) {
              throw new Error(resData.error || "Rejection failed");
            }
            window.showToast("Payment rejected. Order remains open for retry.", "info");
            await loadOrder();
          } catch (err) {
            alert("Rejection Error: " + err.message);
            btnReject.disabled = false;
            btnReject.innerHTML = '<i class="fas fa-times-circle"></i> REJECT PAYMENT (Not Received)';
          }
        };
      }
    }

    // Historical Razorpay data (if legacy order contains it)
    const rzpPayId = order.razorpay_payment_id || (order.tracking_data && order.tracking_data.razorpay_payment_id);
    const rowRzpLegacy = document.getElementById("row-rzp-legacy-info");
    const elRzpId = document.getElementById("detail-rzp-payment-id");
    if (rowRzpLegacy && elRzpId) {
      if (rzpPayId) {
        rowRzpLegacy.style.display = "block";
        elRzpId.textContent = rzpPayId;
      } else {
        rowRzpLegacy.style.display = "none";
      }
    }`;

if (oldBlockRegex.test(js)) {
  js = js.replace(oldBlockRegex, newBlock);
  fs.writeFileSync('admin/js/admin-order-details.js', js, 'utf8');
  console.log('Successfully updated admin/js/admin-order-details.js with Direct UPI verification controller!');
} else {
  console.error('Could not match old payment block in admin/js/admin-order-details.js');
}
