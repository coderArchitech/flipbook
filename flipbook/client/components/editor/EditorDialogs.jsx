import React, { useEffect, useState } from "react";
import { Modal } from "../Modal.jsx";
import {
  Field,
  Check,
  Button,
  NumberField,
  Color,
  Font,
} from "./EditorTools.jsx";
import { api, imageUrl } from "../../api.js";
import { FontUpload } from "./Fonts.jsx";
import { MARGIN_LIMITS } from "../../../shared/editor-schema.mjs";
import { brandOf } from "../../../shared/design.mjs";
import { uid, makePage } from "../../../shared/document.mjs";
import {
  newElement,
  cloneBlocks,
  copyPage,
  pasteBlocks,
  generateProductPages,
  selectedBlocks,
} from "../../../shared/editor-commands.mjs";
import { setBlockText } from "../../../shared/rich-text.mjs";
import {
  parseCsv,
  suggestMapping,
  previewImport,
  IMPORT_FIELDS,
} from "../../../shared/catalog-import.mjs";
import { renderPage } from "../../../shared/render.mjs";

export function PageDesign({ doc, pageIndex, change, pick, onClose }) {
  const page = doc.pages[pageIndex],
    brand = brandOf(doc),
    bg = page.background || { type: "solid", color: brand.paper };
  const [masterId, setMasterId] = useState(page.masterId || ""),
    [masterName, setMasterName] = useState("Shared header & footer");
  const master = (doc.masters || []).find((m) => m.id === masterId);
  const background = (key, value) =>
    change((d) => {
      d.pages[pageIndex].background = { ...bg, [key]: value };
    });
  const editMaster = (fn) =>
    change((d) => {
      const m = d.masters.find((m) => m.id === masterId);
      if (m) fn(m);
    });
  return (
    <Modal title="Page design & brand" onClose={onClose} wide>
      <div className="editor-dialog-columns">
        <section>
          <h3>Page background</h3>
          <Field
            label="Page title"
            value={page.title}
            onChange={(e) =>
              change((d) => {
                d.pages[pageIndex].title = e.target.value;
              })
            }
          />
          <Field label="Background type">
            <select
              value={bg.type}
              onChange={(e) =>
                change((d) => {
                  d.pages[pageIndex].background = {
                    type: e.target.value,
                    color: bg.color || brand.paper,
                    color2: "#e5d9cc",
                    angle: 135,
                    ...(e.target.value === "image"
                      ? { assetId: "", crop: { x: 50, y: 50, zoom: 1 } }
                      : {}),
                  };
                })
              }
            >
              {["solid", "gradient", "image"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Color
            label="Background color"
            value={bg.color}
            onChange={(v) => background("color", v)}
          />
          {bg.type === "gradient" && (
            <>
              <Color
                label="Gradient end color"
                value={bg.color2}
                onChange={(v) => background("color2", v)}
              />
              <NumberField
                label="Gradient angle"
                min={0}
                max={360}
                value={bg.angle}
                onChange={(v) => background("angle", v)}
              />
            </>
          )}
          {bg.type === "image" && (
            <>
              <Button onClick={() => pick((id) => background("assetId", id))}>
                Choose background image
              </Button>
              {bg.assetId && (
                <img
                  className="inspector-image"
                  src={imageUrl(bg.assetId)}
                  alt="Page background"
                />
              )}
              {["x", "y", "zoom"].map((k) => (
                <NumberField
                  key={k}
                  label={`Background ${k}`}
                  min={k === "zoom" ? 1 : 0}
                  max={k === "zoom" ? 3 : 100}
                  step={k === "zoom" ? 0.1 : 1}
                  value={bg.crop?.[k] ?? (k === "zoom" ? 1 : 50)}
                  onChange={(v) =>
                    background("crop", {
                      x: 50,
                      y: 50,
                      zoom: 1,
                      ...bg.crop,
                      [k]: v,
                    })
                  }
                />
              ))}
            </>
          )}
          <Color
            label="Overlay color"
            value={bg.overlayColor || "#000000"}
            onChange={(v) => background("overlayColor", v)}
          />
          <NumberField
            label="Overlay opacity"
            min={0}
            max={1}
            step={0.05}
            value={bg.overlayOpacity || 0}
            onChange={(v) => background("overlayOpacity", v)}
          />
          <Check
            label="Show page footer"
            checked={page.footer !== false}
            onChange={(v) =>
              change((d) => {
                d.pages[pageIndex].footer = v;
              })
            }
          />
          <h3>Brand kit</h3>
          {["ink", "paper", "accent"].map((k) => (
            <Color
              key={k}
              label={`Brand ${k}`}
              value={brand[k]}
              onChange={(v) =>
                change((d) => {
                  d.brand[k] = v;
                })
              }
            />
          ))}
          <Font
            label="Heading font"
            value={brand.headingFont}
            onChange={(v) =>
              change((d) => {
                d.brand.headingFont = v;
              })
            }
          />
          <Font
            label="Body font"
            value={brand.bodyFont}
            onChange={(v) =>
              change((d) => {
                d.brand.bodyFont = v;
              })
            }
          />
          <FontUpload />
          <Button
            onClick={() =>
              pick((id) =>
                change((d) => {
                  d.brand.logoAssetId = id;
                }),
              )
            }
          >
            Choose brand logo
          </Button>
          {brand.logoAssetId && (
            <img
              className="brand-logo-preview"
              src={imageUrl(brand.logoAssetId)}
              alt="Brand logo"
            />
          )}
        </section>
        <section>
          <h3>Master pages</h3>
          <p className="muted small">
            Shared elements sit behind page layers. Use {"{{page}}"},{" "}
            {"{{pages}}"} or {"{{publisher}}"} in master text.
          </p>
          <Field label="Page master">
            <select
              value={page.masterId || ""}
              onChange={(e) => {
                const id = e.target.value;
                setMasterId(id);
                change((d) => {
                  d.pages[pageIndex].masterId = id || null;
                });
              }}
            >
              <option value="">None</option>
              {(doc.masters || []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="New master name"
            maxLength={80}
            value={masterName}
            onChange={(e) => setMasterName(e.target.value)}
          />
          <Button
            disabled={!masterName.trim() || (doc.masters || []).length >= 10}
            onClick={() => {
              const id = uid();
              change((d) => {
                d.masters.push({
                  id,
                  name: masterName,
                  blocks: [newElement("text", [0, 0, 12, 2])],
                });
                const m = d.masters.at(-1);
                setBlockText(
                  m.blocks[0],
                  "{{publisher}} · {{page}} / {{pages}}",
                );
                m.blocks[0].size = 14;
                d.pages[pageIndex].masterId = id;
              });
              setMasterId(id);
            }}
          >
            Create master
          </Button>
          {master && (
            <>
              <Field
                label="Master name"
                maxLength={80}
                value={master.name}
                onChange={(e) =>
                  editMaster((m) => {
                    m.name = e.target.value;
                  })
                }
              />
              <Button
                onClick={() =>
                  change((d) => {
                    for (const p of d.pages) p.masterId = masterId;
                  })
                }
              >
                Apply master to all pages
              </Button>
              <fieldset className="master-margins">
                <legend>Page margins (grid units)</legend>
                <p className="muted small">
                  Non-printing guides for pages using this master: snap, align
                  and warn when content crosses them.
                </p>
                <div className="field-pair">
                  {Object.entries(MARGIN_LIMITS).map(([k, max]) => (
                    <NumberField
                      key={k}
                      label={`Margin ${k}`}
                      min={0}
                      max={max}
                      step={0.25}
                      value={master.margins?.[k] ?? 0}
                      onChange={(v) =>
                        editMaster((m) => {
                          m.margins = {
                            left: 0,
                            right: 0,
                            top: 0,
                            bottom: 0,
                            ...m.margins,
                            [k]: v,
                          };
                        })
                      }
                    />
                  ))}
                </div>
                <Button
                  disabled={!master.margins}
                  onClick={() =>
                    editMaster((m) => {
                      delete m.margins;
                    })
                  }
                >
                  Remove margins
                </Button>
              </fieldset>
              <Button
                disabled={master.blocks.length >= 20}
                onClick={() =>
                  editMaster((m) =>
                    m.blocks.push(newElement("text", [0, 33, 12, 2])),
                  )
                }
              >
                Add master text
              </Button>
              <Button
                disabled={!brand.logoAssetId || master.blocks.length >= 20}
                onClick={() =>
                  editMaster((m) => {
                    const b = newElement("image", [0, 0, 2, 3]);
                    b.assetId = brand.logoAssetId;
                    b.alt = "Brand logo";
                    m.blocks.push(b);
                  })
                }
              >
                Add master logo
              </Button>
              {master.blocks.map((b, i) => (
                <div className="master-block" key={b.id}>
                  <strong>
                    Shared {b.type} {i + 1}
                  </strong>
                  {b.type === "text" && (
                    <>
                      <Field label={`Master text ${i + 1}`}>
                        <textarea
                          value={b.text}
                          onChange={(e) =>
                            editMaster((m) =>
                              setBlockText(m.blocks[i], e.target.value),
                            )
                          }
                        />
                      </Field>
                      <NumberField
                        label={`Master text size ${i + 1}`}
                        value={b.size}
                        min={10}
                        max={64}
                        onChange={(v) =>
                          editMaster((m) => {
                            m.blocks[i].size = v;
                          })
                        }
                      />
                    </>
                  )}
                  <div className="geometry-fields">
                    {["Column", "Row", "Width", "Height"].map((key, n) => (
                      <NumberField
                        key={key}
                        label={`Master ${i + 1} ${key}`}
                        value={b.rect[n]}
                        min={n < 2 ? 0 : 1}
                        max={n % 2 ? 36 : 12}
                        step={0.25}
                        onChange={(v) =>
                          editMaster((m) => {
                            const r = m.blocks[i].rect;
                            r[n] = Math.min(
                              v,
                              n < 2
                                ? (n % 2 ? 36 : 12) - r[n + 2]
                                : (n % 2 ? 36 : 12) - r[n - 2],
                            );
                          })
                        }
                      />
                    ))}
                  </div>
                  <Button
                    onClick={() =>
                      editMaster((m) => {
                        m.blocks.splice(i, 1);
                      })
                    }
                  >
                    Remove shared element {i + 1}
                  </Button>
                </div>
              ))}
              <Button
                onClick={() =>
                  change((d) => {
                    d.masters = d.masters.filter((m) => m.id !== masterId);
                    for (const p of d.pages)
                      if (p.masterId === masterId) p.masterId = null;
                  })
                }
              >
                Delete master
              </Button>
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
function resourceContent(kind, doc, page, ids) {
  const common = { styles: doc.styles || [], brand: brandOf(doc) };
  if (kind === "brand") return common;
  const blocks = kind === "group" ? selectedBlocks(page, ids) : page.blocks;
  // A portable resource cannot retain links to another publication's pages/products.
  const contained = new Set(blocks.map((b) => b.id));
  if (
    blocks.some(
      (b) =>
        (b.action?.kind === "page" && b.action.pageId !== page.id) ||
        (b.action?.kind === "product" && !contained.has(b.action.blockId)),
    )
  )
    throw Error(
      "Remove links to other pages or unselected products before saving this reusable design.",
    );
  if (kind === "group" && blocks.some((b) => b.action?.kind === "page"))
    throw Error("Page links cannot be stored in a reusable group.");
  return kind === "page"
    ? {
        ...common,
        page,
        masters: (doc.masters || []).filter((m) => m.id === page.masterId),
      }
    : { ...common, blocks };
}
export function ResourcesDialog({
  doc,
  pageIndex,
  ids,
  change,
  onSelectPage,
  onClose,
  onError,
}) {
  const [resources, setResources] = useState([]),
    [name, setName] = useState(""),
    [kind, setKind] = useState("page"),
    [busy, setBusy] = useState(false);
  const refresh = () => api("/design-resources").then(setResources);
  useEffect(() => {
    refresh().catch(onError);
  }, []);
  const action = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  const apply = (r) => {
    try {
      change((d) => {
        const c = structuredClone(r.content),
          styleMap = new Map((c.styles || []).map((s) => [s.id, uid()]));
        const styles = (c.styles || []).map((s) => ({
          ...s,
          id: styleMap.get(s.id),
        }));
        const restyle = (b) => {
          if (b.styleId) b.styleId = styleMap.get(b.styleId);
        };
        if (d.styles.length + styles.length > 50)
          throw Error("Applying this design would exceed 50 named styles.");
        d.styles.push(...styles);
        if (r.kind === "brand") {
          d.brand = c.brand;
          return;
        }
        if (r.kind === "page") {
          if (d.pages.length >= 100) throw Error("Maximum 100 pages.");
          const page = copyPage(c.page);
          page.blocks.forEach(restyle);
          if (page.masterId) {
            if (d.masters.length >= 10) throw Error("Maximum 10 masters.");
            const m = c.masters.find((m) => m.id === page.masterId);
            const master = { ...m, id: uid(), blocks: cloneBlocks(m.blocks) };
            master.blocks.forEach(restyle);
            d.masters.push(master);
            page.masterId = master.id;
          }
          d.pages.push(page);
        } else {
          const blocks = structuredClone(c.blocks);
          blocks.forEach(restyle);
          pasteBlocks(d.pages[pageIndex], blocks);
        }
      });
      if (r.kind === "page") onSelectPage(doc.pages.length);
      onClose();
    } catch (e) {
      onError(e);
    }
  };
  return (
    <Modal title="Reusable designs" onClose={onClose} wide>
      <div className="editor-dialog-columns">
        <section>
          <h3>Save to your library</h3>
          <Field label="Design type">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="page">Current page template</option>
              <option value="group">Selected elements</option>
              <option value="brand">Brand kit & styles</option>
            </select>
          </Field>
          <Field
            label="Reusable design name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            disabled={busy || !name.trim() || (kind === "group" && !ids.length)}
            onClick={() =>
              action(() =>
                api("/design-resources", {
                  method: "POST",
                  body: {
                    kind,
                    name,
                    content: resourceContent(
                      kind,
                      doc,
                      doc.pages[pageIndex],
                      ids,
                    ),
                  },
                }),
              )
            }
          >
            Save reusable design
          </Button>
          <p className="muted small">
            Templates are independent copies. Updating the library does not
            change existing pages.
          </p>
        </section>
        <section>
          <h3>Your library</h3>
          {resources.length === 0 && <p>No saved designs yet.</p>}
          {resources.map((r) => (
            <article className="resource-row" key={r.id}>
              <strong>{r.name}</strong>
              <small>
                {r.kind} · revision {r.revision}
              </small>
              <div className="button-row">
                <Button disabled={busy} onClick={() => apply(r)}>
                  Apply {r.name}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() =>
                    action(() =>
                      api("/design-resources/" + r.id, {
                        method: "PUT",
                        body: {
                          kind: r.kind,
                          name: r.name,
                          revision: r.revision,
                          content: resourceContent(
                            r.kind,
                            doc,
                            doc.pages[pageIndex],
                            ids,
                          ),
                        },
                      }),
                    )
                  }
                >
                  Replace {r.name}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() =>
                    action(() =>
                      api("/design-resources/" + r.id, { method: "DELETE" }),
                    )
                  }
                >
                  Delete {r.name}
                </Button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </Modal>
  );
}
export function ImportDialog({ assets, change, onProducts, onClose, onError }) {
  const [source, setSource] = useState(""),
    [parsed, setParsed] = useState(null),
    [mapping, setMapping] = useState({}),
    [template, setTemplate] = useState("grid"),
    [busy, setBusy] = useState(false),
    [imported, setImported] = useState(null);
  let result = null;
  try {
    if (parsed) {
      const rows = previewImport(parsed, mapping, assets);
      result = {
        products: rows.map((r) => r.product),
        findings: rows.flatMap((r) =>
          r.errors.map((message) => ({ row: r.row, message })),
        ),
      };
    }
  } catch (e) {
    result = { findings: [{ message: e.message }], products: [] };
  }
  const parse = (text) => {
    setSource(text);
    setImported(null);
    try {
      const p = parseCsv(text);
      setParsed(p);
      setMapping(suggestMapping(p.headers));
    } catch (e) {
      setParsed(null);
      onError(e);
    }
  };
  return (
    <Modal title="Import a product catalog" onClose={onClose} wide>
      <p>
        Upload a CSV or paste it below. Image cells must match an uploaded
        filename or image ID.
      </p>
      <Field
        label="CSV file"
        type="file"
        accept=".csv,text/csv"
        onChange={async (e) => {
          const file = e.target.files[0];
          if (file) {
            if (file.size > 2 * 1024 ** 2)
              return onError(Error("CSV must be under 2 MB."));
            parse(await file.text());
          }
        }}
      />
      <Field label="CSV data">
        <textarea
          rows={5}
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setParsed(null);
            setImported(null);
          }}
        />
      </Field>
      <Button onClick={() => parse(source)}>Preview CSV</Button>
      {parsed && (
        <>
          <div className="mapping-grid">
            {IMPORT_FIELDS.map((f) => (
              <Field key={f} label={`Map ${f}`}>
                <select
                  value={mapping[f] ?? -1}
                  onChange={(e) => {
                    setMapping({ ...mapping, [f]: Number(e.target.value) });
                    setImported(null);
                  }}
                >
                  <option value={-1}>Not mapped</option>
                  {parsed.headers.map((h, i) => (
                    <option key={h} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <p>{result?.products?.length || 0} products ready for preview</p>
          {result?.findings?.map((f, i) => (
            <p role="alert" key={i}>
              {f.row ? `Row ${f.row}: ` : ""}
              {f.message}
            </p>
          ))}
          <div className="import-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Summary</th>
                  <th>Price</th>
                  <th>SKU</th>
                  <th>Images</th>
                </tr>
              </thead>
              <tbody>
                {result?.products?.slice(0, 20).map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td>{p.summary}</td>
                    <td>{p.price}</td>
                    <td>{p.sku}</td>
                    <td>{p.images.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            disabled={
              busy ||
              !!imported ||
              !!result?.findings?.length ||
              !result?.products?.length
            }
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api("/products/import", {
                  method: "POST",
                  body: { products: result.products },
                });
                setImported(r.products);
                onProducts(r.products);
              } catch (e) {
                onError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            Import products
          </Button>
        </>
      )}
      {imported && (
        <>
          <p role="status">
            Imported {imported.length} products into your catalog.
          </p>
          <Field label="Generated page layout">
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              <option value="grid">Four-product grid</option>
              <option value="feature">One product per page</option>
            </select>
          </Field>
          <Button
            onClick={() => {
              try {
                change((d) => generateProductPages(d, imported, template));
                onClose();
              } catch (e) {
                onError(e);
              }
            }}
          >
            Generate product pages
          </Button>
        </>
      )}
    </Modal>
  );
}
export function HistoryDialog({ id, restore, onClose, onError }) {
  const [rows, setRows] = useState([]),
    [snapshot, setSnapshot] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/publications/" + id + "/history")
      .then(setRows)
      .catch(onError);
  }, [id]);
  return (
    <Modal title="Saved draft history" onClose={onClose} wide>
      <p>
        Latest 100 saved revisions. Restoring creates a new draft revision and
        does not republish.
      </p>
      <div className="history-layout">
        <section>
          {rows.map((r) => (
            <Button
              key={r.revision}
              onClick={() =>
                api(`/publications/${id}/history/${r.revision}`)
                  .then(setSnapshot)
                  .catch(onError)
              }
            >
              Revision {r.revision} · {r.reason} ·{" "}
              {new Date(r.created_at).toLocaleString()}
            </Button>
          ))}
        </section>
        <section>
          {snapshot && (
            <>
              <h3>
                {snapshot.document.title} · revision {snapshot.revision}
              </h3>
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await restore(snapshot.revision);
                    onClose();
                  } catch (e) {
                    onError(e);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Restore revision {snapshot.revision}
              </Button>
              <div
                className="history-preview magazine"
                dangerouslySetInnerHTML={{
                  __html: renderPage(
                    snapshot.document.pages[0],
                    snapshot.document,
                    imageUrl,
                  ),
                }}
              />
              <p>{snapshot.document.pages.length} pages in this revision</p>
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
export function ReviewDialog({
  id,
  doc,
  pageIndex,
  selected,
  change,
  saveRevision,
  onAnchor,
  onClose,
  onError,
}) {
  const [comments, setComments] = useState([]),
    [state, setState] = useState(null),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = async () => {
    const [c, s] = await Promise.all([
      api(`/publications/${id}/comments`),
      api(`/publications/${id}/approval`),
    ]);
    setComments(c);
    setState(s);
  };
  useEffect(() => {
    refresh().catch(onError);
  }, [id]);
  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Review & approval" onClose={onClose} wide>
      <p>
        Private workspace review notes. Approval applies only to the exact saved
        revision.
      </p>
      <Check
        label="Require approval before publishing"
        checked={doc.requireApproval}
        onChange={(v) =>
          change((d) => {
            d.requireApproval = v;
          })
        }
      />
      <p role="status">
        {state?.approved
          ? `Revision ${state.revision} approved`
          : `Revision ${state?.revision || "…"} needs approval`}{" "}
        · {state?.unresolved || 0} open notes
      </p>
      <Button
        disabled={busy}
        onClick={() =>
          act(async () => {
            const revision = await saveRevision();
            await api(`/publications/${id}/approval`, {
              method: "POST",
              body: { revision },
            });
          })
        }
      >
        Approve saved revision
      </Button>
      <hr />
      <p>
        New note: page {pageIndex + 1}
        {selected ? " · selected element" : ""}
      </p>
      <Field label="Review note">
        <textarea
          maxLength={4000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <Button
        disabled={busy || !text.trim()}
        onClick={() =>
          act(async () => {
            await saveRevision();
            await api(`/publications/${id}/comments`, {
              method: "POST",
              body: {
                pageId: doc.pages[pageIndex].id,
                blockId: selected,
                text,
              },
            });
            setText("");
          })
        }
      >
        Add review note
      </Button>
      {comments.map((c) => (
        <article className="review-note" key={c.id}>
          <p>{c.text}</p>
          <small>
            {c.author} · {c.resolved ? "Resolved" : "Open"}
          </small>
          <div className="button-row">
            <Button
              onClick={() => {
                onAnchor(c.page_id, c.block_id);
                onClose();
              }}
            >
              Go to note
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                act(() =>
                  api(`/publications/${id}/comments/${c.id}`, {
                    method: "PATCH",
                    body: { revision: c.revision, resolved: !c.resolved },
                  }),
                )
              }
            >
              {c.resolved ? "Reopen note" : "Resolve note"}
            </Button>
          </div>
        </article>
      ))}
    </Modal>
  );
}
