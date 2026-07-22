(() => {
  'use strict';

  if (window.__lifelineChildThreeDayLoaded) return;
  window.__lifelineChildThreeDayLoaded = true;

  const STORAGE_KEY = 'lifeline-schedule-studio-v1';
  const DAY_START = 9 * 60;
  const DAY_END = 17 * 60;
  const $ = (id) => document.getElementById(id);
  const pad = (value) => String(value).padStart(2, '0');
  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const addDays = (date, amount) => {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    result.setHours(0, 0, 0, 0);
    return result;
  };
  const getDate = (key) => {
    const [year, month, day] = String(key).split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const timeToMinutes = (value) => {
    const [hour, minute] = String(value).split(':').map(Number);
    return hour * 60 + minute;
  };
  const minutesToTime = (minutes) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);

  const currentScript = document.currentScript || [...document.scripts].find((script) => script.src.includes('child-three-day.js'));
  const assetBase = currentScript?.src ? new URL('./', currentScript.src) : new URL('./', location.href);
  const cssUrl = new URL('child-three-day.css', assetBase);
  if (!document.querySelector(`link[href="${cssUrl.href}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl.href;
    document.head.appendChild(link);
  }

  const VENUES = {
    kindergarten: { label: '幼兒園／安親班', rooms: { homeroom: '班級教室', focus: '主題教室', reading: '閱讀角', art: '美術教室', movement: '多功能活動室', outdoor: '戶外遊戲場', science: '探索教室', dining: '餐廳', rest: '午睡區' } },
    learningCenter: { label: '補習班／學習中心', rooms: { homeroom: 'A 教室', focus: 'B 教室', reading: '閱讀區', art: '創意工坊', movement: '多功能教室', outdoor: '戶外活動區', science: '實作教室', dining: '用餐區', rest: '安靜休息室' } },
    school: { label: '學校／校園', rooms: { homeroom: '101 教室', focus: '102 教室', reading: '圖書館', art: '美術教室', movement: '體育館', outdoor: '操場', science: '自然教室', dining: '餐廳', rest: '靜心教室' } },
    camp: { label: '營隊／戶外教育', rooms: { homeroom: '探索基地', focus: '任務帳篷', reading: '故事帳篷', art: '創作帳篷', movement: '草地活動區', outdoor: '戶外探索區', science: '實驗站', dining: '餐飲區', rest: '靜心區' } },
    home: { label: '居家共學', rooms: { homeroom: '客廳學習區', focus: '書房', reading: '閱讀角', art: '餐桌創作區', movement: '客廳活動區', outdoor: '陽台／附近公園', science: '廚房實驗桌', dining: '用餐區', rest: '安靜休息區' } },
    community: { label: '社區活動中心', rooms: { homeroom: '多功能教室 A', focus: '多功能教室 B', reading: '閱讀室', art: '手作教室', movement: '活動大廳', outdoor: '戶外廣場', science: '探索教室', dining: '餐敘區', rest: '靜態休息區' } }
  };

  const COLORS = {
    welcome: '#e7ca86', cognitive: '#79aef0', language: '#a895ee', science: '#82d5ca',
    creative: '#e9a4cd', movement: '#a2d487', outdoor: '#78cca4', break: '#8495a8',
    meal: '#eda978', rest: '#91add0', social: '#c79ae8', reflection: '#e7ca86'
  };
  const CATEGORY = {
    welcome: '生活', cognitive: '主修', language: '語言', science: '探索', creative: '創作',
    movement: '健康', outdoor: '健康', break: '休息', meal: '生活', rest: '休息', social: '合作', reflection: '生活'
  };

  const PROFILES = {
    young: {
      label: '幼兒節奏', focus: '20–30 分鐘', rest: '午睡 60 分鐘', summary: '大量轉換、感官遊戲與大肌肉活動',
      slots: [
        ['09:00','09:25','welcome','homeroom'], ['09:25','09:50','cognitive','focus'], ['09:50','10:10','break','dining'],
        ['10:10','10:40','movement','movement'], ['10:40','11:05','creative','art'], ['11:05','11:20','break','homeroom'],
        ['11:20','11:50','science','science'], ['11:50','12:00','reflection','homeroom'], ['12:00','13:00','meal','dining'],
        ['13:00','14:00','rest','rest'], ['14:00','14:20','break','dining'], ['14:20','14:50','language','reading'],
        ['14:50','15:10','outdoor','outdoor'], ['15:10','15:40','cognitive','homeroom'], ['15:40','16:00','break','rest'],
        ['16:00','16:30','social','movement'], ['16:30','17:00','reflection','homeroom']
      ]
    },
    lower: {
      label: '國小低年級節奏', focus: '35–45 分鐘', rest: '安靜休息 30 分鐘', summary: '認知學習與動態活動交錯',
      slots: [
        ['09:00','09:20','welcome','homeroom'], ['09:20','10:00','cognitive','focus'], ['10:00','10:15','break','rest'],
        ['10:15','10:55','language','reading'], ['10:55','11:15','movement','movement'], ['11:15','11:55','science','science'],
        ['11:55','12:00','reflection','homeroom'], ['12:00','13:00','meal','dining'], ['13:00','13:30','rest','reading'],
        ['13:30','14:15','creative','art'], ['14:15','14:30','break','dining'], ['14:30','15:10','social','homeroom'],
        ['15:10','15:30','outdoor','outdoor'], ['15:30','16:10','language','focus'], ['16:10','16:25','break','rest'],
        ['16:25','16:50','reflection','homeroom'], ['16:50','17:00','welcome','homeroom']
      ]
    },
    upper: {
      label: '國小中高年級節奏', focus: '45–50 分鐘', rest: '安靜閱讀 25 分鐘', summary: '專題、團隊挑戰與成果表達',
      slots: [
        ['09:00','09:15','welcome','homeroom'], ['09:15','10:05','cognitive','focus'], ['10:05','10:20','break','rest'],
        ['10:20','11:10','language','reading'], ['11:10','11:25','movement','movement'], ['11:25','12:00','science','science'],
        ['12:00','13:00','meal','dining'], ['13:00','13:25','rest','reading'], ['13:25','14:15','social','homeroom'],
        ['14:15','14:30','break','dining'], ['14:30','15:20','creative','art'], ['15:20','15:40','outdoor','outdoor'],
        ['15:40','16:30','social','movement'], ['16:30','16:45','break','rest'], ['16:45','17:00','reflection','homeroom']
      ]
    }
  };

  const STYLES = {
    balanced: {
      label: '均衡成長', days: [
        { title: '認識與探索', subtitle: '建立安全感、觀察力與共同節奏' },
        { title: '挑戰與合作', subtitle: '練習思考、協作與解決問題' },
        { title: '整合與成果', subtitle: '整理學習、創作並完成發表' }
      ],
      names: {
        welcome: ['晨間報到與團體暖身','任務啟動與心情分享','成果日目標與分工'],
        cognitive: ['數感與邏輯探索','圖形推理挑戰','成果任務解題'],
        language: ['故事理解與表達','情境閱讀與角色討論','發表稿與口語表達'],
        science: ['自然觀察實驗','生活科學合作挑戰','小小研究成果整理'],
        creative: ['感官藝術創作','團隊創意工作坊','成果作品製作'],
        movement: ['節奏律動與大肌肉活動','合作體能闖關','成果日活力挑戰'],
        outdoor: ['戶外觀察散步','戶外合作遊戲','自然素材收集'],
        social: ['合作遊戲與社交練習','小組任務與溝通','成果展分工與彩排'],
        reflection: ['今日發現與整理','合作回顧與紀錄','作品分享與三日回顧']
      }
    },
    academic: {
      label: '學科加強', days: [
        { title: '基礎診斷', subtitle: '確認數學、閱讀與表達的基礎能力' },
        { title: '核心強化', subtitle: '用任務練習方法、速度與準確度' },
        { title: '應用驗收', subtitle: '完成跨領域題組與成果說明' }
      ],
      names: {
        welcome: ['學習目標與專注啟動','學習策略暖身','成果驗收任務說明'],
        cognitive: ['數學概念與基礎診斷','數學方法與題組挑戰','數學應用成果任務'],
        language: ['閱讀理解與關鍵訊息','閱讀推論與摘要練習','口語表達與成果說明'],
        science: ['數據觀察與科學紀錄','科學推理與實驗任務','圖表整理與結論表達'],
        creative: ['知識圖卡與筆記設計','學習工具創作','成果海報製作'],
        movement: ['專注力體能喚醒','腦力與動作協調挑戰','驗收前活力調整'],
        outdoor: ['戶外數量與形狀觀察','戶外測量任務','校園資料採集'],
        social: ['同儕解題與方法分享','小組題組合作','成果互評與修正'],
        reflection: ['錯題整理與今日回顧','方法筆記與進度檢查','三日能力報告整理']
      }
    },
    exploration: {
      label: '活動探索', days: [
        { title: '發現問題', subtitle: '從自然與生活情境提出問題' },
        { title: '動手實驗', subtitle: '透過建造、測試與合作找答案' },
        { title: '創作發表', subtitle: '把觀察變成作品與展覽' }
      ],
      names: {
        welcome: ['探索隊集合與安全說明','實驗隊任務分組','小小展覽準備'],
        cognitive: ['線索分類與推理遊戲','建造任務與空間挑戰','展品配置與解謎'],
        language: ['自然故事與提問練習','實驗紀錄與訪談','導覽詞與故事發表'],
        science: ['感官觀察與小實驗','材料測試與科學挑戰','實驗成果整理'],
        creative: ['自然素材創作','機關與模型製作','小小展覽作品完成'],
        movement: ['探索者體能暖身','戶外任務闖關','成果日合作挑戰'],
        outdoor: ['生態尋寶與觀察','戶外定向任務','環境藝術採集'],
        social: ['探索隊合作遊戲','任務分工與協作','展覽導覽與接待'],
        reflection: ['觀察筆記與發現分享','測試結果與改良紀錄','三日探索成果分享']
      }
    },
    care: {
      label: '幼兒照護', days: [
        { title: '安心適應', subtitle: '建立生活秩序、情緒辨識與安全感' },
        { title: '生活練習', subtitle: '練習自理、合作與身體感受' },
        { title: '自信表達', subtitle: '透過遊戲與作品肯定自己的成長' }
      ],
      names: {
        welcome: ['晨間照護與情緒報到','生活任務與自理練習','成長日心情分享'],
        cognitive: ['顏色形狀與分類遊戲','生活數量與順序遊戲','成長小任務挑戰'],
        language: ['繪本共讀與情緒表達','生活詞彙與角色遊戲','我的三日故事'],
        science: ['五感探索與安全觀察','身體感受與生活科學','成長觀察小實驗'],
        creative: ['安心小物美術創作','生活工具手作','我的成長作品'],
        movement: ['大肌肉律動與平衡','生活體能與合作遊戲','自信律動與成果遊戲'],
        outdoor: ['戶外感官散步','戶外生活探索','自然放鬆與自由遊戲'],
        social: ['輪流分享與合作遊戲','生活禮貌與同伴互助','感謝圈與作品分享'],
        reflection: ['今日心情與生活整理','自理進步與心情回顧','三日成長與放學準備']
      }
    }
  };

  const COMMON_NAMES = {
    break: ['點心、喝水與如廁','喝水、護眼與伸展','下午點心與自由休息'],
    meal: ['午餐與生活練習','午餐與自由交流','午餐、整理與同儕交流'],
    rest: ['午睡與安靜休息','安靜閱讀與身心休息','靜心閱讀與恢復'],
    welcome: ['晨間報到與團體暖身'],
    reflection: ['整理、回顧與放學準備']
  };

  function readState() {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return state && Array.isArray(state.courses) && Array.isArray(state.sessions) ? state : null;
    } catch {
      return null;
    }
  }

  function writeState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function ageProfile(age) {
    if (age <= 5) return { key: 'young', ...PROFILES.young };
    if (age <= 8) return { key: 'lower', ...PROFILES.lower };
    return { key: 'upper', ...PROFILES.upper };
  }

  function formatDate(key, withYear = true) {
    return new Intl.DateTimeFormat('zh-TW', {
      ...(withYear ? { year: 'numeric' } : {}), month: 'long', day: 'numeric', weekday: 'short'
    }).format(getDate(key));
  }

  function roomFor(venue, roomType) {
    return venue.rooms[roomType] || venue.rooms.homeroom;
  }

  function activityName(style, dayIndex, kind, occurrence) {
    if (['break', 'meal', 'rest'].includes(kind)) {
      const pool = COMMON_NAMES[kind];
      return pool[(dayIndex + occurrence) % pool.length];
    }
    const pool = style.names[kind] || COMMON_NAMES[kind] || ['自主探索活動'];
    return pool[Math.min(dayIndex, pool.length - 1)] || pool[occurrence % pool.length];
  }

  function makeProgram({ age, venueKey, styleKey, startKey, title }) {
    const venue = VENUES[venueKey] || VENUES.school;
    const profile = ageProfile(age);
    const style = STYLES[styleKey] || STYLES.balanced;
    const batchId = uid('child3day');
    const courses = [];
    const sessions = [];
    const days = [];

    for (let dayIndex = 0; dayIndex < 3; dayIndex += 1) {
      const key = dateKey(addDays(getDate(startKey), dayIndex));
      const dayMeta = style.days[dayIndex];
      const kindCounts = {};
      const daySessions = [];
      profile.slots.forEach((slot, slotIndex) => {
        const [startText, endText, kind, roomType] = slot;
        kindCounts[kind] = (kindCounts[kind] || 0) + 1;
        const occurrence = kindCounts[kind] - 1;
        const name = activityName(style, dayIndex, kind, occurrence);
        const start = timeToMinutes(startText);
        const end = timeToMinutes(endText);
        const room = roomFor(venue, roomType);
        const courseId = uid('course');
        const course = {
          id: courseId,
          name,
          teacher: `三日兒童課程 · ${room}`,
          room,
          category: CATEGORY[kind] || '其他',
          duration: end - start,
          priority: ['meal', 'rest', 'break'].includes(kind) ? 1 : (slotIndex < Math.ceil(profile.slots.length / 2) ? 3 : 2),
          preferredStart: startText,
          preferredEnd: endText,
          color: COLORS[kind] || '#e7ca86',
          generatedChildThreeDay: true,
          childAge: age,
          venue: venueKey,
          batchId,
          dayIndex,
          programStyle: styleKey,
          programTitle: title,
          dayTitle: dayMeta.title
        };
        const session = {
          id: uid('session'), courseId, date: key, start, end, room,
          generatedChildThreeDay: true, childAge: age, venue: venueKey, batchId, dayIndex,
          programStyle: styleKey, programTitle: title, dayTitle: dayMeta.title
        };
        courses.push(course);
        sessions.push(session);
        daySessions.push({ ...session, ...course });
      });
      days.push({ key, ...dayMeta, sessions: daySessions });
    }

    return { batchId, age, venueKey, venueLabel: venue.label, styleKey, styleLabel: style.label, title, profile, days, courses, sessions };
  }

  function pruneUnusedGeneratedCourses(state) {
    const referenced = new Set(state.sessions.map((session) => session.courseId));
    state.courses = state.courses.filter((course) => !(course.generatedChildThreeDay || course.generatedChildDay) || referenced.has(course.id));
  }

  function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function ensureDialog() {
    if ($('childThreeDayDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'childThreeDayDialog';
    dialog.className = 'course-dialog child-three-day-dialog';
    dialog.innerHTML = `
      <form id="childThreeDayForm" method="dialog">
        <div class="dialog-heading">
          <div><p class="eyebrow">THREE-DAY CHILD PROGRAM</p><h2>三天兒童課程產生器</h2></div>
          <button class="icon-button" id="closeChildThreeDayButton" value="cancel" type="button" aria-label="關閉">×</button>
        </div>
        <div class="three-day-layout">
          <section class="three-day-settings">
            <p class="three-day-lead">一次建立連續三天 09:00–17:00 課程，三天分別採用探索、合作與成果節奏，不會只是重複同一份課表。</p>
            <div class="form-grid">
              <label>小朋友年齡<input id="threeDayAge" type="number" min="3" max="12" value="6" required /></label>
              <label>活動場域<select id="threeDayVenue">${Object.entries(VENUES).map(([key, venue]) => `<option value="${key}" ${key === 'school' ? 'selected' : ''}>${escapeHtml(venue.label)}</option>`).join('')}</select></label>
              <label>起始日期<input id="threeDayStartDate" type="date" required /></label>
              <label>課程風格<select id="threeDayStyle">${Object.entries(STYLES).map(([key, style]) => `<option value="${key}">${escapeHtml(style.label)}</option>`).join('')}</select></label>
              <label class="wide">課程名稱<input id="threeDayTitle" maxlength="38" value="三日兒童成長營" placeholder="例如：暑期數學探索營" /></label>
            </div>
            <section class="three-day-rule-card">
              <div><span>每日時間</span><strong>09:00–17:00</strong></div>
              <div><span>自動保留</span><strong>午餐、休息、點心</strong></div>
              <div><span>排程原則</span><strong>動靜交錯、三日不重複</strong></div>
            </section>
            <p class="three-day-warning">產生時會取代這三天 09:00–17:00 之間原有的課程；其他時間與其他日期不受影響。</p>
          </section>
          <section class="three-day-preview-wrap">
            <div class="three-day-preview-head"><div><p class="eyebrow">LIVE PREVIEW</p><h3 id="threeDayPreviewTitle">三日課程預覽</h3></div><span id="threeDayProfileBadge">—</span></div>
            <div class="three-day-preview" id="threeDayPreview"></div>
          </section>
        </div>
        <div class="dialog-actions three-day-dialog-actions">
          <button class="ghost-button" id="cancelChildThreeDayButton" value="cancel" type="button">取消</button>
          <span></span>
          <button class="soft-button" data-three-day-action="generate" value="default" type="submit">只產生三天課表</button>
          <button class="primary-button" data-three-day-action="generate-export" value="default" type="submit">產生並輸出圖片</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);

    $('closeChildThreeDayButton').addEventListener('click', () => dialog.close());
    $('cancelChildThreeDayButton').addEventListener('click', () => dialog.close());
    ['threeDayAge','threeDayVenue','threeDayStartDate','threeDayStyle','threeDayTitle'].forEach((id) => $(id).addEventListener('input', renderDialogPreview));
    $('childThreeDayForm').addEventListener('submit', generateThreeDayProgram);
  }

  function formOptions() {
    const state = readState();
    const selected = state?.selectedDate || dateKey(new Date());
    return {
      age: Math.max(3, Math.min(12, Number($('threeDayAge')?.value || 6))),
      venueKey: $('threeDayVenue')?.value || 'school',
      styleKey: $('threeDayStyle')?.value || 'balanced',
      startKey: $('threeDayStartDate')?.value || selected,
      title: $('threeDayTitle')?.value.trim() || '三日兒童成長營'
    };
  }

  function renderDialogPreview() {
    if (!$('threeDayPreview')) return;
    const options = formOptions();
    const program = makeProgram(options);
    $('threeDayPreviewTitle').textContent = options.title;
    $('threeDayProfileBadge').textContent = `${program.age} 歲 · ${program.profile.label}`;
    $('threeDayPreview').innerHTML = program.days.map((day, dayIndex) => `
      <article class="three-day-preview-card">
        <div class="three-day-preview-day"><span>DAY ${dayIndex + 1}</span><strong>${escapeHtml(day.title)}</strong><small>${escapeHtml(formatDate(day.key, false))}</small></div>
        <p>${escapeHtml(day.subtitle)}</p>
        <div>${day.sessions.filter((session) => !['休息','生活'].includes(session.category)).slice(0, 4).map((session) => `<span><i style="--activity-color:${session.color}"></i>${escapeHtml(session.name)}</span>`).join('')}</div>
      </article>`).join('');
  }

  function openThreeDayDialog() {
    ensureDialog();
    const state = readState();
    $('threeDayStartDate').value = state?.selectedDate || dateKey(new Date());
    if ($('childAge')?.value) $('threeDayAge').value = $('childAge').value;
    if ($('childVenue')?.value) $('threeDayVenue').value = $('childVenue').value;
    renderDialogPreview();
    $('childThreeDayDialog').showModal();
  }

  async function generateThreeDayProgram(event) {
    event.preventDefault();
    const action = event.submitter?.dataset.threeDayAction || 'generate';
    const state = readState();
    if (!state) return window.alert('目前課表資料無法讀取，請重新整理後再試。');
    const options = formOptions();
    const program = makeProgram(options);
    const dateSet = new Set(program.days.map((day) => day.key));
    const existing = state.sessions.filter((session) => dateSet.has(session.date) && session.end > DAY_START && session.start < DAY_END);
    if (existing.length && !window.confirm(`所選三天的 09:00–17:00 共有 ${existing.length} 個既有行程。要以新的三天兒童課程取代嗎？`)) return;

    state.sessions = state.sessions.filter((session) => !(dateSet.has(session.date) && session.end > DAY_START && session.start < DAY_END));
    state.courses.push(...program.courses);
    state.sessions.push(...program.sessions);
    state.selectedDate = options.startKey;
    state.rangeStart = options.startKey;
    state.childThreeDayPrograms = Array.isArray(state.childThreeDayPrograms) ? state.childThreeDayPrograms : [];
    state.childThreeDayPrograms.unshift({
      batchId: program.batchId, startDate: options.startKey, title: options.title, age: options.age,
      venueKey: options.venueKey, styleKey: options.styleKey, createdAt: new Date().toISOString()
    });
    state.childThreeDayPrograms = state.childThreeDayPrograms.slice(0, 12);
    pruneUnusedGeneratedCourses(state);
    writeState(state);
    $('childThreeDayDialog').close();

    if (action === 'generate-export') {
      await exportThreeDayImage(program.batchId, state);
    } else {
      showToast('三天兒童課程已建立。');
    }
    location.reload();
  }

  function resolveProgram(batchId = null, suppliedState = null) {
    const state = suppliedState || readState();
    if (!state) return null;
    let sessions = [];
    let resolvedBatch = batchId;
    if (!resolvedBatch) {
      const selectedKey = state.selectedDate || dateKey(new Date());
      resolvedBatch = state.sessions.find((session) => session.date === selectedKey && session.generatedChildThreeDay)?.batchId || null;
    }
    if (resolvedBatch) sessions = state.sessions.filter((session) => session.batchId === resolvedBatch && session.generatedChildThreeDay);
    if (!sessions.length) {
      const start = state.rangeStart || state.selectedDate || dateKey(new Date());
      const keys = new Set([0, 1, 2].map((offset) => dateKey(addDays(getDate(start), offset))));
      sessions = state.sessions.filter((session) => keys.has(session.date));
    }
    const courses = new Map(state.courses.map((course) => [course.id, course]));
    const enriched = sessions.map((session) => ({ ...session, ...(courses.get(session.courseId) || {}) })).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
    const dates = [...new Set(enriched.map((session) => session.date))].sort().slice(0, 3);
    if (!dates.length) {
      const start = state.rangeStart || state.selectedDate || dateKey(new Date());
      dates.push(...[0,1,2].map((offset) => dateKey(addDays(getDate(start), offset))));
    }
    while (dates.length < 3) dates.push(dateKey(addDays(getDate(dates[dates.length - 1]), 1)));
    const first = enriched[0] || {};
    const style = STYLES[first.programStyle] || STYLES.balanced;
    const venue = VENUES[first.venue] || VENUES.school;
    return {
      batchId: resolvedBatch,
      title: first.programTitle || '三日兒童課程表',
      age: first.childAge || '',
      styleLabel: style.label,
      venueLabel: venue.label,
      dates,
      days: dates.map((key, index) => ({
        key,
        title: enriched.find((session) => session.date === key)?.dayTitle || style.days[index]?.title || `第 ${index + 1} 天`,
        subtitle: style.days[index]?.subtitle || '兒童全天課程',
        sessions: enriched.filter((session) => session.date === key)
      }))
    };
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function truncateText(context, text, maxWidth) {
    const value = String(text || '');
    if (context.measureText(value).width <= maxWidth) return value;
    let output = value;
    while (output.length > 1 && context.measureText(`${output}…`).width > maxWidth) output = output.slice(0, -1);
    return `${output}…`;
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG 產生失敗')), 'image/png', 0.96));
  }

  function drawProgramImage(program) {
    const width = 1600;
    const margin = 58;
    const gap = 24;
    const columnWidth = (width - margin * 2 - gap * 2) / 3;
    const maxRows = Math.max(1, ...program.days.map((day) => day.sessions.length));
    const headerHeight = 330;
    const dayHeaderHeight = 150;
    const rowHeight = maxRows > 16 ? 72 : 78;
    const footerHeight = 110;
    const height = Math.max(1900, headerHeight + dayHeaderHeight + maxRows * rowHeight + footerHeight + 70);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#06131f');
    background.addColorStop(0.5, '#0a2031');
    background.addColorStop(1, '#071520');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    const glow = context.createRadialGradient(width * 0.76, 90, 0, width * 0.76, 90, 760);
    glow.addColorStop(0, 'rgba(91, 177, 182, .23)');
    glow.addColorStop(1, 'rgba(91, 177, 182, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, width, 900);

    context.fillStyle = '#e7ca86';
    context.font = '800 25px system-ui, sans-serif';
    context.fillText('LIFELINE · SCHEDULE STUDIO · CHILD PROGRAM', margin, 72);
    context.fillStyle = '#f6f0e5';
    context.font = '800 66px "Noto Sans TC", "PingFang TC", system-ui, sans-serif';
    context.fillText(truncateText(context, program.title, width - margin * 2), margin, 154);
    context.fillStyle = '#93a7ba';
    context.font = '500 28px "Noto Sans TC", system-ui, sans-serif';
    const range = `${formatDate(program.dates[0])}－${formatDate(program.dates[2])}`;
    context.fillText(range, margin, 205);

    const chips = [program.age ? `${program.age} 歲` : '兒童課程', program.venueLabel, program.styleLabel, '每日 09:00–17:00'];
    let chipX = margin;
    chips.forEach((label) => {
      context.font = '700 22px "Noto Sans TC", system-ui, sans-serif';
      const chipWidth = context.measureText(label).width + 40;
      roundedRect(context, chipX, 240, chipWidth, 48, 16);
      context.fillStyle = 'rgba(231, 202, 134, .09)'; context.fill();
      context.strokeStyle = 'rgba(231, 202, 134, .25)'; context.stroke();
      context.fillStyle = '#e7ca86'; context.fillText(label, chipX + 20, 271);
      chipX += chipWidth + 12;
    });

    program.days.forEach((day, dayIndex) => {
      const x = margin + dayIndex * (columnWidth + gap);
      const y = headerHeight;
      roundedRect(context, x, y, columnWidth, height - headerHeight - footerHeight, 30);
      context.fillStyle = 'rgba(255,255,255,.035)'; context.fill();
      context.strokeStyle = 'rgba(255,255,255,.09)'; context.stroke();

      const accent = ['#e7ca86', '#82d5ca', '#a895ee'][dayIndex];
      roundedRect(context, x + 18, y + 18, columnWidth - 36, 118, 22);
      context.fillStyle = `${accent}16`; context.fill();
      context.strokeStyle = `${accent}55`; context.stroke();
      context.fillStyle = accent;
      context.font = '800 19px system-ui, sans-serif';
      context.fillText(`DAY ${dayIndex + 1}`, x + 42, y + 53);
      context.fillStyle = '#f6f0e5';
      context.font = '800 31px "Noto Sans TC", system-ui, sans-serif';
      context.fillText(truncateText(context, day.title, columnWidth - 84), x + 42, y + 91);
      context.fillStyle = '#93a7ba';
      context.font = '500 18px "Noto Sans TC", system-ui, sans-serif';
      context.fillText(formatDate(day.key, false), x + 42, y + 119);

      if (!day.sessions.length) {
        context.fillStyle = '#93a7ba';
        context.font = '600 24px "Noto Sans TC", system-ui, sans-serif';
        context.fillText('這一天尚未安排課程', x + 42, y + 220);
        return;
      }

      day.sessions.forEach((session, rowIndex) => {
        const rowY = y + dayHeaderHeight + rowIndex * rowHeight;
        const rowX = x + 20;
        const rowW = columnWidth - 40;
        roundedRect(context, rowX, rowY, rowW, rowHeight - 8, 16);
        context.fillStyle = rowIndex % 2 ? 'rgba(255,255,255,.022)' : 'rgba(255,255,255,.04)'; context.fill();
        roundedRect(context, rowX, rowY, 7, rowHeight - 8, 4);
        context.fillStyle = session.color || '#82d5ca'; context.fill();

        context.fillStyle = '#e7ca86';
        context.font = '800 18px system-ui, sans-serif';
        context.fillText(minutesToTime(session.start), rowX + 20, rowY + 27);
        context.fillStyle = '#75899c';
        context.font = '600 15px system-ui, sans-serif';
        context.fillText(minutesToTime(session.end), rowX + 20, rowY + 51);

        const contentX = rowX + 98;
        context.fillStyle = '#f6f0e5';
        context.font = '700 18px "Noto Sans TC", system-ui, sans-serif';
        context.fillText(truncateText(context, session.name || '未命名課程', rowW - 120), contentX, rowY + 27);
        const detail = [session.room, session.category].filter(Boolean).join(' · ');
        context.fillStyle = '#93a7ba';
        context.font = '500 14px "Noto Sans TC", system-ui, sans-serif';
        context.fillText(truncateText(context, detail, rowW - 120), contentX, rowY + 50);
      });
    });

    context.fillStyle = '#71869a';
    context.font = '500 20px "Noto Sans TC", system-ui, sans-serif';
    context.fillText('動靜交錯 · 包含午餐、休息、點心、轉換與收拾時間', margin, height - 54);
    context.textAlign = 'right';
    context.fillText(`由 Lifeline 時序環產生 · ${new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())}`, width - margin, height - 54);
    context.textAlign = 'left';
    return canvas;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportThreeDayImage(batchId = null, suppliedState = null) {
    const button = $('exportChildThreeDayButton');
    const original = button?.innerHTML;
    if (button) { button.disabled = true; button.textContent = '正在產生三日圖片…'; }
    try {
      const program = resolveProgram(batchId, suppliedState);
      if (!program) throw new Error('找不到可輸出的三日課程');
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = drawProgramImage(program);
      const blob = await canvasBlob(canvas);
      const filename = `時序環-${program.dates[0]}-三日兒童課表.png`;
      if (typeof File !== 'undefined') {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ title: program.title, text: `${program.title}｜${program.dates[0]} 至 ${program.dates[2]}`, files: [file] });
            showToast('三日課表已開啟分享選單。');
            return;
          } catch (error) {
            if (error?.name === 'AbortError') return;
          }
        }
      }
      downloadBlob(blob, filename);
      showToast('三日課表圖片已輸出。');
    } catch (error) {
      console.error(error);
      showToast(error?.message || '三日課表輸出失敗。');
    } finally {
      if (button) { button.disabled = false; button.innerHTML = original; }
    }
  }

  function injectButtons() {
    const actions = document.querySelector('.toolbar-actions');
    if (!actions || $('childThreeDayButton')) return;
    const createButton = document.createElement('button');
    createButton.className = 'primary-button child-three-day-button';
    createButton.id = 'childThreeDayButton';
    createButton.type = 'button';
    createButton.innerHTML = '<span aria-hidden="true">③</span> 三日兒童課程';
    createButton.addEventListener('click', openThreeDayDialog);

    const exportButton = document.createElement('button');
    exportButton.className = 'three-day-export-button';
    exportButton.id = 'exportChildThreeDayButton';
    exportButton.type = 'button';
    exportButton.innerHTML = '<span aria-hidden="true">▣</span> 三日圖片';
    exportButton.addEventListener('click', () => exportThreeDayImage());

    const singleDayButton = $('childDayButton');
    if (singleDayButton) actions.insertBefore(createButton, singleDayButton);
    else actions.prepend(createButton);
    actions.insertBefore(exportButton, createButton);
  }

  function init() {
    ensureDialog();
    injectButtons();
    window.LifelineChildThreeDay = { open: openThreeDayDialog, exportImage: exportThreeDayImage };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
