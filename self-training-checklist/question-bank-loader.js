(() => {
  'use strict';
  const current = document.currentScript;
  const base = new URL('./', current?.src || location.href);
  const parts = ['question-bank.01.part','question-bank.02.part','question-bank.03.part','question-bank.04.part'];
  Promise.all(parts.map((name) => fetch(new URL(name, base), { cache: 'no-cache' }).then((response) => {
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    return response.text();
  })))
    .then((chunks) => Function(chunks.join(''))())
    .catch((error) => {
      console.error('Question bank load failed', error);
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = '國中數學題庫載入失敗，請重新整理頁面。';
        toast.classList.add('show');
      }
    });
})();
