(() => {
  'use strict';
  if (window.__scheduleDateExportLoaderStarted) return;
  window.__scheduleDateExportLoaderStarted = true;
  const script = document.currentScript;
  const base = script?.src ? new URL('./', script.src) : new URL('./', location.href);
  const parts = ['date-export.01.part', 'date-export.02.part', 'date-export.03.part', 'date-export.04.part'];
  Promise.all(parts.map((name) => fetch(new URL(name, base)).then((response) => {
    if (!response.ok) throw new Error(`無法載入 ${name}`);
    return response.text();
  }))).then((chunks) => {
    const source = `${chunks.join('\n')}\n//# sourceURL=schedule-studio-date-export.js`;
    (0, eval)(source);
  }).catch((error) => {
    console.error(error);
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = '日期選擇與行程輸出模組載入失敗，請重新整理。';
      toast.classList.add('show');
    }
  });
})();
