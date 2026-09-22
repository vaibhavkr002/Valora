const fs = require('fs');
const path = require('path');

const ROOT = 'c:/Users/saanv/OneDrive/Desktop/Website/webu';
let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log(`✔ PASS: ${label}`);
    passed++;
  } else {
    console.error(`✖ FAIL: ${label}`);
    failed++;
  }
}

console.log('====================================================');
console.log('=== SAROJINI BAZAAR HERO UPGRADE VERIFICATION ===');
console.log('====================================================\n');

// 1. Check HTML
const htmlPath = path.join(ROOT, 'sarojini-bazaar.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('--- 1. Hero HTML Structure & Visual Identity ---');
check('Has hero-sarojini-identity block', html.includes('class="hero-sarojini-identity"'));
check('Contains "VADI PRESENTS" parent endorsement', html.includes('VADI PRESENTS'));
check('Contains prominent "SAROJINI BAZAAR" title text', html.includes('SAROJINI BAZAAR'));
check('Contains "SAROJINI NAGAR, NEW DELHI" authentic origin', html.includes('SAROJINI NAGAR, NEW DELHI'));
check('Contains hand-drawn brush accent SVG', html.includes('class="sarojini-identity-brush"'));
check('Contains "Original Delhi street" handwritten accent', html.includes('Original Delhi street'));
check('Preserves existing headline "Delhi\'s Iconic Street Bazaar. Curated & Delivered."', 
  html.includes('Delhi\'s Iconic Street Bazaar.') && html.includes('Curated &amp; Delivered.'));
check('Preserves existing hero CTA buttons', 
  html.includes('Explore Street Drops') && html.includes('Browse Bazaar Lanes'));
check('Preserves existing hero highlights', 
  html.includes('No Retail Markups') && html.includes('Hand-Checked Pieces') && html.includes('Cash on Delivery + Open Box'));
check('Preserves hero image asset assets/sarojni/sarh.png', 
  html.includes('src="assets/sarojni/sarh.png"'));

// 2. Check CSS
console.log('\n--- 2. Hero CSS & Staggered 3s Entrance Animations ---');
const cssPath = path.join(ROOT, 'css/sarojini-bazaar-page.css');
const css = fs.readFileSync(cssPath, 'utf8');

check('Defines .hero-sarojini-identity styling', css.includes('.hero-sarojini-identity {'));
check('Defines .sarojini-identity-title with serif & terracotta', 
  css.includes('.sarojini-identity-title') && css.includes('var(--bazaar-terracotta)'));
check('Defines @keyframes heroEntranceFadeUp', css.includes('@keyframes heroEntranceFadeUp'));
check('Defines @keyframes heroImageReveal', css.includes('@keyframes heroImageReveal'));
check('Defines @keyframes heroBadgeFadeIn', css.includes('@keyframes heroBadgeFadeIn'));

// Check staggered delays
check('Eyebrow .hero-tagline-wrap has entrance animation', 
  css.includes('.hero-tagline-wrap') && css.includes('heroEntranceFadeUp 0.7s cubic-bezier'));
check('Brand identity .hero-sarojini-identity has staggered entrance', 
  css.includes('.hero-sarojini-identity') && css.includes('heroEntranceFadeUp 0.75s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both'));
check('Headline .hero-title has staggered entrance', 
  css.includes('.hero-title') && css.includes('heroEntranceFadeUp 0.75s cubic-bezier(0.16, 1, 0.3, 1) 0.65s both'));
check('Subtitle .hero-subtitle has staggered entrance', 
  css.includes('.hero-subtitle') && css.includes('heroEntranceFadeUp 0.75s cubic-bezier(0.16, 1, 0.3, 1) 0.95s both'));
check('CTA actions .hero-actions has staggered entrance', 
  css.includes('.hero-actions') && css.includes('heroEntranceFadeUp 0.75s cubic-bezier(0.16, 1, 0.3, 1) 1.25s both'));
check('Highlights .hero-highlights has staggered entrance', 
  css.includes('.hero-highlights') && css.includes('heroEntranceFadeUp 0.75s cubic-bezier(0.16, 1, 0.3, 1) 1.55s both'));

// Check right visual composition
console.log('\n--- 3. Left Text & Right Image Visual Cohesion ---');
check('Visual container has refined border-left framing', css.includes('border-left: 1px solid rgba(223, 215, 200, 0.7)'));
check('Visual container has editorial depth vignette overlay', css.includes('.sarojini-hero-visual::after'));
check('Hero cover image has smooth reveal animation', 
  css.includes('.hero-cover-img') && css.includes('heroImageReveal 1.05s cubic-bezier'));
check('Floating badges have frosted glass styling and reveal animations', 
  css.includes('.hero-floating-badge') && css.includes('backdrop-filter: blur(12px)'));

// Check accessibility
console.log('\n--- 4. Accessibility & Mobile Responsiveness ---');
check('Has prefers-reduced-motion media query to disable animations for accessibility', 
  css.includes('@media (prefers-reduced-motion: reduce)'));
check('Has tablet responsive rules for .sarojini-identity-title', 
  css.includes('.sarojini-identity-title {\n    font-size: 1.75rem'));
check('Has mobile responsive rules for .sarojini-identity-title at 480px', 
  css.includes('.sarojini-identity-title {\n    font-size: 1.45rem'));

console.log('\n====================================================');
console.log(`=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
console.log('====================================================');

if (failed > 0) process.exit(1);

