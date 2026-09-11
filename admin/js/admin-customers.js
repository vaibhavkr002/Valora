/**
 * VELORA Admin Panel - Customers Directory Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const tbody = document.getElementById("customers-tbody");
  const searchInput = document.getElementById("search-customers");

  let allCustomers = [];

  async function loadCustomers() {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px;">Loading customers...</td></tr>';
    
    // Fetch profiles and orders to compute total spending
    const { data: profiles, error } = await client
      .from("profiles")
      .select("*, orders(total)")
      .order("created_at", { ascending: false });

    if (error) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--admin-danger); text-align:center;">Error: ${error.message}</td></tr>`;
      return;
    }

    allCustomers = profiles || [];
    renderCustomers();
  }

  function renderCustomers() {
    let filtered = [...allCustomers];
    const q = (searchInput?.value || "").trim().toLowerCase();

    if (q) {
      filtered = filtered.filter(c => 
        (c.full_name && c.full_name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--admin-text-muted);">No customers found.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(c => {
      const orderList = c.orders || [];
      const orderCount = orderList.length;
      const totalSpent = orderList.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const joinedDate = new Date(c.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
      const roleBadge = c.role === "admin" ? '<span class="badge badge-indigo">Admin</span>' : '<span class="badge badge-muted">Customer</span>';

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap: 10px;">
              <div class="admin-avatar" style="width:34px; height:34px; font-size:0.75rem;">${(c.full_name || c.email).substring(0, 2).toUpperCase()}</div>
              <div>
                <strong>${c.full_name || 'Member'}</strong>
                <div style="font-size:0.75rem; color: var(--admin-text-muted);">${c.email}</div>
              </div>
            </div>
          </td>
          <td>${c.phone || '<span style="color:var(--admin-text-muted);">Not added</span>'}</td>
          <td>${roleBadge}</td>
          <td>${joinedDate}</td>
          <td>${orderCount} orders</td>
          <td><strong>${window.formatINR(totalSpent)}</strong></td>
        </tr>
      `;
    }).join("");
  }

  if (searchInput) searchInput.addEventListener("input", renderCustomers);
  await loadCustomers();
});
