/**
 * SMS Gammu Viewer panel — v3.0
 * i18n: add your language by creating locales/{code}.js and a PR
 */

const AVAILABLE_LOCALES = ["ru", "en"];
const LOCALE_NAMES = { ru: "Русский", en: "English" };
const PANEL_BASE = new URL(import.meta.url).pathname.replace(/\/panel\.js$/, "");

async function loadLocale(code) {
  const safe = AVAILABLE_LOCALES.includes(code) ? code : "en";
  try {
    const mod = await import(`${PANEL_BASE}/locales/${safe}.js`);
    return mod.default;
  } catch {
    const mod = await import(`${PANEL_BASE}/locales/en.js`);
    return mod.default;
  }
}

const CSS = `
  :host {
    display: block;
    height: 100%;
    font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
    --accent:   var(--primary-color, #03a9f4);
    --bg:       var(--primary-background-color, #f0f2f5);
    --card:     var(--card-background-color, #fff);
    --text:     var(--primary-text-color, #111);
    --sub:      var(--secondary-text-color, #666);
    --line:     var(--divider-color, rgba(0,0,0,.1));
    --unread-bg:     rgba(3,169,244,.08);
    --unread-border: #03a9f4;
    --danger:   #e53935;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .root {
    display: flex;
    height: 100%;
    overflow: hidden;
    background: var(--bg);
  }

  /* ─── Contacts sidebar ─── */
  .contacts {
    width: 300px;
    min-width: 240px;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border-right: 1px solid var(--line);
    position: relative;
  }

  .contacts-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--line);
  }

  .contacts-header-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .contacts-header-row h2 {
    flex: 1;
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
  }

  .unread-badge {
    background: var(--accent);
    color: #fff;
    border-radius: 10px;
    padding: 1px 7px;
    font-size: 12px;
    font-weight: 700;
    display: none;
  }

  .search {
    width: 100%;
    padding: 7px 12px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    outline: none;
    transition: border-color .2s;
  }
  .search:focus { border-color: var(--accent); }

  .status-bar {
    padding: 4px 16px 8px;
    font-size: 11px;
    color: var(--sub);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .signal-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #4caf50;
    flex-shrink: 0;
  }
  .signal-dot.bad { background: #f44336; }
  .signal-dot.mid { background: #ff9800; }

  .contact-list {
    flex: 1;
    overflow-y: auto;
  }

  .contact-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    cursor: pointer;
    border-bottom: 1px solid var(--line);
    transition: background .15s;
    position: relative;
  }
  .contact-item:hover { background: rgba(0,0,0,.03); }
  .contact-item.active { background: rgba(3,169,244,.1); }
  .contact-item.has-unread { background: var(--unread-bg); }
  .contact-item.has-unread::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--unread-border);
  }

  .avatar {
    width: 42px; height: 42px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .avatar.alpha {
    background: #78909c;
    font-size: 12px;
    letter-spacing: -.5px;
  }

  .contact-info { flex: 1; min-width: 0; }

  .contact-row1 {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2px;
  }

  .contact-number {
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .contact-date {
    font-size: 11px;
    color: var(--sub);
    flex-shrink: 0;
    margin-left: 8px;
  }

  .contact-preview {
    font-size: 12px;
    color: var(--sub);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .contact-unread-cnt {
    background: var(--accent);
    color: #fff;
    border-radius: 10px;
    padding: 1px 6px;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
    margin-left: 4px;
  }

  /* ─── Chat area ─── */
  .chat {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .chat-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    background: var(--card);
    border-bottom: 1px solid var(--line);
    min-height: 58px;
  }

  .chat-title {
    flex: 1;
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
  }

  .chat-subtitle {
    font-size: 12px;
    color: var(--sub);
    font-weight: 400;
  }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--sub);
    padding: 7px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    transition: background .15s, color .15s;
  }
  .icon-btn:hover { background: rgba(0,0,0,.06); color: var(--text); }
  .icon-btn.danger:hover { background: rgba(229,57,53,.1); color: var(--danger); }
  .icon-btn.spin svg { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .messages-area {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .msg-bubble {
    max-width: 72%;
    align-self: flex-start;
    background: var(--card);
    border-radius: 4px 16px 16px 16px;
    padding: 10px 14px;
    box-shadow: 0 1px 2px rgba(0,0,0,.08);
    position: relative;
  }

  .msg-text {
    font-size: 14px;
    color: var(--text);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    cursor: pointer;
    user-select: text;
  }
  .msg-text:active { opacity: .7; }
  .msg-bubble.copied {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .msg-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }

  .msg-date {
    font-size: 11px;
    color: var(--sub);
  }

  .msg-unread-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--accent);
  }

  .msg-delete {
    background: none;
    border: none;
    cursor: pointer;
    color: transparent;
    padding: 0 2px;
    border-radius: 4px;
    font-size: 14px;
    transition: color .15s;
    line-height: 1;
    margin-left: auto;
  }
  .msg-bubble:hover .msg-delete { color: var(--sub); }

  /* ─── Send bar ─── */
  .send-bar {
    display: flex; gap: 8px; padding: 10px 14px;
    border-top: 1px solid var(--line);
    background: var(--card); align-items: flex-end;
    flex-shrink: 0;
  }
  .send-input {
    flex: 1; padding: 9px 14px;
    border: 1px solid var(--line); border-radius: 20px;
    background: var(--bg); color: var(--text);
    font-size: 14px; font-family: inherit;
    outline: none; resize: none;
    max-height: 120px; line-height: 1.5;
    transition: border-color .2s;
  }
  .send-input:focus { border-color: var(--accent); }
  .send-input::placeholder { color: var(--sub); }
  .send-btn {
    width: 38px; height: 38px; border-radius: 50%;
    background: var(--accent); color: #fff;
    border: none; cursor: pointer; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: opacity .2s, transform .15s;
  }
  .send-btn:hover { opacity: .85; transform: scale(1.05); }
  .send-btn:disabled { opacity: .35; cursor: default; transform: none; }

  /* ─── Date divider ─── */
  .date-divider {
    display: flex; align-items: center; gap: 10px;
    margin: 10px 0 4px; user-select: none;
  }
  .date-divider::before,
  .date-divider::after {
    content: ''; flex: 1; height: 1px; background: var(--line);
  }
  .date-divider span {
    font-size: 11px; color: var(--sub);
    background: var(--bg); padding: 2px 8px;
    border-radius: 10px; white-space: nowrap;
    border: 1px solid var(--line);
  }
  .msg-delete:hover { color: var(--danger) !important; }

  /* ─── Empty / loading states ─── */
  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--sub);
    gap: 14px;
    text-align: center;
    padding: 40px;
  }
  .empty svg { opacity: .25; }
  .empty p { font-size: 15px; }

  .err-box {
    margin: 12px 16px;
    padding: 12px 16px;
    background: rgba(229,57,53,.09);
    border: 1px solid rgba(229,57,53,.3);
    border-radius: 8px;
    color: #b71c1c;
    font-size: 13px;
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  /* ─── Status page (main area) ─── */
  .status-main {
    flex: 1; overflow-y: auto; padding: 24px;
    background: var(--bg);
  }
  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
    max-width: 900px;
  }
  .stat-card {
    background: var(--card); border-radius: 14px;
    padding: 18px; box-shadow: 0 1px 4px rgba(0,0,0,.07);
  }
  .stat-card h3 {
    font-size: 11px; color: var(--sub);
    text-transform: uppercase; letter-spacing: .6px;
    margin-bottom: 12px; font-weight: 600;
  }
  .stat-row {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 6px 0; font-size: 13px;
    border-bottom: 1px solid var(--line); gap: 12px;
  }
  .stat-row:last-child { border-bottom: none; }
  .stat-key { color: var(--sub); white-space: nowrap; flex-shrink: 0; }
  .stat-val { color: var(--text); font-weight: 500; text-align: right; word-break: break-word; max-width: 65%; }
  .signal-bar-wrap { margin-top: 12px; }
  .signal-label { font-size: 11px; color: var(--sub); margin-bottom: 5px; }
  .signal-bar-bg { height: 8px; background: var(--line); border-radius: 4px; overflow: hidden; }
  .signal-bar-fill { height: 100%; border-radius: 4px; transition: width .6s; }
  .reset-btn {
    margin-top: 20px; padding: 10px 24px;
    border: none; border-radius: 8px;
    background: rgba(229,57,53,.1); color: #c62828;
    cursor: pointer; font-size: 13px; font-weight: 500;
    transition: background .2s;
  }
  .reset-btn:hover { background: rgba(229,57,53,.2); }
  .status-loading { padding: 60px; text-align: center; color: var(--sub); font-size: 14px; }

  /* ─── Mobile ─── */
  .back-btn { display: none; }

  /* ─── FAB new chat ─── */
  .fab {
    position: absolute;
    bottom: 18px; left: 16px;
    width: 50px; height: 50px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 3px 10px rgba(0,0,0,.25);
    transition: transform .15s, box-shadow .15s, opacity .2s;
    z-index: 10;
  }
  .fab:hover { transform: scale(1.07); box-shadow: 0 5px 16px rgba(0,0,0,.3); }
  .fab:active { transform: scale(.95); }

  /* ─── New chat modal ─── */
  .new-chat-overlay {
    display: none; position: absolute; inset: 0;
    background: rgba(0,0,0,.4); z-index: 20;
    align-items: flex-end; justify-content: center;
  }
  .new-chat-overlay.open { display: flex; }
  .new-chat-sheet {
    background: var(--card); border-radius: 18px 18px 0 0;
    padding: 20px 20px 32px; width: 100%; max-width: 500px;
  }
  .new-chat-title {
    font-size: 16px; font-weight: 600; color: var(--text);
    margin-bottom: 16px;
  }
  .new-chat-input {
    width: 100%; padding: 10px 14px;
    border: 1px solid var(--line); border-radius: 10px;
    background: var(--bg); color: var(--text);
    font-size: 14px; font-family: inherit; outline: none;
    transition: border-color .2s; margin-bottom: 10px;
  }
  .new-chat-input:focus { border-color: var(--accent); }
  .new-chat-actions {
    display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px;
  }
  .btn-cancel {
    padding: 9px 18px; border-radius: 8px; border: 1px solid var(--line);
    background: none; color: var(--sub); cursor: pointer; font-size: 14px;
  }
  .btn-start {
    padding: 9px 18px; border-radius: 8px; border: none;
    background: var(--accent); color: #fff; cursor: pointer;
    font-size: 14px; font-weight: 500; transition: opacity .2s;
  }
  .btn-start:disabled { opacity: .4; cursor: default; }

  /* ─── Language picker ─── */
  .lang-picker {
    position: relative;
  }
  .lang-dropdown {
    display: none;
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0,0,0,.15);
    overflow: hidden;
    z-index: 100;
    min-width: 130px;
  }
  .lang-dropdown.open { display: block; }
  .lang-option {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 14px; cursor: pointer;
    font-size: 13px; color: var(--text);
    transition: background .15s;
    white-space: nowrap;
  }
  .lang-option:hover { background: rgba(0,0,0,.05); }
  .lang-option.active { color: var(--accent); font-weight: 500; }
  @media (max-width: 580px) {
    .contacts { width: 100%; border-right: none; }
    .chat { display: none; position: absolute; inset: 0; z-index: 10; background: var(--bg); }
    .root.chat-open .contacts { display: none; }
    .root.chat-open .chat { display: flex; }
    .root.chat-open .back-btn { display: flex !important; }
    .status-grid { grid-template-columns: 1fr; }
    .fab {
      width: 60px; height: 60px;
      bottom: 28px; left: 24px;
    }
  }

  .menu-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 40px; height: 40px;
    background: none; border: none;
    cursor: pointer;
    color: var(--text);
    border-radius: 50%;
    flex-shrink: 0;
    transition: background .15s;
  }
  .menu-btn:hover { background: rgba(0,0,0,.06); }
  .menu-btn.visible { display: inline-flex; }
`;

class SmsGammuPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._locale = null;
    this._contacts = [];
    this._messages = [];
    this._activeNumber = null;
    this._search = "";
    this._refreshing = false;
    this._error = null;
    this._status = null;
    this._pollInterval = 30;
    this._timer = null;
    this._eventTimer = null;
    this._lastEventId = 0;
    this._activeTab = 'chats';
    this._sendText = '';
    this._sending = false;
    this._modemError = null;
    this._narrow = false;
  }

  _t(key, ...args) {
    if (!this._locale) return key;
    const val = this._locale[key];
    if (typeof val === "function") return val(...args);
    return val ?? key;
  }

  _getLangPref() {
    try { return localStorage.getItem("sms_gammu_lang") || this._hass?.language || "en"; }
    catch { return this._hass?.language || "en"; }
  }

  async _initLocale() {
    const lang = this._getLangPref();
    const code = AVAILABLE_LOCALES.includes(lang) ? lang
      : AVAILABLE_LOCALES.includes(lang.split("-")[0]) ? lang.split("-")[0]
      : "en";
    this._locale = await loadLocale(code);
    this._updateLocaleUI();
  }

  _updateLocaleUI() {
    // Обновляем динамические атрибуты после смены языка
    const search = this.shadowRoot?.getElementById("search");
    if (search) search.placeholder = this._t("search");
    const sendInput = this.shadowRoot?.getElementById("send-input");
    if (sendInput) sendInput.placeholder = this._t("send_placeholder");
    const titleEl = this.shadowRoot?.getElementById("chat-title");
    if (titleEl && !this._activeNumber) titleEl.textContent = this._t("select_dialog");
    const fabBtn = this.shadowRoot?.getElementById("fab-new-chat");
    if (fabBtn) fabBtn.title = this._t("new_conversation");
    this._renderStatusBar();
    this._renderContacts();
    this._renderMessages();
  }

  set narrow(val) {
    this._narrow = val;
    if (this._ready) this._updateMenuBtn();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._ready) {
      this._ready = true;
      this._initLocale().then(() => {
        this._render();
        this._load();
        this._loadStatus();
        this._startTimer();
      });
    }
  }

  connectedCallback() {
    if (this._hass && !this._ready) {
      this._ready = true;
      this._initLocale().then(() => {
        this._render();
        this._load();
        this._loadStatus();
        this._startTimer();
      });
    }
  }

  disconnectedCallback() {
    this._stopTimer();
  }

  _token() {
    return this._hass?.auth?.data?.access_token || "";
  }

  async _refreshToken() {
    try {
      await this._hass.auth.refreshAccessToken();
    } catch (_) {}
  }

  async _api(path, method = "GET", body = null) {
    const opts = {
      method,
      headers: { Authorization: `Bearer ${this._token()}` },
    };
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }

    let r = await fetch(`/api/sms_gammu_viewer/${path}`, opts);

    // Токен истёк — обновляем и повторяем один раз
    if (r.status === 401) {
      await this._refreshToken();
      opts.headers["Authorization"] = `Bearer ${this._token()}`;
      r = await fetch(`/api/sms_gammu_viewer/${path}`, opts);
    }

    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async _load() {
    this._refreshing = true;
    this._error = null;
    this._updateRefreshBtn();
    try {
      this._contacts = await this._api("contacts");
      if (this._activeNumber) {
        this._messages = await this._api(
          `messages/${encodeURIComponent(this._activeNumber)}`
        );
      }
    } catch (e) {
      this._error = e.message;
    } finally {
      this._refreshing = false;
      this._updateRefreshBtn();
      this._renderContacts();
      this._renderMessages();
      this._updateBadge();
    }
  }

  async _loadStatus() {
    try {
      const s = await this._api("status");
      this._status = s;
      this._pollInterval = s.poll_interval_hint || 30;
    } catch (_) {}

    try {
      const pi = await this._api("poll_interval");
      this._pollInterval = pi.interval || 30;
    } catch (_) {}

    this._renderStatusBar();
    if (this._activeTab === "status") {
      this._renderStatusPage();
    }
  }

  _startTimer() {
    this._stopTimer();
    this._timer = setInterval(() => this._load(), this._pollInterval * 1000);
    this._eventTimer = setInterval(() => this._pollEvents(), 4000);
  }

  _stopTimer() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._eventTimer) { clearInterval(this._eventTimer); this._eventTimer = null; }
  }

  async _pollEvents() {
    try {
      const data = await this._api(`events?since=${this._lastEventId}`);
      if (!data.events?.length) return;
      this._lastEventId = data.last_id;

      let needContacts = false;
      let needMessages = false;

      for (const ev of data.events) {
        if (ev.type === "new_message") {
          needContacts = true;
          if (ev.data.number === this._activeNumber) {
            needMessages = true;
          }
        } else if (ev.type === "message_deleted" || ev.type === "contact_deleted") {
          needContacts = true;
          needMessages = true;
        } else if (ev.type === "modem_status") {
          if (!ev.data.ok) {
            this._modemError = ev.data;
          } else {
            this._modemError = null;
          }
          this._renderStatusBar();
        }
      }

      if (needContacts) {
        this._contacts = await this._api("contacts");
        this._renderContacts();
        this._updateBadge();
      }
      if (needMessages && this._activeNumber && this._activeTab !== "status") {
        this._messages = await this._api(`messages/${encodeURIComponent(this._activeNumber)}`);
        this._renderMessages();
      }
    } catch (_) {}
  }

  async _selectContact(number) {
    this._activeNumber = number;
    this.shadowRoot.querySelector(".root")?.classList.add("chat-open");
    try {
      this._messages = await this._api(
        `messages/${encodeURIComponent(number)}`
      );
      const unreadIds = this._messages
        .filter((m) => !m.is_read)
        .map((m) => m.id);
      for (const id of unreadIds) {
        await this._api(`read/${id}`, "POST");
      }
      if (unreadIds.length) {
        const c = this._contacts.find((c) => c.number === number);
        if (c) c.unread = 0;
        this._updateBadge();
        this._renderContacts();
      }
    } catch (e) {
      this._error = e.message;
    }
    this._renderContacts();
    this._renderMessages();
  }

  async _deleteMsg(id) {
    try {
      await this._api(`delete/${id}`, "POST");
      this._messages = this._messages.filter((m) => m.id !== id);
      const c = this._contacts.find((c) => c.number === this._activeNumber);
      if (c) c.total = Math.max(0, (c.total || 1) - 1);
      this._renderMessages();
      this._renderContacts();
    } catch (e) {
      this._error = e.message;
      this._renderMessages();
    }
  }

  async _deleteContact(number) {
    if (!confirm(this._t("delete_confirm", number))) return;
    try {
      await this._api(`delete_contact/${encodeURIComponent(number)}`, "POST");
      this._contacts = this._contacts.filter((c) => c.number !== number);
      if (this._activeNumber === number) {
        this._activeNumber = null;
        this._messages = [];
        this.shadowRoot.querySelector(".root")?.classList.remove("chat-open");
      }
      this._renderContacts();
      this._renderMessages();
    } catch (e) {
      this._error = e.message;
      this._renderMessages();
    }
  }

  async _pollNow() {
    try {
      await this._api("poll_now", "POST");
      await new Promise((r) => setTimeout(r, 1500));
      await this._load();
    } catch (e) {
      this._error = e.message;
      this._renderMessages();
    }
  }

  _formatShort(str) {
    if (!str) return "";
    try {
      const d = new Date(str);
      const now = new Date();
      if (now - d < 86400000)
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (now - d < 604800000)
        return d.toLocaleDateString([], { weekday: "short" });
      return d.toLocaleDateString([], { day: "2-digit", month: "short" });
    } catch { return str; }
  }

  _fmtDateLabel(str) {
    if (!str) return "";
    try {
      const d   = new Date(str);
      const now = new Date();
      const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today - 86400000);
      const msgDay    = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (msgDay.getTime() === today.getTime())     return this._t("today");
      if (msgDay.getTime() === yesterday.getTime()) return this._t("yesterday");
      return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
    } catch { return str; }
  }

  _formatFull(str) {
    if (!str) return "";
    try {
      return new Date(str).toLocaleString([], {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return str; }
  }

  _avatar(number) {
    const s = (number || "?").trim();
    const digits = s.replace(/\D/g, "");
    if (digits.length > 0) {
      // Номер телефона — последние 2 цифры
      return digits.slice(-2);
    }
    // Текстовое имя — первые 2 буквы в верхнем регистре
    const letters = s.replace(/[^a-zA-Zа-яёА-ЯЁ]/g, "");
    return letters.slice(0, 2).toUpperCase() || s.slice(0, 2).toUpperCase() || "?";
  }

  _isAlphaTag(number) {
    return number && !/^[+\d\s\-()]+$/.test(number.trim());
  }

  _esc(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  _filteredContacts() {
    if (!this._search.trim()) return this._contacts;
    const q = this._search.toLowerCase();
    return this._contacts.filter(
      (c) =>
        c.number.toLowerCase().includes(q) ||
        (c.last_text || "").toLowerCase().includes(q)
    );
  }

  _updateMenuBtn() {
    const btn = this.shadowRoot.getElementById("menu-btn");
    if (!btn) return;
    if (this._narrow) {
      btn.classList.add("visible");
    } else {
      btn.classList.remove("visible");
    }
  }

  _openNewChat() {
    const overlay = this.shadowRoot.getElementById("new-chat-overlay");
    const numInput = this.shadowRoot.getElementById("new-chat-number");
    const txtInput = this.shadowRoot.getElementById("new-chat-text");
    const sendBtn  = this.shadowRoot.getElementById("new-chat-send");
    const titleEl  = this.shadowRoot.getElementById("new-chat-title");
    const cancelEl = this.shadowRoot.getElementById("new-chat-cancel");
    if (!overlay) return;
    if (titleEl) titleEl.textContent = this._t("new_conversation");
    if (cancelEl) cancelEl.textContent = this._t("cancel");
    if (sendBtn) sendBtn.textContent = this._t("send");
    numInput.value = "";
    numInput.placeholder = this._t("number_placeholder");
    txtInput.value = "";
    txtInput.placeholder = this._t("message_placeholder");
    sendBtn.disabled = true;
    overlay.classList.add("open");
    setTimeout(() => numInput.focus(), 50);
  }

  _closeNewChat() {
    this.shadowRoot.getElementById("new-chat-overlay")?.classList.remove("open");
  }

  async _sendSms() {
    const number = this._activeNumber;
    const text = this._sendText.trim();
    if (!number || !text || this._sending) return;

    this._sending = true;
    const btn = this.shadowRoot.getElementById("send-btn");
    const ta  = this.shadowRoot.getElementById("send-input");
    if (btn) btn.disabled = true;

    try {
      const res = await this._api("send", "POST", { number, text });
      if (res.ok) {
        this._sendText = "";
        if (ta) { ta.value = ""; ta.style.height = "auto"; }
        // Обновляем чат
        this._messages = await this._api(`messages/${encodeURIComponent(number)}`);
        this._renderMessages();
        await this._refreshContacts();
      } else {
        this._showToast(this._t("send_error"));
      }
    } catch (e) {
      this._showToast(this._t("reset_error") + e.message);
    } finally {
      this._sending = false;
      if (btn) btn.disabled = false;
    }
  }

  _showToast(msg, duration = 2500) {
    let toast = this.shadowRoot.getElementById("toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#323232;color:#fff;padding:8px 18px;border-radius:20px;font-size:13px;z-index:9999;transition:opacity .3s;opacity:0;pointer-events:none;";
      this.shadowRoot.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = "1";
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { toast.style.opacity = "0"; }, duration);
  }

  // ─── Tab switching ───

  _switchTab() {
    const isStatus = this._activeTab === "status";
    const root         = this.shadowRoot.getElementById("root");
    const contactList  = this.shadowRoot.getElementById("contact-list");
    const messagesArea = this.shadowRoot.getElementById("messages-area");
    const statusMain   = this.shadowRoot.getElementById("status-main");
    const chatHeader   = this.shadowRoot.getElementById("chat-header");
    const searchBox    = this.shadowRoot.querySelector(".search");

    if (isStatus) {
      if (contactList)  contactList.style.display = "none";
      if (searchBox)    searchBox.style.display = "none";
      if (messagesArea) messagesArea.style.display = "none";
      if (statusMain)   statusMain.style.display = "";
      const sendBarEl = this.shadowRoot.getElementById("send-bar");
      if (sendBarEl) sendBarEl.style.display = "none";
      // Показываем хедер с заголовком "Модем" и кнопкой назад
      if (chatHeader)   chatHeader.style.display = "";
      const titleEl = this.shadowRoot.getElementById("chat-title");
      const subEl   = this.shadowRoot.getElementById("chat-subtitle");
      if (titleEl) titleEl.textContent = this._t("modem_status");
      if (subEl)   subEl.textContent = "";
      const delBtn = this.shadowRoot.getElementById("del-contact-btn");
      if (delBtn) delBtn.style.display = "none";
      // На мобилке показываем правую область
      root?.classList.add("chat-open");
      this._renderStatusPage();
    } else {
      if (contactList)  contactList.style.display = "";
      if (searchBox)    searchBox.style.display = "";
      if (messagesArea) messagesArea.style.display = "";
      if (statusMain)   statusMain.style.display = "none";
      if (chatHeader)   chatHeader.style.display = "";
      // Восстанавливаем заголовок чата
      this._renderMessages();
      if (!this._activeNumber) {
        root?.classList.remove("chat-open");
      }
    }
  }

  _renderStatusPage() {
    const page = this.shadowRoot.getElementById("status-main");
    if (!page || this._activeTab !== "status") return;

    const s = this._status;
    if (!s) {
      page.innerHTML = `<div class="status-loading">${this._t("loading_modem")}</div>`;
      return;
    }

    const pct = s.signal?.SignalPercent ?? 0;
    const barColor = pct >= 50 ? "#4caf50" : pct >= 20 ? "#ff9800" : "#f44336";

    const row = (label, val) => val != null
      ? `<div class="stat-row"><span class="stat-key">${label}</span><span class="stat-val">${this._esc(String(val))}</span></div>`
      : "";

    const card = (title, rows) => `
      <div class="stat-card">
        <h3>${title}</h3>
        ${rows}
      </div>`;

    const signalCard = card(this._t("signal"), `
      ${row(this._t("signal_level"), pct != null ? pct + "%" : null)}
      ${row(this._t("signal_dbm"), s.signal?.SignalStrength)}
      ${row(this._t("ber"), s.signal?.BitErrorRate)}
      <div class="signal-bar-wrap">
        <div class="signal-label">${pct}%</div>
        <div class="signal-bar-bg">
          <div class="signal-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
      </div>
    `);

    const networkCard = card(this._t("network"), `
      ${row(this._t("operator"), s.network?.NetworkName)}
      ${row(this._t("net_status"), s.network?.State)}
      ${row(this._t("network_code"), s.network?.NetworkCode)}
      ${row("Cell ID", s.network?.CID)}
      ${row("LAC", s.network?.LAC)}
    `);

    const modemCard = card(this._t("modem_card"), `
      ${row(this._t("manufacturer"), s.modem?.Manufacturer)}
      ${row(this._t("model"), s.modem?.Model)}
      ${row(this._t("firmware"), s.modem?.Firmware)}
      ${row("IMEI", s.modem?.IMEI)}
    `);

    const simCapacity = s.capacity;
    const simUsed = simCapacity ? `${simCapacity.SIMUsed}/${simCapacity.SIMSize}` : null;
    const phoneUsed = simCapacity ? `${simCapacity.PhoneUsed}/${simCapacity.PhoneSize}` : null;
    const memCard = card(this._t("memory"), `
      ${row(this._t("sim_used"), simUsed)}
      ${row(this._t("phone_used"), phoneUsed)}
      ${row("IMSI", s.sim?.IMSI)}
    `);

    page.innerHTML = `
      <div class="status-grid">
        ${signalCard}
        ${networkCard}
        ${modemCard}
        ${memCard}
      </div>
      <button class="reset-btn" id="reset-modem-btn">${this._t("reset_modem")}</button>`;

    page.querySelector("#reset-modem-btn")?.addEventListener("click", async () => {
      if (!confirm(this._t("reset_confirm"))) return;
      try {
        await this._api("reset_modem", "POST");
        const btn = page.querySelector("#reset-modem-btn");
        if (btn) { btn.textContent = this._t("resetting"); btn.disabled = true; }
        setTimeout(() => this._loadStatus(), 6000);
      } catch (e) {
        alert(this._t("reset_error") + e.message);
      }
    });
  }

  // ─── Render ───

  _render() {
    this.shadowRoot.innerHTML = `
      <style>${CSS}</style>
      <div class="root" id="root">

        <div class="contacts">
          <div class="contacts-header">
            <div class="contacts-header-row">
              <button class="menu-btn" id="menu-btn" title="Меню">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
              <h2>SMS</h2>
              <span class="unread-badge" id="unread-badge"></span>
              <div class="lang-picker">
                <button class="icon-btn" id="lang-btn" title="Language">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </button>
                <div class="lang-dropdown" id="lang-dropdown"></div>
              </div>
              <button class="icon-btn" id="modem-btn" title="Modem status">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                  <line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
              </button>
              <button class="icon-btn" id="refresh-btn" title="Обновить">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </button>
            </div>
            <input class="search" id="search" type="text" placeholder="Поиск…" />
          </div>
          <div class="status-bar" id="status-bar">${this._t("loading_status")}</div>
          <div class="contact-list" id="contact-list"></div>

          <button class="fab" id="fab-new-chat" title="New message">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>

          <!-- Modal: новый чат -->
          <div class="new-chat-overlay" id="new-chat-overlay">
            <div class="new-chat-sheet">
              <div class="new-chat-title" id="new-chat-title">Новое сообщение</div>
              <input class="new-chat-input" id="new-chat-number" type="tel"
                placeholder="+79001234567" />
              <textarea class="new-chat-input" id="new-chat-text" rows="3"
                placeholder="Текст сообщения…" style="resize:none"></textarea>
              <div class="new-chat-actions">
                <button class="btn-cancel" id="new-chat-cancel">Отмена</button>
                <button class="btn-start" id="new-chat-send" disabled>Отправить</button>
              </div>
            </div>
          </div>
        </div>

        <div class="chat" id="chat">
          <div class="chat-header" id="chat-header">
            <button class="icon-btn back-btn" id="back-btn" title="Назад">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <div style="flex:1">
              <div class="chat-title" id="chat-title">Выберите диалог</div>
              <div class="chat-subtitle" id="chat-subtitle"></div>
            </div>
            <button class="icon-btn danger" id="delete-contact-btn" title="Удалить переписку" style="display:none">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
          <div class="messages-area" id="messages-area">
            <div class="empty">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <p>${this._t("select_dialog_left")}</p>
            </div>
          </div>
          <div class="status-main" id="status-main" style="display:none"></div>
          <div class="send-bar" id="send-bar" style="display:none">
            <textarea class="send-input" id="send-input" rows="1" placeholder="Написать сообщение…"></textarea>
            <button class="send-btn" id="send-btn" disabled title="Отправить">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.getElementById("refresh-btn").addEventListener("click", () => {
      this._pollNow();
    });

    this.shadowRoot.getElementById("modem-btn").addEventListener("click", () => {
      this._activeTab = this._activeTab === "status" ? "chats" : "status";
      const btn = this.shadowRoot.getElementById("modem-btn");
      btn.style.color = this._activeTab === "status" ? "var(--accent)" : "";
      this._switchTab();
    });

    this.shadowRoot.getElementById("menu-btn").addEventListener("click", () => {
      this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
    });

    this.shadowRoot.getElementById("lang-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const dd = this.shadowRoot.getElementById("lang-dropdown");
      if (!dd) return;
      const isOpen = dd.classList.contains("open");
      if (isOpen) {
        dd.classList.remove("open");
        return;
      }
      const current = this._locale?.code || "en";
      dd.innerHTML = AVAILABLE_LOCALES.map(code => `
        <div class="lang-option ${code === current ? "active" : ""}" data-lang="${code}">
          ${code === current ? "✓ " : ""}${LOCALE_NAMES[code] || code}
        </div>
      `).join("");
      dd.querySelectorAll(".lang-option").forEach(opt => {
        opt.addEventListener("click", async () => {
          const lang = opt.dataset.lang;
          try { localStorage.setItem("sms_gammu_lang", lang); } catch {}
          dd.classList.remove("open");
          this._locale = await loadLocale(lang);
          this._updateLocaleUI();
        });
      });
      dd.classList.add("open");
    });

    // Закрываем dropdown при клике вне
    this.shadowRoot.addEventListener("click", () => {
      this.shadowRoot.getElementById("lang-dropdown")?.classList.remove("open");
    });

    // FAB — новый чат
    this.shadowRoot.getElementById("fab-new-chat").addEventListener("click", (e) => {
      e.stopPropagation();
      this._openNewChat();
    });
    this.shadowRoot.getElementById("new-chat-overlay").addEventListener("click", (e) => {
      if (e.target === this.shadowRoot.getElementById("new-chat-overlay")) {
        this._closeNewChat();
      }
    });
    this.shadowRoot.getElementById("new-chat-cancel").addEventListener("click", () => {
      this._closeNewChat();
    });

    const numInput  = this.shadowRoot.getElementById("new-chat-number");
    const txtInput  = this.shadowRoot.getElementById("new-chat-text");
    const sendBtn2  = this.shadowRoot.getElementById("new-chat-send");

    const checkReady = () => {
      sendBtn2.disabled = !numInput.value.trim() || !txtInput.value.trim();
    };
    numInput.addEventListener("input", checkReady);
    txtInput.addEventListener("input", checkReady);

    sendBtn2.addEventListener("click", async () => {
      const number = numInput.value.trim();
      const text   = txtInput.value.trim();
      if (!number || !text) return;
      sendBtn2.disabled = true;
      try {
        const res = await this._api("send", "POST", { number, text });
        if (res.ok) {
          this._closeNewChat();
          await this._selectContact(number);
          await this._refreshContacts();
        } else {
          this._showToast(this._t("send_error"));
          sendBtn2.disabled = false;
        }
      } catch (e) {
        this._showToast(this._t("send_error") + ": " + e.message);
        sendBtn2.disabled = false;
      }
    });

    // Применяем состояние narrow если уже знаем
    this._updateMenuBtn();

    const ta = this.shadowRoot.getElementById("send-input");
    ta.addEventListener("input", () => {
      this._sendText = ta.value;
      const btn = this.shadowRoot.getElementById("send-btn");
      if (btn) btn.disabled = !this._sendText.trim() || this._sending;
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this._sendSms();
      }
    });
    this.shadowRoot.getElementById("send-btn").addEventListener("click", () => this._sendSms());

    this.shadowRoot.getElementById("search").addEventListener("input", (e) => {
      this._search = e.target.value;
      this._renderContacts();
    });


    this.shadowRoot.getElementById("back-btn").addEventListener("click", () => {
      if (this._activeTab === "status") {
        // Закрываем страницу модема — возврат к списку
        this._activeTab = "chats";
        const btn = this.shadowRoot.getElementById("modem-btn");
        if (btn) btn.style.color = "";
        this._switchTab();
      } else {
        this._activeNumber = null;
        this.shadowRoot.getElementById("root").classList.remove("chat-open");
        this._renderContacts();
        this._renderMessages();
      }
    });

    this.shadowRoot.getElementById("delete-contact-btn").addEventListener("click", () => {
      if (this._activeNumber) this._deleteContact(this._activeNumber);
    });
  }

  _updateRefreshBtn() {
    const btn = this.shadowRoot.getElementById("refresh-btn");
    if (btn) btn.classList.toggle("spin", this._refreshing);
  }

  _updateBadge() {
    const badge = this.shadowRoot.getElementById("unread-badge");
    if (!badge) return;
    const total = this._contacts.reduce((s, c) => s + (c.unread || 0), 0);
    if (total > 0) {
      badge.textContent = total;
      badge.style.display = "";
    } else {
      badge.style.display = "none";
    }
  }

  _renderStatusBar() {
    const bar = this.shadowRoot.getElementById("status-bar");
    if (!bar) return;

    if (this._modemError) {
      const streak = this._modemError.streak || "";
      bar.innerHTML = `
        <span class="signal-dot bad"></span>
        <span>${streak ? this._t("modem_unavailable_streak", streak) : this._t("modem_unavailable")}</span>
      `;
      return;
    }

    const s = this._status;
    if (s?.collecting) {
      bar.innerHTML = `
        <span class="signal-dot collecting"></span>
        <span>${this._t("collecting")}</span>
      `;
      return;
    }
    if (!s?.signal) {
      bar.innerHTML = `<span class="signal-dot bad"></span><span>${this._t("no_modem")}</span>`;
      return;
    }
    const pct = s.signal?.SignalPercent ?? "?";
    const net = s.network?.NetworkName ?? "";
    const interval = this._pollInterval;
    const dotClass = pct >= 50 ? "" : pct >= 20 ? "mid" : "bad";
    bar.innerHTML = `
      <span class="signal-dot ${dotClass}"></span>
      <span>${net ? net + " · " : ""}${pct}% · ${this._t("poll_every", interval)}</span>
    `;
  }

  _renderContacts() {
    const list = this.shadowRoot.getElementById("contact-list");
    if (!list) return;

    if (this._error && this._contacts.length === 0) {
      list.innerHTML = `<div class="err-box">⚠ ${this._esc(this._error)}</div>`;
      return;
    }

    const items = this._filteredContacts();
    if (items.length === 0) {
      list.innerHTML = `<div class="empty" style="height:120px"><p>${
        this._search ? this._t("nothing_found") : this._t("no_messages")
      }</p></div>`;
      return;
    }

    list.innerHTML = items.map((c) => `
      <div class="contact-item ${c.unread > 0 ? "has-unread" : ""} ${
        c.number === this._activeNumber ? "active" : ""
      }" data-number="${this._esc(c.number)}">
        <div class="avatar ${this._isAlphaTag(c.number) ? 'alpha' : ''}">${this._esc(this._avatar(c.number))}</div>
        <div class="contact-info">
          <div class="contact-row1">
            <span class="contact-number">${this._esc(c.number)}</span>
            <span class="contact-date">${this._formatShort(c.last_date)}</span>
          </div>
          <div class="contact-preview">
            ${this._esc((c.last_text || "").slice(0, 60))}
          </div>
        </div>
        ${c.unread > 0 ? `<span class="contact-unread-cnt">${c.unread}</span>` : ""}
      </div>
    `).join("");

    list.querySelectorAll(".contact-item").forEach((el) => {
      el.addEventListener("click", () => {
        this._selectContact(el.dataset.number);
      });
    });
  }

  _renderMessages() {
    const area = this.shadowRoot.getElementById("messages-area");
    const titleEl = this.shadowRoot.getElementById("chat-title");
    const subEl = this.shadowRoot.getElementById("chat-subtitle");
    const delBtn = this.shadowRoot.getElementById("delete-contact-btn");
    if (!area) return;

    const sendBar = this.shadowRoot.getElementById("send-bar");

    if (!this._activeNumber) {
      titleEl && (titleEl.textContent = this._t("select_dialog"));
      subEl && (subEl.textContent = "");
      delBtn && (delBtn.style.display = "none");
      sendBar && (sendBar.style.display = "none");
      area.innerHTML = `
        <div class="empty">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <p>${this._t("select_dialog_left")}</p>
        </div>`;
      return;
    }

    sendBar && (sendBar.style.display = "");
    const contact = this._contacts.find((c) => c.number === this._activeNumber);
    const count = contact?.total ?? this._messages.length;
    titleEl && (titleEl.textContent = this._activeNumber);
    subEl && (subEl.textContent = this._t("messages_count", count));
    delBtn && (delBtn.style.display = "");

    if (this._messages.length === 0) {
      area.innerHTML = `<div class="empty"><p>Нет сообщений</p></div>`;
      return;
    }

    let html = "";
    let lastLabel = "";
    for (const m of this._messages) {
      const label = this._fmtDateLabel(m.date);
      if (label !== lastLabel) {
        html += `<div class="date-divider"><span>${this._esc(label)}</span></div>`;
        lastLabel = label;
      }
      html += `
        <div class="msg-bubble ${!m.is_read ? "unread" : ""}">
          <div class="msg-text">${this._esc(m.text)}</div>
          <div class="msg-meta">
            ${!m.is_read ? '<span class="msg-unread-dot"></span>' : ""}
            <span class="msg-date">${this._formatFull(m.date)}</span>
            <button class="msg-delete" data-id="${m.id}" title="Удалить">🗑</button>
          </div>
        </div>`;
    }
    area.innerHTML = html;

    area.querySelectorAll(".msg-delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._deleteMsg(parseInt(btn.dataset.id));
      });
    });

    area.querySelectorAll(".msg-text").forEach((el) => {
      el.addEventListener("click", async () => {
        const text = el.textContent;
        const bubble = el.closest(".msg-bubble");
        try {
          await navigator.clipboard.writeText(text);
          bubble?.classList.add("copied");
          setTimeout(() => bubble?.classList.remove("copied"), 800);
          this._showToast(this._t("copied"));
        } catch (_) {
          this._showToast(this._t("copy_failed"));
        }
      });
    });

    area.scrollTop = area.scrollHeight;
  }
}

customElements.define("sms-gammu-panel", SmsGammuPanel);



















