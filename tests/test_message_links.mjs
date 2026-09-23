import assert from "node:assert/strict";
import { test } from "node:test";
import { linkifyMessage } from "../custom_components/sms_gammu_viewer/frontend/message_links.mjs";

const escapeHtml = (value) => String(value)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

test("links explicit HTTP(S) and www addresses without including punctuation", () => {
  const html = linkifyMessage("Open https://example.com/a?x=1&y=2, or www.example.org!", escapeHtml);
  assert.match(html, /href="https:\/\/example\.com\/a\?x=1&amp;y=2"/);
  assert.match(html, /href="https:\/\/www\.example\.org\/"/);
  assert.match(html, /<\/a>, or /);
  assert.match(html, /<\/a>!$/);
});

test("escapes message content and allows no injected markup", () => {
  const html = linkifyMessage('<img src=x onerror=alert(1)> https://example.com/?x="bad"', escapeHtml);
  assert.ok(html.startsWith("&lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes('href="javascript:'));
});

test("links bare domains in arbitrary zones, including Cyrillic domains", () => {
  const html = linkifyMessage("site.ru/path, store.example.technology and пример.рф", escapeHtml);
  assert.match(html, /href="https:\/\/site\.ru\/path"/);
  assert.match(html, /href="https:\/\/store\.example\.technology\/"/);
  assert.match(html, /href="https:\/\/xn--e1afmkfd\.xn--p1ai\/"/);
});

test("leaves emails, ordinary dotted text and malformed addresses as text", () => {
  assert.equal(linkifyMessage("user@site.ru version.1.2", escapeHtml), "user@site.ru version.1.2");
  assert.equal(linkifyMessage("https://", escapeHtml), "https://");
  assert.equal(linkifyMessage("site.ru@other.com", escapeHtml), "site.ru@other.com");
});

test("keeps balanced parentheses inside an address", () => {
  const html = linkifyMessage("See (https://example.org/wiki/Item_(2026)).", escapeHtml);
  assert.match(html, /href="https:\/\/example\.org\/wiki\/Item_\(2026\)"/);
  assert.ok(html.endsWith("</a>)."));
});
