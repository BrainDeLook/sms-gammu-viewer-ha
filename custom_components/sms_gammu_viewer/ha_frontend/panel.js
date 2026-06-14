/**
 * SMS Gammu Viewer — панель для Home Assistant
 */

const CSS = `
  :host {
    display: block;
    height: 100%;
    background: var(--primary-background-color, #f5f5f5);
    font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
    --accent: var(--primary-color, #03a9f4);
    --card: var(--card-background-color, #fff);
    --text: var(--primary-text-color, #212121);
    --subtext: var(--secondary-text-color, #727272);
    --divider: var(--divider-color, rgba(0,0,0,.12));
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .layout { display: flex; height: 100%; overflow: hidden; }

  /* ── Сайдбар ── */
  .sidebar {
    width: 320px; min-width: 260px; flex-shrink: 0;
    display: flex; flex-direction: column;
    background: var(--card);
    border-right: 1px solid var(--divider);
  }
  .sidebar-header {
    padding: 16px; display: flex; align-items: center; gap: 10px;
    border-bottom: 1px solid var(--divider);
  }
  .sidebar-header h2 { flex: 1; font-size: 18px; font-weight: 500; color: var(--text); }
  .badge {
    background: var(--accent); color: #fff;
    border-radius: 12px; padding: 2px 8px; font-size: 12px; font-weight: 600;
  }
  .search-wrap { padding: 10px 14px; border-bottom: 1px solid var(--divider); }
  .search-wrap input {
    width: 100%; padding: 7px 12px;
    border: 1px solid var(--divider); border-radius: 18px;
    background: var(--primary-background-color, #f5f5f5);
    color: var(--text); font-size: 14px; outline: none;
    transition: border-color .2s;
  }
  .search-wrap input:focus { border-color: var(--accent); }
  .filters { display: flex; gap: 6px; padding: 8px 14px; border-bottom: 1px solid var(--divider); }
  .filter-btn {
    padding: 4px 12px; border-radius: 14px;
    border: 1px solid var(--divider); background: none;
    color: var(--subtext); font-size: 12px; cursor: pointer; transition: all .2s;
  }
  .filter-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .list { flex: 1; overflow-y: auto; }

  /* ── Элемент списка ── */
  .item {
    padding: 11px 14px; cursor: pointer;
    border-bottom: 1px solid var(--divider);
    transition: background .15s; position: relative;
  }
  .item:hover { background: rgba(0,0,0,.04); }
  .item.selected { background: rgba(3,169,244,.1); }
  .item.unread { background: rgba(3,169,244,.07); }
  .item.unread::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0;
    width: 3px; background: var(--accent); border-radius: 0 2px 2px 0;
  }
  .item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }
  .item-num { font-size: 14px; font-weight: 500; color: var(--text); display: flex; align-items: center; gap: 5px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
  .item-date { font-size: 11px; color: var(--subtext); }
  .item-preview { font-size: 13px; color: var(--subtext); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* ── Детальная область ── */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
  .toolbar {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 18px; border-bottom: 1px solid var(--divider);
    background: var(--card); min-height: 58px;
  }
  .toolbar-title { flex: 1; font-size: 15px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .icon-btn {
    background: none; border: none; cursor: pointer;
    color: var(--subtext); padding: 7px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; transition: background .2s, color .2s;
  }
  .icon-btn:hover { background: rgba(0,0,0,.06); color: var(--text); }
  .icon-btn.spin svg { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .detail { flex: 1; overflow-y: auto; padding: 22px; }

  /* ── Карточка ── */
  .card {
    background: var(--card); border-radius: 12px;
    padding: 22px; max-width: 680px;
    box-shadow: 0 1px 4px rgba(0,0,0,.08);
  }
  .meta { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px; }
  .avatar {
    width: 46px; height: 46px; border-radius: 50%;
    background: var(--accent); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 600; flex-shrink: 0; letter-spacing: 1px;
  }
  .meta-info { flex: 1; }
  .meta-num { font-size: 17px; font-weight: 500; color: var(--text); margin-bottom: 3px; }
  .meta-date { font-size: 13px; color: var(--subtext); }
  .meta-state {
    padding: 2px 10px; border-radius: 10px;
    font-size: 11px; font-weight: 600; text-transform: uppercase;
  }
  .meta-state.unread { background: rgba(3,169,244,.15); color: var(--accent); }
  .meta-state.read { background: rgba(0,0,0,.06); color: var(--subtext); }
  .body {
    font-size: 15px; line-height: 1.7; color: var(--text);
    white-space: pre-wrap; word-break: break-word;
    padding: 14px 16px;
    background: var(--primary-background-color, #f5f5f5);
    border-radius: 8px; border-left: 3px solid var(--accent);
  }

  /* ── Пустые/служебные состояния ── */
  .empty {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    height: 100%; gap: 14px; color: var(--subtext);
    text-align: center; padding: 32px;
  }
  .empty svg { opacity: .25; }
  .empty p { font-size: 14px; }
  .status { text-align: center; padding: 32px; color: var(--subtext); font-size: 14px; }
  .error-box {
    background: rgba(244,67,54,.08);
    border: 1px solid rgba(244,67,54,.25);
    color: #c62828; border-radius: 8px;
    padding: 12px 16px; margin: 14px;
    font-size: 13px; display: flex; align-items: center; gap: 8px;
  }

  @media (max-width: 580px) {
    .sidebar { width: 100%; border-right: none; }
    .layout { flex-direction: column; }
    .main { display: none; }
    .layout.show-detail .sidebar { display: none; }
    .layout.show-detail .main { display: flex; }
  }
`;

class SmsGammuPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._msgs = [];
    this._filtered = [];
    this._selected = null;
    this._loading = false;
    this._refreshing = false;
    this._error = null;
    this._filter = "all";
    this._search = "";
    this._timer = null;
    this._ready = false;
  }

  set hass(h) {
    this._hass = h;
    if (!this._ready) { this._ready = true; this._init(); }
  }

  connectedCallback() {
    if (this._hass && !this._ready) { this._ready = true; this._init(); }
  }

  disconnectedCallback() {
    clearInterval(this._timer);
  }

  _init() {
    this._render();
    this._load();
    this._timer = setInterval(() => this._load(true), 30000);
  }

  async _load(silent = false) {
    if (!silent) { this._loading = true; this._update(); }
    this._refreshing = true;
    this._error = null;
    if (silent) this._updateRefreshBtn();

    try {
      const r = await fetch("/api/sms_gammu_viewer/sms", {
        headers: { Authorization: `Bearer ${this._hass.auth.data.access_token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      this._msgs = Array.isArray(data) ? data : [];
      this._applyFilter();
    } catch (e) {
      this._error = e.message;
    } finally {
      this._loading = false;
      this._refreshing = false;
      this._update();
    }
  }

  _applyFilter() {
    let list = [...this._msgs];
    if (this._filter === "unread") list = list.filter(m => m.State === "UnRead");
    if (this._search.trim()) {
      const q = this._search.toLowerCase();
      list = list.filter(m =>
        (m.Number || "").toLowerCase().includes(q) ||
        (m.Text || "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => new Date(b.Date) - new Date(a.Date));
    this._filtered = list;
  }

  _fmtShort(s) {
    if (!s) return "";
    try {
      const d = new Date(s), now = new Date(), diff = now - d;
      if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (diff < 604800000) return d.toLocaleDateString([], { weekday: "short" });
      return d.toLocaleDateString([], { day: "2-digit", month: "short" });
    } catch { return s; }
  }

  _fmtFull(s) {
    if (!s) return "";
    try {
      return new Date(s).toLocaleString([], {
        day: "2-digit", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    } catch { return s; }
  }

  _avatar(num) {
    const d = (num || "?").replace(/\D/g, "");
    return d.slice(-2) || "??";
  }

  _unread() { return this._msgs.filter(m => m.State === "UnRead").length; }

  _esc(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>${CSS}</style>
      <div class="layout" id="layout">
        <div class="sidebar">
          <div class="sidebar-header">
            <h2>SMS</h2>
            <span class="badge" id="badge" style="display:none"></span>
          </div>
          <div class="search-wrap">
            <input type="text" placeholder="Поиск…" id="search" />
          </div>
          <div class="filters">
            <button class="filter-btn active" data-f="all">Все</button>
            <button class="filter-btn" data-f="unread">Непрочитанные</button>
          </div>
          <div class="list" id="list"></div>
        </div>
        <div class="main">
          <div class="toolbar">
            <span class="toolbar-title" id="ttitle">Выберите сообщение</span>
            <button class="icon-btn" id="refresh-btn" title="Обновить">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
          </div>
          <div class="detail" id="detail">
            ${this._emptyHtml("Выберите сообщение из списка")}
          </div>
        </div>
      </div>`;

    this.shadowRoot.getElementById("refresh-btn")
      .addEventListener("click", () => this._load());

    this.shadowRoot.getElementById("search")
      .addEventListener("input", e => {
        this._search = e.target.value;
        this._applyFilter();
        this._renderList();
      });

    this.shadowRoot.querySelectorAll(".filter-btn").forEach(btn =>
      btn.addEventListener("click", () => {
        this.shadowRoot.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this._filter = btn.dataset.f;
        this._applyFilter();
        this._renderList();
      })
    );
  }

  _updateRefreshBtn() {
    const btn = this.shadowRoot.getElementById("refresh-btn");
    if (btn) btn.classList.toggle("spin", this._refreshing);
  }

  _update() {
    this._updateRefreshBtn();

    const badge = this.shadowRoot.getElementById("badge");
    if (badge) {
      const n = this._unread();
      badge.textContent = n;
      badge.style.display = n > 0 ? "" : "none";
    }

    this._renderList();
    this._renderDetail();
  }

  _renderList() {
    const el = this.shadowRoot.getElementById("list");
    if (!el) return;

    if (this._loading) { el.innerHTML = `<div class="status">Загрузка…</div>`; return; }

    if (this._error) {
      el.innerHTML = `<div class="error-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        ${this._esc(this._error)}
      </div>`;
      return;
    }

    if (!this._filtered.length) {
      el.innerHTML = `<div class="status">${this._search || this._filter !== "all" ? "Ничего не найдено" : "Нет сообщений"}</div>`;
      return;
    }

    el.innerHTML = this._filtered.map((m, i) => {
      const unread = m.State === "UnRead";
      const sel = this._selected?._i === i;
      const preview = (m.Text || "").replace(/\s+/g, " ").slice(0, 75);
      return `<div class="item ${unread ? "unread" : ""} ${sel ? "selected" : ""}" data-i="${i}">
        <div class="item-top">
          <span class="item-num">${unread ? '<span class="dot"></span>' : ""}${this._esc(m.Number || "Неизвестный")}</span>
          <span class="item-date">${this._fmtShort(m.Date)}</span>
        </div>
        <div class="item-preview">${this._esc(preview)}</div>
      </div>`;
    }).join("");

    el.querySelectorAll(".item").forEach(el =>
      el.addEventListener("click", () => {
        const i = +el.dataset.i;
        this._selected = { ...this._filtered[i], _i: i };
        this.shadowRoot.getElementById("layout").classList.add("show-detail");
        this._renderList();
        this._renderDetail();
      })
    );
  }

  _emptyHtml(text) {
    return `<div class="empty">
      <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <p>${text}</p>
    </div>`;
  }

  _renderDetail() {
    const area = this.shadowRoot.getElementById("detail");
    const ttitle = this.shadowRoot.getElementById("ttitle");
    if (!area) return;

    if (!this._selected) {
      if (ttitle) ttitle.textContent = "Выберите сообщение";
      area.innerHTML = this._emptyHtml("Выберите сообщение из списка");
      return;
    }

    const m = this._selected;
    const num = m.Number || "Неизвестный";
    const unread = m.State === "UnRead";
    if (ttitle) ttitle.textContent = num;

    area.innerHTML = `<div class="card">
      <div class="meta">
        <div class="avatar">${this._esc(this._avatar(num))}</div>
        <div class="meta-info">
          <div class="meta-num">${this._esc(num)}</div>
          <div class="meta-date">${this._fmtFull(m.Date)}</div>
        </div>
        <span class="meta-state ${unread ? "unread" : "read"}">${unread ? "Новое" : "Прочитано"}</span>
      </div>
      <div class="body">${this._esc(m.Text || "")}</div>
    </div>`;
  }
}

customElements.define("sms-gammu-panel", SmsGammuPanel);
