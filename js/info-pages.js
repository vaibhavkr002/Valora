/**
 * VELORA - Informational & Support Pages Interaction Controller
 * Pure Vanilla JavaScript (ES6+)
 * Manages cart drawer, search, badges, FAQ accordions & live search,
 * contact form validation, careers modal, and affiliate application flow.
 */

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================================
  // 1. GLOBAL STATE & BADGES SYNC
  // ==========================================================================
  // Currency Formatter helper
  const formatPrice = (amount) => (window.formatINR ? window.formatINR(amount) : ('₹' + Math.round(amount).toLocaleString('en-IN')));

  const cart = JSON.parse(localStorage.getItem("velora_cart")) || [];
  const wishlist = JSON.parse(localStorage.getItem("velora_wishlist")) || ["prod-02", "prod-07"];

  function updateBadges() {
    const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const wishlistCount = wishlist.length;

    document.querySelectorAll(".cart-count-badge").forEach(b => {
      b.textContent = cartCount;
    });

    document.querySelectorAll(".wishlist-count-badge").forEach(b => {
      b.textContent = wishlistCount;
    });
  }
  updateBadges();

  // ==========================================================================
  // 2. SLIDE-OVER CART DRAWER & CHECKOUT
  // ==========================================================================
  const cartDrawerOverlay = document.getElementById("cart-drawer-overlay");
  const cartDrawerCloseBtn = document.getElementById("cart-drawer-close");
  const cartOpenBtns = document.querySelectorAll(".cart-drawer-trigger");
  const cartItemsContainer = document.getElementById("cart-items-container");
  const cartEmptyState = document.getElementById("cart-empty-state");
  const cartSubtotalElem = document.getElementById("cart-subtotal");
  const cartTotalElem = document.getElementById("cart-total");
  const freeShippingFill = document.getElementById("free-shipping-fill");
  const freeShippingMsg = document.getElementById("free-shipping-msg");
  const checkoutBtn = document.getElementById("checkout-btn");

  function renderCartDrawer() {
    if (!cartItemsContainer) return;

    if (cart.length === 0) {
      cartItemsContainer.innerHTML = "";
      if (cartEmptyState) cartEmptyState.style.display = "block";
      if (cartSubtotalElem) cartSubtotalElem.textContent = formatPrice(0);
      if (cartTotalElem) cartTotalElem.textContent = formatPrice(0);
      if (freeShippingFill) freeShippingFill.style.width = "0%";
      if (freeShippingMsg) freeShippingMsg.innerHTML = `Add <strong>${formatPrice(999)}</strong> more for Free Delivery!`;
      return;
    }

    if (cartEmptyState) cartEmptyState.style.display = "none";

    let subtotal = 0;
    cartItemsContainer.innerHTML = cart.map(item => {
      const itemTotal = item.price * (item.quantity || 1);
      subtotal += itemTotal;
      return `
        <div class="cart-item" data-id="${item.id}" data-size="${item.size || ''}">
          <img src="${item.image}" alt="${item.name}" class="cart-item-img">
          <div class="cart-item-info">
            <h4 class="cart-item-title">${item.name}</h4>
            <div class="cart-item-meta">Size: ${item.size || 'Standard'} • Color: ${item.color || 'Default'}</div>
            <div class="cart-item-price">${formatPrice(item.price)}</div>
            <div class="cart-item-actions">
              <div class="cart-item-qty">
                <button class="cart-qty-btn qty-minus" data-id="${item.id}">−</button>
                <span class="cart-qty-val">${item.quantity || 1}</span>
                <button class="cart-qty-btn qty-plus" data-id="${item.id}">+</button>
              </div>
              <button class="cart-item-remove" data-id="${item.id}">Remove</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    if (cartSubtotalElem) cartSubtotalElem.textContent = formatPrice(subtotal);
    if (cartTotalElem) cartTotalElem.textContent = formatPrice(subtotal);

    // Free shipping calculation threshold ₹999
    const threshold = 999;
    if (freeShippingFill && freeShippingMsg) {
      if (subtotal >= threshold) {
        freeShippingFill.style.width = "100%";
        freeShippingMsg.innerHTML = "🎉 Congratulations! You have unlocked <strong>Free Express Delivery!</strong>";
      } else {
        const remaining = Math.max(0, threshold - subtotal);
        const pct = Math.min(100, (subtotal / threshold) * 100);
        freeShippingFill.style.width = `${pct}%`;
        freeShippingMsg.innerHTML = `Add <strong>${formatPrice(remaining)}</strong> more for Free Delivery!`;
      }
    }
  }

  function openCartDrawer() {
    renderCartDrawer();
    if (cartDrawerOverlay) cartDrawerOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeCartDrawer() {
    if (cartDrawerOverlay) cartDrawerOverlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  cartOpenBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openCartDrawer();
    });
  });

  if (cartDrawerCloseBtn) cartDrawerCloseBtn.addEventListener("click", closeCartDrawer);
  if (cartDrawerOverlay) {
    cartDrawerOverlay.addEventListener("click", (e) => {
      if (e.target === cartDrawerOverlay) closeCartDrawer();
    });
  }

  // Cart item actions (increase, decrease, remove)
  if (cartItemsContainer) {
    cartItemsContainer.addEventListener("click", (e) => {
      const id = e.target.dataset.id;
      if (!id) return;

      const idx = cart.findIndex(it => it.id === id);
      if (idx === -1) return;

      if (e.target.classList.contains("qty-plus")) {
        cart[idx].quantity = (cart[idx].quantity || 1) + 1;
      } else if (e.target.classList.contains("qty-minus")) {
        if (cart[idx].quantity > 1) {
          cart[idx].quantity -= 1;
        } else {
          cart.splice(idx, 1);
        }
      } else if (e.target.classList.contains("cart-item-remove")) {
        cart.splice(idx, 1);
      }

      localStorage.setItem("velora_cart", JSON.stringify(cart));
      updateBadges();
      renderCartDrawer();
    });
  }

  // Checkout button
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeCartDrawer();
      window.location.href = "checkout.html";
    });
  }

  // ==========================================================================
  // 3. MOBILE NAVIGATION DRAWER
  // ==========================================================================
  const mobileToggleBtn = document.getElementById("mobile-toggle-btn");
  const mobileDrawer = document.getElementById("mobile-drawer");
  const mobileDrawerClose = document.getElementById("mobile-drawer-close");
  const mobileDrawerBackdrop = document.getElementById("mobile-drawer-backdrop");

  function toggleMobileDrawer(open) {
    if (!mobileDrawer) return;
    mobileDrawer.classList.toggle("active", open);
    document.body.style.overflow = open ? "hidden" : "";
  }

  if (mobileToggleBtn) mobileToggleBtn.addEventListener("click", () => toggleMobileDrawer(true));
  if (mobileDrawerClose) mobileDrawerClose.addEventListener("click", () => toggleMobileDrawer(false));
  if (mobileDrawerBackdrop) mobileDrawerBackdrop.addEventListener("click", () => toggleMobileDrawer(false));

  // ==========================================================================
  // 4. REAL-TIME SEARCH PREVIEW
  // ==========================================================================
  const navSearchInput = document.getElementById("nav-search-input");
  const searchResultsDropdown = document.getElementById("search-results-dropdown");
  const searchClearBtn = document.getElementById("search-clear-btn");

  if (navSearchInput && searchResultsDropdown) {
    navSearchInput.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (searchClearBtn) searchClearBtn.style.display = q ? "block" : "none";

      if (q.length < 2) {
        searchResultsDropdown.classList.remove("active");
        searchResultsDropdown.innerHTML = "";
        return;
      }

      const products = window.PRODUCTS_DATA || [];
      const matches = products.filter(p => 
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q))
      ).slice(0, 5);

      if (matches.length === 0) {
        searchResultsDropdown.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 0.85rem;">No products matching "${q}"</div>`;
      } else {
        searchResultsDropdown.innerHTML = matches.map(p => `
          <a href="product.html?id=${p.id}" class="search-result-item" style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; text-decoration: none; border-bottom: 1px solid #f1f5f9; transition: background 0.15s;">
            <img src="${p.image}" alt="${p.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px;">
            <div>
              <div style="font-weight: 600; font-size: 0.86rem; color: #0f172a;">${p.name}</div>
              <div style="font-size: 0.78rem; color: #64748b;">${formatPrice(p.price)} • ${p.category}</div>
            </div>
          </a>
        `).join("") + `
          <a href="shop.html?search=${encodeURIComponent(q)}" style="display: block; padding: 10px; text-align: center; font-size: 0.82rem; font-weight: 700; color: #6366f1; text-decoration: none; background: #f8fafc;">
            View all results &rarr;
          </a>
        `;
      }

      searchResultsDropdown.classList.add("active");
    });

    if (searchClearBtn) {
      searchClearBtn.addEventListener("click", () => {
        navSearchInput.value = "";
        searchClearBtn.style.display = "none";
        searchResultsDropdown.classList.remove("active");
      });
    }

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".nav-search-container")) {
        searchResultsDropdown.classList.remove("active");
      }
    });

    navSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && navSearchInput.value.trim()) {
        window.location.href = `shop.html?search=${encodeURIComponent(navSearchInput.value.trim())}`;
      }
    });
  }

  // ==========================================================================
  // 5. FAQ INTERACTION: ACCORDION & SEARCH & TABS
  // ==========================================================================
  const faqAccordionItems = document.querySelectorAll(".faq-accordion-item");
  const faqSearchInput = document.getElementById("faq-search-input");
  const faqTabBtns = document.querySelectorAll(".faq-tab-btn");

  // Accordion Toggle
  faqAccordionItems.forEach(item => {
    const btn = item.querySelector(".faq-question-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        const isOpen = item.classList.contains("active");
        // Optionally close others in same group
        const parentGroup = item.closest(".faq-accordion-group");
        if (parentGroup) {
          parentGroup.querySelectorAll(".faq-accordion-item").forEach(other => {
            if (other !== item) other.classList.remove("active");
          });
        }
        item.classList.toggle("active", !isOpen);
      });
    }
  });

  // Category Tab Filtering
  faqTabBtns.forEach(tab => {
    tab.addEventListener("click", () => {
      faqTabBtns.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const category = tab.dataset.category || "all";

      document.querySelectorAll(".faq-accordion-group").forEach(group => {
        if (category === "all" || group.dataset.category === category) {
          group.style.display = "block";
        } else {
          group.style.display = "none";
        }
      });
    });
  });

  // Dynamic Keyword Search
  if (faqSearchInput) {
    faqSearchInput.addEventListener("input", (e) => {
      const term = e.target.value.trim().toLowerCase();
      let totalVisible = 0;

      faqAccordionItems.forEach(item => {
        const questionText = item.querySelector(".faq-question-btn").textContent.toLowerCase();
        const answerText = item.querySelector(".faq-answer-panel").textContent.toLowerCase();
        const matches = questionText.includes(term) || answerText.includes(term);

        item.style.display = matches ? "block" : "none";
        if (matches) {
          totalVisible++;
          if (term.length > 2) {
            item.classList.add("active"); // Auto-expand when searching
          }
        }
      });

      // Show/hide section headings if no matching items in group
      document.querySelectorAll(".faq-accordion-group").forEach(group => {
        const hasVisible = Array.from(group.querySelectorAll(".faq-accordion-item")).some(i => i.style.display !== "none");
        group.style.display = hasVisible ? "block" : "none";
      });

      const noResultsElem = document.getElementById("faq-no-results");
      if (noResultsElem) {
        noResultsElem.style.display = totalVisible === 0 ? "block" : "none";
      }
    });
  }

  // ==========================================================================
  // 6. CONTACT SUPPORT FORM VALIDATION & SUBMISSION
  // ==========================================================================
  const contactForm = document.getElementById("contact-support-form");
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();

      let hasError = false;
      const name = document.getElementById("contact-name");
      const email = document.getElementById("contact-email");
      const subject = document.getElementById("contact-subject");
      const message = document.getElementById("contact-message");

      // Validate name
      if (!name.value.trim()) {
        name.closest(".form-group").classList.add("has-error");
        hasError = true;
      } else {
        name.closest(".form-group").classList.remove("has-error");
      }

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.value.trim())) {
        email.closest(".form-group").classList.add("has-error");
        hasError = true;
      } else {
        email.closest(".form-group").classList.remove("has-error");
      }

      // Validate subject
      if (!subject.value) {
        subject.closest(".form-group").classList.add("has-error");
        hasError = true;
      } else {
        subject.closest(".form-group").classList.remove("has-error");
      }

      // Validate message
      if (message.value.trim().length < 10) {
        message.closest(".form-group").classList.add("has-error");
        hasError = true;
      } else {
        message.closest(".form-group").classList.remove("has-error");
      }

      if (hasError) return;

      // Simulated Demo Submission
      const ticketId = "VEL-TKT-" + Math.floor(10000 + Math.random() * 90000);
      const ticket = {
        id: ticketId,
        name: name.value.trim(),
        email: email.value.trim(),
        phone: (document.getElementById("contact-phone") || {}).value || "",
        orderNumber: (document.getElementById("contact-order") || {}).value || "",
        subject: subject.value,
        message: message.value.trim(),
        date: new Date().toISOString()
      };

      const existingTickets = JSON.parse(localStorage.getItem("velora_support_tickets") || "[]");
      existingTickets.push(ticket);
      localStorage.setItem("velora_support_tickets", JSON.stringify(existingTickets));

      // Show success state
      const successBanner = document.getElementById("contact-success-banner");
      if (successBanner) {
        const ticketRef = document.getElementById("contact-ticket-ref");
        if (ticketRef) ticketRef.textContent = ticketId;
        successBanner.classList.add("active");
        contactForm.style.display = "none";
      }

      showToast(`Support Ticket ${ticketId} created! Our concierge will respond shortly.`, "success");
    });

    const btnResetContact = document.getElementById("btn-reset-contact-form");
    if (btnResetContact) {
      btnResetContact.addEventListener("click", () => {
        contactForm.reset();
        contactForm.style.display = "block";
        const successBanner = document.getElementById("contact-success-banner");
        if (successBanner) successBanner.classList.remove("active");
      });
    }
  }

  // ==========================================================================
  // 7. CAREERS APPLICATION MODAL & SUBMISSION
  // ==========================================================================
  const careersModalOverlay = document.getElementById("careers-modal-overlay");
  const careersModalClose = document.getElementById("careers-modal-close");
  const careersForm = document.getElementById("careers-application-form");
  const careersPositionSelect = document.getElementById("careers-position-select");

  document.querySelectorAll(".btn-apply-job").forEach(btn => {
    btn.addEventListener("click", () => {
      const position = btn.dataset.jobTitle || "";
      if (careersPositionSelect && position) {
        careersPositionSelect.value = position;
      }
      if (careersModalOverlay) careersModalOverlay.classList.add("active");
      document.body.style.overflow = "hidden";
    });
  });

  if (careersModalClose) {
    careersModalClose.addEventListener("click", () => {
      if (careersModalOverlay) careersModalOverlay.classList.remove("active");
      document.body.style.overflow = "";
    });
  }

  if (careersModalOverlay) {
    careersModalOverlay.addEventListener("click", (e) => {
      if (e.target === careersModalOverlay) {
        careersModalOverlay.classList.remove("active");
        document.body.style.overflow = "";
      }
    });
  }

  if (careersForm) {
    careersForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = document.getElementById("careers-applicant-name");
      const email = document.getElementById("careers-applicant-email");
      let hasError = false;

      if (!name.value.trim()) {
        name.closest(".form-group").classList.add("has-error");
        hasError = true;
      } else {
        name.closest(".form-group").classList.remove("has-error");
      }

      if (!email.value.trim() || !email.value.includes("@")) {
        email.closest(".form-group").classList.add("has-error");
        hasError = true;
      } else {
        email.closest(".form-group").classList.remove("has-error");
      }

      if (hasError) return;

      const appRef = "APP-" + Math.floor(1000 + Math.random() * 9000);
      showToast(`Application received! Ref #${appRef}. Thank you for applying to VELORA.`, "success");

      careersForm.reset();
      if (careersModalOverlay) careersModalOverlay.classList.remove("active");
      document.body.style.overflow = "";
    });
  }

  // ==========================================================================
  // 8. AFFILIATE PROGRAM FORM SUBMISSION
  // ==========================================================================
  const affiliateForm = document.getElementById("affiliate-application-form");
  if (affiliateForm) {
    affiliateForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = document.getElementById("affiliate-name");
      const email = document.getElementById("affiliate-email");
      const handle = document.getElementById("affiliate-handle");
      let hasError = false;

      [name, email, handle].forEach(inp => {
        if (!inp.value.trim()) {
          inp.closest(".form-group").classList.add("has-error");
          hasError = true;
        } else {
          inp.closest(".form-group").classList.remove("has-error");
        }
      });

      if (hasError) return;

      const partnerId = "VEL-PARTNER-" + Math.floor(100 + Math.random() * 900);
      const successBanner = document.getElementById("affiliate-success-banner");
      if (successBanner) {
        successBanner.classList.add("active");
        affiliateForm.style.display = "none";
      }

      showToast(`Affiliate application received! Ref #${partnerId}.`, "success");
    });
  }

  // ==========================================================================
  // 9. BRAND ASSETS DOWNLOAD SIMULATION
  // ==========================================================================
  const btnDownloadAssets = document.getElementById("btn-download-brand-assets");
  if (btnDownloadAssets) {
    btnDownloadAssets.addEventListener("click", (e) => {
      e.preventDefault();
      showToast("Downloading VELORA Brand Assets Kit (Vector Logos, Color Palettes & Photography)...", "info");
    });
  }

  // ==========================================================================
  // 10. TOAST NOTIFICATION HELPER
  // ==========================================================================
  function showToast(msg, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      background: #0f172a;
      color: #ffffff;
      padding: 14px 20px;
      border-radius: 10px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.9rem;
      margin-top: 10px;
      border-left: 4px solid ${type === 'success' ? '#10b981' : '#6366f1'};
      animation: slideInRight 0.3s ease-out;
    `;
    toast.innerHTML = `<span>${msg}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(20px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ==========================================================================
  // 11. LEGAL TABLE OF CONTENTS SCROLL SPY & BACK TO TOP
  // ==========================================================================
  const tocLinks = document.querySelectorAll(".info-sidebar-menu a");
  const policyBlocks = document.querySelectorAll(".policy-block");
  const backToTopBtn = document.getElementById("btn-back-to-top");

  // Scroll spy for Table of Contents
  if (tocLinks.length > 0 && policyBlocks.length > 0 && typeof IntersectionObserver !== "undefined") {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute("id");
          if (id) {
            tocLinks.forEach(link => {
              if (link.getAttribute("href") === `#${id}`) {
                link.classList.add("active");
              } else {
                link.classList.remove("active");
              }
            });
          }
        }
      });
    }, { rootMargin: "-15% 0px -65% 0px" });

    policyBlocks.forEach(block => observer.observe(block));
  }

  // Floating Back to Top button
  if (backToTopBtn) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 350) {
        backToTopBtn.classList.add("visible");
      } else {
        backToTopBtn.classList.remove("visible");
      }
    }, { passive: true });

    backToTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
});