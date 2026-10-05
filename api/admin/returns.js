/**
 * POST /api/admin/returns
 * Admin controller for complete Return Workflow:
 * 1. Approve / Reject Return Request
 * 2. Assign Delivery Partner for Pickup (PICKUP_ASSIGNED)
 * 3. Mark Picked Up (RETURN_PICKED_UP)
 * 4. Mark Received at Warehouse (RETURN_RECEIVED)
 * 5. Submit Product Inspection (7 criteria checklist)
 *    - RETURN_APPROVED_AFTER_INSPECTION
 *    - RETURN_REJECTED_AFTER_INSPECTION
 * 6. Replacement Processing (REPLACEMENT_APPROVED)
 * 
 * STRICT SECURITY:
 * - Requires authenticated Admin Bearer token.
 * - DOES NOT call Razorpay Refund API (Refund API is strictly in /api/razorpay/refund).
 */

const {
  updateOrder,
  supabaseRest,
  getSupabaseConfig
} = require('../_lib/supabaseAdmin');

async function authenticateAdmin(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    throw new Error('Authorization required.');
  }

  const { url, key } = getSupabaseConfig();
  const authRes = await fetch(`${url}/auth/v1/user`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${token}`
    }
  });

  if (!authRes.ok) {
    throw new Error('Invalid or expired authentication credentials.');
  }

  const user = await authRes.json();
  if (!user || !user.id) {
    throw new Error('Failed to resolve authenticated user.');
  }

  const isAdminInMeta = (user.user_metadata && user.user_metadata.role === 'admin') ||
                        (user.app_metadata && user.app_metadata.role === 'admin');

  if (isAdminInMeta) {
    return { user, token };
  }

  const profileRes = await supabaseRest(`profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`, {
    token: key
  });

  const profile = Array.isArray(profileRes) && profileRes.length > 0 ? profileRes[0] : null;
  if (!profile || profile.role !== 'admin') {
    throw new Error('Access denied: Administrator privileges required.');
  }

  return { user, token };
}

async function fetchOrder(orderIdOrNumber) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderIdOrNumber);
  const filter = isUuid ? `id=eq.${encodeURIComponent(orderIdOrNumber)}` : `order_number=eq.${encodeURIComponent(orderIdOrNumber)}`;
  const data = await supabaseRest(`orders?${filter}&select=*,order_items(*)&limit=1`);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function syncBackupStoreSettings(updatedRequest) {
  try {
    const sRow = await supabaseRest('store_settings?key=eq.order_requests&select=value&limit=1');
    let reqs = (Array.isArray(sRow) && sRow[0]?.value && Array.isArray(sRow[0].value)) ? sRow[0].value : [];
    const idx = reqs.findIndex(r => r.id === updatedRequest.id || (r.order_id === updatedRequest.order_id && r.order_item_id === updatedRequest.order_item_id));
    if (idx >= 0) {
      reqs[idx] = { ...reqs[idx], ...updatedRequest };
    } else {
      reqs.push(updatedRequest);
    }
    await supabaseRest('store_settings', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: { key: 'order_requests', value: reqs }
    });
  } catch (err) {
    console.warn('[syncBackupStoreSettings] Warning:', err.message);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  try {
    const { user: adminUser, token: adminToken } = await authenticateAdmin(req);
    const adminEmail = adminUser.email || adminUser.user_metadata?.email || 'admin@valora.com';
    const adminName = adminUser.user_metadata?.full_name || adminEmail.split('@')[0];

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {
        return res.status(400).json({ success: false, error: 'Malformed JSON payload.' });
      }
    }
    const { action, request_id, order_id, payload } = body || {};

    if (!action) {
      return res.status(400).json({ success: false, error: 'Action parameter is required.' });
    }

    // ========================================================================
    // ACTION: LIST ALL RETURNS
    // ========================================================================
    if (action === 'list') {
      let requests = [];
      try {
        const dbReqs = await supabaseRest('order_requests?request_type=eq.return&select=*&order=created_at.desc');
        if (Array.isArray(dbReqs)) requests = dbReqs;
      } catch (err) {
        console.warn('Direct order_requests query error:', err.message);
      }

      // Merge with store_settings backup
      try {
        const sRow = await supabaseRest('store_settings?key=eq.order_requests&select=value&limit=1');
        if (Array.isArray(sRow) && sRow[0]?.value && Array.isArray(sRow[0].value)) {
          const existingIds = new Set(requests.map(r => r.id));
          sRow[0].value.filter(r => r.request_type === 'return').forEach(r => {
            if (!existingIds.has(r.id)) requests.push(r);
          });
        }
      } catch (_) {}

      // Fetch corresponding orders
      const orderIds = [...new Set(requests.map(r => r.order_id).filter(Boolean))];
      let ordersMap = {};
      if (orderIds.length > 0) {
        try {
          const filter = `id=in.(${orderIds.map(id => encodeURIComponent(id)).join(',')})`;
          const orders = await supabaseRest(`orders?${filter}&select=*,order_items(*)`);
          if (Array.isArray(orders)) {
            orders.forEach(o => { ordersMap[o.id] = o; });
          }
        } catch (_) {}
      }

      // Also find orders whose status is return_requested / returned even if no order_request record yet
      try {
        const retOrders = await supabaseRest(`orders?order_status=in.(return_requested,return_approved,pickup_assigned,return_picked_up,return_received,inspection_approved,return_approved_after_inspection,return_rejected_after_inspection,refund_initiated,returned)&select=*,order_items(*)`);
        if (Array.isArray(retOrders)) {
          retOrders.forEach(o => {
            if (!ordersMap[o.id]) ordersMap[o.id] = o;
            // Synthesize virtual request if not in requests array
            const hasReq = requests.some(r => r.order_id === o.id);
            if (!hasReq) {
              requests.push({
                id: `syn_${o.id}`,
                order_id: o.id,
                user_id: o.user_id,
                request_type: 'return',
                reason: o.tracking_data?.return_workflow?.reason || 'Customer Return Request',
                description: o.tracking_data?.return_workflow?.notes || null,
                status: o.order_status,
                refund_status: o.refund_status || 'pending',
                refund_amount: o.refund_amount || (o.advance_paid || o.advance_amount || (o.is_full_online_payment ? o.total : 0)),
                created_at: o.updated_at || o.created_at
              });
            }
          });
        }
      } catch (_) {}

      return res.status(200).json({
        success: true,
        requests,
        orders: ordersMap
      });
    }

    // For all state mutations, require either request_id or order_id
    if (!order_id && !request_id) {
      return res.status(400).json({ success: false, error: 'order_id or request_id is required.' });
    }

    let targetOrder = null;
    let targetRequest = null;

    if (request_id) {
      try {
        const rData = await supabaseRest(`order_requests?id=eq.${encodeURIComponent(request_id)}&select=*&limit=1`);
        if (Array.isArray(rData) && rData.length > 0) targetRequest = rData[0];
      } catch (_) {}
    }

    const resolvedOrderId = order_id || targetRequest?.order_id;
    if (resolvedOrderId) {
      targetOrder = await fetchOrder(resolvedOrderId);
    }

    if (!targetOrder) {
      return res.status(404).json({ success: false, error: `Order not found for ID: ${resolvedOrderId}` });
    }

    const trackingData = (targetOrder.tracking_data && typeof targetOrder.tracking_data === 'object')
      ? { ...targetOrder.tracking_data }
      : {};
    const returnWorkflow = (trackingData.return_workflow && typeof trackingData.return_workflow === 'object')
      ? { ...trackingData.return_workflow }
      : {};

    const nowIso = new Date().toISOString();

    // ========================================================================
    // ACTION: APPROVE RETURN REQUEST
    // ========================================================================
    if (action === 'approve_return') {
      returnWorkflow.status = 'RETURN_APPROVED';
      returnWorkflow.approved_at = nowIso;
      returnWorkflow.approved_by = adminName;
      trackingData.return_workflow = returnWorkflow;

      await updateOrder(targetOrder.id, {
        order_status: 'return_approved',
        tracking_data: trackingData,
        updated_at: nowIso
      });

      if (targetRequest) {
        try {
          await supabaseRest(`order_requests?id=eq.${encodeURIComponent(targetRequest.id)}`, {
            method: 'PATCH',
            body: {
              status: 'return_approved',
              admin_notes: payload?.notes || `Approved by ${adminName}`,
              updated_at: nowIso
            }
          });
        } catch (_) {}
        await syncBackupStoreSettings({
          ...targetRequest,
          status: 'return_approved',
          admin_notes: payload?.notes || `Approved by ${adminName}`,
          updated_at: nowIso
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Return request approved. Ready for pickup assignment.',
        status: 'RETURN_APPROVED'
      });
    }

    // ========================================================================
    // ACTION: REJECT RETURN REQUEST
    // ========================================================================
    if (action === 'reject_return') {
      const reason = payload?.reason || 'Return request declined as it does not meet return policy criteria.';
      returnWorkflow.status = 'RETURN_REJECTED';
      returnWorkflow.rejected_at = nowIso;
      returnWorkflow.rejected_by = adminName;
      returnWorkflow.rejection_reason = reason;
      trackingData.return_workflow = returnWorkflow;

      await updateOrder(targetOrder.id, {
        order_status: 'delivered', // Revert to delivered
        tracking_data: trackingData,
        updated_at: nowIso
      });

      if (targetRequest) {
        try {
          await supabaseRest(`order_requests?id=eq.${encodeURIComponent(targetRequest.id)}`, {
            method: 'PATCH',
            body: {
              status: 'return_rejected',
              admin_notes: reason,
              updated_at: nowIso
            }
          });
        } catch (_) {}
        await syncBackupStoreSettings({
          ...targetRequest,
          status: 'return_rejected',
          admin_notes: reason,
          updated_at: nowIso
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Return request rejected.',
        status: 'RETURN_REJECTED'
      });
    }

    // ========================================================================
    // ACTION: ASSIGN PICKUP PARTNER (PICKUP_ASSIGNED)
    // ========================================================================
    if (action === 'assign_pickup') {
      const { partner_id, partner_name, partner_slug, tracking_id, instructions } = payload || {};

      if (!partner_name) {
        return res.status(400).json({ success: false, error: 'partner_name is required for pickup assignment.' });
      }

      returnWorkflow.status = 'PICKUP_ASSIGNED';
      returnWorkflow.pickup_partner = {
        id: partner_id || null,
        name: partner_name,
        slug: partner_slug || partner_name.toLowerCase().replace(/\s+/g, '-'),
        tracking_id: tracking_id || `RET-AWB-${Date.now().toString().slice(-6)}`,
        instructions: instructions || 'Inspect outer packaging and pick up original return unit.',
        assigned_at: nowIso,
        assigned_by: adminName
      };
      trackingData.return_workflow = returnWorkflow;

      await updateOrder(targetOrder.id, {
        order_status: 'pickup_assigned',
        tracking_data: trackingData,
        updated_at: nowIso
      });

      if (targetRequest) {
        try {
          await supabaseRest(`order_requests?id=eq.${encodeURIComponent(targetRequest.id)}`, {
            method: 'PATCH',
            body: {
              status: 'pickup_assigned',
              admin_notes: `Pickup assigned to ${partner_name} (AWB: ${returnWorkflow.pickup_partner.tracking_id})`,
              updated_at: nowIso
            }
          });
        } catch (_) {}
        await syncBackupStoreSettings({
          ...targetRequest,
          status: 'pickup_assigned',
          admin_notes: `Pickup assigned to ${partner_name} (AWB: ${returnWorkflow.pickup_partner.tracking_id})`,
          updated_at: nowIso
        });
      }

      return res.status(200).json({
        success: true,
        message: `Pickup assigned to ${partner_name}.`,
        status: 'PICKUP_ASSIGNED',
        pickup_partner: returnWorkflow.pickup_partner
      });
    }

    // ========================================================================
    // ACTION: MARK RETURN PICKED UP (RETURN_PICKED_UP)
    // ========================================================================
    if (action === 'mark_picked_up') {
      returnWorkflow.status = 'RETURN_PICKED_UP';
      returnWorkflow.picked_up_at = nowIso;
      returnWorkflow.picked_up_by = payload?.courier_person || returnWorkflow.pickup_partner?.name || 'Delivery Partner';
      trackingData.return_workflow = returnWorkflow;

      await updateOrder(targetOrder.id, {
        order_status: 'return_picked_up',
        tracking_data: trackingData,
        updated_at: nowIso
      });

      if (targetRequest) {
        try {
          await supabaseRest(`order_requests?id=eq.${encodeURIComponent(targetRequest.id)}`, {
            method: 'PATCH',
            body: {
              status: 'return_picked_up',
              updated_at: nowIso
            }
          });
        } catch (_) {}
        await syncBackupStoreSettings({
          ...targetRequest,
          status: 'return_picked_up',
          updated_at: nowIso
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Product marked as picked up from customer.',
        status: 'RETURN_PICKED_UP'
      });
    }

    // ========================================================================
    // ACTION: MARK RETURN RECEIVED AT WAREHOUSE (RETURN_RECEIVED)
    // ========================================================================
    if (action === 'mark_received') {
      returnWorkflow.status = 'RETURN_RECEIVED';
      returnWorkflow.received_at = nowIso;
      returnWorkflow.received_by = adminName;
      returnWorkflow.warehouse_notes = payload?.notes || 'Received at Valora central fulfillment facility.';
      trackingData.return_workflow = returnWorkflow;

      await updateOrder(targetOrder.id, {
        order_status: 'return_received',
        tracking_data: trackingData,
        updated_at: nowIso
      });

      if (targetRequest) {
        try {
          await supabaseRest(`order_requests?id=eq.${encodeURIComponent(targetRequest.id)}`, {
            method: 'PATCH',
            body: {
              status: 'return_received',
              updated_at: nowIso
            }
          });
        } catch (_) {}
        await syncBackupStoreSettings({
          ...targetRequest,
          status: 'return_received',
          updated_at: nowIso
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Product received at warehouse. Ready for product inspection.',
        status: 'RETURN_RECEIVED'
      });
    }

    // ========================================================================
    // ACTION: SUBMIT INSPECTION (7 CRITERIA CHECKLIST)
    // ========================================================================
    if (action === 'submit_inspection') {
      const {
        outcome, // 'approved' or 'rejected'
        criteria, // object with 7 booleans
        notes,
        inspector
      } = payload || {};

      if (!outcome || !['approved', 'rejected'].includes(outcome)) {
        return res.status(400).json({ success: false, error: 'outcome must be either "approved" or "rejected".' });
      }

      const verifiedCriteria = {
        correct_item: Boolean(criteria?.correct_item),
        item_unused: Boolean(criteria?.item_unused),
        tags_attached: Boolean(criteria?.tags_attached),
        packaging_present: Boolean(criteria?.packaging_present),
        no_damage: Boolean(criteria?.no_damage),
        accessories_included: Boolean(criteria?.accessories_included),
        serial_match: Boolean(criteria?.serial_match)
      };

      const inspectionPassed = outcome === 'approved';
      const newStatus = inspectionPassed ? 'RETURN_APPROVED_AFTER_INSPECTION' : 'RETURN_REJECTED_AFTER_INSPECTION';
      const dbOrderStatus = inspectionPassed ? 'inspection_approved' : 'return_rejected_after_inspection';

      returnWorkflow.status = newStatus;
      returnWorkflow.inspection = {
        passed: inspectionPassed,
        criteria: verifiedCriteria,
        outcome,
        notes: notes || '',
        inspected_by: inspector || adminName,
        inspected_at: nowIso
      };
      trackingData.return_workflow = returnWorkflow;

      await updateOrder(targetOrder.id, {
        order_status: dbOrderStatus,
        tracking_data: trackingData,
        updated_at: nowIso
      });

      if (targetRequest) {
        try {
          await supabaseRest(`order_requests?id=eq.${encodeURIComponent(targetRequest.id)}`, {
            method: 'PATCH',
            body: {
              status: dbOrderStatus,
              admin_notes: notes ? `Inspection ${outcome}: ${notes}` : `Inspection ${outcome} by ${adminName}`,
              updated_at: nowIso
            }
          });
        } catch (_) {}
        await syncBackupStoreSettings({
          ...targetRequest,
          status: dbOrderStatus,
          admin_notes: notes ? `Inspection ${outcome}: ${notes}` : `Inspection ${outcome} by ${adminName}`,
          updated_at: nowIso
        });
      }

      return res.status(200).json({
        success: true,
        message: inspectionPassed
          ? 'Product inspection approved! Ready for Admin Refund or Replacement confirmation.'
          : 'Product inspection rejected. No refund will be issued.',
        status: newStatus,
        inspection: returnWorkflow.inspection
      });
    }

    // ========================================================================
    // ACTION: APPROVE REPLACEMENT (NO RAZORPAY REFUND)
    // ========================================================================
    if (action === 'approve_replacement') {
      const { replacement_size, replacement_notes } = payload || {};

      returnWorkflow.status = 'REPLACEMENT_APPROVED';
      returnWorkflow.resolution = 'replacement';
      returnWorkflow.replacement = {
        replacement_size: replacement_size || 'Standard Size',
        notes: replacement_notes || 'Approved for product replacement dispatch.',
        approved_by: adminName,
        approved_at: nowIso
      };
      trackingData.return_workflow = returnWorkflow;

      await updateOrder(targetOrder.id, {
        order_status: 'replacement_approved',
        tracking_data: trackingData,
        updated_at: nowIso
      });

      if (targetRequest) {
        try {
          await supabaseRest(`order_requests?id=eq.${encodeURIComponent(targetRequest.id)}`, {
            method: 'PATCH',
            body: {
              status: 'replacement_approved',
              refund_status: 'not_applicable',
              admin_notes: `Replacement approved (${replacement_size || 'Exchange'}). No financial refund required.`,
              updated_at: nowIso
            }
          });
        } catch (_) {}
        await syncBackupStoreSettings({
          ...targetRequest,
          status: 'replacement_approved',
          refund_status: 'not_applicable',
          admin_notes: `Replacement approved (${replacement_size || 'Exchange'}). No financial refund required.`,
          updated_at: nowIso
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Replacement approved! Replacement dispatch workflow initiated without Razorpay refund.',
        status: 'REPLACEMENT_APPROVED',
        replacement: returnWorkflow.replacement
      });
    }

    return res.status(400).json({ success: false, error: `Unrecognized action: "${action}"` });

  } catch (error) {
    console.error('[API admin/returns] Error:', error);
    return res.status(error.message?.includes('Access denied') ? 403 : (error.message?.includes('Authorization') ? 401 : 500)).json({
      success: false,
      error: error.message || 'Internal server error.'
    });
  }
};
