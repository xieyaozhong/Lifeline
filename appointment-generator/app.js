(() => {
  'use strict';

  const STORAGE_KEY = 'lifeline-appointment-generator-presets-v1';
  const $ = (id) => document.getElementById(id);
  let qrMode = 'message';
  let generated = { message: '', friend: '' };
  let toastTimer = null;
  let generateTimer = null;

  function normalizeLineId(value) {
    return String(value || '').trim().replace(/^@+/, '').replace(/\s+/g, '');
  }

  function officialLineId() {
    const id = normalizeLineId($('lineId').value);
    return id ? `@${id}` : '';
  }

  function buildMessageLink(lineId, message) {
    return `https://line.me/R/oaMessage/${encodeURIComponent(lineId)}/?${encodeURIComponent(message)}`;
  }

  function buildFriendLink(lineId) {
    return `https://line.me/R/ti/p/${encodeURIComponent(lineId)}`;
  }

  function readForm() {
    return {
      lineId: officialLineId(),
      accountName: $('accountName').value.trim(),
      appointmentType: $('appointmentType').value,
      teacherName: $('teacherName').value.trim(),
      subjectName: $('subjectName').value.trim(),
      preferredDate: $('preferredDate').value,
      preferredTime: $('preferredTime').value,
      message: $('message').value.trim()
    };
  }

  function validate(data, notify = true) {
    if (!data.lineId || data.lineId.length < 3) {
      if (notify) showToast('請輸入有效的 LINE 官方帳號 ID。');
      if (notify) $('lineId').focus();
      return false;
    }
    if (!data.message) {
      if (notify) showToast('請輸入預約訊息。');
      if (notify) $('message').focus();
      return false;
    }
    return true;
  }

  function renderQr(url) {
    if (!window.QRCode) {
      showToast('QR 模組尚未載入，請確認網路連線後重新整理。');
      return;
    }
    const canvas = $('qrCanvas');
    window.QRCode.toCanvas(canvas, url, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#071522', light: '#ffffff' }
    }, (error) => {
      if (error) {
        console.error(error);
        showToast('QR Code 產生失敗，請縮短訊息後再試。');
        return;
      }
      $('qrPlaceholder').classList.add('hidden');
      $('readyBadge').textContent = '可以掃描';
      $('readyBadge').classList.add('ready');
      $('openLineButton').disabled = false;
      $('copyLinkButton').disabled = false;
      $('downloadButton').disabled = false;
    });
  }

  function activeUrl() {
    return generated[qrMode] || '';
  }

  function updateQrMode() {
    document.querySelectorAll('[data-qr-mode]').forEach((button) => {
      button.classList.toggle('active', button.dataset.qrMode === qrMode);
    });
    const isMessage = qrMode === 'message';
    $('qrTitle').textContent = isMessage ? '直接預約訊息' : '加入 LINE 官方好友';
    $('qrDescription').textContent = isMessage
      ? '掃碼後會開啟指定 LINE 官方帳號聊天室，並把約定文字填入訊息欄。'
      : '掃碼後會開啟指定 LINE 官方帳號的個人頁面，讓使用者確認加入好友。';
    const url = activeUrl();
    $('generatedLink').textContent = url || '尚未產生';
    if (url) renderQr(url);
  }

  function generate(event, quiet = false) {
    event?.preventDefault();
    const data = readForm();
    if (!validate(data, !quiet)) return false;
    generated = {
      message: buildMessageLink(data.lineId, data.message),
      friend: buildFriendLink(data.lineId)
    };
    $('messagePreview').textContent = data.message;
    updateQrMode();
    if (!quiet) showToast('預約 QR Code 已產生。');
    return true;
  }

  function scheduleLivePreview() {
    clearTimeout(generateTimer);
    updateMessageCount();
    updateSuggestedMessage(false);
    generateTimer = setTimeout(() => generate(null, true), 220);
  }

  function formatDate(value) {
    if (!value) return '';
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(year, month - 1, day));
  }

  function updateSuggestedMessage(force = true) {
    if (!force && $('appointmentType').value === 'custom') return;
    const teacher = $('teacherName').value.trim() || '老師';
    const subject = $('subjectName').value.trim() || '課程';
    const date = formatDate($('preferredDate').value);
    const time = $('preferredTime').value;
    const dateTime = [date, time].filter(Boolean).join(' ');
    const type = $('appointmentType').value;
    let text = '';
    if (type === 'lesson') text = `您好，我想預約${teacher}的${subject}${dateTime ? `，希望安排在 ${dateTime}` : ''}，請問有哪些可以安排的時段？謝謝。`;
    if (type === 'consultation') text = `您好，我想預約關於${teacher}的${subject}諮詢${dateTime ? `，希望安排在 ${dateTime}` : ''}，方便協助確認嗎？謝謝。`;
    if (type === 'visit') text = `您好，我想預約參觀並了解${subject}${dateTime ? `，希望安排在 ${dateTime}` : ''}，請協助確認，謝謝。`;
    if (type === 'custom') return;
    if (force || !$('message').dataset.userEdited) {
      $('message').value = text;
      updateMessageCount();
    }
  }

  function applyTemplate(template) {
    const teacher = $('teacherName').value.trim() || '老師';
    const subject = $('subjectName').value.trim() || '課程';
    const date = formatDate($('preferredDate').value) || '近期';
    const time = $('preferredTime').value || '合適時段';
    $('message').value = template
      .replaceAll('{老師}', teacher)
      .replaceAll('{項目}', subject)
      .replaceAll('{日期}', date)
      .replaceAll('{時段}', time);
    $('message').dataset.userEdited = 'true';
    scheduleLivePreview();
  }

  function updateMessageCount() {
    $('messageCount').textContent = `${$('message').value.length} / 200`;
    $('messagePreview').textContent = $('message').value.trim() || '預約訊息會顯示在這裡。';
  }

  function openLine() {
    const url = activeUrl();
    if (!url) return;
    window.location.href = url;
  }

  async function copyLink() {
    const url = activeUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showToast('LINE 深連結已複製。');
    } catch {
      const input = document.createElement('textarea');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
      showToast('LINE 深連結已複製。');
    }
  }

  function downloadQr() {
    if (!activeUrl()) return;
    const canvas = $('qrCanvas');
    const anchor = document.createElement('a');
    const name = $('accountName').value.trim() || normalizeLineId($('lineId').value) || 'line';
    anchor.download = `${name}-${qrMode === 'message' ? 'appointment' : 'add-friend'}-qr.png`;
    anchor.href = canvas.toDataURL('image/png');
    anchor.click();
  }

  function loadPresets() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function savePresets(presets) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.slice(0, 8)));
  }

  function savePreset() {
    const data = readForm();
    if (!validate(data)) return;
    const presets = loadPresets().filter((item) => !(item.lineId === data.lineId && item.message === data.message));
    presets.unshift({ ...data, id: `preset_${Date.now()}` });
    savePresets(presets);
    renderPresets();
    showToast('目前設定已儲存。');
  }

  function applyPreset(id) {
    const preset = loadPresets().find((item) => item.id === id);
    if (!preset) return;
    $('lineId').value = normalizeLineId(preset.lineId);
    $('accountName').value = preset.accountName || '';
    $('appointmentType').value = preset.appointmentType || 'lesson';
    $('teacherName').value = preset.teacherName || '';
    $('subjectName').value = preset.subjectName || '';
    $('preferredDate').value = preset.preferredDate || '';
    $('preferredTime').value = preset.preferredTime || '';
    $('message').value = preset.message || '';
    $('message').dataset.userEdited = 'true';
    updateMessageCount();
    generate();
  }

  function deletePreset(id) {
    savePresets(loadPresets().filter((item) => item.id !== id));
    renderPresets();
  }

  function renderPresets() {
    const presets = loadPresets();
    $('presetList').innerHTML = presets.length ? presets.map((item) => `
      <article class="preset-item">
        <button type="button" data-preset-id="${item.id}">
          <strong>${escapeHtml(item.accountName || item.lineId)} · ${escapeHtml(item.subjectName || '預約')}</strong>
          <span>${escapeHtml(item.message)}</span>
        </button>
        <button class="preset-delete" type="button" data-delete-preset="${item.id}" aria-label="刪除設定">×</button>
      </article>
    `).join('') : '<div class="empty-presets">尚未儲存設定。</div>';
    document.querySelectorAll('[data-preset-id]').forEach((button) => button.addEventListener('click', () => applyPreset(button.dataset.presetId)));
    document.querySelectorAll('[data-delete-preset]').forEach((button) => button.addEventListener('click', () => deletePreset(button.dataset.deletePreset)));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function resetForm() {
    $('appointmentForm').reset();
    $('message').value = '您好，我想預約馬卡龍老師的數學課程，請問近期有哪些可以安排的時段？謝謝。';
    $('message').dataset.userEdited = '';
    generated = { message: '', friend: '' };
    $('qrPlaceholder').classList.remove('hidden');
    $('readyBadge').textContent = '等待產生';
    $('readyBadge').classList.remove('ready');
    $('generatedLink').textContent = '尚未產生';
    $('openLineButton').disabled = true;
    $('copyLinkButton').disabled = true;
    $('downloadButton').disabled = true;
    updateMessageCount();
  }

  function showToast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2800);
  }

  function bindEvents() {
    $('appointmentForm').addEventListener('submit', generate);
    $('resetButton').addEventListener('click', resetForm);
    $('savePresetButton').addEventListener('click', savePreset);
    $('clearPresetsButton').addEventListener('click', () => {
      if (!loadPresets().length) return;
      if (window.confirm('清除所有已儲存的約定設定？')) {
        localStorage.removeItem(STORAGE_KEY);
        renderPresets();
      }
    });
    $('openLineButton').addEventListener('click', openLine);
    $('copyLinkButton').addEventListener('click', copyLink);
    $('downloadButton').addEventListener('click', downloadQr);
    document.querySelectorAll('[data-qr-mode]').forEach((button) => button.addEventListener('click', () => {
      qrMode = button.dataset.qrMode;
      updateQrMode();
    }));
    document.querySelectorAll('[data-template]').forEach((button) => button.addEventListener('click', () => applyTemplate(button.dataset.template)));

    ['lineId', 'accountName', 'teacherName', 'subjectName', 'preferredDate', 'preferredTime'].forEach((id) => {
      $(id).addEventListener('input', scheduleLivePreview);
      $(id).addEventListener('change', scheduleLivePreview);
    });
    $('appointmentType').addEventListener('change', () => {
      $('message').dataset.userEdited = '';
      updateSuggestedMessage(true);
      scheduleLivePreview();
    });
    $('message').addEventListener('input', () => {
      $('message').dataset.userEdited = 'true';
      updateMessageCount();
      clearTimeout(generateTimer);
      generateTimer = setTimeout(() => generate(null, true), 220);
    });
  }

  bindEvents();
  renderPresets();
  updateMessageCount();
})();
