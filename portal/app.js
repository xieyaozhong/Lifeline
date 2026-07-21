(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  function tick() {
    const now = new Date();
    $('clock').textContent = new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    $('todayLabel').textContent = new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(now);
  }
  async function loadBuildInfo() {
    try {
      const response = await fetch('../build-info.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('not found');
      const info = await response.json();
      const time = new Date(info.builtAt);
      $('deployStatus').textContent = '運作中';
      $('buildInfo').textContent = `版本 ${String(info.sha || '').slice(0, 7)}，發布於 ${new Intl.DateTimeFormat('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).format(time)}。`;
    } catch {
      $('deployStatus').textContent = '線上';
      $('buildInfo').textContent = '頁面已可使用；部署資訊會在下一次 GitHub Pages 發布後顯示。';
    }
  }
  tick();
  setInterval(tick, 1000);
  loadBuildInfo();
})();
