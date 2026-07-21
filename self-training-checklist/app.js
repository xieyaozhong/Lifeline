(() => {
  'use strict';

  const STORAGE_KEY = 'lifeline-self-training-checklist-v1';
  const COLORS = { solve: '#e7ca86', review: '#82d5ca', break: '#79aef0', buffer: '#b18bd4' };
  const REASONS = { none: '無明顯卡關', concept: '概念不熟', calculation: '計算錯誤', reading: '題意理解', method: '方法選擇', focus: '專注不足', time: '時間不足' };
  const $ = (id) => document.getElementById(id);
  const pad = (value) => String(value).padStart(2, '0');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const getDate = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (key, amount) => { const date = getDate(key); date.setDate(date.getDate() + amount); return dateKey(date); };
  const timeToMinutes = (value) => { const [hour, minute] = String(value || '00:00').split(':').map(Number); return hour * 60 + minute; };
  const minutesToTime = (minutes) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
  const formatDate = (key, withYear = false) => new Intl.DateTimeFormat('zh-TW', { ...(withYear ? { year: 'numeric' } : {}), month: 'long', day: 'numeric', weekday: 'short' }).format(getDate(key));
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

  function defaultState() {
    const today = dateKey();
    return {
      version: 1,
      activeView: 'plan',
      selectedDate: today,
      profile: { studentName: '', subjectName: '數學', stageGoal: '' },
      settings: { topic: '一元二次方程式', dailyQuestions: 40, startTime: '19:00', endTime: '21:30', solveMinutes: 35, reviewMinutes: 15, breakMinutes: 10, bufferPercent: 15, sessionQuestions: 12, strictness: 'strict' },
      plans: {},
      records: [],
      adjustments: []
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !saved.profile || !saved.settings) return defaultState();
      return { ...defaultState(), ...saved, profile: { ...defaultState().profile, ...saved.profile }, settings: { ...defaultState().settings, ...saved.settings }, plans: saved.plans || {}, records: Array.isArray(saved.records) ? saved.records : [], adjustments: Array.isArray(saved.adjustments) ? saved.adjustments : [] };
    } catch { return defaultState(); }
  }

  let state = loadState();
  let toastTimer = null;

  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function showToast(message) { const toast = $('toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2700); }
  function selectedPlan() { return state.plans[state.selectedDate] || null; }
  function recordsForDate(key) { return state.records.filter((record) => record.date === key); }
  function recordForBlock(blockId) { return state.records.find((record) => record.blockId === blockId) || null; }

  function readPlannerForm() {
    return {
      topic: $('trainingTopic').value.trim() || '自主訓練',
      dailyQuestions: clamp(Number($('dailyQuestions').value || 0), 5, 300),
      startTime: $('startTime').value,
      endTime: $('endTime').value,
      solveMinutes: clamp(Number($('solveMinutes').value || 35), 10, 120),
      reviewMinutes: clamp(Number($('reviewMinutes').value || 15), 5, 60),
      breakMinutes: clamp(Number($('breakMinutes').value || 10), 0, 30),
      bufferPercent: clamp(Number($('bufferPercent').value || 15), 0, 35),
      sessionQuestions: clamp(Number($('sessionQuestions').value || 12), 3, 60),
      strictness: $('strictness').value
    };
  }

  function updateCapacityPreview() {
    const settings = readPlannerForm();
    const total = timeToMinutes(settings.endTime) - timeToMinutes(settings.startTime);
    const buffer = Math.round(total * settings.bufferPercent / 100 / 5) * 5;
    const cycle = settings.solveMinutes + settings.reviewMinutes + settings.breakMinutes;
    const cycles = Math.max(0, Math.floor((total - buffer + settings.breakMinutes) / cycle));
    const preferredCapacity = cycles * settings.sessionQuestions;
    const badge = $('capacityBadge');
    if (total <= 0 || cycles <= 0) {
      badge.textContent = '時間不足'; badge.className = 'status-badge warning'; return;
    }
    if (settings.dailyQuestions > preferredCapacity * 1.2) {
      badge.textContent = `負荷過高 · 建議 ≤ ${Math.round(preferredCapacity * 1.2)} 題`; badge.className = 'status-badge warning';
    } else if (settings.dailyQuestions <= preferredCapacity) {
      badge.textContent = `可穩定安排 ${cycles} 輪`; badge.className = 'status-badge good';
    } else {
      badge.textContent = '需提高單輪題量'; badge.className = 'status-badge';
    }
  }

  function distribute(total, count) {
    if (count <= 0) return [];
    const base = Math.floor(total / count);
    const remainder = total % count;
    return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
  }

  function buildBlocks(settings, startMinute, endMinute, questionTarget, frozen = []) {
    const total = endMinute - startMinute;
    const bufferMinutes = Math.max(0, Math.round(total * settings.bufferPercent / 100 / 5) * 5);
    const workEnd = endMinute - bufferMinutes;
    const cycleDuration = settings.solveMinutes + settings.reviewMinutes + settings.breakMinutes;
    const maxCycles = Math.max(0, Math.floor((workEnd - startMinute + settings.breakMinutes) / cycleDuration));
    const desiredCycles = Math.max(1, Math.ceil(questionTarget / settings.sessionQuestions));
    const cycles = Math.min(maxCycles, desiredCycles);
    const maxPerCycle = Math.max(settings.sessionQuestions, Math.ceil(settings.sessionQuestions * 1.2));
    const schedulable = Math.min(questionTarget, cycles * maxPerCycle);
    const distribution = distribute(schedulable, cycles);
    const blocks = [...frozen];
    let cursor = startMinute;

    distribution.forEach((questions, index) => {
      const solveStart = cursor;
      const solveEnd = solveStart + settings.solveMinutes;
      blocks.push({ id: uid('block'), type: 'solve', topic: settings.topic, start: solveStart, end: solveEnd, targetQuestions: questions, plannedMinutes: settings.solveMinutes, status: 'pending' });
      cursor = solveEnd;
      blocks.push({ id: uid('block'), type: 'review', topic: `${settings.topic}檢討`, start: cursor, end: cursor + settings.reviewMinutes, targetQuestions: 0, plannedMinutes: settings.reviewMinutes, status: 'pending' });
      cursor += settings.reviewMinutes;
      if (index < distribution.length - 1 && settings.breakMinutes > 0) {
        blocks.push({ id: uid('block'), type: 'break', topic: '離席休息／補水', start: cursor, end: cursor + settings.breakMinutes, targetQuestions: 0, plannedMinutes: settings.breakMinutes, status: 'pending' });
        cursor += settings.breakMinutes;
      }
    });

    if (cursor < endMinute) {
      blocks.push({ id: uid('block'), type: 'buffer', topic: '彈性緩衝／補做未完成題目', start: cursor, end: endMinute, targetQuestions: 0, plannedMinutes: endMinute - cursor, status: 'pending' });
    }

    return { blocks, scheduledQuestions: schedulable, carryover: Math.max(0, questionTarget - schedulable), cycles, bufferMinutes };
  }

  function generatePlan() {
    state.profile = { studentName: $('studentName').value.trim(), subjectName: $('subjectName').value.trim() || '數學', stageGoal: $('stageGoal').value.trim() };
    state.settings = readPlannerForm();
    state.selectedDate = $('trainingDate').value || dateKey();
    const start = timeToMinutes(state.settings.startTime);
    const end = timeToMinutes(state.settings.endTime);
    if (end <= start + 30) return showToast('結束時間必須比開始時間晚至少 30 分鐘。');
    if (state.plans[state.selectedDate] && !window.confirm(`${formatDate(state.selectedDate)} 已有計畫，要重新建立嗎？`)) return;

    const result = buildBlocks(state.settings, start, end, state.settings.dailyQuestions);
    if (!result.cycles) return showToast('目前時段無法放入完整的解題與檢討循環。');
    state.plans[state.selectedDate] = { date: state.selectedDate, topic: state.settings.topic, targetQuestions: state.settings.dailyQuestions, scheduledQuestions: result.scheduledQuestions, carryover: result.carryover, settings: { ...state.settings }, blocks: result.blocks, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    saveState(); renderAll();
    showToast(result.carryover ? `已安排 ${result.scheduledQuestions} 題，另有 ${result.carryover} 題轉為待補。` : '今日嚴格計畫已建立。');
  }

  function planStats(plan) {
    if (!plan) return { target: 0, attempted: 0, correct: 0, accuracy: null, carryover: 0, plannedReview: 0, actualReview: 0 };
    const records = recordsForDate(plan.date);
    const attempted = records.reduce((sum, record) => sum + Number(record.attempted || 0), 0);
    const correct = records.reduce((sum, record) => sum + Number(record.correct || 0), 0);
    const plannedReview = plan.blocks.filter((block) => block.type === 'review').reduce((sum, block) => sum + block.plannedMinutes, 0);
    const actualReview = records.reduce((sum, record) => sum + Number(record.reviewMinutes || 0), 0);
    return { target: plan.targetQuestions, attempted, correct, accuracy: attempted ? correct / attempted : null, carryover: Number(plan.carryover || 0), plannedReview, actualReview };
  }

  function blockStatus(block, planDate) {
    const record = recordForBlock(block.id);
    if (record?.skipped) return 'skipped';
    if (record || block.status === 'done') return 'done';
    const now = new Date();
    if (planDate === dateKey(now)) {
      const minute = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
      if (minute >= block.start && minute < block.end) return 'active';
    }
    return 'pending';
  }

  function renderPlan() {
    const plan = selectedPlan();
    $('trainingDate').value = state.selectedDate;
    $('planTitle').textContent = plan ? `${formatDate(plan.date, true)} · ${plan.topic}` : `${formatDate(state.selectedDate, true)} 尚未建立計畫`;
    $('planSubtitle').textContent = plan ? `${plan.settings.startTime}–${plan.settings.endTime} · 嚴格保留解題、檢討與彈性緩衝` : '設定題量與時間後，系統會拆分成解題、檢討、休息與緩衝。';
    const stats = planStats(plan);
    $('targetQuestionsMetric').textContent = stats.target;
    $('completedQuestionsMetric').textContent = stats.attempted;
    $('accuracyMetric').textContent = stats.accuracy == null ? '—' : `${Math.round(stats.accuracy * 100)}%`;
    $('carryoverMetric').textContent = stats.carryover;
    $('profileStatus').textContent = plan ? (stats.attempted >= plan.scheduledQuestions ? '本日已完成' : '執行中') : '等待建立';

    if (!plan) {
      $('trainingTimeline').innerHTML = '<div class="empty-state">尚未建立這一天的自主訓練。<br>左側設定完成後，按下「產生今日嚴格計畫」。</div>';
      renderCurrentBlock(); return;
    }

    $('trainingTimeline').innerHTML = plan.blocks.map((block) => {
      const status = blockStatus(block, plan.date);
      const record = recordForBlock(block.id);
      const label = block.type === 'solve' ? `解題 ${block.targetQuestions} 題` : block.type === 'review' ? `檢討 ${block.plannedMinutes} 分鐘` : block.type === 'break' ? '休息與補水' : '吸收延誤、補做或提前收尾';
      const result = record ? `已作答 ${record.attempted} 題 · 正確 ${record.correct} 題 · ${record.actualMinutes} 分鐘` : label;
      const action = block.type === 'solve'
        ? `<button class="primary-action" type="button" data-check-block="${block.id}">${status === 'done' ? '修改自核' : '填寫自核'}</button>`
        : `<button type="button" data-quick-block="${block.id}">${status === 'done' ? '已完成' : '標記完成'}</button>`;
      return `<article class="timeline-block ${status}" style="--block-color:${COLORS[block.type]}">
        <span class="block-time">${minutesToTime(block.start)}<br>${minutesToTime(block.end)}</span>
        <i class="block-line"></i>
        <div class="block-main"><strong>${escapeHtml(block.topic)}</strong><span>${escapeHtml(result)}</span></div>
        <div class="block-actions">${action}${status === 'pending' && block.type === 'solve' ? `<button type="button" data-skip-block="${block.id}">無法完成</button>` : ''}</div>
      </article>`;
    }).join('');

    document.querySelectorAll('[data-check-block]').forEach((button) => button.addEventListener('click', () => openCheckDialog(button.dataset.checkBlock)));
    document.querySelectorAll('[data-quick-block]').forEach((button) => button.addEventListener('click', () => quickCompleteBlock(button.dataset.quickBlock)));
    document.querySelectorAll('[data-skip-block]').forEach((button) => button.addEventListener('click', () => markBlockSkipped(button.dataset.skipBlock)));
    renderCurrentBlock();
  }

  function renderCurrentBlock() {
    const plan = selectedPlan();
    const card = $('currentBlockCard');
    if (!plan || plan.date !== dateKey()) {
      $('currentBlockLabel').textContent = plan ? '目前查看的不是今天' : '目前沒有進行中的訓練';
      $('currentBlockName').textContent = plan ? '可先檢視或調整計畫' : '等待排程';
      $('currentBlockMeta').textContent = '—'; $('currentBlockProgress').style.width = '0%'; card.classList.remove('active'); return;
    }
    const now = new Date();
    const minute = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const current = plan.blocks.find((block) => minute >= block.start && minute < block.end);
    const next = plan.blocks.find((block) => block.start > minute && blockStatus(block, plan.date) === 'pending');
    if (!current) {
      $('currentBlockLabel').textContent = next ? '下一個訓練時段' : '今日排程已結束';
      $('currentBlockName').textContent = next ? next.topic : '可以整理錯題與休息';
      $('currentBlockMeta').textContent = next ? `${minutesToTime(next.start)} 開始` : '—'; $('currentBlockProgress').style.width = '0%'; card.classList.remove('active'); return;
    }
    const progress = clamp((minute - current.start) / (current.end - current.start) * 100, 0, 100);
    $('currentBlockLabel').textContent = '現在進行'; $('currentBlockName').textContent = current.topic;
    $('currentBlockMeta').textContent = `${minutesToTime(current.start)}–${minutesToTime(current.end)} · 還有 ${Math.ceil(current.end - minute)} 分鐘`;
    $('currentBlockProgress').style.width = `${progress}%`; card.classList.add('active');
  }

  function openCheckDialog(blockId) {
    const plan = selectedPlan();
    const block = plan?.blocks.find((item) => item.id === blockId);
    if (!block) return;
    const record = recordForBlock(blockId);
    $('checkBlockId').value = blockId;
    $('checkDialogTitle').textContent = record ? '修改訓練自核' : '完成訓練自核';
    $('checkSummary').innerHTML = `<strong>${escapeHtml(block.topic)}</strong><br>${minutesToTime(block.start)}–${minutesToTime(block.end)} · 原定 ${block.targetQuestions} 題／${block.plannedMinutes} 分鐘`;
    $('attemptedQuestions').value = record?.attempted ?? block.targetQuestions;
    $('correctQuestions').value = record?.correct ?? block.targetQuestions;
    $('actualMinutes').value = record?.actualMinutes ?? block.plannedMinutes;
    $('actualReviewMinutes').value = record?.reviewMinutes ?? 0;
    $('feltDifficulty').value = String(record?.difficulty ?? 3);
    $('blockReason').value = record?.reason ?? 'none';
    $('checkNote').value = record?.note ?? '';
    $('checkDialog').showModal();
  }

  function saveCheck(event) {
    event.preventDefault();
    const blockId = $('checkBlockId').value;
    const plan = selectedPlan();
    const block = plan?.blocks.find((item) => item.id === blockId);
    if (!block) return;
    const attempted = Math.max(0, Number($('attemptedQuestions').value || 0));
    const correct = clamp(Number($('correctQuestions').value || 0), 0, attempted);
    const record = { id: recordForBlock(blockId)?.id || uid('record'), date: plan.date, blockId, topic: block.topic, target: block.targetQuestions, attempted, correct, actualMinutes: Math.max(1, Number($('actualMinutes').value || 1)), reviewMinutes: Math.max(0, Number($('actualReviewMinutes').value || 0)), difficulty: Number($('feltDifficulty').value), reason: $('blockReason').value, note: $('checkNote').value.trim(), skipped: false, updatedAt: new Date().toISOString() };
    state.records = state.records.filter((item) => item.blockId !== blockId);
    state.records.push(record); block.status = 'done'; plan.updatedAt = new Date().toISOString();
    saveState(); $('checkDialog').close(); renderAll(); showToast('自核結果已儲存，分析與下次題量已更新。');
  }

  function quickCompleteBlock(blockId) {
    const plan = selectedPlan(); const block = plan?.blocks.find((item) => item.id === blockId); if (!block) return;
    const existing = recordForBlock(blockId);
    if (existing) return showToast('這個時段已標記完成。');
    state.records.push({ id: uid('record'), date: plan.date, blockId, topic: block.topic, target: 0, attempted: 0, correct: 0, actualMinutes: block.plannedMinutes, reviewMinutes: block.type === 'review' ? block.plannedMinutes : 0, difficulty: 1, reason: 'none', note: '', skipped: false, updatedAt: new Date().toISOString() });
    block.status = 'done'; saveState(); renderAll(); showToast('時段已標記完成。');
  }

  function markBlockSkipped(blockId) {
    const plan = selectedPlan(); const block = plan?.blocks.find((item) => item.id === blockId); if (!block) return;
    if (!window.confirm(`將「${block.topic}」標記為無法完成，並保留題量供彈性重排？`)) return;
    state.records = state.records.filter((item) => item.blockId !== blockId);
    state.records.push({ id: uid('record'), date: plan.date, blockId, topic: block.topic, target: block.targetQuestions, attempted: 0, correct: 0, actualMinutes: 0, reviewMinutes: 0, difficulty: 5, reason: 'time', note: '本時段未完成', skipped: true, updatedAt: new Date().toISOString() });
    block.status = 'skipped'; saveState(); renderAll(); showToast('已標記未完成，可按「彈性重排剩餘計畫」。');
  }

  function markSkippedFromDialog() { const blockId = $('checkBlockId').value; $('checkDialog').close(); markBlockSkipped(blockId); }

  function adjustRemainingPlan() {
    const plan = selectedPlan(); if (!plan) return showToast('這一天尚未建立計畫。');
    const now = new Date();
    const isToday = plan.date === dateKey(now);
    const nowMinute = isToday ? Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5 : timeToMinutes(plan.settings.startTime);
    const endMinute = timeToMinutes(plan.settings.endTime);
    const frozen = plan.blocks.filter((block) => block.end <= nowMinute || blockStatus(block, plan.date) === 'done');
    const frozenIds = new Set(frozen.map((block) => block.id));
    const records = recordsForDate(plan.date);
    const attempted = records.reduce((sum, record) => sum + Number(record.attempted || 0), 0);
    const remaining = Math.max(0, plan.targetQuestions - attempted);
    if (!remaining) return showToast('本日題量已完成，不需要重排。');
    if (nowMinute >= endMinute - 20) {
      plan.carryover = remaining; plan.blocks = frozen; plan.updatedAt = new Date().toISOString();
      state.adjustments.unshift({ id: uid('adjust'), date: plan.date, at: new Date().toISOString(), message: `剩餘 ${remaining} 題因時間不足，轉入下次待補。` });
      saveState(); renderAll(); return showToast(`剩餘 ${remaining} 題已轉為下次待補。`);
    }
    const result = buildBlocks(plan.settings, nowMinute, endMinute, remaining, frozen);
    const removedIds = plan.blocks.filter((block) => !frozenIds.has(block.id)).map((block) => block.id);
    state.records = state.records.filter((record) => !removedIds.includes(record.blockId) || record.attempted > 0);
    plan.blocks = result.blocks.sort((a, b) => a.start - b.start); plan.scheduledQuestions = attempted + result.scheduledQuestions; plan.carryover = result.carryover; plan.updatedAt = new Date().toISOString();
    state.adjustments.unshift({ id: uid('adjust'), date: plan.date, at: new Date().toISOString(), message: `依目前進度重排：剩餘 ${remaining} 題，重新安排 ${result.scheduledQuestions} 題，${result.carryover} 題轉待補。` });
    saveState(); renderAll(); showToast(result.carryover ? `已重排，${result.carryover} 題保留到下次。` : '剩餘計畫已重新分配。');
  }

  function clearPlan() {
    const plan = selectedPlan(); if (!plan) return;
    if (!window.confirm(`清空 ${formatDate(state.selectedDate)} 的訓練計畫？既有自核紀錄會保留。`)) return;
    delete state.plans[state.selectedDate]; saveState(); renderAll(); showToast('本日計畫已清空。');
  }

  function switchDate(offset) { state.selectedDate = addDays(state.selectedDate, offset); saveState(); renderPlan(); renderCurrentBlock(); }

  function dateWithinRange(key, days) { if (days === 'all') return true; const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); cutoff.setDate(cutoff.getDate() - Number(days) + 1); return getDate(key) >= cutoff; }

  function renderRecords() {
    const range = $('recordRange').value;
    const records = [...state.records].filter((record) => dateWithinRange(record.date, range)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    $('recordsList').innerHTML = records.length ? records.map((record) => {
      const accuracy = record.attempted ? `${Math.round(record.correct / record.attempted * 100)}%` : (record.skipped ? '未完成' : '—');
      return `<article class="record-card"><span class="record-date">${formatDate(record.date)}</span><div class="record-main"><strong>${escapeHtml(record.topic)}</strong><span>${escapeHtml(REASONS[record.reason] || record.reason)}${record.note ? ` · ${escapeHtml(record.note)}` : ''}</span></div><div class="record-metric"><span>完成</span><strong>${record.attempted}/${record.target}</strong></div><div class="record-metric"><span>正確率</span><strong>${accuracy}</strong></div><div class="record-metric"><span>耗時</span><strong>${record.actualMinutes}m</strong></div></article>`;
    }).join('') : '<div class="empty-state">目前範圍內沒有訓練紀錄。</div>';
    $('adjustmentList').innerHTML = state.adjustments.length ? state.adjustments.slice(0, 12).map((item) => `<article class="adjustment-item"><strong>${formatDate(item.date)} · ${new Intl.DateTimeFormat('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(item.at))}</strong><span>${escapeHtml(item.message)}</span></article>`).join('') : '<div class="empty-state">尚未進行彈性重排。</div>';
  }

  function recentAnalysis(days = 14) {
    const dates = Array.from({ length: days }, (_, index) => addDays(dateKey(), index - days + 1));
    const daily = dates.map((date) => {
      const plan = state.plans[date]; const records = recordsForDate(date).filter((record) => record.target > 0);
      const attempted = records.reduce((sum, record) => sum + record.attempted, 0); const correct = records.reduce((sum, record) => sum + record.correct, 0);
      const actualMinutes = records.reduce((sum, record) => sum + record.actualMinutes, 0); const reviewMinutes = records.reduce((sum, record) => sum + record.reviewMinutes, 0);
      return { date, planned: plan?.targetQuestions || records.reduce((sum, record) => sum + record.target, 0), attempted, correct, accuracy: attempted ? correct / attempted : null, actualMinutes, reviewMinutes };
    });
    const planned = daily.reduce((sum, day) => sum + day.planned, 0); const attempted = daily.reduce((sum, day) => sum + day.attempted, 0); const correct = daily.reduce((sum, day) => sum + day.correct, 0);
    const active = daily.filter((day) => day.planned || day.attempted); const records = state.records.filter((record) => dates.includes(record.date) && record.target > 0);
    const plannedReview = records.reduce((sum, record) => { const plan = state.plans[record.date]; return sum + Number(plan?.settings?.reviewMinutes || 0); }, 0);
    return { dates, daily, activeDays: active.length, planned, attempted, correct, completion: planned ? attempted / planned : null, accuracy: attempted ? correct / attempted : null, pace: attempted ? records.reduce((sum, record) => sum + record.actualMinutes, 0) / attempted : null, reviewRate: plannedReview ? records.reduce((sum, record) => sum + record.reviewMinutes, 0) / plannedReview : null, records };
  }

  function calculateRecommendation(analysis) {
    if (!analysis.activeDays || !analysis.attempted) return { questions: state.settings.dailyQuestions, solveMinutes: state.settings.solveMinutes, reviewRatio: 30, difficulty: '基礎 50%／標準 40%／挑戰 10%', reason: '尚無足夠紀錄，先沿用目前設定，完成 3 次後再自動調整。' };
    const baseline = analysis.attempted / analysis.activeDays;
    const accuracyFactor = analysis.accuracy < .65 ? .78 : analysis.accuracy < .8 ? .92 : analysis.accuracy > .9 ? 1.1 : 1;
    const completionFactor = analysis.completion < .7 ? .78 : analysis.completion < .9 ? .93 : analysis.completion > .98 ? 1.08 : 1;
    const averageDifficulty = analysis.records.length ? analysis.records.reduce((sum, record) => sum + record.difficulty, 0) / analysis.records.length : 3;
    const difficultyFactor = averageDifficulty >= 4 ? .9 : averageDifficulty <= 2.2 ? 1.07 : 1;
    const questions = Math.round(clamp(baseline * accuracyFactor * completionFactor * difficultyFactor, Math.max(5, state.settings.dailyQuestions * .55), state.settings.dailyQuestions * 1.25) / 5) * 5;
    const reviewRatio = analysis.accuracy < .7 ? 45 : analysis.accuracy < .82 ? 35 : 25;
    const solveMinutes = clamp(Math.round((analysis.pace || 2.5) * Math.min(questions, state.settings.sessionQuestions) / 5) * 5, 20, 70);
    const difficulty = analysis.accuracy < .7 ? '基礎 70%／標準 30%' : analysis.accuracy > .88 && analysis.completion > .9 ? '基礎 30%／標準 50%／挑戰 20%' : '基礎 45%／標準 45%／挑戰 10%';
    const reasonParts = [];
    if (analysis.completion < .8) reasonParts.push('近期完成率偏低，因此先降低總量'); else if (analysis.completion > .95) reasonParts.push('完成率穩定，可小幅增加負荷');
    if (analysis.accuracy < .7) reasonParts.push('正確率需要優先修復，增加檢討比例'); else if (analysis.accuracy > .88) reasonParts.push('正確率良好，可加入少量挑戰題');
    if (averageDifficulty >= 4) reasonParts.push('體感難度偏高，單次題量不宜再加重');
    return { questions, solveMinutes, reviewRatio, difficulty, reason: `${reasonParts.join('；') || '目前表現穩定，維持接近實際可完成的題量'}。` };
  }

  function topicAnalysis(records) {
    const groups = new Map();
    records.forEach((record) => {
      if (!groups.has(record.topic)) groups.set(record.topic, { topic: record.topic, target: 0, attempted: 0, correct: 0, difficulty: 0, count: 0, reasons: {} });
      const group = groups.get(record.topic); group.target += record.target; group.attempted += record.attempted; group.correct += record.correct; group.difficulty += record.difficulty; group.count += 1; group.reasons[record.reason] = (group.reasons[record.reason] || 0) + 1;
    });
    return [...groups.values()].map((group) => ({ ...group, accuracy: group.attempted ? group.correct / group.attempted : 0, completion: group.target ? group.attempted / group.target : 0, averageDifficulty: group.difficulty / Math.max(1, group.count), mainReason: Object.entries(group.reasons).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'none' })).sort((a, b) => a.accuracy - b.accuracy || a.completion - b.completion);
  }

  function renderAnalysis() {
    const analysis = recentAnalysis(14); const recommendation = calculateRecommendation(analysis); const topics = topicAnalysis(analysis.records);
    $('analysisCompletion').textContent = analysis.completion == null ? '—' : `${Math.round(analysis.completion * 100)}%`;
    $('analysisAccuracy').textContent = analysis.accuracy == null ? '—' : `${Math.round(analysis.accuracy * 100)}%`;
    $('analysisPace').textContent = analysis.pace == null ? '—' : analysis.pace.toFixed(1);
    $('analysisReview').textContent = analysis.reviewRate == null ? '—' : `${Math.round(clamp(analysis.reviewRate,0,1.5) * 100)}%`;
    $('analysisCompletionNote').textContent = analysis.activeDays ? `${analysis.attempted}／${analysis.planned} 題` : '尚無資料';
    $('analysisAccuracyNote').textContent = analysis.activeDays ? `${analysis.correct} 題答對` : '尚無資料';
    $('analysisReviewNote').textContent = analysis.reviewRate == null ? '尚無資料' : (analysis.reviewRate >= .8 ? '檢討執行穩定' : '需要補強錯題檢討');
    $('nextQuestionRecommendation').textContent = recommendation.questions;
    $('nextSolveRecommendation').textContent = `${recommendation.solveMinutes} 分鐘／輪`;
    $('nextReviewRecommendation').textContent = `${recommendation.reviewRatio}%`;
    $('nextDifficultyRecommendation').textContent = recommendation.difficulty;
    $('recommendReason').textContent = recommendation.reason;
    $('trendBadge').textContent = analysis.activeDays ? `${analysis.activeDays} 個訓練日` : '等待資料';
    $('trendBadge').className = `status-badge ${analysis.activeDays >= 3 ? 'good' : ''}`;

    $('topicTable').innerHTML = topics.length ? `<div class="topic-row header"><span>主題</span><span>完成率</span><span>正確率</span><span>判讀</span></div>${topics.map((topic) => {
      const good = topic.accuracy >= .8 && topic.completion >= .85;
      const label = good ? '穩定' : topic.accuracy < .65 ? '優先補概念' : topic.completion < .7 ? '降低題量' : '持續檢討';
      return `<div class="topic-row"><strong>${escapeHtml(topic.topic)}</strong><span>${Math.round(topic.completion*100)}%</span><span>${Math.round(topic.accuracy*100)}%</span><span class="topic-risk ${good?'good':''}">${label}</span></div>`;
    }).join('')}` : '<div class="empty-state">完成訓練後會產生主題診斷。</div>';

    const weak = topics[0]; const reasons = {};
    analysis.records.forEach((record) => { if (record.reason !== 'none') reasons[record.reason] = (reasons[record.reason] || 0) + 1; });
    const mainReason = Object.entries(reasons).sort((a,b)=>b[1]-a[1])[0]?.[0];
    $('teacherBrief').innerHTML = analysis.activeDays ? `
      <section class="brief-section"><strong>近期投入</strong><p>14 天內有 ${analysis.activeDays} 個訓練日，共完成 ${analysis.attempted} 題；計畫完成率 ${Math.round((analysis.completion||0)*100)}%。</p></section>
      <section class="brief-section"><strong>品質判讀</strong><p>整體正確率 ${Math.round((analysis.accuracy||0)*100)}%，平均每題 ${analysis.pace?.toFixed(1) || '—'} 分鐘。${mainReason ? `最常見卡關是「${REASONS[mainReason]}」。` : '目前沒有集中卡關原因。'}</p></section>
      <section class="brief-section"><strong>優先處理</strong><p>${weak ? `${weak.topic} 的正確率 ${Math.round(weak.accuracy*100)}%、完成率 ${Math.round(weak.completion*100)}%，下次先用少量題目確認概念與方法。` : '持續蒐集不同主題紀錄。'}</p></section>
      <section class="brief-section"><strong>下次作業</strong><p>建議 ${recommendation.questions} 題，${recommendation.difficulty}；檢討時間約占 ${recommendation.reviewRatio}%。</p></section>` : '<div class="empty-state">至少完成一次自核後，這裡會生成可直接上課使用的摘要。</div>';
    drawTrend(analysis.daily);
  }

  function drawTrend(daily) {
    const canvas = $('trendCanvas'); const context = canvas.getContext('2d'); const ratio = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(700, rect.width * ratio); canvas.height = Math.max(300, rect.height * ratio); context.setTransform(ratio,0,0,ratio,0,0);
    const width = canvas.width / ratio; const height = canvas.height / ratio; context.clearRect(0,0,width,height);
    const padding = { left: 42, right: 28, top: 20, bottom: 34 }; const chartW = width-padding.left-padding.right; const chartH = height-padding.top-padding.bottom;
    const maxQuestions = Math.max(20, ...daily.map((day) => Math.max(day.planned, day.attempted)));
    context.strokeStyle='rgba(255,255,255,.08)'; context.lineWidth=1; context.fillStyle='#8295a9'; context.font='10px system-ui';
    for(let i=0;i<=4;i++){const y=padding.top+chartH*i/4;context.beginPath();context.moveTo(padding.left,y);context.lineTo(width-padding.right,y);context.stroke();context.fillText(String(Math.round(maxQuestions*(1-i/4))),8,y+3)}
    const step = chartW/daily.length; const barW=Math.max(4,step*.24);
    daily.forEach((day,index)=>{const x=padding.left+step*index+step/2;const plannedH=day.planned/maxQuestions*chartH;const attemptedH=day.attempted/maxQuestions*chartH;context.strokeStyle='#e7ca86';context.strokeRect(x-barW-1,padding.top+chartH-plannedH,barW,plannedH);context.fillStyle='#82d5ca';context.fillRect(x+1,padding.top+chartH-attemptedH,barW,attemptedH);if(index%2===0){context.fillStyle='#8295a9';context.textAlign='center';context.fillText(getDate(day.date).getDate(),x,height-10)}});
    context.beginPath(); let started=false; daily.forEach((day,index)=>{if(day.accuracy==null)return;const x=padding.left+step*index+step/2;const y=padding.top+chartH*(1-day.accuracy);if(!started){context.moveTo(x,y);started=true}else context.lineTo(x,y)}); context.strokeStyle='#79aef0';context.lineWidth=2;context.stroke(); context.fillStyle='#79aef0';daily.forEach((day,index)=>{if(day.accuracy==null)return;const x=padding.left+step*index+step/2;const y=padding.top+chartH*(1-day.accuracy);context.beginPath();context.arc(x,y,3,0,Math.PI*2);context.fill()});context.textAlign='left';
  }

  function teacherBriefText() {
    const analysis = recentAnalysis(14); const recommendation = calculateRecommendation(analysis); const weak = topicAnalysis(analysis.records)[0];
    if (!analysis.activeDays) return '目前尚無自主訓練紀錄。';
    return [`${state.profile.studentName || '學生'}｜${state.profile.subjectName || '科目'}自主訓練摘要`, `近 14 天訓練日：${analysis.activeDays} 天`, `完成：${analysis.attempted}/${analysis.planned} 題（${Math.round((analysis.completion||0)*100)}%）`, `正確率：${Math.round((analysis.accuracy||0)*100)}%`, `平均速度：${analysis.pace?.toFixed(1) || '—'} 分鐘／題`, weak ? `優先主題：${weak.topic}（正確率 ${Math.round(weak.accuracy*100)}%）` : '', `下次建議：${recommendation.questions} 題；${recommendation.difficulty}；檢討比例 ${recommendation.reviewRatio}%`, `調整理由：${recommendation.reason}`].filter(Boolean).join('\n');
  }

  async function copyTeacherBrief() { try { await navigator.clipboard.writeText(teacherBriefText()); showToast('教師摘要已複製。'); } catch { showToast('無法直接複製，請改用列印或匯出。'); } }

  function applyRecommendation() {
    const recommendation = calculateRecommendation(recentAnalysis(14));
    const next = addDays(dateKey(), 1); state.selectedDate = next; state.settings.dailyQuestions = recommendation.questions; state.settings.solveMinutes = recommendation.solveMinutes; state.settings.reviewMinutes = Math.max(10, Math.round(recommendation.solveMinutes * recommendation.reviewRatio / 100 / 5) * 5);
    saveState(); populateForms(); switchView('plan'); renderPlan(); showToast(`已把 ${recommendation.questions} 題建議套用到 ${formatDate(next)}。`);
  }

  function populateForms() {
    $('studentName').value = state.profile.studentName; $('subjectName').value = state.profile.subjectName; $('stageGoal').value = state.profile.stageGoal;
    $('trainingDate').value = state.selectedDate; $('trainingTopic').value = state.settings.topic; $('dailyQuestions').value = state.settings.dailyQuestions; $('startTime').value = state.settings.startTime; $('endTime').value = state.settings.endTime; $('solveMinutes').value = state.settings.solveMinutes; $('reviewMinutes').value = state.settings.reviewMinutes; $('breakMinutes').value = state.settings.breakMinutes; $('bufferPercent').value = state.settings.bufferPercent; $('sessionQuestions').value = state.settings.sessionQuestions; $('strictness').value = state.settings.strictness; updateCapacityPreview();
  }

  function loadDemo() {
    state.profile = { studentName: '小辰', subjectName: '數學', stageGoal: '兩週內把因式分解與一元二次方程正確率提升到 85%' };
    state.settings = { topic: '一元二次方程式', dailyQuestions: 35, startTime: '19:00', endTime: '21:20', solveMinutes: 35, reviewMinutes: 15, breakMinutes: 10, bufferPercent: 15, sessionQuestions: 12, strictness: 'strict' };
    populateForms(); saveState(); showToast('已載入示範學生，可直接產生今天計畫。');
  }

  function exportData() { const blob = new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const anchor=document.createElement('a'); anchor.href=url; anchor.download=`self-training-${dateKey()}.json`; anchor.click(); URL.revokeObjectURL(url); }
  function clearRecords() { if(!state.records.length)return; if(!window.confirm('清除全部自核紀錄與調整紀錄？計畫本身會保留。'))return; state.records=[];state.adjustments=[];Object.values(state.plans).forEach((plan)=>plan.blocks.forEach((block)=>block.status='pending'));saveState();renderAll();showToast('訓練紀錄已清除。'); }

  function switchView(view) { state.activeView=view;saveState();document.querySelectorAll('.view-tab').forEach((button)=>button.classList.toggle('active',button.dataset.view===view));document.querySelectorAll('.view-panel').forEach((panel)=>panel.classList.toggle('active',panel.id===`${view}View`));if(view==='records')renderRecords();if(view==='analysis')renderAnalysis(); }

  function updateClock() { const now=new Date();$('liveDate').textContent=new Intl.DateTimeFormat('zh-TW',{month:'2-digit',day:'2-digit',weekday:'short'}).format(now);$('liveTime').textContent=`${pad(now.getHours())}:${pad(now.getMinutes())}`;renderCurrentBlock(); }

  function bindEvents() {
    document.querySelectorAll('.view-tab').forEach((button)=>button.addEventListener('click',()=>switchView(button.dataset.view)));
    ['dailyQuestions','startTime','endTime','solveMinutes','reviewMinutes','breakMinutes','bufferPercent','sessionQuestions'].forEach((id)=>$(id).addEventListener('input',updateCapacityPreview));
    $('generatePlanButton').addEventListener('click',generatePlan);$('loadDemoButton').addEventListener('click',loadDemo);$('adjustPlanButton').addEventListener('click',adjustRemainingPlan);$('clearPlanButton').addEventListener('click',clearPlan);
    $('previousDateButton').addEventListener('click',()=>switchDate(-1));$('nextDateButton').addEventListener('click',()=>switchDate(1));$('todayButton').addEventListener('click',()=>{state.selectedDate=dateKey();saveState();renderPlan()});
    $('trainingDate').addEventListener('change',()=>{state.selectedDate=$('trainingDate').value;saveState();renderPlan()});
    $('checkForm').addEventListener('submit',saveCheck);$('closeCheckDialogButton').addEventListener('click',()=>$('checkDialog').close());$('cancelCheckButton').addEventListener('click',()=>$('checkDialog').close());$('markSkippedButton').addEventListener('click',markSkippedFromDialog);
    $('recordRange').addEventListener('change',renderRecords);$('clearRecordsButton').addEventListener('click',clearRecords);$('copyTeacherBriefButton').addEventListener('click',copyTeacherBrief);$('applyRecommendationButton').addEventListener('click',applyRecommendation);
    $('exportButton').addEventListener('click',exportData);$('printButton').addEventListener('click',()=>window.print());window.addEventListener('resize',()=>{if(state.activeView==='analysis')renderAnalysis()});
    ['studentName','subjectName','stageGoal'].forEach((id)=>$(id).addEventListener('change',()=>{state.profile={studentName:$('studentName').value.trim(),subjectName:$('subjectName').value.trim(),stageGoal:$('stageGoal').value.trim()};saveState()}));
  }

  function renderAll() { populateForms(); renderPlan(); renderRecords(); renderAnalysis(); switchView(state.activeView || 'plan'); updateClock(); }
  bindEvents(); renderAll(); setInterval(updateClock, 30000);
})();
