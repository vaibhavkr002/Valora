/**
 * VELORA Admin Panel - Order Details & Status Updater
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("id");

  if (!orderId) {
    alert("No order specified.");
    window.location.href = "orders.html";
    return;
  }

  const elOrderNum = document.getElementById("detail-order-number");
  const elOrderStatusBadge = document.getElementById("detail-order-status-badge");
  const selectStatus = document.getElementById("select-order-status");
  const btnUpdateStatus = document.getElementById("btn-update-status");
  const itemsContainer = document.getElementById("order-items-container");

  function escapeHTML(str) {
    if (typeof str !== 'string') return str == null ? '' : String(str);
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  function getOrderCatalogInfo(order) {
    const items = order.order_items || [];
    let hasSarojini = false;
    let hasMain = false;

    for (const it of items) {
      if (it.catalog_type === 'sarojini' || it.sarojini_product_id != null) {
        hasSarojini = true;
      } else {
        hasMain = true;
      }
    }

    if (hasSarojini && hasMain) {
      return {
        type: 'mixed',
        label: 'Mixed Catalog',
        icon: '🔀',
        style: 'background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4);'
      };
    } else if (hasSarojini) {
      return {
        type: 'sarojini',
        label: 'Sarojini Bazaar',
        icon: '🛍️',
        style: 'background: rgba(225, 29, 72, 0.15); color: #fb7185; border: 1px solid rgba(225, 29, 72, 0.4);'
      };
    } else {
      return {
        type: 'main',
        label: 'Main VADI',
        icon: '🏪',
        style: 'background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4);'
      };
    }
  }

  async function loadOrder() {
    const { data: order, error } = await client
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      alert("Order not found: " + (error?.message || ""));
      window.location.href = "orders.html";
      return;
    }

    if (elOrderNum) elOrderNum.textContent = order.order_number;

    const catInfo = getOrderCatalogInfo(order);
    const elCatalogBadge = document.getElementById("detail-catalog-badge");
    if (elCatalogBadge) {
      elCatalogBadge.textContent = `${catInfo.icon} ${catInfo.label}`;
      elCatalogBadge.style.cssText = `display: inline-flex; align-items: center; gap: 4px; font-size: 0.8rem; font-weight: 700; padding: 4px 10px; border-radius: 6px; ${catInfo.style}`;
    }

    document.getElementById("detail-order-date").textContent = new Date(order.created_at).toLocaleString("en-IN");
    document.getElementById("detail-customer-name").textContent = order.delivery_full_name;
    document.getElementById("detail-customer-phone").textContent = order.delivery_phone;
    document.getElementById("detail-customer-address").innerHTML = `
      ${order.delivery_address}<br>
      ${order.delivery_city}, ${order.delivery_state} ${order.delivery_pincode}, ${order.delivery_country}
    `;

    // Fetch store_settings order_metadata fallback if needed
    let meta = {};
    try {
      const { data: metaRow } = await client.from("store_settings").select("value").eq("key", "order_metadata").maybeSingle();
      if (metaRow && metaRow.value && metaRow.value[orderId]) {
        meta = metaRow.value[orderId];
      }
    } catch (_) {}

    // Delivery Preference Display
    const deliveryPref = order.delivery_preference || meta.delivery_preference || (order.payment_method && order.payment_method.includes("Open Box") ? "Open Box Delivery" : "Simple Delivery");
    const elDeliveryPref = document.getElementById("detail-delivery-preference");
    if (elDeliveryPref) {
      elDeliveryPref.textContent = deliveryPref;
      if (deliveryPref === "Open Box Delivery") {
        elDeliveryPref.className = "badge badge-indigo";
        elDeliveryPref.style.background = "rgba(2, 132, 199, 0.2)";
        elDeliveryPref.style.color = "#38bdf8";
        elDeliveryPref.style.border = "1px solid rgba(2, 132, 199, 0.4)";
      } else {
        elDeliveryPref.className = "badge badge-muted";
      }
    }

    // Full Online Payment Free Gifts Display
    const hasAdvanceCheck = Number(order.advance_paid || order.advance_amount || 0) > 0;
    const isOnlinePaid = Boolean(
      order.is_full_online_payment || 
      meta.is_full_online_payment ||
      (order.payment_status === "paid" && !hasAdvanceCheck && !order.payment_method?.toLowerCase().includes("cash on delivery")) ||
      order.payment_method?.includes("Full Online")
    );

    let orderGiftItems = [];
    try {
      if (Array.isArray(order.free_gifts_items)) {
        orderGiftItems = order.free_gifts_items;
      } else if (typeof order.free_gifts_items === "string") {
        orderGiftItems = JSON.parse(order.free_gifts_items);
      } else if (Array.isArray(meta.free_gifts_items)) {
        orderGiftItems = meta.free_gifts_items;
      } else if (typeof meta.free_gifts_items === "string") {
        orderGiftItems = JSON.parse(meta.free_gifts_items);
      }
    } catch (e) {
      orderGiftItems = [];
    }

    const hasGifts = Boolean(
      (order.free_gifts_eligible || meta.free_gifts_eligible || (isOnlinePaid && !hasAdvanceCheck && !order.payment_method?.toLowerCase().includes("cash on delivery"))) &&
      (orderGiftItems.length > 0 || order.free_gifts_eligible)
    );

    const elGiftsCard = document.getElementById("detail-gifts-card");
    const elGiftsTitle = document.getElementById("detail-gifts-title");
    const elGiftsList = document.getElementById("detail-gifts-list");

    if (elGiftsCard) {
      elGiftsCard.style.display = hasGifts ? "block" : "none";
      if (hasGifts) {
        if (elGiftsTitle) {
          elGiftsTitle.textContent = `🎁 ${orderGiftItems.length > 0 ? orderGiftItems.length : 3} Free Gifts Included`;
        }
        if (elGiftsList) {
          if (orderGiftItems.length > 0) {
            elGiftsList.innerHTML = orderGiftItems.map(g => `
              <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:1.1rem;">${g.icon || '🎁'}</span>
                  <div>
                    <strong style="color:#fff;">${g.name || g.gift_name}</strong>
                    ${g.description ? `<div style="font-size:0.72rem; color:var(--admin-text-muted);">${g.description}</div>` : ''}
                  </div>
                </div>
                <span style="color:#10b981; font-weight:700;">FREE (₹0) ${g.quantity > 1 ? `x${g.quantity}` : ''}</span>
              </div>
            `).join("");
          } else {
            elGiftsList.innerHTML = `
              <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); padding:5px 8px; border-radius:6px;">
                <span>🧦 <strong>Luxury Cotton Crew Socks</strong></span>
                <span style="color:#10b981; font-weight:700;">FREE (₹0)</span>
              </div>
              <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); padding:5px 8px; border-radius:6px;">
                <span>🧵 <strong>Premium Extra Laces</strong></span>
                <span style="color:#10b981; font-weight:700;">FREE (₹0)</span>
              </div>
              <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); padding:5px 8px; border-radius:6px;">
                <span>🔑 <strong>Signature VADI Keychain</strong></span>
                <span style="color:#10b981; font-weight:700;">FREE (₹0)</span>
              </div>
            `;
          }
        }
      }
    }

    document.getElementById("detail-payment-method").textContent = order.payment_method;
    document.getElementById("detail-payment-status").textContent = order.payment_status;
    document.getElementById("detail-subtotal").textContent = window.formatINR(order.subtotal);
    document.getElementById("detail-discount").textContent = `-${window.formatINR(order.discount)}`;
    document.getElementById("detail-shipping").textContent = (!order.shipping_charge || order.shipping_charge === 0) ? "FREE (₹0)" : window.formatINR(order.shipping_charge);
    document.getElementById("detail-total").textContent = window.formatINR(order.total);

    // Advance Payment Details
    const advancePaidVal = Number(order.advance_paid || order.advance_amount || 0);
    const codBalVal = Number(order.cod_balance || 0);
    const advanceRow = document.getElementById("detail-advance-row");
    const codRow = document.getElementById("detail-cod-row");
    const advStatusBox = document.getElementById("detail-advance-status-box");
    const advStatusBadge = document.getElementById("detail-advance-status");
    const codStatusBadge = document.getElementById("detail-cod-status");
    const codControlBox = document.getElementById("cod-collection-control");
    const btnMarkCodCollected = document.getElementById("btn-mark-cod-collected");

    if (advancePaidVal > 0) {
      if (advanceRow) {
        advanceRow.style.display = "flex";
        document.getElementById("detail-advance-paid").textContent = window.formatINR(advancePaidVal);
      }
      if (codRow) {
        codRow.style.display = "flex";
        document.getElementById("detail-cod-balance").textContent = window.formatINR(codBalVal);
      }
      if (advStatusBox) {
        advStatusBox.style.display = "block";
        if (advStatusBadge) advStatusBadge.textContent = order.advance_payment_status || "paid";
        if (codStatusBadge) {
          codStatusBadge.textContent = order.cod_payment_status || "pending";
          codStatusBadge.className = `badge ${order.cod_payment_status === 'collected' ? 'badge-success' : 'badge-warning'}`;
        }
      }

      if (codControlBox) {
        if (order.cod_payment_status !== "collected" && codBalVal > 0) {
          codControlBox.style.display = "block";
        } else {
          codControlBox.style.display = "none";
        }
      }

      if (btnMarkCodCollected) {
        btnMarkCodCollected.onclick = async () => {
          if (!confirm(`Confirm collection of ${window.formatINR(codBalVal)} COD balance from customer?`)) return;
          btnMarkCodCollected.disabled = true;
          btnMarkCodCollected.textContent = "Updating...";

          const { error: codUpdErr } = await client
            .from("orders")
            .update({
              cod_payment_status: "collected",
              payment_status: "paid",
              updated_at: new Date().toISOString()
            })
            .eq("id", orderId);

          if (codUpdErr) {
            alert("Failed to update COD status: " + codUpdErr.message);
            btnMarkCodCollected.disabled = false;
            btnMarkCodCollected.textContent = "Mark COD Balance Collected";
          } else {
            window.showToast("COD balance recorded as collected! Order marked fully paid.", "success");
            await loadOrder();
          }
        };
      }
    } else {
      if (advanceRow) advanceRow.style.display = "none";
      if (codRow) codRow.style.display = "none";
      if (advStatusBox) advStatusBox.style.display = "none";
    }

    if (selectStatus) selectStatus.value = order.order_status;

    // Render items with advance info, store origin & live View Product links
    if (itemsContainer) {
      if (!order.order_items || order.order_items.length === 0) {
        itemsContainer.innerHTML = `
          <div style="padding: 32px 20px; text-align: center; color: var(--admin-text-muted); background: rgba(255,255,255,0.02); border: 1px dashed var(--admin-card-border); border-radius: 8px;">
            <i class="fas fa-box-open" style="font-size: 2.2rem; margin-bottom: 10px; opacity: 0.4; display: block;"></i>
            <div style="font-weight: 600; font-size: 0.95rem; color: #cbd5e1; margin-bottom: 4px;">No item records found</div>
            <div style="font-size: 0.8rem; color: var(--admin-text-muted);">No product line-items are associated with this order record.</div>
          </div>
        `;
      } else {
        // Resolve product links and availability asynchronously for all items
        const itemLinkInfos = await Promise.all((order.order_items || []).map(async (item) => {
          const isSarojini = (item.catalog_type === 'sarojini' || item.sarojini_product_id != null);
          const targetId = isSarojini ? (item.sarojini_product_id || item.product_id) : item.product_id;

          let isAvailable = false;
          let finalUrl = "";
          let resolvedProduct = null;

          if (isSarojini) {
            try {
              let query = client.from("sarojini_products").select("id, name, slug, price, is_active, images");
              if (targetId) {
                query = query.eq("id", targetId);
              } else if (item.product_name) {
                query = query.eq("name", item.product_name);
              }
              const { data, error } = await query.maybeSingle();
              if (!error && data) {
                resolvedProduct = data;
                if (data.is_active !== false) {
                  isAvailable = true;
                  finalUrl = `../sarojini-product-details.html?id=${encodeURIComponent(data.id || data.slug)}`;
                }
              }
            } catch (_) {}

            if (!resolvedProduct && item.product_name) {
              try {
                const { data: nameMatch, error: nameErr } = await client
                  .from("sarojini_products")
                  .select("id, name, slug, price, is_active, images")
                  .eq("name", item.product_name)
                  .maybeSingle();
                if (!nameErr && nameMatch) {
                  resolvedProduct = nameMatch;
                  if (nameMatch.is_active !== false) {
                    isAvailable = true;
                    finalUrl = `../sarojini-product-details.html?id=${encodeURIComponent(nameMatch.id || nameMatch.slug)}`;
                  }
                }
              } catch (_) {}
            }

            // Fallback: if not found in database by UUID, but targetId is a valid string/UUID and wasn't found as inactive
            if (!finalUrl && targetId && resolvedProduct === null) {
              finalUrl = `../sarojini-product-details.html?id=${encodeURIComponent(targetId)}`;
              isAvailable = true;
            }
          } else {
            // Main VADI product
            try {
              let query = client.from("products").select("id, name, slug, price, is_active, images");
              if (targetId) {
                query = query.eq("id", targetId);
              } else if (item.product_name) {
                query = query.eq("name", item.product_name);
              }
              const { data, error } = await query.maybeSingle();
              if (!error && data) {
                resolvedProduct = data;
                if (data.is_active !== false) {
                  isAvailable = true;
                  finalUrl = `../product.html?id=${encodeURIComponent(data.id || data.slug)}`;
                }
              }
            } catch (_) {}

            if (!resolvedProduct && item.product_name) {
              try {
                const { data: nameMatch, error: nameErr } = await client
                  .from("products")
                  .select("id, name, slug, price, is_active, images")
                  .eq("name", item.product_name)
                  .maybeSingle();
                if (!nameErr && nameMatch) {
                  resolvedProduct = nameMatch;
                  if (nameMatch.is_active !== false) {
                    isAvailable = true;
                    finalUrl = `../product.html?id=${encodeURIComponent(nameMatch.id || nameMatch.slug)}`;
                  }
                }
              } catch (_) {}
            }

            // Fallback: if not found in database by UUID, but targetId is a valid string/UUID and wasn't found as inactive
            if (!finalUrl && targetId && resolvedProduct === null) {
              finalUrl = `../product.html?id=${encodeURIComponent(targetId)}`;
              isAvailable = true;
            }
          }

          // Recover missing order item image from resolved product record
          if (resolvedProduct) {
            const catalogImg = (window.VeloraImageUtils && typeof window.VeloraImageUtils.resolveProductImage === 'function')
              ? window.VeloraImageUtils.resolveProductImage(resolvedProduct, { isAdmin: true })
              : (Array.isArray(resolvedProduct.images) && resolvedProduct.images.length > 0 ? resolvedProduct.images[0] : resolvedProduct.image);
            if ((!item.product_image || item.product_image === 'undefined' || item.product_image === 'null') && catalogImg) {
              item.product_image = catalogImg;
            }
          }

          return {
            isAvailable,
            url: finalUrl,
            isSarojini,
            product: resolvedProduct
          };
        }));

        itemsContainer.innerHTML = order.order_items.map((item, idx) => {
          const linkInfo = itemLinkInfos[idx] || { isAvailable: false, url: "", isSarojini: false };
          let advBadge = "";
          const itemAdv = Number(item.advance_amount || 0);
          if (itemAdv > 0) {
            advBadge = `<span class="badge badge-indigo" style="font-size:0.72rem; margin-left:6px;">Advance: ${window.formatINR(itemAdv)}</span>`;
          }

          const isSarojiniItem = linkInfo.isSarojini || (item.catalog_type === 'sarojini' || item.sarojini_product_id != null);
          const storeBadge = isSarojiniItem
            ? `<span class="badge" style="background: rgba(225, 29, 72, 0.15); color: #fb7185; border: 1px solid rgba(225, 29, 72, 0.4); font-size: 0.7rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; margin-left: 6px;">🛍️ SAROJINI BAZAAR</span>`
            : `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); font-size: 0.7rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; margin-left: 6px;">🏪 MAIN VADI</span>`;

          const fallbackSvg = window.VeloraImageUtils ? window.VeloraImageUtils.getPlaceholderSvg() : 'https://via.placeholder.com/52';
          const displayImg = (window.VeloraImageUtils && typeof window.VeloraImageUtils.normalizeImageUrl === 'function')
            ? window.VeloraImageUtils.normalizeImageUrl(item.product_image, { isAdmin: true, fallback: fallbackSvg })
            : (item.product_image && item.product_image.startsWith('assets/') ? ('../' + item.product_image) : (item.product_image || fallbackSvg));

          let actionHtml = "";
          let productNameHtml = "";
          let imageHtml = "";

          if (linkInfo.isAvailable && linkInfo.url) {
            imageHtml = `
              <a href="${escapeHTML(linkInfo.url)}" target="_blank" rel="noopener noreferrer" style="display:block; flex-shrink:0; text-decoration:none;" title="Open product in customer store (opens in new tab)">
                <img src="${escapeHTML(displayImg)}" alt="${escapeHTML(item.product_name || 'Product')}" style="width:52px; height:52px; border-radius:8px; object-fit:contain; background:rgba(255,255,255,0.04); padding:2px; border:1px solid var(--admin-card-border); transition: transform 0.2s, border-color 0.2s;" onerror="this.onerror=null; this.src='${fallbackSvg}';" onmouseover="this.style.transform='scale(1.04)'; this.style.borderColor='var(--admin-accent, #38bdf8)';" onmouseout="this.style.transform='scale(1)'; this.style.borderColor='var(--admin-card-border)';">
              </a>
            `;

            productNameHtml = `
              <a href="${escapeHTML(linkInfo.url)}" target="_blank" rel="noopener noreferrer" style="color:#fff; font-size: 0.92rem; font-weight: 700; text-decoration: none; transition: color 0.15s;" onmouseover="this.style.color='var(--admin-accent, #38bdf8)'" onmouseout="this.style.color='#fff'" title="Open product in customer store (opens in new tab)">
                ${escapeHTML(item.product_name)}
              </a>
            `;

            actionHtml = `
              <a href="${escapeHTML(linkInfo.url)}" target="_blank" rel="noopener noreferrer" class="btn-admin-secondary btn-view-product" style="padding: 4px 10px; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; border-radius: 6px; font-weight: 600; white-space: nowrap; margin-left: 8px; border: 1px solid var(--admin-card-border); background: rgba(255,255,255,0.06); color: #e2e8f0; transition: all 0.2s;" onmouseover="this.style.background='rgba(56,189,248,0.15)'; this.style.borderColor='rgba(56,189,248,0.4)'; this.style.color='#38bdf8';" onmouseout="this.style.background='rgba(255,255,255,0.06)'; this.style.borderColor='var(--admin-card-border)'; this.style.color='#e2e8f0';" title="View live customer Product Details page in new tab">
                <span>View Product</span>
                <i class="fas fa-external-link-alt" style="font-size: 0.68rem;"></i>
              </a>
            `;
          } else {
            imageHtml = `
              <div style="flex-shrink:0;">
                <img src="${escapeHTML(displayImg)}" alt="${escapeHTML(item.product_name || 'Product')}" style="width:52px; height:52px; border-radius:8px; object-fit:contain; background:rgba(255,255,255,0.04); padding:2px; border:1px solid var(--admin-card-border); opacity: 0.85;" onerror="this.onerror=null; this.src='${fallbackSvg}';">
              </div>
            `;

            productNameHtml = `
              <strong style="color:#fff; font-size: 0.92rem;">${escapeHTML(item.product_name)}</strong>
            `;

            actionHtml = `
              <span class="badge badge-unavailable" style="background: rgba(148, 163, 184, 0.1); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.25); font-size: 0.72rem; padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; margin-left: 8px;" title="This product has been removed or is deactivated in the catalog">
                <i class="fas fa-ban" style="font-size: 0.68rem;"></i> Product Unavailable
              </span>
            `;
          }

          return `
            <div style="display:flex; align-items:center; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--admin-card-border);">
              ${imageHtml}
              <div style="flex:1;">
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                  ${productNameHtml}
                  ${storeBadge}
                  ${actionHtml}
                </div>
                <div style="font-size: 0.78rem; color: var(--admin-text-muted); margin-top: 4px;">
                  ${item.selected_size ? 'Size: ' + escapeHTML(item.selected_size) : ''} ${item.selected_color ? '• Color: ' + escapeHTML(item.selected_color) : ''} • Qty: ${item.quantity} ${advBadge}
                </div>
              </div>
              <div style="font-weight:700; color:#fff; font-size: 0.95rem;">${window.formatINR(item.subtotal || (item.price * item.quantity))}</div>
            </div>
          `;
        }).join("");
      }
    }

    // Render Order Requests (Cancellation / Return) section
    await renderOrderRequestSection(order);
  }

  // Helper to sync updates to local and store_settings backups
  function updateRequestInBackups(requestId, updates) {
    try {
      const localReqs = JSON.parse(localStorage.getItem("velora_order_requests") || "[]");
      const idx = localReqs.findIndex(r => r.id === requestId);
      if (idx !== -1) {
        localReqs[idx] = { ...localReqs[idx], ...updates, updated_at: new Date().toISOString() };
        localStorage.setItem("velora_order_requests", JSON.stringify(localReqs));
      }
    } catch (_) {}
    (async () => {
      try {
        const { data: sRow } = await client.from("store_settings").select("value").eq("key", "order_requests").maybeSingle();
        if (sRow && Array.isArray(sRow.value)) {
          const arr = sRow.value;
          const idx = arr.findIndex(r => r.id === requestId);
          if (idx !== -1) {
            arr[idx] = { ...arr[idx], ...updates, updated_at: new Date().toISOString() };
            await client.from("store_settings").upsert({ key: "order_requests", value: arr }, { onConflict: "key" });
          }
        }
      } catch (_) {}
    })();
  }

  async function renderOrderRequestSection(order) {
    const cardEl = document.getElementById("card-order-request");
    if (!cardEl) return;

    let reqs = [];
    try {
      const { data: dbReqs } = await client
        .from("order_requests")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false });
      if (dbReqs && Array.isArray(dbReqs)) reqs = dbReqs;
    } catch (e) {
      console.warn("order_requests fetch notice:", e);
    }

    if (reqs.length === 0) {
      try {
        const { data: sRow } = await client.from("store_settings").select("value").eq("key", "order_requests").maybeSingle();
        if (sRow && Array.isArray(sRow.value)) {
          reqs = sRow.value.filter(r => r.order_id === order.id);
        }
      } catch (_) {}
      try {
        const localReqs = JSON.parse(localStorage.getItem("velora_order_requests") || "[]");
        if (Array.isArray(localReqs)) {
          localReqs.forEach(lr => {
            if (lr.order_id === order.id && !reqs.some(r => r.id === lr.id)) {
              reqs.push(lr);
            }
          });
        }
      } catch (_) {}
    }

    const cancelReq = reqs.find(r => r.request_type === "cancellation");
    const returnReqs = reqs.filter(r => r.request_type === "return");
    const isCancelStatus = order.order_status === "cancellation_requested";
    const isReturnStatus = order.order_status === "return_requested";

    if (!cancelReq && returnReqs.length === 0 && !isCancelStatus && !isReturnStatus) {
      cardEl.style.display = "none";
      return;
    }

    cardEl.style.display = "block";

    const typeIcon = document.getElementById("request-type-icon");
    const cardTitle = document.getElementById("request-card-title");
    const statusBadge = document.getElementById("request-status-badge");
    const detailsContainer = document.getElementById("request-details-container");
    const actionsContainer = document.getElementById("request-actions-container");

    const hasAdvance = Number(order.advance_paid || order.advance_amount || 0) > 0;
    const isOnlinePaid = Boolean(
      order.is_full_online_payment ||
      (order.payment_status === "paid" && !hasAdvance && !order.payment_method?.toLowerCase().includes("cash on delivery")) ||
      order.payment_method?.includes("Full Online")
    );

    // CANCELLATION REQUEST VIEW
    if (cancelReq || isCancelStatus) {
      const activeReq = cancelReq || {
        id: "synth_cancel_" + order.id,
        order_id: order.id,
        request_type: "cancellation",
        reason: "Customer requested cancellation",
        status: "requested",
        created_at: order.updated_at || order.created_at
      };

      if (typeIcon) typeIcon.textContent = "⚠️";
      if (cardTitle) {
        cardTitle.textContent = "Customer Order Cancellation Request";
        cardTitle.style.color = "#f59e0b";
      }

      let badgeBg = "rgba(245, 158, 11, 0.2)";
      let badgeCol = "#f59e0b";
      let badgeText = "Pending Review";
      if (activeReq.status === "approved" || order.order_status === "cancelled") {
        badgeBg = "rgba(239, 68, 68, 0.2)";
        badgeCol = "#f87171";
        badgeText = "Cancellation Approved";
      } else if (activeReq.status === "rejected") {
        badgeBg = "rgba(100, 116, 139, 0.2)";
        badgeCol = "#94a3b8";
        badgeText = "Cancellation Rejected";
      }

      if (statusBadge) {
        statusBadge.style.background = badgeBg;
        statusBadge.style.color = badgeCol;
        statusBadge.textContent = badgeText;
      }

      const isRefundApplicable = hasAdvance || isOnlinePaid;
      const refundAmt = hasAdvance ? Number(order.advance_paid || order.advance_amount) : isOnlinePaid ? Number(order.total) : 0;

      let refundSummary = "";
      if (hasAdvance) {
        refundSummary = `
          <div style="margin-top: 10px; padding: 10px 14px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px;">
            <div style="color: #10b981; font-weight: 700; font-size: 0.9rem;">💳 Refund Due: ${window.formatINR(order.advance_paid || order.advance_amount)}</div>
            <div style="font-size: 0.78rem; color: var(--admin-text-muted); margin-top: 2px;">Advance payment collected online. Must be refunded to customer's source account (status remains Refund Processing until disbursed).</div>
          </div>
        `;
      } else if (isOnlinePaid) {
        refundSummary = `
          <div style="margin-top: 10px; padding: 10px 14px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px;">
            <div style="color: #10b981; font-weight: 700; font-size: 0.9rem;">💳 Refund Due: ${window.formatINR(order.total)}</div>
            <div style="font-size: 0.78rem; color: var(--admin-text-muted); margin-top: 2px;">100% Full Online payment captured. Must be refunded to customer's source account (status remains Refund Processing until disbursed).</div>
          </div>
        `;
      } else {
        refundSummary = `
          <div style="margin-top: 10px; padding: 10px 14px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; font-size: 0.82rem; color: var(--admin-text-muted);">
            ℹ️ Cash on Delivery Order — zero advance payment was captured. No financial refund required.
          </div>
        `;
      }

      if (detailsContainer) {
        const customerDisplay = `${escapeHTML(order.customer_name || order.shipping_name || 'Customer')} (${escapeHTML(order.customer_phone || order.shipping_phone || 'No phone')} &bull; ${escapeHTML(order.customer_email || order.shipping_email || 'No email')})`;
        const productsSummary = (order.order_items && order.order_items.length > 0)
          ? order.order_items.map(i => `${escapeHTML(i.product_name)} (x${i.quantity})`).join(', ')
          : `Order Total: ${window.formatINR(order.total)}`;

        detailsContainer.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-bottom: 12px;">
            <div>
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase;">Request ID:</span>
              <div style="font-weight: 700; font-size: 0.86rem; color: #818cf8; word-break: break-all;">${escapeHTML(activeReq.id)}</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase;">Order Number / ID:</span>
              <div style="font-weight: 700; font-size: 0.86rem; color: #fff;">#${escapeHTML(order.order_number)} <span style="font-size:0.75rem; color: var(--admin-text-muted);">(${order.id.slice(0, 8)}...)</span></div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase;">Customer:</span>
              <div style="font-size: 0.84rem; color: #fff;">${customerDisplay}</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase;">Products / Total:</span>
              <div style="font-size: 0.84rem; color: #fff;">${productsSummary} &bull; <strong>${window.formatINR(order.total)}</strong></div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase;">Request Type:</span>
              <div style="font-weight: 700; font-size: 0.88rem; color: #f59e0b;">Cancellation Request</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase;">Reason:</span>
              <div style="font-weight: 700; font-size: 0.88rem; color: #fff;">${escapeHTML(activeReq.reason || 'Customer requested cancellation')}</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase;">Requested On:</span>
              <div style="font-size: 0.84rem; color: #fff;">${new Date(activeReq.created_at).toLocaleString("en-IN")}</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase;">Current Status:</span>
              <div style="font-size: 0.84rem; color: #fff;">
                <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; font-weight: 700;">${(activeReq.status || 'requested').toUpperCase()}</span>
                ${isRefundApplicable ? ` &bull; Refund: <span class="badge" style="background: ${order.payment_status === 'refunded' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)'}; color: ${order.payment_status === 'refunded' ? '#10b981' : '#818cf8'}; font-weight: 700;">${order.payment_status === 'refunded' ? 'REFUNDED' : 'REFUND PROCESSING'}</span>` : ''}
              </div>
            </div>
          </div>
          ${activeReq.custom_reason || activeReq.description ? `
            <div style="margin-bottom: 10px; padding: 10px 14px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase; font-weight: 700;">Customer Description:</span>
              <div style="font-size: 0.86rem; color: #fff; margin-top: 4px; line-height: 1.4;">${escapeHTML(activeReq.custom_reason || activeReq.description)}</div>
            </div>
          ` : ''}
          ${refundSummary}
          ${activeReq.admin_notes ? `
            <div style="margin-top: 10px; padding: 8px 12px; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); border-radius: 6px; font-size: 0.82rem;">
              <strong style="color: #818cf8;">Admin Log:</strong> <span style="color: #fff;">${escapeHTML(activeReq.admin_notes)}</span>
            </div>
          ` : ''}
        `;
      }

      if (actionsContainer) {
        if (activeReq.status === "requested" || isCancelStatus) {
          actionsContainer.innerHTML = `
            <input type="text" id="admin-cancel-notes-input" class="admin-input" placeholder="Admin note (e.g. Approved, refund initiated / reason if rejected)..." style="flex: 1; min-width: 220px; font-size: 0.84rem;">
            <button type="button" id="btn-admin-approve-cancel" class="btn-admin-danger" style="padding: 8px 16px; font-size: 0.84rem; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fas fa-check"></i> Approve Cancellation
            </button>
            <button type="button" id="btn-admin-reject-cancel" class="btn-admin-secondary" style="padding: 8px 16px; font-size: 0.84rem; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fas fa-times"></i> Reject Cancellation
            </button>
          `;

          document.getElementById("btn-admin-approve-cancel")?.addEventListener("click", async () => {
            const adminNote = document.getElementById("admin-cancel-notes-input")?.value.trim() || "Cancellation approved by administrator";
            const btn = document.getElementById("btn-admin-approve-cancel");
            if (btn) btn.disabled = true;

            const targetRefundStatus = isRefundApplicable ? "refund_processing" : "not_applicable";
            const targetPaymentStatus = isRefundApplicable ? "refund_processing" : order.payment_status;

            let rpcSuccess = false;
            try {
              const { data: rpcRes, error: rpcErr } = await client.rpc("admin_process_order_request", {
                p_request_id: activeReq.id,
                p_action: "approve",
                p_target_status: "approved",
                p_admin_notes: adminNote,
                p_refund_amount: refundAmt,
                p_refund_status: targetRefundStatus
              });
              if (!rpcErr && rpcRes?.success) rpcSuccess = true;
            } catch (_) {}

            if (!rpcSuccess) {
              try {
                await client.from("order_requests").update({
                  status: "approved",
                  admin_notes: adminNote,
                  refund_amount: refundAmt,
                  refund_status: targetRefundStatus,
                  updated_at: new Date().toISOString()
                }).eq("id", activeReq.id);
              } catch (_) {}

              try {
                await client.from("orders").update({
                  order_status: "cancelled",
                  payment_status: targetPaymentStatus,
                  updated_at: new Date().toISOString()
                }).eq("id", order.id);
              } catch (_) {}
            }

            updateRequestInBackups(activeReq.id, {
              status: "approved",
              admin_notes: adminNote,
              refund_amount: refundAmt,
              refund_status: targetRefundStatus
            });

            window.showToast("Cancellation approved! Order cancelled (refund marked processing).", "success");
            await loadOrder();
          });

          document.getElementById("btn-admin-reject-cancel")?.addEventListener("click", async () => {
            const adminNote = document.getElementById("admin-cancel-notes-input")?.value.trim() || "Cancellation declined by administrator. Order is already processed for dispatch.";
            const btn = document.getElementById("btn-admin-reject-cancel");
            if (btn) btn.disabled = true;

            try {
              await client.from("order_requests").update({
                status: "rejected",
                admin_notes: adminNote,
                updated_at: new Date().toISOString()
              }).eq("id", activeReq.id);
            } catch (_) {}

            try {
              await client.from("orders").update({
                order_status: "processing",
                updated_at: new Date().toISOString()
              }).eq("id", order.id);
            } catch (_) {}

            updateRequestInBackups(activeReq.id, {
              status: "rejected",
              admin_notes: adminNote
            });

            window.showToast("Cancellation rejected. Order status set to processing.", "info");
            await loadOrder();
          });
        } else if (isRefundApplicable && (order.payment_status === "refund_processing" || activeReq.refund_status === "refund_processing")) {
          actionsContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; width: 100%;">
              <div style="font-size: 0.84rem; color: #f59e0b;">
                ⏳ <strong>Cancellation Approved.</strong> Refund of ${window.formatINR(refundAmt)} is pending disbursement.
              </div>
              <button type="button" id="btn-admin-disburse-refund" class="btn-admin-success" style="padding: 8px 18px; font-size: 0.84rem; background: #059669; color: #fff; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                <i class="fas fa-money-bill-wave"></i> Mark Refund Completed
              </button>
            </div>
          `;

          document.getElementById("btn-admin-disburse-refund")?.addEventListener("click", async () => {
            const btn = document.getElementById("btn-admin-disburse-refund");
            if (btn) btn.disabled = true;

            try {
              await client.from("order_requests").update({
                refund_status: "refunded",
                updated_at: new Date().toISOString()
              }).eq("id", activeReq.id);
            } catch (_) {}

            try {
              await client.from("orders").update({
                payment_status: "refunded",
                updated_at: new Date().toISOString()
              }).eq("id", order.id);
            } catch (_) {}

            updateRequestInBackups(activeReq.id, { refund_status: "refunded" });
            window.showToast("Refund marked completed and disbursed!", "success");
            await loadOrder();
          });
        } else {
          actionsContainer.innerHTML = `
            <div style="font-size: 0.84rem; color: var(--admin-text-muted);">
              Request resolved. Current Order Status: <strong style="color:#fff;">${order.order_status}</strong> &bull; Payment: <strong style="color:#fff;">${order.payment_status}</strong>
            </div>
          `;
        }
      }
      return;
    }

    // RETURN REQUEST VIEW
    if (returnReqs.length > 0 || isReturnStatus) {
      const activeReturn = returnReqs[0] || {
        id: "synth_return_" + order.id,
        order_id: order.id,
        request_type: "return",
        reason: "Customer requested return",
        status: "requested",
        refund_amount: 0,
        refund_status: "pending",
        created_at: order.updated_at || order.created_at
      };

      if (typeIcon) typeIcon.textContent = "↩️";
      if (cardTitle) {
        cardTitle.textContent = `Customer Return Request (${returnReqs.length > 0 ? returnReqs.length : 1} Item${returnReqs.length > 1 ? 's' : ''})`;
        cardTitle.style.color = "#818cf8";
      }

      if (statusBadge) {
        statusBadge.style.background = "rgba(99, 102, 241, 0.2)";
        statusBadge.style.color = "#818cf8";
        statusBadge.textContent = (activeReturn.status || "requested").toUpperCase();
      }

      const returnedItemIds = new Set(returnReqs.map(r => r.order_item_id).filter(Boolean));
      const returnedItems = (order.order_items || []).filter(item => returnedItemIds.size === 0 || returnedItemIds.has(item.id));
      const totalReturnRefund = returnReqs.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0);

      const itemsListHtml = returnedItems.map(item => `
        <div style="display:flex; align-items:center; gap: 10px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.84rem;">
          <img src="${item.product_image || 'https://via.placeholder.com/36'}" style="width: 36px; height: 36px; border-radius: 6px; object-fit: cover;">
          <div style="flex:1;">
            <strong style="color: #fff;">${item.product_name}</strong>
            <div style="color: var(--admin-text-muted); font-size: 0.74rem;">Qty: ${item.quantity} ${item.selected_size ? '• Size: ' + item.selected_size : ''}</div>
          </div>
          <strong style="color: #fff;">${window.formatINR(item.subtotal || (item.price * item.quantity))}</strong>
        </div>
      `).join("");

      let photosHtml = "";
      const allImages = returnReqs.flatMap(r => Array.isArray(r.images) ? r.images : []).filter(Boolean);
      if (allImages.length > 0) {
        photosHtml = `
          <div style="margin-top: 10px;">
            <span style="font-size: 0.75rem; color: var(--admin-text-muted); text-transform: uppercase;">Customer Evidence / Photos:</span>
            <div style="display:flex; gap: 8px; margin-top: 6px; flex-wrap: wrap;">
              ${allImages.map(imgSrc => `
                <a href="${imgSrc}" target="_blank" title="View full image">
                  <img src="${imgSrc}" style="width: 56px; height: 56px; border-radius: 6px; object-fit: cover; border: 1px solid rgba(255,255,255,0.15); transition: transform 0.2s;">
                </a>
              `).join("")}
            </div>
          </div>
        `;
      }

      if (detailsContainer) {
        const customerDisplay = `${escapeHTML(order.customer_name || order.shipping_name || 'Customer')} (${escapeHTML(order.customer_phone || order.shipping_phone || 'No phone')} &bull; ${escapeHTML(order.customer_email || order.shipping_email || 'No email')})`;

        detailsContainer.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-bottom: 12px;">
            <div>
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase;">Request ID:</span>
              <div style="font-weight: 700; font-size: 0.86rem; color: #818cf8; word-break: break-all;">${escapeHTML(activeReturn.id)}</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase;">Order Number / ID:</span>
              <div style="font-weight: 700; font-size: 0.86rem; color: #fff;">#${escapeHTML(order.order_number)} <span style="font-size:0.75rem; color: var(--admin-text-muted);">(${order.id.slice(0, 8)}...)</span></div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase;">Customer:</span>
              <div style="font-size: 0.84rem; color: #fff;">${customerDisplay}</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase;">Request Type:</span>
              <div style="font-weight: 700; font-size: 0.88rem; color: #818cf8;">Return Request</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase;">Reason:</span>
              <div style="font-weight: 700; font-size: 0.88rem; color: #fff;">${escapeHTML(activeReturn.reason || 'Customer Return')}</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase;">Requested On:</span>
              <div style="font-size: 0.84rem; color: #fff;">${new Date(activeReturn.created_at).toLocaleString("en-IN")}</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase;">Current Status:</span>
              <div style="font-size: 0.84rem; color: #fff;">
                <span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #818cf8; font-weight: 700;">${(activeReturn.status || 'requested').toUpperCase()}</span>
                &bull; Refund: <span class="badge" style="background: ${activeReturn.refund_status === 'refunded' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; color: ${activeReturn.refund_status === 'refunded' ? '#10b981' : '#f59e0b'}; font-weight: 700;">${(activeReturn.refund_status || 'pending').toUpperCase()}</span>
              </div>
            </div>
          </div>
          ${activeReturn.description ? `
            <div style="margin-bottom: 10px; padding: 10px 14px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
              <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase; font-weight: 700;">Customer Description:</span>
              <div style="font-size: 0.86rem; color: #fff; margin-top: 4px; line-height: 1.4;">${escapeHTML(activeReturn.description)}</div>
            </div>
          ` : ''}
          <div style="margin-bottom: 12px;">
            <span style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase; font-weight: 700;">Product(s) in Return Request:</span>
            <div style="margin-top: 6px;">${itemsListHtml}</div>
          </div>
          ${photosHtml}
          <div style="margin-top: 10px; padding: 10px 14px; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.25); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <strong style="color: #818cf8;">Refund Calculation:</strong>
              <span style="color: #fff; font-weight: 700; margin-left: 6px;">${totalReturnRefund > 0 ? window.formatINR(totalReturnRefund) : '₹0 (Zero advance COD or pending review)'}</span>
            </div>
            <span class="badge badge-indigo">Refund Status: ${activeReturn.refund_status || 'pending'}</span>
          </div>
          ${activeReturn.admin_notes ? `
            <div style="margin-top: 10px; padding: 8px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; font-size: 0.82rem;">
              <strong style="color: #818cf8;">Admin Log:</strong> <span style="color: #fff;">${escapeHTML(activeReturn.admin_notes)}</span>
            </div>
          ` : ''}
        `;
      }

      if (actionsContainer) {
        actionsContainer.innerHTML = `
          <div style="display: flex; flex-direction: column; width: 100%; gap: 10px;">
            <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
              <select id="select-return-lifecycle" class="admin-select" style="min-width: 180px;">
                <option value="requested" ${activeReturn.status === 'requested' ? 'selected' : ''}>Requested (Under Review)</option>
                <option value="approved" ${activeReturn.status === 'approved' ? 'selected' : ''}>Approve Return (Pickup to schedule)</option>
                <option value="pickup_scheduled" ${activeReturn.status === 'pickup_scheduled' ? 'selected' : ''}>Pickup Scheduled</option>
                <option value="in_transit" ${activeReturn.status === 'in_transit' ? 'selected' : ''}>In Transit</option>
                <option value="received" ${activeReturn.status === 'received' ? 'selected' : ''}>Received & Inspected</option>
                <option value="refund_processing" ${activeReturn.status === 'refund_processing' ? 'selected' : ''}>Initiate Refund (Processing)</option>
                <option value="refunded" ${activeReturn.status === 'refunded' ? 'selected' : ''}>Refund Disbursed & Completed</option>
                <option value="rejected" ${activeReturn.status === 'rejected' ? 'selected' : ''}>Reject Return</option>
              </select>
              <input type="text" id="admin-return-notes-input" class="admin-input" placeholder="Admin note for customer / logistics partner..." style="flex: 1; min-width: 220px; font-size: 0.84rem;">
              <button type="button" id="btn-update-return-status" class="btn-admin-primary" style="padding: 8px 18px; font-size: 0.84rem;">
                Update Return Status
              </button>
            </div>
          </div>
        `;

        document.getElementById("btn-update-return-status")?.addEventListener("click", async () => {
          const targetStatus = document.getElementById("select-return-lifecycle")?.value;
          const adminNote = document.getElementById("admin-return-notes-input")?.value.trim() || `Return status updated to ${targetStatus}`;
          const btn = document.getElementById("btn-update-return-status");
          if (btn) btn.disabled = true;

          const reqIds = returnReqs.length > 0 ? returnReqs.map(r => r.id) : [activeReturn.id];
          const willRefund = targetStatus === "refunded";
          const isProcessingRefund = targetStatus === "refund_processing";

          for (const rId of reqIds) {
            const nextRefundStatus = willRefund ? "refunded" : isProcessingRefund ? "refund_processing" : (activeReturn.refund_status || "pending");
            try {
              await client.from("order_requests").update({
                status: targetStatus,
                admin_notes: adminNote,
                refund_status: nextRefundStatus,
                updated_at: new Date().toISOString()
              }).eq("id", rId);
            } catch (_) {}

            updateRequestInBackups(rId, {
              status: targetStatus,
              admin_notes: adminNote,
              refund_status: nextRefundStatus
            });
          }

          if (willRefund) {
            try {
              await client.from("orders").update({
                order_status: "returned",
                payment_status: "refunded",
                updated_at: new Date().toISOString()
              }).eq("id", order.id);
            } catch (_) {}
          } else if (isProcessingRefund) {
            try {
              await client.from("orders").update({
                payment_status: "refund_processing",
                updated_at: new Date().toISOString()
              }).eq("id", order.id);
            } catch (_) {}
          } else if (targetStatus === "rejected") {
            try {
              await client.from("orders").update({
                order_status: "delivered",
                updated_at: new Date().toISOString()
              }).eq("id", order.id);
            } catch (_) {}
          }

          window.showToast(`Return status updated to "${targetStatus}".`, "success");
          await loadOrder();
        });
      }
    }
  }

  if (btnUpdateStatus) {
    btnUpdateStatus.addEventListener("click", async () => {
      const newStatus = selectStatus.value;
      btnUpdateStatus.disabled = true;
      btnUpdateStatus.textContent = "Updating...";

      const { error } = await client
        .from("orders")
        .update({ order_status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (error) {
        alert("Failed to update status: " + error.message);
      } else {
        window.showToast(`Order status updated to "${newStatus}". Reflects live on customer account.`, "success");
      }
      btnUpdateStatus.disabled = false;
      btnUpdateStatus.textContent = "Update Status";
    });
  }

  // ==========================================================================
  // COURIER & SHIPMENT TRACKING SYNC
  // ==========================================================================
  const selectCourier = document.getElementById("select-delivery-courier");
  const inputTrackingId = document.getElementById("input-tracking-id");
  const inputTrackingEta = document.getElementById("input-tracking-eta");
  const previewWrap = document.getElementById("tracking-preview-wrap");
  const linkPreview = document.getElementById("link-preview-tracking");
  const btnSaveTracking = document.getElementById("btn-save-tracking");

  let deliveryPartners = [];

  async function loadDeliveryPartners() {
    const { data, error } = await client.from("delivery_partners").select("*").order("display_order", { ascending: true });
    if (!error && data) {
      deliveryPartners = data;
      if (selectCourier) {
        selectCourier.innerHTML = '<option value="">-- Select Courier Partner --</option>' +
          deliveryPartners.map(p => `<option value="${p.id}">${p.name} (${p.badge_text || 'Standard'})</option>`).join("");
      }
    }
  }

  function getTrackingUrl(partner, trackingId) {
    if (!partner || !trackingId) return "";
    const template = partner.tracking_url_template || "";
    if (template.includes("{TRACK_ID}")) {
      return template.replace("{TRACK_ID}", encodeURIComponent(trackingId));
    } else if (template.includes("{tracking_id}")) {
      return template.replace("{tracking_id}", encodeURIComponent(trackingId));
    } else if (template.includes("{tracking_number}")) {
      return template.replace("{tracking_number}", encodeURIComponent(trackingId));
    } else if (template.startsWith("http")) {
      return template + encodeURIComponent(trackingId);
    }
    return `https://www.google.com/search?q=${encodeURIComponent(partner.name + " tracking " + trackingId)}`;
  }

  function updateTrackingPreview() {
    if (!previewWrap || !linkPreview || !selectCourier || !inputTrackingId) return;
    const partnerId = selectCourier.value;
    const partner = deliveryPartners.find(p => p.id === partnerId);
    const trackingId = inputTrackingId.value.trim();

    if (partner && trackingId) {
      const url = getTrackingUrl(partner, trackingId);
      linkPreview.href = url;
      linkPreview.innerHTML = `Track package with ${partner.name} (${trackingId}) <i class="fas fa-external-link-alt"></i>`;
      previewWrap.style.display = "block";
    } else {
      previewWrap.style.display = "none";
    }
  }

  async function initTracking(order) {
    await loadDeliveryPartners();

    let existingTracking = null;
    try {
      const { data: settingsRow } = await client
        .from("store_settings")
        .select("value")
        .eq("key", "order_tracking")
        .maybeSingle();

      if (settingsRow && settingsRow.value && settingsRow.value[orderId]) {
        existingTracking = settingsRow.value[orderId];
      }
    } catch (e) {
      console.warn("Tracking fetch notice:", e);
    }

    if (existingTracking) {
      if (selectCourier && existingTracking.courier_id) {
        selectCourier.value = existingTracking.courier_id;
      }
      if (inputTrackingId && existingTracking.tracking_id) {
        inputTrackingId.value = existingTracking.tracking_id;
      }
      if (inputTrackingEta && existingTracking.estimated_delivery) {
        inputTrackingEta.value = existingTracking.estimated_delivery;
      }
    } else if (order.estimated_delivery) {
      if (inputTrackingEta) {
        inputTrackingEta.value = order.estimated_delivery;
      }
    }

    updateTrackingPreview();

    if (selectCourier) selectCourier.addEventListener("change", updateTrackingPreview);
    if (inputTrackingId) inputTrackingId.addEventListener("input", updateTrackingPreview);
  }

  if (btnSaveTracking) {
    btnSaveTracking.addEventListener("click", async () => {
      const partnerId = selectCourier ? selectCourier.value : "";
      const partner = deliveryPartners.find(p => p.id === partnerId);
      const trackingId = inputTrackingId ? inputTrackingId.value.trim() : "";
      const eta = inputTrackingEta ? inputTrackingEta.value.trim() : "";

      if (!partnerId) {
        alert("Please select a delivery courier partner.");
        return;
      }
      if (!trackingId) {
        alert("Please enter the AWB / Tracking ID.");
        return;
      }

      btnSaveTracking.disabled = true;
      btnSaveTracking.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;

      try {
        const trackingUrl = getTrackingUrl(partner, trackingId);
        const trackingPayload = {
          courier_id: partner.id,
          courier_name: partner.name,
          tracking_id: trackingId,
          tracking_url: trackingUrl,
          estimated_delivery: eta || "3-5 Business Days",
          updated_at: new Date().toISOString()
        };

        // 1. Dual-write into store_settings (order_tracking)
        const { data: existingSettings } = await client
          .from("store_settings")
          .select("value")
          .eq("key", "order_tracking")
          .maybeSingle();

        const currentMap = (existingSettings && existingSettings.value) ? existingSettings.value : {};
        currentMap[orderId] = trackingPayload;

        await client.from("store_settings").upsert({
          key: "order_tracking",
          value: currentMap,
          updated_at: new Date().toISOString()
        });

        // 2. Dual-write into orders (estimated_delivery)
        // Write tracking directly to the target order row (isolated to order owner)
        const displayEta = eta ? `${partner.name}: ${trackingId} (ETA: ${eta})` : `${partner.name}: ${trackingId}`;
        await client.from("orders").update({
          tracking_data: trackingPayload,
          estimated_delivery: displayEta,
          updated_at: new Date().toISOString()
        }).eq("id", orderId);

        window.showToast("Courier & Tracking information saved! Live on customer account.", "success");
        updateTrackingPreview();
      } catch (err) {
        alert("Error saving tracking: " + err.message);
      } finally {
        btnSaveTracking.disabled = false;
        btnSaveTracking.innerHTML = `<i class="fas fa-save"></i> Save Tracking Information`;
      }
    });
  }

  // --- DELETE ORDER HANDLER ---
  const btnDeleteOrderDetail = document.getElementById("btn-delete-order-detail");
  const deleteModal = document.getElementById("delete-order-modal");
  const deleteModalBackdrop = document.getElementById("delete-order-backdrop");
  const deleteModalCloseBtn = document.getElementById("btn-close-delete-modal");
  const deleteCancelBtn = document.getElementById("btn-cancel-delete-order");
  const deleteConfirmBtn = document.getElementById("btn-confirm-delete-order");
  const deleteOrderNumDisplay = document.getElementById("delete-order-number-display");

  function openDeleteModal() {
    if (deleteOrderNumDisplay && elOrderNum) {
      deleteOrderNumDisplay.textContent = elOrderNum.textContent || `#${orderId}`;
    }
    if (deleteModal) {
      deleteModal.classList.add("show");
    }
  }

  function closeDeleteModal() {
    if (deleteModal) {
      deleteModal.classList.remove("show");
    }
    if (deleteConfirmBtn) {
      deleteConfirmBtn.disabled = false;
      deleteConfirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> <span>Delete Order</span>';
    }
  }

  async function executeDeleteOrder() {
    if (!orderId) return;
    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Removing...</span>';

    // Ensure admin profile sync
    try {
      const { data: { user } } = await client.auth.getUser();
      if (user && (user.user_metadata?.role === "admin" || user.app_metadata?.role === "admin")) {
        const { data: prof } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
        if (!prof || prof.role !== "admin") {
          await client.from("profiles").upsert({
            id: user.id,
            role: "admin",
            full_name: user.user_metadata?.full_name || "Administrator",
            email: user.email
          }, { onConflict: "id" });
        }
      }
    } catch (_) {}

    let success = false;
    let lastError = null;

    try {
      // 1. Fetch current tracking_data to avoid overwriting any existing courier/tracking info
      const { data: ordRow } = await client
        .from("orders")
        .select("tracking_data")
        .eq("id", orderId)
        .maybeSingle();

      const currentTracking = (ordRow && ordRow.tracking_data && typeof ordRow.tracking_data === "object")
        ? { ...ordRow.tracking_data }
        : {};

      currentTracking.admin_hidden = true;
      currentTracking.admin_hidden_at = new Date().toISOString();

      // Non-destructive update: marks order as hidden from Admin view
      const { error: updErr } = await client
        .from("orders")
        .update({
          tracking_data: currentTracking,
          updated_at: new Date().toISOString()
        })
        .eq("id", orderId);

      if (updErr) {
        console.warn("Order tracking_data admin_hidden update notice:", updErr);
        lastError = updErr;
      } else {
        success = true;
      }

      // 2. Synchronize with store_settings order_metadata backup
      try {
        const { data: metaRow } = await client
          .from("store_settings")
          .select("value")
          .eq("key", "order_metadata")
          .maybeSingle();

        const currentMeta = (metaRow && metaRow.value && typeof metaRow.value === "object")
          ? { ...metaRow.value }
          : {};

        if (!currentMeta[orderId]) currentMeta[orderId] = {};
        currentMeta[orderId].admin_hidden = true;
        currentMeta[orderId].admin_hidden_at = new Date().toISOString();

        await client
          .from("store_settings")
          .upsert({ key: "order_metadata", value: currentMeta }, { onConflict: "key" });
      } catch (_) {}

    } catch (ex) {
      console.error("Non-destructive admin order hide exception:", ex);
      lastError = ex;
    }

    if (success) {
      if (typeof window.showToast === "function") {
        window.showToast("Order removed from Admin view.", "success");
      }
      setTimeout(() => {
        window.location.href = "orders.html";
      }, 400);
    } else {
      console.error("Failed to remove order from Admin view:", lastError);
      deleteConfirmBtn.disabled = false;
      deleteConfirmBtn.innerHTML = '<i class="fas fa-trash-alt"></i> <span>Delete Order</span>';
      if (typeof window.showToast === "function") {
        window.showToast("Failed to remove order. Please try again.", "error");
      } else {
        alert("Failed to remove order. Please try again.");
      }
    }
  }

  if (btnDeleteOrderDetail) btnDeleteOrderDetail.addEventListener("click", openDeleteModal);
  if (deleteModalCloseBtn) deleteModalCloseBtn.addEventListener("click", closeDeleteModal);
  if (deleteCancelBtn) deleteCancelBtn.addEventListener("click", closeDeleteModal);
  if (deleteModal) {
    deleteModal.addEventListener("click", e => {
      if (e.target === deleteModal) closeDeleteModal();
    });
  }
  if (deleteConfirmBtn) deleteConfirmBtn.addEventListener("click", executeDeleteOrder);

  window.addEventListener("keydown", e => {
    if (e.key === "Escape" && deleteModal?.classList.contains("show")) {
      closeDeleteModal();
    }
  });

  await loadOrder();
  const { data: currentOrder } = await client.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (currentOrder) {
    await initTracking(currentOrder);
  }
});
