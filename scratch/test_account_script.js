
    let isAccountInitialized = false;

    async function initAccountPage() {
      if (isAccountInitialized) return;
      isAccountInitialized = true;

      // Elements
      const avatarCircle = document.getElementById("account-avatar-circle");
      const userNameElem = document.getElementById("account-user-name");
      const userEmailElem = document.getElementById("account-user-email");
      const nameInput = document.getElementById("profile-name-input");
      const emailInput = document.getElementById("profile-email-input");
      const phoneInput = document.getElementById("profile-phone-input");
      const saveBtn = document.getElementById("btn-save-profile");
      const loadingIndicator = document.getElementById("profile-loading-indicator");
      const statusMsg = document.getElementById("profile-status-message");
      const ordersContainer = document.getElementById("orders-list-container");
      const addressesContainer = document.getElementById("addresses-container");
      let orderChannel = null;

      function showStatus(text, type) {
        if (!statusMsg) return;
        statusMsg.style.display = "block";
        statusMsg.textContent = text;
        if (type === "success") {
          statusMsg.style.background = "rgba(16, 185, 129, 0.1)";
          statusMsg.style.color = "#059669";
          statusMsg.style.border = "1px solid rgba(16, 185, 129, 0.2)";
        } else if (type === "error") {
          statusMsg.style.background = "rgba(239, 68, 68, 0.1)";
          statusMsg.style.color = "#dc2626";
          statusMsg.style.border = "1px solid rgba(239, 68, 68, 0.2)";
        } else {
          statusMsg.style.background = "rgba(99, 102, 241, 0.1)";
          statusMsg.style.color = "#4f46e5";
          statusMsg.style.border = "1px solid rgba(99, 102, 241, 0.2)";
        }
        setTimeout(() => {
          if (statusMsg) statusMsg.style.display = "none";
        }, 5000);
      }

      // Security: HTML escaping helper to eliminate XSS vectors
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

      // 1. Tab Switching Setup (Bound immediately so navigation always works)
      const tabBtns = document.querySelectorAll(".account-tab-btn[data-tab]");
      const panels = {
        profile: document.getElementById("panel-profile"),
        orders: document.getElementById("panel-orders"),
        addresses: document.getElementById("panel-addresses")
      };

      function switchTab(tabKey) {
        tabBtns.forEach(btn => {
          btn.classList.toggle("active", btn.dataset.tab === tabKey);
        });
        Object.keys(panels).forEach(key => {
          if (panels[key]) panels[key].classList.toggle("active", key === tabKey);
        });
      }

      tabBtns.forEach(btn => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
      });

      function handleTabRouting() {
        const urlParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash;
        if (hash === "#orders" || urlParams.get("tab") === "orders") {
          switchTab("orders");
          setTimeout(() => {
            const panel = document.getElementById("panel-orders");
            if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 150);
        } else if (hash === "#addresses" || urlParams.get("tab") === "addresses") {
          switchTab("addresses");
        } else if (hash === "#profile" || urlParams.get("tab") === "profile") {
          switchTab("profile");
        }
      }

      handleTabRouting();
      window.addEventListener("hashchange", handleTabRouting);

      // Single Main Navigation Sign Out Button Handler
      const logoutBtn = document.getElementById("btn-account-logout");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          logoutBtn.disabled = true;
          const textSpan = logoutBtn.querySelector("span");
          if (textSpan) textSpan.textContent = "Signing out...";

          try {
            if (orderChannel && client && typeof client.removeChannel === "function") {
              try { client.removeChannel(orderChannel); } catch (_) {}
            }
            if (window.VeloraAuth && typeof window.VeloraAuth.logout === "function") {
              await window.VeloraAuth.logout();
            } else if (typeof getSupabaseClient === "function") {
              const c = await getSupabaseClient();
              if (c && c.auth) await c.auth.signOut();
            }
          } catch (err) {
            console.warn("Sign out notice:", err);
          } finally {
            localStorage.removeItem("velora_user_session");
            localStorage.removeItem("velora_last_order");
            window.location.href = "login.html";
          }
        });
      }

      // 2. Get Supabase client helper with retry
      async function getSupabaseClient() {
        let c = (window.VeloraAuth && typeof window.VeloraAuth.getClient === "function" && window.VeloraAuth.getClient()) || window.supabaseClient || (typeof window.getSupabase === "function" ? window.getSupabase() : null);
        if (c) return c;
        for (let i = 0; i < 40; i++) {
          await new Promise(r => setTimeout(r, 50));
          c = (window.VeloraAuth && typeof window.VeloraAuth.getClient === "function" && window.VeloraAuth.getClient()) || window.supabaseClient || (typeof window.getSupabase === "function" ? window.getSupabase() : null);
          if (c) return c;
        }
        return null;
      }

      const client = await getSupabaseClient();
      if (!client) {
        if (userNameElem) userNameElem.textContent = "Connection Error";
        if (userEmailElem) userEmailElem.textContent = "Supabase client not initialized";
        if (loadingIndicator) loadingIndicator.style.display = "none";
        showStatus("Could not initialize database connection. Please refresh.", "error");
        return;
      }

      // 3. Authenticate User with safe timeout
      async function getAuthenticatedUser(c, timeoutMs = 5000) {
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), timeoutMs));
        const authPromise = (async () => {
          try {
            const { data: sessionData } = await c.auth.getSession();
            if (sessionData && sessionData.session && sessionData.session.user) {
              return sessionData.session.user;
            }
            const { data: userData, error: userErr } = await c.auth.getUser();
            if (!userErr && userData && userData.user) {
              return userData.user;
            }
          } catch (err) {
            console.warn("Authentication check warning:", err);
          }
          return null;
        })();
        return Promise.race([authPromise, timeoutPromise]);
      }

      let authUser = await getAuthenticatedUser(client, 5000);

      if (!authUser) {
        const redirectTarget = encodeURIComponent("account.html" + window.location.search + window.location.hash);
        window.location.href = `login.html?redirect=${redirectTarget}`;
        return;
      }

      // 4. Fetch user profile from public.profiles table using user.id with UI state machine
      function setProfileUI(state, data) {
        if (state === "loading") {
          if (loadingIndicator) loadingIndicator.style.display = "flex";
          if (userNameElem) userNameElem.textContent = "Loading Profile...";
          if (userEmailElem) userEmailElem.textContent = "Connecting to Supabase...";
          if (avatarCircle) avatarCircle.textContent = "--";
        } else if (state === "success") {
          if (loadingIndicator) loadingIndicator.style.display = "none";
          const name = data.name || "VADI Member";
          const email = data.email || "";
          const phone = data.phone || "";
          const initials = data.initials || "ME";

          if (avatarCircle) avatarCircle.textContent = initials;
          if (userNameElem) userNameElem.textContent = name;
          if (userEmailElem) userEmailElem.textContent = email;

          if (nameInput) nameInput.value = (name !== "VADI Member" ? name : "");
          if (emailInput) emailInput.value = email;
          if (phoneInput) {
            phoneInput.value = phone;
            phoneInput.placeholder = phone ? "e.g. +91 98765 43210" : "Not added";
          }

          if (window.VeloraAuth && typeof window.VeloraAuth.updateNavbarAuth === "function") {
            window.VeloraAuth.updateNavbarAuth();
          }
        } else if (state === "error") {
          if (loadingIndicator) loadingIndicator.style.display = "none";
          const fallbackName = (authUser && authUser.user_metadata && (authUser.user_metadata.full_name || authUser.user_metadata.name))
            || (authUser && authUser.email ? authUser.email.split("@")[0] : "VADI Member");
          const fallbackEmail = (authUser && authUser.email) || "";
          let initials = "ME";
          if (fallbackName && fallbackName !== "VADI Member") {
            const parts = fallbackName.trim().split(/\s+/);
            initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
          } else if (fallbackEmail) {
            initials = fallbackEmail.substring(0, 2).toUpperCase();
          }

          if (avatarCircle) avatarCircle.textContent = initials;
          if (userNameElem) userNameElem.textContent = fallbackName;
          if (userEmailElem) userEmailElem.textContent = fallbackEmail;
          if (nameInput) nameInput.value = (fallbackName !== "VADI Member" ? fallbackName : "");
          if (emailInput) emailInput.value = fallbackEmail;

          showStatus(data && data.message ? data.message : "Unable to load profile. Please click to retry.", "error");
        }
      }

      async function fetchAndRenderProfile() {
        setProfileUI("loading");

        let profileData = null;
        let queryError = null;

        try {
          const fetchPromise = client
            .from("profiles")
            .select("id, full_name, email, phone, avatar_url, role")
            .eq("id", authUser.id)
            .maybeSingle();

          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Profile request timed out after 6 seconds")), 6000)
          );

          const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
          if (error) {
            queryError = error;
            console.error("Profile query error from Supabase:", error);
          } else if (data) {
            profileData = data;
          }
        } catch (err) {
          queryError = err;
          console.error("Profile fetch exception:", err);
        }

        // If profile record does not exist in profiles table (NO PROFILE state), create/insert it
        if (!profileData) {
          const fallbackName = (authUser.user_metadata && (authUser.user_metadata.full_name || authUser.user_metadata.name)) || "";
          const fallbackPhone = (authUser.user_metadata && authUser.user_metadata.phone) || "";

          // Attempt upsert only if query didn't throw an outright network/timeout error
          if (!queryError || (queryError.code === "PGRST116" || queryError.message.includes("0 rows"))) {
            try {
              const { data: inserted, error: insErr } = await client
                .from("profiles")
                .upsert([{
                  id: authUser.id,
                  full_name: fallbackName,
                  email: authUser.email,
                  phone: fallbackPhone,
                  role: "customer"
                }], { onConflict: "id" })
                .select("id, full_name, email, phone, avatar_url, role")
                .maybeSingle();

              if (!insErr && inserted) {
                profileData = inserted;
              } else if (insErr) {
                console.warn("Profile auto-creation warning:", insErr.message);
              }
            } catch (e) {
              console.warn("Auto-profile upsert exception:", e);
            }
          }

          if (!profileData) {
            profileData = {
              id: authUser.id,
              full_name: fallbackName,
              email: authUser.email,
              phone: fallbackPhone
            };
          }
        }

        // Determine correct full name, email, and phone
        const realName = (profileData && profileData.full_name && profileData.full_name.trim())
          || (authUser.user_metadata && (authUser.user_metadata.full_name || authUser.user_metadata.name))
          || (authUser.email ? authUser.email.split("@")[0] : "")
          || "VADI Member";

        const realEmail = authUser.email || (profileData && profileData.email) || "";
        const realPhone = (profileData && profileData.phone && profileData.phone.trim())
          || (authUser.user_metadata && authUser.user_metadata.phone)
          || "";

        // Calculate initials
        let initials = "ME";
        if (realName && realName !== "VADI Member") {
          const parts = realName.trim().split(/\s+/);
          initials = parts.length > 1
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : parts[0].substring(0, 2).toUpperCase();
        } else if (realEmail) {
          initials = realEmail.substring(0, 2).toUpperCase();
        }

        setProfileUI("success", {
          name: realName,
          email: realEmail,
          phone: realPhone,
          initials: initials
        });

        if (queryError) {
          console.warn("Profile loaded with fallback auth credentials due to query notice:", queryError.message);
        }
      }

      await fetchAndRenderProfile();

      // Listen for auth state change to refresh dynamically
      let authSubscription = null;
      try {
        const { data: authSub } = client.auth.onAuthStateChange(async (event, session) => {
          if (event === "SIGNED_OUT" || !session) {
            window.location.href = "login.html";
          } else if (event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
            authUser = session.user;
            await fetchAndRenderProfile();
          }
        });
        authSubscription = authSub && authSub.subscription;
      } catch (subErr) {
        console.warn("onAuthStateChange subscription notice:", subErr);
      }

      // 4. Save Profile Changes
      if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
          const newName = nameInput.value.trim();
          const newPhone = phoneInput.value.trim();

          if (newName.length < 2) {
            showStatus("Full Name must be at least 2 characters.", "error");
            return;
          }

          saveBtn.disabled = true;
          const originalText = saveBtn.querySelector(".btn-text") ? saveBtn.querySelector(".btn-text").textContent : saveBtn.textContent;
          if (saveBtn.querySelector(".btn-text")) saveBtn.querySelector(".btn-text").textContent = "Saving...";

          try {
            // Update Supabase profiles table
            const { error: profileUpdErr } = await client
              .from("profiles")
              .update({
                full_name: newName,
                phone: newPhone,
                updated_at: new Date().toISOString()
              })
              .eq("id", authUser.id);

            if (profileUpdErr) {
              console.warn("Profile update notice:", profileUpdErr);
            }

            // Update user metadata in Supabase Auth
            await client.auth.updateUser({
              data: { full_name: newName, phone: newPhone }
            });

            // Update local fields immediately
            if (userNameElem) userNameElem.textContent = newName;
            const newParts = newName.split(/\s+/);
            const newInitials = newParts.length > 1
              ? (newParts[0][0] + newParts[newParts.length - 1][0]).toUpperCase()
              : newParts[0].substring(0, 2).toUpperCase();
            if (avatarCircle) avatarCircle.textContent = newInitials;

            if (window.VeloraAuth && typeof window.VeloraAuth.updateNavbarAuth === "function") {
              window.VeloraAuth.updateNavbarAuth();
            }

            showStatus("Profile details updated successfully!", "success");
          } catch (err) {
            showStatus("Failed to update profile: " + (err.message || "Network error"), "error");
          } finally {
            saveBtn.disabled = false;
            if (saveBtn.querySelector(".btn-text")) saveBtn.querySelector(".btn-text").textContent = originalText;
          }
        });
      }

      // Cache of current orders and requests for modal population
      let dbOrdersCache = [];
      let userRequestsCache = [];

      function formatReturnStatus(status) {
        const map = {
          requested: "Requested",
          approved: "Approved",
          rejected: "Rejected",
          pickup_scheduled: "Pickup Scheduled",
          in_transit: "In Transit",
          received: "Received",
          refund_processing: "Refund Processing",
          refunded: "Refunded",
          closed: "Closed",
          cancelled: "Cancelled"
        };
        return map[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : "Requested");
      }

      let isRenderingOrders = false;
      let pendingRenderOrders = false;

      // 5. Render Orders History (from public.orders and public.order_requests)
      async function renderOrders() {
        if (!ordersContainer) return;
        if (isRenderingOrders) {
          pendingRenderOrders = true;
          return;
        }
        isRenderingOrders = true;

        if (!dbOrdersCache || dbOrdersCache.length === 0) {
          ordersContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">Loading your order history...</div>';
        }

        try {
          const orderCols = "id, order_number, total, subtotal, discount, shipping_charge, payment_method, payment_status, order_status, advance_amount, advance_paid, cod_balance, delivery_preference, free_gifts_eligible, free_gifts_items, is_full_online_payment, estimated_delivery, tracking_data, created_at, order_items(id, product_id, product_name, product_image, price, quantity, selected_size, selected_color, subtotal, catalog_type, sarojini_product_id, advance_amount, cod_balance)";
          
          let dbOrders = [];
          try {
            const { data, error } = await client
              .from("orders")
              .select(orderCols)
              .eq("user_id", authUser.id)
              .order("created_at", { ascending: false });

            if (error) {
              console.error("Orders fetch error:", {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
              });
              ordersContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Could not load orders at this time. (' + (error.message || "Database error") + ')</div>';
              return;
            }
            if (Array.isArray(data)) {
              dbOrders = data;
            }
          } catch (dbErr) {
            console.error("Orders query exception:", dbErr);
            ordersContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Could not load orders at this time.</div>';
            return;
          }

          // Fetch cancellation and return requests for this customer
          let userRequests = [];
          try {
            const { data: reqs } = await client
              .from("order_requests")
              .select("*")
              .eq("user_id", authUser.id);
            if (reqs && Array.isArray(reqs)) userRequests = reqs;
          } catch (e) {
            console.warn("order_requests table fetch notice:", e);
          }

          // Fallback to store_settings or localStorage if table was empty or not yet migrated
          if (userRequests.length === 0) {
            try {
              const { data: sRow } = await client.from("store_settings").select("value").eq("key", "order_requests").maybeSingle();
              if (sRow && sRow.value && Array.isArray(sRow.value)) {
                userRequests = sRow.value.filter(r => r.user_id === authUser.id);
              }
            } catch (_) {}
          }
          try {
            const localReqs = JSON.parse(localStorage.getItem("velora_order_requests") || "[]");
            if (Array.isArray(localReqs)) {
              const existingIds = new Set(userRequests.map(r => r.id));
              localReqs.forEach(lr => {
                if (lr.user_id === authUser.id && !existingIds.has(lr.id)) {
                  userRequests.push(lr);
                }
              });
            }
          } catch (_) {}

          // --- ORDER RECONCILIATION & DEDUPLICATION ENGINE ---
          // Rule 1: Authoritative source of truth is the Supabase database.
          // Rule 2: Exactly ONE order card per physical order (by canonical order_number / primary key id).
          // Rule 3: No card is EVER rendered with undefined/missing order ID.
          // Rule 4: If an order has multiple products, they MUST render as multiple items inside ONE card.

          let rawOrders = [...dbOrders];

          // Check if there is a pending recent order in localStorage not yet synced/persisted to Supabase
          try {
            const lastOrd = JSON.parse(localStorage.getItem("velora_last_order") || "null");
            if (lastOrd && (lastOrd.user_id === authUser.id || (lastOrd.customer && (lastOrd.customer.email === authUser.email || lastOrd.customer.id === authUser.id)))) {
              const rawOrdNum = (lastOrd.order_number || lastOrd.orderNumber || lastOrd.orderId || "").toString().trim();
              const rawOrdId = (lastOrd.id || rawOrdNum || "").toString().trim();

              // Check if already present in database orders list by order_number or primary key id
              const isAlreadyInDb = rawOrders.some(o => {
                const oNum = (o.order_number || o.orderNumber || o.orderId || "").toString().trim();
                const oId = (o.id || "").toString().trim();
                return (rawOrdNum && (oNum === rawOrdNum || oId === rawOrdNum)) ||
                       (rawOrdId && (oNum === rawOrdId || oId === rawOrdId));
              });

              if (isAlreadyInDb) {
                // Authoritative database already contains this order; clean up the local snapshot
                try { localStorage.removeItem("velora_last_order"); } catch (_) {}
              } else if (rawOrdNum && rawOrdNum !== "undefined" && rawOrdId && rawOrdId !== "undefined") {
                // Only prepend if it has a REAL, VALID, NON-EMPTY order ID not found in the database
                rawOrders.unshift({
                  id: rawOrdId,
                  order_number: rawOrdNum,
                  total: lastOrd.total,
                  subtotal: lastOrd.subtotal,
                  discount: lastOrd.discount || 0,
                  shipping_charge: lastOrd.shipping || 0,
                  payment_method: lastOrd.paymentMethod,
                  payment_status: lastOrd.payment_status || "pending",
                  order_status: lastOrd.status || "placed",
                  advance_amount: lastOrd.advance_amount || 0,
                  advance_paid: lastOrd.advance_paid || 0,
                  cod_balance: lastOrd.cod_balance || 0,
                  delivery_preference: lastOrd.delivery_preference || "Simple Delivery",
                  created_at: lastOrd.date || new Date().toISOString(),
                  order_items: (lastOrd.items || []).map(it => ({
                    id: it.id || `local-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    product_name: it.name,
                    product_image: it.image,
                    price: it.price,
                    quantity: it.quantity || 1,
                    selected_size: it.size || null,
                    selected_color: it.color || null,
                    subtotal: (it.price || 0) * (it.quantity || 1),
                    catalog_type: it.catalog_type || "main",
                    sarojini_product_id: it.catalog_type === "sarojini" ? it.id : null,
                    advance_amount: (it.advance_per_unit || 0) * (it.quantity || 1),
                    cod_balance: (it.cod_per_unit || 0) * (it.quantity || 1)
                  }))
                });
              }
            }
          } catch (_) {}

          // Consolidate into unique orders Map by canonical order identity
          const orderMap = new Map();

          for (const ord of rawOrders) {
            if (!ord) continue;

            // Resolve canonical order number and primary key
            const resolvedNumber = (ord.order_number || ord.orderNumber || ord.orderId || "").toString().trim();
            const resolvedId = (ord.id || "").toString().trim();

            // Strictly reject malformed records with missing or "undefined" order ID
            if ((!resolvedNumber || resolvedNumber === "undefined") && (!resolvedId || resolvedId === "undefined")) {
              console.warn("Skipping malformed order record with missing or undefined order ID:", ord);
              continue;
            }

            const canonicalKey = (resolvedNumber && resolvedNumber !== "undefined") ? resolvedNumber : resolvedId;

            if (!orderMap.has(canonicalKey)) {
              // Create normalized order object
              const normalized = {
                ...ord,
                id: (resolvedId && resolvedId !== "undefined") ? resolvedId : canonicalKey,
                order_number: canonicalKey,
                order_items: Array.isArray(ord.order_items) ? [...ord.order_items] : []
              };
              orderMap.set(canonicalKey, normalized);
            } else {
              // Reconcile and consolidate duplicate records for the same order into ONE card
              const existing = orderMap.get(canonicalKey);

              // Update fields if the incoming record has authoritative database data
              if (resolvedId && (!existing.id || existing.id.startsWith("local-"))) {
                existing.id = resolvedId;
              }
              if (ord.order_status && existing.order_status === "placed") existing.order_status = ord.order_status;
              if (ord.payment_status && existing.payment_status === "pending") existing.payment_status = ord.payment_status;
              if (ord.created_at && !existing.created_at) existing.created_at = ord.created_at;

              // Consolidate order items so all items appear inside this one order card without duplicating
              if (Array.isArray(ord.order_items)) {
                const existingSignatures = new Set(
                  existing.order_items.map(it => it.id || `${it.product_name}::${it.selected_size}::${it.selected_color}::${it.price}`)
                );

                for (const item of ord.order_items) {
                  const sig = item.id || `${item.product_name}::${item.selected_size}::${item.selected_color}::${item.price}`;
                  if (!existingSignatures.has(sig)) {
                    existing.order_items.push(item);
                    existingSignatures.add(sig);
                  }
                }
              }
            }
          }

          const consolidatedOrders = Array.from(orderMap.values());

          // --- HISTORICAL & REALTIME ORDER ITEM IMAGE RESOLUTION PASS ---
          const itemsNeedingResolution = [];
          for (const ord of consolidatedOrders) {
            for (const item of (ord.order_items || [])) {
              let clean = (window.VeloraImageUtils && typeof window.VeloraImageUtils.extractImageUrl === 'function')
                ? window.VeloraImageUtils.extractImageUrl(item.product_image)
                : (item.product_image || "");

              if (!clean || clean === 'undefined' || clean === 'null') {
                itemsNeedingResolution.push(item);
              } else {
                item.product_image = clean;
              }
            }
          }

          if (itemsNeedingResolution.length > 0) {
            const isUuidFormat = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
            const sarojiniIds = Array.from(new Set(itemsNeedingResolution
              .filter(it => it.catalog_type === 'sarojini' || it.sarojini_product_id != null)
              .map(it => it.sarojini_product_id || it.product_id)
              .filter(id => isUuidFormat(id))));
            const mainIds = Array.from(new Set(itemsNeedingResolution
              .filter(it => it.catalog_type !== 'sarojini' && !it.sarojini_product_id)
              .map(it => it.product_id)
              .filter(id => isUuidFormat(id))));

            const imageLookup = new Map();

            if (sarojiniIds.length > 0) {
              try {
                const { data: sProds } = await client.from("sarojini_products").select("id, name, images").in("id", sarojiniIds);
                if (Array.isArray(sProds)) {
                  sProds.forEach(p => {
                    const img = (window.VeloraImageUtils && typeof window.VeloraImageUtils.resolveProductImage === 'function')
                      ? window.VeloraImageUtils.resolveProductImage(p, { isAdmin: false })
                      : (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : (p.image || ""));
                    if (img) {
                      imageLookup.set('sarojini:' + p.id, img);
                      if (p.name) imageLookup.set('sarojini_name:' + p.name, img);
                    }
                  });
                }
              } catch (_) {}
            }

            if (mainIds.length > 0) {
              try {
                const { data: mProds } = await client.from("products").select("id, name, images").in("id", mainIds);
                if (Array.isArray(mProds)) {
                  mProds.forEach(p => {
                    const img = (window.VeloraImageUtils && typeof window.VeloraImageUtils.resolveProductImage === 'function')
                      ? window.VeloraImageUtils.resolveProductImage(p, { isAdmin: false })
                      : (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : (p.image || ""));
                    if (img) {
                      imageLookup.set('main:' + p.id, img);
                      if (p.name) imageLookup.set('main_name:' + p.name, img);
                    }
                  });
                }
              } catch (_) {}
            }

            for (const item of itemsNeedingResolution) {
              const isSar = item.catalog_type === 'sarojini' || item.sarojini_product_id != null;
              const targetId = isSar ? (item.sarojini_product_id || item.product_id) : item.product_id;
              const prefix = isSar ? 'sarojini:' : 'main:';
              const namePrefix = isSar ? 'sarojini_name:' : 'main_name:';
              const found = (targetId && imageLookup.get(prefix + targetId)) || (item.product_name && imageLookup.get(namePrefix + item.product_name));
              if (found) {
                item.product_image = found;
              }
            }
          }

          dbOrdersCache = consolidatedOrders;
          userRequestsCache = userRequests || [];

          if (dbOrdersCache.length > 0) {
            ordersContainer.innerHTML = dbOrdersCache.map(ord => {
              const orderReqs = userRequestsCache.filter(r => r.order_id === ord.id);
              const cancelReq = orderReqs.find(r => r.request_type === "cancellation");
              const returnReqs = orderReqs.filter(r => r.request_type === "return");

              // Status calculation
              let displayStatus = ord.order_status === "placed" ? "Confirmed & In Process" : ord.order_status;
              let statusClass = "color: var(--accent);";
              if (ord.order_status === "delivered") {
                statusClass = "color: var(--color-success);";
                displayStatus = "Delivered";
              } else if (ord.order_status === "cancelled") {
                statusClass = "color: #dc2626;";
                displayStatus = "Order Cancelled";
              } else if (ord.order_status === "cancellation_requested") {
                statusClass = "color: #d97706;";
                displayStatus = "Cancellation Requested";
              } else if (ord.order_status === "return_requested") {
                statusClass = "color: #4f46e5;";
                displayStatus = "Return Requested";
              } else if (ord.order_status === "returned") {
                statusClass = "color: #059669;";
                displayStatus = "Returned & Refunded";
              }

              const isOrderSarojini = (ord.order_items || []).some(it => it.catalog_type === 'sarojini' || it.sarojini_product_id);

              const itemsHtml = (ord.order_items || []).map(item => {
                const isItemSarojini = item.catalog_type === 'sarojini' || item.sarojini_product_id;
                const itemAdv = Number(item.advance_amount || (ord.advance_paid ? (ord.advance_paid / (ord.order_items.length || 1)) : 0) || 0);
                const itemCod = Number(item.cod_balance || 0);

                let itemSplitText = '';
                if (itemAdv > 0) {
                  itemSplitText = ` • <span style="color:#e11d48; font-weight:700;">Adv. Paid: ₹${Math.round(itemAdv).toLocaleString('en-IN')}</span>` + 
                    (itemCod > 0 ? ` • <span style="color:#d97706; font-weight:600;">COD Bal: ₹${Math.round(itemCod).toLocaleString('en-IN')}</span>` : '');
                }

                const fallbackSvg = window.VeloraImageUtils ? window.VeloraImageUtils.getPlaceholderSvg() : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200';
                const resolvedItemImg = (window.VeloraImageUtils && typeof window.VeloraImageUtils.normalizeImageUrl === 'function')
                  ? window.VeloraImageUtils.normalizeImageUrl(item.product_image, { isAdmin: false, fallback: fallbackSvg })
                  : (item.product_image || fallbackSvg);

                return `
                  <div style="display:flex; align-items:center; gap:14px; padding: 10px 0; border-bottom: 1px dashed var(--border-light, #f1f5f9);">
                    <img src="${escapeHTML(resolvedItemImg)}" alt="${escapeHTML(item.product_name || 'Product')}" style="width:52px; height:52px; border-radius:8px; object-fit:cover; border:1px solid var(--border-color, #e2e8f0);" onerror="this.onerror=null; this.src='${fallbackSvg}';">
                    <div style="flex:1;">
                      <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                        <strong style="font-size:0.9rem; color:var(--text-main);">${escapeHTML(item.product_name || 'Item')}</strong>
                        ${isItemSarojini ? '<span style="background:rgba(225,29,72,0.1); color:#e11d48; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:4px; border:1px solid rgba(225,29,72,0.2);">🛍️ SAROJINI BAZAAR</span>' : ''}
                      </div>
                      <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">
                        ${item.selected_size ? 'Size: ' + escapeHTML(item.selected_size) : ''} • Qty: ${item.quantity || 1}${itemSplitText}
                      </div>
                    </div>
                    <div style="font-weight:800; color:var(--text-main); font-size:0.95rem;">₹${Math.round(item.subtotal || (item.price * (item.quantity || 1))).toLocaleString("en-IN")}</div>
                  </div>
                `;
              }).join("");

              const formattedDate = new Date(ord.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
              const hasAdvance = Number(ord.advance_paid || ord.advance_amount || 0) > 0;
              const advPaid = Number(ord.advance_paid || ord.advance_amount || 0);
              const codBal = Number(ord.cod_balance || 0);

              const isFullOnline = Boolean(
                ord.free_gifts_eligible || 
                ord.is_full_online_payment || 
                (ord.payment_method && ord.payment_method.includes("Full Online")) ||
                (ord.payment_status === "paid" && !hasAdvance && !ord.payment_method?.toLowerCase().includes("cash on delivery"))
              );
              const isDeliveryOpenBox = Boolean(
                ord.delivery_preference === "Open Box Delivery" || 
                (ord.payment_method && ord.payment_method.includes("Open Box"))
              );

              let badgesHtml = '';
              if (isOrderSarojini) {
                badgesHtml += `<span style="background: rgba(225, 29, 72, 0.12); color: #e11d48; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 4px; margin-left: 6px; border: 1px solid rgba(225, 29, 72, 0.3);">🛍️ SAROJINI BAZAAR</span>`;
              }
              if (isFullOnline && ord.free_gifts_eligible) {
                badgesHtml += `<span style="background: rgba(16, 185, 129, 0.15); color: #059669; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-left: 6px; border: 1px solid rgba(16, 185, 129, 0.3);">🎁 FREE GIFTS</span>`;
              }
              if (isDeliveryOpenBox) {
                badgesHtml += `<span style="background: rgba(2, 132, 199, 0.15); color: #0284c7; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-left: 6px; border: 1px solid rgba(2, 132, 199, 0.3);">📦 OPEN BOX</span>`;
              }

              // Active request status badges in header
              if (cancelReq) {
                if (cancelReq.status === "requested" || ord.order_status === "cancellation_requested") {
                  badgesHtml += `<span style="background: rgba(245, 158, 11, 0.15); color: #d97706; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-left: 6px; border: 1px solid rgba(245, 158, 11, 0.35);">⏳ Cancellation Requested</span>`;
                } else if (cancelReq.status === "approved" || ord.order_status === "cancelled") {
                  badgesHtml += `<span style="background: rgba(239, 68, 68, 0.12); color: #dc2626; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-left: 6px; border: 1px solid rgba(239, 68, 68, 0.3);">✕ Order Cancelled</span>`;
                } else if (cancelReq.status === "rejected") {
                  badgesHtml += `<span style="background: rgba(100, 116, 139, 0.15); color: #64748b; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-left: 6px; border: 1px solid rgba(100, 116, 139, 0.3);" title="${escapeHTML(cancelReq.admin_notes || 'Declined by store administrator')}">Cancellation Declined</span>`;
                }
              }

              if (returnReqs.length > 0) {
                returnReqs.forEach(rr => {
                  badgesHtml += `<span style="background: rgba(79, 70, 229, 0.12); color: #4f46e5; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-left: 6px; border: 1px solid rgba(79, 70, 229, 0.3);">↩️ Return: ${formatReturnStatus(rr.status)}</span>`;
                });
              }

              const advanceHtml = hasAdvance ? `
                <div style="margin-top: 10px; padding: 8px 12px; background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px; font-size: 0.8rem; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px;">
                  <span>⚡ Advance Paid: <strong style="color: #6366f1;">₹${Math.round(advPaid).toLocaleString("en-IN")}</strong> (Online ✓)</span>
                  <span>Balance on Delivery (COD): <strong style="color: #d97706;">₹${Math.round(codBal).toLocaleString("en-IN")}</strong></span>
                </div>
              ` : '';

              // Refund Summary Banner
              let refundInfoHtml = '';
              const isOrderCancelled = ord.order_status === "cancelled" || (cancelReq && cancelReq.status === "approved");
              const hasActiveReturn = returnReqs.length > 0;

              if (isOrderCancelled || hasActiveReturn) {
                const isRefunded = ord.payment_status === "refunded" || (cancelReq && cancelReq.refund_status === "refunded") || returnReqs.some(r => r.refund_status === "refunded");
                const isRefundProcessing = ord.payment_status === "refund_processing" || (cancelReq && cancelReq.refund_status === "refund_processing") || returnReqs.some(r => r.refund_status === "refund_processing");
                
                let refundStatusBadge = '';
                if (isRefunded) {
                  refundStatusBadge = '<span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 700; font-size: 0.75rem; padding: 3px 8px; border-radius: 4px;">✓ Refund Completed</span>';
                } else if (isRefundProcessing) {
                  refundStatusBadge = '<span class="badge" style="background: #e0e7ff; color: #4338ca; font-weight: 700; font-size: 0.75rem; padding: 3px 8px; border-radius: 4px;">⏳ Refund Processing</span>';
                } else {
                  refundStatusBadge = '<span class="badge" style="background: #fef3c7; color: #b45309; font-weight: 700; font-size: 0.75rem; padding: 3px 8px; border-radius: 4px;">⏳ Pending Approval</span>';
                }

                if (hasAdvance) {
                  refundInfoHtml = `
                    <div style="margin-top: 10px; padding: 10px 14px; background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; font-size: 0.82rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                      <div><span style="color: #059669; font-weight: 700;">💳 Eligible Refund:</span> <strong>₹${Math.round(advPaid).toLocaleString("en-IN")}</strong> <span style="font-size:0.75rem; color:#64748b;">(Prepaid Advance)</span></div>
                      ${refundStatusBadge}
                    </div>
                  `;
                } else if (isFullOnline) {
                  refundInfoHtml = `
                    <div style="margin-top: 10px; padding: 10px 14px; background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; font-size: 0.82rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                      <div><span style="color: #059669; font-weight: 700;">💳 Eligible Refund:</span> <strong>₹${Math.round(ord.total).toLocaleString("en-IN")}</strong> <span style="font-size:0.75rem; color:#64748b;">(Full Online Payment)</span></div>
                      ${refundStatusBadge}
                    </div>
                  `;
                } else {
                  refundInfoHtml = `
                    <div style="margin-top: 10px; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.78rem; color: #64748b;">
                      <span>ℹ️ Cash on Delivery Order — zero advance was captured. No financial refund required.</span>
                    </div>
                  `;
                }
              }

              // Eligibility rules
              const canCancel = ["placed", "confirmed", "processing", "shipped", "out_for_delivery"].includes(ord.order_status) && (!cancelReq || cancelReq.status === "rejected");
              const isDelivered = ord.order_status === "delivered" || ord.order_status === "return_requested" || ord.order_status === "returned";
              const isWithin30Days = (Date.now() - new Date(ord.created_at).getTime()) <= (30 * 24 * 60 * 60 * 1000);
              const returnedItemIds = new Set(returnReqs.filter(r => r.order_item_id).map(r => r.order_item_id));
              const hasFullReturn = returnReqs.some(r => !r.order_item_id);
              const unreturnedItems = (ord.order_items || []).filter(item => !returnedItemIds.has(item.id));
              const canReturn = ord.order_status === "delivered" && isWithin30Days && !hasFullReturn && unreturnedItems.length > 0;

              // Action buttons HTML
              let actionButtonsHtml = `
                <button type="button" class="btn-track-order" data-order-id="${ord.id}" data-order-number="${ord.order_number}" data-order-status="${ord.order_status}" data-order-eta="${ord.estimated_delivery || ''}" style="background: #0f172a; color: #ffffff; border: none; padding: 7px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: background 0.2s;">
                  <span>🚚 Track Order</span>
                </button>
              `;

              // Cancellation button / status
              if (cancelReq && (cancelReq.status === "requested" || ord.order_status === "cancellation_requested")) {
                actionButtonsHtml += `
                  <button type="button" disabled style="background: rgba(245, 158, 11, 0.1); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); padding: 7px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: default; display: inline-flex; align-items: center; gap: 6px;">
                    <span>⏳ Cancellation Requested</span>
                  </button>
                `;
              } else if (isOrderCancelled) {
                actionButtonsHtml += `
                  <button type="button" disabled style="background: rgba(239, 68, 68, 0.08); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.25); padding: 7px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: default; display: inline-flex; align-items: center; gap: 6px;">
                    <span>✕ Order Cancelled</span>
                  </button>
                `;
              } else if (canCancel) {
                actionButtonsHtml += `
                  <button type="button" class="btn-cancel-order" data-order-id="${ord.id}" data-order-number="${ord.order_number}" data-order-total="${ord.total}" style="background: rgba(239, 68, 68, 0.08); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3); padding: 7px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                    <span>✕ Cancel Order</span>
                  </button>
                `;
              }

              // Return button / status
              if (returnReqs.length > 0) {
                returnReqs.forEach(rr => {
                  actionButtonsHtml += `
                    <button type="button" disabled style="background: rgba(79, 70, 229, 0.1); color: #4f46e5; border: 1px solid rgba(79, 70, 229, 0.3); padding: 7px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: default; display: inline-flex; align-items: center; gap: 6px;">
                      <span>↩️ Return: ${formatReturnStatus(rr.status)}</span>
                    </button>
                  `;
                });
              }
              if (canReturn) {
                actionButtonsHtml += `
                  <button type="button" class="btn-return-order" data-order-id="${ord.id}" data-order-number="${ord.order_number}" style="background: rgba(79, 70, 229, 0.08); color: #4f46e5; border: 1px solid rgba(79, 70, 229, 0.3); padding: 7px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                    <span>↩️ Return Order</span>
                  </button>
                `;
              }

              return `
                <div class="order-history-card" data-order-id="${ord.id}">
                  <div class="order-history-header">
                    <div>
                      <strong style="font-size: 0.95rem; color: var(--text-main);">${ord.order_number}</strong>
                      <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 8px;">Placed on ${formattedDate}</span>
                      ${badgesHtml}
                    </div>
                    <span style="font-size: 0.8rem; font-weight: 700; ${statusClass}">
                      ● ${displayStatus}
                    </span>
                  </div>
                  <div class="order-history-items">
                    ${itemsHtml}
                  </div>
                  ${advanceHtml}
                  ${refundInfoHtml}
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:12px; border-top:1px solid var(--border-light); flex-wrap: wrap; gap: 10px;">
                    <div>
                      <span style="font-size:0.85rem; color:var(--text-secondary);">Total Order: <strong style="color:var(--text-main); font-size:1rem;">₹${Math.round(ord.total).toLocaleString("en-IN")}</strong></span>
                      <span style="font-size:0.8rem; color:var(--text-muted); margin-left: 8px;">• ${ord.payment_method}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      ${actionButtonsHtml}
                    </div>
                  </div>
                </div>
              `;
            }).join("");
          } else {
            ordersContainer.innerHTML = `
              <div style="padding: 40px 20px; text-align: center; border: 1px dashed var(--border-color); border-radius: 12px; background: rgba(0,0,0,0.01);">
                <div style="font-size: 2rem; margin-bottom: 8px;">🛍️</div>
                <h4 style="font-size: 1rem; color: var(--text-main); margin-bottom: 6px;">No Orders Placed Yet</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 360px; margin: 0 auto 16px;">When you place an order, your items and tracking updates will appear right here.</p>
                <a href="shop.html" class="btn-auth-submit" style="display: inline-block; max-width: 180px; text-decoration: none; padding: 8px 16px; font-size: 0.85rem;">Start Shopping</a>
              </div>
            `;
          }
        } catch (err) {
          console.error("renderOrders exception:", err);
          ordersContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Could not load orders at this time.</div>';
        } finally {
          isRenderingOrders = false;
          if (pendingRenderOrders) {
            pendingRenderOrders = false;
            renderOrders();
          }
        }
      }

      // 6. Render Saved Addresses (from public.addresses)
      async function renderAddresses() {
        if (!addressesContainer) return;
        addressesContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">Loading saved addresses...</div>';

        try {
          const addrCols = "id, user_id, full_name, phone, house, street, landmark, city, state, country, pincode, address_type, is_default, created_at";
          const { data: dbAddresses, error } = await client
            .from("addresses")
            .select(addrCols)
            .eq("user_id", authUser.id)
            .order("is_default", { ascending: false });

          if (!error && dbAddresses && dbAddresses.length > 0) {
            addressesContainer.innerHTML = dbAddresses.map(addr => `
              <div class="address-box ${addr.is_default ? 'is-default' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                  <strong style="font-size: 0.95rem; color: var(--text-main);">${escapeHTML(addr.address_type || 'Delivery')} Address</strong>
                  ${addr.is_default ? '<span class="pm-badge">Default</span>' : ''}
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">
                  <strong>${escapeHTML(addr.full_name || '')}</strong><br>
                  ${escapeHTML(addr.house || '')}, ${escapeHTML(addr.street || '')}${addr.landmark ? ', ' + escapeHTML(addr.landmark) : ''}<br>
                  ${escapeHTML(addr.city || '')}, ${escapeHTML(addr.state || '')} ${escapeHTML(addr.pincode || '')}, ${escapeHTML(addr.country || 'India')}<br>
                  ${addr.phone ? 'Phone: ' + escapeHTML(addr.phone) : ''}
                </div>
              </div>
            `).join("");
          } else {
            addressesContainer.innerHTML = `
              <div style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; border: 1px dashed var(--border-color); border-radius: 12px; background: rgba(0,0,0,0.01);">
                <div style="font-size: 2rem; margin-bottom: 8px;">📍</div>
                <h4 style="font-size: 1rem; color: var(--text-main); margin-bottom: 6px;">No Saved Addresses</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 360px; margin: 0 auto 16px;">Delivery addresses you provide during checkout will be saved here for rapid reordering.</p>
                <a href="shop.html" class="btn-auth-submit" style="display: inline-block; max-width: 180px; text-decoration: none; padding: 8px 16px; font-size: 0.85rem;">Browse Shop</a>
              </div>
            `;
          }
        } catch (err) {
          addressesContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Could not load addresses at this time.</div>';
        }
      }

      renderOrders();
      renderAddresses();

      // ========================================================================
      // ORDER TRACKING MODAL CONTROLLER
      // ========================================================================
      const trackingOverlay = document.getElementById("tracking-modal-overlay");
      const closeTrackingBtn = document.getElementById("btn-close-tracking-modal");
      const trackOrderNum = document.getElementById("track-modal-order-number");
      const trackStatusText = document.getElementById("track-modal-status-text");
      const trackEtaText = document.getElementById("track-modal-eta-text");
      const timelineProgressBar = document.getElementById("timeline-progress-bar");
      const trackCourierName = document.getElementById("track-modal-courier-name");
      const trackCourierBadge = document.getElementById("track-modal-courier-badge");
      const trackAwb = document.getElementById("track-modal-awb");
      const copyAwbBtn = document.getElementById("btn-copy-tracking-id");
      const trackPortalLink = document.getElementById("track-modal-portal-link");

      async function openTrackingModal(orderId, orderNum, status, fallbackEta) {
        if (!trackingOverlay) return;

        if (trackOrderNum) trackOrderNum.textContent = `Order #${orderNum}`;
        const normStatus = (status || "placed").toLowerCase();

        let displayStatus = "Placed & Verified";
        let step = 1;
        let progressPct = "0%";

        if (normStatus === "placed") {
          displayStatus = "Order Placed & Confirmed";
          step = 1;
          progressPct = "0%";
        } else if (normStatus === "processing" || normStatus === "confirmed") {
          displayStatus = "Processing in Atelier";
          step = 2;
          progressPct = "25%";
        } else if (normStatus === "shipped") {
          displayStatus = "Shipped & In Transit";
          step = 3;
          progressPct = "50%";
        } else if (normStatus === "out_for_delivery" || normStatus.includes("out")) {
          displayStatus = "Out for Doorstep Delivery";
          step = 4;
          progressPct = "75%";
        } else if (normStatus === "delivered") {
          displayStatus = "Successfully Delivered";
          step = 5;
          progressPct = "100%";
        } else if (normStatus === "cancellation_requested") {
          displayStatus = "Cancellation Requested";
          step = 1;
          progressPct = "20%";
        } else if (normStatus === "cancelled") {
          displayStatus = "Order Cancelled";
          step = 0;
          progressPct = "0%";
        } else if (normStatus === "return_requested") {
          displayStatus = "Return Requested - Pickup Pending";
          step = 5;
          progressPct = "100%";
        } else if (normStatus === "returned") {
          displayStatus = "Returned & Refunded";
          step = 5;
          progressPct = "100%";
        }

        if (trackStatusText) {
          trackStatusText.textContent = displayStatus;
          if (normStatus === "delivered" || normStatus === "returned") {
            trackStatusText.style.color = "#059669";
          } else if (normStatus === "cancelled") {
            trackStatusText.style.color = "#dc2626";
          } else if (normStatus === "cancellation_requested") {
            trackStatusText.style.color = "#d97706";
          } else if (normStatus === "return_requested") {
            trackStatusText.style.color = "#4f46e5";
          } else {
            trackStatusText.style.color = "#2563eb";
          }
        }

        // Update 5 timeline steps
        for (let i = 1; i <= 5; i++) {
          const stepEl = document.getElementById(`timeline-step-${i}`);
          if (!stepEl) continue;
          const circle = stepEl.querySelector(".step-circle");
          const label = stepEl.querySelector("span");

          if (i <= step) {
            if (circle) {
              circle.style.background = "#2563eb";
              circle.style.color = "#ffffff";
              circle.style.boxShadow = "0 0 0 4px #eff6ff";
              circle.innerHTML = "✓";
            }
            if (label) {
              label.style.color = "#0f172a";
              label.style.fontWeight = "700";
            }
          } else {
            if (circle) {
              circle.style.background = "#e2e8f0";
              circle.style.color = "#64748b";
              circle.style.boxShadow = "none";
              circle.innerHTML = `${i}`;
            }
            if (label) {
              label.style.color = "#64748b";
              label.style.fontWeight = "600";
            }
          }
        }
        if (timelineProgressBar) {
          timelineProgressBar.style.width = progressPct;
        }

        // Initial default view while fetching
        if (trackCourierName) trackCourierName.textContent = "Assigned Fulfillment Partner";
        if (trackCourierBadge) {
          trackCourierBadge.textContent = "In Transit";
          trackCourierBadge.style.background = "#e0e7ff";
          trackCourierBadge.style.color = "#4338ca";
        }
        if (trackAwb) trackAwb.textContent = "AWB will be assigned upon dispatch";
        if (trackEtaText) trackEtaText.textContent = fallbackEta || "3-5 Business Days";
        if (trackPortalLink) trackPortalLink.style.display = "none";

        // Instantly display the modal overlay
        trackingOverlay.classList.add("active");
        trackingOverlay.style.display = "flex";
        trackingOverlay.style.opacity = "1";
        trackingOverlay.style.visibility = "visible";
        trackingOverlay.style.pointerEvents = "auto";
        document.body.style.overflow = "hidden";

        // Asynchronously fetch specific courier tracking details strictly for this user's order
        try {
          const { data: ordRow } = await client
            .from("orders")
            .select("tracking_data, estimated_delivery")
            .eq("id", orderId)
            .eq("user_id", authUser.id)
            .maybeSingle();

          let trackingData = null;
          if (ordRow && ordRow.tracking_data && typeof ordRow.tracking_data === "object" && Object.keys(ordRow.tracking_data).length > 0) {
            trackingData = ordRow.tracking_data;
          }

          if (trackingData && trackingData.tracking_id) {
            if (trackCourierName) trackCourierName.textContent = trackingData.courier_name || "Express Courier Partner";
            if (trackCourierBadge) {
              trackCourierBadge.textContent = "Verified Live Tracking";
              trackCourierBadge.style.background = "#dcfce7";
              trackCourierBadge.style.color = "#15803d";
            }
            if (trackAwb) trackAwb.textContent = trackingData.tracking_id;
            if (trackEtaText) trackEtaText.textContent = trackingData.estimated_delivery || "3-5 Business Days";

            if (trackPortalLink) {
              if (trackingData.tracking_url) {
                trackPortalLink.href = trackingData.tracking_url;
                trackPortalLink.style.display = "inline-flex";
              } else {
                trackPortalLink.href = `https://www.google.com/search?q=${encodeURIComponent((trackingData.courier_name || 'Courier') + ' ' + trackingData.tracking_id)}`;
                trackPortalLink.style.display = "inline-flex";
              }
            }
          } else if (fallbackEta && fallbackEta.includes(":")) {
            const parts = fallbackEta.split(":");
            if (trackCourierName) trackCourierName.textContent = parts[0].trim();
            if (trackCourierBadge) {
              trackCourierBadge.textContent = "Express Carrier";
              trackCourierBadge.style.background = "#e0e7ff";
              trackCourierBadge.style.color = "#4338ca";
            }
            if (trackAwb) trackAwb.textContent = parts[1].trim();
            if (trackEtaText) trackEtaText.textContent = "In Transit";
            if (trackPortalLink) {
              trackPortalLink.href = `https://www.google.com/search?q=${encodeURIComponent(fallbackEta)}`;
              trackPortalLink.style.display = "inline-flex";
            }
          }
        } catch (e) {
          console.warn("Order tracking fetch notice:", e);
        }
      }

      function closeTrackingModal() {
        if (trackingOverlay) {
          trackingOverlay.classList.remove("active");
          trackingOverlay.style.display = "none";
          trackingOverlay.style.opacity = "0";
          trackingOverlay.style.visibility = "hidden";
          trackingOverlay.style.pointerEvents = "none";
          document.body.style.overflow = "";
        }
      }

      if (closeTrackingBtn) {
        closeTrackingBtn.addEventListener("click", closeTrackingModal);
      }

      if (trackingOverlay) {
        trackingOverlay.addEventListener("click", (e) => {
          if (e.target === trackingOverlay) closeTrackingModal();
        });
      }

      if (copyAwbBtn) {
        copyAwbBtn.addEventListener("click", () => {
          const txt = trackAwb ? trackAwb.textContent : "";
          if (txt && !txt.includes("assigned")) {
            navigator.clipboard.writeText(txt);
            copyAwbBtn.textContent = "✓ Copied!";
            setTimeout(() => { copyAwbBtn.textContent = "Copy ID"; }, 2000);
          }
        });
      }

      // Toast notification helper
      function showToast(message, type = "success") {
        const container = document.getElementById("toast-container");
        if (!container) {
          alert(message);
          return;
        }
        const toast = document.createElement("div");
        toast.className = `custom-toast ${type}`;
        toast.style.cssText = `
          padding: 12px 18px;
          border-radius: 8px;
          font-size: 0.88rem;
          font-weight: 600;
          margin-bottom: 8px;
          color: #fff;
          background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981'};
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 10000;
        `;
        toast.innerHTML = `<span>${type === 'error' ? '⚠️' : type === 'warning' ? '🔔' : '✓'}</span> <span>${escapeHTML(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
          toast.style.opacity = "0";
          toast.style.transform = "translateY(-10px)";
          setTimeout(() => toast.remove(), 300);
        }, 4000);
      }

      // ========================================================================
      // CANCEL ORDER MODAL CONTROLLER
      // ========================================================================
      const cancelModal = document.getElementById("cancel-order-modal-overlay");
      const cancelOrderNum = document.getElementById("cancel-modal-order-number");
      const cancelShippedAlert = document.getElementById("cancel-shipped-alert");
      const cancelEligibleContent = document.getElementById("cancel-eligible-content");
      const cancelRefundNoticeBox = document.getElementById("cancel-refund-notice-box");
      const cancelSummaryDetails = document.getElementById("cancel-order-summary-details");
      const btnKeepMyOrder = document.getElementById("btn-keep-my-order");
      const btnSubmitCancel = document.getElementById("btn-submit-cancellation");
      const formCancel = document.getElementById("form-cancel-order");
      const customReasonWrap = document.getElementById("cancel-custom-reason-wrap");
      const customReasonInput = document.getElementById("cancel-custom-reason");
      let currentCancelOrderId = null;

      function openCancelModal(order) {
        if (!cancelModal || !order) return;
        currentCancelOrderId = order.id;

        if (cancelOrderNum) cancelOrderNum.textContent = `Order #${order.order_number}`;

        const isShippedOrIneligible = ["shipped", "out_for_delivery", "delivered"].includes(order.order_status);
        if (isShippedOrIneligible) {
          if (cancelShippedAlert) cancelShippedAlert.style.display = "block";
          if (cancelEligibleContent) cancelEligibleContent.style.display = "none";
          if (btnSubmitCancel) btnSubmitCancel.style.display = "none";
          if (btnKeepMyOrder) btnKeepMyOrder.textContent = "Close";
        } else {
          if (cancelShippedAlert) cancelShippedAlert.style.display = "none";
          if (cancelEligibleContent) cancelEligibleContent.style.display = "flex";
          if (btnSubmitCancel) btnSubmitCancel.style.display = "inline-flex";
          if (btnKeepMyOrder) btnKeepMyOrder.textContent = "Keep My Order";
        }

        const hasAdv = Number(order.advance_paid || order.advance_amount || 0) > 0;
        const advAmt = Math.round(Number(order.advance_paid || order.advance_amount || 0));
        const isOnline = Boolean(
          order.free_gifts_eligible || 
          order.is_full_online_payment || 
          (order.payment_method && order.payment_method.includes("Full Online")) ||
          (order.payment_status === "paid" && !hasAdv && !order.payment_method?.toLowerCase().includes("cash on delivery"))
        );

        if (cancelRefundNoticeBox) {
          if (hasAdv) {
            cancelRefundNoticeBox.innerHTML = `
              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-left: 4px solid #10b981; border-radius: 8px; padding: 12px 14px; font-size: 0.84rem; color: #065f46; line-height: 1.5;">
                <strong>💳 Prepaid Advance Refund Notice:</strong><br>
                Your eligible prepaid advance amount of <strong>₹${advAmt.toLocaleString("en-IN")}</strong> will be refunded to your original payment method after the cancellation is approved. Refund processing may take up to 48 hours.
              </div>
            `;
          } else if (isOnline) {
            cancelRefundNoticeBox.innerHTML = `
              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-left: 4px solid #10b981; border-radius: 8px; padding: 12px 14px; font-size: 0.84rem; color: #065f46; line-height: 1.5;">
                <strong>💳 Online Payment Refund:</strong><br>
                If your cancellation is approved, the eligible refund will be processed to your original payment method. Refund processing may take up to 48 hours after approval.
              </div>
            `;
          } else {
            cancelRefundNoticeBox.innerHTML = `
              <div style="background: rgba(100, 116, 139, 0.08); border: 1px solid rgba(100, 116, 139, 0.25); border-left: 4px solid #64748b; border-radius: 8px; padding: 12px 14px; font-size: 0.84rem; color: #334155; line-height: 1.5;">
                <strong>💵 Cash on Delivery:</strong><br>
                No online payment was made for this order, so there is no prepaid amount to refund.
              </div>
            `;
          }
        }

        if (cancelSummaryDetails) {
          cancelSummaryDetails.innerHTML = `
            <div><strong>Order Total:</strong> ₹${Math.round(order.total || 0).toLocaleString("en-IN")}</div>
            <div><strong>Payment Method:</strong> ${escapeHTML(order.payment_method || (hasAdv ? 'Advance + COD' : isOnline ? 'Online Payment' : 'Cash on Delivery'))}</div>
          `;
        }

        const defaultRadio = document.querySelector('input[name="cancel_reason"][value="Changed my mind"]');
        if (defaultRadio) defaultRadio.checked = true;
        if (customReasonWrap) customReasonWrap.style.display = "none";
        if (customReasonInput) customReasonInput.value = "";

        document.body.classList.add("velora-modal-open");
        cancelModal.classList.add("active");
        cancelModal.style.display = "flex";
        cancelModal.style.opacity = "1";
        cancelModal.style.visibility = "visible";
        cancelModal.style.pointerEvents = "auto";
        document.body.style.overflow = "hidden";
      }

      function closeCancelModal() {
        if (cancelModal) {
          cancelModal.classList.remove("active");
          cancelModal.style.display = "none";
          cancelModal.style.opacity = "0";
          cancelModal.style.visibility = "hidden";
          cancelModal.style.pointerEvents = "none";
        }
        document.body.classList.remove("velora-modal-open");
        document.body.style.overflow = "";
        currentCancelOrderId = null;
      }

      document.querySelectorAll('input[name="cancel_reason"]').forEach(radio => {
        radio.addEventListener("change", () => {
          if (customReasonWrap) {
            const isOther = (radio.value === "Other" && radio.checked);
            customReasonWrap.style.display = isOther ? "block" : "none";
            if (isOther && customReasonInput) {
              customReasonInput.focus();
            }
          }
        });
      });

      // Submit Cancellation Request
      if (formCancel) {
        formCancel.addEventListener("submit", async (e) => {
          e.preventDefault();
          if (!currentCancelOrderId) return;
          const order = dbOrdersCache.find(o => o.id === currentCancelOrderId);
          if (!order) return;

          const selectedRadio = document.querySelector('input[name="cancel_reason"]:checked');
          if (!selectedRadio) {
            showToast("Please select a cancellation reason.", "warning");
            return;
          }
          let reason = selectedRadio.value;
          const customNotes = customReasonInput ? customReasonInput.value.trim() : "";
          if (reason === "Other") {
            if (!customNotes) {
              showToast("Please tell us the reason for cancelling.", "warning");
              if (customReasonInput) customReasonInput.focus();
              return;
            }
            reason = `Other: ${customNotes}`;
          }

          const hasAdv = Number(order.advance_paid || order.advance_amount || 0) > 0;
          const isOnline = Boolean(
            order.free_gifts_eligible || 
            order.is_full_online_payment || 
            (order.payment_method && order.payment_method.includes("Full Online")) ||
            (order.payment_status === "paid" && !hasAdv && !order.payment_method?.toLowerCase().includes("cash on delivery"))
          );

          let refundAmount = 0;
          let refundStatus = "not_applicable";
          if (hasAdv) {
            refundAmount = Number(order.advance_paid || order.advance_amount || 0);
            refundStatus = "pending";
          } else if (isOnline) {
            refundAmount = Number(order.total || 0);
            refundStatus = "pending";
          }

          const submitBtn = document.getElementById("btn-submit-cancellation");
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span>Submitting...</span>`;
          }

          const reqPayload = {
            id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : 'req_' + Date.now(),
            order_id: order.id,
            user_id: authUser.id,
            request_type: "cancellation",
            reason: reason,
            custom_reason: customNotes || null,
            description: customNotes || null,
            status: "requested",
            refund_amount: refundAmount,
            refund_status: refundStatus,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          try {
            try {
              const { error: insErr } = await client.from("order_requests").insert([reqPayload]);
              if (insErr) console.warn("order_requests table insert warning:", insErr.message);
            } catch (err) {
              console.warn("order_requests table insert exception:", err);
            }

            try {
              const { error: ordErr } = await client.from("orders").update({
                order_status: "cancellation_requested",
                updated_at: new Date().toISOString()
              }).eq("id", order.id);
              if (ordErr) console.warn("orders update warning:", ordErr.message);
            } catch (err) {
              console.warn("orders update exception:", err);
            }

            // Dual-layer fallback to store_settings and localStorage
            try {
              const localReqs = JSON.parse(localStorage.getItem("velora_order_requests") || "[]");
              localReqs.push(reqPayload);
              localStorage.setItem("velora_order_requests", JSON.stringify(localReqs));
            } catch (_) {}

            try {
              const { data: sRow } = await client.from("store_settings").select("value").eq("key", "order_requests").maybeSingle();
              let allReqs = (sRow && Array.isArray(sRow.value)) ? sRow.value : [];
              allReqs.push(reqPayload);
              await client.from("store_settings").upsert({ key: "order_requests", value: allReqs }, { onConflict: "key" });
            } catch (_) {}

            showToast("Cancellation request submitted successfully.", "success");
            closeCancelModal();
            await renderOrders();
          } catch (submitErr) {
            console.error("Cancellation submission error:", submitErr);
            showToast("Failed to submit cancellation: " + (submitErr.message || "Please try again."), "error");
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = `<span>Submit Cancellation Request</span>`;
            }
          }
        });
      }

      // ========================================================================
      // RETURN ORDER MODAL CONTROLLER
      // ========================================================================
      const returnModal = document.getElementById("return-order-modal-overlay");
      const returnOrderNum = document.getElementById("return-modal-order-number");
      const returnItemsContainer = document.getElementById("return-items-selection-container");
      const returnCustomWrap = document.getElementById("return-custom-reason-wrap");
      const returnCustomInput = document.getElementById("return-custom-reason");
      const returnNotes = document.getElementById("return-description");
      const returnPhotoInput = document.getElementById("return-photo-input");
      const returnPhotoPreview = document.getElementById("return-photo-preview");
      const returnPhotoImg = document.getElementById("return-photo-img");
      const btnSubmitReturn = document.getElementById("btn-submit-return");
      const formReturn = document.getElementById("form-return-order");
      let currentReturnOrderId = null;
      let attachedReturnPhotoDataUrl = null;

      function openReturnModal(order) {
        if (!returnModal || !order) return;
        currentReturnOrderId = order.id;

        if (returnOrderNum) returnOrderNum.textContent = `Order #${order.order_number}`;

        // Find which items were already returned
        const orderReqs = userRequestsCache.filter(r => r.order_id === order.id && r.request_type === "return");
        const returnedItemIds = new Set(orderReqs.filter(r => r.order_item_id).map(r => r.order_item_id));
        const availableItems = (order.order_items || []).filter(item => !returnedItemIds.has(item.id));

        if (returnItemsContainer) {
          if (availableItems.length === 0) {
            returnItemsContainer.innerHTML = '<div style="color: #64748b; font-size: 0.85rem;">All eligible items from this order have already been requested for return.</div>';
          } else {
            returnItemsContainer.innerHTML = availableItems.map(item => {
              const retFallbackSvg = window.VeloraImageUtils ? window.VeloraImageUtils.getPlaceholderSvg() : 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200';
              const retImg = (window.VeloraImageUtils && typeof window.VeloraImageUtils.normalizeImageUrl === 'function')
                ? window.VeloraImageUtils.normalizeImageUrl(item.product_image, { isAdmin: false, fallback: retFallbackSvg })
                : (item.product_image || retFallbackSvg);
              return `
              <label style="display:flex; align-items:center; gap: 12px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; background: #f8fafc;">
                <input type="checkbox" name="return_item_checkbox" value="${item.id}" data-item-price="${item.price || 0}" data-item-qty="${item.quantity || 1}" checked style="width: 16px; height: 16px; accent-color: #4f46e5;">
                <img src="${escapeHTML(retImg)}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover; border: 1px solid #cbd5e1;" onerror="this.onerror=null; this.src='${retFallbackSvg}';">
                <div style="flex:1; font-size: 0.85rem;">
                  <strong style="color: #0f172a;">${escapeHTML(item.product_name)}</strong>
                  <div style="color: #64748b; font-size: 0.76rem;">${item.selected_size ? 'Size: ' + escapeHTML(item.selected_size) : ''} • Qty: ${item.quantity || 1}</div>
                </div>
                <strong style="color: #0f172a; font-size: 0.88rem;">₹${Math.round(item.subtotal || (item.price * (item.quantity || 1))).toLocaleString("en-IN")}</strong>
              </label>
              `;
            }).join("");
          }
        }

        const defaultReturnRadio = document.querySelector('input[name="return_reason"][value="Wrong product received"]');
        if (defaultReturnRadio) defaultReturnRadio.checked = true;
        if (returnCustomWrap) returnCustomWrap.style.display = "none";
        if (returnCustomInput) returnCustomInput.value = "";
        if (returnNotes) returnNotes.value = "";
        if (returnPhotoInput) returnPhotoInput.value = "";
        if (returnPhotoPreview) returnPhotoPreview.style.display = "none";
        attachedReturnPhotoDataUrl = null;

        document.body.classList.add("velora-modal-open");
        returnModal.classList.add("active");
        returnModal.style.display = "flex";
        returnModal.style.opacity = "1";
        returnModal.style.visibility = "visible";
        returnModal.style.pointerEvents = "auto";
        document.body.style.overflow = "hidden";
      }

      function closeReturnModal() {
        if (returnModal) {
          returnModal.classList.remove("active");
          returnModal.style.display = "none";
          returnModal.style.opacity = "0";
          returnModal.style.visibility = "hidden";
          returnModal.style.pointerEvents = "none";
        }
        document.body.classList.remove("velora-modal-open");
        document.body.style.overflow = "";
        currentReturnOrderId = null;
        attachedReturnPhotoDataUrl = null;
      }

      document.querySelectorAll('input[name="return_reason"]').forEach(radio => {
        radio.addEventListener("change", () => {
          if (returnCustomWrap) {
            const isOther = (radio.value === "Other" && radio.checked);
            returnCustomWrap.style.display = isOther ? "block" : "none";
            if (isOther && returnCustomInput) {
              returnCustomInput.focus();
            }
          }
        });
      });

      if (returnPhotoInput) {
        returnPhotoInput.addEventListener("change", (e) => {
          const file = e.target.files && e.target.files[0];
          if (file) {
            if (file.size > 5 * 1024 * 1024) {
              showToast("Image size must be less than 5MB", "error");
              returnPhotoInput.value = "";
              attachedReturnPhotoDataUrl = null;
              if (returnPhotoPreview) returnPhotoPreview.style.display = "none";
              return;
            }
            const reader = new FileReader();
            reader.onload = (loadEvt) => {
              attachedReturnPhotoDataUrl = loadEvt.target.result;
              if (returnPhotoImg) returnPhotoImg.src = attachedReturnPhotoDataUrl;
              if (returnPhotoPreview) returnPhotoPreview.style.display = "block";
            };
            reader.readAsDataURL(file);
          } else {
            attachedReturnPhotoDataUrl = null;
            if (returnPhotoPreview) returnPhotoPreview.style.display = "none";
          }
        });
      }

      // Submit Return Request
      if (formReturn) {
        formReturn.addEventListener("submit", async (e) => {
          e.preventDefault();
          if (!currentReturnOrderId) return;
          const order = dbOrdersCache.find(o => o.id === currentReturnOrderId);
          if (!order) return;

          const checkedItemBoxes = Array.from(document.querySelectorAll('input[name="return_item_checkbox"]:checked'));
          if (checkedItemBoxes.length === 0) {
            showToast("Please select at least one item to return.", "warning");
            return;
          }

          const selectedReturnRadio = document.querySelector('input[name="return_reason"]:checked');
          if (!selectedReturnRadio) {
            showToast("Please select why you want to return this item.", "warning");
            return;
          }

          let reason = selectedReturnRadio.value;
          const customNotes = returnCustomInput ? returnCustomInput.value.trim() : "";
          if (reason === "Other") {
            if (!customNotes) {
              showToast("Please tell us the reason for your return.", "warning");
              if (returnCustomInput) returnCustomInput.focus();
              return;
            }
            reason = `Other: ${customNotes}`;
          }

          const notes = returnNotes ? returnNotes.value.trim() : "";
          const submitBtn = document.getElementById("btn-submit-return");
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span>Submitting...</span>`;
          }

          const hasAdv = Number(order.advance_paid || order.advance_amount || 0) > 0;
          const isOnline = Boolean(
            order.free_gifts_eligible || 
            order.is_full_online_payment || 
            (order.payment_method && order.payment_method.includes("Full Online")) ||
            (order.payment_status === "paid" && !hasAdv && !order.payment_method?.toLowerCase().includes("cash on delivery"))
          );

          let totalSelectedValue = 0;
          checkedItemBoxes.forEach(cb => {
            const price = Number(cb.dataset.itemPrice || 0);
            const qty = Number(cb.dataset.itemQty || 1);
            totalSelectedValue += (price * qty);
          });

          let returnRefundAmount = 0;
          let returnRefundStatus = "not_applicable";
          if (hasAdv) {
            const ratio = Math.min(1, totalSelectedValue / (order.total || 1));
            returnRefundAmount = Math.round((Number(order.advance_paid || order.advance_amount) * ratio) * 100) / 100;
            returnRefundStatus = returnRefundAmount > 0 ? "pending" : "not_applicable";
          } else if (isOnline) {
            returnRefundAmount = Math.min(totalSelectedValue, Number(order.total || 0));
            returnRefundStatus = "pending";
          }

          const selectedItemIds = checkedItemBoxes.map(cb => cb.value);

          const newRequests = selectedItemIds.map(itemId => ({
            id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            order_id: order.id,
            user_id: authUser.id,
            order_item_id: itemId,
            request_type: "return",
            reason: reason,
            description: notes || null,
            images: attachedReturnPhotoDataUrl ? [attachedReturnPhotoDataUrl] : [],
            status: "requested",
            refund_amount: selectedItemIds.length > 0 ? Math.round((returnRefundAmount / selectedItemIds.length) * 100) / 100 : 0,
            refund_status: returnRefundStatus,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          try {
            try {
              const { error: insErr } = await client.from("order_requests").insert(newRequests);
              if (insErr) console.warn("order_requests table insert warning:", insErr.message);
            } catch (err) {
              console.warn("order_requests table insert exception:", err);
            }

            try {
              const { error: ordErr } = await client.from("orders").update({
                order_status: "return_requested",
                updated_at: new Date().toISOString()
              }).eq("id", order.id);
              if (ordErr) console.warn("orders update warning:", ordErr.message);
            } catch (err) {
              console.warn("orders update exception:", err);
            }

            // Dual-layer fallback
            try {
              const localReqs = JSON.parse(localStorage.getItem("velora_order_requests") || "[]");
              newRequests.forEach(r => localReqs.push(r));
              localStorage.setItem("velora_order_requests", JSON.stringify(localReqs));
            } catch (_) {}

            try {
              const { data: sRow } = await client.from("store_settings").select("value").eq("key", "order_requests").maybeSingle();
              let allReqs = (sRow && Array.isArray(sRow.value)) ? sRow.value : [];
              newRequests.forEach(r => allReqs.push(r));
              await client.from("store_settings").upsert({ key: "order_requests", value: allReqs }, { onConflict: "key" });
            } catch (_) {}

            showToast("Return request submitted. Our team will review your request and arrange the next steps.", "success");
            closeReturnModal();
            await renderOrders();
          } catch (submitErr) {
            console.error("Return submission error:", submitErr);
            showToast("Failed to submit return request: " + (submitErr.message || "Please try again."), "error");
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = `<span>Submit Return Request</span>`;
            }
          }
        });
      }

      // ========================================================================
      // UNIVERSAL MODAL EVENT DELEGATION (Open, Close, Escape)
      // ========================================================================

      // Universal delegated click for Track Order buttons
      document.addEventListener("click", (e) => {
        const trackBtn = e.target.closest(".btn-track-order");
        if (trackBtn) {
          e.preventDefault();
          e.stopPropagation();
          const ordId = trackBtn.dataset.orderId;
          const ordNum = trackBtn.dataset.orderNumber;
          const ordStatus = trackBtn.dataset.orderStatus;
          const ordEta = trackBtn.dataset.orderEta;
          openTrackingModal(ordId, ordNum, ordStatus, ordEta);
          return;
        }

        const cancelBtn = e.target.closest(".btn-cancel-order");
        if (cancelBtn) {
          e.preventDefault();
          e.stopPropagation();
          const ordId = cancelBtn.dataset.orderId;
          const ordNum = cancelBtn.dataset.orderNumber;
          const order = dbOrdersCache.find(o => o.id === ordId || o.order_number === ordId || o.order_number === ordNum);
          if (order) openCancelModal(order);
          return;
        }

        const returnBtn = e.target.closest(".btn-return-order");
        if (returnBtn) {
          e.preventDefault();
          e.stopPropagation();
          const ordId = returnBtn.dataset.orderId;
          const ordNum = returnBtn.dataset.orderNumber;
          const order = dbOrdersCache.find(o => o.id === ordId || o.order_number === ordId || o.order_number === ordNum);
          if (order) openReturnModal(order);
          return;
        }

        // Close buttons
        if (e.target.closest(".btn-close-cancel-modal, #btn-keep-my-order")) {
          e.preventDefault();
          closeCancelModal();
          return;
        }
        if (e.target.closest(".btn-close-return-modal")) {
          e.preventDefault();
          closeReturnModal();
          return;
        }

        // Backdrop clicks
        if (e.target === cancelModal) {
          closeCancelModal();
          return;
        }
        if (e.target === returnModal) {
          closeReturnModal();
          return;
        }
      });

      // Escape key listener for all modals
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          closeCancelModal();
          closeReturnModal();
          closeTrackingModal();
        }
      });

      // Realtime listener for order status changes with proper channel tracking & cleanup
      if (typeof client.channel === "function") {
        try {
          orderChannel = client
            .channel(`public:user_orders_${authUser.id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${authUser.id}` }, () => {
              renderOrders();
            })
            .subscribe();
        } catch (e) {
          console.warn("Realtime order subscription notice:", e);
        }
      }

      window.addEventListener("beforeunload", () => {
        if (orderChannel && typeof client.removeChannel === "function") {
          try { client.removeChannel(orderChannel); } catch (_) {}
        }
        if (authSubscription && typeof authSubscription.unsubscribe === "function") {
          try { authSubscription.unsubscribe(); } catch (_) {}
        }
      });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initAccountPage);
    } else {
      initAccountPage();
    }
  