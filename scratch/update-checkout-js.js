const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('c:/Users/saanv/OneDrive/Desktop/Website/webu/js/checkout.js');
let code = fs.readFileSync(targetPath, 'utf8');

// 1. Update elements block for UPI Modal Elements
const oldElementsRegex = /\/\/\s*UPI Payment Modal Elements[\s\S]*?btnCancelPayment:\s*document\.getElementById\("btn-cancel-payment"\),/;
const newElements = `// UPI Payment Modal Elements (Custom VADII Direct UPI)
    upiPaymentModal: document.getElementById("upi-payment-modal"),
    upiModal: document.getElementById("upi-payment-modal"),
    btnUpiModalClose: document.getElementById("btn-close-upi-modal"),
    vadiStatusPill: document.getElementById("vadi-status-pill"),
    vadiStatusText: document.getElementById("vadi-status-text"),
    modalPayableAmount: document.getElementById("modal-payable-amount"),
    modalAmountBadge: document.getElementById("vadi-amount-badge"),
    modalAdvanceBreakdown: document.getElementById("vadi-advance-breakdown"),
    modalAdvAmt: document.getElementById("modal-adv-amt"),
    modalCodBal: document.getElementById("modal-cod-bal"),
    modalUpiIdText: document.getElementById("modal-upi-id-text"),
    modalOrderRef: document.getElementById("modal-order-ref"),
    btnCopyUpi: document.getElementById("btn-copy-upi"),
    btnCopyRef: document.getElementById("btn-copy-ref"),
    tabBtnApp: document.getElementById("tab-btn-app"),
    tabBtnQr: document.getElementById("tab-btn-qr"),
    upiViewApp: document.getElementById("upi-view-app"),
    upiViewQr: document.getElementById("upi-view-qr"),
    btnLaunchUpiApp: document.getElementById("btn-launch-upi-app"),
    btnLaunchText: document.getElementById("btn-launch-text"),
    upiQrContainer: document.getElementById("upi-qr-container"),
    btnCopyPaymentLink: document.getElementById("btn-copy-payment-link"),
    btnCopyUpiDesktop: document.getElementById("btn-copy-upi-desktop"),
    inputCustomerUtr: document.getElementById("input-customer-utr"),
    btnConfirmPayment: document.getElementById("btn-confirm-payment"),
    btnConfirmPaidText: document.getElementById("btn-confirm-paid-text"),
    btnCancelPayment: document.getElementById("btn-cancel-payment"),`;

if (oldElementsRegex.test(code)) {
  code = code.replace(oldElementsRegex, newElements);
  console.log("Successfully replaced elements block");
} else {
  console.warn("Could not find old elements block via regex");
}

// 2. Replace openUpiModal & closeUpiModal definition
const oldOpenModalRegex = /function\s+openUpiModal\(orderRes\)[\s\S]*?function\s+closeUpiModal\(\)\s*\{[\s\S]*?document\.body\.style\.overflow\s*=\s*"";\s*\}/;

