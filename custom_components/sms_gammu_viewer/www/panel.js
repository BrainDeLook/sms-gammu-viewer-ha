/**
 * SMS Gammu Viewer — панель для Home Assistant
 * Файл: /config/www/sms_gammu_viewer/panel.js
 */

const CSS = `
  :host {
    display: block;
    height: 100%;
    background: var(--primary-background-color, #f5f5f5);
    font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
    --sms-accent: var(--primary-color, #03a9f4);
    --sms-card-bg: var(--card-background-color, #fff);
    --sms-text: var(--primary-text-color, #212121);
    --sms-subtext: var(--secondary-text-color, #727272);
    --sms-divider: var(--divider-color, rgba(0,0,0,.12));
    --sms-unread: rgba(3, 169, 244, 0.08);
    --sms-unread-border: #03a9f4;
  }

  * { box-sizing: border-box; }

  .layout {
    display: flex;
    height: 100%;
    overflow: hidden;
  }

  /* ─── Sidebar со списком ─── */
  .sidebar {
    width: 320px;
    min-width: 260px;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--sms-divider);
    background: var(--sms-card-bg);
  }

  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid var(--sms-divider);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sidebar-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
    color: var(--sms-text);
    flex: 1;
  }

  .badge {
    background: var(--sms-accent);
    color: #fff;
    border-radius: 12px;
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 600;
  }

  .search-box {
    padding: 10px 16px;
    border-bottom: 1px solid var(--sms-divider);
  }

  .search-box input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--sms-divider);
    border-radius: 20px;
    background: var(--primary-background-color, #f5f5f5);
    color: var(--sms-text);
    font-size: 14px;
    outline: none;
    transition: border-color .2s;
  }

  .search-box input:focus {
    border-color: var(--sms-accent);
  }

  .filter-bar {
    padding: 8px 16px;
    display: flex;
    gap: 6px;
    border-bottom: 1px solid var(--sms-divider);
  }

  .filter-btn {
    padding: 4px 12px;
    border-radius: 14px;
    border: 1px solid var(--sms-divider);
    background: transparent;
    color: var(--sms-subtext);
    font-size: 12px;
    cursor: pointer;
    transition: all .2s;
  }

  .filter-btn.active {
    background: var(--sms-accent);
    border-color: var(--sms-accent);
    color: #fff;
  }

  .sms-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .sms-item {
    padding: 12px 16px;
    cursor: pointer;
    border-bottom: 1px solid var(--sms-divider);
    transition: background .15s;
    position: relative;
  }

  .sms-item:hover { background: rgba(0,0,0,.04); }
  .sms-item.selected { background: rgba(3,169,244,.1); }
  .sms-item.unread { background: var(--sms-unread); }

  .sms-item.unread::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--sms-unread-border);
    border-radius: 0 2px 2px 0;
  }

  .item-row1 {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .item-number {
    font-size: 14px;
    font-weight: 500;
    color: var(--sms-text);
  }

  .item-date {
    font-size: 11px;
    color: var(--sms-subtext);
  }

  .item-preview {
    font-size: 13px;
    color: var(--sms-subtext);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .unread-dot {
    display: inline-block;
    width: 8px; height: 8px;
    background: var(--sms-accent);
    border-radius: 50%;
    margin-right: 4px;
    vertical-align: middle;
  }

  /* ─── Основная область ─── */
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .toolbar {
    display: flex;
    align-items: center;
    padding: 12px 20px;
    border-bottom: 1px solid var(--sms-divider);
    background: var(--sms-card-bg);
    gap: 10px;
    min-height: 60px;
  }

  .toolbar-title {
    flex: 1;
    font-size: 16px;
    font-weight: 500;
    color: var(--sms-text);
  }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--sms-subtext);
    padding: 8px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background .2s, color .2s;
    width: 36px; height: 36px;
  }

  .icon-btn:hover {
    background: rgba(0,0,0,.06);
    color: var(--sms-text);
  }

  .icon-btn.spin svg {
    animation: spin 1s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .detail-area {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  /* ─── Карточка SMS ─── */
  .sms-card {
    background: var(--sms-card-bg);
    border-radius: 12px;
    padding: 24px;
    max-width: 720px;
    box-shadow: 0 1px 4px rgba(0,0,0,.08);
  }

  .sms-card .meta {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 20px;
  }

  .avatar {
    width: 48px; height: 48px;
    border-radius: 50%;
    background: var(--sms-accent);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .meta-info { flex: 1; }

  .meta-number {
    font-size: 18px;
    font-weight: 500;
    color: var(--sms-text);
    margin-bottom: 4px;
  }

  .meta-date {
    font-size: 13px;
    color: var(--sms-subtext);
  }

  .meta-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .5px;
  }

  .meta-badge.unread {
    background: rgba(3,169,244,.15);
    color: var(--sms-accent);
  }

  .meta-badge.read {
    background: rgba(0,0,0,.06);
    color: var(--sms-subtext);
  }

  .sms-body {
    font-size: 15px;
    line-height: 1.7;
    color: var(--sms-text);
    white-space: pre-wrap;
    word-break: break-word;
    padding: 16px;
    background: var(--primary-background-color, #f5f5f5);
    border-radius: 8px;
    border-left: 3px solid var(--sms-accent);
  }

  /* ─── Пустые состояния ─── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--sms-subtext);
    gap: 16px;
    text-align: center;
    padding: 40px;
  }

  .empty-state svg {
    opacity: .3;
  }

  .empty-state p {
    margin: 0;
    font-size: 15px;
  }

  /* ─── Ошибка / загрузка ─── */
  .status-msg {
    text-align: center;
    padding: 40px;
    color: var(--sms-subtext);
    font-size: 14px;
  }

  .error-msg {
    background: rgba(244, 67, 54, .1);
    border: 1px solid rgba(244,67,54,.3);
    color: #c62828;
    border-radius: 8px;
    padding: 14px 18px;
    margin: 16px;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* ─── Адаптив ─── */
  @media (max-width: 600px) {
    .sidebar { width: 100%; }
    .layout { flex-direction: column; }
    .main { display: none; }
    .layout.detail-open .sidebar { display: none; }
    .layout.detail-open .main { display: flex; }
  }
`;

class SmsGammuPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._messages = [];
    this._filtered = [];
    this._selected = null;
    this._loading = false;
    this._error = null;
    this._filter = "all";
    this._search = "";
    this._refreshing = false;
    this._autoRefreshTimer = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._initialized = true;
      this._render();
      this._loadMessages();
      this._startAutoRefresh();
    }
  }

  connectedCallback() {
    if (this._hass && !this._initialized) {
      this._initialized = true;
      this._render();
      this._loadMessages();
      this._startAutoRefresh();
    }
  }

  disconnectedCallback() {
    this._stopAutoRefresh();
  }

  _startAutoRefresh() {
    this._autoRefreshTimer = setInterval(() => this._loadMessages(true), 30000);
  }

  _stopAutoRefresh() {
    if (this._autoRefreshTimer) {
      clearInterval(this._autoRefreshTimer);
      this._autoRefreshTimer = null;
    }
  }

  async _loadMessages(silent = false) {
    if (!silent) this._loading = true;
    this._refreshing = true;
    this._error = null;
    this._updateUI();

    try {
      const resp = await fetch("/api/sms_gammu_viewer/sms", {
        headers: {
          Authorization: `Bearer ${this._hass.auth.data.access_token}`,
        },
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text}`);
      }

      const data = await resp.json();
      this._messages = Array.isArray(data) ? data : [];
      this._applyFilter();
    } catch (e) {
      this._error = e.message;
    } finally {
      this._loading = false;
      this._refreshing = false;
      this._updateUI();
    }
  }

  _applyFilter() {
    let list = [...this._messages];

    if (this._filter === "unread") {
      list = list.filter((m) => m.State === "UnRead");
    }

    if (this._search.trim()) {
      const q = this._search.toLowerCase();
      list = list.filter(
        (m) =>
          (m.Number || "").toLowerCase().includes(q) ||
          (m.Text || "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => new Date(b.Date) - new Date(a.Date));
    this._filtered = list;
  }

  _formatDate(str) {
    if (!str) return "";
    try {
      const d = new Date(str);
      const now = new Date();
      const diff = now - d;

      if (diff < 86400000) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (diff < 604800000) {
        return d.toLocaleDateString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
      } else {
        return d.toLocaleDateString([], { day: "2-digit", month: "short", year: "2-digit" });
      }
    } catch {
      return str;
    }
  }

  _formatDateFull(str) {
    if (!str) return "";
    try {
      return new Date(str).toLocaleString([], {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return str;
    }
  }

  _getAvatar(number) {
    const s = (number || "?").replace(/\D/g, "");
    return s.slice(-2) || "?";
  }

  _unreadCount() {
    return this._messages.filter((m) => m.State === "UnRead").length;
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>${CSS}</style>
      <div class="layout" id="layout">
        <div class="sidebar">
          <div class="sidebar-header">
            <h2>SMS</h2>
            <span class="badge" id="unread-badge"></span>
          </div>
          <div class="search-box">
            <input type="text" placeholder="Поиск по номеру или тексту…" id="search-input" />
          </div>
          <div class="filter-bar">
            <button class="filter-btn active" data-filter="all">Все</button>
            <button class="filter-btn" data-filter="unread">Непрочитанные</button>
          </div>
          <div class="sms-list" id="sms-list"></div>
        </div>

        <div class="main">
          <div class="toolbar">
            <span class="toolbar-title" id="toolbar-title">Выберите сообщение</span>
            <button class="icon-btn" id="refresh-btn" title="Обновить">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
          </div>
          <div class="detail-area" id="detail-area">
            <div class="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <p>Выберите сообщение из списка слева</p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot
      .getElementById("refresh-btn")
      .addEventListener("click", () => this._loadMessages());

    this.shadowRoot
      .getElementById("search-input")
      .addEventListener("input", (e) => {
        this._search = e.target.value;
        this._applyFilter();
        this._renderList();
      });

    this.shadowRoot.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.shadowRoot
          .querySelectorAll(".filter-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this._filter = btn.dataset.filter;
        this._applyFilter();
        this._renderList();
      });
    });
  }

  _updateUI() {
    const refreshBtn = this.shadowRoot.getElementById("refresh-btn");
    if (refreshBtn) {
      refreshBtn.classList.toggle("spin", this._refreshing);
    }

    const badge = this.shadowRoot.getElementById("unread-badge");
    if (badge) {
      const cnt = this._unreadCount();
      badge.textContent = cnt > 0 ? cnt : "";
      badge.style.display = cnt > 0 ? "" : "none";
    }

    this._renderList();
    this._renderDetail();
  }

  _renderList() {
    const container = this.shadowRoot.getElementById("sms-list");
    if (!container) return;

    if (this._loading) {
      container.innerHTML = `<div class="status-msg">Загрузка…</div>`;
      return;
    }

    if (this._error) {
      container.innerHTML = `
        <div class="error-msg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          ${this._escHtml(this._error)}
        </div>`;
      return;
    }

    if (this._filtered.length === 0) {
      container.innerHTML = `<div class="status-msg">${
        this._search || this._filter !== "all"
          ? "Ничего не найдено"
          : "Нет сообщений"
      }</div>`;
      return;
    }

    container.innerHTML = this._filtered
      .map((msg, idx) => {
        const isUnread = msg.State === "UnRead";
        const isSelected = this._selected && this._selected._idx === idx;
        const preview = (msg.Text || "").replace(/\s+/g, " ").slice(0, 80);
        return `
          <div class="sms-item ${isUnread ? "unread" : ""} ${isSelected ? "selected" : ""}"
               data-idx="${idx}">
            <div class="item-row1">
              <span class="item-number">
                ${isUnread ? '<span class="unread-dot"></span>' : ""}
                ${this._escHtml(msg.Number || "Неизвестный")}
              </span>
              <span class="item-date">${this._formatDate(msg.Date)}</span>
            </div>
            <div class="item-preview">${this._escHtml(preview)}</div>
          </div>`;
      })
      .join("");

    container.querySelectorAll(".sms-item").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = parseInt(el.dataset.idx);
        this._selected = { ...this._filtered[idx], _idx: idx };
        this._renderList();
        this._renderDetail();
        this.shadowRoot.getElementById("layout").classList.add("detail-open");
      });
    });
  }

  _renderDetail() {
    const area = this.shadowRoot.getElementById("detail-area");
    const title = this.shadowRoot.getElementById("toolbar-title");
    if (!area) return;

    if (!this._selected) {
      title && (title.textContent = "Выберите сообщение");
      area.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <p>Выберите сообщение из списка слева</p>
        </div>`;
      return;
    }

    const msg = this._selected;
    const number = msg.Number || "Неизвестный";
    const isUnread = msg.State === "UnRead";
    const avatar = this._getAvatar(number);

    title && (title.textContent = number);

    area.innerHTML = `
      <div class="sms-card">
        <div class="meta">
          <div class="avatar">${this._escHtml(avatar)}</div>
          <div class="meta-info">
            <div class="meta-number">${this._escHtml(number)}</div>
            <div class="meta-date">${this._formatDateFull(msg.Date)}</div>
          </div>
          <span class="meta-badge ${isUnread ? "unread" : "read"}">
            ${isUnread ? "Новое" : "Прочитано"}
          </span>
        </div>
        <div class="sms-body">${this._escHtml(msg.Text || "")}</div>
      </div>`;
  }

  _escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

customElements.define("sms-gammu-panel", SmsGammuPanel);
