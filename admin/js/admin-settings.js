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

      if (document.getElementById("set-store-name")) document.getElementById("set-store-name").value = general.store_name || "VELORA Lifestyle Studio";
      if (document.getElementById("set-support-email")) document.getElementById("set-support-email").value = general.support_email || "support@velorastudio.com";
      if (document.getElementById("set-support-phone")) document.getElementById("set-support-phone").value = general.support_phone || "+91 1800 102 8356";
      if (document.getElementById("set-address")) document.getElementById("set-address").value = general.studio_address || "12 Connaught Place, New Delhi 110001, India";

      if (document.getElementById("set-free-shipping")) document.getElementById("set-free-shipping").value = shipping.free_shipping_threshold || 999;
      if (document.getElementById("set-shipping-fee")) document.getElementById("set-shipping-fee").value = shipping.standard_shipping_fee || 99;
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

      try {
        await client.from("store_settings").upsert([
          { key: "general", value: generalVal, updated_at: new Date().toISOString() },
          { key: "shipping", value: shippingVal, updated_at: new Date().toISOString() }
        ]);
        window.showToast("Settings saved successfully!", "success");
      } catch (err) {
        alert("Error saving settings: " + err.message);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Store Settings";
      }
    });
  }

  await loadSettings();
});
