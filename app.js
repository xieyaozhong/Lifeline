(() => {
  'use strict';

  const STORAGE_KEY = 'lifeline-mvp-v1';
  const HALF_HOUR = 30 * 60 * 1000;
  const DIMENSIONS = {
    health: { label: '健康', icon: '♥', color: '#8bd6b2' },
    intelligence: { label: '智力', icon: '◇', color: '#8ab9ff' },
    wealth: { label: '財富', icon: '◈', color: '#e6cf92' },
    status: { label: '地位', icon: '♜', color: '#d1a6ff' },
    skill: { label: '技能', icon: '✦', color: '#7ed9e8' }
  };

  const defaultState = () => ({
    version: 1,
    createdAt: new Date().toISOString(),
    lastOpenDate: localDateKey(),
    settings: {
      currencyName: 'LV$',
      availableHours: 10,
      scheduleLoad: 60,
      wakeTime: '07:00',
      sleepTime: '23:30'
    },
    totals: { health: 0, intelligence: 0, wealth: 0, status: 0, skill: 0 },
    tasks: [],
    completions: [],
    rateSnapshots: [{ at: new Date().toISOString(), total: 0, smoothedRate: 0 }]
  });

  let state = loadState();
  let deferredInstallPrompt = null;
  let toastTimer = null;

  const el = id => document.getElementById(id);
  const fmt = n => Math.round(Number(n || 0)).toLocaleString('zh-TW');
  const now = () => new Date();

  function localDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !saved.version) return defaultState();
      return { ...defaultState(), ...saved, settings: { ...defaultState().settings, ...(saved.settings || {}) } };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function parseTimeToMinutes(time) {
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  function minutesToTime(minutes) {
    let v = Math.max(0, Math.min(1439, Math.round(minutes)));
    const h = String(Math.floor(v / 60)).padStart(2, '0');
    const m = String(v % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  function totalLifeValue() {
    return Object.values(state.totals).reduce((a, b) => a + Number(b || 0), 0);
  }

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function todayCompletions() {
    const start = startOfToday().getTime();
    return state.completions.filter(c => new Date(c.completedAt).getTime() >= start);
  }

  function todayValue() {
    return todayCompletions().reduce((sum, c) => sum + c.value, 0);
  }

  function getRecentValue(ms = HALF_HOUR) {
    const cutoff = Date.now() - ms;
    return state.completions.filter(c => new Date(c.completedAt).getTime() >= cutoff).reduce((sum, c) => sum + c.value, 0);
  }

  function computeRates() {
    const instant = getRecentValue(HALF_HOUR) * 2;
    const snapshots = state.rateSnapshots;
    const previous = snapshots.length ? snapshots[snapshots.length - 1].smoothedRate || 0 : 0;
    const smoothed = previous ? instant * 0.3 + previous * 0.7 : instant;
    const elapsedHours = Math.max((Date.now() - startOfToday().getTime()) / 3600000, 0.25);
    const daily = todayValue() / elapsedHours;
    const energy = todayCompletions().reduce((sum, c) => sum + (c.energy || 0), 0);
    const efficiency = energy > 0 ? todayValue() / energy : 0;
    return { instant, smoothed, daily, efficiency };
  }

  function persistRateSnapshot(force = false) {
    const last = state.rateSnapshots[state.rateSnapshots.length - 1];
    if (!force && last && Date.now() - new Date(last.at).getTime() < HALF_HOUR) return;
    const rates = computeRates();
    state.rateSnapshots.push({ at: new Date().toISOString(), total: totalLifeValue(), smoothedRate: rates.smoothed });
    if (state.rateSnapshots.length > 500) state.rateSnapshots = state.rateSnapshots.slice(-500);
    saveState();
  }

  function isTaskDueToday(task) {
    const day = new Date().getDay();
    if (task.repeat === 'daily') return true;
    if (task.repeat === 'weekly') return Number(task.weekday) === day;
    if (task.repeat === 'interval') {
      if (!task.lastCompletedAt) return true;
      return Date.now() >= new Date(task.lastCompletedAt).getTime() + Number(task.intervalMinutes || 120) * 60000;
    }
    return !task.completedOnce;
  }

  function isCompletedToday(task) {
    return state.completions.some(c => c.taskId === task.id && localDateKey(new Date(c.completedAt)) === localDateKey());
  }

  function getTodayTasks() {
    return state.tasks.filter(isTaskDueToday).map(task => ({ ...task, completedToday: isCompletedToday(task) }));
  }

  function rolloverDay() {
    const today = localDateKey();
    if (state.lastOpenDate === today) return;
    state.lastOpenDate = today;
    state.tasks.forEach(task => { task.scheduledStart = null; });
    saveState();
  }

  function autoSchedule(showMessage = false) {
    const tasks = getTodayTasks().filter(t => !t.completedToday);
    const wake = parseTimeToMinutes(state.settings.wakeTime) ?? 420;
    const sleep = parseTimeToMinutes(state.settings.sleepTime) ?? 1410;
    const maxMinutes = Math.min(
      Math.max(60, Number(state.settings.availableHours || 10) * 60 * Number(state.settings.scheduleLoad || 60) / 100),
      Math.max(60, sleep - wake)
    );

    const fixed = tasks.filter(t => t.time).sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
    const flexible = tasks.filter(t => !t.time).sort((a, b) => {
      const scoreA = Number(a.priority || 2) * 100 + Number(a.baseValue || 0) / Math.max(10, Number(a.duration || 30)) - Number(a.energy || 30) * .2;
      const scoreB = Number(b.priority || 2) * 100 + Number(b.baseValue || 0) / Math.max(10, Number(b.duration || 30)) - Number(b.energy || 30) * .2;
      return scoreB - scoreA;
    });

    let used = fixed.reduce((sum, t) => sum + Number(t.duration || 30), 0);
    let cursor = wake;
    const occupied = fixed.map(t => ({ start: parseTimeToMinutes(t.time), end: parseTimeToMinutes(t.time) + Number(t.duration || 30) }));

    fixed.forEach(t => {
      const original = state.tasks.find(x => x.id === t.id);
      if (original) original.scheduledStart = t.time;
    });

    for (const task of flexible) {
      if (used + Number(task.duration || 30) > maxMinutes) continue;
      while (occupied.some(o => cursor < o.end && cursor + Number(task.duration || 30) > o.start)) {
        const conflict = occupied.find(o => cursor < o.end && cursor + Number(task.duration || 30) > o.start);
        cursor = conflict.end + 10;
      }
      if (cursor + Number(task.duration || 30) > sleep) break;
      const original = state.tasks.find(x => x.id === task.id);
      if (original) original.scheduledStart = minutesToTime(cursor);
      occupied.push({ start: cursor, end: cursor + Number(task.duration || 30) });
      used += Number(task.duration || 30);
      cursor += Number(task.duration || 30) + 10;
    }

    saveState();
    if (showMessage) toast(`已重新安排今日任務，預計投入 ${Math.round(used / 6) / 10} 小時。`);
    renderAll();
  }

  function calculateCompletionValue(task, ratio = 1, quality = 1) {
    const streak = task.streak || 0;
    const consistency = Math.min(1.25, 1 + streak * 0.03);
    return Math.max(0, Number(task.baseValue || 0) * ratio * quality * Number(task.difficulty || 1) * consistency * Number(task.leverage || 1));
  }

  function dimensionShares(task) {
    const primary = task.category || 'skill';
    const shares = { health: 0, intelligence: 0, wealth: 0, status: 0, skill: 0 };
    shares[primary] = 0.72;
    const secondaryMap = {
      health: ['skill', 'intelligence'],
      intelligence: ['skill', 'status'],
      wealth: ['skill', 'status'],
      status: ['wealth', 'skill'],
      skill: ['intelligence', 'wealth']
    };
    shares[secondaryMap[primary][0]] += 0.18;
    shares[secondaryMap[primary][1]] += 0.10;
    return shares;
  }

  function completeTask(taskId, ratio, quality, actualMinutes, note) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    const value = calculateCompletionValue(task, ratio, quality);
    const shares = dimensionShares(task);
    Object.entries(shares).forEach(([key, share]) => { state.totals[key] += value * share; });
    const completion = {
      id: uid('done'), taskId: task.id, title: task.title, category: task.category,
      completedAt: new Date().toISOString(), ratio, quality, value,
      actualMinutes: Number(actualMinutes), energy: Number(task.energy || 30) * ratio, note: note || ''
    };
    state.completions.unshift(completion);
    task.lastCompletedAt = completion.completedAt;
    task.streak = Number(task.streak || 0) + 1;
    if (task.repeat === 'once') task.completedOnce = true;
    persistRateSnapshot(true);
    saveState();
    toast(`完成「${task.title}」＋${fmt(value)} ${state.settings.currencyName}`);
    renderAll();
  }

  function seedTasks(keepExisting = true) {
    if (!keepExisting) state.tasks = [];
    const samples = [
      { title:'晨間補水與伸展', category:'health', duration:10, baseValue:90, energy:8, repeat:'daily', time:'07:15', priority:3, difficulty:0.8, leverage:1, notes:'喝水 300–500 ml，活動肩頸與下背。' },
      { title:'專注完成生命線核心功能', category:'skill', duration:90, baseValue:650, energy:55, repeat:'daily', time:'09:00', priority:4, difficulty:1.2, leverage:1.4, notes:'一次只推進一個可交付成果。' },
      { title:'閱讀與整理高價值資訊', category:'intelligence', duration:45, baseValue:260, energy:30, repeat:'daily', time:'', priority:2, difficulty:1, leverage:1.1, notes:'留下可搜尋的筆記或下一步。' },
      { title:'收入行動：接案／產品發布', category:'wealth', duration:60, baseValue:520, energy:45, repeat:'daily', time:'', priority:4, difficulty:1.1, leverage:1.35, notes:'必須形成報價、上架、聯絡或成交等可見成果。' },
      { title:'站起來活動 5 分鐘', category:'health', duration:5, baseValue:35, energy:3, repeat:'interval', intervalMinutes:120, time:'', priority:2, difficulty:0.7, leverage:1, notes:'完成後兩小時再次出現。' },
      { title:'發布一項作品或進度', category:'status', duration:25, baseValue:240, energy:20, repeat:'weekly', weekday:5, time:'18:00', priority:3, difficulty:1, leverage:1.25, notes:'可發布作品、文章、Demo 或專案進度。' }
    ];
    const existingTitles = new Set(state.tasks.map(t => t.title));
    samples.forEach(s => {
      if (!existingTitles.has(s.title)) state.tasks.push({ id: uid('task'), createdAt:new Date().toISOString(), streak:0, completedOnce:false, ...s });
    });
    saveState();
    autoSchedule(false);
    toast('已載入生命線示範任務。');
  }

  function renderDimensions() {
    const total = totalLifeValue();
    el('dimensionGrid').innerHTML = Object.entries(DIMENSIONS).map(([key, meta]) => {
      const value = state.totals[key] || 0;
      const percentage = total > 0 ? Math.max(4, Math.min(100, value / total * 100)) : 4;
      return `<article class="card dimension-card" style="--dimension-color:${meta.color}">
        <div class="dimension-top"><span class="dimension-label">${meta.label}</span><span class="dimension-icon">${meta.icon}</span></div>
        <div class="dimension-value">${fmt(value)}</div>
        <div class="dimension-bar"><div style="width:${percentage}%"></div></div>
      </article>`;
    }).join('');
  }

  function renderDashboard() {
    const rates = computeRates();
    const total = totalLifeValue();
    el('totalValue').textContent = fmt(total);
    el('todayDelta').textContent = `今日 ＋${fmt(todayValue())}`;
    el('currentTimeLabel').textContent = new Intl.DateTimeFormat('zh-TW', { month:'long', day:'numeric', weekday:'short' }).format(new Date());
    el('currentRate').textContent = fmt(rates.smoothed);
    el('instantRate').textContent = fmt(rates.instant);
    el('dailyRate').textContent = fmt(rates.daily);
    el('efficiencyRate').textContent = rates.efficiency.toFixed(1);
    el('speedMeterFill').style.width = `${Math.min(100, rates.smoothed / 15)}%`;
    el('todayTitle').textContent = `${new Date().getMonth()+1} 月 ${new Date().getDate()} 日 · 今日生命線`;
    renderDimensions();
    renderTimeline();
    renderFocus();
    renderDebt();
    drawLifeline();
  }

  function renderTimeline() {
    const tasks = getTodayTasks().sort((a,b) => {
      if (a.completedToday !== b.completedToday) return a.completedToday ? 1 : -1;
      return parseTimeToMinutes(a.scheduledStart || a.time || '23:59') - parseTimeToMinutes(b.scheduledStart || b.time || '23:59');
    });
    const container = el('timeline');
    if (!tasks.length) {
      container.innerHTML = '<div class="empty-state">今天還沒有任務。建立第一個任務，讓生命線開始移動。</div>';
      return;
    }
    container.innerHTML = tasks.map(task => `
      <article class="timeline-item ${task.completedToday ? 'completed' : ''}">
        <div class="timeline-time">${task.scheduledStart || task.time || '待安排'}</div>
        <div>
          <div class="timeline-title">${escapeHtml(task.title)}</div>
          <div class="timeline-meta">${DIMENSIONS[task.category].label} · ${task.duration} 分鐘 · 預估 ${fmt(calculateCompletionValue(task))} ${state.settings.currencyName}</div>
        </div>
        <div class="timeline-actions">
          ${task.completedToday ? '<span class="pill">已完成</span>' : `<button class="button primary small" data-complete="${task.id}">完成</button>`}
          <button class="button ghost small" data-edit="${task.id}">編輯</button>
        </div>
      </article>`).join('');
  }

  function renderFocus() {
    const upcoming = getTodayTasks().filter(t => !t.completedToday).sort((a,b) => parseTimeToMinutes(a.scheduledStart || a.time || '23:59') - parseTimeToMinutes(b.scheduledStart || b.time || '23:59'))[0];
    const box = el('focusTask');
    if (!upcoming) {
      box.innerHTML = '<div class="focus-name">今日任務已清空</div><div class="focus-meta">可以進入恢復、整理或自由探索。</div>';
      return;
    }
    box.innerHTML = `<div class="focus-name">${escapeHtml(upcoming.title)}</div>
      <div class="focus-meta">${upcoming.scheduledStart || upcoming.time || '彈性安排'} · ${upcoming.duration} 分鐘 · ${DIMENSIONS[upcoming.category].label}</div>
      <div class="focus-value">完成預估 ＋${fmt(calculateCompletionValue(upcoming))} ${state.settings.currencyName}</div>
      <button class="button primary full" data-complete="${upcoming.id}">開始結算</button>`;
  }

  function renderDebt() {
    const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const debts = getTodayTasks().filter(t => !t.completedToday && (parseTimeToMinutes(t.scheduledStart || t.time) ?? 9999) < currentMinutes - 15);
    const estimated = debts.reduce((sum,t) => sum + calculateCompletionValue(t) * .25, 0);
    el('debtSummary').innerHTML = `<div class="debt-number">${debts.length}</div>
      <div class="debt-copy">${debts.length ? `有 ${debts.length} 項任務已超過安排時間，可能延後約 ${fmt(estimated)} ${state.settings.currencyName} 的價值。完成後即可清除。` : '目前沒有維護債，生命線維持穩定。'}</div>`;
  }

  function renderTasks() {
    const cat = el('taskFilterCategory').value;
    const status = el('taskFilterStatus').value;
    let tasks = [...state.tasks];
    if (cat !== 'all') tasks = tasks.filter(t => t.category === cat);
    if (status === 'completed') tasks = tasks.filter(t => t.completedOnce || isCompletedToday(t));
    if (status === 'pending') tasks = tasks.filter(t => !(t.completedOnce || isCompletedToday(t)));
    const box = el('taskLibrary');
    if (!tasks.length) { box.innerHTML = '<div class="empty-state">沒有符合條件的任務。</div>'; return; }
    box.innerHTML = tasks.map(task => {
      const repeatLabel = { once:'單次', daily:'每天', interval:`每 ${task.intervalMinutes || 120} 分鐘`, weekly:`每週${'日一二三四五六'[Number(task.weekday || 0)]}` }[task.repeat];
      return `<article class="task-row"><div>
        <div class="task-row-title">${escapeHtml(task.title)}</div>
        <div class="task-row-meta"><span class="pill">${DIMENSIONS[task.category].label}</span><span class="pill">${repeatLabel}</span><span class="pill">${task.duration} 分鐘</span><span class="pill">${fmt(task.baseValue)} 基礎價值</span></div>
      </div><div class="task-row-actions">
        <button class="button primary small" data-complete="${task.id}">結算</button>
        <button class="button ghost small" data-edit="${task.id}">編輯</button>
        <button class="button danger small" data-delete="${task.id}">刪除</button>
      </div></article>`;
    }).join('');
  }

  function renderHistory() {
    const box = el('historyList');
    if (!state.completions.length) { box.innerHTML = '<div class="empty-state">完成任務後，價值足跡會出現在這裡。</div>'; return; }
    box.innerHTML = state.completions.map(c => `<article class="history-row"><div>
      <div class="task-row-title">${escapeHtml(c.title)}</div>
      <div class="history-meta">${new Intl.DateTimeFormat('zh-TW', { dateStyle:'medium', timeStyle:'short' }).format(new Date(c.completedAt))} · ${DIMENSIONS[c.category]?.label || ''} · ${c.actualMinutes} 分鐘${c.note ? ` · ${escapeHtml(c.note)}` : ''}</div>
    </div><div class="history-value">＋${fmt(c.value)}<div class="history-meta">${state.settings.currencyName}</div></div></article>`).join('');
  }

  function renderSettings() {
    el('currencyName').value = state.settings.currencyName;
    el('availableHours').value = state.settings.availableHours;
    el('scheduleLoad').value = state.settings.scheduleLoad;
    el('scheduleLoadLabel').textContent = `${state.settings.scheduleLoad}%`;
    el('wakeTime').value = state.settings.wakeTime;
    el('sleepTime').value = state.settings.sleepTime;
  }

  function renderAll() {
    renderDashboard();
    renderTasks();
    renderHistory();
    renderSettings();
  }

  function drawLifeline() {
    const canvas = el('lifelineCanvas');
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(300, rect.width * ratio);
    canvas.height = Math.max(160, rect.height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(230,207,146,.09)';
    ctx.lineWidth = 1;
    for (let i=1;i<5;i++) { ctx.beginPath(); ctx.moveTo(0,h*i/5); ctx.lineTo(w,h*i/5); ctx.stroke(); }
    const start = startOfToday().getTime();
    const points = state.rateSnapshots.filter(s => new Date(s.at).getTime() >= start).map(s => ({ time:new Date(s.at).getTime(), value:s.total }));
    if (!points.length || points[points.length-1].time < Date.now()-1000) points.push({ time:Date.now(), value:totalLifeValue() });
    if (points.length === 1) points.unshift({ time:start, value:Math.max(0, points[0].value - todayValue()) });
    const min = Math.min(...points.map(p=>p.value));
    const max = Math.max(...points.map(p=>p.value), min+1);
    ctx.beginPath();
    points.forEach((p,i) => {
      const x = ((p.time-start)/(Math.max(Date.now()-start,1))) * (w-20)+10;
      const y = h-16-((p.value-min)/(max-min))*(h-36);
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    const grad = ctx.createLinearGradient(0,0,w,0); grad.addColorStop(0,'rgba(139,185,255,.75)'); grad.addColorStop(1,'rgba(247,232,183,1)');
    ctx.strokeStyle=grad; ctx.lineWidth=3; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.stroke();
    const p=points[points.length-1]; const x=((p.time-start)/(Math.max(Date.now()-start,1)))*(w-20)+10; const y=h-16-((p.value-min)/(max-min))*(h-36);
    ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fillStyle='#f7e8b7'; ctx.shadowColor='#e6cf92'; ctx.shadowBlur=16; ctx.fill(); ctx.shadowBlur=0;
  }

  function openTaskDialog(task = null) {
    el('taskDialogTitle').textContent = task ? '編輯任務' : '新增任務';
    el('taskId').value = task?.id || '';
    el('taskTitle').value = task?.title || '';
    el('taskCategory').value = task?.category || 'skill';
    el('taskDuration').value = task?.duration || 30;
    el('taskValue').value = task?.baseValue || 200;
    el('taskEnergy').value = task?.energy || 30;
    el('taskRepeat').value = task?.repeat || 'once';
    el('taskTime').value = task?.time || '';
    el('taskInterval').value = task?.intervalMinutes || 120;
    el('taskWeekday').value = String(task?.weekday ?? 1);
    el('taskPriority').value = String(task?.priority || 2);
    el('taskDifficulty').value = task?.difficulty || 1;
    el('taskLeverage').value = task?.leverage || 1;
    el('taskNotes').value = task?.notes || '';
    updateRepeatFields();
    el('taskDialog').showModal();
  }

  function openCompleteDialog(taskId) {
    const task = state.tasks.find(t => t.id === taskId); if (!task) return;
    el('completeTaskId').value = task.id;
    el('completeTaskTitle').textContent = task.title;
    el('completionRatio').value = 100;
    el('qualityFactor').value = '1';
    el('actualMinutes').value = task.duration || 30;
    el('completionNote').value = '';
    updateCompletionPreview();
    el('completeDialog').showModal();
  }

  function updateRepeatFields() {
    const repeat = el('taskRepeat').value;
    el('intervalField').classList.toggle('hidden', repeat !== 'interval');
    el('weekdayField').classList.toggle('hidden', repeat !== 'weekly');
  }

  function updateCompletionPreview() {
    const task = state.tasks.find(t => t.id === el('completeTaskId').value);
    if (!task) return;
    const ratio = Number(el('completionRatio').value)/100;
    const quality = Number(el('qualityFactor').value);
    el('completionLabel').textContent = `${Math.round(ratio*100)}%`;
    el('completionPreview').textContent = `預估獲得 ＋${fmt(calculateCompletionValue(task, ratio, quality))} ${state.settings.currencyName}`;
  }

  function saveTaskFromForm() {
    const id = el('taskId').value;
    const data = {
      title:el('taskTitle').value.trim(), category:el('taskCategory').value,
      duration:Number(el('taskDuration').value), baseValue:Number(el('taskValue').value), energy:Number(el('taskEnergy').value),
      repeat:el('taskRepeat').value, time:el('taskTime').value, intervalMinutes:Number(el('taskInterval').value), weekday:Number(el('taskWeekday').value),
      priority:Number(el('taskPriority').value), difficulty:Number(el('taskDifficulty').value), leverage:Number(el('taskLeverage').value), notes:el('taskNotes').value.trim()
    };
    if (!data.title) return;
    if (id) Object.assign(state.tasks.find(t=>t.id===id), data);
    else state.tasks.push({ id:uid('task'), createdAt:new Date().toISOString(), streak:0, completedOnce:false, ...data });
    saveState(); autoSchedule(false); el('taskDialog').close(); toast(id ? '任務已更新。' : '任務已建立。'); renderAll();
  }

  function deleteTask(id) {
    const task = state.tasks.find(t => t.id === id); if (!task) return;
    if (!confirm(`確定刪除「${task.title}」？歷史完成紀錄會保留。`)) return;
    state.tasks = state.tasks.filter(t => t.id !== id); saveState(); renderAll(); toast('任務已刪除。');
  }

  function switchView(name) {
    document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    el(`${name}View`).classList.add('active');
    if (name === 'dashboard') setTimeout(drawLifeline, 0);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=`lifeline-backup-${localDateKey()}.json`; a.click(); URL.revokeObjectURL(url);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try { const imported=JSON.parse(reader.result); if (!imported.version || !Array.isArray(imported.tasks)) throw new Error('格式錯誤'); state={...defaultState(),...imported,settings:{...defaultState().settings,...(imported.settings||{})}}; saveState(); renderAll(); toast('資料已成功匯入。'); }
      catch { alert('無法匯入：檔案格式不正確。'); }
    };
    reader.readAsText(file);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function toast(message) {
    el('toast').textContent = message; el('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el('toast').classList.remove('show'),3200);
  }

  function updateCountdown() {
    const current = Date.now();
    const next = Math.ceil(current / HALF_HOUR) * HALF_HOUR;
    const remain = Math.max(0, next-current);
    const min = String(Math.floor(remain/60000)).padStart(2,'0');
    const sec = String(Math.floor((remain%60000)/1000)).padStart(2,'0');
    el('refreshCountdown').textContent = `${min}:${sec}`;
    if (remain < 1100) { persistRateSnapshot(); setTimeout(renderDashboard,1200); }
  }

  function bindEvents() {
    document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));
    el('addTaskBtn').addEventListener('click',()=>openTaskDialog());
    el('autoScheduleBtn').addEventListener('click',()=>autoSchedule(true));
    el('taskRepeat').addEventListener('change',updateRepeatFields);
    el('taskForm').addEventListener('submit',e=>{e.preventDefault();saveTaskFromForm();});
    el('completeForm').addEventListener('submit',e=>{e.preventDefault();completeTask(el('completeTaskId').value,Number(el('completionRatio').value)/100,Number(el('qualityFactor').value),Number(el('actualMinutes').value),el('completionNote').value.trim());el('completeDialog').close();});
    ['completionRatio','qualityFactor'].forEach(id=>el(id).addEventListener('input',updateCompletionPreview));
    document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>el(btn.dataset.close).close()));
    document.body.addEventListener('click',e=>{
      const complete=e.target.closest('[data-complete]'); if(complete) openCompleteDialog(complete.dataset.complete);
      const edit=e.target.closest('[data-edit]'); if(edit) openTaskDialog(state.tasks.find(t=>t.id===edit.dataset.edit));
      const del=e.target.closest('[data-delete]'); if(del) deleteTask(del.dataset.delete);
    });
    ['taskFilterCategory','taskFilterStatus'].forEach(id=>el(id).addEventListener('change',renderTasks));
    el('scheduleLoad').addEventListener('input',()=>el('scheduleLoadLabel').textContent=`${el('scheduleLoad').value}%`);
    el('saveSettingsBtn').addEventListener('click',()=>{
      state.settings={currencyName:el('currencyName').value.trim()||'LV$',availableHours:Number(el('availableHours').value)||10,scheduleLoad:Number(el('scheduleLoad').value)||60,wakeTime:el('wakeTime').value||'07:00',sleepTime:el('sleepTime').value||'23:30'};
      saveState();autoSchedule(false);renderAll();toast('設定已儲存。');
    });
    el('exportBtn').addEventListener('click',exportData);
    el('importInput').addEventListener('change',e=>{if(e.target.files[0]) importData(e.target.files[0]);e.target.value='';});
    el('seedBtn').addEventListener('click',()=>seedTasks(true));
    el('resetBtn').addEventListener('click',()=>{if(confirm('確定清除全部生命線資料？這個動作無法復原。')){state=defaultState();saveState();renderAll();toast('全部資料已清除。');}});
    window.addEventListener('resize',()=>{clearTimeout(window.__lfResize);window.__lfResize=setTimeout(drawLifeline,120);});
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;el('installBtn').classList.remove('hidden');});
    el('installBtn').addEventListener('click',async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;el('installBtn').classList.add('hidden');});
  }

  function init() {
    rolloverDay();
    bindEvents();
    if (!state.tasks.length) seedTasks(true); else { autoSchedule(false); renderAll(); }
    updateCountdown(); setInterval(updateCountdown,1000); setInterval(()=>{rolloverDay();renderAll();},60000);
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
  }

  init();
})();
