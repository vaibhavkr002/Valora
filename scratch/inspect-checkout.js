const fs = require('fs');

const checkoutCode = fs.readFileSync('js/checkout.js', 'utf8');

// Find occurrences of .from('orders') or insertOrder
let idx = 0;
while ((idx = checkoutCode.indexOf("from('orders')", idx)) !== -1) {
  console.log('--- orders occurrence at', idx, '---');
  console.log(checkoutCode.slice(Math.max(0, idx - 100), Math.min(checkoutCode.length, idx + 400)));
  idx += 15;
}

// Also check api/razorpay/create-order.js or api/razorpay/verify-payment.js
console.log('=== Checking api/razorpay/create-order.js ===');
if (fs.existsSync('api/razorpay/create-order.js')) {
  console.log(fs.readFileSync('api/razorpay/create-order.js', 'utf8').slice(0, 1000));
}
