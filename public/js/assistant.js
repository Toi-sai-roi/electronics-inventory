// public/js/assistant.js
(function () {
  // ---- Lưu lịch sử chat trong trình duyệt ----
  const KEY = 'assistantLog';
  let log = [];
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved)) log = saved;
  } catch (e) { }
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(log.slice(-40))); } catch (e) { }
  };
  const callsText = (calls) =>
    'Đã tra: ' + calls.map((c) => c.name + '(' + Object.entries(c.args || {}).map(([k, v]) => k + '=' + v).join(', ') + ')').join('; ');

  async function askAssistant(message) {
    const history = log.map(({ role, text }) => ({ role, text }));
    const res = await fetch('/assistant/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);
    log.push({ role: 'user', text: message }, { role: 'model', text: json.reply, calls: json.calls || [] });
    save();
    return json;
  }

  // ---- Giao diện ----
  const style = document.createElement('style');
  style.textContent = `
    #as-btn { position: fixed; right: 20px; bottom: 20px; z-index: 1000; border: 0; border-radius: 999px;
      padding: 12px 20px; background: #0f6b4f; color: #fff; font-weight: 600; cursor: pointer; }
    #as-box { position: fixed; right: 20px; bottom: 76px; z-index: 1000; width: 340px; max-width: calc(100vw - 40px);
      height: 440px; display: flex; flex-direction: column; background: #fff; border: 1px solid #dde5e1;
      border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.12); overflow: hidden; }
    #as-box[hidden] { display: none; }
    .as-head { background: #0f3d2e; color: #fff; padding: 12px 14px; font-weight: 600;
      display: flex; justify-content: space-between; align-items: center; }
    .as-clear { border: 0; background: transparent; color: #bfe3d3; font-size: .8rem; cursor: pointer; }
    .as-msgs { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .as-msg { max-width: 85%; padding: 8px 12px; border-radius: 10px; white-space: pre-wrap; font-size: .92rem; }
    .as-user { align-self: flex-end; background: #0f6b4f; color: #fff; }
    .as-bot { align-self: flex-start; background: #f1f5f3; color: #13211c; }
    .as-calls { align-self: flex-start; font-size: .75rem; color: #5f7169; }
    .as-form { display: flex; border-top: 1px solid #dde5e1; }
    .as-form input { flex: 1; border: 0; padding: 12px; outline: none; }
    .as-form button { border: 0; background: #0f6b4f; color: #fff; padding: 0 16px; cursor: pointer; }
    .as-form button:disabled { opacity: .5; cursor: default; }
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'as-btn';
  btn.textContent = 'Hỏi kho';

  const box = document.createElement('div');
  box.id = 'as-box';
  box.hidden = true;
  box.innerHTML = `
    <div class="as-head">
      <span>Trợ lý kho linh kiện</span>
      <button type="button" class="as-clear" id="as-clear">Xóa chat</button>
    </div>
    <div class="as-msgs" id="as-msgs"></div>
    <form class="as-form" id="as-form">
      <input id="as-input" placeholder="Hỏi về kho, vd: còn bao nhiêu ESP32?" autocomplete="off">
      <button type="submit">Gửi</button>
    </form>`;
  document.body.append(btn, box);

  const msgs = box.querySelector('#as-msgs');
  const form = box.querySelector('#as-form');
  const input = box.querySelector('#as-input');
  const sendBtn = form.querySelector('button');

  function add(cls, text) {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = text; // textContent: chữ do AI trả về không chạy được như mã web
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  // Dựng lại các tin đã lưu khi tải trang
  log.forEach((m) => {
    add(m.role === 'user' ? 'as-msg as-user' : 'as-msg as-bot', m.text);
    if (m.calls && m.calls.length) add('as-calls', callsText(m.calls));
  });

  // Nhớ khung đang mở hay đóng
  try { box.hidden = localStorage.getItem('assistantOpen') !== '1'; } catch (e) { }

  btn.addEventListener('click', () => {
    box.hidden = !box.hidden;
    try { localStorage.setItem('assistantOpen', box.hidden ? '0' : '1'); } catch (e) { }
    if (!box.hidden) input.focus();
  });

  box.querySelector('#as-clear').addEventListener('click', () => {
    log = [];
    save();
    msgs.innerHTML = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    add('as-msg as-user', text);
    const waiting = add('as-msg as-bot', 'Đang tra kho...');
    sendBtn.disabled = true;
    try {
      const json = await askAssistant(text);
      waiting.textContent = json.reply;
      if (json.calls && json.calls.length) add('as-calls', callsText(json.calls));
    } catch (err) {
      waiting.textContent = err.message;
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  });
})();