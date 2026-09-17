const fs = require('fs');

const original = fs.readFileSync('css/promotions.css', 'utf8');

const newTop = `/**
 * VELORA — Premium BOGO & Trending Promotional Elements Stylesheet
 * 
 * Luxury 3D styling, glassmorphism, depth elevations, and responsive layouts
 * for storefront promotional campaigns.
 */

/* ==========================================================================
   1. SINGLE TOP ANNOUNCEMENT BAR (Dynamic Advertisement Hook)
   ========================================================================== */
.top-announcement-bar {
  position: relative;
  background: linear-gradient(90deg, #090d16 0%, #0f172a 50%, #090d16 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: #f8fafc;
  font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  font-size: 0.78rem;
  line-height: 1.3;
  transition: max-height 300ms ease, opacity 300ms ease;
  z-index: 100;
}

.top-announcement-bar .inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 7px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.top-announcement-bar .announcement-carousel {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-height: 22px;
  overflow: hidden;
}

.top-announcement-bar .announcement-slide {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  white-space: nowrap;
  transition: opacity 360ms cubic-bezier(0.16, 1, 0.3, 1), transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
}

.top-announcement-bar .announcement-slide.active {
  position: relative;
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.top-announcement-bar .announcement-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.28);
  color: #fbbf24;
  font-weight: 800;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 6px;
  text-transform: uppercase;
  backdrop-filter: blur(4px);
  flex-shrink: 0;
}

.top-announcement-bar .announcement-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-announcement-bar .announcement-text-label {
  font-weight: 600;
  color: #ffffff;
}

.top-announcement-bar .announcement-sep {
  color: rgba(255, 255, 255, 0.3);
  margin: 0 4px;
}

.top-announcement-bar .announcement-sub-label {
  color: #cbd5e1;
  font-weight: 400;
}

.top-announcement-bar .announcement-code-wrap {
  color: #cbd5e1;
}

.top-announcement-bar .announcement-code {
  color: #38bdf8;
  font-weight: 700;
  background: rgba(56, 189, 248, 0.12);
  padding: 1px 6px;
  border-radius: 4px;
  cursor: pointer;
}

.top-announcement-bar .announcement-action-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #93c5fd;
  text-decoration: none;
  font-weight: 700;
  margin-left: 6px;
  transition: color 150ms ease, transform 150ms ease;
  white-space: nowrap;
}

.top-announcement-bar .announcement-action-link:hover {
  color: #60a5fa;
  transform: translateX(2px);
}

.top-announcement-bar .top-bar-right-links {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.74rem;
  color: #94a3b8;
  white-space: nowrap;
  flex-shrink: 0;
}

.top-announcement-bar .top-bar-right-links a {
  color: #cbd5e1;
  text-decoration: none;
  transition: color 150ms ease;
}

.top-announcement-bar .top-bar-right-links a:hover {
  color: #ffffff;
}

/* ==========================================================================
   2. DYNAMIC ADVERTISEMENT SLOTS (3:1 / 3.5:1 E-Commerce Rectangular Cards)
   ========================================================================== */
.velora-ad-slot {
  margin: 28px 0;
  width: 100%;
}

.velora-ad-card {
  position: relative;
  width: 100%;
  min-height: 220px;
  border-radius: 20px;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 36px 48px;
  box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.12);
  transition: transform 280ms ease, box-shadow 280ms ease;
}

.velora-ad-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 48px -10px rgba(0, 0, 0, 0.45);
}

.velora-ad-content {
  position: relative;
  z-index: 2;
  max-width: 580px;
}

.velora-ad-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.28);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #fbbf24;
  text-transform: uppercase;
  margin-bottom: 12px;
  backdrop-filter: blur(8px);
}

.velora-ad-card.theme-bogo .velora-ad-badge {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(52, 211, 153, 0.4);
  color: #6ee7b7;
}

.velora-ad-card.theme-trending .velora-ad-badge {
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(251, 191, 36, 0.4);
  color: #fde047;
}

.velora-ad-title {
  font-size: 2.2rem;
  font-weight: 900;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: #ffffff;
  margin: 0 0 10px 0;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}

.velora-ad-desc {
  font-size: 0.95rem;
  line-height: 1.55;
  color: #e2e8f0;
  margin: 0 0 22px 0;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);
}

.velora-ad-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.velora-ad-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #ffffff;
  font-weight: 800;
  font-size: 0.88rem;
  letter-spacing: 0.04em;
  padding: 12px 24px;
  border-radius: 12px;
  text-decoration: none;
  text-transform: uppercase;
  box-shadow: 0 8px 20px -4px rgba(37, 99, 235, 0.4);
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.velora-ad-card.theme-bogo .velora-ad-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  box-shadow: 0 8px 20px -4px rgba(16, 185, 129, 0.4);
}

.velora-ad-card.theme-trending .velora-ad-btn {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  box-shadow: 0 8px 20px -4px rgba(245, 158, 11, 0.4);
  color: #0f172a;
}

.velora-ad-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 26px -4px rgba(0, 0, 0, 0.5);
}

/* ==========================================================================
   3. FLOATING ADVERTISEMENT CARD
   ========================================================================== */
.velora-floating-ad-wrap {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 930;
  pointer-events: none;
  font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
}

.velora-floating-ad-wrap.is-visible .floating-ad-card {
  transform: translateY(0) scale(1);
  opacity: 1;
  visibility: visible;
}

.floating-ad-card {
  pointer-events: auto;
  width: 320px;
  max-width: calc(100vw - 32px);
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(14px);
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 16px 36px -6px rgba(0, 0, 0, 0.4);
  padding: 14px 16px;
  color: #ffffff;
  transform: translateY(16px) scale(0.96);
  opacity: 0;
  visibility: hidden;
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease, visibility 300ms ease;
  position: relative;
}

.floating-ad-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.85rem;
  transition: transform 150ms ease;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.floating-ad-badge {
  display: inline-block;
  font-size: 0.62rem;
  font-weight: 800;
  color: #fbbf24;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.floating-ad-title {
  font-size: 0.92rem;
  font-weight: 800;
  margin-bottom: 4px;
}

.floating-ad-desc {
  font-size: 0.78rem;
  color: #cbd5e1;
  margin: 0 0 10px 0;
  line-height: 1.35;
}

.floating-ad-btn {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  color: #60a5fa;
  text-decoration: underline;
}
`;

const marker = '/* ==========================================================================\n   2. HERO BOGO 3D PROMOTIONAL ADVERTISEMENT';
const idx = original.indexOf(marker);
if (idx === -1) {
  console.error('Marker not found!');
  process.exit(1);
}

const rest = original.substring(idx);
const combined = newTop + '\n' + rest;

let open = 0;
let inComment = false;
for (let i = 0; i < combined.length; i++) {
  if (inComment) {
    if (combined[i] === '*' && combined[i+1] === '/') { inComment = false; i++; }
    continue;
  }
  if (combined[i] === '/' && combined[i+1] === '*') { inComment = true; i++; continue; }
  if (combined[i] === '{') open++;
  if (combined[i] === '}') open--;
}

console.log('Open braces remaining with new top:', open);

