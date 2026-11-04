// Built-in typefaces, packaged from @fontsource. All are SIL OFL 1.1, so they
// may be served to readers and embedded in exported PDFs. A font's files are
// served at /fonts/<key>[-bold][-italic].woff2; `bold` and `italic` say which
// of those styles the package ships (a missing style is synthesized).
export const BUILTIN_FONTS = Object.freeze([
  {
    key: "sans",
    family: "DM Sans",
    pkg: "dm-sans",
    category: "Sans serif",
    fallback: "sans-serif",
    bold: true,
    italic: true,
  },
  {
    key: "inter",
    family: "Inter",
    pkg: "inter",
    category: "Sans serif",
    fallback: "sans-serif",
    bold: true,
    italic: true,
  },
  {
    key: "montserrat",
    family: "Montserrat",
    pkg: "montserrat",
    category: "Sans serif",
    fallback: "sans-serif",
    bold: true,
    italic: true,
  },
  {
    key: "work-sans",
    family: "Work Sans",
    pkg: "work-sans",
    category: "Sans serif",
    fallback: "sans-serif",
    bold: true,
    italic: true,
  },
  {
    key: "space-grotesk",
    family: "Space Grotesk",
    pkg: "space-grotesk",
    category: "Sans serif",
    fallback: "sans-serif",
    bold: true,
    italic: false,
  },
  {
    key: "serif",
    family: "Instrument Serif",
    pkg: "instrument-serif",
    category: "Serif",
    fallback: "serif",
    bold: false,
    italic: true,
  },
  {
    key: "playfair",
    family: "Playfair Display",
    pkg: "playfair-display",
    category: "Serif",
    fallback: "serif",
    bold: true,
    italic: true,
  },
  {
    key: "lora",
    family: "Lora",
    pkg: "lora",
    category: "Serif",
    fallback: "serif",
    bold: true,
    italic: true,
  },
  {
    key: "cormorant",
    family: "Cormorant Garamond",
    pkg: "cormorant-garamond",
    category: "Serif",
    fallback: "serif",
    bold: true,
    italic: true,
  },
  {
    key: "baskerville",
    family: "Libre Baskerville",
    pkg: "libre-baskerville",
    category: "Serif",
    fallback: "serif",
    bold: true,
    italic: true,
  },
  {
    key: "bebas",
    family: "Bebas Neue",
    pkg: "bebas-neue",
    category: "Display",
    fallback: "sans-serif",
    bold: false,
    italic: false,
  },
  {
    key: "abril",
    family: "Abril Fatface",
    pkg: "abril-fatface",
    category: "Display",
    fallback: "serif",
    bold: false,
    italic: false,
  },
  {
    key: "caveat",
    family: "Caveat",
    pkg: "caveat",
    category: "Handwriting",
    fallback: "cursive",
    bold: true,
    italic: false,
  },
  {
    key: "space-mono",
    family: "Space Mono",
    pkg: "space-mono",
    category: "Monospace",
    fallback: "monospace",
    bold: true,
    italic: true,
  },
]);
const BY_KEY = Object.fromEntries(BUILTIN_FONTS.map((f) => [f.key, f]));
export const builtinFont = (key) => BY_KEY[key];
// CSS font stack for a built-in font key.
export const builtinFontStack = (key) => {
  const f = BY_KEY[key] || BY_KEY.serif;
  return `'${f.family}',${f.fallback}`;
};
// Every packaged file: served name, @fontsource package and file, CSS descriptors.
export const builtinFontFiles = () =>
  BUILTIN_FONTS.flatMap((f) =>
    [
      [400, "normal"],
      ...(f.bold ? [[700, "normal"]] : []),
      ...(f.italic ? [[400, "italic"]] : []),
      ...(f.bold && f.italic ? [[700, "italic"]] : []),
    ].map(([weight, style]) => ({
      name: `${f.key}${weight === 700 ? "-bold" : ""}${style === "italic" ? "-italic" : ""}.woff2`,
      family: f.family,
      pkg: f.pkg,
      file: `${f.pkg}-latin-${weight}-${style}.woff2`,
      weight,
      style,
    })),
  );
// @font-face rules for every built-in font. Browsers only download a file
// once text actually uses that family, weight and style.
export const builtinFontFaceCSS = (urlFor = (name) => `/fonts/${name}`) =>
  builtinFontFiles()
    .map(
      (f) =>
        `@font-face{font-family:'${f.family}';src:url('${urlFor(f.name)}') format('woff2');font-weight:${f.weight};font-style:${f.style};font-display:swap}`,
    )
    .join("");
