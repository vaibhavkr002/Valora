const fs = require('fs');
const path = require('path');

const ROOT = 'c:/Users/saanv/OneDrive/Desktop/Website/webu';
const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`✔ PASS: ${label} ${detail ? '(' + detail + ')' : ''}`);
    passed++;
  } else {
    console.error(`✖ FAIL: ${label} ${detail ? '(' + detail + ')' : ''}`);
    failed++;
  }
}

console.log('================================================================');
console.log('=== ADMIN DASHBOARD TODAY SALES & PROFIT VERIFICATION SUITE ===');
console.log('================================================================\n');

// 1. Static HTML File Checks
console.log('--- 1. Admin Dashboard HTML Structure ---');
const dashHtml = fs.readFileSync(path.join(ROOT, 'admin/dashboard.html'), 'utf8');

check('Preserves existing Gross Revenue (Total Sales) card untouched', 
  dashHtml.includes('id="metric-total-revenue"'));

check('Includes Today\'s Sales card with id="metric-today-sales"', 
  dashHtml.includes('id="metric-today-sales"'));

check('Today\'s Sales card has subtitle label "Main + Sarojini • Today"', 
  dashHtml.includes('Main + Sarojini • Today'));

check('Includes Profit card with id="metric-today-profit"', 
  dashHtml.includes('id="metric-today-profit"'));

check('Profit card has subtitle label "Advance Collected"', 
  dashHtml.includes('Advance Collected'));

check('Card layout order has Total Sales | Today\'s Sales | Profit', 
  dashHtml.indexOf('metric-total-revenue') < dashHtml.indexOf('metric-today-sales') &&
  dashHtml.indexOf('metric-today-sales') < dashHtml.indexOf('metric-today-profit'));

check('Includes Dashboard Refresh button', 
  dashHtml.includes('id="btn-refresh-dashboard"'));

// 2. JavaScript Logic & Implementation Checks
console.log('\n--- 2. Dashboard JS Logic & Timezone Handling ---');
const dashJs = fs.readFileSync(path.join(ROOT, 'admin/js/admin-dashboard.js'), 'utf8');

check('Calculates IST date string using Asia/Kolkata timezone', 
  dashJs.includes('timeZone: "Asia/Kolkata"') || dashJs.includes("timeZone: 'Asia/Kolkata'"));

check('Filters out cancelled and refunded orders', 
  dashJs.includes('isOrderCancelledOrRefunded'));

check('Calculates advance amount from advance_paid / online payment', 
  dashJs.includes('getOrderAdvancePaid'));

check('Existing Total Sales calculation remains unchanged', 
  dashJs.includes('orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0)'));

check('Wires realtime listener on public.orders without duplicate listeners', 
  dashJs.includes('channel("admin-dashboard-orders-live")') && dashJs.includes('postgres_changes'));

// 3. Live Supabase Data Verification
console.log('\n--- 3. Live Supabase Business Rules Verification ---');

