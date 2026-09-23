/** Render web addresses in SMS text while keeping all other text escaped. */
export function linkifyMessage(text, escapeHtml) {
  const message = String(text ?? "");
  // A domain suffix is validated by its shape, so new zones work without a list.
  const pattern = /(?:https?:\/\/|www\.|(?:[\p{L}\p{N}-]+\.)+(?:[\p{L}]{2,63}|xn--[a-z0-9-]{2,59}))[^\s<>"']*/giu;
  let result = "";
  let start = 0;

  for (const match of message.matchAll(pattern)) {
    // Do not turn the domain part of an email or a longer token into a link.
    if (match.index > 0 && /[\p{L}\p{N}_@.-]/u.test(message[match.index - 1])) continue;
    const candidate = match[0];
    let link = candidate.replace(/[.,!?;:}\]]+$/, "");
    while (link.endsWith(")") && (link.match(/\)/g) || []).length > (link.match(/\(/g) || []).length) {
      link = link.slice(0, -1);
    }
    result += escapeHtml(message.slice(start, match.index));

    let href = "";
    try {
      const explicitScheme = /^https?:\/\//i.test(link);
      const url = new URL(explicitScheme ? link : `https://${link}`);
      const hasDomainZone = /\.(?:[\p{L}]{2,63}|xn--[a-z0-9-]{2,59})$/iu.test(url.hostname);
      if (["http:", "https:"].includes(url.protocol) && url.hostname &&
          !url.username && !url.password && (explicitScheme || hasDomainZone)) href = url.href;
    } catch (_) {}

    result += href
      ? `<a class="msg-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link)}</a>`
      : escapeHtml(link);
    start = match.index + link.length;
  }

  return result + escapeHtml(message.slice(start));
}
