/** Render explicit web links in SMS text while keeping all other text escaped. */
export function linkifyMessage(text, escapeHtml) {
  const message = String(text ?? "");
  const pattern = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  let result = "";
  let start = 0;

  for (const match of message.matchAll(pattern)) {
    const candidate = match[0];
    let link = candidate.replace(/[.,!?;:}\]]+$/, "");
    while (link.endsWith(")") && (link.match(/\)/g) || []).length > (link.match(/\(/g) || []).length) {
      link = link.slice(0, -1);
    }
    result += escapeHtml(message.slice(start, match.index));

    let href = "";
    try {
      const url = new URL(link.startsWith("www.") ? `https://${link}` : link);
      if (["http:", "https:"].includes(url.protocol) && url.hostname) href = url.href;
    } catch (_) {}

    result += href
      ? `<a class="msg-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link)}</a>`
      : escapeHtml(link);
    start = match.index + link.length;
  }

  return result + escapeHtml(message.slice(start));
}
