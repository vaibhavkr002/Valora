const fs = require('fs');
const path = require('path');

const ROOT = 'c:\\Users\\saanv\\OneDrive\\Desktop\\Website\\webu';
const ignoreDirs = new Set(['.git', 'node_modules', 'edge_profile', 'edge_profile_diag', 'edge_profile_test', 'edge_profile_full', '.gemini', 'scratch']);

const allMatches = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (!ignoreDirs.has(ent.name)) walk(path.join(dir, ent.name));
    } else {
      const ext = path.extname(ent.name).toLowerCase();
      if (['.html', '.js', '.css', '.json', '.md'].includes(ext)) {
        const fullPath = path.join(dir, ent.name);
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const relPath = path.relative(ROOT, fullPath);
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (/vadi/i.test(line)) {
              allMatches.push({
                file: relPath,
                line: idx + 1,
                text: line.trim()
              });
            }
          });
        } catch (e) {}
      }
    }
  }
}

walk(ROOT);

console.log('Total remaining VADI matches across repo:', allMatches.length);

const categorized = {
  customerFacing: [],
  emailOrPayment: [],
  internalCodeOrCss: [],
  commentsOrDocs: []
};

allMatches.forEach(m => {
  const t = m.text;
  if (/support@vadistudio\.com|press@vadistudio\.com|concierge@vadi\.in|admin@vadi\.com|customer@vadi\.in|vadi\.lifestyle@okhdfcbank/i.test(t)) {
    categorized.emailOrPayment.push(m);
  } else if (/^\s*(\/\/|\/\*|\*|<!--|#)/.test(t)) {
    categorized.commentsOrDocs.push(m);
  } else if (/vadi-sarojini-bazaar|vadi-cross-promo-pill|vadi-pill|VadiWishlist|VadiCart|VadiAuth|VadiSearchUtils|VadiSarojiniSearch|VadiHomepageSections|vadi:wishlist-updated|kpi-vadi-ads|card-store-vadi|ad-store-vadi|ad-vadi|store:\s*'vadi'|storeVal === 'vadi'|target_store.*'vadi'|store_type === 'vadi'|catalog_type === 'vadi'|vadiProducts|vadiCategories/i.test(t)) {
    categorized.internalCodeOrCss.push(m);
  } else {
    categorized.customerFacing.push(m);
  }
});

console.log('\n--- EMAIL OR PAYMENT IDENTIFIERS (Preserved per rules 8 & 15):', categorized.emailOrPayment.length);
console.log('--- INTERNAL CODE / SELECTORS / VARS (Preserved per rule 7):', categorized.internalCodeOrCss.length);
console.log('--- COMMENTS / DOCS:', categorized.commentsOrDocs.length);
console.log('--- POTENTIAL CUSTOMER-FACING OCCURRENCES:', categorized.customerFacing.length);

if (categorized.customerFacing.length > 0) {
  console.log('\n⚠️ DETAILS OF POTENTIAL CUSTOMER-FACING OCCURRENCES:');
  categorized.customerFacing.forEach(c => {
    console.log(`  ${c.file}:${c.line} -> ${c.text}`);
  });
}