const newOpenModal = `// Helper for copying text with feedback
  function copyModalText(text, btnEl, successMsg = "Copied!") {
    if (!text) return;
    const performFeedback = () => {
      if (!btnEl) return;
      btnEl.classList.add("copied");
      const prevHtml = btnEl.innerHTML;
      btnEl.innerHTML = '<span>' + successMsg + '</span>';
      setTimeout(() => {
        btnEl.classList.remove("copied");
        btnEl.innerHTML = prevHtml;
      }, 2000);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(performFeedback).catch(() => {
        fallbackCopy(text);
        performFeedback();
      });
    } else {
      fallbackCopy(text);
      performFeedback();
    }
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (_) {}
  }

  function switchUpiModalTab(tabName) {
    const tabBtnApp = document.getElementById("tab-btn-app");
    const tabBtnQr = document.getElementById("tab-btn-qr");
    const viewApp = document.getElementById("upi-view-app");
    const viewQr = document.getElementById("upi-view-qr");

    if (tabName === "app") {
      if (tabBtnApp) tabBtnApp.classList.add("active");
      if (tabBtnQr) tabBtnQr.classList.remove("active");
      if (viewApp) viewApp.style.display = "flex";
      if (viewQr) viewQr.style.display = "none";
    } else {
      if (tabBtnQr) tabBtnQr.classList.add("active");
      if (tabBtnApp) tabBtnApp.classList.remove("active");
      if (viewQr) viewQr.style.display = "flex";
      if (viewApp) viewApp.style.display = "none";
    }
  }

  function setModalLifecycle(status, msg) {
    const statusPill = document.getElementById("vadi-status-pill");
    const statusText = document.getElementById("vadi-status-text");
    if (!statusPill || !statusText) return;

    statusPill.className = "vadi-status-pill";
    if (status === "OPENING" || status === "RETURNED") {
      statusPill.classList.add("info");
    } else if (status === "ERROR") {
      statusPill.classList.add("warning");
    }

    if (msg) statusText.textContent = msg;
  }

  function openUpiModal(orderRes) {
    const modalEl = document.getElementById("upi-payment-modal");
    if (!modalEl) return;

    state.activeOrderId = orderRes.order_id;
    state.activeOrderNumber = orderRes.order_number;
    state.activeUpiUri = orderRes.upi_uri;
    state.activePayableNow = orderRes.payable_now;
    state.activeOrderSnapshot = orderRes;

    const isAdvance = Number(orderRes.advance_amount) > 0;
    const payableVal = Number(orderRes.advance_amount || orderRes.payable_now || 0);
    const totalVal = Number(orderRes.total || (orderRes.summary && orderRes.summary.total) || state.total || 0);
    const codBalVal = Number(orderRes.cod_balance || (totalVal - payableVal) || 0);

    // 1. Dynamic Amount & Badge
    const amtEl = document.getElementById("modal-payable-amount");
    if (amtEl) {
      amtEl.textContent = payableVal.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    const badgeEl = document.getElementById("vadi-amount-badge");
    const advBreakdown = document.getElementById("vadi-advance-breakdown");
    const advAmtEl = document.getElementById("modal-adv-amt");
    const codBalEl = document.getElementById("modal-cod-bal");

    if (isAdvance) {
      if (badgeEl) {
        badgeEl.textContent = "⚡ Advance Deposit";
        badgeEl.className = "vadi-amount-badge advance";
      }
      if (advBreakdown) advBreakdown.style.display = "flex";
      if (advAmtEl) advAmtEl.textContent = "₹" + payableVal.toLocaleString("en-IN");
      if (codBalEl) codBalEl.textContent = "₹" + codBalVal.toLocaleString("en-IN");
    } else {
      if (badgeEl) {
        badgeEl.textContent = "100% Full Payment";
        badgeEl.className = "vadi-amount-badge";
      }
      if (advBreakdown) advBreakdown.style.display = "none";
    }

    // 2. Payee details and order reference
    const upiIdEl = document.getElementById("modal-upi-id-text");
    if (upiIdEl) upiIdEl.textContent = orderRes.merchant_upi_id || "vadii@ptaxis";

    const refEl = document.getElementById("modal-order-ref");
    if (refEl) refEl.textContent = orderRes.order_number || state.activeOrderNumber;

    // 3. Reset status pill to READY state
    setModalLifecycle("READY", "Complete transfer in your UPI app • Manual verification required");

    // 4. Default Tab based on device detection
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
    switchUpiModalTab(isMobile ? "app" : "qr");

    // 5. Render Dynamic QR Code for Desktop / Fallback
    const qrContainer = document.getElementById("upi-qr-container");
    if (qrContainer && orderRes.upi_uri) {
      renderUpiQrCode(qrContainer, orderRes.upi_uri);
    }

    // 6. Primary mobile open button
    const btnOpenApp = document.getElementById("btn-launch-upi-app");
    if (btnOpenApp) {
      btnOpenApp.href = orderRes.upi_uri || "#";
      btnOpenApp.onclick = (e) => {
        setModalLifecycle("OPENING", "Opening UPI App... Complete transfer and return here.");
        setTimeout(() => {
          setModalLifecycle("RETURNED", "Returned from UPI? Enter your UTR / UPI Ref and click 'I HAVE PAID'.");
        }, 1500);
      };
    }

    // 7. Reset UTR input
    const utrInput = document.getElementById("input-customer-utr");
    if (utrInput) utrInput.value = "";

    // 8. Reset confirmation button
    const btnConfirm = document.getElementById("btn-confirm-payment");
    const btnText = document.getElementById("btn-confirm-paid-text");
    if (btnConfirm) btnConfirm.disabled = false;
    if (btnText) btnText.textContent = "I HAVE PAID";

    // 9. Wire Copy Buttons
    const btnCopyUpi = document.getElementById("btn-copy-upi");
    if (btnCopyUpi) {
      btnCopyUpi.onclick = (e) => {
        e.preventDefault();
        copyModalText(orderRes.merchant_upi_id || "vadii@ptaxis", btnCopyUpi);
      };
    }

    const btnCopyRef = document.getElementById("btn-copy-ref");
    if (btnCopyRef) {
      btnCopyRef.onclick = (e) => {
        e.preventDefault();
        copyModalText(orderRes.order_number || state.activeOrderNumber, btnCopyRef);
      };
    }

    const btnCopyPaymentLink = document.getElementById("btn-copy-payment-link");
    if (btnCopyPaymentLink) {
      btnCopyPaymentLink.onclick = (e) => {
        e.preventDefault();
        copyModalText(orderRes.upi_uri, btnCopyPaymentLink, "Link Copied!");
      };
    }

    const btnCopyUpiDesktop = document.getElementById("btn-copy-upi-desktop");
    if (btnCopyUpiDesktop) {
      btnCopyUpiDesktop.onclick = (e) => {
        e.preventDefault();
        copyModalText(orderRes.merchant_upi_id || "vadii@ptaxis", btnCopyUpiDesktop);
      };
    }

    // 10. Wire Tab Buttons
    const tabBtnApp = document.getElementById("tab-btn-app");
    if (tabBtnApp) {
      tabBtnApp.onclick = (e) => {
        e.preventDefault();
        switchUpiModalTab("app");
      };
    }

    const tabBtnQr = document.getElementById("tab-btn-qr");
    if (tabBtnQr) {
      tabBtnQr.onclick = (e) => {
        e.preventDefault();
        switchUpiModalTab("qr");
      };
    }

    // 11. Wire Quick UPI App Chips
    const appChips = modalEl.querySelectorAll(".vadi-app-chip");
    appChips.forEach(chip => {
      chip.onclick = (e) => {
        e.preventDefault();
        const appType = chip.getAttribute("data-app") || "Generic";
        const appNames = {
          gpay: "Google Pay",
          phonepe: "PhonePe",
          paytm: "Paytm",
          bhim: "BHIM",
          other: "UPI App"
        };
        const displayName = appNames[appType] || "UPI App";
        state.selectedUpiApp = displayName;
        setModalLifecycle("OPENING", "Launching " + displayName + "... Complete transfer and return here.");
        window.location.href = orderRes.upi_uri;
        setTimeout(() => {
          setModalLifecycle("RETURNED", "Returned from " + displayName + "? Enter your UTR / UPI Ref and click 'I HAVE PAID'.");
        }, 1500);
      };
    });

    // 12. Show Modal Overlay
    modalEl.classList.add("active", "open");
    modalEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeUpiModal() {
    const modalEl = document.getElementById("upi-payment-modal");
    if (!modalEl) return;
    modalEl.classList.remove("active", "open");
    modalEl.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }`;