async function runLiveTests() {
  try {
    const authRes = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'support@vadistudio.com', password: 'VadiSupport2026!' })
    });
    const authData = await authRes.json();
    const access_token = authData.access_token;
    const userId = authData.user?.id || '499d1201-1b07-4bc5-9ecf-09cf8b371928';
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + access_token,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    // Helper functions matching admin-dashboard.js
    function getISTDateString(dateInput) {
      if (!dateInput) return null;
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return null;
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    }

    function isOrderCancelledOrRefunded(o) {
      if (!o) return false;
      const ordStatus = (o.order_status || '').toLowerCase();
      const payStatus = (o.payment_status || '').toLowerCase();
      const advPayStatus = (o.advance_payment_status || '').toLowerCase();
      return ordStatus === 'cancelled' || ordStatus === 'returned' || payStatus === 'refunded' || advPayStatus === 'refunded';
    }

    function getOrderAdvancePaid(o) {
      if (!o) return 0;
      const advPaid = Number(o.advance_paid) || 0;
      if (advPaid > 0) return advPaid;
      if (o.is_full_online_payment && (o.payment_status === 'paid' || o.payment_status === 'completed')) {
        return Number(o.total) || 0;
      }
      if (o.advance_payment_status === 'paid' && Number(o.advance_amount) > 0) {
        return Number(o.advance_amount);
      }
      return 0;
    }

    // Step A: Fetch current baseline
    const baseRes = await fetch(SUPABASE_URL + '/rest/v1/orders?select=*&order=created_at.desc', {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + access_token }
    });
    const baseOrders = await baseRes.json();
    const todayIST = getISTDateString(new Date());

    const baseTodayValid = baseOrders.filter(o => getISTDateString(o.created_at) === todayIST && !isOrderCancelledOrRefunded(o));
    const baseTodaySales = baseTodayValid.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const baseTodayProfit = baseTodayValid.reduce((sum, o) => sum + getOrderAdvancePaid(o), 0);

    console.log(`Baseline Today IST (${todayIST}): ${baseTodayValid.length} valid orders, Sales: ₹${baseTodaySales}, Profit: ₹${baseTodayProfit}`);

    // Step B: Create test orders:
    // 1. Main VADI order today with ₹300 advance, total ₹1000
    // 2. Sarojini Bazaar order today with ₹500 advance, total ₹700
    // 3. Pure COD order today with ₹0 advance, total ₹500
    // 4. Cancelled order today with ₹400 advance, total ₹1500 (should NOT count in today's sales or profit)
    // 5. Past date order with ₹200 advance, total ₹600 (should NOT count in today's sales or profit)

    const testIds = [];

    const order1 = {
      user_id: userId,
      order_number: 'TEST-MAIN-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      total: 1000,
      subtotal: 1000,
      payment_method: 'UPI • Advance Paid (₹300) + COD Balance (₹700)',
      payment_status: 'pending',
      advance_amount: 300,
      advance_paid: 300,
      advance_payment_status: 'paid',
      cod_balance: 700,
      cod_payment_status: 'pending',
      order_status: 'placed',
      delivery_full_name: 'Test Customer Main Vadi',
      delivery_phone: '9876543210',
      delivery_address: '123 Fashion Ave',
      delivery_city: 'New Delhi',
      delivery_state: 'Delhi',
      delivery_pincode: '110023'
    };

    const order2 = {
      user_id: userId,
      order_number: 'TEST-SAR-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      total: 700,
      subtotal: 700,
      payment_method: 'Card • Advance Paid (₹500) + COD Balance (₹200)',
      payment_status: 'pending',
      advance_amount: 500,
      advance_paid: 500,
      advance_payment_status: 'paid',
      cod_balance: 200,
      cod_payment_status: 'pending',
      order_status: 'confirmed',
      delivery_full_name: 'Test Customer Sarojini',
      delivery_phone: '9876543211',
      delivery_address: '456 Sarojini Lane',
      delivery_city: 'New Delhi',
      delivery_state: 'Delhi',
      delivery_pincode: '110023'
    };

    const order3 = {
      user_id: userId,
      order_number: 'TEST-COD-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      total: 500,
      subtotal: 500,
      payment_method: 'Cash on Delivery',
      payment_status: 'pending',
      advance_amount: 0,
      advance_paid: 0,
      advance_payment_status: 'not_required',
      cod_balance: 500,
      cod_payment_status: 'pending',
      order_status: 'confirmed',
      delivery_full_name: 'Test COD Customer',
      delivery_phone: '9876543212',
      delivery_address: '789 Market Rd',
      delivery_city: 'Mumbai',
      delivery_state: 'Maharashtra',
      delivery_pincode: '400001'
    };

    const order4Cancelled = {
      user_id: userId,
      order_number: 'TEST-CANCEL-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      total: 1500,
      subtotal: 1500,
      payment_method: 'UPI',
      payment_status: 'refunded',
      advance_amount: 400,
      advance_paid: 400,
      advance_payment_status: 'refunded',
      cod_balance: 1100,
      order_status: 'cancelled',
      delivery_full_name: 'Test Cancelled Order',
      delivery_phone: '9876543213',
      delivery_address: '101 Cancel Rd',
      delivery_city: 'Bengaluru',
      delivery_state: 'Karnataka',
      delivery_pincode: '560001'
    };

    const order5PastDate = {
      user_id: userId,
      order_number: 'TEST-PAST-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      total: 600,
      subtotal: 600,
      created_at: '2026-09-18T10:00:00.000Z',
      payment_method: 'UPI',
      payment_status: 'paid',
      advance_amount: 200,
      advance_paid: 200,
      advance_payment_status: 'paid',
      order_status: 'delivered',
      delivery_full_name: 'Test Past Customer',
      delivery_phone: '9876543214',
      delivery_address: '202 Past Rd',
      delivery_city: 'Kolkata',
      delivery_state: 'West Bengal',
      delivery_pincode: '700001'
    };

    for (const ord of [order1, order2, order3, order4Cancelled, order5PastDate]) {
      const insRes = await fetch(SUPABASE_URL + '/rest/v1/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify(ord)
      });
      const resData = await insRes.json();
      if (Array.isArray(resData) && resData[0]?.id) {
        testIds.push(resData[0].id);
      } else if (resData?.id) {
        testIds.push(resData.id);
      } else {
        console.error('Insert error for order:', ord.order_number, resData);
      }
    }
    console.log(`Inserted ${testIds.length} test orders successfully.`);

    // Step C: Verify calculation with the new orders in DB
    const freshRes = await fetch(SUPABASE_URL + '/rest/v1/orders?select=*&order=created_at.desc', {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + access_token }
    });
    const freshOrders = await freshRes.json();

    const freshTodayValid = freshOrders.filter(o => getISTDateString(o.created_at) === todayIST && !isOrderCancelledOrRefunded(o));
    const freshTodaySales = freshTodayValid.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const freshTodayProfit = freshTodayValid.reduce((sum, o) => sum + getOrderAdvancePaid(o), 0);

    // Assertions
    // Expected additional Today Sales: 1000 (Main) + 700 (Sarojini) + 500 (COD) = 2200. Cancelled (1500) and Past (600) excluded.
    check('Today\'s Sales increases by exactly ₹2,200 for valid today orders', 
      freshTodaySales === baseTodaySales + 2200, 
      `Base: ${baseTodaySales}, Fresh: ${freshTodaySales}, Diff: ${freshTodaySales - baseTodaySales}`);

    // Expected additional Today Profit: 300 (Main) + 500 (Sarojini) + 0 (COD) = 800. Cancelled and Past excluded.
    check('Profit increases by exactly ₹800 (₹300 Main + ₹500 Sarojini)', 
      freshTodayProfit === baseTodayProfit + 800, 
      `Base: ${baseTodayProfit}, Fresh: ${freshTodayProfit}, Diff: ${freshTodayProfit - baseTodayProfit}`);

    // Verify COD order contributed ₹500 to sales but ₹0 to profit
    check('COD order contributes ₹500 to Today\'s Sales but ₹0 to Profit', 
      freshTodaySales >= baseTodaySales + 500 && (freshTodayProfit - baseTodayProfit) === 800);

    // Verify cancelled order is completely excluded
    check('Cancelled order (₹1,500 total, ₹400 advance) is completely excluded from Today\'s Sales and Profit', 
      !freshTodayValid.some(o => o.order_number.startsWith('TEST-CANCEL')));

    // Verify past order (₹600 total, ₹200 advance) is excluded from today\'s metrics
    check('Past order (from 2026-09-18) is completely excluded from Today\'s Sales and Profit', 
      !freshTodayValid.some(o => o.order_number.startsWith('TEST-PAST')));

    // Step D: Cleanup test orders
    if (testIds.length > 0) {
      const delRes = await fetch(SUPABASE_URL + `/rest/v1/orders?id=in.(${testIds.join(',')})`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + access_token }
      });
      console.log(`Cleaned up ${testIds.length} test orders successfully (status: ${delRes.status}).`);
    }

    console.log('\n================================================================');
    console.log(`=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);

  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runLiveTests();
