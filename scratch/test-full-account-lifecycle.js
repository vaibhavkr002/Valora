const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

async function run() {
  console.log('=== FULL ACCOUNT LIFECYCLE & NEW USER PROFILE TEST ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. Register a fresh account
  const timestamp = Date.now();
  const testEmail = `new_account_${timestamp}@vadi.com`;
  const testPassword = `VadiPass${timestamp}!`;
  const initialName = `Fresh Customer ${timestamp.toString().slice(-4)}`;

  console.log(`1. Registering new user: ${testEmail}`);
  const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      data: {
        full_name: initialName,
        phone: '+91 91234 56789'
      }
    })
  });

  const signupData = await signupRes.json();
  assert(signupRes.status === 200 && signupData.user, 'New customer registration completed');
  const newUser = signupData.user;
  const token = signupData.access_token || signupData.session?.access_token;

  let userToken = token;
  if (!userToken) {
    // Sign in if session token wasn't returned immediately
    const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    const loginData = await loginRes.json();
    userToken = loginData.access_token;
  }

  assert(!!userToken, 'Obtained valid authentication JWT for new user');

  const authHeaders = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // 2. Verify Profile Exists (via handle_new_user trigger or fallback)
  console.log('\n2. Verifying profile record in Supabase:');
  const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${newUser.id}&select=*`, {
    headers: authHeaders
  });
  const profiles = await profRes.json();
  assert(Array.isArray(profiles) && profiles.length > 0, 'Profile record verified in Supabase for newly created user');
  const prof = profiles[0];
  console.log('Profile created in DB:', prof);
  assert(prof.email === testEmail, 'Profile email matches authenticated user email');
  assert(prof.full_name === initialName, 'Profile full_name matches registration metadata');

  // 3. Save Full Name & Mobile Number updates
  console.log('\n3. Testing profile modification (saving new Full Name and Phone):');
  const updatedFullName = `Updated ${initialName}`;
  const updatedPhone = '+91 99887 76655';

  const updateProfRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${newUser.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      full_name: updatedFullName,
      phone: updatedPhone,
      updated_at: new Date().toISOString()
    })
  });
  const updateData = await updateProfRes.json();
  assert(updateProfRes.status === 200 && updateData.length > 0, 'Profile record updated successfully');
  assert(updateData[0].full_name === updatedFullName, 'Updated full_name matches');
  assert(updateData[0].phone === updatedPhone, 'Updated phone matches');

  // Also update auth user metadata (as account.html does)
  const updateAuthRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      data: { full_name: updatedFullName, phone: updatedPhone }
    })
  });
  const updateAuthData = await updateAuthRes.json();
  assert(updateAuthRes.status === 200 && updateAuthData.user_metadata?.full_name === updatedFullName, 'Auth user metadata updated');

  // 4. Simulate Page Refresh / Re-login
  console.log('\n4. Simulating page refresh and re-fetching profile:');
  const reauthRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  const reauthData = await reauthRes.json();
  const refreshedToken = reauthData.access_token;
  const refreshedHeaders = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${refreshedToken}`,
    'Content-Type': 'application/json'
  };

  const reloadedProfRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${newUser.id}&select=*`, {
    headers: refreshedHeaders
  });
  const reloadedProfiles = await reloadedProfRes.json();
  assert(reloadedProfiles[0].full_name === updatedFullName, 'Full Name persisted across sessions');
  assert(reloadedProfiles[0].phone === updatedPhone, 'Phone number persisted across sessions');

  // 5. Verify Consistent User Identity Across Sections
  console.log('\n5. Verifying user identity consistency across Orders, Addresses, Wishlist:');
  // Orders query
  const ordersRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?user_id=eq.${newUser.id}&select=id`, {
    headers: refreshedHeaders
  });
  assert(ordersRes.status === 200, 'Orders query scoped to user_id succeeds');

  // Addresses query
  const addrRes = await fetch(`${SUPABASE_URL}/rest/v1/addresses?user_id=eq.${newUser.id}&select=id`, {
    headers: refreshedHeaders
  });
  assert(addrRes.status === 200, 'Addresses query scoped to user_id succeeds');

  // Wishlist query
  const wishRes = await fetch(`${SUPABASE_URL}/rest/v1/wishlist?user_id=eq.${newUser.id}&select=id`, {
    headers: refreshedHeaders
  });
  assert(wishRes.status === 200, 'Wishlist query scoped to user_id succeeds');

  // 6. Sign out simulation (verifying token revocation/clearing)
  console.log('\n6. Simulating sign out:');
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${refreshedToken}` }
  });
  console.log('User signed out.');

  // Accessing protected profile without valid token
  const unauthRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${newUser.id}&select=*`, {
    headers: { 'apikey': SUPABASE_ANON_KEY }
  });
  const unauthData = await unauthRes.json();
  assert(Array.isArray(unauthData) && unauthData.length === 0, 'Protected profile inaccessible without authentication');

  // 7. Cleanup
  console.log('\n7. Cleaning up test user profile:');
  const adminAuthRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'support@vadistudio.com', password: 'VadiSupport2026!' })
  });
  const adminAuth = await adminAuthRes.json();
  const adminHeaders = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${adminAuth.access_token}`
  };
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${newUser.id}`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  console.log('Cleaned up test profile row.');

  console.log(`\n========================================`);
  console.log(`Total tests passed: ${passed}`);
  console.log(`Total tests failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

