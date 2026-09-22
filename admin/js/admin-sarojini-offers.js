/**
 * VADI Admin Panel - Sarojini Offers Controller
 * Handles CRUD and budget promotional tiers for Sarojini Bazaar storefront
 */

document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const offersContainer = document.getElementById("offers-container");
  const btnCreateOffer = document.getElementById("btn-create-offer");

  const modal = document.getElementById("offer-modal");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const btnCancelModal = document.getElementById("btn-cancel-modal");
  const offerForm = document.getElementById("offer-form");
  const modalTitle = document.getElementById("modal-title");

  const inputId = document.getElementById("offer-id");
  const inputTitle = document.getElementById("offer-title");
  const inputSubtitle = document.getElementById("offer-subtitle");
  const inputBadge = document.getElementById("offer-badge");
  const inputDiscountText = document.getElementById("offer-discount-text");
  const inputMaxPrice = document.getElementById("offer-max-price");
  const inputDisplayOrder = document.getElementById("offer-display-order");
  const inputBannerImage = document.getElementById("offer-banner-image");
  const inputIsActive = document.getElementById("offer-is-active");

  const DEFAULT_OFFERS = [
    {
      id: "so-1",
      title: "Under ₹199 Steal Zone",
      subtitle: "Bargain graphic tees, caps, socks & street accessories",
      badge: "STEAL DEAL",
      discount_text: "UNDER ₹199",
      filter_query: { max_price: 199 },
      banner_image: "../assets/sarojni/hero-bazaar-real.png",
      is_active: true,
      display_order: 1
    },
    {
      id: "so-2",
      title: "Under ₹299 Street Styles",
      subtitle: "Casual printed shirts, cotton cargo shorts & sunglasses",
      badge: "MOST POPULAR",
      discount_text: "UNDER ₹299",
      filter_query: { max_price: 299 },
      banner_image: "../assets/sarojni/cat-men-street.png",
      is_active: true,
      display_order: 2
    },
    {
      id: "so-3",
      title: "Under ₹499 Premium Finds",
      subtitle: "Denim jackets, cargo pants & chunky sneakers",
      badge: "HOT PICK",
      discount_text: "UNDER ₹499",
      filter_query: { max_price: 499 },
      banner_image: "../assets/sarojni/cat-women-korean.png",
      is_active: true,
      display_order: 3
    },
    {
      id: "so-4",
      title: "Weekend Sarojini Clearance",
      subtitle: "End-of-season stock clearing with maximum price drops",
      badge: "CLEARANCE",
      discount_text: "FLAT 50% OFF",
      filter_query: { discount: "50%" },
      banner_image: "../assets/sarojni/stall-clothes-rack.png",
      is_active: true,
      display_order: 4
    }
  ];

  let offers = [];

  function openModal(offer = null) {
    if (offer) {
      modalTitle.textContent = "Edit Sarojini Offer";
      inputId.value = offer.id || "";
      inputTitle.value = offer.title || "";
      inputSubtitle.value = offer.subtitle || "";
      inputBadge.value = offer.badge || "";
      inputDiscountText.value = offer.discount_text || "";
      inputMaxPrice.value = (offer.filter_query && offer.filter_query.max_price) ? offer.filter_query.max_price : "";
      inputDisplayOrder.value = offer.display_order ?? 0;
      inputBannerImage.value = offer.banner_image || "";
      inputIsActive.checked = offer.is_active !== false;
    } else {
      modalTitle.textContent = "Create Sarojini Offer";
      offerForm.reset();
      inputId.value = "";
      inputDisplayOrder.value = offers.length + 1;
      inputIsActive.checked = true;
    }
    modal.style.display = "flex";
  }

  function closeModal() {
    modal.style.display = "none";
  }

  btnCloseModal?.addEventListener("click", closeModal);
  btnCancelModal?.addEventListener("click", closeModal);
  modalBackdrop?.addEventListener("click", closeModal);
  btnCreateOffer?.addEventListener("click", () => openModal(null));

  async function loadOffers() {
    try {
      // 1. Query sarojini_offers table
      const { data, error } = await client
        .from("sarojini_offers")
        .select("*")
        .order("display_order", { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        offers = data;
      } else {
        // Fallback to store_settings
        const { data: setting } = await client
          .from("store_settings")
          .select("value")
          .eq("key", "sarojini_offers")
          .maybeSingle();

        if (setting && Array.isArray(setting.value) && setting.value.length > 0) {
          offers = setting.value;
        } else {
          // Initialize defaults
          offers = DEFAULT_OFFERS;
          await saveOffersFallback();
        }
      }

      renderOffers();

    } catch (err) {
      console.error("Load offers error:", err);
      offers = DEFAULT_OFFERS;
      renderOffers();
    }
  }

  async function saveOffersFallback() {
    try {
      await client.from("store_settings").upsert({
        key: "sarojini_offers",
        value: offers,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn("Could not save offers fallback:", e);
    }
  }

  function renderOffers() {
    if (!offersContainer) return;

    if (offers.length === 0) {
      offersContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: var(--admin-card-bg); border-radius: var(--admin-radius);">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">🏷️</div>
          <h3>No Offers Created Yet</h3>
          <p style="color: var(--admin-text-muted); margin-bottom: 20px;">Create budget tiers and discount banners for the Sarojini storefront.</p>
          <button class="btn-admin-primary" id="btn-empty-create" style="background:#e11d48; border-color:#e11d48;">
            <i class="fas fa-plus"></i> Create First Offer
          </button>
        </div>
      `;
      document.getElementById("btn-empty-create")?.addEventListener("click", () => openModal(null));
      return;
    }

    offersContainer.innerHTML = offers.map(o => `
      <div class="offer-card ${!o.is_active ? 'inactive' : ''}">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <span class="offer-badge">${o.badge || 'PROMO'}</span>
            <span class="badge ${o.is_active ? 'badge-success' : 'badge-danger'}" style="font-size: 0.72rem;">
              ${o.is_active ? 'Active' : 'Hidden'}
            </span>
          </div>
          
          <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 6px 0; color: var(--admin-text-primary);">
            ${o.title}
          </h3>
          <p style="font-size: 0.83rem; color: var(--admin-text-muted); line-height: 1.4; margin: 0 0 16px 0;">
            ${o.subtitle || 'Special Sarojini promotion tier'}
          </p>

          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
            ${o.discount_text ? `<span style="background: rgba(225,29,72,0.1); color: #e11d48; font-weight: 800; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px;">${o.discount_text}</span>` : ''}
            ${o.filter_query?.max_price ? `<span style="background: rgba(99,102,241,0.1); color: #6366f1; font-weight: 700; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px;">Max ₹${o.filter_query.max_price}</span>` : ''}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--admin-card-border); padding-top: 14px; margin-top: 8px;">
          <div style="font-size: 0.75rem; color: var(--admin-text-muted);">
            Order #${o.display_order ?? 0}
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn-admin-secondary btn-toggle-active" data-id="${o.id}" style="padding: 4px 8px; font-size: 0.78rem;">
              <i class="fas ${o.is_active ? 'fa-eye-slash' : 'fa-eye'}"></i>
            </button>
            <button class="btn-admin-secondary btn-edit-offer" data-id="${o.id}" style="padding: 4px 8px; font-size: 0.78rem;">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-admin-secondary text-danger btn-delete-offer" data-id="${o.id}" style="padding: 4px 8px; font-size: 0.78rem;">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join("");

    // Attach event listeners
    offersContainer.querySelectorAll(".btn-edit-offer").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const offer = offers.find(o => String(o.id) === String(id));
        if (offer) openModal(offer);
      });
    });

    offersContainer.querySelectorAll(".btn-toggle-active").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const offer = offers.find(o => String(o.id) === String(id));
        if (offer) {
          offer.is_active = !offer.is_active;
          await persistOffer(offer);
          renderOffers();
        }
      });
    });

    offersContainer.querySelectorAll(".btn-delete-offer").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!confirm("Are you sure you want to delete this Sarojini offer?")) return;
        
        offers = offers.filter(o => String(o.id) !== String(id));
        
        try {
          await client.from("sarojini_offers").delete().eq("id", id);
        } catch (e) {
          console.warn("Delete offer table warning:", e);
        }
        await saveOffersFallback();
        renderOffers();
      });
    });
  }

  async function persistOffer(offer) {
    // Try table update
    try {
      await client.from("sarojini_offers").upsert(offer);
    } catch (e) {
      console.warn("Upsert offer table warning:", e);
    }
    // Also save in store_settings fallback
    await saveOffersFallback();
  }

  offerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = inputId.value || ("so-" + Date.now());
    const filterQuery = {};
    if (inputMaxPrice.value) {
      filterQuery.max_price = Number(inputMaxPrice.value);
    }

    const offerObj = {
      id,
      title: inputTitle.value.trim(),
      subtitle: inputSubtitle.value.trim(),
      badge: inputBadge.value.trim() || 'DEAL',
      discount_text: inputDiscountText.value.trim(),
      filter_query: filterQuery,
      banner_image: inputBannerImage.value.trim() || '../assets/sarojni/hero-bazaar-real.png',
      is_active: inputIsActive.checked,
      display_order: Number(inputDisplayOrder.value || 0),
      updated_at: new Date().toISOString()
    };

    const existingIdx = offers.findIndex(o => String(o.id) === String(id));
    if (existingIdx >= 0) {
      offers[existingIdx] = { ...offers[existingIdx], ...offerObj };
    } else {
      offerObj.created_at = new Date().toISOString();
      offers.push(offerObj);
    }

    await persistOffer(offerObj);
    closeModal();
    renderOffers();
  });

  // Initial load
  loadOffers();
});

