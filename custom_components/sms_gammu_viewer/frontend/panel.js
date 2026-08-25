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
    /*
     * Do not rely on the custom-panel container having an explicit height.
     * Since HA 2026.8 it is a block with safe-area padding, so a percentage
     * height can become auto and let the contact list grow the whole panel.
     */
    height: 100vh;
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
    box-sizing: border-box;
    /* Content extends behind the bottom safe area; only controls avoid it. */
    padding:
      var(--safe-area-inset-top, 0px)
      var(--safe-area-content-inset-right, var(--safe-area-inset-right, 0px))
      0
      var(--safe-area-content-inset-left, var(--safe-area-inset-left, 0px));
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
    background: var(--card);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .root {
    display: flex;
    height: 100%;
    min-height: 0;
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
    min-height: 0;
    overflow: hidden;
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
  .contact-scroll-chrome {
    position: sticky;
    top: 0;
    z-index: 8;
    background: var(--card);
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
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding-bottom: calc(80px + var(--safe-area-inset-bottom, 0px));
    position: relative;
    -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 60px), transparent 100%);
    mask-image: linear-gradient(to bottom, black calc(100% - 60px), transparent 100%);
  }
  .contact-list::-webkit-scrollbar { display: none; width: 0; height: 0; }


  .swipe-wrap { position: relative; overflow: hidden; border-bottom: 0.5px solid var(--line); background: var(--card); }
  @media (max-width: 580px) {
    .status-bar { padding-bottom: 2px; }
    .swipe-wrap { border-bottom: none; margin-bottom: 6px; }
    .swipe-wrap:last-child { margin-bottom: 0; }
    .swipe-inner { border: 1px solid var(--line); border-radius: 22px; }
    .contact-list { padding-bottom: calc(90px + var(--safe-area-inset-bottom, 0px)); }
    .contact-scroll-chrome { display: contents; }
  }
  @media (min-width: 581px) {
    .swipe-actions-left, .swipe-actions-right { display: none !important; }
    .swipe-inner { transform: none !important; transition: none !important; cursor: pointer; }
  }
  .swipe-wrap:last-child { border-bottom: none; }
  .swipe-actions-left { position: absolute; left: 0; top: 0; bottom: 0; width: 160px; display: flex; align-items: center; gap: 8px; padding: 0 10px; box-sizing: border-box; background: var(--card); z-index: 1; opacity: 0; }
  .swipe-actions-right { position: absolute; right: 0; top: 0; bottom: 0; width: 160px; display: flex; align-items: center; gap: 8px; padding: 0 10px; box-sizing: border-box; background: var(--card); z-index: 1;  opacity: 0; }
  .swipe-btn { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 8px 4px; font-size: 11px; font-weight: 500; color: #fff; border: none; border-radius: 12px; cursor: pointer; }
  .swipe-btn.read { background: #378ADD; }
  .swipe-btn.pin { background: #1D9E75; }
  .swipe-btn.mute { background: #888780; }
  .swipe-btn.swipe-del { background: #E24B4A; }
  .swipe-inner { position: relative; z-index: 2; background-color: var(--card) !important; will-change: transform; }
  /* A long press opens the chat-folder menu.  Keep the browser from starting
     its native text-selection gesture while the press is pending. */
  .swipe-inner.long-press-pending,
  .swipe-inner.long-press-pending * {
    user-select: none !important;
    -webkit-user-select: none !important;
    -webkit-touch-callout: none !important;
  }
  .swipe-inner.active { background-color: rgba(3,169,244,.1) !important; }
  .swipe-inner.snapping { transition: transform 0.25s ease; }
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
  .pin-static-icon {
    position: absolute;
    top: 6px; left: 2px;
    width: 14px; height: 14px;
    color: var(--accent);
    display: flex; align-items: center; justify-content: center;
    z-index: 3; pointer-events: none;
  }
  .pin-hover-btn {
    position: absolute;
    top: 6px; left: 2px;
    width: 14px; height: 14px;
    background: none; border: none; cursor: pointer;
    color: var(--sub); padding: 0; border-radius: 4px;
    z-index: 4; display: none;
    align-items: center; justify-content: center;
    opacity: 0;
    transition: opacity .4s ease, color .4s ease;
  }
  @media (min-width: 581px) {
    .pin-hover-btn { display: flex; }
    .pin-hover-btn:hover { opacity: 1 !important; color: var(--accent); }
    .swipe-inner:hover .pin-hover-btn { opacity: 0.45; }
  }}
    .swipe-inner:hover .pin-hover-btn:hover { color: var(--accent); }
  }
  .contact-item.has-unread { background: var(--unread-bg); }
  .contact-item.has-unread::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--unread-border);
  }
  @media (max-width: 580px) {
    .contact-item.has-unread::before { display: none; }
    .swipe-inner.has-unread-wrap {
      box-shadow: inset 3px 0 0 var(--unread-border) !important;
    }
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
  .contact-list.brand-loading { visibility: hidden; }
  .folder-tabs { display: flex; align-items: center; gap: 6px; padding: 7px 12px 5px; overflow: visible; }
  .folder-tab-shell { display: flex; align-items: center; gap: 6px; min-width: 0; width: auto; box-sizing: border-box; }
  .folder-tab-scroll { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1 1 auto; overflow-x: auto; scrollbar-width: none; touch-action: pan-x; background: transparent; }
  .folder-tab-scroll::-webkit-scrollbar { display: none; }
  .folder-tab-scroll { cursor: grab; }
  .folder-tab-scroll:active { cursor: grabbing; }
  .folder-tab-actions { display: flex; flex: 0 0 30px; width: 30px; justify-content: center; align-items: center; padding-left: 0; background: transparent; }
  .folder-tab {
    flex: 0 0 auto; border: 1px solid var(--border); border-radius: 16px;
    background: transparent; color: var(--sub); padding: 5px 10px;
    font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap;
    transition: color .22s ease, background-color .22s ease, border-color .22s ease, box-shadow .22s ease;
  }
  .folder-tab.active { color: var(--accent); border-color: var(--accent); background: rgba(3,169,244,.1); }
  .folder-tab.add { font-size: 17px; line-height: 15px; padding: 4px 9px; }
  .folder-editor-list { max-height: 260px; overflow: auto; margin-top: 12px; border-top: 1px solid var(--border); }
  .folder-editor-chat { display: flex; align-items: center; gap: 8px; padding: 8px 2px; border-bottom: 1px solid var(--border); }
  .folder-editor-chat input { width: 18px; height: 18px; }
  .folder-edit-field { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; color: var(--sub); font-size: 12px; }
  .folder-edit-field input { width: 100%; box-sizing: border-box; border: 1px solid var(--line); border-radius: 12px; padding: 11px 12px; background: var(--bg); color: var(--text); font: inherit; }
  .folder-edit-field input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 15%, transparent); }
  .folder-settings-list { max-height: 220px; overflow: auto; margin: 8px 0 10px; border-top: 1px solid var(--border); }
  .folder-settings-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--border); }
  .folder-settings-row > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .folder-settings-row > span:last-child { display: flex; gap: 4px; flex: 0 0 auto; }
  .folder-settings-row button { padding: 4px 7px; }
  .contact-form > button, .contact-form-actions button, .folder-settings-row button {
    border: 0; border-radius: 12px; padding: 9px 13px; background: color-mix(in srgb, var(--accent) 13%, transparent);
    color: var(--accent); font: inherit; cursor: pointer;
  }
  .contact-form > button:hover, .contact-form-actions button:hover, .folder-settings-row button:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); }
  .chat-folder-menu {
    position: fixed; z-index: 1000; min-width: 220px; max-width: min(300px, calc(100vw - 16px));
    max-height: min(420px, calc(100vh - 16px)); overflow: auto; padding: 8px;
    border: 1px solid var(--line); border-radius: 16px; background: var(--card); color: var(--text);
    box-shadow: 0 8px 28px rgba(0,0,0,.35);
  }
  .chat-folder-menu-title { padding: 6px 8px 8px; font-size: 13px; font-weight: 600; border-bottom: 1px solid var(--line); }
  .chat-folder-menu-row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 8px; border: 0; border-radius: 10px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .chat-folder-menu-row:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
  .chat-folder-menu-row:disabled { opacity: .55; cursor: default; }
  .chat-folder-menu-row input { width: 16px; height: 16px; accent-color: var(--accent); }
  .chat-folder-menu-new { margin-top: 6px; border-top: 1px solid var(--line); padding-top: 8px; color: var(--accent); }
  .contact-form-actions button.primary { background: var(--accent); color: #fff; }
  .contact-form-actions button.secondary { background: transparent; color: var(--sub); }
  .folder-settings-row button:disabled { opacity: .35; cursor: default; }
  /* Brand marks in the chat list use the same full circular treatment as the
     chat header; don't add the old white inset ring around the logo. */
  .avatar.brand-avatar { background: transparent; padding: 0; }
  .avatar img, .pb-avatar img, .chat-profile-avatar img,
  .profile-avatar img, .profile-avatar-edit img {
    width: 100%; height: 100%; border-radius: inherit;
    object-fit: cover; display: block;
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
      position: relative;
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
  .chat-profile-trigger {
    flex: 1; min-width: 0; cursor: pointer;
  }
  .chat-profile-avatar {
    width: 36px; height: 36px; border-radius: 50%; border: 0;
    background: rgba(255,255,255,.22); color: #fff;
    display: none; align-items: center; justify-content: center;
    font-weight: 700; overflow: hidden; cursor: pointer; flex-shrink: 0;
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
  @keyframes ctx-in { from { opacity:0; transform: scale(.92); } to { opacity:1; transform: scale(1); } }
  .status-refresh-spin {
    display: inline-block; width: 8px; height: 8px;
    border: 1.5px solid rgba(255,255,255,.2); border-top-color: var(--accent);
    border-radius: 50%; animation: spin .7s linear infinite;
    margin-left: 6px; vertical-align: middle; flex-shrink: 0;
  }

  .messages-area {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px calc(80px + var(--safe-area-inset-bottom, 0px));
    display: flex;
    flex-direction: column;
    gap: 10px;
    -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 60px), transparent 100%);
    mask-image: linear-gradient(to bottom, black calc(100% - 60px), transparent 100%);
  }

  .msg-ctx-menu {
    position: absolute; z-index: 999;
    animation: ctx-in .15s ease;
    background: var(--card); border: 1px solid var(--line);
    border-radius: 14px; overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,.3);
    min-width: 180px;
  }
  .msg-ctx-item {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; font-size: 14px; color: var(--text);
    cursor: pointer; transition: background .1s;
  }
  .msg-ctx-item:hover { background: rgba(255,255,255,.06); }
  .msg-ctx-item.danger { color: #e53935; }
  .msg-ctx-item svg { flex-shrink: 0; }
  .msg-starred-icon { position: absolute; top: 4px; right: 4px; opacity: 0.7; }
  .msg-bubble {
    -webkit-user-select: none; user-select: none;
    -webkit-touch-callout: none;
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
    display: flex; gap: 8px;
    padding: 8px 12px calc(16px + var(--safe-area-inset-bottom, 0px));
    background: transparent;
    align-items: flex-end;
    flex-shrink: 0;
    position: relative;
    z-index: 2;
  }
  .chat-pane { position: relative; }
  .send-bar-wrap {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    z-index: 10;
  }



  .send-input {
    flex: 1; padding: 10px 16px;
    border: 1.5px solid var(--line); border-radius: 24px;
    background: var(--card); color: var(--text);
    font-size: 14px; font-family: inherit;
    outline: none; resize: none;
    max-height: 120px; line-height: 1.5;
    box-shadow: 0 2px 12px rgba(0,0,0,.15);
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

  /* ─── Исходящие сообщения ─── */
  .msg-bubble.outgoing {
    align-self: flex-end;
    background: var(--accent);
    border-radius: 16px 4px 16px 16px;
    color: #fff;
  }
  .msg-bubble.outgoing .msg-text { color: #fff; }
  .msg-bubble.outgoing .msg-date { color: rgba(255,255,255,.7); }
  .msg-bubble.outgoing .msg-delete { color: transparent; }
  .msg-bubble.outgoing:hover .msg-delete { color: rgba(255,255,255,.6); }
  .msg-bubble.outgoing .msg-delete:hover { color: #fff !important; }
  .msg-bubble.outgoing .msg-unread-dot { background: #fff; }

  /* ─── Счётчик символов ─── */
  .char-counter {
    font-size: 11px;
    color: var(--sub);
    text-align: right;
    padding: 0 14px 4px;
    flex-shrink: 0;
    transition: color .2s;
  }
  .char-counter.warn { color: #ff9800; }
  .char-counter.over { color: var(--danger); font-weight: 600; }

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
    flex: 1; overflow-y: auto;
    padding: 24px 24px calc(24px + var(--safe-area-inset-bottom, 0px));
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
  .neutral-btn {
    margin-top: 20px; padding: 10px 24px;
    border: none; border-radius: 8px;
    background: rgba(255,255,255,.07); color: var(--text);
    cursor: pointer; font-size: 13px; font-weight: 500;
    transition: background .15s;
  }
  .neutral-btn:hover { background: rgba(255,255,255,.12); }
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
    bottom: calc(18px + var(--safe-area-inset-bottom, 0px)); left: 16px;
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
    padding: 20px 20px calc(32px + var(--safe-area-inset-bottom, 0px));
    width: 100%; max-width: 500px;
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
    inset: 0;
    background: rgba(0,0,0,.45);
    z-index: 20;
    align-items: flex-end;
    justify-content: center;
  }
  .call-history-dropdown.open { display: flex; }
  .ch-sheet {
    background: var(--card);
    border-radius: 18px 18px 0 0;
    padding: 20px 20px calc(32px + var(--safe-area-inset-bottom, 0px));
    width: 100%;
    max-width: 500px;
  }
  .ch-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 14px;
    font-size: 16px; font-weight: 600; color: var(--text);
  }
  .ch-clear-btn {
    background: none; border: none; cursor: pointer;
    color: var(--sub); font-size: 12px;
    padding: 4px 8px; border-radius: 6px;
    transition: color .15s, background .15s;
  }
  .ch-clear-btn:hover { color: var(--danger); background: rgba(229,57,53,.08); }
  .ch-new-input-row {
    display: flex; gap: 8px; margin-bottom: 12px;
  }
  .ch-new-input {
    flex: 1; padding: 9px 13px;
    border: 1px solid var(--line); border-radius: 10px;
    background: var(--bg); color: var(--text);
    font-size: 14px; font-family: inherit; outline: none;
  }
  .ch-new-input:focus { border-color: #4caf50; }
  .ch-call-btn {
    width: 40px; height: 40px; border-radius: 50%;
    background: #4caf50; color: #fff; border: none;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: opacity .15s;
  }
  .ch-call-btn:disabled { opacity: .4; cursor: default; }
  .ch-list {
    overflow-y: auto;
    max-height: 220px;
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

  /* ─── Contact profile/editor ─── */
  .contact-modal-overlay {
    display: none; position: fixed; inset: 0; z-index: 120;
    background: rgba(0,0,0,.52); align-items: center; justify-content: center;
    padding: 20px; overflow-x: hidden;
  }
  .contact-modal-overlay.open { display: flex; }
  .contact-modal {
    width: min(460px, 100%); max-width: 100%; min-width: 0; max-height: min(760px, calc(100dvh - 40px));
    overflow: auto; background: var(--card); color: var(--text);
    border-radius: 18px; box-shadow: 0 18px 55px rgba(0,0,0,.32);
  }
  .profile-hero {
    position: relative; text-align: center; padding: 28px 24px 20px;
    background: linear-gradient(145deg, color-mix(in srgb, var(--accent) 88%, #fff), var(--accent));
    color: #fff; border-radius: 18px 18px 0 0;
  }
  .profile-close {
    position: absolute; right: 12px; top: 12px; width: 36px; height: 36px;
    border: 0; border-radius: 50%; color: #fff; background: rgba(0,0,0,.18);
    font-size: 24px; line-height: 1; cursor: pointer;
  }
  .profile-avatar, .profile-avatar-edit {
    width: 104px; height: 104px; border-radius: 50%; margin: 0 auto 13px;
    display: flex; align-items: center; justify-content: center; overflow: hidden;
    background: rgba(255,255,255,.22); color: #fff; font-size: 34px; font-weight: 700;
    border: 3px solid rgba(255,255,255,.78);
  }
  .profile-name { font-size: 23px; font-weight: 650; overflow-wrap: anywhere; }
  .profile-label { margin-top: 4px; opacity: .84; font-size: 13px; }
  .profile-actions { display: flex; justify-content: center; gap: 18px; padding: 16px; border-bottom: 1px solid var(--line); }
  .profile-action {
    min-width: 72px; border: 0; background: transparent; color: var(--accent);
    cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 5px;
    font-size: 12px;
  }
  .profile-action-icon {
    width: 42px; height: 42px; border-radius: 50%; display: flex;
    align-items: center; justify-content: center; background: color-mix(in srgb, var(--accent) 13%, transparent);
    font-size: 20px;
  }
  .profile-details { padding: 8px 20px 20px; }
  .profile-detail { padding: 11px 0; border-bottom: 1px solid var(--line); }
  .profile-detail:last-child { border-bottom: 0; }
  .profile-detail-label { color: var(--sub); font-size: 11px; margin-bottom: 3px; }
  .profile-detail-value { font-size: 14px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .contact-form { padding: 18px 20px 20px; }
  .contact-form-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: -4px -4px 12px; }
  .contact-form-header h2 { margin: 0; min-width: 0; font-size: 19px; font-weight: 650; }
  .contact-form-header .icon-btn { width: 34px; height: 34px; flex: 0 0 auto; justify-content: center; padding: 0; font-size: 22px; line-height: 1; background: color-mix(in srgb, var(--text) 8%, transparent); }
  .contact-form-header .icon-btn:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); }
  .contact-form-title { font-size: 19px; font-weight: 600; margin-bottom: 16px; }
  .contact-form-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; min-width: 0; }
  .contact-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .contact-field.full { grid-column: 1 / -1; }
  .contact-field label { color: var(--sub); font-size: 12px; }
  .contact-field input, .contact-field textarea {
    width: 100%; padding: 10px 11px; border: 1px solid var(--line);
    border-radius: 9px; background: var(--bg); color: var(--text); font: inherit; box-sizing: border-box; min-width: 0;
  }
  .contact-field input:focus, .contact-field textarea:focus { outline: none; border-color: var(--accent); }
  .contact-date-wrap {
    position: relative; width: 100%; max-width: 100%; min-width: 0;
    overflow: hidden; box-sizing: border-box; border: 1px solid var(--line);
    border-radius: 9px; background: var(--bg); min-height: 43px;
    display: flex; align-items: center;
  }
  .contact-date-wrap:focus-within { border-color: var(--accent); }
  .contact-date-display { padding: 10px 11px; color: var(--text); font: inherit; pointer-events: none; }
  .contact-date-display.empty { color: var(--sub); }
  .contact-date-wrap input[type="date"] {
    position: absolute; inset: 0; z-index: 1; display: block;
    width: 100% !important; height: 100% !important; opacity: 0;
    cursor: pointer; min-width: 0 !important; margin: 0; padding: 0;
    box-sizing: border-box !important; border: 0 !important;
  }
  .contact-photo-actions { display: flex; justify-content: center; gap: 8px; margin: -5px 0 17px; }
  .contact-photo-btn, .contact-form-btn {
    border: 0; border-radius: 9px; padding: 9px 13px; cursor: pointer;
    background: color-mix(in srgb, var(--accent) 13%, transparent); color: var(--accent);
  }
  .contact-form-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 18px; }
  .custom-methods { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 8px; }
  .custom-methods-title { color: var(--sub); font-size: 12px; }
  .custom-method-row { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.4fr) auto; gap: 7px; align-items: center; }
  .custom-method-row input { min-width: 0; }
  .custom-method-remove { border: 0; background: transparent; color: var(--sub); cursor: pointer; font-size: 18px; padding: 5px; }
  .custom-method-add { align-self: flex-start; }
  .contact-form-btn.primary { background: var(--accent); color: #fff; }
  .contact-form-btn.secondary { background: transparent; color: var(--sub); }
  .brand-picker { padding: 18px 20px 22px; }
  .brand-picker-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
  .brand-picker-back {
    width: 36px; height: 36px; flex: 0 0 auto; border: 0; border-radius: 50%;
    background: color-mix(in srgb, var(--accent) 13%, transparent); color: var(--accent);
    font-size: 22px; cursor: pointer;
  }
  .brand-picker-title { min-width: 0; font-size: 19px; font-weight: 600; }
  .brand-picker-search {
    width: 100%; box-sizing: border-box; padding: 11px 12px; margin-bottom: 12px;
    border: 1px solid var(--line); border-radius: 10px; background: var(--bg);
    color: var(--text); font: inherit;
  }
  .brand-picker-search:focus { outline: none; border-color: var(--accent); }
  .brand-picker-auto {
    width: 100%; margin-bottom: 13px; padding: 11px 12px; border: 1px solid var(--line);
    border-radius: 10px; background: transparent; color: var(--text); cursor: pointer;
    text-align: left; font: inherit;
  }
  .brand-picker-auto.selected { border-color: var(--accent); color: var(--accent); }
  .brand-picker-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
  .brand-option {
    min-width: 0; min-height: 112px; padding: 9px 7px; border: 1px solid var(--line);
    border-radius: 12px; background: var(--bg); color: var(--text); cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px;
  }
  .brand-option:hover, .brand-option.selected { border-color: var(--accent); }
  .brand-option.selected { box-shadow: 0 0 0 1px var(--accent) inset; }
  .brand-option-logo {
    width: 54px; height: 54px; display: flex; align-items: center; justify-content: center;
    border-radius: 50%; overflow: hidden; background: #fff; padding: 5px; box-sizing: border-box;
  }
  .brand-option-logo img { width: 100%; height: 100%; object-fit: contain; }
  .brand-option-name { width: 100%; font-size: 11px; line-height: 1.2; text-align: center; overflow-wrap: anywhere; }
  .brand-picker-empty { padding: 24px 8px; color: var(--sub); text-align: center; }

  @media (max-width: 580px) {
    .folder-tabs {
      position: sticky; top: 3px; left: auto; right: auto; z-index: 8; display: block;
      padding-top: 3px;
    }
    .folder-tab-shell {
      width: auto; margin: 0 12px 7px; padding: 3px; gap: 3px; border: 1px solid var(--line);
      border-radius: 999px; overflow: hidden; background: var(--card);
    }
    .folder-tab-scroll { gap: 3px; padding: 0 1px; }
    .folder-tab { border-color: transparent; border-radius: 999px; padding: 7px 12px; }
    .folder-tab.active { color: var(--accent); border-color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent) inset; }
    .folder-tab.add { font-size: 16px; padding: 6px 10px; }
    .folder-tab-actions { flex-basis: 32px; width: 32px; padding-left: 0; }
    .folder-tab-actions .folder-tab { width: 32px; height: 32px; padding: 0; }
    .profile-actions { gap: 6px; padding: 13px 8px; flex-wrap: wrap; }
    .profile-action { min-width: 62px; flex: 1 1 62px; }
    .contacts { width: 100%; border-right: none; }
    .chat { display: none; position: absolute; inset: 0; z-index: 10; background: var(--bg); }
    .root.chat-open .contacts { display: none; }
    .root.chat-open .chat { display: flex; }
    .root.chat-open .back-btn { display: flex !important; }
    .status-grid { grid-template-columns: 1fr; }
    .fab {
      width: 60px; height: 60px;
      bottom: calc(16px + var(--safe-area-inset-bottom, 0px)); left: 24px;
    }
    #fab-call-anchor {
      bottom: calc(16px + var(--safe-area-inset-bottom, 0px)) !important;
      right: 24px !important;
    }
    .fab-call {
      width: 60px; height: 60px;
    }
    .pb-actions-inline { display: none !important; }
    .pb-more-btn { display: flex !important; }
    .contact-modal-overlay { padding: 0; align-items: flex-end; }
    .contact-modal {
      width: 100%; max-height: calc(100dvh - var(--safe-area-inset-top, 0px));
      border-radius: 20px 20px 0 0;
      padding-bottom: var(--safe-area-inset-bottom, 0px);
      overflow-x: hidden;
    }
    .profile-hero { border-radius: 20px 20px 0 0; }
    .contact-form-grid { grid-template-columns: minmax(0, 1fr); }
    .contact-field.full { grid-column: 1; }
  }

  .pb-actions-inline { display: flex; align-items: center; }

  .pb-more-btn {
    display: none;
    align-items: center; justify-content: center;
    background: none; border: none; cursor: pointer;
    color: var(--sub); padding: 8px; border-radius: 6px;
    flex-shrink: 0; transition: color .15s;
  }
  .pb-more-btn:hover { color: var(--text); }

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
    // Черновики — грузим из localStorage, переживают перезагрузку браузера
    try {
      this._drafts = JSON.parse(localStorage.getItem("sms_gammu_drafts") || "{}");
    } catch {
      this._drafts = {};
    }
    this._sending = false;
    this._modemError = null;
    this._narrow = false;
    this._callHistory = [];
    this._phonebook = [];
    this._phonebookLoaded = false;
    this._profileContact = null;
    this._avatarDraft = undefined;
    this._brandCatalog = null;
    this._brandCatalogPromise = null;
    this._brandAssetPromises = new Map();
    this._brandAssets = {};
    this._contactsLoaded = false;
    this._brandReady = false;
    this._brandPickerContact = null;
    this._chatFolders = [];
    this._activeFolderId = "all";
    this._folderOptions = { show_all: true, people_enabled: false, brands_enabled: false, brands_manual: [], brands_excluded: [], folder_order: [] };
    this._folderScrollLeft = 0;
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
    // Закрываем bottom sheet если панель убрана из DOM (переход на другую страницу)
    this._pbDialog?.close();
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
    let contactsChanged = true;
    try {
      const [contacts, folders, folderOptions] = await Promise.all([
        this._api("contacts"), this._api("chat_folders"), this._api("chat_folder_options"),
      ]);
      this._chatFolders = Array.isArray(folders) ? folders : [];
      if (folderOptions && typeof folderOptions === "object") {
        // Keep older gateways compatible: before independent switches,
        // brands_enabled controlled both system folders.
        this._folderOptions = {
          ...this._folderOptions,
          ...folderOptions,
          people_enabled: "people_enabled" in folderOptions
            ? Boolean(folderOptions.people_enabled)
            : Boolean(folderOptions.brands_enabled),
          brands_enabled: Boolean(folderOptions.brands_enabled),
        };
      }
      const signature = JSON.stringify((contacts || []).map((c) => [
        c.number, c.contact_name, c.last_text, c.last_date, c.unread,
        c.is_muted, c.is_pinned, c.total, c.brand_logo_url,
      ]));
      contactsChanged = signature !== this._contactsSignature;
      this._contactsSignature = signature;
      this._contacts = contacts;
      this._contactsLoaded = true;
      // Фотографии не включаются в часто опрашиваемый список диалогов:
      // телефонную книгу загружаем один раз и обновляем только при изменениях.
      if (!this._phonebookLoaded) {
        try {
          this._phonebook = await this._api("phonebook");
          this._phonebookLoaded = true;
        } catch (_) {}
      }
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
      if (this._status?.use_brand_logos) await this._prepareBrandDisplay();
      else if (this._status) this._brandReady = true;
      if (contactsChanged) this._renderContacts();
      this._renderMessages();
      this._updateBadge();
    }
  }

  async _loadStatus() {
    const hadStatusBefore = !!this._status;
    this._statusLoading = true;
    try {
      const s = await this._api("status");
      this._status = s;
      this._pollInterval = s.poll_interval_hint || 30;
      if (s.cached) {
        // Показываем кеш со спиннером, делаем второй запрос за свежими данными
        this._renderStatusBar();
        await new Promise(r => setTimeout(r, 800));
        try {
          const s2 = await this._api("status");
          this._status = s2;
          this._pollInterval = s2.poll_interval_hint || 30;
        } catch (_) {}
      }
    } catch (_) {}
    if (this._status?.use_brand_logos) {
      this._brandReady = false;
      await this._prepareBrandDisplay();
    } else {
      this._brandReady = true;
    }
    this._statusLoading = false;

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
      // кнопка звонка всегда видна
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
      let needPhonebook = false;

      for (const ev of data.events) {
        if (ev.type === "new_message") {
          needContacts = true;
          if (ev.data.number === this._activeNumber) {
            needMessages = true;
          }
        } else if (ev.type === "message_deleted" || ev.type === "contact_deleted") {
          needContacts = true;
          needMessages = true;
        } else if (ev.type === "contact_saved" || ev.type === "contact_deleted_pb") {
          needContacts = true;
          needPhonebook = true;
        } else if (ev.type === "brand_logo_changed") {
          needContacts = true;
          needPhonebook = true;
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
      if (needPhonebook) {
        this._phonebook = await this._api("phonebook");
        this._phonebookLoaded = true;
        this._renderContacts();
        if (this._activeTab === "phonebook") this._renderPhonebook();
        if (this._activeNumber && this._activeTab === "chats") this._renderMessages();
      }
      if (needMessages && this._activeNumber && this._activeTab === "chats") {
        this._messages = await this._api(`messages/${encodeURIComponent(this._activeNumber)}`);
        this._renderMessages();
      }
    } catch (_) {}
  }

  async _selectContact(number) {
    // Сохраняем черновик текущего чата перед переключением
    if (this._activeNumber && this._activeNumber !== number) {
      const ta = this.shadowRoot.getElementById("send-input");
      if (ta) this._saveDraft(this._activeNumber, ta.value);
    }

    this._activeNumber = number;
    this._firstRender = true;
    try { localStorage.setItem("sms_gammu_active_number", number); } catch {}
    this.shadowRoot.querySelector(".root")?.classList.add("chat-open");

    // Черновик восстанавливается в _restoreDraftUI — вызывается из _renderMessages
    // когда send-bar уже видим в DOM
    this._sendText = this._drafts[number] || "";
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

  _dateLocale() {
    // Явный выбор в нашем UI → язык HA → fallback ru
    try {
      const explicit = localStorage.getItem("sms_gammu_lang");
      const lang = explicit || this._hass?.language || "ru";
      return lang.startsWith("en") ? "en-GB" : "ru-RU";
    } catch { return "ru-RU"; }
  }

  _formatShort(str) {
    if (!str) return "";
    try {
      const loc = this._dateLocale();
      const d = new Date(str);
      const now = new Date();
      if (now - d < 86400000)
        return d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
      if (now - d < 604800000)
        return d.toLocaleDateString(loc, { weekday: "short" });
      return d.toLocaleDateString(loc, { day: "2-digit", month: "short" });
    } catch { return str; }
  }

  _fmtDateLabel(str) {
    if (!str) return "";
    try {
      const loc = this._dateLocale();
      const d   = new Date(str);
      const now = new Date();
      const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today - 86400000);
      const msgDay    = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (msgDay.getTime() === today.getTime())     return this._t("today");
      if (msgDay.getTime() === yesterday.getTime()) return this._t("yesterday");
      return d.toLocaleDateString(loc, { day: "2-digit", month: "long", year: "numeric" });
    } catch { return str; }
  }

  _formatFull(str) {
    if (!str) return "";
    try {
      const loc = this._dateLocale();
      return new Date(str).toLocaleString(loc, {
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

  async _ensureBrandCatalog() {
    if (this._brandCatalog || this._brandCatalogPromise) return this._brandCatalog;
    this._brandCatalogPromise = (async () => {
      try {
        const data = await this._api("brand_catalog");
        if (!Array.isArray(data.logos)) throw new Error("Invalid Trace Logo's catalog");
        this._brandCatalog = data.logos.filter((logo) =>
          logo && !logo.comingSoon && (logo.svgUrl || logo.pngUrl)
        );
      } catch (_) {
        this._brandCatalog = [];
      } finally {
        this._brandCatalogPromise = null;
      }
      return this._brandCatalog;
    })();
    return this._brandCatalogPromise;
  }

  async _prepareBrandDisplay() {
    if (!this._status) return;
    if (!this._status.use_brand_logos) {
      this._brandReady = true;
      return;
    }
    if (!this._contactsLoaded) return;
    await this._ensureBrandCatalog();
    const logos = [...new Set(this._contacts
      .map((contact) => this._brandLogoFor(contact))
      .filter((logo) => logo && !logo.startsWith("/")))];
    await Promise.all(logos.map((logo) => this._ensureBrandAsset(logo)));
    this._brandReady = true;
  }

  _brandLogoFor(contact) {
    if (!this._status?.use_brand_logos || !this._brandCatalog?.length || !contact) return "";
    const value = String(contact.contact_name || contact.number || "").trim().toLowerCase();
    if (!value || !this._isAlphaTag(contact.number)) return "";
    const override = String(contact.brand_logo_url || "").trim();
    if (override) {
      const selected = this._brandCatalog.find((logo) => this._brandSourceUrl(logo) === override);
      return selected?.localUrl || override;
    }
    const normalized = this._normalizeBrandText(value);
    const found = this._brandCatalog.find((logo) => {
      const haystack = this._normalizeBrandText(
        `${logo.name || ""} ${logo.name_en || ""} ${logo.tags || ""}`
      );
      const tokens = haystack.split(/\s+/).filter(Boolean);
      return Boolean(normalized && (
        haystack === normalized || haystack.includes(normalized) ||
        normalized.split(/\s+/).some((inputToken) =>
          inputToken.length >= 2 && tokens.includes(inputToken)
        )
      ));
    });
    return found?.localUrl || found?.svgUrl || found?.pngUrl || "";
  }

  _brandSourceUrl(logo) {
    return String(logo?.svgUrl || logo?.pngUrl || "");
  }

  _brandCandidates(query, limit = 36) {
    const needle = this._normalizeBrandText(query);
    if (!needle || !this._brandCatalog?.length) return [];
    const inputTokens = needle.split(/\s+/).filter((token) => token.length >= 2);
    return this._brandCatalog
      .map((logo, index) => {
        const primary = this._normalizeBrandText(logo.name || logo.name_en || "");
        const haystack = this._normalizeBrandText(
          `${logo.name || ""} ${logo.name_en || ""} ${logo.tags || ""}`
        );
        const tokens = haystack.split(/\s+/).filter(Boolean);
        let score = 0;
        if (primary === needle) score = 1000;
        else if (primary.startsWith(needle)) score = 800;
        else if (tokens.includes(needle)) score = 700;
        else if (haystack.includes(needle)) score = 500;
        else if (inputTokens.some((token) => tokens.includes(token))) score = 300;
        else if (inputTokens.some((token) => haystack.includes(token))) score = 100;
        return { logo, index, score };
      })
      .filter((item) => item.score > 0 && this._brandSourceUrl(item.logo))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, limit)
      .map((item) => item.logo);
  }

  _normalizeBrandText(value) {
    return String(value || "")
      .toLowerCase()
      // Адресные суффиксы мешают сопоставлению «VK.RU» с «VK».
      .replace(/\.(?:ru|рф|com|net|org|io|su|me|tv|online)\b/gi, " ")
      .replace(/\b(?:ru|рф|com|net|org|io|su|me|tv|online)\b/gi, " ")
      .replace(/[«»"'’.,()\[\]{}_/\\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  _brandAvatarFor(contact, className = "avatar") {
    const logo = this._brandLogoFor(contact);
    const src = this._brandAssetSrc(logo);
    if (logo && !src) this._ensureBrandAsset(logo);
    return src ? `<div class="${className} brand-avatar"><img src="${this._esc(src)}" alt="" /></div>` : "";
  }

  _brandAssetSrc(logo) {
    return logo ? this._brandAssets[logo] || (logo.startsWith("/") ? logo : "") : "";
  }

  async _ensureBrandAsset(logo) {
    if (!logo || this._brandAssets[logo]) return this._brandAssets[logo] || "";
    if (this._brandAssetPromises.has(logo)) return this._brandAssetPromises.get(logo);
    const promise = (async () => {
      try {
        const response = await this._api(`brand_asset?url=${encodeURIComponent(logo)}`);
        if (!response?.url) throw new Error("brand asset URL missing");
        this._brandAssets[logo] = response.url;
        this._renderContacts();
        this._renderMessages();
        if (!this._brandPickerContact && this.shadowRoot.getElementById("contact-modal-overlay")?.classList.contains("open")) {
          this._renderContactProfile();
        }
        return response.url;
      } catch (_) {
        return "";
      } finally {
        this._brandAssetPromises.delete(logo);
      }
    })();
    this._brandAssetPromises.set(logo, promise);
    return promise;
  }

  _chatAvatarMarkup(contact) {
    if (this._avatarFor(contact)) return this._contactAvatar(contact, "avatar");
    const brand = this._brandAvatarFor(contact);
    if (brand) return brand;
    return `<div class="avatar ${this._isAlphaTag(contact.number) ? 'alpha' : ''}">${this._esc(contact.contact_name ? contact.contact_name.slice(0,1).toUpperCase() : this._avatar(contact.number))}</div>`;
  }

  _isAlphaTag(number) {
    return number && !/^[+\d\s\-()]+$/.test(number.trim());
  }

  _esc(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  _filteredContacts() {
    let contacts = this._contacts;
    if (this._activeFolderId === "brands") {
      contacts = contacts.filter((contact) => this._isInBrandsFolder(contact));
    } else if (this._activeFolderId === "people") {
      contacts = contacts.filter((contact) => !this._isInBrandsFolder(contact));
    } else if (this._activeFolderId !== "all") {
      const folder = this._chatFolders.find((item) => item.id === this._activeFolderId);
      const numbers = new Set(folder?.numbers || []);
      contacts = contacts.filter((c) => numbers.has(c.number));
    }
    if (!this._search.trim()) return contacts;
    const q = this._search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.number.toLowerCase().includes(q) ||
        (c.contact_name || "").toLowerCase().includes(q) ||
        (c.last_text || "").toLowerCase().includes(q)
    );
  }

  _isBrandChat(contact) {
    return Boolean(contact?.brand_logo_url || this._brandLogoFor(contact));
  }

  _isInBrandsFolder(contact) {
    const manual = new Set(this._folderOptions.brands_manual || []);
    const excluded = new Set(this._folderOptions.brands_excluded || []);
    return !excluded.has(contact?.number) && (manual.has(contact?.number) || this._isBrandChat(contact));
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
    const counter = this.shadowRoot.getElementById("char-counter");
    if (btn) { btn.disabled = true; btn.style.opacity = "0.5"; }

    // Оптимистично очищаем поле сразу — не ждём ответа сервера
    const savedText = text;
    this._sendText = "";
    if (ta) { ta.value = ""; ta.style.height = "auto"; }
    if (counter) counter.style.display = "none";

    try {
      const res = await this._api("send", "POST", { number, text: savedText });
      if (res.ok) {
        // Удаляем черновик — сообщение отправлено
        this._saveDraft(number, "");
        // Перезагружаем историю и контакты
        this._messages = await this._api(`messages/${encodeURIComponent(number)}`);
        this._renderMessages();
        await this._refreshContacts();
        // Финальная очистка поля
        const taFresh = this.shadowRoot.getElementById("send-input");
        const counterFresh = this.shadowRoot.getElementById("char-counter");
        if (taFresh) { taFresh.value = ""; taFresh.style.height = "auto"; }
        if (counterFresh) counterFresh.style.display = "none";
      } else {
        // Возвращаем текст обратно если не отправился
        this._sendText = savedText;
        if (ta) { ta.value = savedText; }
        this._showToast(this._t("send_error"));
      }
    } catch (e) {
      // Возвращаем текст если сеть упала
      this._sendText = savedText;
      if (ta) { ta.value = savedText; }
      this._showToast(this._t("send_error") + ": " + e.message);
    } finally {
      this._sending = false;
      if (btn) { btn.disabled = !this._sendText.trim(); btn.style.opacity = ""; }
    }
  }

  _restoreDraftUI() {
    // Восстанавливает черновик в поле ввода для текущего активного чата.
    // Вызывается из _renderMessages после того как send-bar уже отображён.
    const number = this._activeNumber;
    if (!number) return;
    const draft = this._drafts[number] || "";
    const ta = this.shadowRoot.getElementById("send-input");
    const sendBtn = this.shadowRoot.getElementById("send-btn");
    const counter = this.shadowRoot.getElementById("char-counter");
    if (ta && ta.value !== draft) {
      ta.value = draft;
      ta.style.height = "auto";
      if (draft) ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
    if (sendBtn) sendBtn.disabled = !draft.trim();
    if (counter) {
      if (!draft) {
        counter.style.display = "none";
      } else {
        const hasCyrillic = /[а-яёА-ЯЁ]/.test(draft);
        const singleSize = hasCyrillic ? 70 : 160;
        const partSize = hasCyrillic ? 67 : 153;
        const isMulti = draft.length > singleSize;
        const parts = isMulti ? Math.ceil(draft.length / partSize) : 1;
        const limit = isMulti ? parts * partSize : singleSize;
        const left = limit - draft.length;
        counter.style.display = "";
        counter.textContent = isMulti ? `${draft.length} / ${limit} · ${parts} SMS` : `${left}`;
        counter.className = "char-counter" + (left < 10 ? " over" : left < 30 ? " warn" : "");
      }
    }
  }

  _saveDraft(number, text) {
    if (text) {
      this._drafts[number] = text;
    } else {
      delete this._drafts[number];
    }
    try { localStorage.setItem("sms_gammu_drafts", JSON.stringify(this._drafts)); } catch {}
  }

  async _refreshContacts() {
    try {
      this._contacts = await this._api("contacts");
      this._renderContacts();
      this._updateBadge();
    } catch (_) {}
  }

  _openPbSheet(number, name, isMuted) {
    if (!this._pbDialog) return;
    this._pbSheetNumber = number;
    this._pbDialog.querySelector("#pb-d-name").textContent = name;
    this._pbDialog.querySelector("#pb-d-num").textContent = number;
    this._pbDialog.querySelector("#pb-d-open-lbl").textContent = this._t("open_chat");
    this._pbDialog.querySelector("#pb-d-call-lbl").textContent = this._t("call_number");
    this._pbDialog.querySelector("#pb-d-mute-lbl").textContent = isMuted ? this._t("unmute_chat") : this._t("mute_chat");
    this._pbDialog.querySelector("#pb-d-edit-lbl").textContent = this._t("edit");
    this._pbDialog.querySelector("#pb-d-delete-lbl").textContent = this._t("delete_msg");
    this._pbDialog.showModal();
    // Убираем автофокус с первой кнопки — иначе браузер рисует outline
    this._pbDialog.querySelector(".pb-d-btn").blur();
  }

  _closePbSheet() {
    this._pbDialog?.close();
    this._pbSheetNumber = null;
  }

  _initPbSheet() {
    const dialog = document.createElement("dialog");
    dialog.id = "pb-dialog";
    // Позиционируем через margin:auto auto 0 — прижимаем к низу экрана
    dialog.style.cssText = [
      "border:none; padding:0; background:transparent;",
      "width:100%; max-width:480px;",
      "margin: auto auto 0 auto;",   // bottom sheet — прижат к низу
      "max-height: 90vh;",
    ].join(" ");

    const style = document.createElement("style");
    // Берём цвета из CSS переменных HA которые доступны в document (не в shadow)
    style.textContent = [
      "dialog#pb-dialog, dialog#pb-dialog * { outline:none; }",
      "dialog#pb-dialog::backdrop { background: rgba(0,0,0,.55); }",
      ".pb-d-sheet {",
      "  background: var(--card-background-color, #fff);",
      "  border-radius: 18px 18px 0 0;",
      "  padding-bottom: max(env(safe-area-inset-bottom,0px), 16px);",
      "  font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);",
      "}",
      ".pb-d-handle {",
      "  width:36px; height:4px; border-radius:2px;",
      "  background: var(--divider-color, #ddd);",
      "  margin: 12px auto 6px;",
      "}",
      ".pb-d-header {",
      "  padding: 6px 20px 14px;",
      "  border-bottom: 1px solid var(--divider-color, #eee);",
      "}",
      ".pb-d-name { font-size:16px; font-weight:600; color: var(--primary-text-color, #111); }",
      ".pb-d-num  { font-size:13px; color: var(--secondary-text-color, #666); margin-top:2px; }",
      ".pb-d-btn {",
      "  display:flex; align-items:center; gap:16px;",
      "  width:100%; padding:15px 24px;",
      "  border:none; background:none; cursor:pointer;",
      "  font-size:15px; color: var(--primary-text-color, #111);",
      "  font-family:inherit; text-align:left;",
      "  transition: background .15s;",
      "}",
      ".pb-d-btn:active { background: rgba(0,0,0,.06); }",
      ".pb-d-btn.danger { color: #e53935; }",
    ].join(" ");
    document.head.appendChild(style);

    const svgPhone = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
    const svgChat = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    const svgMute = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    const svgEdit = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    const svgDel  = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';

    dialog.innerHTML =
      '<div class="pb-d-sheet">' +
        '<div class="pb-d-handle"></div>' +
        '<div class="pb-d-header">' +
          '<div class="pb-d-name" id="pb-d-name"></div>' +
          '<div class="pb-d-num" id="pb-d-num"></div>' +
        '</div>' +
        '<button class="pb-d-btn" id="pb-d-open">' + svgChat + '<span id="pb-d-open-lbl"></span></button>' +
        '<button class="pb-d-btn" id="pb-d-call">' + svgPhone + '<span id="pb-d-call-lbl"></span></button>' +
        '<button class="pb-d-btn" id="pb-d-mute">' + svgMute + '<span id="pb-d-mute-lbl"></span></button>' +
        '<button class="pb-d-btn" id="pb-d-edit">' + svgEdit + '<span id="pb-d-edit-lbl"></span></button>' +
        '<button class="pb-d-btn danger" id="pb-d-delete">' + svgDel + '<span id="pb-d-delete-lbl"></span></button>' +
      '</div>';

    document.body.appendChild(dialog);

    dialog.addEventListener("click", (e) => {
      const rect = dialog.querySelector(".pb-d-sheet").getBoundingClientRect();
      if (e.clientY < rect.top) dialog.close();
    });
    dialog.querySelector("#pb-d-open").addEventListener("click", () => {
      const n = this._pbSheetNumber; dialog.close();
      this._activeTab = "chats";
      this.shadowRoot.getElementById("phonebook-btn").style.color = "";
      this._switchTab(); this._selectContact(n);
    });
    dialog.querySelector("#pb-d-mute").addEventListener("click", () => {
      const n = this._pbSheetNumber; dialog.close(); this._togglePhonebookMute(n);
    });
    dialog.querySelector("#pb-d-edit").addEventListener("click", () => {
      const n = this._pbSheetNumber; dialog.close();
      const c = this._phonebook.find((x) => x.number === n);
      this._openContactEditor(c);
    });
    dialog.querySelector("#pb-d-delete").addEventListener("click", () => {
      const n = this._pbSheetNumber; dialog.close(); this._deleteContactFromBook(n);
    });

    this._pbDialog = dialog;


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
      const profileAvatar = this.shadowRoot.getElementById("chat-profile-avatar");
      if (profileAvatar) profileAvatar.style.display = "none";
      const profileTrigger = this.shadowRoot.getElementById("chat-profile-trigger");
      if (profileTrigger) profileTrigger.style.pointerEvents = "none";
      const starBtn = this.shadowRoot.getElementById("star-filter-btn");
      if (starBtn) starBtn.style.display = "none";
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
      const profileTrigger = this.shadowRoot.getElementById("chat-profile-trigger");
      if (profileTrigger) profileTrigger.style.pointerEvents = "";
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
      this._phonebookLoaded = true;
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
          (c.label || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.company || "").toLowerCase().includes(q)
        )
      : all;

    const rows = items.length
      ? items.map((c) => `
          <div class="pb-item" data-number="${this._esc(c.number)}">
            ${this._contactAvatar(c, "pb-avatar")}
            <div class="pb-info">
              <div class="pb-name">${this._esc(c.name)}</div>
              <div class="pb-meta">
                ${this._esc(c.number)}${c.label ? " · " + this._esc(c.label) : ""}${c.company ? " · " + this._esc(c.company) : ""}
              </div>
            </div>
            <div class="pb-actions-inline">
              <button class="pb-action-btn" data-action="open" data-number="${this._esc(c.number)}" title="${this._t("open_chat")}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </button>
              <button class="pb-action-btn" data-action="call" data-number="${this._esc(c.number)}" title="${this._t("call_number")}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
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
            <button class="pb-more-btn" data-number="${this._esc(c.number)}" data-name="${this._esc(c.name)}" data-muted="${c.is_muted ? "1" : "0"}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
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

    page.querySelectorAll(".pb-more-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._openPbSheet(btn.dataset.number, btn.dataset.name, btn.dataset.muted === "1");
      });
    });

    // Как в мессенджерах: нажатие по контакту открывает полноценный профиль.
    page.querySelectorAll(".pb-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.closest(".pb-action-btn") || e.target.closest(".pb-more-btn")) return;
        this._openContactProfile(item.dataset.number);
      });
    });

    page.querySelectorAll(".pb-action-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const number = btn.dataset.number;
        const action = btn.dataset.action;
        if (action === "call") {
          this._callNumber(number);
          return;
        }
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

  _avatarFor(contact) {
    if (!contact) return "";
    if (contact.avatar) return contact.avatar;
    return this._phonebook.find((c) => c.number === contact.number)?.avatar || "";
  }

  _contactMethodValue(value) {
    const text = String(value || "");
    const escaped = this._esc(text);
    if (/^(https?:\/\/|mailto:|tel:)/i.test(text)) {
      return `<a href="${escaped}" target="_blank" rel="noopener noreferrer">${escaped}</a>`;
    }
    return escaped;
  }

  _formatDateInput(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value || "");
  }

  _contactAvatar(contact, className = "profile-avatar") {
    const avatar = this._avatarFor(contact);
    const brand = avatar ? "" : this._brandLogoFor(contact);
    const brandSrc = this._brandAssetSrc(brand);
    if (brand && !brandSrc) this._ensureBrandAsset(brand);
    const name = contact?.name || contact?.contact_name || contact?.number || "?";
    const fallback = this._esc(name.slice(0, 1).toUpperCase() || "?");
    return `<div class="${className}">${avatar
      ? `<img src="${this._esc(avatar)}" alt="" />`
      : brandSrc
        ? `<img src="${this._esc(brandSrc)}" alt="" />`
      : fallback}</div>`;
  }

  async _contactForNumber(number) {
    const cached = this._phonebook.find((c) => c.number === number);
    if (cached) return { ...cached, _saved: true };
    try {
      const contact = await this._api(`phonebook/${encodeURIComponent(number)}`);
      return { ...contact, _saved: true };
    } catch (_) {
      const chat = this._contacts.find((c) => c.number === number);
      return {
        number,
        name: chat?.contact_name || number,
        label: chat?.contact_label || "",
        avatar: this._avatarFor(chat),
        brand_logo_url: chat?.brand_logo_url || "",
        email: "", company: "", birthday: "", notes: "",
        _saved: false,
      };
    }
  }

  async _openContactProfile(number) {
    if (!number) return;
    this._profileContact = await this._contactForNumber(number);
    this._renderContactProfile();
    this.shadowRoot.getElementById("contact-modal-overlay")?.classList.add("open");
  }

  _closeContactModal() {
    this.shadowRoot.getElementById("contact-modal-overlay")?.classList.remove("open");
    this._avatarDraft = undefined;
  }

  _renderContactProfile() {
    const modal = this.shadowRoot.getElementById("contact-modal");
    const c = this._profileContact;
    if (!modal || !c) return;
    const details = [
      [this._t("contact_number"), c.number],
      [this._t("contact_email"), c.email],
      [this._t("contact_company"), c.company],
      [this._t("contact_birthday"), c.birthday],
      [this._t("contact_notes"), c.notes],
    ].filter(([, value]) => value);
    const customMethods = Array.isArray(c.custom_methods) ? c.custom_methods.filter((item) => item?.method && item?.value) : [];
    modal.innerHTML = `
      <div class="profile-hero">
        <button class="profile-close" id="profile-close" title="${this._t("close")}">×</button>
        ${this._contactAvatar(c)}
        <div class="profile-name">${this._esc(c.name || c.number)}</div>
        <div class="profile-label">${this._esc(c.label || c.number)}</div>
      </div>
      <div class="profile-actions">
        <button class="profile-action" id="profile-message">
          <span class="profile-action-icon">✉</span><span>${this._t("open_chat")}</span>
        </button>
        ${this._status?.call_enabled ? `<button class="profile-action" id="profile-call">
          <span class="profile-action-icon">☎</span><span>${this._t("call_number")}</span>
        </button>` : ""}
        <button class="profile-action" id="profile-edit">
          <span class="profile-action-icon">✎</span><span>${c._saved ? this._t("edit") : this._t("add_to_contacts")}</span>
        </button>
        ${this._status?.use_brand_logos && this._isAlphaTag(c.number) ? `<button class="profile-action" id="profile-brand">
          <span class="profile-action-icon">▣</span><span>${this._t("change_brand_logo")}</span>
        </button>` : ""}
      </div>
      <div class="profile-details">
        ${details.length || customMethods.length ? `${details.map(([label, value]) => `
          <div class="profile-detail">
            <div class="profile-detail-label">${this._esc(label)}</div>
            <div class="profile-detail-value">${this._esc(value)}</div>
          </div>`).join("")}${customMethods.map((item) => `
          <div class="profile-detail">
            <div class="profile-detail-label">${this._esc(item.method)}</div>
            <div class="profile-detail-value">${this._contactMethodValue(item.value)}</div>
          </div>`).join("")}` : `<div class="pb-empty">${this._t("contact_details")}</div>`}
      </div>`;
    modal.querySelector("#profile-close")?.addEventListener("click", () => this._closeContactModal());
    modal.querySelector("#profile-message")?.addEventListener("click", async () => {
      this._closeContactModal();
      this._activeTab = "chats";
      this.shadowRoot.getElementById("phonebook-btn").style.color = "";
      this._switchTab();
      await this._selectContact(c.number);
    });
    modal.querySelector("#profile-call")?.addEventListener("click", () => {
      this._closeContactModal();
      this._callNumber(c.number);
    });
    modal.querySelector("#profile-edit")?.addEventListener("click", () => this._openContactEditor(c));
    modal.querySelector("#profile-brand")?.addEventListener("click", () => this._openBrandLogoPicker(c));
  }

  async _openBrandLogoPicker(contact) {
    if (!contact?.number) return;
    await this._ensureBrandCatalog();
    this._brandPickerContact = contact;
    this._renderBrandLogoPicker(String(contact.contact_name || contact.name || contact.number));
  }

  _renderBrandLogoPicker(query) {
    const modal = this.shadowRoot.getElementById("contact-modal");
    if (!modal || !this._brandPickerContact) return;
    const contact = this._brandPickerContact;
    const selectedUrl = String(contact.brand_logo_url || "");
    const candidates = this._brandCandidates(query);
    modal.innerHTML = `
      <div class="brand-picker">
        <div class="brand-picker-header">
          <button class="brand-picker-back" id="brand-picker-back" title="${this._t("back")}">‹</button>
          <div class="brand-picker-title">${this._t("choose_brand_logo")}</div>
        </div>
        <input class="brand-picker-search" id="brand-picker-search" value="${this._esc(query || "")}" placeholder="${this._esc(this._t("search_brand_logos"))}" />
        <button class="brand-picker-auto ${selectedUrl ? "" : "selected"}" id="brand-picker-auto">${this._t("brand_logo_auto")}</button>
        <div class="brand-picker-grid">
          ${candidates.length ? candidates.map((logo) => {
            const source = this._brandSourceUrl(logo);
            const src = this._brandAssetSrc(logo.localUrl || source);
            const name = logo.name || logo.name_en || this._t("brand_logo");
            return `<button class="brand-option ${selectedUrl === source ? "selected" : ""}" data-brand-source="${this._esc(source)}">
              <span class="brand-option-logo">${src ? `<img src="${this._esc(src)}" alt="" />` : "…"}</span>
              <span class="brand-option-name">${this._esc(name)}</span>
            </button>`;
          }).join("") : `<div class="brand-picker-empty">${this._t("no_brand_logos")}</div>`}
        </div>
      </div>`;
    modal.querySelector("#brand-picker-back")?.addEventListener("click", () => {
      const c = this._brandPickerContact;
      this._brandPickerContact = null;
      this._profileContact = c;
      this._renderContactProfile();
    });
    const search = modal.querySelector("#brand-picker-search");
    search?.addEventListener("input", (event) => {
      const value = event.target.value;
      this._renderBrandLogoPicker(value);
      const next = this.shadowRoot.querySelector("#brand-picker-search");
      if (next) {
        next.focus();
        next.setSelectionRange(value.length, value.length);
      }
    });
    modal.querySelector("#brand-picker-auto")?.addEventListener("click", () => this._saveBrandLogoOverride(contact, ""));
    modal.querySelectorAll("[data-brand-source]").forEach((button) => {
      button.addEventListener("click", () => this._saveBrandLogoOverride(contact, button.dataset.brandSource || ""));
    });

    // Загружаем только варианты, видимые в окне выбора, а не весь каталог.
    const remote = candidates
      .map((logo) => this._brandSourceUrl(logo))
      .filter((source) => source && !this._brandAssetSrc(source));
    if (remote.length) {
      Promise.all(remote.map((source) => this._ensureBrandAsset(source))).then(() => {
        if (this._brandPickerContact === contact) this._renderBrandLogoPicker(search?.value || query);
      });
    }
  }

  async _saveBrandLogoOverride(contact, sourceUrl) {
    const button = this.shadowRoot.querySelector("#brand-picker-auto") || this.shadowRoot.querySelector("[data-brand-source]");
    if (button) button.disabled = true;
    try {
      if (sourceUrl) await this._ensureBrandAsset(sourceUrl);
      await this._api("brand_logo_override", "POST", { number: contact.number, url: sourceUrl });
      const update = (item) => item && item.number === contact.number ? { ...item, brand_logo_url: sourceUrl } : item;
      this._contacts = this._contacts.map(update);
      this._phonebook = this._phonebook.map(update);
      this._profileContact = { ...contact, brand_logo_url: sourceUrl };
      this._brandPickerContact = null;
      this._renderContacts();
      this._renderMessages();
      this._renderContactProfile();
      this._showToast(this._t("brand_logo_saved"));
    } catch (error) {
      this._showToast(`${this._t("send_error")}: ${error.message}`);
      if (button) button.disabled = false;
    }
  }

  _openContactEditor(contact = null) {
    const modal = this.shadowRoot.getElementById("contact-modal");
    const overlay = this.shadowRoot.getElementById("contact-modal-overlay");
    if (!modal || !overlay) return;
    const c = contact || {
      number: "", name: "", label: "", email: "", company: "",
      birthday: "", notes: "", avatar: "", _saved: false,
      custom_methods: [],
    };
    this._profileContact = c;
    this._avatarDraft = undefined;
    const readonly = c._saved ? "readonly" : "";
    modal.innerHTML = `
      <div class="contact-form">
        <div class="contact-form-title">${c._saved ? this._t("edit_contact") : this._t("add_contact")}</div>
        <div id="contact-avatar-preview">${this._contactAvatar(c, "profile-avatar-edit")}</div>
        <div class="contact-photo-actions">
          <button class="contact-photo-btn" id="contact-photo-choose">${this._t("choose_photo")}</button>
          <button class="contact-photo-btn" id="contact-photo-remove" ${c.avatar ? "" : "style=\"display:none\""}>${this._t("remove_photo")}</button>
          <input id="contact-photo-input" type="file" accept="image/jpeg,image/png,image/webp" hidden />
        </div>
        <div class="contact-form-grid">
          <div class="contact-field full"><label>${this._t("contact_name")} *</label><input id="contact-name" maxlength="120" value="${this._esc(c.name || "")}" /></div>
          <div class="contact-field full"><label>${this._t("contact_number")} *</label><input id="contact-number" maxlength="64" value="${this._esc(c.number || "")}" ${readonly} /></div>
          <div class="contact-field"><label>${this._t("contact_label")}</label><input id="contact-label" maxlength="80" value="${this._esc(c.label || "")}" /></div>
          <div class="contact-field"><label>${this._t("contact_company")}</label><input id="contact-company" maxlength="120" value="${this._esc(c.company || "")}" /></div>
          <div class="contact-field"><label>${this._t("contact_email")}</label><input id="contact-email" type="email" maxlength="254" value="${this._esc(c.email || "")}" /></div>
          <div class="contact-field"><label>${this._t("contact_birthday")}</label><div class="contact-date-wrap"><span id="contact-birthday-display" class="contact-date-display ${c.birthday ? "" : "empty"}">${this._esc(c.birthday ? this._formatDateInput(c.birthday) : this._t("choose_birthday"))}</span><input id="contact-birthday" type="date" value="${this._esc(c.birthday || "")}" aria-label="${this._esc(this._t("contact_birthday"))}" /></div></div>
          <div class="custom-methods"><div class="custom-methods-title">${this._t("contact_custom_methods")}</div><div id="custom-method-list"></div><button type="button" class="contact-photo-btn custom-method-add" id="custom-method-add">＋ ${this._t("add_custom_method")}</button></div>
          <div class="contact-field full"><label>${this._t("contact_notes")}</label><textarea id="contact-notes" rows="4" maxlength="4000">${this._esc(c.notes || "")}</textarea></div>
        </div>
        <div class="contact-form-actions">
          <button class="contact-form-btn secondary" id="contact-cancel">${this._t("cancel")}</button>
          <button class="contact-form-btn primary" id="contact-save">${this._t("save")}</button>
        </div>
      </div>`;
    overlay.classList.add("open");
    const methodList = modal.querySelector("#custom-method-list");
    const addMethodRow = (item = {}) => {
      const row = document.createElement("div"); row.className = "custom-method-row";
      row.innerHTML = `<input class="custom-method-name" maxlength="80" placeholder="${this._esc(this._t("custom_method_placeholder"))}" value="${this._esc(item.method || "")}"><input class="custom-method-value" maxlength="500" placeholder="${this._esc(this._t("custom_value_placeholder"))}" value="${this._esc(item.value || "")}"><button type="button" class="custom-method-remove" title="${this._t("remove_custom_method")}">×</button>`;
      row.querySelector(".custom-method-remove")?.addEventListener("click", () => row.remove());
      methodList?.appendChild(row);
    };
    (Array.isArray(c.custom_methods) ? c.custom_methods : []).forEach(addMethodRow);
    modal.querySelector("#custom-method-add")?.addEventListener("click", () => addMethodRow());
    const birthdayInput = modal.querySelector("#contact-birthday");
    birthdayInput?.addEventListener("click", () => {
      try { birthdayInput.showPicker?.(); } catch (_) {}
    });
    birthdayInput?.addEventListener("change", (event) => {
      const input = event.currentTarget;
      const display = modal.querySelector("#contact-birthday-display");
      if (!display) return;
      display.textContent = input.value ? this._formatDateInput(input.value) : this._t("choose_birthday");
      display.classList.toggle("empty", !input.value);
    });
    modal.querySelector("#contact-cancel")?.addEventListener("click", () => this._closeContactModal());
    const fileInput = modal.querySelector("#contact-photo-input");
    modal.querySelector("#contact-photo-choose")?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        this._avatarDraft = await this._prepareAvatar(file);
        const preview = modal.querySelector("#contact-avatar-preview");
        if (preview) preview.innerHTML = this._contactAvatar({ ...c, avatar: this._avatarDraft }, "profile-avatar-edit");
        const remove = modal.querySelector("#contact-photo-remove");
        if (remove) remove.style.display = "";
      } catch (_) {
        this._showToast(this._t("photo_too_large"));
      }
    });
    modal.querySelector("#contact-photo-remove")?.addEventListener("click", () => {
      this._avatarDraft = "";
      const preview = modal.querySelector("#contact-avatar-preview");
      if (preview) preview.innerHTML = this._contactAvatar({ ...c, avatar: "" }, "profile-avatar-edit");
      modal.querySelector("#contact-photo-remove").style.display = "none";
    });
    modal.querySelector("#contact-save")?.addEventListener("click", () => this._saveContactForm(modal));
    setTimeout(() => modal.querySelector("#contact-name")?.focus(), 30);
  }

  _prepareAvatar(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) return reject(new Error("invalid image"));
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const side = Math.min(image.naturalWidth, image.naturalHeight);
          // Keep contact photos lightweight: avatars are rendered at 42–64px
          // in the UI and do not need the original camera resolution.
          const size = Math.min(384, side);
          const canvas = document.createElement("canvas");
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(
            image,
            (image.naturalWidth - side) / 2,
            (image.naturalHeight - side) / 2,
            side, side, 0, 0, size, size,
          );
          const data = canvas.toDataURL("image/jpeg", .78);
          data.length <= 350000 ? resolve(data) : reject(new Error("image too large"));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async _saveContactForm(modal) {
    const value = (id) => modal.querySelector(`#${id}`)?.value.trim() || "";
    const payload = {
      number: value("contact-number"), name: value("contact-name"),
      label: value("contact-label"), email: value("contact-email"),
      company: value("contact-company"), birthday: value("contact-birthday"),
      notes: value("contact-notes"),
      custom_methods: [...modal.querySelectorAll(".custom-method-row")].map((row) => ({
        method: row.querySelector(".custom-method-name")?.value.trim() || "",
        value: row.querySelector(".custom-method-value")?.value.trim() || "",
      })).filter((item) => item.method || item.value),
    };
    if (!payload.name) return this._showToast(this._t("name_required"));
    if (!payload.number) return this._showToast(this._t("number_required"));
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      return this._showToast(this._t("invalid_email"));
    }
    if (this._avatarDraft !== undefined) payload.avatar = this._avatarDraft;
    const save = modal.querySelector("#contact-save");
    if (save) save.disabled = true;
    try {
      const result = await this._api("add_contact", "POST", payload);
      this._profileContact = { ...(result.contact || payload), _saved: true };
      this._phonebook = await this._api("phonebook");
      await this._refreshContacts();
      this._showToast(this._t("saved"));
      this._renderContactProfile();
    } catch (e) {
      this._showToast(this._t("send_error") + ": " + e.message);
      if (save) save.disabled = false;
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

    const modem = s.modem || {};
    const modemValue = (upper, ...lower) => modem[upper] ?? lower.map((key) => modem[key]).find((value) => value != null);
    const modemCard = card(this._t("modem_card"), `
      ${row(this._t("manufacturer"), modemValue("Manufacturer", "manufacturer", "vendor"))}
      ${row(this._t("model"), modemValue("Model", "model", "device"))}
      ${row(this._t("firmware"), modemValue("Firmware", "firmware", "firmware_version", "revision"))}
      ${row("IMEI", modemValue("IMEI", "imei"))}
    `);

    const fmt = (b) => b < 1024*1024 ? (b/1024).toFixed(1)+" KB" : (b/1024/1024).toFixed(2)+" MB";
    const storageCard = `
      <div class="stat-card db-stat-card">
        <h3>${this._t("storage")}</h3>
        <div class="stat-row"><span class="stat-key">${this._t("db_size")}</span><span class="stat-val db-size-val">...</span></div>
        <div class="stat-row"><span class="stat-key">${this._t("msg_count")}</span><span class="stat-val db-msg-val">...</span></div>
        <button class="reset-btn" id="clear-storage-btn" style="margin-top:10px;color:#e53935;width:100%">${this._t("clear_storage")}</button>
      </div>`;

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
          <button class="neutral-btn port-check-btn" id="check-port-btn" style="margin-top:10px">
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
        ${storageCard}
      </div>
      <button class="reset-btn" id="reset-modem-btn">${this._t("reset_modem")}</button>`;

    // Загружаем статистику БД
    this._api("db_stats").then(db => {
      if (!db) return;
      const fmt2 = (b) => b < 1024*1024 ? (b/1024).toFixed(1)+" KB" : (b/1024/1024).toFixed(2)+" MB";
      const dbCard = page.querySelector(".db-stat-card");
      if (dbCard) {
        dbCard.querySelector(".db-size-val").textContent = fmt2(db.db_size);
        dbCard.querySelector(".db-msg-val").textContent = db.msg_count;
      }
    }).catch(() => {});

    page.querySelector("#clear-storage-btn")?.addEventListener("click", async () => {
      if (!confirm(this._t("clear_storage_confirm"))) return;
      try {
        await this._api("clear_storage", "POST");
        this._contacts = [];
        this._messages = [];
        this._activeNumber = null;
        await this._load();
        this._renderContacts();
        this._renderStatusPage();
      } catch (e) {
        alert(this._t("error") + ": " + e.message);
      }
    });

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

        <div class="contact-modal-overlay" id="contact-modal-overlay">
          <div class="contact-modal" id="contact-modal"></div>
        </div>

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
            <input class="search" id="search" type="text" />
          </div>
          <div class="contact-list" id="contact-list">
            <div class="contact-scroll-chrome">
              <div class="status-bar" id="status-bar">${this._t("loading_status")}</div>
              <div class="folder-tabs" id="folder-tabs"></div>
            </div>
            <div class="contact-items" id="contact-items"></div>
          </div>

          <button class="fab" id="fab-new-chat" title="New message">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>

          <div id="fab-call-anchor" style="position:absolute; bottom:calc(18px + var(--safe-area-inset-bottom, 0px)); right:16px; z-index:10">
            <button class="fab fab-call" id="fab-call" title="Call" style="position:static">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </button>
          </div>

          <div class="call-history-dropdown" id="call-history-dropdown">
            <div class="ch-sheet">
              <div class="ch-header">
                <span id="ch-title">История звонков</span>
                <button class="ch-clear-btn" id="ch-clear-btn">Очистить</button>
              </div>
              <div class="ch-new-input-row">
                <input class="ch-new-input" id="ch-new-number" type="tel" placeholder="+79001234567" />
                <button class="ch-call-btn" id="ch-call-btn" disabled title="Позвонить">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
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
            <button class="chat-profile-avatar" id="chat-profile-avatar" title="${this._t('contact_profile')}">?</button>
            <div class="chat-profile-trigger" id="chat-profile-trigger" title="${this._t('contact_profile')}">
              <div class="chat-title" id="chat-title">Выберите диалог</div>
              <div class="chat-subtitle" id="chat-subtitle"></div>
            </div>
            <button class="icon-btn" id="star-filter-btn" title="${this._t('star')}" style="display:none">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
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
          <div class="send-bar-wrap">
          <div class="send-bar" id="send-bar" style="display:none; flex-wrap:wrap">
            <div class="char-counter" id="char-counter" style="width:100%; display:none"></div>
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
      </div>
    `;

    this.shadowRoot.getElementById("refresh-btn").addEventListener("click", () => {
      this._pollNow();
    });

    this.shadowRoot.getElementById("modem-btn").addEventListener("click", () => {
      this._activeTab = this._activeTab === "status" ? "chats" : "status";
      const btn = this.shadowRoot.getElementById("modem-btn");
      btn.style.color = this._activeTab === "status" ? "var(--accent)" : "";
      // Сбрасываем подсветку phonebook при переходе на статус
      this.shadowRoot.getElementById("phonebook-btn").style.color = "";
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
    this.shadowRoot.getElementById("contact-modal-overlay").addEventListener("click", (e) => {
      if (e.target === this.shadowRoot.getElementById("contact-modal-overlay")) {
        this._closeContactModal();
      }
    });
    this.shadowRoot.getElementById("chat-profile-trigger").addEventListener("click", () => {
      if (this._activeNumber) this._openContactProfile(this._activeNumber);
    });
    this.shadowRoot.getElementById("chat-profile-avatar").addEventListener("click", () => {
      if (this._activeNumber) this._openContactProfile(this._activeNumber);
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
      if (!e.target.closest(".ch-sheet")) this._closeCallHistory();
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
      // Сохраняем черновик на лету
      if (this._activeNumber) this._saveDraft(this._activeNumber, ta.value);
      const btn = this.shadowRoot.getElementById("send-btn");
      if (btn) btn.disabled = !this._sendText.trim() || this._sending;
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
      // Счётчик символов — GSM лимиты
      const counter = this.shadowRoot.getElementById("char-counter");
      if (counter) {
        const len = ta.value.length;
        if (len === 0) {
          counter.style.display = "none";
        } else {
          // Определяем кириллица или нет (кириллица = 70 символов на часть)
          const hasCyrillic = /[а-яёА-ЯЁ]/.test(ta.value);
          const partSize = hasCyrillic ? 67 : 153; // multipart лимиты
          const singleSize = hasCyrillic ? 70 : 160;
          const isMulti = len > singleSize;
          const parts = isMulti ? Math.ceil(len / partSize) : 1;
          const limit = isMulti ? parts * partSize : singleSize;
          const left = limit - len;
          counter.style.display = "";
          counter.textContent = isMulti
            ? `${len} / ${limit} · ${parts} SMS`
            : `${left}`;
          counter.className = "char-counter" + (left < 10 ? " over" : left < 30 ? " warn" : "");
        }
      }
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


    this._initPbSheet();

    this._starFilterActive = false;
    this.shadowRoot.getElementById("star-filter-btn")?.addEventListener("click", () => {
      this._starFilterActive = !this._starFilterActive;
      const btn = this.shadowRoot.getElementById("star-filter-btn");
      if (btn) {
        btn.style.color = this._starFilterActive ? "var(--accent)" : "";
        btn.querySelector("svg").setAttribute("fill", this._starFilterActive ? "currentColor" : "none");
      }
      this._renderMessages();
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
    const _srch = this.shadowRoot?.getElementById("search");
    if (_srch) _srch.placeholder = this._t("search");
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
      const _sp = this._statusLoading ? '<span class="status-refresh-spin"></span>' : "";
      bar.innerHTML = `<span class="signal-dot bad"></span><span>${this._t("no_modem")}</span>${_sp}`;
      return;
    }
    const pct = s.signal?.SignalPercent ?? "?";
    const net = s.network?.NetworkName ?? "";
    const interval = this._pollInterval;
    const dotClass = pct >= 50 ? "" : pct >= 20 ? "mid" : "bad";
    const _spin = this._statusLoading ? '<span class="status-refresh-spin"></span>' : "";
    bar.innerHTML = `
      <span class="signal-dot ${dotClass}"></span>
      <span>${net ? net + " · " : ""}${pct}% · ${this._t("poll_every", interval)}</span>
      ${_spin}
    `;
  }

  _renderContacts(skipFolders = false) {
    const scrollList = this.shadowRoot.getElementById("contact-list");
    const list = this.shadowRoot.getElementById("contact-items");
    if (!scrollList || !list) return;
    const brandLoading = !this._status || (this._status.use_brand_logos && !this._brandReady);
    scrollList.classList.toggle("brand-loading", brandLoading);
    if (brandLoading) return;
    if (!skipFolders) this._renderFolders();

    // Локальная сортировка: закреплённые вверху
    this._contacts.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) || new Date(b.last_activity) - new Date(a.last_activity));

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

    const svgCheck = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const svgPin   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>';
    const svgMute  = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8a6 6 0 0 0-9.33-5"/><path d="m10 10-1.33 1.33A6 6 0 0 0 6 14v2m14-6v2a6 6 0 0 1-.67 2.74"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
    const svgDel   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';

    list.innerHTML = items.map((c) => `
      <div class="swipe-wrap" data-number="${this._esc(c.number)}">
        <div class="swipe-actions-left">
          <button class="swipe-btn read" data-action="read" data-number="${this._esc(c.number)}">${svgCheck}<span>${this._t("mark_read")}</span></button>
          <button class="swipe-btn pin" data-action="pin" data-number="${this._esc(c.number)}" data-pinned="${c.is_pinned ? '1' : '0'}">${svgPin}<span>${c.is_pinned ? this._t("unpin") : this._t("pin")}</span></button>
        </div>
        <div class="swipe-actions-right">
          <button class="swipe-btn mute" data-action="mute" data-number="${this._esc(c.number)}">${svgMute}<span>${c.is_muted ? this._t("unmute_chat") : this._t("mute_chat")}</span></button>
          <button class="swipe-btn swipe-del" data-action="delete" data-number="${this._esc(c.number)}">${svgDel}<span>${this._t("delete_msg")}</span></button>
        </div>
        <div class="swipe-inner contact-item ${c.unread > 0 ? "has-unread has-unread-wrap" : ""} ${
          c.number === this._activeNumber ? "active" : ""
        } ${c.is_pinned ? "pinned-active" : ""}">
          ${this._chatAvatarMarkup(c)}
          <div class="contact-info">
            <div class="contact-row1">
              <span class="contact-number">${c.is_muted ? "🔇 " : ""}${this._esc(c.contact_name || c.number)}</span>
              <span class="contact-date">${this._formatShort(c.last_date)}</span>
              ${c.is_pinned ? '<span class="pin-static-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 12V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v8l-2 2v2h5v5l1 1 1-1v-5h5v-2l-2-2z"/></svg></span>' : ''}
              <button class="pin-hover-btn" data-action="pin-hover" data-number="${this._esc(c.number)}" data-pinned="${c.is_pinned ? '1' : '0'}" title="${c.is_pinned ? this._t('unpin') : this._t('pin')}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="${c.is_pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 12V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v8l-2 2v2h5v5l1 1 1-1v-5h5v-2l-2-2z"/></svg>
              </button>
            </div>
            <div class="contact-preview">
              ${this._drafts[c.number]
                ? '<span style="color:var(--accent);font-weight:500">' + this._t("draft") + ':</span> ' + this._esc(this._drafts[c.number].slice(0, 50))
                : this._esc((c.last_text || "").slice(0, 60))}
            </div>
          </div>
          ${c.unread > 0 ? `<span class="contact-unread-cnt">${c.unread}</span>` : ""}
        </div>
      </div>
    `).join("");

    // Восстанавливаем открытые свайпы после перерендера
    const prevSnap = new Map();
    if (this._swipeState) {
      this._swipeState.forEach((val, wrap) => {
        if (val !== 0) {
          const num = wrap.dataset?.number;
          if (num) prevSnap.set(num, val);
        }
      });
    }
    this._initSwipe(list);
    // Показываем кнопки пина для закреплённых чатов напрямую через JS
    list.querySelectorAll(".swipe-inner.pinned-active .pin-hover-btn").forEach(btn => {
      btn.style.opacity = "1";
      btn.style.color = "var(--accent)";
    });
    if (prevSnap.size) {
      list.querySelectorAll(".swipe-wrap").forEach(wrap => {
        const snap = prevSnap.get(wrap.dataset.number);
        if (snap) {
          const inner = wrap.querySelector(".swipe-inner");
          if (inner) {
            inner.style.transform = `translateX(${snap}px)`;
            const actL = wrap.querySelector(".swipe-actions-left");
            const actR = wrap.querySelector(".swipe-actions-right");
            if (actL) actL.style.opacity = snap > 0 ? "1" : "0";
            if (actR) actR.style.opacity = snap < 0 ? "1" : "0";
          }
          this._swipeState.set(wrap, snap);
        }
      });
    }

    list.querySelectorAll(".swipe-inner").forEach((el) => {
      const pinBtn = el.querySelector(".pin-hover-btn");
      if (pinBtn && !el.classList.contains("pinned-active")) {
        el.addEventListener("mouseenter", () => { pinBtn.style.opacity = "0.4"; });
        el.addEventListener("mouseleave", () => { pinBtn.style.opacity = "0"; });
      }
    });

    list.querySelectorAll(".swipe-inner").forEach((el) => {
      let longPressTimer = null;
      let pressX = 0;
      let pressY = 0;
      const cancelLongPress = () => {
        if (longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = null;
        el.classList.remove("long-press-pending");
      };
      el.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" || event.button !== 0) return;
        pressX = event.clientX; pressY = event.clientY;
        el.classList.add("long-press-pending");
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          // Remove a range that a mobile browser may have created just before
          // the timer fired.  The menu itself remains fully interactive.
          window.getSelection?.()?.removeAllRanges?.();
          this._suppressNextChatClick = true;
          clearTimeout(this._suppressNextChatClickTimer);
          this._suppressNextChatClickTimer = setTimeout(() => { this._suppressNextChatClick = false; }, 1000);
          navigator.vibrate?.(18);
          this._showChatFolderMenu(event, el.closest(".swipe-wrap")?.dataset.number);
        }, 550);
      }, { passive: true });
      el.addEventListener("pointermove", (event) => {
        if (Math.hypot(event.clientX - pressX, event.clientY - pressY) > 10) cancelLongPress();
      }, { passive: true });
      ["pointerup", "pointercancel", "pointerleave"].forEach((name) => el.addEventListener(name, cancelLongPress, { passive: true }));
      el.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        window.getSelection?.()?.removeAllRanges?.();
        el.classList.remove("long-press-pending");
        this._suppressNextChatClick = true;
        clearTimeout(this._suppressNextChatClickTimer);
        this._suppressNextChatClickTimer = setTimeout(() => { this._suppressNextChatClick = false; }, 1000);
        this._showChatFolderMenu(event, el.closest(".swipe-wrap")?.dataset.number);
      });
      el.addEventListener("click", (e) => {
        if (e.target.closest(".swipe-btn")) return;
        if (this._suppressNextChatClick) { this._suppressNextChatClick = false; return; }
        const wrap = el.closest(".swipe-wrap");
        const snapVal = this._swipeState?.get(wrap) || 0;
        if (snapVal !== 0) {
          // Свайп открыт — закрываем по клику
          this._swipeClose(wrap);
          return;
        }
        this._selectContact(wrap.dataset.number);
      });
    });

    list.querySelectorAll(".pin-hover-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const number = btn.dataset.number;
        const isPinned = btn.dataset.pinned === "1";
        const endpoint = isPinned ? `unpin/${encodeURIComponent(number)}` : `pin/${encodeURIComponent(number)}`;
        const c = this._contacts.find(x => x.number === number);
        if (c) c.is_pinned = !isPinned;
        this._renderContacts();
        this._api(endpoint, "POST").catch(() => {
          if (c) c.is_pinned = isPinned;
          this._renderContacts();
        });
      });
    });

    list.querySelectorAll(".swipe-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const number = btn.dataset.number;
        const action = btn.dataset.action;
        const wrap = btn.closest(".swipe-wrap");
        if (wrap) this._swipeClose(wrap);
        if (action === "read") {
          await this._api(`mark_read/${encodeURIComponent(number)}`, "POST").catch(() => {});
          // Обновляем локально
          const c = this._contacts.find(x => x.number === number);
          if (c) c.unread = 0;
          this._renderContacts();
        } else if (action === "mute") {
          const c = this._contacts.find(x => x.number === number);
          const isMuted = c?.is_muted || false;
          const endpoint = isMuted ? `unmute/${encodeURIComponent(number)}` : `mute/${encodeURIComponent(number)}`;
          if (c) c.is_muted = !isMuted;
          this._renderContacts();
          this._api(endpoint, "POST").catch(() => {
            if (c) c.is_muted = isMuted;
            this._renderContacts();
          });
        } else if (action === "delete") {
          if (confirm(this._t("delete_msg") + "?")) {
            await this._api(`delete_contact/${encodeURIComponent(number)}`, "POST").catch(() => {});
            this._renderContacts();
          }
        } else if (action === "pin") {
          const c = this._contacts.find(x => x.number === number);
          const isPinned = btn.dataset.pinned === "1";
          const endpoint = isPinned ? `unpin/${encodeURIComponent(number)}` : `pin/${encodeURIComponent(number)}`;
          // Optimistic update — сначала UI, потом API
          if (c) c.is_pinned = !isPinned;
          this._renderContacts();
          this._api(endpoint, "POST").catch(() => {
            // Откат если ошибка
            if (c) c.is_pinned = isPinned;
            this._renderContacts();
          });
        }
      });
    });
  }

  _renderFolders() {
    const host = this.shadowRoot.getElementById("folder-tabs");
    if (!host) return;
    const previousScroller = host.querySelector(".folder-tab-scroll");
    const scrollLeft = previousScroller ? previousScroller.scrollLeft : this._folderScrollLeft;
    const tabs = this._folderTabDefinitions();
    if (!tabs.some((item) => item.id === this._activeFolderId)) this._activeFolderId = tabs[0]?.id || "all";
    host.innerHTML = `<div class="folder-tab-shell"><div class="folder-tab-scroll">${tabs.map((folder) => `
      <button class="folder-tab ${this._activeFolderId === folder.id ? "active" : ""}" data-folder-id="${this._esc(folder.id)}">
        ${folder.icon ? this._esc(folder.icon) + " " : ""}${this._esc(folder.name)}
      </button>`).join("")}<button class="folder-tab add" id="folder-add" title="${this._esc(this._t("new_folder"))}">＋</button></div><div class="folder-tab-actions"><button class="folder-tab add" id="folder-settings" title="${this._esc(this._t("folder_settings"))}">⚙</button></div></div>`;
    const newScroller = host.querySelector(".folder-tab-scroll");
    if (newScroller) {
      newScroller.scrollLeft = scrollLeft;
      this._folderScrollLeft = scrollLeft;
    }
    host.style.removeProperty("top");
    host.querySelectorAll("[data-folder-id]").forEach((button) => button.addEventListener("click", () => {
      const previous = host.querySelector(".folder-tab.active");
      previous?.classList.remove("active");
      button.classList.add("active");
      this._activeFolderId = button.dataset.folderId;
      this._renderContacts(true);
    }));
    const folderScroller = host.querySelector(".folder-tab-scroll");
    folderScroller?.addEventListener("wheel", (event) => {
      if (!folderScroller || folderScroller.scrollWidth <= folderScroller.clientWidth) return;
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (!delta) return;
      event.preventDefault();
      folderScroller.scrollLeft += delta;
      this._folderScrollLeft = folderScroller.scrollLeft;
    }, { passive: false });
    folderScroller?.addEventListener("scroll", () => {
      this._folderScrollLeft = folderScroller.scrollLeft;
    }, { passive: true });
    host.querySelector("#folder-add")?.addEventListener("click", () => this._openFolderEditor());
    host.querySelector("#folder-settings")?.addEventListener("click", () => this._openFolderSettings());
    host.querySelectorAll("[data-folder-id]:not([data-folder-id=all])").forEach((button) => {
      button.addEventListener("dblclick", () => {
        const folder = this._chatFolders.find((item) => item.id === button.dataset.folderId);
        if (folder) this._openFolderEditor(folder);
        else if (button.dataset.folderId === "brands") this._openBrandsEditor();
      });
    });
  }

  _folderTabDefinitions() {
    const tabs = [];
    if (this._folderOptions.show_all !== false) tabs.push({ id: "all", name: this._t("all_chats"), icon: "", system: true });
    if (this._folderOptions.people_enabled) {
      tabs.push({ id: "people", name: this._t("people_folder"), icon: "👤", system: true });
    }
    if (this._folderOptions.brands_enabled) {
      tabs.push({ id: "brands", name: this._t("brands_folder"), icon: "🏷️", system: true });
    }
    tabs.push(...this._chatFolders.map((folder) => ({ ...folder, system: false })));
    const byId = new Map(tabs.map((folder) => [folder.id, folder]));
    const ordered = [];
    for (const id of (Array.isArray(this._folderOptions.folder_order) ? this._folderOptions.folder_order : [])) {
      if (byId.has(id)) { ordered.push(byId.get(id)); byId.delete(id); }
    }
    return [...ordered, ...byId.values()];
  }

  _openFolderSettings() {
    const overlay = this.shadowRoot.getElementById("contact-modal-overlay");
    const modal = this.shadowRoot.getElementById("contact-modal");
    if (!overlay || !modal) return;
    modal.innerHTML = `<div class="contact-form" style="padding:20px">
      <div class="contact-form-header"><h2>${this._esc(this._t("folder_settings"))}</h2></div>
      <label class="folder-editor-chat"><input type="checkbox" id="folder-show-all" ${this._folderOptions.show_all !== false ? "checked" : ""}/> ${this._esc(this._t("show_all_chats"))}</label>
      <label class="folder-editor-chat"><input type="checkbox" id="folder-people-enabled" ${this._folderOptions.people_enabled ? "checked" : ""}/> ${this._esc(this._t("enable_people_folder"))}</label>
      <label class="folder-editor-chat"><input type="checkbox" id="folder-brands-enabled" ${this._folderOptions.brands_enabled ? "checked" : ""}/> ${this._esc(this._t("enable_brands_folder"))}</label>
      <button id="folder-manage-brands" ${this._folderOptions.brands_enabled ? "" : "disabled"}>${this._esc(this._t("manage_brands_folder"))}</button>
      <h3>${this._esc(this._t("custom_folders"))}</h3>
      <div class="folder-settings-list">${this._folderTabDefinitions().length ? this._folderTabDefinitions().map((folder, index, all) => `<div class="folder-settings-row"><span>${folder.icon ? this._esc(folder.icon) + " " : ""}${this._esc(folder.name)}</span><span><button data-move-folder-up="${this._esc(folder.id)}" ${index === 0 ? "disabled" : ""} aria-label="${this._esc(this._t("move_folder_up"))}">↑</button><button data-move-folder-down="${this._esc(folder.id)}" ${index === all.length - 1 ? "disabled" : ""} aria-label="${this._esc(this._t("move_folder_down"))}">↓</button>${folder.system ? "" : `<button data-edit-folder="${this._esc(folder.id)}">${this._esc(this._t("edit_folder"))}</button><button data-delete-folder="${this._esc(folder.id)}">${this._esc(this._t("delete_folder"))}</button>`}</span></div>`).join("") : `<p class="form-help">${this._esc(this._t("no_custom_folders"))}</p>`}</div>
      <button id="folder-create">＋ ${this._esc(this._t("new_folder"))}</button>
      <div class="contact-form-actions"><button id="folder-settings-cancel">${this._esc(this._t("cancel"))}</button><button class="primary" id="folder-settings-save">${this._esc(this._t("save"))}</button></div>
    </div>`;
    overlay.classList.add("open");
    const close = () => overlay.classList.remove("open");
    modal.querySelector("#folder-settings-close")?.addEventListener("click", close);
    modal.querySelector("#folder-settings-cancel")?.addEventListener("click", close);
    modal.querySelector("#folder-create")?.addEventListener("click", () => {
      close();
      this._openFolderEditor();
    });
    const moveFolder = async (folderId, direction) => {
      const currentTabs = this._folderTabDefinitions();
      const index = currentTabs.findIndex((item) => item.id === folderId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= currentTabs.length) return;
      const order = currentTabs.map((item) => item.id);
      [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
      const options = { ...this._folderOptions, folder_order: order };
      await this._api("save_chat_folder_options", "POST", options);
      this._folderOptions = options;
      close();
      this._renderContacts();
    };
    modal.querySelectorAll("[data-move-folder-up]").forEach((button) => button.addEventListener("click", () => moveFolder(button.dataset.moveFolderUp, -1)));
    modal.querySelectorAll("[data-move-folder-down]").forEach((button) => button.addEventListener("click", () => moveFolder(button.dataset.moveFolderDown, 1)));
    modal.querySelectorAll("[data-edit-folder]").forEach((button) => button.addEventListener("click", () => {
      const folder = this._chatFolders.find((item) => item.id === button.dataset.editFolder);
      if (!folder) return;
      close();
      this._openFolderEditor(folder);
    }));
    modal.querySelectorAll("[data-delete-folder]").forEach((button) => button.addEventListener("click", async () => {
      const folder = this._chatFolders.find((item) => item.id === button.dataset.deleteFolder);
      if (!folder || !window.confirm(this._t("delete_folder_confirm"))) return;
      const folders = this._chatFolders.filter((item) => item.id !== folder.id);
      await this._api("save_chat_folders", "POST", { folders });
      this._chatFolders = folders;
      if (this._activeFolderId === folder.id) this._activeFolderId = this._folderTabDefinitions()[0]?.id || "all";
      close();
      this._renderContacts();
    }));
    modal.querySelector("#folder-brands-enabled")?.addEventListener("change", (event) => {
      const button = modal.querySelector("#folder-manage-brands");
      if (button) button.disabled = !event.target.checked;
    });
    modal.querySelector("#folder-manage-brands")?.addEventListener("click", async () => {
      const options = { ...this._folderOptions,
        show_all: modal.querySelector("#folder-show-all")?.checked !== false,
        people_enabled: modal.querySelector("#folder-people-enabled")?.checked === true,
        brands_enabled: modal.querySelector("#folder-brands-enabled")?.checked === true,
      };
      await this._api("save_chat_folder_options", "POST", options);
      this._folderOptions = options;
      close();
      this._openBrandsEditor();
    });
    modal.querySelector("#folder-settings-save")?.addEventListener("click", async () => {
      const options = { ...this._folderOptions,
        show_all: modal.querySelector("#folder-show-all")?.checked !== false,
        people_enabled: modal.querySelector("#folder-people-enabled")?.checked === true,
        brands_enabled: modal.querySelector("#folder-brands-enabled")?.checked === true,
      };
      await this._api("save_chat_folder_options", "POST", options);
      this._folderOptions = options;
      close(); this._renderContacts();
    });
  }

  _openBrandsEditor() {
    const overlay = this.shadowRoot.getElementById("contact-modal-overlay");
    const modal = this.shadowRoot.getElementById("contact-modal");
    if (!overlay || !modal) return;
    const manual = new Set(this._folderOptions.brands_manual || []);
    const excluded = new Set(this._folderOptions.brands_excluded || []);
    modal.innerHTML = `<div class="contact-form" style="padding:20px">
      <div class="contact-form-header"><h2>🏷️ ${this._esc(this._t("brands_folder"))}</h2></div>
      <p class="form-help">${this._esc(this._t("brands_folder_help"))}</p>
      <div class="folder-editor-list">${this._contacts.map((chat) => { const checked = !excluded.has(chat.number) && (manual.has(chat.number) || this._isBrandChat(chat)); return `<label class="folder-editor-chat"><input type="checkbox" data-brand-number="${this._esc(chat.number)}" ${checked ? "checked" : ""}/><span>${this._esc(chat.contact_name || chat.number)}</span></label>`; }).join("")}</div>
      <div class="contact-form-actions"><button id="brands-cancel">${this._esc(this._t("cancel"))}</button><button class="primary" id="brands-save">${this._esc(this._t("save"))}</button></div>
    </div>`;
    overlay.classList.add("open");
    const close = () => overlay.classList.remove("open");
    modal.querySelector("#brands-close")?.addEventListener("click", close);
    modal.querySelector("#brands-cancel")?.addEventListener("click", close);
    modal.querySelector("#brands-save")?.addEventListener("click", async () => {
      const selected = new Set([...modal.querySelectorAll("[data-brand-number]:checked")].map((el) => el.dataset.brandNumber));
      const auto = new Set(this._contacts.filter((chat) => this._isBrandChat(chat)).map((chat) => chat.number));
      const options = { ...this._folderOptions,
        brands_manual: [...selected].filter((number) => !auto.has(number)),
        brands_excluded: [...auto].filter((number) => !selected.has(number)),
      };
      await this._api("save_chat_folder_options", "POST", options);
      this._folderOptions = options; close(); this._renderContacts();
    });
  }

  _showChatFolderMenu(event, number) {
    if (!number) return;
    this.shadowRoot.querySelector(".chat-folder-menu")?.remove();
    const contact = this._contacts.find((item) => item.number === number);
    if (!contact) return;
    const folders = this._folderTabDefinitions().filter((folder) => folder.id !== "all");
    const brandSelected = this._isInBrandsFolder(contact);
    const rows = folders.map((folder) => {
      const isPeople = folder.id === "people";
      const isBrands = folder.id === "brands";
      const custom = !isPeople && !isBrands ? this._chatFolders.find((item) => item.id === folder.id) : null;
      const checked = isBrands ? brandSelected : Boolean(custom?.numbers?.includes(number));
      return `<label class="chat-folder-menu-row"${isPeople ? ` title="${this._esc(this._t("folder_auto"))}"` : ""}><input type="checkbox" data-menu-folder="${this._esc(folder.id)}" ${checked ? "checked" : ""} ${isPeople ? "disabled" : ""}/><span>${folder.icon ? this._esc(folder.icon) + " " : ""}${this._esc(folder.name)}</span></label>`;
    }).join("");
    const menu = document.createElement("div");
    menu.className = "chat-folder-menu";
    menu.innerHTML = `<div class="chat-folder-menu-title">${this._esc(this._t("add_to_folder"))}: ${this._esc(contact.contact_name || number)}</div>${rows || `<div class="form-help">${this._esc(this._t("no_custom_folders"))}</div>`}<button class="chat-folder-menu-row chat-folder-menu-new" id="chat-folder-create">＋ ${this._esc(this._t("new_folder_with_contact"))}</button>`;
    this.shadowRoot.appendChild(menu);
    const point = event?.clientX != null ? { x: event.clientX, y: event.clientY } : { x: 20, y: 80 };
    const margin = 8;
    menu.style.left = `${Math.max(margin, Math.min(point.x, window.innerWidth - menu.offsetWidth - margin))}px`;
    menu.style.top = `${Math.max(margin, Math.min(point.y, window.innerHeight - menu.offsetHeight - margin))}px`;
    let closed = false;
    const onOutside = (pointerEvent) => { if (!menu.contains(pointerEvent.target)) close(); };
    const close = () => {
      if (closed) return;
      closed = true;
      menu.remove();
      this.shadowRoot.removeEventListener("pointerdown", onOutside);
    };
    setTimeout(() => this.shadowRoot.addEventListener("pointerdown", onOutside), 0);
    menu.querySelector("#chat-folder-create")?.addEventListener("click", () => { close(); this._openFolderEditor(null, number); });
    menu.querySelectorAll("[data-menu-folder]").forEach((input) => input.addEventListener("change", async () => {
      const folderId = input.dataset.menuFolder;
      if (folderId === "people") return;
      if (folderId === "brands") {
        const manual = new Set(this._folderOptions.brands_manual || []);
        const excluded = new Set(this._folderOptions.brands_excluded || []);
        if (input.checked) {
          if (this._isBrandChat(contact)) excluded.delete(number); else manual.add(number);
        } else if (this._isBrandChat(contact)) {
          excluded.add(number);
        } else {
          manual.delete(number);
        }
        this._folderOptions = { ...this._folderOptions, brands_manual: [...manual], brands_excluded: [...excluded] };
        await this._api("save_chat_folder_options", "POST", this._folderOptions);
      } else {
        const folder = this._chatFolders.find((item) => item.id === folderId);
        if (!folder) return;
        const numbers = new Set(folder.numbers || []);
        if (input.checked) numbers.add(number); else numbers.delete(number);
        const foldersNext = this._chatFolders.map((item) => item.id === folderId ? { ...item, numbers: [...numbers] } : item);
        await this._api("save_chat_folders", "POST", { folders: foldersNext });
        this._chatFolders = foldersNext;
      }
      this._renderContacts();
    }));
  }

  _openFolderEditor(folder = null, preselectedNumber = null) {
    const overlay = this.shadowRoot.getElementById("contact-modal-overlay");
    const modal = this.shadowRoot.getElementById("contact-modal");
    if (!overlay || !modal) return;
    const current = folder || { id: `folder-${Date.now()}`, name: "", icon: "", numbers: [] };
    const selected = new Set(current.numbers || []);
    if (preselectedNumber) selected.add(preselectedNumber);
    modal.innerHTML = `<div class="contact-form" style="padding:20px">
      <div class="contact-form-header"><h2>${this._esc(folder ? this._t("edit_folder") : this._t("new_folder"))}</h2></div>
      <label class="folder-edit-field">${this._esc(this._t("folder_name"))}<input id="folder-name" maxlength="80" value="${this._esc(current.name)}" /></label>
      <label class="folder-edit-field">${this._esc(this._t("folder_icon"))}<input id="folder-icon" maxlength="8" placeholder="📁" value="${this._esc(current.icon || "")}" /></label>
      <div class="folder-editor-list">${this._contacts.map((chat) => `<label class="folder-editor-chat"><input type="checkbox" data-folder-number="${this._esc(chat.number)}" ${selected.has(chat.number) ? "checked" : ""}/><span>${this._esc(chat.contact_name || chat.number)}</span></label>`).join("")}</div>
      <div class="contact-form-actions"><button id="folder-cancel">${this._esc(this._t("cancel"))}</button><button class="primary" id="folder-save">${this._esc(this._t("save"))}</button></div>
    </div>`;
    overlay.classList.add("open");
    const close = () => overlay.classList.remove("open");
    modal.querySelector("#folder-close")?.addEventListener("click", close);
    modal.querySelector("#folder-cancel")?.addEventListener("click", close);
    modal.querySelector("#folder-save")?.addEventListener("click", async () => {
      const name = modal.querySelector("#folder-name")?.value.trim();
      if (!name) return;
      const numbers = [...modal.querySelectorAll("[data-folder-number]:checked")].map((el) => el.dataset.folderNumber);
      const next = { id: current.id, name, icon: modal.querySelector("#folder-icon")?.value.trim() || "", numbers };
      const folders = folder ? this._chatFolders.map((item) => item.id === folder.id ? next : item) : [...this._chatFolders, next];
      await this._api("save_chat_folders", "POST", { folders });
      this._chatFolders = folders;
      this._activeFolderId = next.id;
      close(); this._renderContacts();
    });
  }

  _swipeClose(wrap, animate = true) {
    const inner = wrap.querySelector(".swipe-inner");
    if (!inner) return;
    inner.classList.toggle("snapping", animate);
    inner.style.transform = "translateX(0)";
    if (this._swipeState) this._swipeState.set(wrap, 0);
    if (animate) setTimeout(() => inner.classList.remove("snapping"), 260);
  }

  _initSwipe(list) {
    const W = 160;
    const EDGE = 44;
    const wraps = [...list.querySelectorAll(".swipe-wrap")];
    this._swipeState = new Map();
    wraps.forEach(wrap => this._swipeState.set(wrap, 0));

    const closeAll = (except) => wraps.forEach(w => { if (w !== except) this._swipeClose(w); });

    wraps.forEach(wrap => {
      const inner = wrap.querySelector(".swipe-inner");
      let startX = 0, curX = 0, dragging = false, allowed = false, moved = false;

      const getRelX = cx => cx - wrap.getBoundingClientRect().left;
      const actLeft = wrap.querySelector(".swipe-actions-left");
      const actRight = wrap.querySelector(".swipe-actions-right");
      const setPos = (x, animate) => {
        inner.classList.toggle("snapping", animate);
        inner.style.transform = `translateX(${x}px)`;
        inner.classList.toggle("is-swiping", x !== 0);
        if (actLeft) actLeft.style.opacity = x > 0 ? "1" : "0";
        if (actRight) actRight.style.opacity = x < 0 ? "1" : "0";
        this._swipeState.set(wrap, x);
        if (animate) setTimeout(() => inner.classList.remove("snapping"), 260);
      };

      const onStart = cx => {
        const relX = getRelX(cx);
        const current = this._swipeState.get(wrap) || 0;
        startX = cx; curX = current; moved = false; dragging = true;
        allowed = current !== 0 || relX <= EDGE || relX >= wrap.getBoundingClientRect().width - EDGE;
      };
      const onMove = cx => {
        if (!dragging || !allowed) return;
        const delta = cx - startX;
        curX = Math.max(-W, Math.min(W, (this._swipeState.get(wrap) || 0) + delta));
        moved = Math.abs(delta) > 5;
        inner.style.transition = "";
        inner.style.transform = `translateX(${curX}px)`;
        if (actLeft) actLeft.style.opacity = curX > 0 ? "1" : "0";
        if (actRight) actRight.style.opacity = curX < 0 ? "1" : "0";
      };
      const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        if (!moved) {
          if ((this._swipeState.get(wrap) || 0) !== 0) { setPos(0, true); return; }
          return;
        }
        if (!allowed) return;
        const snap = Math.abs(curX) > W / 2 ? (curX > 0 ? W : -W) : 0;
        closeAll(wrap);
        setPos(snap, true);
      };

      // Свайп только на тач-устройствах
      inner.addEventListener("touchstart", e => onStart(e.touches[0].clientX), {passive: true});
      inner.addEventListener("touchmove", e => { if (dragging) onMove(e.touches[0].clientX); }, {passive: true});
      inner.addEventListener("touchend", onEnd);
    });
  }

  _showMsgCtxMenu(e, bubble) {
    try {
      document.querySelector(".msg-ctx-menu")?.remove();
      if (!bubble) { console.error("no bubble"); return; }
      const msgId = parseInt(bubble.dataset.id);
      const isStarred = bubble.dataset.starred === "1";
      const isOut = bubble.classList.contains("outgoing");
      const text = bubble.querySelector(".msg-text")?.textContent || "";

      const menu = document.createElement("div");
      menu.className = "msg-ctx-menu";
      menu.style.cssText = `
        position:fixed; z-index:9999;
        background:#222; border:1px solid #444; border-radius:12px;
        overflow:hidden; min-width:180px;
        box-shadow:0 8px 32px rgba(0,0,0,.5);
      `;
      menu.innerHTML = `
        <div class="msg-ctx-item" data-action="copy" style="display:flex;align-items:center;gap:10px;padding:12px 16px;font-size:14px;color:#fff;cursor:pointer">📋 ${this._t("copy")}</div>
        <div class="msg-ctx-item" data-action="star" style="display:flex;align-items:center;gap:10px;padding:12px 16px;font-size:14px;color:#fff;cursor:pointer">${isStarred ? "★" : "☆"} ${isStarred ? this._t("unstar") : this._t("star")}</div>
        <div class="msg-ctx-item" data-action="delete" style="display:flex;align-items:center;gap:10px;padding:12px 16px;font-size:14px;color:#e53935;cursor:pointer">🗑 ${this._t("delete_msg")}</div>
      `;

      const rect = bubble.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      document.body.appendChild(menu);
      const mw = menu.offsetWidth, mh = menu.offsetHeight;

      // Чужие — меню справа от пузырька, свои — меню слева от пузырька
      let x = isOut ? rect.left - mw + 20 : rect.right - 20;
      let y = rect.bottom - 10;
      if (x < 4) x = 4;
      if (x + mw > vw - 4) x = vw - mw - 4;
      if (y + mh > vh - 4) y = rect.top - mh + (mh * 0.25);
      menu.style.left = x + "px";
      menu.style.top = y + "px";

      menu.querySelectorAll(".msg-ctx-item").forEach(item => {
        item.addEventListener("click", async () => {
          menu.remove();
          const action = item.dataset.action;
          if (action === "copy") {
            try {
              if (navigator.clipboard && location.protocol === "https:") {
                await navigator.clipboard.writeText(text);
              } else {
                // fallback для http
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.style.cssText = "position:fixed;top:-999px;left:-999px";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                ta.remove();
              }
              this._showToast(this._t("copied"));
            } catch(err) {
              this._showToast(this._t("copy_failed"));
            }
          } else if (action === "star") {
            const ep = isStarred ? `unstar/${msgId}` : `star/${msgId}`;
            await this._api(ep, "POST").catch(() => {});
            const newStarred = !isStarred;
            bubble.dataset.starred = newStarred ? "1" : "0";
            // Обновляем локально в this._messages
            const msg = this._messages.find(m => m.id === msgId);
            if (msg) msg.is_starred = newStarred ? 1 : 0;
            // Обновляем звёздочку визуально
            const meta = bubble.querySelector(".msg-meta");
            meta?.querySelector(".star-icon")?.remove();
            if (newStarred && meta) {
              const s = document.createElement("span");
              s.className = "star-icon"; s.style.fontSize = "11px"; s.style.marginRight = "2px";
              s.textContent = "⭐";
              meta.insertBefore(s, meta.firstChild);
            }
            // Перерендерим всегда чтобы звёздочка в шаблоне тоже обновилась
            this._renderMessages();
          } else if (action === "delete") {
            if (!confirm(this._t("delete_msg") + "?")) return;
            await this._api(`delete/${msgId}`, "POST").catch(() => {});
            bubble.closest(".msg-row")?.remove();
          }
        });
      });

      const close = (ev) => {
        if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("pointerdown", close); }
      };
      setTimeout(() => document.addEventListener("pointerdown", close), 300);
    } catch(err) {
      console.error("_showMsgCtxMenu error:", err);
    }
  }


  _renderMessages() {
    // Защита от гонки: пока показан оверлей (статус модема/телефонная
    // книга), эта функция не должна трогать шапку/send-bar вообще —
    // не важно откуда её вызвали (таймер статуса, event-поллинг, прямой
    // вызов). Раньше каждое место вызова проверялось отдельно, и было
    // легко забыть какой-то один — теперь проверка тут, в одном месте.
    if (this._activeTab === "status" || this._activeTab === "phonebook") return;

    const area = this.shadowRoot.getElementById("messages-area");
    const titleEl = this.shadowRoot.getElementById("chat-title");
    const subEl = this.shadowRoot.getElementById("chat-subtitle");
    const delBtn = this.shadowRoot.getElementById("delete-contact-btn");
    const muteBtn = this.shadowRoot.getElementById("mute-contact-btn");
    const callBtn = this.shadowRoot.getElementById("call-contact-btn");
    const profileAvatar = this.shadowRoot.getElementById("chat-profile-avatar");
    if (!area) return;

    const sendBar = this.shadowRoot.getElementById("send-bar");

    if (!this._activeNumber) {
      titleEl && (titleEl.textContent = this._t("select_dialog"));
      subEl && (subEl.textContent = "");
      delBtn && (delBtn.style.display = "none");
      muteBtn && (muteBtn.style.display = "none");
      callBtn && (callBtn.style.display = "none");
      profileAvatar && (profileAvatar.style.display = "none");
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
    this._restoreDraftUI();
    const contact = this._contacts.find((c) => c.number === this._activeNumber);
    const count = contact?.total ?? this._messages.length;
    titleEl && (titleEl.textContent = contact?.contact_name || this._activeNumber);
    subEl && (subEl.textContent = this._t("messages_count", count));
    if (profileAvatar) {
      const avatar = this._avatarFor(contact);
      const brand = avatar ? "" : this._brandLogoFor(contact);
      const brandSrc = this._brandAssetSrc(brand);
      if (brand && !brandSrc) this._ensureBrandAsset(brand);
      profileAvatar.style.display = "flex";
      profileAvatar.innerHTML = avatar
        ? `<img src="${this._esc(avatar)}" alt="" />`
        : brandSrc
          ? `<img src="${this._esc(brandSrc)}" alt="" />`
        : this._esc((contact?.contact_name || this._activeNumber).slice(0, 1).toUpperCase());
    }
    delBtn && (delBtn.style.display = "");
    muteBtn && (muteBtn.style.display = "");
    this._updateMuteBtn(contact?.is_muted || false);
    if (callBtn) {
      callBtn.style.display = this._status?.call_enabled ? "" : "none";
    }
    const starFilterBtn = this.shadowRoot.getElementById("star-filter-btn");
    if (starFilterBtn) starFilterBtn.style.display = "";

    if (this._messages.length === 0) {
      area.innerHTML = `<div class="empty"><p>Нет сообщений</p></div>`;
      return;
    }

    let html = "";
    let lastLabel = "";
    const _msgs = this._starFilterActive ? this._messages.filter(m => m.is_starred) : this._messages;
    for (const m of _msgs) {
      const label = this._fmtDateLabel(m.date);
      if (label !== lastLabel) {
        html += `<div class="date-divider"><span>${this._esc(label)}</span></div>`;
        lastLabel = label;
      }
      const isOut = m.direction === "out";
      html += `
        <div class="msg-bubble ${isOut ? "outgoing" : (!m.is_read ? "unread" : "")}" data-id="${m.id}" data-starred="${m.is_starred ? '1' : '0'}">
          <div class="msg-text">${this._esc(m.text)}</div>
          <div class="msg-meta">
            ${!isOut && !m.is_read ? '<span class="msg-unread-dot"></span>' : ""}
            ${m.is_starred ? '<span style="font-size:11px;margin-right:2px">⭐</span>' : ''}<span class="msg-date">${this._formatFull(m.date)}</span>
            ${isOut ? '<span style="font-size:11px;color:rgba(255,255,255,.7)">✓</span>' : ""}
          </div>
        </div>`;
    }
    area.innerHTML = html;



    area.querySelectorAll(".msg-bubble").forEach((bubble) => {
      let ltimer = null, startX = 0, startY = 0, longPressed = false;

      bubble.addEventListener("pointerdown", (e) => {
        startX = e.clientX; startY = e.clientY; longPressed = false;
        ltimer = setTimeout(() => {
          longPressed = true;
          navigator.vibrate?.(30);
          this._showMsgCtxMenu(e, bubble);
        }, 600);
      });
      bubble.addEventListener("pointermove", (e) => {
        if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) clearTimeout(ltimer);
      });
      bubble.addEventListener("pointerup", () => clearTimeout(ltimer));
      bubble.addEventListener("pointercancel", () => clearTimeout(ltimer));
      bubble.addEventListener("click", async () => {
        if (longPressed) return;
        const text = bubble.querySelector(".msg-text")?.textContent || "";
        try {
          if (navigator.clipboard && location.protocol === "https:") {
            await navigator.clipboard.writeText(text);
          } else {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.cssText = "position:fixed;top:-999px;left:-999px";
            document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
          }
          bubble.classList.add("copied");
          setTimeout(() => bubble.classList.remove("copied"), 800);
          this._showToast(this._t("copied"));
        } catch { this._showToast(this._t("copy_failed")); }
      });
      bubble.addEventListener("contextmenu", (e) => { e.preventDefault(); this._showMsgCtxMenu(e, bubble); });
    });



    // Скроллим вниз при первом открытии чата или если пользователь уже внизу
    const isAtBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
    if (this._firstRender || isAtBottom) {
      area.scrollTop = area.scrollHeight;
      this._firstRender = false;
    }
  }
}

customElements.define("sms-gammu-panel", SmsGammuPanel);







































