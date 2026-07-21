(() => {
  'use strict';

  const STORAGE_KEY = 'lifeline-schedule-studio-v1';
  const DAY_START = 9 * 60;
  const DAY_END = 17 * 60;
  const $ = (id) => document.getElementById(id);
  const pad = (value) => String(value).padStart(2, '0');
  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const minutesToTime = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  const timeToMinutes = (value) => {
    const [hour, minute] = String(value).split(':').map(Number);
    return hour * 60 + minute;
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);

  const VENUES = {
    kindergarten: {
      label: '幼兒園／安親班',
      rooms: {
        homeroom: '班級教室', focus: '主題教室', reading: '閱讀角', art: '美術教室',
        movement: '多功能活動室', outdoor: '戶外遊戲場', science: '探索教室',
        dining: '餐廳', rest: '午睡區'
      }
    },
    learningCenter: {
      label: '補習班／學習中心',
      rooms: {
        homeroom: 'A 教室', focus: 'B 教室', reading: '閱讀區', art: '創意工坊',
        movement: '多功能教室', outdoor: '戶外活動區', science: '實作教室',
        dining: '用餐區', rest: '安靜休息室'
      }
    },
    school: {
      label: '學校／校園',
      rooms: {
        homeroom: '101 教室', focus: '102 教室', reading: '圖書館', art: '美術教室',
        movement: '體育館', outdoor: '操場', science: '自然教室', dining: '餐廳', rest: '靜心教室'
      }
    },
    camp: {
      label: '營隊／戶外教育',
      rooms: {
        homeroom: '探索基地', focus: '任務帳篷', reading: '故事帳篷', art: '創作帳篷',
        movement: '草地活動區', outdoor: '戶外探索區', science: '實驗站',
        dining: '餐飲區', rest: '靜心區'
      }
    },
    home: {
      label: '居家共學',
      rooms: {
        homeroom: '客廳學習區', focus: '書房', reading: '閱讀角', art: '餐桌創作區',
        movement: '客廳活動區', outdoor: '陽台／附近公園', science: '廚房實驗桌',
        dining: '用餐區', rest: '安靜休息區'
      }
    },
    community: {
      label: '社區活動中心',
      rooms: {
        homeroom: '多功能教室 A', focus: '多功能教室 B', reading: '閱讀室', art: '手作教室',
        movement: '活動大廳', outdoor: '戶外廣場', science: '探索教室',
        dining: '餐敘區', rest: '靜態休息區'
      }
    }
  };

  const COLORS = {
    welcome: '#d9b66f', cognitive: '#77a9ed', language: '#9e8ee8', science: '#67c8bf',
    creative: '#e69ec7', movement: '#9bcf7f', outdoor: '#75c9a1', break: '#8495a8',
    meal: '#e7a36e', rest: '#8ea8c9', social: '#c894e8', reflection: '#d9b66f'
  };

  const CATEGORY = {
    welcome: '生活', cognitive: '主修', language: '語言', science: '探索', creative: '創作',
    movement: '健康', outdoor: '健康', break: '休息', meal: '生活', rest: '休息',
    social: '合作', reflection: '生活'
  };

  const PLANS = {
    young: {
      label: '幼兒節奏',
      rationale: '每次專注約 20–30 分鐘，穿插大肌肉活動、點心與如廁，午餐後保留完整午睡。',
      focus: '20–30 分鐘', breaks: '短休息 4 次', rest: '午睡 60 分鐘', activity: '動態活動 3 次',
      slots: [
        ['09:00','09:25','晨間報到與圓圈時間','welcome','homeroom'],
        ['09:25','09:50','語文與數感遊戲','cognitive','focus'],
        ['09:50','10:10','點心、喝水與如廁','break','dining'],
        ['10:10','10:40','大肌肉律動','movement','movement'],
        ['10:40','11:05','感官美術創作','creative','art'],
        ['11:05','11:20','自由遊戲與轉換','break','homeroom'],
        ['11:20','11:50','自然觀察與探索','science','science'],
        ['11:50','12:00','整理與餐前準備','reflection','homeroom'],
        ['12:00','13:00','午餐與生活練習','meal','dining'],
        ['13:00','14:00','午睡與安靜休息','rest','rest'],
        ['14:00','14:20','起床整理與下午點心','break','dining'],
        ['14:20','14:50','音樂、節奏與故事','language','reading'],
        ['14:50','15:10','戶外自由活動','outdoor','outdoor'],
        ['15:10','15:40','積木建構與空間遊戲','cognitive','homeroom'],
        ['15:40','16:00','喝水與舒展休息','break','rest'],
        ['16:00','16:30','合作遊戲與社交練習','social','movement'],
        ['16:30','17:00','作品分享與放學準備','reflection','homeroom']
      ]
    },
    lower: {
      label: '國小低年級節奏',
      rationale: '學習區塊控制在 35–45 分鐘，認知課程後安排動態轉換，午餐後先安靜閱讀再進入創作。',
      focus: '35–45 分鐘', breaks: '短休息 4 次', rest: '安靜休息 30 分鐘', activity: '動態活動 2 次',
      slots: [
        ['09:00','09:20','報到、目標設定與暖身','welcome','homeroom'],
        ['09:20','10:00','數學邏輯探索','cognitive','focus'],
        ['10:00','10:15','喝水與伸展休息','break','rest'],
        ['10:15','10:55','閱讀理解與故事討論','language','reading'],
        ['10:55','11:15','肢體律動與護眼活動','movement','movement'],
        ['11:15','11:55','生活科學實作','science','science'],
        ['11:55','12:00','洗手與餐前準備','reflection','homeroom'],
        ['12:00','13:00','午餐與自由交流','meal','dining'],
        ['13:00','13:30','安靜閱讀與身心休息','rest','reading'],
        ['13:30','14:15','藝術與手作創作','creative','art'],
        ['14:15','14:30','下午點心與休息','break','dining'],
        ['14:30','15:10','跨領域小組任務','social','homeroom'],
        ['15:10','15:30','戶外活動與放鬆','outdoor','outdoor'],
        ['15:30','16:10','英語情境遊戲','language','focus'],
        ['16:10','16:25','喝水與自由休息','break','rest'],
        ['16:25','16:50','學習歷程與作品整理','reflection','homeroom'],
        ['16:50','17:00','回顧與放學準備','welcome','homeroom']
      ]
    },
    upper: {
      label: '國小中高年級節奏',
      rationale: '核心課程約 45–50 分鐘，上午安排高專注內容，下午轉為專題、創作與團隊挑戰，避免連續久坐。',
      focus: '45–50 分鐘', breaks: '短休息 4 次', rest: '安靜閱讀 25 分鐘', activity: '動態活動 2 次',
      slots: [
        ['09:00','09:15','晨間啟動與今日任務','welcome','homeroom'],
        ['09:15','10:05','數學與問題解決','cognitive','focus'],
        ['10:05','10:20','喝水、護眼與伸展','break','rest'],
        ['10:20','11:10','閱讀寫作與表達','language','reading'],
        ['11:10','11:25','體能喚醒活動','movement','movement'],
        ['11:25','12:00','科學挑戰與實驗','science','science'],
        ['12:00','13:00','午餐與同儕交流','meal','dining'],
        ['13:00','13:25','安靜閱讀與休息','rest','reading'],
        ['13:25','14:15','跨領域專題製作','social','homeroom'],
        ['14:15','14:30','下午點心與休息','break','dining'],
        ['14:30','15:20','創意科技與藝術','creative','art'],
        ['15:20','15:40','戶外活動與舒展','outdoor','outdoor'],
        ['15:40','16:30','團隊任務與成果解題','social','movement'],
        ['16:30','16:45','喝水與自由休息','break','rest'],
        ['16:45','17:00','學習回顧與放學準備','reflection','homeroom']
      ]
    }
  };

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return parsed && Array.isArray(parsed.courses) && Array.isArray(parsed.sessions) ? parsed : null;
    } catch {
      return null;
    }
  }

  function agePlan(age) {
    if (age <= 5) return PLANS.young;
    if (age <= 8) return PLANS.lower;
    return PLANS.upper;
  }

  function roomFor(venue, roomType) {
    return venue.rooms[roomType] || venue.rooms.homeroom;
  }

  function selectedDateText(value) {
    if (!value) return '目前選定日期';
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
      .format(new Date(year, month - 1, day));
  }

  function renderPreview() {
    const age = Math.max(3, Math.min(12, Number($('childAge').value || 6)));
    const venue = VENUES[$('childVenue').value] || VENUES.school;
    const plan = agePlan(age);
    $('childAgeHint').textContent = `${age} 歲 · ${plan.label}`;
    $('childRationale').textContent = plan.rationale;
    $('childRuleFocus').textContent = plan.focus;
    $('childRuleBreaks').textContent = plan.breaks;
    $('childRuleRest').textContent = plan.rest;
    $('childRuleActivity').textContent = plan.activity;
    $('childRoomPreview').innerHTML = [...new Set(plan.slots.map((slot) => roomFor(venue, slot[4])))].map((room) => `<span>${escapeHtml(room)}</span>`).join('');
    $('childTimelinePreview').innerHTML = plan.slots.map((slot) => `
      <div class="child-preview-row">
        <time>${slot[0]}</time>
        <div><strong>${escapeHtml(slot[2])}</strong><span>${escapeHtml(roomFor(venue, slot[4]))}</span></div>
      </div>
    `).join('');
  }

  function openChildDayDialog() {
    const state = loadState();
    $('childSelectedDate').textContent = selectedDateText(state?.selectedDate);
    renderPreview();
    $('childDayDialog').showModal();
    setTimeout(() => $('childAge').focus(), 40);
  }

  function pruneUnusedGeneratedCourses(state) {
    const referenced = new Set(state.sessions.map((session) => session.courseId));
    state.courses = state.courses.filter((course) => !course.generatedChildDay || referenced.has(course.id));
  }

  function generateChildDay(event) {
    event.preventDefault();
    const state = loadState();
    if (!state) {
      window.alert('目前課表資料無法讀取，請重新整理頁面後再試。');
      return;
    }

    const age = Math.max(3, Math.min(12, Number($('childAge').value || 6)));
    const venueKey = $('childVenue').value;
    const venue = VENUES[venueKey] || VENUES.school;
    const plan = agePlan(age);
    const date = state.selectedDate;
    const existing = state.sessions.filter((session) => session.date === date && session.end > DAY_START && session.start < DAY_END);
    if (existing.length && !window.confirm(`${selectedDateText(date)} 的 09:00–17:00 已有 ${existing.length} 堂課。要以兒童全天課程取代嗎？`)) return;

    state.sessions = state.sessions.filter((session) => !(session.date === date && session.end > DAY_START && session.start < DAY_END));
    const batchId = uid('childday');

    plan.slots.forEach((slot, index) => {
      const [startText, endText, name, kind, roomType] = slot;
      const start = timeToMinutes(startText);
      const end = timeToMinutes(endText);
      const room = roomFor(venue, roomType);
      const courseId = uid('course');
      const course = {
        id: courseId,
        name,
        teacher: `兒童課程引導 · ${room}`,
        room,
        category: CATEGORY[kind] || '其他',
        duration: end - start,
        priority: ['meal', 'rest', 'break'].includes(kind) ? 1 : (index < 8 ? 3 : 2),
        preferredStart: startText,
        preferredEnd: endText,
        color: COLORS[kind] || '#d9b66f',
        generatedChildDay: true,
        childAge: age,
        venue: venueKey,
        batchId
      };
      state.courses.push(course);
      state.sessions.push({
        id: uid('session'), courseId, date, start, end, room,
        generatedChildDay: true, childAge: age, venue: venueKey, batchId
      });
    });

    pruneUnusedGeneratedCourses(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $('childDayDialog').close();
    window.location.reload();
  }

  function decorateTraditionalRooms() {
    const state = loadState();
    if (!state) return;
    document.querySelectorAll('.grid-event').forEach((event) => {
      if (event.querySelector('.grid-room')) return;
      const cell = event.closest('.day-cell');
      const timeText = event.querySelector('span')?.textContent || '';
      const name = event.querySelector('strong')?.textContent || '';
      const match = timeText.match(/(\d{2}:\d{2})–(\d{2}:\d{2})/);
      if (!cell || !match) return;
      const course = state.courses.find((item) => item.name === name && item.room && item.preferredStart === match[1] && item.preferredEnd === match[2]);
      if (!course) return;
      const room = document.createElement('em');
      room.className = 'grid-room';
      room.textContent = course.room;
      event.appendChild(room);
    });
  }

  function bindChildDayEvents() {
    $('childDayButton')?.addEventListener('click', openChildDayDialog);
    $('childDayForm')?.addEventListener('submit', generateChildDay);
    $('cancelChildDayButton')?.addEventListener('click', () => $('childDayDialog').close());
    $('childAge')?.addEventListener('input', renderPreview);
    $('childVenue')?.addEventListener('change', renderPreview);

    const table = $('traditionalTable');
    if (table) {
      new MutationObserver(decorateTraditionalRooms).observe(table, { childList: true, subtree: true });
      decorateTraditionalRooms();
    }
  }

  bindChildDayEvents();
})();