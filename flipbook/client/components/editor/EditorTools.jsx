import React, { useRef, useState } from "react";
import { SHAPES, PRODUCT_FIELDS } from "../../../shared/editor-schema.mjs";
import { BUILTIN_FONTS } from "../../../shared/fonts.mjs";
import {
  styleOf,
  brandOf,
  DEFAULT_PRODUCT_FIELDS,
} from "../../../shared/design.mjs";
import {
  applyMark,
  richTextOf,
  setBlockText,
  setParagraphKind,
} from "../../../shared/rich-text.mjs";
import { uid } from "../../../shared/document.mjs";
import { ICONS, ICON_NAMES } from "../../../shared/icons.mjs";
import { imageUrl } from "../../api.js";
import { useFonts } from "./Fonts.jsx";
export const Field = ({ label, children, ...props }) => (
  <label className="field">
    <span>{label}</span>
    {children ? (
      React.cloneElement(children, { "aria-label": label })
    ) : (
      <input aria-label={label} {...props} />
    )}
  </label>
);
export const Check = ({ label, checked, onChange }) => (
  <label className="check-field">
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    {label}
  </label>
);
export const Button = ({ children, ...props }) => (
  <button type="button" className="button small" {...props}>
    {children}
  </button>
);
export const NumberField = ({ label, value, min, max, step = 1, onChange }) => (
  <Field
    label={label}
    type="number"
    value={value}
    min={min}
    max={max}
    step={step}
    onChange={(e) =>
      onChange(Math.max(min, Math.min(max, Number(e.target.value))))
    }
  />
);
export const Color = ({ label, value, onChange }) => (
  <Field
    label={label}
    type="color"
    value={value || "#242722"}
    onChange={(e) => onChange(e.target.value)}
  />
);
const FONT_GROUPS = Object.entries(
  BUILTIN_FONTS.reduce(
    (groups, f) => ({
      ...groups,
      [f.category]: [...(groups[f.category] || []), f],
    }),
    {},
  ),
);
export function Font({ label, value, onChange }) {
  const { fonts } = useFonts();
  const known = fonts.some((f) => f.value === value);
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {FONT_GROUPS.map(([group, list]) => (
          <optgroup key={group} label={group}>
            {list.map((f) => (
              <option key={f.key} value={f.key}>
                {f.family}
              </option>
            ))}
          </optgroup>
        ))}
        {(fonts.length > 0 || (value?.startsWith("custom:") && !known)) && (
          <optgroup label="Uploaded">
            {fonts.map((f) => (
              <option key={f.id} value={f.value}>
                {f.family} (uploaded)
              </option>
            ))}
            {value?.startsWith("custom:") && !known && (
              <option value={value}>Uploaded font</option>
            )}
          </optgroup>
        )}
      </select>
    </Field>
  );
}
export function IconGlyph({ name, color = "currentColor", width = 2 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {(ICONS[name] || []).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
function IconFields({ block, doc, editBlock }) {
  const [query, setQuery] = useState("");
  const words = query.trim().toLowerCase();
  const matches = ICON_NAMES.filter((n) =>
    n.replace(/-/g, " ").includes(words),
  );
  return (
    <>
      <Field
        label="Search icons"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="icon-grid" role="group" aria-label="Icon library">
        {matches.map((name) => (
          <button
            key={name}
            type="button"
            title={name.replace(/-/g, " ")}
            aria-label={`Use ${name.replace(/-/g, " ")} icon`}
            aria-pressed={block.icon === name}
            onClick={() =>
              editBlock((b) => {
                b.icon = name;
              })
            }
          >
            <IconGlyph name={name} />
          </button>
        ))}
        {!matches.length && <p className="muted small">No icons match.</p>}
      </div>
      <Color
        label="Icon color"
        value={block.color || brandOf(doc).accent}
        onChange={(v) =>
          editBlock((b) => {
            b.color = v;
          })
        }
      />
      <NumberField
        label="Line weight"
        min={0.5}
        max={4}
        step={0.25}
        value={block.strokeWidth}
        onChange={(v) =>
          editBlock((b) => {
            b.strokeWidth = v;
          })
        }
      />
      <Field
        label="Icon description (optional)"
        maxLength={200}
        value={block.label || ""}
        onChange={(e) =>
          editBlock((b) => {
            b.label = e.target.value;
          })
        }
      />
    </>
  );
}

export function RichTextEditor({ block, doc, editBlock, change }) {
  const ref = useRef(),
    selection = useRef([0, 0]);
  const [link, setLink] = useState(""),
    [name, setName] = useState("");
  const style = styleOf(block, doc),
    setStyle = (key, value) =>
      editBlock((b) => {
        b.textStyle = { ...b.textStyle, [key]: value };
      });
  const mark = (key, value) =>
    editBlock((b) => {
      const [start, end] = selection.current;
      b.richText = applyMark(richTextOf(b), start, end, key, value);
    });
  return (
    <>
      <Field label="Your words">
        <textarea
          ref={ref}
          rows={7}
          value={block.text}
          onSelect={(e) => {
            selection.current = [
              e.currentTarget.selectionStart,
              e.currentTarget.selectionEnd,
            ];
          }}
          onChange={(e) => editBlock((b) => setBlockText(b, e.target.value))}
        />
      </Field>
      <p className="muted small">Select words above, then apply formatting.</p>
      <div className="button-row rich-toolbar">
        {["bold", "italic", "underline"].map((key) => (
          <Button
            key={key}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => mark(key, true)}
          >
            {key[0].toUpperCase() + key.slice(1)} selection
          </Button>
        ))}
        <Button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            editBlock((b) => {
              let rich = richTextOf(b);
              for (const key of [
                "bold",
                "italic",
                "underline",
                "color",
                "href",
              ])
                rich = applyMark(rich, ...selection.current, key, undefined);
              b.richText = rich;
            })
          }
        >
          Clear selection marks
        </Button>
      </div>
      <Color
        label="Selection color"
        value="#bd5639"
        onChange={(value) => mark("color", value)}
      />
      <Field
        label="Selection link (HTTPS)"
        value={link}
        onChange={(e) => setLink(e.target.value)}
      />
      <Button
        onClick={() => {
          if (/^https:\/\//i.test(link)) mark("href", link);
        }}
      >
        Link selected words
      </Button>
      <Field label="Paragraph style">
        <select
          defaultValue="paragraph"
          onChange={(e) =>
            editBlock((b) => {
              b.richText = setParagraphKind(
                richTextOf(b),
                ...selection.current,
                e.target.value,
              );
            })
          }
        >
          <option value="paragraph">Paragraph</option>
          <option value="bullet">Bullet list</option>
          <option value="number">Numbered list</option>
        </select>
      </Field>
      <div className="field-pair">
        <NumberField
          label="Text size"
          min={10}
          max={64}
          value={style.size}
          onChange={(v) => setStyle("size", v)}
        />
        <Field label="Alignment">
          <select
            value={style.align}
            onChange={(e) => setStyle("align", e.target.value)}
          >
            {["left", "center", "right"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
      </div>
      <Check
        label="Bold text"
        checked={style.bold}
        onChange={(v) => setStyle("bold", v)}
      />
      <Font
        label="Text font"
        value={style.font}
        onChange={(v) => setStyle("font", v)}
      />
      <div className="field-pair">
        <NumberField
          label="Line spacing"
          min={0.8}
          max={3}
          step={0.1}
          value={style.lineHeight}
          onChange={(v) => setStyle("lineHeight", v)}
        />
        <NumberField
          label="Letter spacing"
          min={-2}
          max={12}
          step={0.1}
          value={style.letterSpacing}
          onChange={(v) => setStyle("letterSpacing", v)}
        />
      </div>
      <Color
        label="Text color"
        value={style.color}
        onChange={(v) => setStyle("color", v)}
      />
      <details>
        <summary>Named styles</summary>
        <Field label="Named text style">
          <select
            value={block.styleId || ""}
            onChange={(e) =>
              editBlock((b) => {
                b.styleId = e.target.value || null;
                b.textStyle = {};
              })
            }
          >
            <option value="">Custom</option>
            {(doc.styles || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="New style name"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          disabled={!name.trim() || (doc.styles || []).length >= 50}
          onClick={() =>
            change((d) => {
              const id = uid();
              d.styles.push({ ...style, id, name: name.trim() });
              for (const p of d.pages) {
                const b = p.blocks.find((b) => b.id === block.id);
                if (b) {
                  b.styleId = id;
                  b.textStyle = {};
                }
              }
            })
          }
        >
          Save named style
        </Button>
        <Button
          disabled={!block.styleId}
          onClick={() =>
            change((d) => {
              const s = d.styles.find((s) => s.id === block.styleId);
              if (s) Object.assign(s, style, { id: s.id, name: s.name });
              for (const p of d.pages)
                for (const b of p.blocks)
                  if (b.id === block.id) b.textStyle = {};
            })
          }
        >
          Update shared style
        </Button>
      </details>
    </>
  );
}
export function Appearance({ block, editBlock }) {
  const a = block.appearance || {},
    set = (key, value) =>
      editBlock((b) => {
        b.appearance = { ...b.appearance, [key]: value };
      });
  return (
    <details>
      <summary>Appearance & transforms</summary>
      <div className="field-pair">
        <NumberField
          label="Rotation"
          min={-180}
          max={180}
          value={a.rotation || 0}
          onChange={(v) => set("rotation", v)}
        />
        <NumberField
          label="Opacity"
          min={0}
          max={1}
          step={0.05}
          value={a.opacity ?? 1}
          onChange={(v) => set("opacity", v)}
        />
      </div>
      <Check
        label="Flip horizontally"
        checked={a.flipX}
        onChange={(v) => set("flipX", v)}
      />
      <Check
        label="Flip vertically"
        checked={a.flipY}
        onChange={(v) => set("flipY", v)}
      />
      <div className="field-pair">
        <NumberField
          label="Border width"
          min={0}
          max={12}
          value={a.borderWidth || 0}
          onChange={(v) => set("borderWidth", v)}
        />
        <NumberField
          label="Corner radius"
          min={0}
          max={400}
          value={a.radius || 0}
          onChange={(v) => set("radius", v)}
        />
      </div>
      <Color
        label="Border color"
        value={a.borderColor}
        onChange={(v) => set("borderColor", v)}
      />
      <Color
        label="Element fill"
        value={a.fill || "#bd5639"}
        onChange={(v) => set("fill", v)}
      />
      <Button
        onClick={() =>
          editBlock((b) => {
            if (b.appearance) delete b.appearance.fill;
          })
        }
      >
        Clear fill
      </Button>
      {["image", "gallery", "product"].includes(block.type) && (
        <Field label="Image frame">
          <select
            value={a.frame || "rectangle"}
            onChange={(e) => set("frame", e.target.value)}
          >
            {["rectangle", "circle", "ellipse", "diamond"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
      )}
    </details>
  );
}
export function CropPreview({ block, editBlock }) {
  const [draft, setDraft] = useState(null),
    drag = useRef();
  const crop = draft || block.crop || { x: 50, y: 50, zoom: 1 };
  if (!block.assetId) return null;
  return (
    <>
      <div
        className="crop-preview"
        role="img"
        aria-label="Image crop preview: drag to pan"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, crop };
        }}
        onPointerMove={(e) => {
          if (drag.current) {
            const c = drag.current;
            setDraft({
              ...c.crop,
              x: Math.max(0, Math.min(100, c.crop.x - (e.clientX - c.x) / 2)),
              y: Math.max(0, Math.min(100, c.crop.y - (e.clientY - c.y) / 2)),
            });
          }
        }}
        onPointerUp={() => {
          if (draft)
            editBlock((b) => {
              b.crop = draft;
            });
          drag.current = null;
          setDraft(null);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDraft(null);
        }}
      >
        <img
          draggable="false"
          src={imageUrl(block.assetId)}
          alt=""
          style={{
            objectPosition: `${crop.x}% ${crop.y}%`,
            transform: `scale(${crop.zoom})`,
          }}
        />
        <span>Drag to pan the crop</span>
      </div>
      <Button
        onClick={() =>
          editBlock((b) => {
            b.crop = { x: 50, y: 50, zoom: 1 };
          })
        }
      >
        Reset crop
      </Button>
    </>
  );
}
export function ExtendedBlockFields({ block, doc, editBlock, change, pick }) {
  return (
    <>
      {block.type === "shape" && (
        <Field label="Shape">
          <select
            value={block.shape}
            onChange={(e) =>
              editBlock((b) => {
                b.shape = e.target.value;
              })
            }
          >
            {SHAPES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      )}
      {block.type === "icon" && (
        <IconFields block={block} doc={doc} editBlock={editBlock} />
      )}
      {block.type === "gallery" && (
        <>
          <Button
            disabled={block.images.length >= 12}
            onClick={() => pick("gallery")}
          >
            Add gallery image
          </Button>
          <NumberField
            label="Gallery columns"
            min={1}
            max={4}
            value={block.columns}
            onChange={(v) =>
              editBlock((b) => {
                b.columns = v;
              })
            }
          />
          <NumberField
            label="Gallery gap"
            min={0}
            max={24}
            value={block.gap}
            onChange={(v) =>
              editBlock((b) => {
                b.gap = v;
              })
            }
          />
          {block.images.map((im, i) => (
            <div key={i} className="gallery-editor-row">
              <img src={imageUrl(im.assetId)} alt="" />
              <Field
                label={`Gallery image ${i + 1} description`}
                value={im.alt}
                maxLength={500}
                onChange={(e) =>
                  editBlock((b) => {
                    b.images[i].alt = e.target.value;
                  })
                }
              />
              <Button
                disabled={i === 0}
                onClick={() =>
                  editBlock((b) => {
                    [b.images[i - 1], b.images[i]] = [
                      b.images[i],
                      b.images[i - 1],
                    ];
                  })
                }
              >
                Move image up
              </Button>
              <Button
                onClick={() =>
                  editBlock((b) => {
                    b.images.splice(i, 1);
                  })
                }
              >
                Remove image
              </Button>
            </div>
          ))}
        </>
      )}
      {block.type === "hotspot" && (
        <>
          <Field
            label="Hotspot label"
            value={block.label}
            maxLength={200}
            onChange={(e) =>
              editBlock((b) => {
                b.label = e.target.value;
              })
            }
          />
          <Check
            label="Show hotspot label"
            checked={block.showLabel}
            onChange={(v) =>
              editBlock((b) => {
                b.showLabel = v;
              })
            }
          />
          <Field label="Hotspot destination">
            <select
              value={block.action.kind}
              onChange={(e) =>
                editBlock((b) => {
                  const kind = e.target.value;
                  b.action =
                    kind === "url"
                      ? { kind, url: "https://example.com" }
                      : kind === "page"
                        ? { kind, pageId: doc.pages[0].id }
                        : {
                            kind,
                            blockId:
                              doc.pages
                                .flatMap((p) => p.blocks)
                                .find((b) => b.type === "product")?.id || "",
                          };
                })
              }
            >
              {["url", "page", "product"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          {block.action.kind === "url" ? (
            <Field
              label="Hotspot URL"
              value={block.action.url}
              onChange={(e) =>
                editBlock((b) => {
                  b.action.url = e.target.value;
                })
              }
            />
          ) : (
            <Field label="Hotspot target">
              <select
                value={block.action.pageId || block.action.blockId || ""}
                onChange={(e) =>
                  editBlock((b) => {
                    b.action[b.action.kind === "page" ? "pageId" : "blockId"] =
                      e.target.value;
                  })
                }
              >
                <option value="">Choose destination</option>
                {(block.action.kind === "page"
                  ? doc.pages.map((p, i) => ({
                      id: p.id,
                      label: `${i + 1}. ${p.title}`,
                    }))
                  : doc.pages
                      .flatMap((p) => p.blocks)
                      .filter((b) => b.type === "product")
                      .map((b) => ({
                        id: b.id,
                        label: b.product.name || "Untitled product",
                      }))
                ).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </>
      )}
      {block.type === "media" && (
        <>
          <Field label="Media type">
            <select
              value={block.mediaKind}
              onChange={(e) =>
                editBlock((b) => {
                  b.mediaKind = e.target.value;
                })
              }
            >
              <option>video</option>
              <option>audio</option>
            </select>
          </Field>
          <Field
            label="Media URL (HTTPS)"
            value={block.url}
            onChange={(e) =>
              editBlock((b) => {
                b.url = e.target.value;
              })
            }
          />
          <Field
            label="Media title"
            value={block.title}
            maxLength={160}
            onChange={(e) =>
              editBlock((b) => {
                b.title = e.target.value;
              })
            }
          />
          <Field label="Media description">
            <textarea
              value={block.description}
              maxLength={1000}
              onChange={(e) =>
                editBlock((b) => {
                  b.description = e.target.value;
                })
              }
            />
          </Field>
          <Button onClick={() => pick("poster")}>Choose media poster</Button>
          {block.posterId && (
            <img
              className="inspector-image"
              src={imageUrl(block.posterId)}
              alt="Media poster"
            />
          )}
          <p className="muted small">
            Native player, no autoplay. The PDF shows a poster and link.
          </p>
        </>
      )}
      {block.type === "product" && (
        <ProductPresentation
          block={block}
          editBlock={editBlock}
          change={change}
        />
      )}
      <Appearance block={block} editBlock={editBlock} />
    </>
  );
}
function ProductPresentation({ block, editBlock, change }) {
  const p = block.presentation || { fields: DEFAULT_PRODUCT_FIELDS },
    set = (k, v) =>
      editBlock((b) => {
        b.presentation = { ...p, [k]: v };
      });
  return (
    <details>
      <summary>Product presentation</summary>
      {PRODUCT_FIELDS.map((f) => (
        <Check
          key={f}
          label={`Show ${f}`}
          checked={p.fields.includes(f)}
          onChange={(v) =>
            set(
              "fields",
              v ? [...p.fields, f] : p.fields.filter((x) => x !== f),
            )
          }
        />
      ))}
      <Field label="Product image layout">
        <select
          value={p.imageLayout || "single"}
          onChange={(e) => set("imageLayout", e.target.value)}
        >
          <option value="single">Single image</option>
          <option value="thumbnails">Main image with thumbnails</option>
          <option value="grid">Image grid</option>
        </select>
      </Field>
      {(block.product?.images?.length || 0) < 2 && (
        <p className="muted small">
          Add more product images to show thumbnails or a grid.
        </p>
      )}
      <NumberField
        label="Price size"
        min={10}
        max={48}
        value={p.priceSize || 18}
        onChange={(v) => set("priceSize", v)}
      />
      {["priceColor", "badgeColor", "badgeTextColor", "background"].map((k) => (
        <Color
          key={k}
          label={
            {
              priceColor: "Price color",
              badgeColor: "Badge color",
              badgeTextColor: "Badge text color",
              background: "Card background",
            }[k]
          }
          value={p[k]}
          onChange={(v) => set(k, v)}
        />
      ))}
      <Button
        onClick={() =>
          change((d) => {
            for (const page of d.pages)
              for (const b of page.blocks)
                if (b.type === "product") b.presentation = structuredClone(p);
          })
        }
      >
        Apply presentation to all products
      </Button>
    </details>
  );
}
export function LayersPanel({ page, ids, select, changePage }) {
  return (
    <details className="layers-panel" open>
      <summary>Layers · {page.blocks.length}</summary>
      <p className="muted small">
        Topmost first. Shift-click to select several.
      </p>
      {[...page.blocks].reverse().map((b) => (
        <div
          className={"layer-row " + (ids.includes(b.id) ? "active" : "")}
          key={b.id}
        >
          <button
            type="button"
            className="layer-select"
            aria-label={`Select layer ${b.name || b.type}`}
            aria-pressed={ids.includes(b.id)}
            onClick={(e) => select(b.id, e.shiftKey)}
          >
            {b.name || b.type}
            {b.groupId ? " · group" : ""}
          </button>
          <button
            type="button"
            aria-label={`${b.locked ? "Unlock" : "Lock"} layer ${b.name || b.type}`}
            onClick={() =>
              changePage((p) => {
                p.blocks.find((x) => x.id === b.id).locked = !b.locked;
              })
            }
          >
            {b.locked ? "🔒" : "○"}
          </button>
          <button
            type="button"
            aria-label={`${b.hidden ? "Show" : "Hide"} layer ${b.name || b.type}`}
            onClick={() =>
              changePage((p) => {
                p.blocks.find((x) => x.id === b.id).hidden = !b.hidden;
              })
            }
          >
            {b.hidden ? "—" : "◉"}
          </button>
        </div>
      ))}
    </details>
  );
}
