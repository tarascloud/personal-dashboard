/**
 * HTML sanitization utility using isomorphic-dompurify.
 *
 * SECURITY: Always use this when rendering external/user HTML.
 * Never use dangerouslySetInnerHTML without sanitizing first.
 * Never add "style" to ALLOWED_ATTR (CSS data exfiltration risk).
 *
 * Uses isomorphic-dompurify so server-side rendering performs the SAME
 * DOM-aware sanitization as client-side. The previous regex fallback
 * (dirty.replace(/<[^>]*>/g, '')) was bypassable: e.g. '<img alt=">">'
 * left a stray '">' fragment, which under SSR could resurface as XSS.
 */
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_ATTR = ["href", "src", "alt", "class", "target", "rel"];
const ALLOWED_TAGS = [
  "a",
  "b",
  "br",
  "code",
  "em",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "ul",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

/**
 * Sanitize HTML string. Safe to pass to dangerouslySetInnerHTML.
 * Same behavior on server (jsdom) and client (window).
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
