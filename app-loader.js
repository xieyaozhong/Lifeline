(async()=>{
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='features.css';
  document.head.appendChild(link);

  const focusEyebrow=document.querySelector('.focus-card .eyebrow');
  if(focusEyebrow) focusEyebrow.textContent='即時任務推薦';

  const timeInput=document.getElementById('taskTime');
  const timeLabel=timeInput&&timeInput.closest('label');
  if(timeLabel&&!document.getElementById('taskTimeLimit')){
    timeLabel.insertAdjacentHTML('afterend',`
      <label>任務限時（分鐘）<input id="taskTimeLimit" type="number" min="5" max="1440" step="5" value="60" required /></label>
      <label>超時處理<select id="taskExpireMode"><option value="expire" selected>立即從今日任務消失</option><option value="keep">保留並標示超時</option></select></label>`);
  }

  const parts=['app-v2.01.part','app-v2.02.part','app-v2.03.part','app-v2.04.part','app-v2.05.part','app-v2.06.part','app-v2.07.part'];
  const code=(await Promise.all(parts.map(async path=>{
    const response=await fetch(path,{cache:'no-store'});
    if(!response.ok) throw new Error(`無法載入 ${path}`);
    return response.text();
  }))).join('');
  (0,eval)(code);
})().catch(error=>{
  console.error('Lifeline v2 載入失敗',error);
  const toast=document.getElementById('toast');
  if(toast){toast.textContent='更新載入失敗，請重新整理頁面。';toast.classList.add('show');}
});
