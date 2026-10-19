/* Aldune brand: logo mark and wordmark everywhere (top bar, sidebar, auth pages) */
(() => {
'use strict';
const X = window.PCX;
const MARK = '<svg class="sp-mark" width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" style="display:block"><rect width="28" height="28" rx="8" fill="#14261F"/><rect x="0.5" y="0.5" width="27" height="27" rx="7.5" fill="none" stroke="#2C5A47"/><path d="M5.5 18.5c2.6 0 2.9-6 5.6-6s2.7 4.4 5.2 4.4 2.9-8.4 6.2-8.4" fill="none" stroke="#7FE0B5" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="22.5" cy="8.5" r="2.3" fill="#F2B66D"/><circle cx="5.5" cy="18.5" r="1.4" fill="#7FE0B5"/></svg>';
document.head.insertAdjacentHTML('beforeend', '<style>.pub-top{background:rgba(255,255,255,.96)!important}.brand b,.pub-top .brand,.pub-top .brand b{font-family:var(--head)!important;font-weight:800;letter-spacing:-0.03em}.brand .sp-mark{flex:none;align-self:center}</style>');
function apply() { document.querySelectorAll('.brand').forEach(b => { const svg = b.querySelector('svg:not(.sp-mark):not(.al-mark)'); if (svg) svg.outerHTML = MARK.replace('class="sp-mark"', 'class="sp-mark" data-v="3"'); }); }
apply();
const base = X.render; X.render = () => { base(); apply(); };
new MutationObserver(() => apply()).observe(document.body, { childList: true, subtree: true });
})();
