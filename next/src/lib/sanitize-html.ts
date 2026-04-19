/**
 * HTML sanitization utility using DOMPurify.
 *
 * SECURITY: Always use this when rendering external/user HTML.
 * Never use dangerouslySetInnerHTML without sanitizing first.
 * Never add "style" to ALLOWED_ATTR (CSS data exfiltration risk).
 */
import DOMPurify from "dompurify";

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
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof window === "undefined") {
    // Server-side: strip all HTML tags as a safe fallback
    return dirty.replace(/<[^>]*>/g, "");
  }
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
