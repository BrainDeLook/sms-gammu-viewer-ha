/**
 * Unread SMS badge for the Home Assistant sidebar.
 * Loaded globally through frontend.add_extra_js_url and uses HA's already
 * authenticated WebSocket connection, so no access token is exposed.
 */
(function () {
  "use strict";

  if (window.__smsGammuSidebarBadgeStarted) return;
  window.__smsGammuSidebarBadgeStarted = true;

  const POLL_INTERVAL = 10_000;
  const BADGE_CLASS = "sms-gammu-sidebar-badge";
  let currentCount = 0;
  let enabled = false;
  let badgeElement = null;
  let renderTimer = null;

  function findPanelLink(root, visited = new Set()) {
    if (!root || visited.has(root)) return null;
    visited.add(root);

    const link = root.querySelector?.(
      'a[href="/sms-viewer"], a[href="sms-viewer"], a[href$="/sms-viewer"]'
    );
    if (link) return link;

    for (const element of root.querySelectorAll?.("*") || []) {
      if (!element.shadowRoot) continue;
      const nested = findPanelLink(element.shadowRoot, visited);
      if (nested) return nested;
    }
    return null;
  }

  function removeBadge() {
    if (badgeElement?.isConnected) badgeElement.remove();
    badgeElement = null;
  }

  function renderBadge() {
    if (!enabled || currentCount <= 0) {
      removeBadge();
      return;
    }

    const link = findPanelLink(document);
    if (!link) {
      removeBadge();
      return;
    }

    if (badgeElement?.isConnected && badgeElement.parentElement !== link) {
      removeBadge();
    }
    if (!badgeElement?.isConnected) {
      badgeElement = document.createElement("span");
      badgeElement.className = BADGE_CLASS;
      badgeElement.setAttribute("aria-hidden", "true");
      Object.assign(badgeElement.style, {
        position: "absolute",
        insetInlineEnd: "8px",
        top: "50%",
        transform: "translateY(-50%)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "20px",
        height: "20px",
        padding: "0 5px",
        boxSizing: "border-box",
        borderRadius: "10px",
        background: "var(--primary-color, #03a9f4)",
        color: "var(--text-primary-color, #fff)",
        fontSize: "11px",
        fontWeight: "700",
        lineHeight: "20px",
        pointerEvents: "none",
        zIndex: "1",
      });
      if (getComputedStyle(link).position === "static") {
        link.style.position = "relative";
      }
      link.appendChild(badgeElement);
    }

    const label = currentCount > 99 ? "99+" : String(currentCount);
    if (badgeElement.textContent !== label) badgeElement.textContent = label;
    const title = `${currentCount} unread SMS`;
    if (badgeElement.title !== title) badgeElement.title = title;
  }

  function scheduleRender() {
    if (renderTimer !== null) return;
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      renderBadge();
    }, 100);
  }

  async function refresh() {
    try {
      const connection = await Promise.resolve(window.hassConnection);
      if (!connection?.conn?.sendMessagePromise) return;
      const result = await connection.conn.sendMessagePromise({
        type: "sms_gammu_viewer/sidebar_badge",
      });
      enabled = result?.enabled === true;
      currentCount = Number(result?.unread) || 0;
    } catch (_error) {
      // HA can briefly disconnect while restarting; retain the last count.
    }
    renderBadge();
  }

  function start() {
    refresh();
    window.setInterval(refresh, POLL_INTERVAL);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refresh();
    });
    window.addEventListener("location-changed", scheduleRender);
    window.addEventListener("popstate", scheduleRender);
    new MutationObserver(scheduleRender).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
