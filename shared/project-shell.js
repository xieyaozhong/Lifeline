(() => {
  'use strict';
  if (window.__lifelineProjectShellLoaded) return;
  window.__lifelineProjectShellLoaded = true;

  const currentScript = document.currentScript || [...document.scripts].find((script) => script.src.includes('project-shell.js'));
  const scriptUrl = currentScript?.src ? new URL(currentScript.src, location.href) : new URL('shared/project-shell.js', location.href);
  const rootUrl = new URL('../', scriptUrl);
  const cssUrl = new URL('shared/project-shell.css', rootUrl);

  if (!document.querySelector(`link[href="${cssUrl.href}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl.href;
    document.head.appendChild(link);
  }

  const apps = [
    { id: 'portal', name: '專案中心', detail: '所有工具、部署狀態與入口', icon: '◎', href: 'portal/' },
    { id: 'lifeline', name: '生命線', detail: '任務、生命價值與即時推薦', icon: '✦', href: '' },
    { id: 'schedule', name: '時序環', detail: '圓形課表、三日總覽與兒童全天課程', icon: '◷', href: 'schedule-studio/' },
    { id: 'training', name: '自主訓練自核單', detail: '嚴格排程、國中數學題庫、自核與回課分析', icon: '✓', href: 'self-training-checklist/' },
    { id: 'appointment', name: '約定產生器', detail: 'LINE 預約深連結與 QR Code', icon: '⌗', href: 'appointment-generator/' }
  ];

  const pathname = location.pathname.replace(/\/+$/, '/');
  const currentId = pathname.includes('/appointment-generator/') ? 'appointment'
    : pathname.includes('/self-training-checklist/') ? 'training'
      : pathname.includes('/schedule-studio/') ? 'schedule'
        : pathname.includes('/portal/') ? 'portal' : 'lifeline';

  const resolve = (href) => new URL(href, rootUrl).href;
  const toggle = document.createElement('button');
  toggle.className = 'project-shell-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', '開啟 Lifeline 專案導覽');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span class="project-shell-toggle-dot"></span><span class="project-shell-toggle-label">Lifeline 工具</span><span aria-hidden="true">⌃</span>';

  const backdrop = document.createElement('div');
  backdrop.className = 'project-shell-backdrop';

  const panel = document.createElement('aside');
  panel.className = 'project-shell-panel';
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <div class="project-shell-head">
      <div>
        <p class="project-shell-kicker">LIFELINE SUITE</p>
        <h2>專案工具箱</h2>
        <p>在生命管理、課程安排、自主訓練與預約工具之間快速切換。</p>
      </div>
      <button class="project-shell-close" type="button" aria-label="關閉專案導覽">×</button>
    </div>
    <nav class="project-shell-grid" aria-label="Lifeline 應用程式">
      ${apps.map((app) => `
        <a class="project-shell-app ${app.id === currentId ? 'current' : ''}" href="${resolve(app.href)}" ${app.id === currentId ? 'aria-current="page"' : ''}>
          <span class="project-shell-icon" aria-hidden="true">${app.icon}</span>
          <span><strong>${app.name}</strong><span>${app.detail}</span></span>
          <span class="project-shell-arrow" aria-hidden="true">›</span>
        </a>`).join('')}
    </nav>
    <div class="project-shell-foot">
      <span>資料預設保存在目前瀏覽器</span>
      <a href="https://github.com/xieyaozhong/Lifeline" target="_blank" rel="noreferrer">GitHub ↗</a>
    </div>`;

  function setOpen(open) {
    panel.classList.toggle('open', open);
    backdrop.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
    if (open) panel.querySelector('.project-shell-close')?.focus();
  }

  toggle.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
  backdrop.addEventListener('click', () => setOpen(false));
  panel.querySelector('.project-shell-close')?.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  document.body.append(backdrop, panel, toggle);
  document.documentElement.dataset.projectShell = 'ready';
})();
