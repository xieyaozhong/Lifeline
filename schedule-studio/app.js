(() => {
  'use strict';

  const STORAGE_KEY = 'lifeline-schedule-studio-v1';
  const DAY_START = 6 * 60;
  const DAY_END = 24 * 60;
  const GRID_START = 7 * 60;
  const GRID_END = 23 * 60;
  const COLORS = ['#d9b66f', '#67c8bf', '#77a9ed', '#c894e8', '#eb8f86', '#9bcf7f', '#e69ec7'];

  const $ = (id) => document.getElementById(id);
  const pad = (value) => String(value).padStart(2, '0');
  const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const minutesToTime = (minutes) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
  const timeToMinutes = (value) => {
    if (!value) return 0;
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  };
  const addDays = (date, count) => {
    const result = new Date(date);
    result.setDate(result.getDate() + count);
    result.setHours(0, 0, 0, 0);
    return result;
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  const formatDate = (date, withYear = false) => new Intl.DateTimeFormat('zh-TW', {
    ...(withYear ? { year: 'numeric' } : {}),
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  }).format(date);

  const seedCourses = [
    { id: uid('course'), name: '數學研究', teacher: '深度工作', category: '主修', duration: 90, priority: 3, preferredStart: '09:00', preferredEnd: '14:00', color: '#d9b66f' },
    { id: uid('course'), name: '程式開發', teacher: '專案實作', category: '技能', duration: 120, priority: 3, preferredStart: '10:00', preferredEnd: '19:00', color: '#67c8bf' },
    { id: uid('course'), name: '英文文件閱讀', teacher: '技術英文', category: '語言', duration: 45, priority: 2, preferredStart: '08:00', preferredEnd: '18:00', color: '#77a9ed' },
    { id: uid('course'), name: '圍棋復盤', teacher: '棋力訓練', category: '技能', duration: 60, priority: 2, preferredStart: '18:00', preferredEnd: '22:00', color: '#c894e8' },
    { id: uid('course'), name: '創作與寫作', teacher: '作品產出', category: '創作', duration: 60, priority: 2, preferredStart: '14:00', preferredEnd: '21:00', color: '#eb8f86' },
    { id: uid('course'), name: '運動與恢復', teacher: '身體訓練', category: '健康', duration: 45, priority: 2, preferredStart: '07:00', preferredEnd: '20:00', color: '#9bcf7f' }
  ];

  function initialState() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      version: 1,
      selectedDate: dateKey(today),
      rangeStart: dateKey(today),
      courses: seedCourses,
      sessions: [],
      activeView: 'orbit'
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !Array.isArray(saved.courses) || !Array.isArray(saved.sessions)) return initialState();
      return { ...initialState(), ...saved };
    } catch {
      return initialState();
    }
  }

  let state = loadState();
  let draggedCourseId = null;
  let toastTimer = null;

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function rangeDates() {
    const start = getDate(state.rangeStart);
    return [0, 1, 2].map((offset) => addDays(start, offset));
  }

  function selectedDate() {
    return getDate(state.selectedDate);
  }

  function sessionsFor(date) {
    const key = typeof date === 'string' ? date : dateKey(date);
    return state.sessions
      .filter((session) => session.date === key)
      .sort((a, b) => a.start - b.start);
  }

  function courseById(id) {
    return state.courses.find((course) => course.id === id);
  }

  function sessionCourse(session) {
    return courseById(session.courseId) || { name: '已刪除課程', teacher: '', category: '其他', color: '#71869a' };
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function renderCourseList() {
    const query = $('courseSearch').value.trim().toLowerCase();
    const courses = state.courses.filter((course) => [course.name, course.teacher, course.category].join(' ').toLowerCase().includes(query));
    $('courseCount').textContent = state.courses.length;
    $('courseList').innerHTML = courses.length ? courses.map((course) => `
      <article class="course-card" draggable="true" data-course-id="${course.id}" style="--course-color:${course.color}">
        <div class="course-card-header">
          <div>
            <h3>${escapeHtml(course.name)}</h3>
            <p>${escapeHtml(course.teacher || '自主學習')}</p>
          </div>
          <span class="course-duration">${course.duration}m</span>
        </div>
        <div class="course-tags">
          <span>${escapeHtml(course.category)}</span>
          <span>${['彈性', '重要', '核心'][course.priority - 1]}</span>
          <span>${course.preferredStart}–${course.preferredEnd}</span>
        </div>
        <button class="course-edit" type="button" data-edit-course="${course.id}" aria-label="編輯 ${escapeHtml(course.name)}">⋯</button>
      </article>
    `).join('') : '<div class="empty-state">找不到符合的課程卡。</div>';

    document.querySelectorAll('.course-card').forEach((card) => {
      card.addEventListener('dragstart', (event) => {
        draggedCourseId = card.dataset.courseId;
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', draggedCourseId);
        requestAnimationFrame(() => card.classList.add('dragging'));
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        $('orbitDropZone').classList.remove('drag-over');
      });
      card.addEventListener('dblclick', () => scheduleCourse(card.dataset.courseId, state.selectedDate));
    });

    document.querySelectorAll('[data-edit-course]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        openCourseDialog(button.dataset.editCourse);
      });
    });
  }

  function polar(cx, cy, radius, angle) {
    const radians = (angle - 90) * Math.PI / 180;
    return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
  }

  function describeArc(cx, cy, radius, startAngle, endAngle) {
    const safeEnd = Math.min(endAngle, startAngle + 359.8);
    const start = polar(cx, cy, radius, safeEnd);
    const end = polar(cx, cy, radius, startAngle);
    const largeArc = safeEnd - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  }

  function minuteAngle(minute) {
    return (minute / (24 * 60)) * 360;
  }

  function renderOrbitSvg(svg, date, compact = false) {
    const key = dateKey(date);
    const sessions = sessionsFor(key);
    const now = new Date();
    const isToday = key === dateKey(now);
    const cx = compact ? 50 : 270;
    const cy = compact ? 50 : 270;
    const radius = compact ? 35 : 204;
    const stroke = compact ? 8 : 42;
    const innerRadius = compact ? 23 : 174;
    const currentMinute = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    let html = '';

    html += `<circle class="orbit-base" cx="${cx}" cy="${cy}" r="${radius}" stroke-width="${stroke}" />`;
    html += `<circle class="orbit-ring" cx="${cx}" cy="${cy}" r="${innerRadius}" stroke-width="1" />`;

    if (!compact) {
      for (let hour = 0; hour < 24; hour += 1) {
        const angle = hour * 15;
        const major = hour % 3 === 0;
        const outer = polar(cx, cy, radius + stroke / 2 + 10, angle);
        const inner = polar(cx, cy, radius + stroke / 2 + (major ? -5 : 2), angle);
        html += `<line class="orbit-tick ${major ? 'major' : ''}" x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" stroke-width="${major ? 2 : 1}" />`;
        if (major) {
          const label = polar(cx, cy, radius + stroke / 2 + 26, angle);
          html += `<text class="orbit-label" x="${label.x}" y="${label.y}">${pad(hour)}</text>`;
        }
      }
    }

    sessions.forEach((session) => {
      const course = sessionCourse(session);
      const startAngle = minuteAngle(session.start) + 0.9;
      const endAngle = minuteAngle(session.end) - 0.9;
      const isCurrent = isToday && currentMinute >= session.start && currentMinute < session.end;
      html += `<path class="orbit-segment ${isCurrent ? 'current' : ''}" data-session-id="${session.id}" d="${describeArc(cx, cy, radius, startAngle, endAngle)}" stroke="${course.color}" stroke-width="${stroke}" style="color:${course.color}" />`;
      if (!compact && session.end - session.start >= 45) {
        const middleAngle = minuteAngle((session.start + session.end) / 2);
        const labelPoint = polar(cx, cy, radius, middleAngle);
        const label = course.name.length > 7 ? `${course.name.slice(0, 7)}…` : course.name;
        html += `<text class="orbit-course-label" x="${labelPoint.x}" y="${labelPoint.y}">${escapeHtml(label)}</text>`;
      }
    });

    if (isToday) {
      const angle = minuteAngle(currentMinute);
      const start = polar(cx, cy, compact ? 12 : 108, angle);
      const end = polar(cx, cy, radius + stroke / 2 + (compact ? 3 : 6), angle);
      html += `<line class="orbit-now-line" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" />`;
      html += `<circle class="orbit-now-dot" cx="${end.x}" cy="${end.y}" r="${compact ? 2.4 : 4}" />`;
    }

    svg.setAttribute('viewBox', compact ? '0 0 100 100' : '0 0 540 540');
    svg.innerHTML = html;

    if (!compact) {
      svg.querySelectorAll('[data-session-id]').forEach((path) => {
        path.addEventListener('click', () => {
          const session = state.sessions.find((item) => item.id === path.dataset.sessionId);
          if (!session) return;
          const course = sessionCourse(session);
          const remove = window.confirm(`移除「${course.name}」\n${minutesToTime(session.start)}–${minutesToTime(session.end)}？`);
          if (remove) removeSession(session.id);
        });
      });
    }
  }

  function currentSessionFor(date = new Date()) {
    const key = dateKey(date);
    const minute = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
    return sessionsFor(key).find((session) => minute >= session.start && minute < session.end) || null;
  }

  function nextSessionFor(date = new Date()) {
    const key = dateKey(date);
    const minute = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
    return sessionsFor(key).find((session) => session.start > minute) || null;
  }

  function renderCurrentStatus() {
    const now = new Date();
    const current = currentSessionFor(now);
    const next = nextSessionFor(now);
    $('liveDate').textContent = new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit', weekday: 'short' }).format(now);
    $('liveTime').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    if (current) {
      const course = sessionCourse(current);
      const elapsed = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 - current.start;
      const progress = clamp(elapsed / (current.end - current.start) * 100, 0, 100);
      $('centerStatus').textContent = '目前課程';
      $('currentCourseName').textContent = course.name;
      $('currentCourseTime').textContent = `${minutesToTime(current.start)}–${minutesToTime(current.end)} · ${Math.ceil(current.end - (now.getHours() * 60 + now.getMinutes()))} 分鐘後結束`;
      $('currentCourseProgress').style.width = `${progress}%`;
      $('overviewCurrentName').textContent = course.name;
      $('overviewCurrentTime').textContent = `${minutesToTime(current.start)}–${minutesToTime(current.end)}`;
      $('overviewCurrentTeacher').textContent = course.teacher || course.category;
    } else {
      $('centerStatus').textContent = next ? '下一堂課' : '目前狀態';
      $('currentCourseName').textContent = next ? sessionCourse(next).name : '自由時間';
      $('currentCourseTime').textContent = next ? `${minutesToTime(next.start)} 開始` : '今日課程已完成';
      $('currentCourseProgress').style.width = '0%';
      $('overviewCurrentName').textContent = '自由時間';
      $('overviewCurrentTime').textContent = next ? `下一堂 ${minutesToTime(next.start)}` : '—';
      $('overviewCurrentTeacher').textContent = next ? sessionCourse(next).name : '今日無後續課程';
    }

    if (dateKey(selectedDate()) === dateKey(now)) renderOrbitSvg($('mainOrbit'), selectedDate(), false);
    updateTraditionalCurrentLine(now);
  }

  function renderMainOrbit() {
    const date = selectedDate();
    $('selectedDateButton').textContent = formatDate(date, true);
    renderOrbitSvg($('mainOrbit'), date, false);
    renderAgenda(date);
  }

  function renderDayOrbits() {
    $('dayOrbitList').innerHTML = rangeDates().map((date, index) => {
      const count = sessionsFor(date).length;
      return `
        <button class="day-orbit-card ${dateKey(date) === state.selectedDate ? 'active' : ''}" type="button" data-date="${dateKey(date)}">
          <svg id="miniOrbit${index}" viewBox="0 0 100 100" aria-hidden="true"></svg>
          <div>
            <strong>${formatDate(date)}</strong>
            <span>${count ? `${count} 堂課程` : '等待安排'}</span>
          </div>
        </button>
      `;
    }).join('');

    rangeDates().forEach((date, index) => renderOrbitSvg($(`miniOrbit${index}`), date, true));
    document.querySelectorAll('[data-date]').forEach((button) => button.addEventListener('click', () => {
      state.selectedDate = button.dataset.date;
      saveState();
      renderScheduleViews();
    }));
  }

  function renderAgenda(date) {
    const sessions = sessionsFor(date);
    $('selectedDayTotal').textContent = `${sessions.length} 堂`;
    $('agendaList').innerHTML = sessions.length ? sessions.map((session) => {
      const course = sessionCourse(session);
      return `
        <article class="agenda-item" style="--course-color:${course.color}">
          <span class="agenda-time">${minutesToTime(session.start)}</span>
          <div class="agenda-main">
            <strong>${escapeHtml(course.name)}</strong>
            <span>${minutesToTime(session.start)}–${minutesToTime(session.end)} · ${escapeHtml(course.teacher || course.category)}</span>
          </div>
          <button class="agenda-remove" type="button" data-remove-session="${session.id}" aria-label="移除課程">×</button>
        </article>
      `;
    }).join('') : '<div class="empty-state">這一天還沒有課程。<br>把左側課程卡拖進中央圓環。</div>';

    document.querySelectorAll('[data-remove-session]').forEach((button) => button.addEventListener('click', () => removeSession(button.dataset.removeSession)));
  }

  function renderSummary() {
    const dates = rangeDates();
    const sessions = dates.flatMap((date) => sessionsFor(date));
    const totalMinutes = sessions.reduce((total, session) => total + session.end - session.start, 0);
    const availableMinutes = dates.length * (DAY_END - DAY_START);
    $('threeDayCount').textContent = sessions.length;
    $('threeDayHours').textContent = `${(totalMinutes / 60).toFixed(totalMinutes % 60 ? 1 : 0)}h`;
    $('freeRatio').textContent = `${Math.max(0, Math.round((1 - totalMinutes / availableMinutes) * 100))}%`;
  }

  function findAvailableSlot(date, course, preferredOnly = true) {
    const sessions = sessionsFor(date);
    const duration = Number(course.duration);
    const preferredStart = clamp(timeToMinutes(course.preferredStart), DAY_START, DAY_END - duration);
    const preferredEnd = clamp(timeToMinutes(course.preferredEnd), preferredStart + duration, DAY_END);
    const windows = preferredOnly
      ? [[preferredStart, preferredEnd], [DAY_START, DAY_END]]
      : [[DAY_START, DAY_END]];

    const now = new Date();
    const isToday = date === dateKey(now);
    const floorNow = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15;

    for (const [windowStartRaw, windowEnd] of windows) {
      let cursor = Math.max(windowStartRaw, isToday ? floorNow : DAY_START);
      cursor = Math.ceil(cursor / 15) * 15;
      const occupied = sessions.filter((session) => session.end > cursor && session.start < windowEnd);
      for (const session of occupied) {
        if (cursor + duration <= session.start) return { start: cursor, end: cursor + duration };
        cursor = Math.max(cursor, session.end);
      }
      if (cursor + duration <= windowEnd) return { start: cursor, end: cursor + duration };
    }
    return null;
  }

  function scheduleCourse(courseId, date = state.selectedDate, silent = false) {
    const course = courseById(courseId);
    if (!course) return false;
    const slot = findAvailableSlot(date, course, true);
    if (!slot) {
      if (!silent) showToast(`「${course.name}」在這一天找不到足夠空檔。`);
      return false;
    }
    state.sessions.push({ id: uid('session'), courseId, date, start: slot.start, end: slot.end });
    saveState();
    renderScheduleViews();
    if (!silent) showToast(`已安排「${course.name}」於 ${minutesToTime(slot.start)}。`);
    return true;
  }

  function autoPlanThreeDays() {
    const dates = rangeDates();
    const orderedCourses = [...state.courses].sort((a, b) => b.priority - a.priority || b.duration - a.duration);
    let placed = 0;
    orderedCourses.forEach((course, courseIndex) => {
      const repeat = course.priority === 3 ? 2 : 1;
      for (let i = 0; i < repeat; i += 1) {
        const date = dates[(courseIndex + i) % dates.length];
        if (scheduleCourse(course.id, dateKey(date), true)) placed += 1;
      }
    });
    renderScheduleViews();
    showToast(`自動排程完成，新增 ${placed} 堂課。`);
  }

  function removeSession(sessionId) {
    state.sessions = state.sessions.filter((session) => session.id !== sessionId);
    saveState();
    renderScheduleViews();
    showToast('課程已從課表移除。');
  }

  function clearSelectedDay() {
    const sessions = sessionsFor(state.selectedDate);
    if (!sessions.length) return showToast('這一天目前沒有課程。');
    if (!window.confirm(`清空 ${formatDate(selectedDate())} 的 ${sessions.length} 堂課？`)) return;
    state.sessions = state.sessions.filter((session) => session.date !== state.selectedDate);
    saveState();
    renderScheduleViews();
    showToast('本日課程已清空。');
  }

  function renderTraditionalTable() {
    const dates = rangeDates();
    const hours = [];
    for (let minute = GRID_START; minute < GRID_END; minute += 60) hours.push(minute);

    $('traditionalTable').innerHTML = `
      <div class="table-header">
        <div>時間</div>
        ${dates.map((date) => `<div>${formatDate(date)}</div>`).join('')}
      </div>
      ${hours.map((minute, rowIndex) => `
        <div class="table-row" data-grid-row="${rowIndex}">
          <div class="time-cell">${minutesToTime(minute)}</div>
          ${dates.map((date) => `<div class="day-cell" data-grid-date="${dateKey(date)}" data-grid-minute="${minute}"></div>`).join('')}
        </div>
      `).join('')}
    `;

    dates.forEach((date) => {
      sessionsFor(date).forEach((session) => {
        if (session.end <= GRID_START || session.start >= GRID_END) return;
        const start = clamp(session.start, GRID_START, GRID_END);
        const end = clamp(session.end, GRID_START, GRID_END);
        const rowMinute = Math.floor((start - GRID_START) / 60) * 60 + GRID_START;
        const cell = document.querySelector(`[data-grid-date="${dateKey(date)}"][data-grid-minute="${rowMinute}"]`);
        if (!cell) return;
        const course = sessionCourse(session);
        const top = ((start - rowMinute) / 60) * 66;
        const height = Math.max(26, ((end - start) / 60) * 66 - 4);
        cell.insertAdjacentHTML('beforeend', `
          <article class="grid-event" style="--course-color:${course.color};top:${top}px;height:${height}px" title="${escapeHtml(course.name)} ${minutesToTime(session.start)}–${minutesToTime(session.end)}">
            <strong>${escapeHtml(course.name)}</strong>
            <span>${minutesToTime(session.start)}–${minutesToTime(session.end)}</span>
          </article>
        `);
      });
    });
    updateTraditionalCurrentLine(new Date());
  }

  function updateTraditionalCurrentLine(now) {
    document.querySelectorAll('.current-time-line').forEach((line) => line.remove());
    const key = dateKey(now);
    const minute = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    if (minute < GRID_START || minute >= GRID_END || !rangeDates().some((date) => dateKey(date) === key)) return;
    const rowMinute = Math.floor((minute - GRID_START) / 60) * 60 + GRID_START;
    const cell = document.querySelector(`[data-grid-date="${key}"][data-grid-minute="${rowMinute}"]`);
    if (!cell) return;
    const line = document.createElement('div');
    line.className = 'current-time-line';
    line.style.top = `${((minute - rowMinute) / 60) * 66}px`;
    cell.appendChild(line);
  }

  function renderScheduleViews() {
    renderMainOrbit();
    renderDayOrbits();
    renderSummary();
    renderTraditionalTable();
    renderCurrentStatus();
  }

  function openCourseDialog(courseId = null) {
    const course = courseId ? courseById(courseId) : null;
    $('dialogTitle').textContent = course ? '編輯課程' : '新增課程';
    $('courseId').value = course?.id || '';
    $('courseName').value = course?.name || '';
    $('courseTeacher').value = course?.teacher || '';
    $('courseCategory').value = course?.category || '主修';
    $('courseDuration').value = course?.duration || 60;
    $('coursePriority').value = String(course?.priority || 2);
    $('coursePreferredStart').value = course?.preferredStart || '09:00';
    $('coursePreferredEnd').value = course?.preferredEnd || '20:00';
    $('courseColor').value = course?.color || COLORS[state.courses.length % COLORS.length];
    $('deleteCourseButton').classList.toggle('hidden', !course);
    $('courseDialog').showModal();
    setTimeout(() => $('courseName').focus(), 40);
  }

  function saveCourseFromForm(event) {
    event.preventDefault();
    const id = $('courseId').value;
    const course = {
      id: id || uid('course'),
      name: $('courseName').value.trim(),
      teacher: $('courseTeacher').value.trim(),
      category: $('courseCategory').value,
      duration: Number($('courseDuration').value),
      priority: Number($('coursePriority').value),
      preferredStart: $('coursePreferredStart').value,
      preferredEnd: $('coursePreferredEnd').value,
      color: $('courseColor').value
    };
    if (timeToMinutes(course.preferredEnd) <= timeToMinutes(course.preferredStart)) {
      showToast('偏好結束時間必須晚於開始時間。');
      return;
    }
    if (id) state.courses = state.courses.map((item) => item.id === id ? course : item);
    else state.courses.push(course);
    saveState();
    $('courseDialog').close();
    renderCourseList();
    renderScheduleViews();
    showToast(id ? '課程卡已更新。' : '新課程卡已建立。');
  }

  function deleteCourse() {
    const id = $('courseId').value;
    const course = courseById(id);
    if (!course || !window.confirm(`刪除「${course.name}」及其所有排程？`)) return;
    state.courses = state.courses.filter((item) => item.id !== id);
    state.sessions = state.sessions.filter((session) => session.courseId !== id);
    saveState();
    $('courseDialog').close();
    renderCourseList();
    renderScheduleViews();
    showToast('課程與相關排程已刪除。');
  }

  function switchView(view) {
    state.activeView = view;
    saveState();
    document.querySelectorAll('.view-tab').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
    $('orbitView').classList.toggle('active', view === 'orbit');
    $('gridView').classList.toggle('active', view === 'grid');
    if (view === 'grid') renderTraditionalTable();
  }

  function shiftSelectedDay(offset) {
    const next = addDays(selectedDate(), offset);
    state.selectedDate = dateKey(next);
    const range = rangeDates();
    if (next < range[0]) state.rangeStart = dateKey(next);
    else if (next > range[2]) state.rangeStart = dateKey(addDays(next, -2));
    saveState();
    renderScheduleViews();
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `schedule-studio-${dateKey(new Date())}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function resetDemo() {
    if (!window.confirm('重設課程卡與所有排程？')) return;
    state = initialState();
    saveState();
    renderAll();
    showToast('已重設為初始課程卡。');
  }

  function bindEvents() {
    $('courseSearch').addEventListener('input', renderCourseList);
    $('addCourseButton').addEventListener('click', () => openCourseDialog());
    $('courseForm').addEventListener('submit', saveCourseFromForm);
    $('deleteCourseButton').addEventListener('click', deleteCourse);
    $('cancelDialogButton').addEventListener('click', () => $('courseDialog').close());
    $('previousDayButton').addEventListener('click', () => shiftSelectedDay(-1));
    $('nextDayButton').addEventListener('click', () => shiftSelectedDay(1));
    $('selectedDateButton').addEventListener('click', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      state.selectedDate = dateKey(today);
      state.rangeStart = dateKey(today);
      saveState();
      renderScheduleViews();
    });
    $('clearDayButton').addEventListener('click', clearSelectedDay);
    $('autoPlanButton').addEventListener('click', autoPlanThreeDays);
    $('resetButton').addEventListener('click', resetDemo);
    $('exportButton').addEventListener('click', exportData);
    $('printButton').addEventListener('click', () => window.print());

    document.querySelectorAll('.view-tab').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));

    const dropZone = $('orbitDropZone');
    ['dragenter', 'dragover'].forEach((type) => dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      dropZone.classList.add('drag-over');
    }));
    ['dragleave', 'drop'].forEach((type) => dropZone.addEventListener(type, () => dropZone.classList.remove('drag-over')));
    dropZone.addEventListener('drop', (event) => {
      event.preventDefault();
      const courseId = event.dataTransfer.getData('text/plain') || draggedCourseId;
      scheduleCourse(courseId, state.selectedDate);
      draggedCourseId = null;
    });
    dropZone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && state.courses[0]) scheduleCourse(state.courses[0].id, state.selectedDate);
    });
  }

  function renderAll() {
    renderCourseList();
    renderScheduleViews();
    switchView(state.activeView || 'orbit');
  }

  bindEvents();
  renderAll();
  setInterval(renderCurrentStatus, 1000);
})();
