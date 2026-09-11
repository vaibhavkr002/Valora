/**
 * VELORA Admin Panel - Reviews & Ratings Moderation
 */
document.addEventListener("DOMContentLoaded", async () => {
  const admin = await window.AdminAuth.guardRoute();
  if (!admin) return;
  window.initLayout(admin);

  const client = window.AdminAuth.getClient();
  const tbody = document.getElementById("reviews-tbody");

  async function loadReviews() {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px;">Loading reviews...</td></tr>';
    const { data: reviews, error } = await client
      .from("reviews")
      .select("*, products(name, id)")
      .order("created_at", { ascending: false });

    if (error) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--admin-danger);">Error: ${error.message}</td></tr>`;
      return;
    }

    if (!reviews || reviews.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px;">No customer reviews submitted yet.</td></tr>';
      return;
    }

    tbody.innerHTML = reviews.map(r => {
      const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
      let statusBadge = '<span class="badge badge-success">Approved</span>';
      if (r.status === 'pending') statusBadge = '<span class="badge badge-warning">Pending</span>';
      if (r.status === 'rejected') statusBadge = '<span class="badge badge-danger">Rejected</span>';

      return `
        <tr>
          <td><strong>${r.products ? r.products.name : 'Unknown Product'}</strong></td>
          <td>${r.user_name}</td>
          <td><span style="color: #f59e0b;">${stars}</span></td>
          <td><span style="font-size:0.85rem; color: #cbd5e1;">${r.comment}</span></td>
          <td>${statusBadge}</td>
          <td>
            <div style="display:flex; gap: 4px;">
              <button class="btn-admin-secondary btn-approve-review" data-id="${r.id}" style="padding: 4px 8px; font-size: 0.75rem;">Approve</button>
              <button class="btn-admin-danger btn-delete-review" data-id="${r.id}" style="padding: 4px 8px; font-size: 0.75rem;">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    document.querySelectorAll(".btn-approve-review").forEach(b => {
      b.addEventListener("click", async () => {
        await client.from("reviews").update({ status: "approved" }).eq("id", b.dataset.id);
        window.showToast("Review approved and visible to customers.", "success");
        loadReviews();
      });
    });

    document.querySelectorAll(".btn-delete-review").forEach(b => {
      b.addEventListener("click", async () => {
        if (confirm("Delete this review?")) {
          await client.from("reviews").delete().eq("id", b.dataset.id);
          window.showToast("Review deleted.", "info");
          loadReviews();
        }
      });
    });
  }

  await loadReviews();
});
