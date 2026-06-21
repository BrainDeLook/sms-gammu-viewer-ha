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
  .icon-btn.muted-active { color: #ff9800; background: rgba(255,152,0,.12); }
  .icon-btn.calling-active { color: #4caf50; background: rgba(76,175,80,.12); animation: pulse-call 1s infinite; }
  @keyframes pulse-call { 0%,100%{opacity:1} 50%{opacity:.5} }
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

  /* ─── SIM phone number field ─── */
  .sim-number-row .stat-val { display: flex; align-items: center; gap: 6px; }
  .sim-edit-btn {
    background: none; border: none; cursor: pointer;
    color: var(--sub); padding: 3px; border-radius: 4px;
    display: flex; align-items: center; transition: color .15s, background .15s;
  }
  .sim-edit-btn:hover { color: var(--accent); background: rgba(3,169,244,.1); }
  .sim-number-edit {
    display: flex; gap: 6px; margin-top: 8px;
  }
  .sim-number-input {
    flex: 1; padding: 6px 10px;
    border: 1px solid var(--line); border-radius: 6px;
    background: var(--bg); color: var(--text);
    font-size: 13px; outline: none;
  }
  .sim-number-input:focus { border-color: var(--accent); }
  .sim-save-btn {
    padding: 6px 14px; border: none; border-radius: 6px;
    background: var(--accent); color: #fff; cursor: pointer;
    font-size: 12px; font-weight: 500;
  }

  /* ─── Voice port diagnostics ─── */
  .port-status-loading { font-size: 13px; color: var(--sub); }
  .port-status-ok { font-size: 13px; color: #4caf50; font-weight: 500; }
  .port-status-error { font-size: 13px; color: var(--danger); font-weight: 500; }
  .port-ms { color: var(--sub); font-weight: 400; }
  .port-check-btn {
    width: 100%; box-sizing: border-box; text-align: center;
  }

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
  .fab-call {
    background: #4caf50;
  }
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

  /* ─── Call history dropdown ─── */
  .call-history-dropdown {
    display: none;
    position: absolute;
    bottom: calc(100% + 10px);
    right: 0;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 12px;
    box-shadow: 0 6px 24px rgba(0,0,0,.2);
    overflow: hidden;
    z-index: 100;
    width: 280px;
    flex-direction: column;
  }
  .call-history-dropdown.open { display: flex; }
  .ch-header {
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
    font-size: 13px; font-weight: 600;
    color: var(--text);
    display: flex; align-items: center; justify-content: space-between;
  }
  .ch-clear-btn {
    background: none; border: none; cursor: pointer;
    color: var(--sub); font-size: 11px;
    padding: 2px 6px; border-radius: 4px;
    transition: color .15s, background .15s;
  }
  .ch-clear-btn:hover { color: var(--danger); background: rgba(229,57,53,.08); }
  .ch-new-input-row {
    padding: 10px 14px;
    display: flex; gap: 6px;
    border-bottom: 1px solid var(--line);
  }
  .ch-new-input {
    flex: 1; padding: 7px 10px;
    border: 1px solid var(--line); border-radius: 8px;
    background: var(--bg); color: var(--text);
    font-size: 13px; outline: none;
  }
  .ch-new-input:focus { border-color: var(--accent); }
  .ch-call-btn {
    width: 32px; height: 32px; border-radius: 8px;
    background: #4caf50; color: #fff; border: none;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: opacity .15s;
  }
  .ch-call-btn:disabled { opacity: .4; cursor: default; }
  .ch-list {
    overflow-y: auto;
    max-height: 208px; /* ~4 записи по 52px каждая */
  }
  .ch-empty {
    padding: 24px 14px; text-align: center;
    color: var(--sub); font-size: 12px;
  }
  .ch-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 14px; cursor: pointer;
    transition: background .15s;
    border-bottom: 1px solid var(--line);
  }
  .ch-item:last-child { border-bottom: none; }
  .ch-item:hover { background: rgba(0,0,0,.04); }
  .ch-icon {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-size: 13px;
  }
  .ch-icon.answered { background: rgba(76,175,80,.15); color: #4caf50; }
  .ch-icon.not_answered { background: rgba(255,152,0,.15); color: #ff9800; }
  .ch-icon.declined { background: rgba(229,57,53,.15); color: var(--danger); }
  .ch-icon.error { background: rgba(0,0,0,.08); color: var(--sub); }
  .ch-info { flex: 1; min-width: 0; }
  .ch-number {
    font-size: 13px; color: var(--text); font-weight: 500;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ch-meta {
    font-size: 11px; color: var(--sub);
  }
  .ch-del-btn {
    background: none; border: none; cursor: pointer;
    color: var(--sub); padding: 4px; border-radius: 4px;
    opacity: 0; transition: opacity .15s, color .15s;
    flex-shrink: 0;
  }
  .ch-item:hover .ch-del-btn { opacity: 1; }
  .ch-del-btn:hover { color: var(--danger); }

  /* ─── Phonebook page ─── */
  .pb-page {
    padding: 20px;
    max-width: 600px;
  }
  .pb-add-btn {
    width: 100%;
    padding: 10px;
    margin-bottom: 14px;
    border: none;
    border-radius: 10px;
    background: var(--accent);
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity .2s;
  }
  .pb-add-btn:hover { opacity: .9; }
  .pb-list {
    background: var(--card);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,.07);
  }
  .pb-item {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 14px; cursor: default;
    border-bottom: 1px solid var(--line);
    transition: background .15s;
  }
  .pb-item:last-child { border-bottom: none; }
  .pb-item:hover { background: rgba(0,0,0,.03); }
  .pb-avatar {
    width: 38px; height: 38px; border-radius: 50%;
    background: var(--accent); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 700; flex-shrink: 0;
  }
  .pb-info { flex: 1; min-width: 0; }
  .pb-name {
    font-size: 14px; font-weight: 500; color: var(--text);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .pb-meta {
    font-size: 12px; color: var(--sub);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .pb-action-btn {
    background: none; border: none; cursor: pointer;
    color: var(--sub); padding: 6px; border-radius: 6px;
    display: flex; align-items: center;
    transition: background .15s, color .15s;
    flex-shrink: 0;
  }
  .pb-action-btn:hover { background: rgba(0,0,0,.06); color: var(--text); }
  .pb-action-btn.danger:hover { background: rgba(229,57,53,.1); color: var(--danger); }
  .pb-action-btn.muted-active { color: #ff9800; }
  .pb-empty {
    padding: 30px 14px; text-align: center;
    color: var(--sub); font-size: 13px;
  }
  .pb-search {
    margin-bottom: 12px;
  }
  .pb-search input {
    width: 100%;
    padding: 9px 12px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--card);
    color: var(--text);
    font-size: 13px;
    box-sizing: border-box;
  }
  .pb-search input:focus {
    outline: none;
    border-color: var(--accent);
  }

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
    #fab-call-anchor {
      bottom: 28px !important; right: 24px !important;
    }
    .fab-call {
      width: 60px; height: 60px;
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
    this._eventsInitialized = false;
    this._activeTab = 'chats';
    this._sendText = '';
    this._sending = false;
    this._modemError = null;
    this._narrow = false;
    this._callHistory = [];
    this._phonebook = [];
  }

  _t(key, ...args) {
    if (!this._locale) return key;
    const val = this._locale[key];
    if (typeof val === "function") return val(...args);
    return val ?? key;
  }

  _getLangPref() {
    // Если пользователь явно выбрал язык через 🌐 — уважаем выбор.
    // Иначе берём из настроек интеграции (Options flow), и только
    // в последнюю очередь — язык самой Home Assistant.
    try {
      const explicit = localStorage.getItem("sms_gammu_lang");
      if (explicit) return explicit;
    } catch {}
    if (this._status?.language) return this._status.language;
    try { return this._hass?.language || "en"; }
    catch { return "en"; }
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
        this._load().then(() => this._restoreActiveChat());
        this._loadStatus();
        this._startTimer();
      });
    } else if (!this._activeNumber && !this._restoreAttempted) {
      // Инстанс переиспользован (pull-to-refresh не пересоздал компонент) —
      // пробуем восстановить чат если ещё не пытались в этой сессии
      this._restoreAttempted = true;
      this._restoreActiveChat();
    }
  }

  connectedCallback() {
    if (this._hass && !this._ready) {
      this._ready = true;
      this._initLocale().then(() => {
        this._render();
        this._load().then(() => this._restoreActiveChat());
        this._loadStatus();
        this._startTimer();
      });
    }
  }

  _restoreActiveChat() {
    let saved = null;
    try { saved = localStorage.getItem("sms_gammu_active_number"); } catch {}
    if (!saved) return;

    const tryRestore = (attemptsLeft) => {
      const exists = this._contacts.some((c) => c.number === saved);
      if (exists) {
        this._selectContact(saved);
        return;
      }
      if (attemptsLeft <= 0) {
        try { localStorage.removeItem("sms_gammu_active_number"); } catch {}
        return;
      }
      // Контакты ещё не подгружены — пробуем ещё раз через паузу
      setTimeout(async () => {
        try { this._contacts = await this._api("contacts"); } catch {}
        tryRestore(attemptsLeft - 1);
      }, 400);
    };

    tryRestore(5);
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

  async _ensureFreshToken() {
    // Превентивно обновляем токен за 2 минуты до истечения, чтобы
    // не доводить дело до 401 — это и засоряет логи HA (http.ban
    // фиксирует каждую такую попытку как неудачный логин), и создаёт
    // лишнюю задержку на повторный запрос.
    try {
      const auth = this._hass?.auth?.data;
      if (!auth?.expires) return;
      const msLeft = auth.expires - Date.now();
      if (msLeft < 120000) {
        await this._refreshToken();
      }
    } catch (_) {}
  }

  async _api(path, method = "GET", body = null) {
    await this._ensureFreshToken();
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
    const hadStatusBefore = !!this._status;
    try {
      const s = await this._api("status");
      this._status = s;
      this._pollInterval = s.poll_interval_hint || 30;
    } catch (_) {}

    // Первая загрузка статуса — только теперь известна настройка языка
    // из конфигурации интеграции. Если пользователь не выбирал язык
    // явно через 🌐, применяем язык из настроек.
    if (!hadStatusBefore && this._status?.language) {
      let explicit = null;
      try { explicit = localStorage.getItem("sms_gammu_lang"); } catch {}
      if (!explicit) {
        const code = AVAILABLE_LOCALES.includes(this._status.language)
          ? this._status.language
          : null;
        if (code) {
          this._locale = await loadLocale(code);
          this._updateLocaleUI();
          this._renderContacts();
          this._renderMessages();
        }
      }
    }

    try {
      const pi = await this._api("poll_interval");
      this._pollInterval = pi.interval || 30;
    } catch (_) {}

    this._renderStatusBar();

    const fabCall = this.shadowRoot.getElementById("fab-call");
    if (fabCall) {
      fabCall.style.display = this._status?.call_enabled ? "" : "none";
    }

    if (this._activeTab === "status") {
      this._renderStatusPage();
    } else if (this._activeTab === "phonebook") {
      // Ничего не делаем — телефонная книга не зависит от call_enabled,
      // и не должна перезатираться сюда же зашедшим _renderMessages()
    } else if (this._activeTab === "chats" && this._activeNumber) {
      // Обновляем шапку чата — там зависит call_enabled от статуса
      this._renderMessages();
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
      if (!data.events?.length) {
        this._eventsInitialized = true;
        return;
      }

      // При первой загрузке страницы просто синхронизируем счётчик,
      // не обрабатывая накопленные за время простоя события (иначе
      // старые тосты вроде "Не ответили" всплывают заново при F5)
      if (!this._eventsInitialized) {
        this._lastEventId = data.last_id;
        this._eventsInitialized = true;
        return;
      }

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
        } else if (ev.type === "call_ended") {
          this._onCallEnded(ev.data);
        }
      }

      if (needContacts) {
        this._contacts = await this._api("contacts");
        this._renderContacts();
        this._updateBadge();
      }
      if (needMessages && this._activeNumber && this._activeTab === "chats") {
        this._messages = await this._api(`messages/${encodeURIComponent(this._activeNumber)}`);
        this._renderMessages();
      }
    } catch (_) {}
  }

  async _selectContact(number) {
    this._activeNumber = number;
    try { localStorage.setItem("sms_gammu_active_number", number); } catch {}
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
        try { localStorage.removeItem("sms_gammu_active_number"); } catch {}
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

  async _toggleMute(number) {
    const contact = this._contacts.find((c) => c.number === number);
    const currentlyMuted = contact?.is_muted || false;
    try {
      const action = currentlyMuted ? "unmute" : "mute";
      await this._api(`${action}/${encodeURIComponent(number)}`, "POST");
      if (contact) contact.is_muted = !currentlyMuted;
      this._updateMuteBtn(!currentlyMuted);
      this._renderContacts();
    } catch (e) {
      this._showToast(this._t("send_error") + ": " + e.message);
    }
  }

  async _togglePhonebookMute(number) {
    const pbContact = this._phonebook.find((c) => c.number === number);
    const currentlyMuted = pbContact?.is_muted || false;
    try {
      const action = currentlyMuted ? "unmute" : "mute";
      await this._api(`${action}/${encodeURIComponent(number)}`, "POST");
      if (pbContact) pbContact.is_muted = !currentlyMuted;
      // Синхронизируем со списком диалогов и шапкой открытого чата,
      // если этот же номер там тоже представлен
      const listContact = this._contacts.find((c) => c.number === number);
      if (listContact) listContact.is_muted = !currentlyMuted;
      if (this._activeNumber === number) {
        this._updateMuteBtn(!currentlyMuted);
      }
      this._renderPhonebook();
      this._renderContacts();
    } catch (e) {
      this._showToast(this._t("send_error") + ": " + e.message);
    }
  }

  _updateMuteBtn(isMuted) {
    const btn = this.shadowRoot.getElementById("mute-contact-btn");
    if (!btn) return;
    btn.classList.toggle("muted-active", isMuted);
    btn.title = isMuted ? this._t("unmute_chat") : this._t("mute_chat");
  }

  async _callNumber(number) {
    const btn = this.shadowRoot.getElementById("call-contact-btn");
    if (this._calling) {
      // Уже звоним — кнопка работает как "положить трубку"
      try {
        await this._api("hangup", "POST");
      } catch (_) {}
      return;
    }
    this._calling = true;
    btn?.classList.add("calling-active");
    if (btn) btn.title = this._t("hangup");
    this._showToast(this._t("calling", number));
    try {
      await this._api(`call/${encodeURIComponent(number)}`, "POST");
    } catch (e) {
      this._showToast(this._t("call_error") + ": " + e.message);
      this._calling = false;
      btn?.classList.remove("calling-active");
      if (btn) btn.title = this._t("call_number");
    }
  }

  _onCallEnded(data) {
    this._calling = false;
    const btn = this.shadowRoot.getElementById("call-contact-btn");
    btn?.classList.remove("calling-active");
    if (btn) btn.title = this._t("call_number");

    const reasonMap = {
      answered: this._t("call_answered"),
      not_answered: this._t("call_not_answered"),
      declined: this._t("call_declined"),
      error: this._t("call_failed"),
    };
    const text = reasonMap[data.reason] || data.reason;
    this._showToast(`${data.number}: ${text}`);

    const dd = this.shadowRoot.getElementById("call-history-dropdown");
    if (dd?.classList.contains("open")) {
      this._api("call_history").then((h) => {
        this._callHistory = h;
        this._renderCallHistory();
      }).catch(() => {});
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

  async _openCallHistory() {
    const dd = this.shadowRoot.getElementById("call-history-dropdown");
    if (!dd) return;
    const isOpen = dd.classList.contains("open");
    if (isOpen) {
      dd.classList.remove("open");
      return;
    }

    const titleEl = this.shadowRoot.getElementById("ch-title");
    const clearBtn = this.shadowRoot.getElementById("ch-clear-btn");
    const numInput = this.shadowRoot.getElementById("ch-new-number");
    if (titleEl) titleEl.textContent = this._t("call_history");
    if (clearBtn) clearBtn.textContent = this._t("clear");
    if (numInput) numInput.placeholder = this._t("number_placeholder");

    dd.classList.add("open");
    numInput.value = "";
    this.shadowRoot.getElementById("ch-call-btn").disabled = true;

    try {
      this._callHistory = await this._api("call_history");
    } catch (_) {
      this._callHistory = [];
    }
    this._renderCallHistory();
    setTimeout(() => numInput.focus(), 50);
  }

  _closeCallHistory() {
    this.shadowRoot.getElementById("call-history-dropdown")?.classList.remove("open");
  }

  _renderCallHistory() {
    const list = this.shadowRoot.getElementById("ch-list");
    if (!list) return;

    const items = this._callHistory || [];
    if (!items.length) {
      list.innerHTML = `<div class="ch-empty">${this._t("no_calls")}</div>`;
      return;
    }

    const reasonIcon = { answered: "✓", not_answered: "—", declined: "✕", error: "!" };

    list.innerHTML = items.map((c) => `
      <div class="ch-item" data-number="${this._esc(c.number)}">
        <div class="ch-icon ${c.reason}">${reasonIcon[c.reason] || "?"}</div>
        <div class="ch-info">
          <div class="ch-number">${this._esc(c.contact_name || c.number)}</div>
          <div class="ch-meta">${this._t("call_reason_" + c.reason)} · ${this._formatShort(c.called_at)}</div>
        </div>
        <button class="ch-del-btn" data-id="${c.id}" title="${this._t("delete_msg")}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
        </button>
      </div>
    `).join("");

    list.querySelectorAll(".ch-item").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest(".ch-del-btn")) return;
        const number = el.dataset.number;
        this._closeCallHistory();
        this._callNumber(number);
      });
    });
    list.querySelectorAll(".ch-del-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        try {
          await this._api(`delete_call/${id}`, "POST");
          this._callHistory = this._callHistory.filter((c) => c.id !== id);
          this._renderCallHistory();
        } catch (_) {}
      });
    });
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

  async _copyToClipboard(text) {
    // Современный API — работает только на HTTPS / localhost
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {
        // падаем дальше на fallback
      }
    }

    // Fallback для http:// — execCommand('copy')
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.width = "1px";
      textarea.style.height = "1px";
      textarea.style.padding = "0";
      textarea.style.border = "none";
      textarea.style.outline = "none";
      textarea.style.boxShadow = "none";
      textarea.style.background = "transparent";
      textarea.style.opacity = "0";
      this.shadowRoot.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const ok = document.execCommand("copy");
      this.shadowRoot.removeChild(textarea);
      return ok;
    } catch (_) {
      return false;
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
    const isPhonebook = this._activeTab === "phonebook";
    const isOverlay = isStatus || isPhonebook;
    const root         = this.shadowRoot.getElementById("root");
    const contactList  = this.shadowRoot.getElementById("contact-list");
    const messagesArea = this.shadowRoot.getElementById("messages-area");
    const statusMain   = this.shadowRoot.getElementById("status-main");
    const chatHeader   = this.shadowRoot.getElementById("chat-header");
    const searchBox    = this.shadowRoot.querySelector(".search");

    if (isOverlay) {
      if (contactList)  contactList.style.display = "none";
      if (searchBox)    searchBox.style.display = "none";
      if (messagesArea) messagesArea.style.display = "none";
      if (statusMain)   statusMain.style.display = "";
      const sendBarEl = this.shadowRoot.getElementById("send-bar");
      if (sendBarEl) sendBarEl.style.display = "none";
      // Показываем хедер с заголовком и кнопкой назад
      if (chatHeader)   chatHeader.style.display = "";
      const titleEl = this.shadowRoot.getElementById("chat-title");
      const subEl   = this.shadowRoot.getElementById("chat-subtitle");
      if (titleEl) titleEl.textContent = isStatus ? this._t("modem_status") : this._t("phonebook_title");
      if (subEl)   subEl.textContent = "";
      const delBtn = this.shadowRoot.getElementById("delete-contact-btn");
      if (delBtn) delBtn.style.display = "none";
      const callBtn = this.shadowRoot.getElementById("call-contact-btn");
      if (callBtn) callBtn.style.display = "none";
      const muteBtn = this.shadowRoot.getElementById("mute-contact-btn");
      if (muteBtn) muteBtn.style.display = "none";
      // На мобилке показываем правую область
      root?.classList.add("chat-open");
      if (isStatus) {
        this._renderStatusPage();
      } else {
        this._loadPhonebook();
      }
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

  async _loadPhonebook() {
    const page = this.shadowRoot.getElementById("status-main");
    if (!page || this._activeTab !== "phonebook") return;
    page.innerHTML = `<div class="status-loading">${this._t("loading_phonebook")}</div>`;
    try {
      this._phonebook = await this._api("phonebook");
    } catch (e) {
      this._phonebook = [];
      this._phonebookError = e.message;
    }
    this._renderPhonebook();
  }

  _renderPhonebook() {
    const page = this.shadowRoot.getElementById("status-main");
    if (!page || this._activeTab !== "phonebook") return;

    const all = this._phonebook || [];
    const q = (this._phonebookFilter || "").trim().toLowerCase();
    const items = q
      ? all.filter((c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.number || "").toLowerCase().includes(q) ||
          (c.label || "").toLowerCase().includes(q)
        )
      : all;

    const rows = items.length
      ? items.map((c) => `
          <div class="pb-item" data-number="${this._esc(c.number)}">
            <div class="pb-avatar">${this._esc((c.name || "?").slice(0, 1).toUpperCase())}</div>
            <div class="pb-info">
              <div class="pb-name">${this._esc(c.name)}</div>
              <div class="pb-meta">
                ${this._esc(c.number)}${c.label ? " · " + this._esc(c.label) : ""}
              </div>
            </div>
            <button class="pb-action-btn" data-action="open" data-number="${this._esc(c.number)}" title="${this._t("open_chat")}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            <button class="pb-action-btn ${c.is_muted ? "muted-active" : ""}" data-action="mute" data-number="${this._esc(c.number)}" title="${c.is_muted ? this._t("unmute_chat") : this._t("mute_chat")}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${c.is_muted
                  ? '<path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>'
                  : '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>'}
              </svg>
            </button>
            <button class="pb-action-btn" data-action="edit" data-number="${this._esc(c.number)}" title="${this._t("edit")}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="pb-action-btn danger" data-action="delete" data-number="${this._esc(c.number)}" title="${this._t("delete_msg")}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </button>
          </div>
        `).join("")
      : `<div class="pb-empty">${all.length ? this._t("no_search_results") : this._t("no_contacts")}</div>`;

    page.innerHTML = `
      <div class="pb-page">
        <button class="pb-add-btn" id="pb-add-btn">+ ${this._t("add_contact")}</button>
        ${all.length ? `
          <div class="pb-search">
            <input type="text" id="pb-search-input" placeholder="${this._t("search_contacts")}" value="${this._esc(this._phonebookFilter || "")}" />
          </div>
        ` : ""}
        <div class="pb-list">${rows}</div>
      </div>
    `;

    page.querySelector("#pb-add-btn")?.addEventListener("click", () => this._openContactEditor());

    const searchInput = page.querySelector("#pb-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this._phonebookFilter = e.target.value;
        const cursorPos = e.target.selectionStart;
        this._renderPhonebook();
        // Восстанавливаем фокус и позицию курсора после перерисовки списка
        const newInput = page.querySelector("#pb-search-input");
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(cursorPos, cursorPos);
        }
      });
    }

    page.querySelectorAll(".pb-action-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const number = btn.dataset.number;
        const action = btn.dataset.action;
        if (action === "open") {
          this._activeTab = "chats";
          const pbBtn = this.shadowRoot.getElementById("phonebook-btn");
          if (pbBtn) pbBtn.style.color = "";
          this._switchTab();
          this._selectContact(number);
        } else if (action === "edit") {
          const contact = this._phonebook.find((c) => c.number === number);
          this._openContactEditor(contact);
        } else if (action === "mute") {
          this._togglePhonebookMute(number);
        } else if (action === "delete") {
          this._deleteContactFromBook(number);
        }
      });
    });
  }

  _openContactEditor(contact) {
    const isEdit = !!contact;
    const name = prompt(this._t("contact_name_prompt"), contact?.name || "");
    if (name === null) return;
    if (!name.trim()) {
      this._showToast(this._t("name_required"));
      return;
    }
    let number = contact?.number;
    if (!isEdit) {
      number = prompt(this._t("contact_number_prompt"), "");
      if (number === null) return;
      if (!number.trim()) {
        this._showToast(this._t("number_required"));
        return;
      }
    }
    const label = prompt(this._t("contact_label_prompt"), contact?.label || "");
    this._saveContact(number.trim(), name.trim(), (label || "").trim());
  }

  async _saveContact(number, name, label) {
    try {
      await this._api("add_contact", "POST", { number, name, label });
      await this._loadPhonebook();
      this._refreshContacts();
      this._showToast(this._t("saved"));
    } catch (e) {
      this._showToast(this._t("send_error") + ": " + e.message);
    }
  }

  async _deleteContactFromBook(number) {
    if (!confirm(this._t("delete_contact_confirm"))) return;
    try {
      await this._api(`delete_phonebook_contact/${encodeURIComponent(number)}`, "POST");
      this._phonebook = this._phonebook.filter((c) => c.number !== number);
      this._renderPhonebook();
      this._refreshContacts();
    } catch (e) {
      this._showToast(this._t("send_error") + ": " + e.message);
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
    const simNumber = s.sim_phone_number || "";
    const memCard = `
      <div class="stat-card">
        <h3>${this._t("memory")}</h3>
        ${row(this._t("sim_used"), simUsed)}
        ${row(this._t("phone_used"), phoneUsed)}
        ${row("IMSI", s.sim?.IMSI)}
        <div class="stat-row sim-number-row">
          <span class="stat-key">${this._t("sim_phone_number")}</span>
          <span class="stat-val">
            <span id="sim-number-display">${simNumber ? this._esc(simNumber) : this._t("not_set")}</span>
            <button class="sim-edit-btn" id="sim-edit-btn" title="${this._t("edit")}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </span>
        </div>
        <div class="sim-number-edit" id="sim-number-edit" style="display:none">
          <input class="sim-number-input" id="sim-number-input" type="tel" placeholder="+79001234567" value="${this._esc(simNumber)}" />
          <button class="sim-save-btn" id="sim-save-btn">${this._t("save")}</button>
        </div>
      </div>`;

    let portCard = "";
    if (s.call_enabled) {
      portCard = `
        <div class="stat-card">
          <h3>${this._t("voice_port")}</h3>
          <div id="voice-port-status" class="port-status-loading">${this._t("checking")}</div>
          <button class="reset-btn port-check-btn" id="check-port-btn" style="margin-top:10px">
            ${this._t("check_port")}
          </button>
        </div>`;
    }

    page.innerHTML = `
      <div class="status-grid">
        ${signalCard}
        ${networkCard}
        ${modemCard}
        ${memCard}
        ${portCard}
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

    // SIM номер — inline редактирование
    const simEditBtn = page.querySelector("#sim-edit-btn");
    const simEditBox = page.querySelector("#sim-number-edit");
    const simDisplay = page.querySelector("#sim-number-display");
    const simInput   = page.querySelector("#sim-number-input");
    const simSaveBtn = page.querySelector("#sim-save-btn");

    simEditBtn?.addEventListener("click", () => {
      simEditBox.style.display = simEditBox.style.display === "none" ? "flex" : "none";
      if (simEditBox.style.display !== "none") {
        setTimeout(() => simInput.focus(), 30);
      }
    });
    simInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") simSaveBtn.click();
    });
    simSaveBtn?.addEventListener("click", async () => {
      const number = simInput.value.trim();
      try {
        await this._api("set_sim_phone_number", "POST", { number });
        simDisplay.textContent = number || this._t("not_set");
        simEditBox.style.display = "none";
        if (this._status) this._status.sim_phone_number = number;
        this._showToast(this._t("saved"));
      } catch (e) {
        this._showToast(this._t("send_error") + ": " + e.message);
      }
    });

    // Диагностика голосового порта
    if (s.call_enabled) {
      this._runPortCheck(page);
      page.querySelector("#check-port-btn")?.addEventListener("click", () => {
        this._runPortCheck(page);
      });
    }
  }

  async _runPortCheck(page) {
    const statusEl = page.querySelector("#voice-port-status");
    const btn = page.querySelector("#check-port-btn");
    if (!statusEl) return;

    statusEl.className = "port-status-loading";
    statusEl.textContent = this._t("checking");
    if (btn) btn.disabled = true;

    try {
      const result = await this._api("check_call_port");
      if (result.ok) {
        statusEl.className = "port-status-ok";
        statusEl.innerHTML = `✓ ${this._t("port_ok")} <span class="port-ms">(${result.response_time_ms} ms)</span>`;
      } else {
        const errorMap = {
          not_configured: this._t("port_not_configured"),
          device_not_found: this._t("port_not_found"),
          permission_denied: this._t("port_permission_denied"),
          connection_failed: this._t("port_connection_failed"),
          no_ok_response: this._t("port_no_response"),
        };
        statusEl.className = "port-status-error";
        statusEl.textContent = `✕ ${errorMap[result.error] || result.error}`;
      }
    } catch (e) {
      statusEl.className = "port-status-error";
      statusEl.textContent = `✕ ${this._t("port_check_failed")}`;
    } finally {
      if (btn) btn.disabled = false;
    }
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
              <button class="icon-btn" id="phonebook-btn" title="Телефонная книга">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </button>
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

          <div id="fab-call-anchor" style="position:absolute; bottom:18px; right:16px; z-index:10">
            <button class="fab fab-call" id="fab-call" title="Call" style="display:none; position:static">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </button>

            <div class="call-history-dropdown" id="call-history-dropdown">
              <div class="ch-header">
                <span id="ch-title">История звонков</span>
                <button class="ch-clear-btn" id="ch-clear-btn">Очистить</button>
              </div>
              <div class="ch-new-input-row">
                <input class="ch-new-input" id="ch-new-number" type="tel" placeholder="+79001234567" />
                <button class="ch-call-btn" id="ch-call-btn" disabled title="Позвонить">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </button>
              </div>
              <div class="ch-list" id="ch-list"></div>
            </div>
          </div>

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
            <button class="icon-btn" id="call-contact-btn" title="Позвонить" style="display:none">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </button>
            <button class="icon-btn" id="mute-contact-btn" title="Без звука" style="display:none">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            </button>
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

    this.shadowRoot.getElementById("phonebook-btn").addEventListener("click", () => {
      this._activeTab = this._activeTab === "phonebook" ? "chats" : "phonebook";
      const btn = this.shadowRoot.getElementById("phonebook-btn");
      btn.style.color = this._activeTab === "phonebook" ? "var(--accent)" : "";
      const modemBtn = this.shadowRoot.getElementById("modem-btn");
      if (modemBtn) modemBtn.style.color = "";
      this._switchTab();
    });

    this.shadowRoot.getElementById("menu-btn").addEventListener("click", () => {
      this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
    });

    // Закрываем dropdown при клике вне
    this.shadowRoot.addEventListener("click", () => {
      this.shadowRoot.getElementById("call-history-dropdown")?.classList.remove("open");
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

    // FAB — история звонков (независимо от существующих чатов)
    this.shadowRoot.getElementById("fab-call").addEventListener("click", (e) => {
      e.stopPropagation();
      this._openCallHistory();
    });
    this.shadowRoot.getElementById("call-history-dropdown").addEventListener("click", (e) => {
      e.stopPropagation();
    });
    this.shadowRoot.getElementById("ch-clear-btn").addEventListener("click", async () => {
      try {
        await this._api("clear_call_history", "POST");
        this._callHistory = [];
        this._renderCallHistory();
      } catch (_) {}
    });

    const chInput   = this.shadowRoot.getElementById("ch-new-number");
    const chCallBtn = this.shadowRoot.getElementById("ch-call-btn");

    chInput.addEventListener("input", () => {
      chCallBtn.disabled = !chInput.value.trim();
    });
    chInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && chInput.value.trim()) {
        e.preventDefault();
        chCallBtn.click();
      }
    });
    chCallBtn.addEventListener("click", async () => {
      const number = chInput.value.trim();
      if (!number) return;
      this._closeCallHistory();
      await this._callNumber(number);
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
      if (this._activeTab === "status" || this._activeTab === "phonebook") {
        // Закрываем оверлей (модем/телефонная книга) — возврат к списку
        this._activeTab = "chats";
        const modemBtn = this.shadowRoot.getElementById("modem-btn");
        const pbBtn = this.shadowRoot.getElementById("phonebook-btn");
        if (modemBtn) modemBtn.style.color = "";
        if (pbBtn) pbBtn.style.color = "";
        this._switchTab();
      } else {
        this._activeNumber = null;
        try { localStorage.removeItem("sms_gammu_active_number"); } catch {}
        this.shadowRoot.getElementById("root").classList.remove("chat-open");
        this._renderContacts();
        this._renderMessages();
      }
    });

    this.shadowRoot.getElementById("delete-contact-btn").addEventListener("click", () => {
      if (this._activeNumber) this._deleteContact(this._activeNumber);
    });

    this.shadowRoot.getElementById("mute-contact-btn").addEventListener("click", () => {
      if (this._activeNumber) this._toggleMute(this._activeNumber);
    });

    this.shadowRoot.getElementById("call-contact-btn").addEventListener("click", () => {
      if (this._activeNumber) this._callNumber(this._activeNumber);
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
        <div class="avatar ${this._isAlphaTag(c.number) ? 'alpha' : ''}">${this._esc(c.contact_name ? c.contact_name.slice(0,1).toUpperCase() : this._avatar(c.number))}</div>
        <div class="contact-info">
          <div class="contact-row1">
            <span class="contact-number">${c.is_muted ? "🔇 " : ""}${this._esc(c.contact_name || c.number)}</span>
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
    const muteBtn = this.shadowRoot.getElementById("mute-contact-btn");
    const callBtn = this.shadowRoot.getElementById("call-contact-btn");
    if (!area) return;

    const sendBar = this.shadowRoot.getElementById("send-bar");

    if (!this._activeNumber) {
      titleEl && (titleEl.textContent = this._t("select_dialog"));
      subEl && (subEl.textContent = "");
      delBtn && (delBtn.style.display = "none");
      muteBtn && (muteBtn.style.display = "none");
      callBtn && (callBtn.style.display = "none");
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
    titleEl && (titleEl.textContent = contact?.contact_name || this._activeNumber);
    subEl && (subEl.textContent = this._t("messages_count", count));
    delBtn && (delBtn.style.display = "");
    muteBtn && (muteBtn.style.display = "");
    this._updateMuteBtn(contact?.is_muted || false);
    if (callBtn) {
      callBtn.style.display = this._status?.call_enabled ? "" : "none";
    }

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
        const ok = await this._copyToClipboard(text);
        if (ok) {
          bubble?.classList.add("copied");
          setTimeout(() => bubble?.classList.remove("copied"), 800);
          this._showToast(this._t("copied"));
        } else {
          this._showToast(this._t("copy_failed"));
        }
      });
    });

    area.scrollTop = area.scrollHeight;
  }
}

customElements.define("sms-gammu-panel", SmsGammuPanel);





