if (oldOpenModalRegex.test(code)) {
  code = code.replace(oldOpenModalRegex, newOpenModal);
  console.log("Successfully replaced openUpiModal & closeUpiModal");
} else {
  console.warn("Could not find openUpiModal block via regex");
}

// 3. Remove automatic 400ms mobile redirect in startDirectUpiCheckout
const autoRedirectPattern = /\/\/\s*On mobile devices, attempt deep link immediately[\s\S]*?setTimeout\(\(\)\s*=>\s*\{[\s\S]*?window\.location\.href\s*=\s*orderRes\.upi_uri;[\s\S]*?\},\s*400\);[\s\S]*?\}/;
if (autoRedirectPattern.test(code)) {
  code = code.replace(autoRedirectPattern, "// Modal is displayed with app choices and Scan QR tab");
  console.log("Successfully removed auto-redirect");
} else {
  console.warn("Could not find autoRedirectPattern via regex");
}

// 4. Update modal event bindings
const oldHooksPattern = /\/\/\s*Hook UPI Modal Action Buttons[\s\S]*?elements\.btnCancelPayment\.onclick[\s\S]*?\};?\s*\}/;
const newHooks = `// Hook UPI Modal Action Buttons & Outside Click
  const btnConfirmPaid = document.getElementById("btn-confirm-payment");
  if (btnConfirmPaid) {
    btnConfirmPaid.onclick = (e) => {
      e.preventDefault();
      submitUpiConfirmation();
    };
  }

  const btnCloseModal = document.getElementById("btn-close-upi-modal");
  if (btnCloseModal) {
    btnCloseModal.onclick = (e) => {
      e.preventDefault();
      closeUpiModal();
    };
  }

  const btnCancelPayment = document.getElementById("btn-cancel-payment");
  if (btnCancelPayment) {
    btnCancelPayment.onclick = (e) => {
      e.preventDefault();
      closeUpiModal();
    };
  }

  const upiModalOverlay = document.getElementById("upi-payment-modal");
  if (upiModalOverlay) {
    upiModalOverlay.onclick = (e) => {
      if (e.target === upiModalOverlay) {
        closeUpiModal();
      }
    };
  }`;

if (oldHooksPattern.test(code)) {
  code = code.replace(oldHooksPattern, newHooks);
  console.log("Successfully updated modal event bindings");
} else {
  console.warn("Could not find oldHooksPattern via regex");
}

fs.writeFileSync(targetPath, code, 'utf8');
console.log("Finished updating js/checkout.js");
