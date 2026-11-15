import { describe, expect, it } from "vitest";
import { renderEmailPreview } from "./emailPreview";
import { slugify } from "./slug";

describe("renderEmailPreview", () => {
  it("renders paragraphs, line breaks, bold and https links", () => {
    const html = renderEmailPreview("Hello **there**\nline two\n\n[See it](https://prodbnb.com/x)");
    expect(html).toContain("<strong>there</strong>");
    expect(html).toContain("line two");
    expect(html).toContain("<br>");
    expect(html).toContain('href="https://prodbnb.com/x"');
    expect(html.match(/<p /g)).toHaveLength(2);
  });

  it("escapes markup an admin types, so nothing can inject HTML or script", () => {
    const html = renderEmailPreview('<img src=x onerror=alert(1)> <script>alert(1)</script> "quoted"');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;quoted&quot;");
  });

  it("only links https URLs", () => {
    const html = renderEmailPreview("[bad](javascript:alert(1)) [http](http://x.com)");
    expect(html).not.toContain("href=");
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Beach Villas in Goa!")).toBe("beach-villas-in-goa");
    expect(slugify("  Studios -- under ₹5,000/hr ")).toBe("studios-under-5000hr");
    expect(slugify("x".repeat(100))).toHaveLength(80);
  });
});
