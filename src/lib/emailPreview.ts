/**
 * Mirrors the backend's safe email body renderer (src/modules/outreach/email.ts) so the composer's
 * preview matches what recipients get: paragraphs, line breaks, **bold**, [links](https://...);
 * everything else escaped.
 */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function inline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\[([^\]]{1,200})\]\((https:\/\/[^\s)]{1,500})\)/g, '<a href="$2" target="_blank" rel="noreferrer" style="color:#C28014;text-decoration:underline">$1</a>');
  return out.replace(/\n/g, "<br>");
}

export function renderEmailPreview(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px;line-height:1.6">${inline(p)}</p>`)
    .join("");
}
