(() => {
  'use strict';
  if (window.__doctorStrangeLoaderStarted) return;
  window.__doctorStrangeLoaderStarted = true;
  const base = new URL('./', document.currentScript?.src || location.href);
  const parts = [1,2,3,4].map((n) => new URL(`app.${String(n).padStart(2,'0')}.part`, base));
  Promise.all(parts.map(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`無法載入 ${url.pathname}`);
    return response.text();
  })).then((chunks) => {
    const blob = new Blob([chunks.join('\n')], { type: 'text/javascript' });
    const script = document.createElement('script');
    script.src = URL.createObjectURL(blob);
    script.onload = () => URL.revokeObjectURL(script.src);
    document.body.appendChild(script);
  }).catch((error) => {
    console.error(error);
    const toast = document.getElementById('toast');
    if (toast) { toast.textContent = '規劃器載入失敗，請重新整理頁面。'; toast.classList.add('show'); }
  });
})();
