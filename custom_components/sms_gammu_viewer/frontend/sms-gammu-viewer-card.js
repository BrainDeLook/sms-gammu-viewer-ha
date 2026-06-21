/**
 * SMS Gammu Viewer Card — компактная карточка для Lovelace дашборда.
 * Показывает последние диалоги с непрочитанными SMS, ведёт в полную панель.
 *
 * Требует установленную интеграцию sms_gammu_viewer:
 * https://github.com/BrainDeLook/sms-gammu-viewer-ha
 */

const CARD_VERSION = "1.1.0";

const AVAILABLE_LOCALES = ["ru", "en"];
const CARD_BASE = new URL(import.meta.url).pathname.replace(/\/sms-gammu-viewer-card\.js$/, "");

async function loadCardLocale(code) {
  const safe = AVAILABLE_LOCALES.includes(code) ? code : "en";
  try {
    const mod = await import(`${CARD_BASE}/locales/${safe}.js`);
    return mod.default;
  } catch {
    const mod = await import(`${CARD_BASE}/locales/en.js`);
    return mod.default;
  }
}

console.info(
  `%c SMS-GAMMU-VIEWER-CARD %c v${CARD_VERSION} `,
  "color: white; background: #03a9f4; font-weight: 700;",
  "color: #03a9f4; background: white; font-weight: 700;"
);

class SmsGammuViewerCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: "SMS",
      max_items: 5,
      show_unread_only: false,
      panel_url: "/sms-viewer",
      ...config,
    };
    this._contacts = [];
    this._error = null;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._initialized = true;
      this._initLocale().then(() => {
        this._render();
        this._load();
        if (!this._editMode) this._startTimer();
      });
    }
  }

  set editMode(value) {
    // HA выставляет это свойство когда карточка рендерится как live-превью
    // внутри редактора настроек дашборда. Пока редактор открыт, останавливаем
    // periodic polling — иначе обновление состояния карточки может сбрасывать
    // фокус формы редактора во время набора текста.
    this._editMode = value;
    if (value) {
      this._stopTimer();
    } else if (this._initialized) {
      this._startTimer();
    }
  }

  get editMode() {
    return this._editMode;
  }

  getCardSize() {
    return 1 + Math.min(this._config.max_items || 5, 5);
  }

  connectedCallback() {
    if (this._hass && !this._initialized) {
      this._initialized = true;
      this._initLocale().then(() => {
        this._render();
        this._load();
        if (!this._editMode) this._startTimer();
      });
    }
  }

  disconnectedCallback() {
    this._stopTimer();
  }

  _startTimer() {
    this._stopTimer();
    if (this._editMode) return;
    this._timer = setInterval(() => this._load(), 15000);
  }

  _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  async _initLocale() {
    let lang = "en";
    try {
      const token = this._hass.auth?.data?.access_token || "";
      const r = await fetch("/api/sms_gammu_viewer/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const status = await r.json();
        if (status.language) lang = status.language;
      }
    } catch (_) {
      lang = this._hass?.language || "en";
    }
    const code = AVAILABLE_LOCALES.includes(lang) ? lang
      : AVAILABLE_LOCALES.includes(lang.split("-")[0]) ? lang.split("-")[0]
      : "en";
    this._locale = await loadCardLocale(code);
  }

  _t(key) {
    return this._locale?.[key] ?? key;
  }

  async _load() {
    if (!this._hass) return;
    try {
      const token = this._hass.auth?.data?.access_token || "";
      const r = await fetch("/api/sms_gammu_viewer/contacts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this._contacts = await r.json();
      this._error = null;
    } catch (e) {
      this._error = e.message;
    }
    this._renderList();
  }

  _esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  _avatar(number) {
    const s = (number || "?").trim();
    const digits = s.replace(/\D/g, "");
    if (digits.length > 0) return digits.slice(-2);
    const letters = s.replace(/[^a-zA-Zа-яёА-ЯЁ]/g, "");
    return letters.slice(0, 2).toUpperCase() || "?";
  }

  _isAlphaTag(number) {
    return number && !/^[+\d\s\-()]+$/.test(number.trim());
  }

  _fmtDate(str) {
    if (!str) return "";
    try {
      const d = new Date(str);
      const now = new Date();
      if (now - d < 86400000)
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (now - d < 604800000)
        return d.toLocaleDateString([], { weekday: "short" });
      return d.toLocaleDateString([], { day: "2-digit", month: "short" });
    } catch {
      return str;
    }
  }

  _openPanel(number) {
    const path = this._config.panel_url || "/sms-viewer";
    if (number) {
      try {
        localStorage.setItem("sms_gammu_active_number", number);
      } catch (_) {}
    }
    const event = new CustomEvent("location-changed", {
      bubbles: true,
      composed: true,
    });
    history.pushState(null, "", path);
    window.dispatchEvent(event);
  }

  _render() {
    this.innerHTML = `
      <style>
        ha-card {
          padding: 0;
          overflow: hidden;
        }
        .sgv-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 16px 8px;
        }
        .sgv-title {
          font-size: 18px;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .sgv-badge {
          background: var(--primary-color, #03a9f4);
          color: #fff;
          border-radius: 12px;
          padding: 2px 9px;
          font-size: 12px;
          font-weight: 600;
        }
        .sgv-list {
          display: flex;
          flex-direction: column;
        }
        .sgv-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          cursor: pointer;
          transition: background 0.15s;
          border-top: 1px solid var(--divider-color, rgba(0,0,0,.08));
        }
        .sgv-item:hover {
          background: var(--secondary-background-color, rgba(0,0,0,.04));
        }
        .sgv-item.unread {
          background: rgba(3, 169, 244, 0.06);
        }
        .sgv-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--primary-color, #03a9f4);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .sgv-avatar.alpha {
          background: var(--secondary-text-color, #78909c);
          font-size: 12px;
        }
        .sgv-info {
          flex: 1;
          min-width: 0;
        }
        .sgv-row1 {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .sgv-number {
          font-size: 13px;
          font-weight: 500;
          color: var(--primary-text-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sgv-date {
          font-size: 11px;
          color: var(--secondary-text-color);
          flex-shrink: 0;
          margin-left: 8px;
        }
        .sgv-preview {
          font-size: 12px;
          color: var(--secondary-text-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sgv-unread-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--primary-color, #03a9f4);
          flex-shrink: 0;
        }
        .sgv-empty {
          padding: 24px 16px;
          text-align: center;
          color: var(--secondary-text-color);
          font-size: 13px;
        }
        .sgv-error {
          margin: 8px 16px;
          padding: 10px 14px;
          background: rgba(229,57,53,.08);
          border-radius: 8px;
          color: #c62828;
          font-size: 12px;
        }
        .sgv-footer {
          padding: 8px 16px;
          text-align: center;
          border-top: 1px solid var(--divider-color, rgba(0,0,0,.08));
        }
        .sgv-footer a {
          font-size: 12px;
          color: var(--primary-color, #03a9f4);
          text-decoration: none;
          cursor: pointer;
        }
      </style>
      <ha-card>
        <div class="sgv-header">
          <span class="sgv-title">${this._esc(this._config.title)}</span>
          <span class="sgv-badge" id="sgv-badge" style="display:none"></span>
        </div>
        <div class="sgv-list" id="sgv-list"></div>
        <div class="sgv-footer">
          <a id="sgv-open-panel">${this._t("open_all_messages")}</a>
        </div>
      </ha-card>
    `;

    this.querySelector("#sgv-open-panel").addEventListener("click", () => {
      this._openPanel();
    });
  }

  _renderList() {
    const list = this.querySelector("#sgv-list");
    const badge = this.querySelector("#sgv-badge");
    if (!list) return;

    if (this._error) {
      list.innerHTML = `<div class="sgv-error">⚠ ${this._esc(this._error)}</div>`;
      return;
    }

    let items = this._contacts;
    if (this._config.show_unread_only) {
      items = items.filter((c) => c.unread > 0);
    }
    items = items.slice(0, this._config.max_items || 5);

    const totalUnread = this._contacts.reduce((s, c) => s + (c.unread || 0), 0);
    if (badge) {
      if (totalUnread > 0) {
        badge.textContent = totalUnread;
        badge.style.display = "";
      } else {
        badge.style.display = "none";
      }
    }

    if (!items.length) {
      list.innerHTML = `<div class="sgv-empty">${this._t("no_messages")}</div>`;
      return;
    }

    list.innerHTML = items
      .map(
        (c) => `
      <div class="sgv-item ${c.unread > 0 ? "unread" : ""}" data-number="${this._esc(c.number)}">
        <div class="sgv-avatar ${this._isAlphaTag(c.number) ? "alpha" : ""}">${this._esc(c.contact_name ? c.contact_name.slice(0, 1).toUpperCase() : this._avatar(c.number))}</div>
        <div class="sgv-info">
          <div class="sgv-row1">
            <span class="sgv-number">
              ${c.unread > 0 ? '<span class="sgv-unread-dot"></span> ' : ""}${this._esc(c.contact_name || c.number)}
            </span>
            <span class="sgv-date">${this._fmtDate(c.last_date)}</span>
          </div>
          <div class="sgv-preview">${this._esc((c.last_text || "").slice(0, 50))}</div>
        </div>
      </div>
    `
      )
      .join("");

    list.querySelectorAll(".sgv-item").forEach((el) => {
      el.addEventListener("click", () => this._openPanel(el.dataset.number));
    });
  }

  static getConfigElement() {
    return document.createElement("sms-gammu-viewer-card-editor");
  }

  static getStubConfig() {
    return { title: "SMS", max_items: 5, show_unread_only: false };
  }
}

class SmsGammuViewerCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    const form = this.querySelector("ha-form");
    if (form) {
      // ha-form уже построен — просто обновляем данные на месте.
      // Пересоздание через innerHTML на каждый setConfig() (а HA вызывает
      // его повторно после каждого нашего же value-changed) уничтожало бы
      // DOM-узел поля и сбрасывало фокус/курсор после каждого введённого
      // символа.
      form.data = {
        title: config.title ?? "SMS",
        max_items: config.max_items ?? 5,
        show_unread_only: config.show_unread_only ?? false,
      };
    } else {
      this._render();
    }
  }

  set hass(hass) {
    this._hass = hass;
    const form = this.querySelector("ha-form");
    if (form) form.hass = hass;
  }

  static get _schema() {
    return [
      { name: "title", selector: { text: {} } },
      {
        name: "max_items",
        selector: { number: { mode: "box", min: 1, max: 50, step: 1 } },
      },
      { name: "show_unread_only", selector: { boolean: {} } },
    ];
  }

  _computeLabel(schema) {
    const labels = {
      title: "Заголовок карточки",
      max_items: "Количество диалогов",
      show_unread_only: "Показывать только непрочитанные",
    };
    return labels[schema.name] || schema.name;
  }

  _render() {
    if (!this._config) return;
    this.innerHTML = `<ha-form></ha-form>`;
    const form = this.querySelector("ha-form");
    form.hass = this._hass;
    form.data = {
      title: this._config.title ?? "SMS",
      max_items: this._config.max_items ?? 5,
      show_unread_only: this._config.show_unread_only ?? false,
    };
    form.schema = SmsGammuViewerCardEditor._schema;
    form.computeLabel = this._computeLabel;
    form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._config = { ...this._config, ...ev.detail.value };
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: this._config },
          bubbles: true,
          composed: true,
        })
      );
    });
  }
}


customElements.define("sms-gammu-viewer-card", SmsGammuViewerCard);
customElements.define("sms-gammu-viewer-card-editor", SmsGammuViewerCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "sms-gammu-viewer-card",
  name: "SMS Gammu Viewer Card",
  description: "Shows recent SMS conversations from SMS Gammu Viewer integration",
  preview: true,
});













