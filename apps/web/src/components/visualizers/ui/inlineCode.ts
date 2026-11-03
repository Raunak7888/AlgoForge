export interface Segment {
    text: string;
    code: boolean;
}

/**
 * Splits plain text on `backticks` so the dock can draw code spans. Output is always rendered as
 * text by React, never as HTML. An unbalanced backtick leaves the whole message as plain text.
 */
export function splitInlineCode(message: string): Segment[] {
    const parts = message.split("`");
    if (parts.length % 2 === 0) return [{ text: message, code: false }];
    return parts.map((text, i) => ({ text, code: i % 2 === 1 })).filter((s) => s.text !== "");
}
