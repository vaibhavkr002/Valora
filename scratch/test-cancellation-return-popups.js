const fs = require('fs');
const path = require('path');

console.log('--- TESTING CANCEL & RETURN POPUP SYSTEM ---');

const accountHtml = fs.readFileSync(path.join(__dirname, '..', 'account.html'), 'utf8');
const adminOrderDetailsJs = fs.readFileSync(path.join(__dirname, '..', 'admin', 'js', 'admin-order-details.js'), 'utf8');

let errors = [];

// 1. Check body.velora-modal-open CSS
if (!accountHtml.includes('body.velora-modal-open .velora-order-activity')) {
  errors.push('account.html missing body.velora-modal-open CSS to suppress live order activity');
}

// 2. Check Cancel Modal Elements
const cancelElements = [
  'id="cancel-order-modal-overlay"',
  'id="cancel-modal-order-number"',
  'id="cancel-shipped-alert"',
  'id="cancel-eligible-content"',
  'id="cancel-refund-notice-box"',
  'id="cancel-order-summary-box"',
  'id="cancel-order-summary-details"',
  'id="btn-keep-my-order"',
  'id="btn-submit-cancellation"',
  'id="cancel-custom-reason-wrap"',
  'id="cancel-custom-reason"'
];
cancelElements.forEach(el => {
  if (!accountHtml.includes(el)) {
    errors.push(`account.html missing cancel modal element: ${el}`);
  }
});

// 3. Check 7 Cancellation Reasons
const cancelReasons = [
  'Changed my mind',
  'Ordered by mistake',
  'Found a better price',
  'Delivery is taking too long',
  'Product is no longer required',
  'Ordered the wrong product/size',
  'Other'
];
cancelReasons.forEach(r => {
  if (!accountHtml.includes(`value="${r}"`)) {
    errors.push(`account.html missing cancel reason: ${r}`);
  }
});

// 4. Check Return Modal Elements
const returnElements = [
  'id="return-order-modal-overlay"',
  'id="return-modal-order-number"',
  'id="return-items-selection-container"',
  'id="return-custom-reason-wrap"',
  'id="return-custom-reason"',
  'id="return-description"',
  'id="return-photo-input"',
  'id="btn-submit-return"'
];
returnElements.forEach(el => {
  if (!accountHtml.includes(el)) {
    errors.push(`account.html missing return modal element: ${el}`);
  }
});

// 5. Check 7 Return Reasons
const returnReasons = [
  'Wrong product received',
  'Damaged product',
  'Defective product',
  'Size/Fit issue',
  'Product not as expected',
  'Missing item',
  'Other'
];
returnReasons.forEach(r => {
  if (!accountHtml.includes(`value="${r}"`)) {
    errors.push(`account.html missing return reason: ${r}`);
  }
});

// 6. Check JS class velora-modal-open toggle
if (!accountHtml.includes('document.body.classList.add("velora-modal-open")') || 
    !accountHtml.includes('document.body.classList.remove("velora-modal-open")')) {
  errors.push('account.html missing velora-modal-open class toggle in JS');
}

// 7. Check Shipped alert logic in JS
if (!accountHtml.includes('isShippedOrIneligible') || !accountHtml.includes('cancelShippedAlert.style.display = "block"')) {
  errors.push('account.html missing shipped alert display logic in JS');
}

// 8. Check Payment-specific refund notice in JS
if (!accountHtml.includes('Prepaid Advance Refund Notice') || 
    !accountHtml.includes('Online Payment Refund') || 
    !accountHtml.includes('No online payment was made for this order, so there is no prepaid amount to refund.')) {
  errors.push('account.html missing payment-specific refund text');
}

// 9. Check Admin Order Details: 9 fields in Request Card
const adminFields = [
  'Request ID:',
  'Order Number / ID:',
  'Customer:',
  'Request Type:',
  'Reason:',
  'Requested On:',
  'Current Status:'
];
adminFields.forEach(f => {
  if (!adminOrderDetailsJs.includes(f)) {
    errors.push(`admin-order-details.js missing field in Request Card: ${f}`);
  }
});

// 10. Check Admin Order Details: No fake refund (refund_processing used instead of direct refunded)
if (!adminOrderDetailsJs.includes('targetRefundStatus = isRefundApplicable ? "refund_processing" : "not_applicable"')) {
  errors.push('admin-order-details.js not setting refund_processing upon cancellation approval');
}

if (!adminOrderDetailsJs.includes('btn-admin-disburse-refund')) {
  errors.push('admin-order-details.js missing action to mark refund disbursed/completed');
}

if (errors.length > 0) {
  console.error('FAILED with errors:');
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
} else {
  console.log('ALL 10 CHECKS PASSED PERFECTLY!');
  process.exit(0);
}

