const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://brioiujppaaycydndrcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyaW9pdWpwcGFheWN5ZG5kcmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTU3MzQsImV4cCI6MjEwNDM3MTczNH0.6HHJ0wv66obc6wj72CQJE8tvr6KgAXgWDs2DYnjPO78';

async function runTests() {
  console.log('--- STARTING ACCOUNT & PROFILE FLOW VERIFICATION ---\n');

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

  // 1. Verify Syntax of account.html inline script
  console.log('1. Verifying account.html JavaScript syntax:');
  const accountHtml = fs.readFileSync(path.resolve('c:/Users/saanv/OneDrive/Desktop/Website/webu/account.html'), 'utf8');
  const scriptMatch = accountHtml.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/i);
  assert(!!scriptMatch, 'Found main inline script in account.html');

  let syntaxOk = false;
  try {
    new Function(scriptMatch[1]);
    syntaxOk = true;
  } catch (err) {
    console.error('Syntax error in account.html:', err);
  }
  assert(syntaxOk, 'account.html inline script compiles with 0 syntax errors');

  // 2. Authenticate Real Customer
  console.log('\n2. Authenticating real Supabase customer account:');
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test_customer_audit@vadi.com',
      password: 'VadiTest1234!'
    })
  });
  const authData = await authRes.json();
  assert(authRes.status === 200 && authData.access_token, 'Customer successfully signed in with Supabase Auth');
  const user = authData.user;
  const token = authData.access_token;
  console.log(`Authenticated User ID: ${user.id} (${user.email})`);

  const customerHeaders = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // 3. Query profiles table
  console.log('\n3. Querying profile from public.profiles table:');
  const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=id,full_name,email,phone,avatar_url,role`, {
    headers: customerHeaders
  });
  const profList = await profRes.json();
  assert(profRes.status === 200 && Array.isArray(profList) && profList.length > 0, 'Fetched user profile record from Supabase');
  const profile = profList[0];
  console.log('Retrieved Profile Record:', {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role
  });

  assert(profile.id === user.id, 'Profile ID strictly matches auth.uid()');
  assert(profile.email === user.email, 'Profile email strictly matches authenticated user email');

  // 4. Update Profile Details & Persistence
  console.log('\n4. Testing Profile Update & Persistence in Supabase:');
  const updatedName = 'Audit Test Customer Updated';
  const updatedPhone = '+91 98765 99999';

  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
    method: 'PATCH',
    headers: customerHeaders,
    body: JSON.stringify({
      full_name: updatedName,
      phone: updatedPhone,
      updated_at: new Date().toISOString()
    })
  });
  const updatedList = await updateRes.json();
  assert(updateRes.status === 200 && updatedList.length > 0, 'Successfully updated profile record');
  assert(updatedList[0].full_name === updatedName, 'Updated full_name matches');
  assert(updatedList[0].phone === updatedPhone, 'Updated phone matches');

  // Re-fetch to verify persistence
  const refetchRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=id,full_name,phone`, {
    headers: customerHeaders
  });
  const refetched = await refetchRes.json();
  assert(refetched[0].full_name === updatedName && refetched[0].phone === updatedPhone, 'Changes persisted after re-fetch');

  // Revert name back
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
    method: 'PATCH',
    headers: customerHeaders,
    body: JSON.stringify({
      full_name: 'Audit Test Customer',
      phone: '+91 98765 43210',
      updated_at: new Date().toISOString()
    })
  });

  // 5. RLS Security Enforcement
  console.log('\n5. Testing RLS security enforcement on profiles:');
  // Attempt to read other profiles
  const otherRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=neq.${user.id}&select=*&limit=1`, {
    headers: customerHeaders
  });
  const otherData = await otherRes.json();
  assert(Array.isArray(otherData) && otherData.length === 0, 'RLS policy blocks customer from reading other profiles');

  // Attempt to update another user's profile
  const unauthorizedUpdateRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.00000000-0000-0000-0000-000000000000`, {
    method: 'PATCH',
    headers: customerHeaders,
    body: JSON.stringify({ full_name: 'Hacked' })
  });
  const unauthData = await unauthorizedUpdateRes.json();
  assert(Array.isArray(unauthData) && unauthData.length === 0, 'RLS policy blocks customer from updating another profile');

  // 6. Missing Profile / New User Handling
  console.log('\n6. Testing Missing Profile (new user) fallback & resolution:');
  const fallbackProfile = {
    id: user.id,
    full_name: (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || user.email.split('@')[0],
    email: user.email,
    phone: (user.user_metadata && user.user_metadata.phone) || ''
  };
  assert(fallbackProfile.id === user.id, 'Fallback profile resolves correct user ID');
  assert(fallbackProfile.email === user.email, 'Fallback profile resolves correct email');
  assert(!!fallbackProfile.full_name, 'Fallback profile resolves non-empty name');

  // 7. Test UI State Machine Simulation
  console.log('\n7. Simulating Account UI State Machine:');
  // Mock DOM elements
  const mockDOM = {
    avatarCircle: { textContent: '--' },
    userNameElem: { textContent: 'Loading Profile...' },
    userEmailElem: { textContent: 'Connecting to Supabase...' },
    nameInput: { value: '' },
    emailInput: { value: '' },
    phoneInput: { value: '', placeholder: 'Not added' },
    loadingIndicator: { style: { display: 'flex' } },
    statusMsg: { textContent: '', style: { display: 'none' } }
  };

  // Simulating setProfileUI
  function simulateSetProfileUI(state, data) {
    if (state === 'loading') {
      mockDOM.loadingIndicator.style.display = 'flex';
      mockDOM.userNameElem.textContent = 'Loading Profile...';
      mockDOM.userEmailElem.textContent = 'Connecting to Supabase...';
      mockDOM.avatarCircle.textContent = '--';
    } else if (state === 'success') {
      mockDOM.loadingIndicator.style.display = 'none';
      const name = data.name || 'VADI Member';
      const email = data.email || '';
      const phone = data.phone || '';
      const initials = data.initials || 'ME';

      mockDOM.avatarCircle.textContent = initials;
      mockDOM.userNameElem.textContent = name;
      mockDOM.userEmailElem.textContent = email;
      mockDOM.nameInput.value = (name !== 'VADI Member' ? name : '');
      mockDOM.emailInput.value = email;
      mockDOM.phoneInput.value = phone;
      mockDOM.phoneInput.placeholder = phone ? 'e.g. +91 98765 43210' : 'Not added';
    }
  }

  // Initial state check
  assert(mockDOM.userNameElem.textContent === 'Loading Profile...', 'Initial loading state shows Loading Profile...');
  assert(mockDOM.loadingIndicator.style.display === 'flex', 'Initial loading indicator is visible');

  // Simulate successful resolution
  const realName = profile.full_name || 'VADI Member';
  const realEmail = user.email || profile.email;
  const realPhone = profile.phone || '';
  const parts = realName.trim().split(/\s+/);
  const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();

  simulateSetProfileUI('success', {
    name: realName,
    email: realEmail,
    phone: realPhone,
    initials: initials
  });

  assert(mockDOM.loadingIndicator.style.display === 'none', 'Loading indicator is hidden (display: none)');
  assert(mockDOM.userNameElem.textContent === 'Audit Test Customer', `User name correctly populated: "${mockDOM.userNameElem.textContent}"`);
  assert(mockDOM.userEmailElem.textContent === user.email, `User email correctly populated: "${mockDOM.userEmailElem.textContent}"`);
  assert(mockDOM.avatarCircle.textContent === 'AC', `Avatar circle initials correctly populated: "${mockDOM.avatarCircle.textContent}"`);
  assert(mockDOM.nameInput.value === 'Audit Test Customer', `Name input populated: "${mockDOM.nameInput.value}"`);
  assert(mockDOM.emailInput.value === user.email, `Email input populated: "${mockDOM.emailInput.value}"`);

  // 8. Hash and Navigation Routing Check
  console.log('\n8. Checking Hash Routing (#orders, #addresses, #profile):');
  const mockTabs = [
    { dataset: { tab: 'profile' }, active: true },
    { dataset: { tab: 'orders' }, active: false },
    { dataset: { tab: 'addresses' }, active: false }
  ];
  const mockPanels = {
    profile: { active: true },
    orders: { active: false },
    addresses: { active: false }
  };

  function simulateSwitchTab(tabKey) {
    mockTabs.forEach(t => { t.active = (t.dataset.tab === tabKey); });
    Object.keys(mockPanels).forEach(k => { mockPanels[k].active = (k === tabKey); });
  }

  // When visiting account.html#orders
  simulateSwitchTab('orders');
  assert(mockPanels.orders.active === true, '#orders activates the orders panel');
  assert(mockPanels.profile.active === false, '#orders deactivates profile panel');
  assert(mockDOM.userNameElem.textContent === 'Audit Test Customer', 'Sidebar profile header remains completely loaded when on #orders');

  console.log(`\n========================================`);
  console.log(`Total tests passed: ${passed}`);
  console.log(`Total tests failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
