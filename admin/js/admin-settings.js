/**
 * VELORA Admin Panel - Store Settings Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const form = document.getElementById("store-settings-form");

  async function loadSettings() {
    const { data: settings } = await client.from("store_settings").select("*");
    if (settings) {
      const general = settings.find(s => s.key === "general")?.value || {};
      const shipping = settings.find(s => s.key === "shipping")?.value || {};
      const payment = settings.find(s => s.key === "payment")?.value || {};

      if (document.getElementById("set-store-name")) document.getElementById("set-store-name").value = general.store_name || "VELORA Lifestyle Studio";
      if (document.getElementById("set-support-email")) document.getElementById("set-support-email").value = general.support_email || "support@velorastudio.com";
      if (document.getElementById("set-support-phone")) document.getElementById("set-support-phone").value = general.support_phone || "+91 1800 102 8356";
      if (document.getElementById("set-address")) document.getElementById("set-address").value = general.studio_address || "12 Connaught Place, New Delhi 110001, India";

      if (document.getElementById("set-free-shipping")) document.getElementById("set-free-shipping").value = shipping.free_shipping_threshold || 999;
      if (document.getElementById("set-shipping-fee")) document.getElementById("set-shipping-fee").value = shipping.standard_shipping_fee || 99;

      // Open Box Delivery Settings
      const openBox = settings.find(s => s.key === "open_box")?.value || {};
      if (document.getElementById("set-openbox-enabled")) document.getElementById("set-openbox-enabled").checked = openBox.enabled !== false;
      if (document.getElementById("set-openbox-fee")) document.getElementById("set-openbox-fee").value = openBox.fee ?? 0;
      const eligibleMethods = openBox.eligible_payment_methods || ["cod", "advance_cod", "online"];
      if (document.getElementById("set-openbox-cod")) document.getElementById("set-openbox-cod").checked = eligibleMethods.includes("cod");
      if (document.getElementById("set-openbox-adv-cod")) document.getElementById("set-openbox-adv-cod").checked = eligibleMethods.includes("advance_cod");
      if (document.getElementById("set-openbox-online")) document.getElementById("set-openbox-online").checked = eligibleMethods.includes("online");

      // UPI Merchant Gateway Settings
      if (document.getElementById("set-merchant-vpa")) document.getElementById("set-merchant-vpa").value = payment.merchant_vpa || "velora.lifestyle@okhdfcbank";
      if (document.getElementById("set-merchant-name")) document.getElementById("set-merchant-name").value = payment.merchant_name || "VELORA Lifestyle Studio";

      const enabledApps = payment.enabled_apps || ["Google Pay", "PhonePe", "Paytm", "BHIM", "Any UPI App"];
      if (document.getElementById("app-gpay")) document.getElementById("app-gpay").checked = enabledApps.includes("Google Pay");
      if (document.getElementById("app-phonepe")) document.getElementById("app-phonepe").checked = enabledApps.includes("PhonePe");
      if (document.getElementById("app-paytm")) document.getElementById("app-paytm").checked = enabledApps.includes("Paytm");
      if (document.getElementById("app-bhim")) document.getElementById("app-bhim").checked = enabledApps.includes("BHIM");
      if (document.getElementById("app-generic")) document.getElementById("app-generic").checked = enabledApps.includes("Any UPI App");
    }
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const saveBtn = form.querySelector("button[type='submit']");
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving Configuration...";

      const generalVal = {
        store_name: document.getElementById("set-store-name").value.trim(),
        support_email: document.getElementById("set-support-email").value.trim(),
        support_phone: document.getElementById("set-support-phone").value.trim(),
        studio_address: document.getElementById("set-address").value.trim()
      };

      const shippingVal = {
        currency: "INR",
        free_shipping_threshold: parseFloat(document.getElementById("set-free-shipping").value) || 999,
        standard_shipping_fee: parseFloat(document.getElementById("set-shipping-fee").value) || 99,
        return_period_days: 30
      };

      const openBoxMethods = [];
      if (document.getElementById("set-openbox-cod")?.checked) openBoxMethods.push("cod");
      if (document.getElementById("set-openbox-adv-cod")?.checked) openBoxMethods.push("advance_cod");
      if (document.getElementById("set-openbox-online")?.checked) openBoxMethods.push("online");

      const openBoxVal = {
        enabled: document.getElementById("set-openbox-enabled") ? document.getElementById("set-openbox-enabled").checked : true,
        fee: parseFloat(document.getElementById("set-openbox-fee")?.value) || 0,
        eligible_payment_methods: openBoxMethods
      };

      const enabledApps = [];
      if (document.getElementById("app-gpay")?.checked) enabledApps.push("Google Pay");
      if (document.getElementById("app-phonepe")?.checked) enabledApps.push("PhonePe");
      if (document.getElementById("app-paytm")?.checked) enabledApps.push("Paytm");
      if (document.getElementById("app-bhim")?.checked) enabledApps.push("BHIM");
      if (document.getElementById("app-generic")?.checked) enabledApps.push("Any UPI App");

      const paymentVal = {
        merchant_vpa: document.getElementById("set-merchant-vpa") ? document.getElementById("set-merchant-vpa").value.trim() : "velora.lifestyle@okhdfcbank",
        merchant_name: document.getElementById("set-merchant-name") ? document.getElementById("set-merchant-name").value.trim() : "VELORA Lifestyle Studio",
        enabled_apps: enabledApps
      };

      try {
        await client.from("store_settings").upsert([
          { key: "general", value: generalVal, updated_at: new Date().toISOString() },
          { key: "shipping", value: shippingVal, updated_at: new Date().toISOString() },
          { key: "payment", value: paymentVal, updated_at: new Date().toISOString() },
          { key: "open_box", value: openBoxVal, updated_at: new Date().toISOString() }
        ]);

        if (window.VeloraCache) {
          try { window.VeloraCache.invalidate('store_settings'); } catch (_) {}
        }

        window.showToast ? window.showToast("Settings saved successfully!", "success") : alert("Settings saved successfully!");
      } catch (err) {
        alert("Error saving settings: " + err.message);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save All Settings";
      }
    });
  }

  await loadSettings();
});
