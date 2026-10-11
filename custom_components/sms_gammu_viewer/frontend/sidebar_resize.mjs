export function installSidebarResize(root, handle) {
  const key = "sms_gammu_sidebar_width";
  let width = 320;
  try {
    const saved = Number(localStorage.getItem(key));
    if (Number.isFinite(saved) && saved >= 240) width = saved;
  } catch {}
  let pointer = null;
  let startX = 0;
  let startWidth = 0;
  const apply = () => {
    const max = Math.max(240, Math.min(640, root.clientWidth - 300));
    const actual = Math.round(Math.max(240, Math.min(max, width)));
    root.style.setProperty("--contacts-width", `${actual}px`);
    handle.setAttribute("aria-valuenow", actual);
    handle.setAttribute("aria-valuemax", max);
    return actual;
  };
  const save = () => {
    try { localStorage.setItem(key, String(width)); } catch {}
  };
  const finish = () => {
    if (pointer === null) return;
    const id = pointer;
    pointer = null;
    root.classList.remove("resizing-sidebar");
    if (handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
    save();
  };
  handle.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || window.innerWidth <= 580) return;
    event.preventDefault();
    pointer = event.pointerId;
    startX = event.clientX;
    startWidth = apply();
    handle.setPointerCapture(pointer);
    root.classList.add("resizing-sidebar");
  });
  handle.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointer) return;
    width = startWidth + event.clientX - startX;
    width = apply();
  });
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
  handle.addEventListener("lostpointercapture", finish);
  handle.addEventListener("dblclick", () => { width = 320; apply(); save(); });
  handle.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
    event.preventDefault();
    width = event.key === "Home" ? 320 : apply() + (event.key === "ArrowRight" ? 10 : -10);
    width = apply();
    save();
  });
  const observer = new ResizeObserver(apply);
  observer.observe(root);
  apply();
  return () => { finish(); observer.disconnect(); };
}
