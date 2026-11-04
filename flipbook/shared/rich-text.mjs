/** The persisted rich-text format contains data only; never HTML. */
export const MARK_KEYS = ["bold", "italic", "underline", "color", "href"];
export function paragraphsFromText(text = "") {
  return String(text)
    .split("\n")
    .map((text) => ({ kind: "paragraph", runs: [{ text }] }));
}
export function richTextOf(block) {
  return block.richText || paragraphsFromText(block.text);
}
export function plainText(paragraphs) {
  return paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("\n");
}
const marks = (run) =>
  Object.fromEntries(
    MARK_KEYS.filter((k) => run[k] !== undefined).map((k) => [k, run[k]]),
  );
const signature = (run) => JSON.stringify(marks(run));
export function compactRuns(runs) {
  const result = [];
  for (const run of runs) {
    if (!run.text) continue;
    const last = result.at(-1);
    if (last && signature(last) === signature(run)) last.text += run.text;
    else result.push({ ...marks(run), text: run.text });
  }
  return result.length ? result : [{ text: "" }];
}
export function applyMark(paragraphs, start, end, key, value) {
  if (!MARK_KEYS.includes(key)) throw Error("Unsupported text formatting.");
  const length = plainText(paragraphs).length;
  start = Math.max(0, Math.min(length, start));
  end = Math.max(start, Math.min(length, end));
  let offset = 0;
  return paragraphs.map((p) => {
    const runs = [];
    for (const run of p.runs) {
      const a = Math.max(0, start - offset),
        b = Math.min(run.text.length, end - offset);
      if (a < b) {
        if (a) runs.push({ ...run, text: run.text.slice(0, a) });
        const middle = { ...run, text: run.text.slice(a, b) };
        if (value === undefined || value === "") delete middle[key];
        else middle[key] = value;
        runs.push(middle);
        if (b < run.text.length) runs.push({ ...run, text: run.text.slice(b) });
      } else runs.push({ ...run });
      offset += run.text.length;
    }
    offset++;
    return { ...p, runs: compactRuns(runs) };
  });
}
/** Preserve formatting outside the changed range when plain text is edited. */
export function replacePlainText(previous, nextText) {
  const oldText = plainText(previous),
    next = String(nextText);
  let start = 0,
    tail = 0;
  while (
    start < oldText.length &&
    start < next.length &&
    oldText[start] === next[start]
  )
    start++;
  while (
    tail < oldText.length - start &&
    tail < next.length - start &&
    oldText[oldText.length - 1 - tail] === next[next.length - 1 - tail]
  )
    tail++;
  const characters = [];
  for (const [i, p] of previous.entries()) {
    if (i) characters.push({ text: "\n" });
    for (const r of p.runs)
      for (const text of r.text.split(""))
        characters.push({ ...marks(r), text });
  }
  const inherited = marks(characters[Math.max(0, start - 1)] || {});
  const inserted = next
    .slice(start, next.length - tail)
    .split("")
    .map((text) => ({ ...inherited, text }));
  const edited = [
    ...characters.slice(0, start),
    ...inserted,
    ...characters.slice(oldText.length - tail),
  ];
  const result = [{ kind: previous[0]?.kind || "paragraph", runs: [] }];
  for (const c of edited) {
    if (c.text === "\n")
      result.push({
        kind: previous[result.length]?.kind || "paragraph",
        runs: [],
      });
    else result.at(-1).runs.push(c);
  }
  return result.map((p) => ({ ...p, runs: compactRuns(p.runs) }));
}
export function setParagraphKind(paragraphs, start, end, kind) {
  if (!["paragraph", "bullet", "number"].includes(kind))
    throw Error("Unsupported list type.");
  let offset = 0;
  return paragraphs.map((p) => {
    const length = p.runs.reduce((n, r) => n + r.text.length, 0),
      selected = end >= offset && start <= offset + length;
    offset += length + 1;
    return {
      ...p,
      kind: selected ? kind : p.kind,
      runs: p.runs.map((r) => ({ ...r })),
    };
  });
}
export function setBlockText(block, text) {
  if (block.richText) block.richText = replacePlainText(block.richText, text);
  block.text = text;
}
