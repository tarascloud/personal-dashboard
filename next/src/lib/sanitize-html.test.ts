import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize-html";

describe("sanitizeHtml", () => {
  it("strips script tags including content", () => {
    const out = sanitizeHtml('<script>alert(1)</script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert");
  });

  it("keeps allowed tags like <p>", () => {
    const out = sanitizeHtml('<p>ok</p>');
    expect(out).toBe('<p>ok</p>');
  });

  it("does not leave regex-bypass leftovers from quoted attribute values", () => {
    // Previous regex fallback dirty.replace(/<[^>]*>/g,'') incorrectly
    // matched up to the first '>' inside the alt attribute, leaving
    // a stray '">' string. With DOM-aware sanitization the entire
    // <img> element is parsed and stripped (not in ALLOWED_TAGS).
    const out = sanitizeHtml('<img alt=">">');
    expect(out).not.toContain('">');
    expect(out).not.toContain("<img");
  });

  it("strips event handlers from allowed tags", () => {
    const out = sanitizeHtml('<a href="#" onclick="alert(1)">x</a>');
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("alert");
  });

  it("removes javascript: URIs", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });

  it("strips disallowed tags but keeps inner text where appropriate", () => {
    const out = sanitizeHtml('<div><p>hello</p></div>');
    // div is not allowed but children survive; p is preserved
    expect(out).toContain('<p>hello</p>');
    expect(out).not.toContain('<div');
  });

  it("is safe on server (jsdom-backed) — no window required", () => {
    // Sanity: this test file runs under vitest 'node' environment.
    // If isomorphic-dompurify did not work server-side, sanitizeHtml
    // would throw. The fact that earlier expectations pass proves it.
    expect(typeof sanitizeHtml('<b>x</b>')).toBe('string');
  });
});
