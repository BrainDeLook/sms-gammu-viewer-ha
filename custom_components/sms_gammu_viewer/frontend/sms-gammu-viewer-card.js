/**
 * SMS Gammu Viewer Card — компактная карточка для Lovelace дашборда.
 * Показывает последние диалоги с непрочитанными SMS, ведёт в полную панель.
 *
 * Требует установленную интеграцию sms_gammu_viewer:
 * https://github.com/BrainDeLook/sms-gammu-viewer-ha
 */

const CARD_VERSION = "2.1.0";

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
    this._stateObj = undefined; // форсируем перечитывание сенсора
    this._liveContactsPromise = null;
    this._render();
    if (this._hass) this.hass = this._hass;
  }

  set hass(hass) {
    // Никаких таймеров и запросов: данные лежат в атрибутах сенсора
    // SMS Chats, а HA сам пушит сюда новый hass при каждом изменении
    // состояния. Объекты состояний иммутабельны — сравнение по ссылке
    // точно говорит, изменился ли наш сенсор.
    this._hass = hass;
    const entityId = this._chatsEntity();
    const st = entityId ? hass.states[entityId] : null;
    // Сигнал и оператор живут в отдельных сенсорах и могут обновляться без
    // изменения списка чатов. Обновляем компактный статус даже при прежнем
    // объекте чатов, но тяжёлый рендер списка не повторяем.
    if (st === this._stateObj) {
      this._updateModemInfo();
      return;
    }
    this._stateObj = st;
    if (st) {
      this._contacts = st.attributes.chats || [];
      this._error = null;
    } else {
      this._contacts = [];
      this._error = "Сенсор SMS Chats не найден — обновите интеграцию и перезапустите HA";
    }
    this._renderList();
    this._updateModemInfo();
    this._loadLiveContacts();
  }

  set editMode(value) {
    this._editMode = value;
  }

  get editMode() {
    return this._editMode;
  }

  getCardSize() {
    return 1 + Math.min(this._config.max_items || 5, 5);
  }

  _chatsEntity() {
    // Явно указанный сенсор в конфиге имеет приоритет
    if (this._config.entity && this._hass.states[this._config.entity]) {
      return this._config.entity;
    }
    // Найденный ранее — если он ещё существует
    if (this._entityId && this._hass.states[this._entityId]) {
      return this._entityId;
    }
    // Ищем по маркерам: у сенсора SMS Chats есть атрибуты chats + panel_url
    for (const [id, st] of Object.entries(this._hass.states)) {
      if (
        id.startsWith("sensor.") &&
        st.attributes &&
        Array.isArray(st.attributes.chats) &&
        st.attributes.panel_url === "/sms-viewer"
      ) {
        this._entityId = id;
        return id;
      }
    }
    return null;
  }

  _updateModemInfo() {
    if (!this._config.show_modem_info) return;
    const dot = this.querySelector("#sgv-signal-dot");
    const text = this.querySelector("#sgv-modem-text");
    if (!dot || !text) return;
    const attrs = this._stateObj?.attributes || {};
    const states = this._hass?.states || {};
    const findState = (suffixes, hints) => Object.entries(states).find(([id, state]) => {
      const entity = String(id).toLowerCase();
      const name = String(state?.attributes?.friendly_name || "").toLowerCase();
      return suffixes.some((suffix) => entity.endsWith(suffix)) ||
        hints.some((hint) => name.includes(hint) || entity.includes(hint));
    })?.[1];
    // Entity IDs can be prefixed by the config-entry title, so match both
    // their stable suffixes and friendly names rather than a hard-coded ID.
    const signalState = findState(["_signal"], ["signal quality", "signal", "сигнал"]);
    const configuredNetwork = this._config.operator_entity && states[this._config.operator_entity];
    const networkState = configuredNetwork || findState(["_network", "_network_operator", "_operator"], ["network operator", "operator", "оператор", "сеть"]);
    const rawSignal = attrs.signal_percent ?? signalState?.state;
    const configuredName = String(this._config.operator_name || "").trim();
    const rawNetwork = configuredName || attrs.network_name || networkState?.state;
    const invalid = (value) => value === null || value === undefined || ["", "unknown", "unavailable", "none", "null"].includes(String(value).trim().toLowerCase());
    const parsedSignal = invalid(rawSignal) ? NaN : Number.parseFloat(String(rawSignal).replace(",", "."));
    const pct = Number.isFinite(parsedSignal) ? Math.max(0, Math.min(100, Math.round(parsedSignal))) : null;
    dot.style.background = pct === null ? "#9e9e9e" : pct >= 50 ? "#4caf50" : pct >= 20 ? "#ff9800" : "#f44336";
    const parts = [];
    if (!invalid(rawNetwork)) parts.push(String(rawNetwork));
    if (pct !== null) parts.push(pct + "%");
    text.textContent = parts.length ? parts.join(" · ") : "—";
  }

  _esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  _avatar(number) {
    const s = (number || "?").trim();
    const digits = s.replace(/\D/g, "");
    if (digits.length > 0) return digits.slice(-2);
    const letters = s.replace(/[^a-zA-Zа-яёА-ЯЁ]/g, "");
    return letters.slice(0, 2).toUpperCase() || "?";
  }

  async _loadLiveContacts() {
    if (this._liveContactsPromise || !this._hass?.callApi) return;
    this._liveContactsPromise = Promise.all([
      this._hass.callApi("GET", "sms_gammu_viewer/contacts"),
      this._hass.callApi("GET", "sms_gammu_viewer/brand_catalog").catch(() => ({ logos: [] })),
    ])
      .then(([contacts, catalog]) => {
        if (!Array.isArray(contacts)) return;
        this._brandCatalog = Array.isArray(catalog?.logos) ? catalog.logos : [];
        this._contacts = contacts;
        this._error = null;
        this._renderList();
      })
      .catch(() => {})
      .finally(() => { this._liveContactsPromise = null; });
  }

  _avatarUrl(contact) {
    const value = String(contact?.avatar || this._brandLogoFor(contact) || contact?.brand_logo_url || "").trim();
    return /^(data:image\/(?:jpeg|png|webp);base64,|https?:\/\/|\/)/i.test(value) ? value : "";
  }

  _normalizeBrand(value) {
    return String(value || "").toLowerCase()
      .replace(/\.(?:ru|рф|com|net|org|io|su|me|tv|online)\b/gi, " ")
      .replace(/[«»"'’.,()\[\]{}_/\\-]+/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  _brandLogoFor(contact) {
    if (!this._isAlphaTag(contact?.number) || !this._brandCatalog?.length) return "";
    const override = String(contact?.brand_logo_url || "").trim();
    if (override) {
      const selected = this._brandCatalog.find((logo) => String(logo.svgUrl || logo.pngUrl || "") === override);
      return selected?.localUrl || selected?.pngUrl || selected?.svgUrl || override;
    }
    const needle = this._normalizeBrand(contact?.contact_name || contact?.number);
    const found = this._brandCatalog.find((logo) => {
      const haystack = this._normalizeBrand(`${logo.name || ""} ${logo.name_en || ""} ${logo.tags || ""}`);
      const tokens = haystack.split(/\s+/).filter(Boolean);
      return needle && (haystack === needle || haystack.includes(needle) || needle.split(/\s+/).some((token) => token.length >= 2 && tokens.includes(token)));
    });
    return found?.localUrl || found?.pngUrl || found?.svgUrl || "";
  }

  _avatarMarkup(contact) {
    const url = this._avatarUrl(contact);
    const fallback = contact.contact_name ? contact.contact_name.slice(0, 1).toUpperCase() : this._avatar(contact.number);
    if (!url) return this._esc(fallback);
    return `<img src="${this._esc(url)}" alt="" loading="lazy" decoding="async" onerror="this.remove()" /><span class="sgv-avatar-fallback">${this._esc(fallback)}</span>`;
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
        .sgv-avatar { position: relative; overflow: hidden; }
        .sgv-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; position: relative; z-index: 1; }
        .sgv-avatar img[src*=".svg"], .sgv-avatar img[src^="data:image/svg"] { object-fit: contain; background: #fff; }
        .sgv-avatar-fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
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
          <div style="display:flex;align-items:center;gap:8px">
            <span class="sgv-title">${this._esc(this._config.title)}</span>
            ${this._config.show_modem_info ? '<span style="display:flex;align-items:center;gap:4px"><span id="sgv-signal-dot" style="width:7px;height:7px;border-radius:50%;background:#4caf50;flex-shrink:0;display:inline-block"></span><span id="sgv-modem-text" style="font-size:11px;color:var(--secondary-text-color)">…</span></span>' : ''}
          </div>
          <span class="sgv-badge" id="sgv-badge" style="display:none"></span>
        </div>
            <div class="sgv-list" id="sgv-list"></div>
        <div class="sgv-footer">
          <a id="sgv-open-panel">Открыть все сообщения →</a>
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
      list.innerHTML = `<div class="sgv-empty">Нет сообщений</div>`;
      return;
    }

    list.innerHTML = items
      .map(
        (c) => `
      <div class="sgv-item ${c.unread > 0 ? "unread" : ""}" data-number="${this._esc(c.number)}">
        <div class="sgv-avatar ${this._isAlphaTag(c.number) ? "alpha" : ""}">${this._avatarMarkup(c)}</div>
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
    return { title: "SMS", max_items: 5, show_unread_only: false, show_modem_info: false, operator_entity: "", operator_name: "" };
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
        show_modem_info: config.show_modem_info ?? false,
        operator_entity: config.operator_entity ?? "",
        operator_name: config.operator_name ?? "",
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
      { name: "show_modem_info", selector: { boolean: {} } },
      { name: "operator_entity", selector: { entity: { domain: "sensor", multiple: false } } },
      { name: "operator_name", selector: { text: {} } },
    ];
  }

  _computeLabel(schema) {
    const labels = {
      title: "Заголовок карточки",
      max_items: "Количество диалогов",
      show_unread_only: "Показывать только непрочитанные",
      show_modem_info: "Показывать оператор и сигнал",
      operator_entity: "Сенсор оператора (необязательно)",
      operator_name: "Имя оператора (необязательно)",
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
      show_modem_info: this._config.show_modem_info ?? false,
      operator_entity: this._config.operator_entity ?? "",
      operator_name: this._config.operator_name ?? "",
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


// Модуль может оказаться загружен дважды (старая ссылка в закешированном
// index.html + Lovelace-ресурс) — повторный define кидает исключение и
// валит весь модуль, поэтому регистрируем только если ещё не определён.
if (!customElements.get("sms-gammu-viewer-card")) {
  customElements.define("sms-gammu-viewer-card", SmsGammuViewerCard);
}
if (!customElements.get("sms-gammu-viewer-card-editor")) {
  customElements.define("sms-gammu-viewer-card-editor", SmsGammuViewerCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "sms-gammu-viewer-card")) {
  window.customCards.push({
    type: "sms-gammu-viewer-card",
    name: "SMS Gammu Viewer Card",
    description: "Shows recent SMS conversations from SMS Gammu Viewer integration",
    preview: true,
  });
}













