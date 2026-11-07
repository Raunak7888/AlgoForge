import { describe, expect, it } from "vitest";
import { normalizeLang, parseBlocks, parseInline, safeHref } from "./markdown";

describe("safeHref", () => {
  it("keeps http, https and mailto and drops everything else", () => {
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,<b>x</b>")).toBeNull();
    expect(safeHref("/relative")).toBeNull();
  });
});

describe("parseInline", () => {
  it("parses code, bold, italic and safe links", () => {
    const n = parseInline("use `x` and **bold** and *it* and [docs](https://example.com)");
    expect(n.map((x) => x.t)).toEqual(["text", "code", "text", "strong", "text", "em", "text", "link"]);
  });

  it("leaves an unsafe link as plain text", () => {
    const n = parseInline("[click](javascript:alert(1))");
    expect(n.every((x) => x.t === "text")).toBe(true);
    expect(JSON.stringify(n)).toContain("javascript:alert(1)");
  });

  it("never turns raw HTML into anything but text", () => {
    const n = parseInline('<img src=x onerror="alert(1)"><script>x</script>');
    expect(n).toEqual([{ t: "text", v: '<img src=x onerror="alert(1)"><script>x</script>' }]);
  });

  it("does not treat a lone asterisk or backtick as formatting", () => {
    expect(parseInline("2 * 3 = 6")).toEqual([{ t: "text", v: "2 * 3 = 6" }]);
    expect(parseInline("a ` b")).toEqual([{ t: "text", v: "a ` b" }]);
  });
});

describe("parseBlocks", () => {
  it("reads headings, lists, paragraphs and fenced code with its language", () => {
    const b = parseBlocks("# Title\n\nSome text\nmore text\n\n- one\n- two\n\n1. a\n2. b\n\n```python\nprint(1)\n```");
    expect(b.map((x) => x.t)).toEqual(["h", "p", "ul", "ol", "code"]);
    const code = b[4];
    expect(code.t === "code" && code.lang).toBe("python");
    expect(code.t === "code" && code.v).toBe("print(1)");
    expect(b[1].t === "p" && JSON.stringify(b[1].c)).toContain("Some text more text");
  });

  it("keeps markdown inside a code fence literal", () => {
    const b = parseBlocks("```js\n**not bold** <b>x</b>\n```");
    expect(b).toEqual([{ t: "code", lang: "js", v: "**not bold** <b>x</b>" }]);
  });

  it("runs an unterminated fence to the end instead of dropping it", () => {
    const b = parseBlocks("text\n\n```js\nlet a = 1;");
    expect(b[1]).toEqual({ t: "code", lang: "js", v: "let a = 1;" });
  });

  it("handles empty input", () => {
    expect(parseBlocks("")).toEqual([]);
  });
});

describe("normalizeLang", () => {
  it("maps aliases and refuses languages the editor cannot hold", () => {
    expect(normalizeLang("JS")).toBe("javascript");
    expect(normalizeLang("py")).toBe("python");
    expect(normalizeLang("json")).toBeNull();
    expect(normalizeLang("")).toBeNull();
  });
});
