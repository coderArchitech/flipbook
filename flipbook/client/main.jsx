import React, { useEffect, useState, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Search,
  Image as ImageIcon,
  Package,
  LayoutGrid,
  LogOut,
  MoreHorizontal,
  Copy,
  Archive,
  Trash2,
  Check,
  Download,
  ExternalLink,
  Eye,
  Undo2,
  Redo2,
  X,
  Upload,
  ChevronDown,
  ChevronUp,
  Type,
  MousePointer2,
  GripVertical,
  BarChart3,
  Settings,
  Link as LinkIcon,
  AlertCircle,
  Loader2,
  FileText,
  Maximize2,
  Smile,
} from "lucide-react";
import {
  api,
  setCsrf,
  uploadImage,
  imageUrl,
  navigate,
  serverOutdated,
  onServerBuild,
} from "./api.js";
import {
  makePage,
  duplicatePage,
  block,
  emptyProduct,
  TEMPLATES,
  THEMES,
  validateDocument,
  formatPrice,
} from "../shared/document.mjs";
import { pageCSS, renderPage, themeStyle } from "../shared/render.mjs";
import { rectangle, PAGE } from "../shared/layout.mjs";
import {
  upgradeDocument,
  selectionIds,
  selectedBlocks,
  bounds,
  moveSelection,
  resizeSelection,
  groupSelection,
  ungroupSelection,
  reorderLayers,
  alignSelection,
  distributeSelection,
  snappedMove,
  pasteBlocks,
  newElement,
} from "../shared/editor-commands.mjs";
import { setBlockText } from "../shared/rich-text.mjs";
import { layoutWarnings, marginBox } from "../shared/design.mjs";
import { FontsProvider } from "./components/editor/Fonts.jsx";
import {
  IssuesDialog,
  ServerVersionNotice,
} from "./components/editor/IssuesDialog.jsx";
import {
  RichTextEditor,
  ExtendedBlockFields,
  CropPreview,
  LayersPanel,
} from "./components/editor/EditorTools.jsx";
import {
  PageDesign,
  ResourcesDialog,
  ImportDialog,
  HistoryDialog,
  ReviewDialog,
} from "./components/editor/EditorDialogs.jsx";
import "./style.css";
import { builtinFontFaceCSS } from "../shared/fonts.mjs";
import { BookPreview } from "./components/BookPreview.jsx";
import { Modal } from "./components/Modal.jsx";
import "../public/book-viewer.css";

let showToast = () => {};
function Toasts() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer;
    showToast = (m) => {
      setMessage(m);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(""), 5000);
    };
    return () => clearTimeout(timer);
  }, []);
  return message ? (
    <div className="toast" role="status">
      <Check size={17} />
      {message}
    </div>
  ) : null;
}
function IconButton({ label, children, ...props }) {
  return (
    <button className="icon-button" title={label} aria-label={label} {...props}>
      {children}
    </button>
  );
}
function Field({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}
function Spinner({ text = "Loading your studio…" }) {
  return (
    <div className="loading">
      <Loader2 className="spin" size={24} />
      <span>{text}</span>
    </div>
  );
}
function Thumbnail({ doc, page = doc.pages[0], width = 210 }) {
  return (
    <div
      className="thumb"
      aria-hidden="true"
      inert
      style={{ width, height: (width * 1123) / 794 }}
    >
      <div
        className="magazine"
        style={{
          ...styleTheme(doc.theme),
          transform: "scale(" + width / 794 + ")",
          transformOrigin: "top left",
          width: 794,
        }}
        dangerouslySetInnerHTML={{
          __html: page ? renderPage(page, doc, imageUrl) : "",
        }}
      />
    </div>
  );
}
function styleTheme(theme) {
  const t = THEMES[theme] || THEMES.editorial;
  return {
    "--ink": t.ink,
    "--paper": t.paper,
    "--accent": t.accent,
    "--font": t.font,
  };
}

function Auth({ onLogin }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(e.target));
    try {
      const result = await api("/auth/" + (register ? "register" : "login"), {
        method: "POST",
        body,
      });
      setCsrf(result.csrf);
      onLogin(result.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-screen">
      <section className="auth-art">
        <div className="wordmark">
          flipbook<span>®</span>
        </div>
        <div className="auth-headline">
          A collection.
          <br />A story.
          <br />
          <em>Your point of view.</em>
        </div>
        <div className="art-shapes">
          <div />
          <div />
          <div />
        </div>
        <p>
          Turn your products into something
          <br />
          people want to spend time with.
        </p>
        <span className="auth-foot">MADE FOR THE THOUGHTFUL CURATOR</span>
      </section>
      <section className="auth-form">
        <div className="eyebrow">YOUR PUBLISHING STUDIO</div>
        <h1>
          {register ? "Make yourself at home." : "Good to see you again."}
        </h1>
        <p>
          {register
            ? "Create your local workspace. Your first magazine is waiting."
            : "Sign in and pick up where your inspiration left off."}
        </p>
        <form onSubmit={submit}>
          {register && (
            <Field
              label="Your name"
              name="name"
              autoComplete="name"
              required
              maxLength={80}
            />
          )}
          <Field
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={register ? 10 : 1}
            maxLength={128}
            required
          />
          {register && (
            <small>
              At least 10 characters. Stored securely on your machine.
            </small>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="button primary full" disabled={busy}>
            {busy ? <Loader2 className="spin" size={17} /> : null}
            {register ? "Create my studio" : "Sign in"}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch">
          {register ? "Already have a studio?" : "New around here?"}{" "}
          <button
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "Sign in" : "Create an account"}
          </button>
        </p>
        <div className="local-note">
          <span className="status-dot" /> Local workspace · Your content stays
          with you
        </div>
      </section>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [route, setRoute] = useState(location.hash.slice(1) || "/");
  useEffect(() => {
    api("/session")
      .then((r) => {
        setUser(r.user);
        setCsrf(r.csrf);
      })
      .catch(() => {})
      .finally(() => setReady(true));
    const change = () => setRoute(location.hash.slice(1) || "/");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  async function logout() {
    await api("/auth/logout", { method: "POST", body: {} });
    Object.keys(localStorage)
      .filter((k) => k.startsWith("flipbook-recovery-" + user.id))
      .forEach((k) => localStorage.removeItem(k));
    setUser(null);
    setCsrf("");
    navigate("/");
  }
  if (!ready) return <Spinner />;
  return (
    <>
      <style>{pageCSS}</style>
      <Toasts />
      {!user ? (
        <Auth onLogin={setUser} />
      ) : (
        <FontsProvider key={user.id}>
          {route.startsWith("/edit/") ? (
            <Editor
              key={route.split("/")[2]}
              id={route.split("/")[2]}
              user={user}
            />
          ) : (
            <div className="app-shell">
              <aside className="sidebar">
                <a className="wordmark" href="#/">
                  flipbook<span>®</span>
                </a>
                <div className="workspace-chip">
                  <span>{user.name[0].toUpperCase()}</span>
                  <div>
                    {user.name.split(" ")[0]}’s studio
                    <small>Personal workspace</small>
                  </div>
                  <ChevronDown size={15} />
                </div>
                <div className="nav-caption">WORKSPACE</div>
                <nav>
                  <a className={route === "/" ? "active" : ""} href="#/">
                    <BookOpen size={18} />
                    My publications
                  </a>
                  <a
                    className={route === "/products" ? "active" : ""}
                    href="#/products"
                  >
                    <Package size={18} />
                    Products
                  </a>
                  <a
                    className={route === "/assets" ? "active" : ""}
                    href="#/assets"
                  >
                    <ImageIcon size={18} />
                    Image library
                  </a>
                  <a
                    className={route === "/templates" ? "active" : ""}
                    href="#/templates"
                  >
                    <LayoutGrid size={18} />
                    Page templates
                  </a>
                </nav>
                <div className="sidebar-bottom">
                  <div className="studio-tip">
                    <span className="eyebrow">A LITTLE INSPIRATION</span>
                    <p>
                      Great stories start with
                      <br />a blank page.
                    </p>
                    <span>Make your next one count. ↗</span>
                  </div>
                  <button className="profile" onClick={logout}>
                    <span className="avatar">{user.name[0]}</span>
                    <span>
                      {user.name}
                      <small>Sign out</small>
                    </span>
                    <LogOut size={16} />
                  </button>
                </div>
              </aside>
              <main className="main-content">
                <div className="topbar">
                  <span>YOUR CREATIVE SPACE</span>
                  <span>
                    <i className="status-dot" /> Saved locally
                  </span>
                </div>
                {route === "/products" ? (
                  <Products />
                ) : route === "/assets" ? (
                  <Assets />
                ) : route === "/templates" ? (
                  <Templates />
                ) : (
                  <Library user={user} />
                )}
              </main>
            </div>
          )}
        </FontsProvider>
      )}
    </>
  );
}

function Library({ user }) {
  const [items, setItems] = useState(null),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [create, setCreate] = useState(false),
    [menu, setMenu] = useState(null),
    [analytics, setAnalytics] = useState(null);
  const load = () =>
    api("/publications")
      .then(setItems)
      .catch((e) => showToast(e.message));
  useEffect(() => {
    load();
  }, []);
  async function action(p, a) {
    setMenu(null);
    if (
      a === "delete" &&
      !confirm(
        "Delete “" +
          p.title +
          "”? It will immediately become unavailable to readers.",
      )
    )
      return;
    try {
      if (a === "duplicate") {
        await api("/publications/" + p.id + "/duplicate", {
          method: "POST",
          body: {},
        });
        showToast("Publication duplicated.");
      } else
        await api("/publications/" + p.id + "/" + a, {
          method: "POST",
          body: {},
        });
      load();
    } catch (e) {
      showToast(e.message);
    }
  }
  const visible = items?.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "archived"
        ? p.state === "archived"
        : p.state === "active" &&
          (filter === "all" ||
            (filter === "published" ? p.liveVersion : !p.liveVersion))),
  );
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">MAKE SOMETHING WORTH TURNING THE PAGE FOR</div>
        <div className="heading-row">
          <div>
            <h1>
              Your publications<span className="serif-dot">.</span>
            </h1>
            <p>Curate your products. Tell your story. Share your world.</p>
          </div>
          <button className="button primary" onClick={() => setCreate(true)}>
            <Plus size={18} />
            New publication
          </button>
        </div>
      </div>
      <section className="overview-strip">
        <div>
          <BookOpen size={18} />
          <strong>
            {items?.filter((p) => p.state === "active").length || 0}
          </strong>
          <span>Publications</span>
        </div>
        <div>
          <span className="status-dot" />
          <strong>{items?.filter((p) => p.liveVersion).length || 0}</strong>
          <span>Published editions</span>
        </div>
        <div>
          <FileText size={18} />
          <strong>
            {items?.filter((p) => !p.liveVersion && p.state === "active")
              .length || 0}
          </strong>
          <span>Stories in progress</span>
        </div>
        <span className="overview-aside">
          Your next great edition starts here.
        </span>
      </section>
      <div className="library-controls">
        <div className="tabs">
          {[
            ["all", "All publications"],
            ["published", "Published"],
            ["draft", "Drafts"],
            ["archived", "Archived"],
          ].map(([v, l]) => (
            <button
              key={v}
              className={filter === v ? "active" : ""}
              onClick={() => setFilter(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Search publications"
            placeholder="Find a publication…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {!items ? (
        <Spinner />
      ) : (
        <div className="publication-grid">
          {visible.map((p) => (
            <article className="publication-card" key={p.id}>
              <button
                className="cover-stage"
                aria-label={"Edit " + p.title}
                onClick={() => navigate("/edit/" + p.id)}
              >
                <span className={"badge " + (p.liveVersion ? "published" : "")}>
                  {p.state === "archived"
                    ? "Archived"
                    : p.liveVersion
                      ? "Published"
                      : "Draft"}
                </span>
                <Thumbnail doc={p.document} width={202} />
                <span className="cover-edit">
                  Open in editor <ArrowUpRight size={15} />
                </span>
              </button>
              <div className="publication-info">
                <div>
                  <h3>
                    <button onClick={() => navigate("/edit/" + p.id)}>
                      {p.title}
                    </button>
                  </h3>
                  <p>
                    {p.document.pages.length} pages <span>·</span> Edited{" "}
                    {new Date(p.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="menu-wrap">
                  <IconButton
                    label={"Actions for " + p.title}
                    onClick={() => setMenu(menu === p.id ? null : p.id)}
                  >
                    <MoreHorizontal size={20} />
                  </IconButton>
                  {menu === p.id && (
                    <div className="dropdown">
                      <button onClick={() => action(p, "duplicate")}>
                        <Copy size={15} />
                        Duplicate
                      </button>
                      {p.liveVersion && (
                        <>
                          <a href={"/m/" + p.slug} target="_blank">
                            <ExternalLink size={15} />
                            View publication
                          </a>
                          <button
                            onClick={() => {
                              setAnalytics(p);
                              setMenu(null);
                            }}
                          >
                            <BarChart3 size={15} />
                            Analytics
                          </button>
                          <button onClick={() => action(p, "unpublish")}>
                            Unpublish
                          </button>
                        </>
                      )}
                      <button
                        onClick={() =>
                          action(
                            p,
                            p.state === "archived" ? "unarchive" : "archive",
                          )
                        }
                      >
                        <Archive size={15} />
                        {p.state === "archived" ? "Unarchive" : "Archive"}
                      </button>
                      <button
                        className="danger"
                        onClick={() => action(p, "delete")}
                      >
                        <Trash2 size={15} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
          {filter !== "archived" && !search && (
            <button
              className="new-publication-card"
              onClick={() => setCreate(true)}
            >
              <span>
                <Plus size={28} />
              </span>
              <h3>A fresh perspective.</h3>
              <p>
                Start a new publication
                <br />
                and make it your own.
              </p>
              <b>
                Create publication <ArrowUpRight size={15} />
              </b>
            </button>
          )}
          {!visible.length && search && (
            <div className="empty">No publications match your search.</div>
          )}
        </div>
      )}
      <div className="library-footer">
        <span>A LITTLE MORE EDITORIAL. A LITTLE MORE YOU.</span>
        <span>
          Crafted in your studio <span className="tiny-flower">✳</span>
        </span>
      </div>
      {create && <CreateModal onClose={() => setCreate(false)} />}{" "}
      {analytics && (
        <Analytics publication={analytics} onClose={() => setAnalytics(null)} />
      )}
    </>
  );
}
function CreateModal({ onClose }) {
  const [title, setTitle] = useState(""),
    [theme, setTheme] = useState("editorial"),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const p = await api("/publications", {
        method: "POST",
        body: { title: title || "Untitled magazine", theme },
      });
      navigate("/edit/" + p.id);
    } catch (e) {
      showToast(e.message);
      setBusy(false);
    }
  }
  return (
    <Modal title="A new story begins." onClose={onClose}>
      <form onSubmit={submit}>
        <p className="muted">
          Give your magazine a name. You can always change it later.
        </p>
        <Field
          label="Publication title"
          placeholder="e.g. The autumn edit"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          autoFocus
        />
        <Field label="Visual theme">
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            {Object.entries(THEMES).map(([id, t]) => (
              <option key={id} value={id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            Create publication <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AssetPicker({ onPick, onClose }) {
  const [assets, setAssets] = useState([]),
    [progress, setProgress] = useState(null);
  const load = () => api("/assets").then(setAssets);
  useEffect(() => {
    load();
  }, []);
  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setProgress(0);
    try {
      const a = await uploadImage(file, setProgress);
      await load();
      onPick(a.id);
    } catch (e) {
      showToast(e.message);
    } finally {
      setProgress(null);
    }
  }
  return (
    <Modal title="Choose an image" onClose={onClose} wide>
      <div className="asset-picker-head">
        <p className="muted">Your images, ready for their next story.</p>
        <label className="button primary upload-button">
          <Upload size={16} />
          {progress === null ? "Upload image" : progress + "% uploaded"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={upload}
            disabled={progress !== null}
          />
        </label>
      </div>
      <div className="asset-grid">
        {assets.map((a) => (
          <button key={a.id} onClick={() => onPick(a.id)}>
            <img src={imageUrl(a.id)} alt={a.name} />
            <span>{decodeURIComponent(a.name)}</span>
          </button>
        ))}
      </div>
      <p className="muted small">
        JPEG, PNG, or WebP · up to 20 MB · originals are preserved locally.
      </p>
    </Modal>
  );
}
function Assets() {
  const [assets, setAssets] = useState(null),
    [progress, setProgress] = useState(null);
  const load = () => api("/assets").then(setAssets);
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">THE VISUAL INGREDIENTS</div>
        <div className="heading-row">
          <div>
            <h1>Your image library.</h1>
            <p>Every image has a place in your next edition.</p>
          </div>
          <label className="button primary upload-button">
            <Upload size={16} />
            {progress === null ? "Upload image" : progress + "%"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={progress !== null}
              onChange={async (e) => {
                if (!e.target.files[0]) return;
                setProgress(0);
                try {
                  await uploadImage(e.target.files[0], setProgress);
                  load();
                  showToast("Image added to your library.");
                } catch (e) {
                  showToast(e.message);
                } finally {
                  setProgress(null);
                }
              }}
            />
          </label>
        </div>
      </div>
      {!assets ? (
        <Spinner />
      ) : (
        <div className="asset-grid standalone">
          {assets.map((a) => (
            <div className="asset-item" key={a.id}>
              <img src={imageUrl(a.id)} alt={a.name} />
              <h3>{decodeURIComponent(a.name)}</h3>
              <small>
                {a.width} × {a.height} px
              </small>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
function ProductFields({ product, onChange, onImage }) {
  const set = (key, value) => onChange({ ...product, [key]: value });
  return (
    <>
      <Field
        label="Product name"
        value={product.name}
        maxLength={200}
        onChange={(e) => set("name", e.target.value)}
      />
      <Field label="Short description">
        <textarea
          value={product.summary}
          maxLength={500}
          rows={3}
          onChange={(e) => set("summary", e.target.value)}
        />
      </Field>
      <Field label="Full description (reader details)">
        <textarea
          value={product.description}
          maxLength={10000}
          rows={4}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <div className="field-pair">
        <Field
          label="Price"
          inputMode="decimal"
          value={product.price}
          onChange={(e) => set("price", e.target.value)}
        />
        <Field label="Currency">
          <select
            value={product.currency}
            onChange={(e) => set("currency", e.target.value)}
          >
            {["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "AED"].map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
        </Field>
      </div>
      <Field
        label="Product URL"
        placeholder="https://your-store.com/product"
        value={product.url}
        onChange={(e) => set("url", e.target.value)}
      />
      <div className="field-pair">
        <Field
          label="SKU / code"
          value={product.sku}
          onChange={(e) => set("sku", e.target.value)}
        />
        <Field
          label="Badge"
          placeholder="e.g. New arrival"
          value={product.badge}
          maxLength={40}
          onChange={(e) => set("badge", e.target.value)}
        />
      </div>
      <Field
        label="Category"
        value={product.category}
        onChange={(e) => set("category", e.target.value)}
      />
      <span className="field-label">Product images</span>
      <div className="product-images">
        {product.images.map((id, i) => (
          <div key={id}>
            <img src={imageUrl(id)} alt={"Product image " + (i + 1)} />
            <button
              aria-label={"Remove image " + (i + 1)}
              onClick={() =>
                set(
                  "images",
                  product.images.filter((v) => v !== id),
                )
              }
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {product.images.length < 8 && (
          <button
            className="image-add"
            aria-label="Add product image"
            onClick={onImage}
          >
            <Plus size={18} />
          </button>
        )}
      </div>
    </>
  );
}
function Products() {
  const [items, setItems] = useState(null),
    [editing, setEditing] = useState(null),
    [product, setProduct] = useState(emptyProduct()),
    [picker, setPicker] = useState(false);
  const load = () => api("/products").then(setItems);
  useEffect(() => {
    load();
  }, []);
  async function save() {
    try {
      await api("/products" + (editing.id ? "/" + editing.id : ""), {
        method: editing.id ? "PUT" : "POST",
        body: { content: product, revision: editing.revision },
      });
      setEditing(null);
      load();
      showToast("Product saved. Existing pages keep their current content.");
    } catch (e) {
      showToast(e.message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">CURATED BY YOU</div>
        <div className="heading-row">
          <div>
            <h1>The product collection.</h1>
            <p>Your reusable catalog, ready for its editorial moment.</p>
          </div>
          <button
            className="button primary"
            onClick={() => {
              setProduct(emptyProduct());
              setEditing({});
            }}
          >
            <Plus size={17} />
            Add product
          </button>
        </div>
      </div>
      {!items ? (
        <Spinner />
      ) : (
        <div className="product-library">
          {items.map((p) => (
            <article key={p.id}>
              <button
                className="product-photo-button"
                onClick={() => {
                  setProduct(p.content);
                  setEditing(p);
                }}
              >
                <img src={imageUrl(p.content.images[0])} alt={p.content.name} />
              </button>
              <div>
                <small>{p.content.category || "COLLECTION"}</small>
                <h3>{p.content.name}</h3>
                <p>{p.content.summary}</p>
                <footer>
                  <b>{formatPrice(p.content)}</b>
                  <button
                    onClick={() => {
                      setProduct(p.content);
                      setEditing(p);
                    }}
                  >
                    Edit product <ArrowUpRight size={14} />
                  </button>
                </footer>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <Modal
          title={editing.id ? "Edit product" : "Add to your collection"}
          onClose={() => setEditing(null)}
        >
          <ProductFields
            product={product}
            onChange={setProduct}
            onImage={() => setPicker(true)}
          />
          <div className="modal-actions">
            {editing.id && (
              <button
                className="button danger"
                onClick={async () => {
                  if (
                    confirm(
                      "Remove this product from the catalog? Existing publication content stays intact.",
                    )
                  ) {
                    await api("/products/" + editing.id, { method: "DELETE" });
                    setEditing(null);
                    load();
                  }
                }}
              >
                Remove product
              </button>
            )}
            <button className="button primary" onClick={save}>
              Save product
            </button>
          </div>
        </Modal>
      )}
      {picker && (
        <AssetPicker
          onClose={() => setPicker(false)}
          onPick={(id) => {
            setProduct((p) => ({
              ...p,
              images: [...new Set([...p.images, id])],
            }));
            setPicker(false);
          }}
        />
      )}
    </>
  );
}
function Templates() {
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">A LITTLE STRUCTURE. ENDLESS POSSIBILITY.</div>
        <h1>Start with a good page.</h1>
        <p>Seven considered layouts. Every element is yours to edit.</p>
      </div>
      <div className="template-library">
        {TEMPLATES.map((t) => (
          <article key={t.id}>
            <Thumbnail
              doc={{ theme: "editorial", publisher: "YOUR STUDIO", pages: [] }}
              page={makePage(t.id)}
              width={180}
            />
            <span className="eyebrow">{t.label}</span>
            <h3>{t.name}</h3>
            <p>{t.description}</p>
          </article>
        ))}
      </div>
    </>
  );
}
function Analytics({ publication, onClose }) {
  const [data, setData] = useState(null),
    [days, setDays] = useState(30);
  useEffect(() => {
    setData(null);
    api(
      "/publications/" +
        publication.id +
        "/analytics?from=" +
        new Date(Date.now() - days * 864e5).toISOString().slice(0, 10),
    )
      .then(setData)
      .catch((e) => showToast(e.message));
  }, [days]);
  return (
    <Modal title="A look at your readership" onClose={onClose} wide>
      <div className="analytics-heading">
        <p>{publication.title}</p>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>
      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="stats-grid">
            {[
              [data.views, "Reader sessions"],
              [data.clicks, "Product clicks"],
              [data.averageDepth.toFixed(1), "Pages per session"],
              [Math.round(data.averageSeconds) + "s", "Average active time"],
            ].map(([value, label]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="chart">
            {Object.entries(data.daily).map(([day, n]) => (
              <div key={day} title={day + ": " + n + " sessions"}>
                <span
                  style={{
                    height: Math.max(
                      5,
                      (n / Math.max(...Object.values(data.daily))) * 130,
                    ),
                  }}
                />
                <small>{day.slice(5)}</small>
              </div>
            ))}
            {!Object.keys(data.daily).length && (
              <p className="muted">
                Share your published magazine to see its first readers here.
              </p>
            )}
          </div>
          <p className="muted small">
            Sessions are measured per reader visit, not unique people. Dates use
            UTC. Events stay on your local installation for 30 days.
          </p>
        </>
      )}
    </Modal>
  );
}

function Editor({ id, user }) {
  const [doc, setDoc] = useState(null),
    [pub, setPub] = useState(null),
    [pageIndex, setPageIndex] = useState(0),
    [selectedIds, setSelectedIds] = useState([]),
    [editorDialog, setEditorDialog] = useState(null),
    [assets, setAssets] = useState([]),
    [liveFindings, setLiveFindings] = useState([]),
    [saveState, setSaveState] = useState("saved"),
    [templates, setTemplates] = useState(false),
    [picker, setPicker] = useState(null),
    [products, setProducts] = useState([]),
    [preview, setPreview] = useState(false),
    [job, setJob] = useState(null),
    [findings, setFindings] = useState([]),
    [issueFocus, setIssueFocus] = useState(null),
    [outdated, setOutdated] = useState(serverOutdated),
    [inline, setInline] = useState(null),
    [historyTick, setHistoryTick] = useState(0),
    [settings, setSettings] = useState(false),
    [dragRect, setDragRect] = useState(null);
  const docRef = useRef(),
    rev = useRef(1),
    lastSaved = useRef(""),
    flight = useRef(null),
    batch = useRef(null),
    blocked = useRef(false),
    history = useRef({ past: [], future: [] }),
    canvasRef = useRef(),
    dragRef = useRef();
  const selected = selectedIds[0] || null;
  const setSelected = (id) => setSelectedIds(id ? [id] : []);
  const clipboard = useRef([]);
  // Draft JSON the server rejected as invalid; resending it unchanged cannot succeed.
  const rejected = useRef(null);
  const recoveryKey = "flipbook-recovery-" + user.id + "-" + id;
  useEffect(() => onServerBuild(setOutdated), []);
  useEffect(() => {
    api("/publications/" + id)
      .then((p) => {
        setPub(p);
        rev.current = p.revision;
        lastSaved.current = JSON.stringify(p.document);
        let d = p.document;
        try {
          const local = JSON.parse(localStorage.getItem(recoveryKey));
          if (local && JSON.stringify(local.document) !== lastSaved.current) {
            d = local.document;
            if (local.revision !== p.revision) {
              blocked.current = true;
              setSaveState("conflict");
            } else setSaveState("pending");
            showToast("Recovered your local editing session.");
          }
        } catch {}
        docRef.current = d;
        setDoc(d);
        const latest = p.jobs.find((j) =>
          ["queued", "running"].includes(j.status),
        );
        if (latest) setJob(latest);
      })
      .catch((e) => showToast(e.message));
    api("/products").then(setProducts);
    api("/assets")
      .then(setAssets)
      .catch((e) => showToast(e.message));
  }, [id]);
  function change(fn, { record = true } = {}) {
    if (pub?.state === "archived") {
      showToast("Unarchive this publication before editing.");
      return;
    }
    const old = docRef.current,
      next = upgradeDocument(old);
    fn(next);
    if (JSON.stringify(next) === JSON.stringify(old)) return;
    if (record) {
      history.current.past.push(old);
      if (history.current.past.length > 100) history.current.past.shift();
      history.current.future = [];
      setHistoryTick((n) => n + 1);
    }
    docRef.current = next;
    setDoc(next);
    if (!blocked.current) setSaveState("pending");
    setFindings([]);
    try {
      localStorage.setItem(
        recoveryKey,
        JSON.stringify({ revision: rev.current, document: next }),
      );
    } catch {
      showToast(
        "Browser recovery storage is full. Keep this tab open until your changes are saved.",
      );
    }
  }
  const saveNow = useCallback(async () => {
    if (blocked.current) return false;
    if (flight.current) {
      await flight.current;
      if (blocked.current) return false;
    }
    if (!docRef.current || JSON.stringify(docRef.current) === lastSaved.current)
      return true;
    if (JSON.stringify(docRef.current) === rejected.current) return false;
    const execute = async () => {
      setSaveState("saving");
      if (!batch.current)
        batch.current = {
          key: crypto.randomUUID(),
          document: structuredClone(docRef.current),
          revision: rev.current,
        };
      const current = batch.current;
      try {
        const r = await api("/publications/" + id + "/draft", {
          method: "PUT",
          key: current.key,
          body: { document: current.document, revision: current.revision },
        });
        rev.current = r.revision;
        lastSaved.current = JSON.stringify(current.document);
        batch.current = null;
        const clean = JSON.stringify(docRef.current) === lastSaved.current;
        setSaveState(clean ? "saved" : "pending");
        if (clean) localStorage.removeItem(recoveryKey);
        else
          localStorage.setItem(
            recoveryKey,
            JSON.stringify({ revision: rev.current, document: docRef.current }),
          );
        return true;
      } catch (e) {
        if (e.code === "REVISION_CONFLICT") {
          blocked.current = true;
          setSaveState("conflict");
        } else if (e.findings) {
          setFindings(e.findings);
          rejected.current = JSON.stringify(current.document);
          batch.current = null;
          setSaveState("invalid");
        } else setSaveState("error");
        showToast(e.message);
        return false;
      } finally {
        flight.current = null;
      }
    };
    flight.current = execute();
    return flight.current;
  }, [id]);
  useEffect(() => {
    if (!doc || blocked.current) return;
    const timer = setTimeout(
      () => saveNow(),
      saveState === "error" ? 5000 : 900,
    );
    return () => clearTimeout(timer);
  }, [doc, saveState, saveNow]);
  useEffect(() => {
    const timer = setInterval(() => saveNow(), 5000);
    return () => clearInterval(timer);
  }, [saveNow]);
  useEffect(() => {
    const warning = (e) => {
      if (
        docRef.current &&
        JSON.stringify(docRef.current) !== lastSaved.current
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warning);
    return () => window.removeEventListener("beforeunload", warning);
  }, []);
  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.status)) return;
    const timer = setInterval(async () => {
      try {
        const current = await api("/jobs/" + job.id);
        setJob(current);
        if (current.status === "succeeded") {
          if (current.kind === "publish") {
            const p = await api("/publications/" + id);
            setPub(p);
            showToast("Your publication is live.");
          } else {
            showToast("Your PDF is ready to download.");
          }
        }
        if (current.status === "failed") {
          setFindings(current.error?.findings || []);
          showToast(current.error?.message || "Job failed.");
        }
      } catch (e) {
        showToast(e.message);
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [job?.id, job?.status]);
  function undo() {
    const h = history.current;
    if (!h.past.length) return;
    const previous = h.past.pop();
    h.future.push(docRef.current);
    change(
      (d) => {
        for (const key of Object.keys(d)) delete d[key];
        Object.assign(d, previous);
      },
      { record: false },
    );
    setHistoryTick((n) => n + 1);
  }
  function redo() {
    const h = history.current;
    if (!h.future.length) return;
    const next = h.future.pop();
    h.past.push(docRef.current);
    change(
      (d) => {
        for (const key of Object.keys(d)) delete d[key];
        Object.assign(d, next);
      },
      { record: false },
    );
    setHistoryTick((n) => n + 1);
  }
  useEffect(() => {
    if (!doc) return;
    const handler = (e) => {
      if (
        document.querySelector("dialog[open]") ||
        e.target.closest('input,textarea,select,[contenteditable="true"]')
      )
        return;
      const mod = e.metaKey || e.ctrlKey;
      if (
        mod &&
        ["z", "y", "c", "x", "v", "a", "d"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        const key = e.key.toLowerCase();
        if (key === "z") e.shiftKey ? redo() : undo();
        if (key === "y") redo();
        if (key === "c") copySelection();
        if (key === "x") {
          copySelection();
          deleteSelection();
        }
        if (key === "v") pasteSelection();
        if (key === "a")
          setSelectedIds(page.blocks.filter((b) => !b.hidden).map((b) => b.id));
        if (key === "d") {
          copySelection();
          pasteSelection();
        }
      } else if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) &&
        selectedIds.length
      ) {
        e.preventDefault();
        const amount = e.shiftKey ? 1 : 0.25;
        command((p) =>
          moveSelection(
            p,
            selectedIds,
            e.key === "ArrowRight"
              ? amount
              : e.key === "ArrowLeft"
                ? -amount
                : 0,
            e.key === "ArrowDown" ? amount : e.key === "ArrowUp" ? -amount : 0,
          ),
        );
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length
      ) {
        e.preventDefault();
        deleteSelection();
      } else if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doc, selectedIds, pageIndex]);
  useEffect(() => {
    if (!doc) return;
    const timer = setTimeout(() => {
      const warnings = [
        ...validateDocument(doc, true),
        ...layoutWarnings(doc, assets),
      ];
      canvasRef.current
        ?.querySelectorAll("[data-overflow-text]")
        .forEach((el) => {
          const block = el.closest("[data-block-id]");
          if (
            el.scrollHeight >
              Math.min(el.clientHeight, block?.clientHeight || Infinity) + 2 ||
            el.scrollWidth > el.clientWidth + 2
          )
            warnings.push({
              pageId: doc.pages[pageIndex]?.id,
              blockId: block?.dataset.blockId,
              message:
                "Text may overflow. Enlarge the layer or shorten the copy.",
            });
        });
      setLiveFindings(warnings);
    }, 250);
    return () => clearTimeout(timer);
  }, [doc, assets, pageIndex]);
  if (!doc) return <Spinner text="Opening your publication…" />;
  const page = doc.pages[pageIndex] || doc.pages[0],
    active = page?.blocks.find((b) => b.id === selected),
    scale = 0.55;
  const editBlock = (fn) =>
    change((d) => {
      const b = d.pages
        .find((p) => p.id === page.id)
        ?.blocks.find((b) => b.id === selected);
      if (b && !b.locked) fn(b);
    });
  async function publish() {
    if (!(await saveNow())) return;
    if (
      JSON.stringify(docRef.current) !== lastSaved.current &&
      !(await saveNow())
    )
      return;
    const issues = validateDocument(docRef.current, true);
    if (issues.length) {
      setFindings(issues);
      showToast("Complete the checklist before publishing.");
      return;
    }
    try {
      setJob(
        await api("/publications/" + id + "/publish", {
          method: "POST",
          body: { revision: rev.current },
        }),
      );
    } catch (e) {
      setFindings(e.findings || []);
      showToast(e.message);
    }
  }
  async function exportPDF() {
    try {
      const j = await api("/publications/" + id + "/export", {
        method: "POST",
        body: {},
      });
      setJob(j);
      if (j.status === "succeeded")
        window.open("/api/jobs/" + j.id + "/download", "_blank");
    } catch (e) {
      showToast(e.message);
    }
  }
  function command(fn) {
    try {
      change((d) => fn(d.pages[pageIndex]));
    } catch (e) {
      showToast(e.message);
    }
  }
  function selectLayer(id, add = false) {
    setSelectedIds(
      selectionIds(
        page,
        add
          ? selectedIds.includes(id)
            ? selectedIds.filter((x) => x !== id)
            : [...selectedIds, id]
          : [id],
      ),
    );
    setInline(null);
  }
  function copySelection() {
    clipboard.current = structuredClone(selectedBlocks(page, selectedIds));
    showToast("Elements copied. Choose a page and paste.");
  }
  function pasteSelection() {
    if (!clipboard.current.length) return;
    command((p) => {
      setSelectedIds(pasteBlocks(p, clipboard.current));
    });
  }
  function deleteSelection() {
    command((p) => {
      const removing = new Set(
        selectedBlocks(p, selectedIds, { editable: true }).map((b) => b.id),
      );
      p.blocks = p.blocks.filter((b) => !removing.has(b.id));
      for (const pg of doc.pages) {
      }
    });
    setSelected(null);
  }
  async function saveRevision() {
    if (!(await saveNow())) throw Error("Save your changes before continuing.");
    if (
      JSON.stringify(docRef.current) !== lastSaved.current &&
      !(await saveNow())
    )
      throw Error("Save your changes before continuing.");
    return rev.current;
  }
  async function openEditorDialog(name) {
    try {
      if (["history", "review"].includes(name)) await saveRevision();
      if (name === "import") setAssets(await api("/assets"));
      setEditorDialog(name);
    } catch (e) {
      showToast(e.message);
    }
  }
  async function restoreRevision(sourceRevision) {
    const revision = await saveRevision();
    const p = await api("/publications/" + id + "/restore", {
      method: "POST",
      body: { revision, sourceRevision },
    });
    rev.current = p.revision;
    lastSaved.current = JSON.stringify(p.document);
    docRef.current = p.document;
    setDoc(p.document);
    setPub(p);
    setPageIndex(0);
    setSelected(null);
    history.current = { past: [], future: [] };
    batch.current = null;
    localStorage.removeItem(recoveryKey);
    setSaveState("saved");
    showToast("Draft restored. Your live publication is unchanged.");
  }
  function addBlock(type) {
    if (page.blocks.length >= 50)
      return showToast("A page supports at most 50 layers.");
    const size =
      type === "product"
        ? [6, 14]
        : ["image", "gallery", "media"].includes(type)
          ? [6, 9]
          : type === "divider"
            ? [6, 1]
            : type === "icon"
              ? [2, 4]
              : [6, 4];
    let rect;
    for (let y = 0; y <= 36 - size[1] && !rect; y++)
      for (let x = 0; x <= 12 - size[0] && !rect; x++) {
        const r = [x, y, ...size];
        if (
          !page.blocks.some(
            (b) =>
              r[0] < b.rect[0] + b.rect[2] &&
              r[0] + r[2] > b.rect[0] &&
              r[1] < b.rect[1] + b.rect[3] &&
              r[1] + r[3] > b.rect[1],
          )
        )
          rect = r;
      }
    const b = newElement(type, rect || [3, 10, ...size]);
    command((p) => p.blocks.push(b));
    setSelected(b.id);
    setSettings(false);
  }
  function pointerStart(e, b, resize = false) {
    if (e.button !== 0 || inline) return;
    e.stopPropagation();
    const ids = selectionIds(
      page,
      e.shiftKey
        ? [...new Set([...selectedIds, b.id])]
        : selectedIds.includes(b.id)
          ? selectedIds
          : [b.id],
    );
    setSelectedIds(ids);
    if (selectedBlocks(page, ids).some((b) => b.locked)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      ids,
      resize,
      box: bounds(selectedBlocks(page, ids)),
      source: structuredClone(page),
    };
  }
  function pointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / (59.25 * scale),
      dy = (e.clientY - d.y) / (28.8889 * scale),
      next = structuredClone(d.source);
    let guides = [];
    if (d.resize) resizeSelection(next, d.ids, d.box[2] + dx, d.box[3] + dy);
    else {
      const snapped = snappedMove(next, d.ids, dx, dy, {
        margins: marginBox(doc, page),
      });
      moveSelection(next, d.ids, snapped.dx, snapped.dy);
      guides = snapped.guides;
    }
    d.preview = next;
    setDragRect({ page: next, guides });
  }
  function pointerEnd() {
    const d = dragRef.current;
    if (d?.preview)
      command((p) => {
        p.blocks = d.preview.blocks;
      });
    dragRef.current = null;
    setDragRect(null);
  }
  const jobRunning = job && ["queued", "running"].includes(job.status);
  return (
    <div className="editor">
      <header className="editor-header">
        <IconButton
          label="Back to publications"
          onClick={async () => {
            await saveNow();
            navigate("/");
          }}
        >
          <ArrowLeft size={19} />
        </IconButton>
        <a className="wordmark" href="#/">
          flipbook<span>®</span>
        </a>
        <span className="header-divider" />
        <div className="editor-title">
          <input
            aria-label="Publication title"
            value={doc.title}
            maxLength={160}
            onChange={(e) => change((d) => (d.title = e.target.value))}
          />
          <span className={"save-label " + saveState}>
            {saveState === "saved" ? (
              <Check size={12} />
            ) : saveState === "saving" ? (
              <Loader2 size={12} className="spin" />
            ) : (
              <span className="small-dot" />
            )}
            {
              {
                saved: "All changes saved",
                saving: "Saving your changes…",
                pending: "Unsaved changes",
                error: "Save interrupted · retrying",
                invalid: "Not saved — fix the highlighted issue",
                conflict: "Conflicting edits — action needed",
              }[saveState]
            }
          </span>
        </div>
        <div className="editor-header-actions">
          <IconButton
            label="Undo"
            onClick={undo}
            disabled={!history.current.past.length}
          >
            <Undo2 size={18} />
          </IconButton>
          <IconButton
            label="Redo"
            onClick={redo}
            disabled={!history.current.future.length}
          >
            <Redo2 size={18} />
          </IconButton>
          <button className="button compact" onClick={() => setPreview(true)}>
            <Eye size={16} />
            Preview
          </button>
          <button
            className="button compact"
            onClick={exportPDF}
            disabled={!pub?.liveVersion}
          >
            <Download size={16} />
            PDF
          </button>
          <button
            className="button primary compact"
            onClick={publish}
            disabled={
              jobRunning ||
              saveState === "conflict" ||
              pub?.state === "archived"
            }
          >
            {jobRunning ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <ArrowUpRight size={16} />
            )}
            Publish
          </button>
        </div>
      </header>
      {outdated && <ServerVersionNotice outdated={outdated} />}
      <div className="editor-tools">
        {[
          ["design", "Page design & brand"],
          ["resources", "Reusable designs"],
          ["import", "Import catalog"],
          ["history", "Draft history"],
          ["review", "Review & approval"],
        ].map(([name, label]) => (
          <button
            className="button small"
            key={name}
            onClick={() => openEditorDialog(name)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="editor-body">
        <aside className="page-rail">
          <header>
            <span>
              PAGES <b>{doc.pages.length}</b>
            </span>
            <IconButton label="Add page" onClick={() => setTemplates(true)}>
              <Plus size={16} />
            </IconButton>
          </header>
          <div className="page-thumbnails">
            {doc.pages.map((p, i) => (
              <div
                className={
                  "page-thumbnail " + (i === pageIndex ? "selected" : "")
                }
                key={p.id}
              >
                <button
                  onClick={() => {
                    setPageIndex(i);
                    setSelected(null);
                    setInline(null);
                  }}
                  aria-label={"Select page " + (i + 1)}
                >
                  <Thumbnail doc={doc} page={p} width={85} />
                </button>
                <footer>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <IconButton
                      label={"Move page " + (i + 1) + " up"}
                      disabled={i === 0}
                      onClick={() => {
                        change((d) => {
                          [d.pages[i - 1], d.pages[i]] = [
                            d.pages[i],
                            d.pages[i - 1],
                          ];
                        });
                        setPageIndex(i - 1);
                      }}
                    >
                      <ChevronUp size={12} />
                    </IconButton>
                    <IconButton
                      label={"Move page " + (i + 1) + " down"}
                      disabled={i === doc.pages.length - 1}
                      onClick={() => {
                        change((d) => {
                          [d.pages[i + 1], d.pages[i]] = [
                            d.pages[i],
                            d.pages[i + 1],
                          ];
                        });
                        setPageIndex(i + 1);
                      }}
                    >
                      <ChevronDown size={12} />
                    </IconButton>
                  </div>
                </footer>
              </div>
            ))}
          </div>
          <button
            className="add-page-button"
            onClick={() => setTemplates(true)}
          >
            <Plus size={15} />
            Add page
          </button>
          <LayersPanel
            page={page}
            ids={selectionIds(page, selectedIds)}
            select={selectLayer}
            changePage={command}
          />
        </aside>
        <section className="editor-workspace">
          <div className="canvas-toolbar">
            <div>
              <MousePointer2 size={14} />
              <span>
                Page {pageIndex + 1} · {page?.title}
              </span>
            </div>
            <div>
              <IconButton
                label="Duplicate page"
                onClick={() => {
                  change((d) =>
                    d.pages.splice(pageIndex + 1, 0, duplicatePage(page)),
                  );
                  setPageIndex(pageIndex + 1);
                }}
              >
                <Copy size={15} />
              </IconButton>
              <IconButton
                label="Delete page"
                disabled={doc.pages.length <= 1}
                onClick={() => {
                  if (confirm("Remove this page? You can undo this.")) {
                    change((d) => d.pages.splice(pageIndex, 1));
                    setPageIndex(Math.max(0, pageIndex - 1));
                    setSelected(null);
                  }
                }}
              >
                <Trash2 size={15} />
              </IconButton>
              <span>55%</span>
            </div>
          </div>
          {pub?.state === "archived" && (
            <div className="notice">
              This publication is archived.{" "}
              <button
                onClick={async () => {
                  await api("/publications/" + id + "/unarchive", {
                    method: "POST",
                    body: {},
                  });
                  setPub((p) => ({ ...p, state: "active" }));
                }}
              >
                Unarchive to edit
              </button>
            </div>
          )}
          {saveState === "conflict" && (
            <div className="notice error">
              Another session changed this publication.{" "}
              <button
                onClick={async () => {
                  try {
                    const p = await api("/publications/" + id + "/duplicate", {
                      method: "POST",
                      body: { document: docRef.current },
                    });
                    localStorage.removeItem(recoveryKey);
                    navigate("/edit/" + p.id);
                    location.reload();
                  } catch (e) {
                    showToast(e.message);
                  }
                }}
              >
                Save my copy
              </button>
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Discard these local changes and reload the saved version?",
                    )
                  ) {
                    localStorage.removeItem(recoveryKey);
                    location.reload();
                  }
                }}
              >
                Use saved version
              </button>
            </div>
          )}
          {job && (
            <div
              className={
                "job-banner " + (job.status === "failed" ? "error" : "")
              }
            >
              <span>
                {jobRunning ? (
                  <Loader2 className="spin" size={14} />
                ) : job.status === "succeeded" ? (
                  <Check size={14} />
                ) : (
                  <AlertCircle size={14} />
                )}{" "}
                {job.kind === "publish" ? "Publishing" : "PDF export"} ·{" "}
                {job.stage}
              </span>
              {job.status === "succeeded" &&
                job.kind === "publish" &&
                pub?.liveVersion && (
                  <a href={"/m/" + pub.slug} target="_blank">
                    Open publication ↗
                  </a>
                )}
              {job.status === "succeeded" && job.kind === "pdf" && (
                <a href={"/api/jobs/" + job.id + "/download"}>Download PDF ↓</a>
              )}
              {job.status === "failed" && (
                <button
                  onClick={async () => {
                    try {
                      await api("/jobs/" + job.id + "/retry", {
                        method: "POST",
                        body: {},
                      });
                      setJob((j) => ({
                        ...j,
                        status: "queued",
                        stage: "Queued",
                      }));
                    } catch (e) {
                      showToast(e.message);
                    }
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          )}
          {findings.length > 0 && (
            <div className="validation-list" role="alert">
              <strong>
                {findings.length} {findings.length === 1 ? "thing" : "things"}{" "}
                to check
              </strong>
              {findings.map((f, i) => (
                <button
                  key={i}
                  aria-haspopup="dialog"
                  onClick={() => setIssueFocus(i)}
                >
                  {f.message}
                  <span className="how-to-fix">How to fix</span>
                </button>
              ))}
            </div>
          )}
          <div className="selection-tools" aria-label="Selection tools">
            <span>{selectionIds(page, selectedIds).length} selected</span>
            <button className="button small" onClick={copySelection}>
              Copy
            </button>
            <button className="button small" onClick={pasteSelection}>
              Paste
            </button>
            <button
              className="button small"
              onClick={() => {
                copySelection();
                pasteSelection();
              }}
            >
              Duplicate selection
            </button>
            <button
              className="button small"
              onClick={() => command((p) => groupSelection(p, selectedIds))}
            >
              Group
            </button>
            <button
              className="button small"
              onClick={() => command((p) => ungroupSelection(p, selectedIds))}
            >
              Ungroup
            </button>
            <select
              aria-label="Layer order"
              value=""
              onChange={(e) =>
                command((p) => reorderLayers(p, selectedIds, e.target.value))
              }
            >
              <option value="">Arrange layers</option>
              {["front", "forward", "backward", "back"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select
              aria-label="Align selection"
              value=""
              onChange={(e) =>
                command((p) =>
                  alignSelection(
                    p,
                    selectedIds,
                    e.target.value,
                    selectedIds.length === 1 && (marginBox(doc, p) || true),
                  ),
                )
              }
            >
              <option value="">Align</option>
              {["left", "center", "right", "top", "middle", "bottom"].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
            <select
              aria-label="Distribute selection"
              value=""
              onChange={(e) =>
                command((p) =>
                  distributeSelection(p, selectedIds, e.target.value),
                )
              }
            >
              <option value="">Distribute</option>
              <option value="x">Horizontal</option>
              <option value="y">Vertical</option>
            </select>
            <button className="button small" onClick={deleteSelection}>
              Delete selection
            </button>
          </div>
          <details className="live-findings">
            <summary>{liveFindings.length} design checks</summary>
            {liveFindings.map((f, i) => (
              <button
                key={i}
                onClick={() => {
                  const at = doc.pages.findIndex((p) => p.id === f.pageId);
                  if (at >= 0) setPageIndex(at);
                  setSelected(f.blockId);
                }}
              >
                {f.message}
              </button>
            ))}
          </details>
          <div className="canvas-scroll">
            <div
              className="canvas-sized"
              style={{ width: 794 * scale, height: 1123 * scale }}
            >
              <div
                className="canvas-native magazine"
                ref={canvasRef}
                style={{
                  ...styleTheme(doc.theme),
                  transform: "scale(" + scale + ")",
                }}
              >
                <div
                  dangerouslySetInnerHTML={{
                    __html: page
                      ? renderPage(
                          dragRect?.page || page,
                          doc,
                          imageUrl,
                          pageIndex,
                        )
                      : "",
                  }}
                />
                <div className="selection-grid">
                  {marginBox(doc, page) && (
                    <div
                      className="margin-guide"
                      aria-hidden="true"
                      style={(() => {
                        const [x, y, w, h] = marginBox(doc, page);
                        return {
                          left: x * 59.25,
                          top: y * 28.8889,
                          width: w * 59.25 - 7,
                          height: h * 28.8889 - 7,
                        };
                      })()}
                    />
                  )}
                  {(dragRect?.page || page)?.blocks
                    .filter((b) => !b.hidden)
                    .map((b) => {
                      const r = rectangle(b.rect);
                      return (
                        <div
                          key={b.id}
                          className={
                            "selection-zone " +
                            (selectedIds.includes(b.id) ? "selected" : "") +
                            (b.locked ? " locked" : "")
                          }
                          style={{
                            left: r.x - PAGE.padding,
                            top: r.y - PAGE.padding,
                            width: r.width,
                            height: r.height,
                            transform: `rotate(${b.appearance?.rotation || 0}deg)`,
                          }}
                          onPointerDown={(e) => pointerStart(e, b)}
                          onPointerMove={pointerMove}
                          onPointerUp={pointerEnd}
                          onPointerCancel={() => {
                            dragRef.current = null;
                            setDragRect(null);
                          }}
                          onDoubleClick={() => {
                            if (b.type === "text" && !b.locked) setInline(b.id);
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={"Select " + b.type + " block"}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              selectLayer(b.id, e.shiftKey);
                          }}
                        >
                          {selectedIds.includes(b.id) && !b.locked && (
                            <>
                              <span className="block-label">
                                {b.type.toUpperCase()} · drag to move
                              </span>
                              <span
                                className="resize-handle"
                                role="button"
                                aria-label="Resize selected block"
                                onPointerDown={(e) => pointerStart(e, b, true)}
                              />
                            </>
                          )}
                          {inline === b.id && (
                            <textarea
                              className="inline-text"
                              autoFocus
                              aria-label="Edit text in place"
                              style={{
                                fontSize: b.size,
                                fontFamily: "var(--font)",
                              }}
                              value={b.text}
                              onPointerDown={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                editBlock((x) =>
                                  setBlockText(x, e.target.value),
                                )
                              }
                              onBlur={() => setInline(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setInline(null);
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  {dragRect?.guides.map((g, i) => (
                    <span
                      className="snap-guide"
                      key={i}
                      style={
                        g.axis === "x"
                          ? {
                              left: g.position * 59.25,
                              top: 0,
                              width: 1,
                              height: "100%",
                            }
                          : {
                              top: g.position * 28.8889,
                              left: 0,
                              height: 1,
                              width: "100%",
                            }
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="canvas-hint">
              Select an element to make it yours. Double-click text to edit in
              place.
            </p>
          </div>
          <div className="insert-toolbar">
            <span>ADD TO PAGE</span>
            {[
              ["text", Type],
              ["image", ImageIcon],
              ["product", Package],
              ["button", LinkIcon],
              ["divider", MoreHorizontal],
              ["shape", LayoutGrid],
              ["gallery", ImageIcon],
              ["hotspot", MousePointer2],
              ["media", FileText],
              ["icon", Smile],
            ].map(([type, Icon]) => (
              <button key={type} onClick={() => addBlock(type)}>
                <Icon size={17} />
                {type}
              </button>
            ))}
          </div>
        </section>
        <aside className="inspector">
          <div className="inspector-tabs">
            <button
              className={!settings ? "active" : ""}
              onClick={() => setSettings(false)}
            >
              Design
            </button>
            <button
              className={settings ? "active" : ""}
              onClick={() => setSettings(true)}
            >
              Publication
            </button>
          </div>
          {settings ? (
            <div className="inspector-content">
              <h3>The finishing touches</h3>
              <Field
                label="Publisher / brand"
                value={doc.publisher}
                onChange={(e) => change((d) => (d.publisher = e.target.value))}
              />
              <Field
                label="Subtitle"
                value={doc.subtitle}
                onChange={(e) => change((d) => (d.subtitle = e.target.value))}
              />
              <Field label="Theme">
                <select
                  value={doc.theme}
                  onChange={(e) => change((d) => (d.theme = e.target.value))}
                >
                  {Object.entries(THEMES).map(([id, t]) => (
                    <option value={id} key={id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="muted small">
                A4 portrait · Fonts and layout are shared across your pages and
                PDF.
              </p>
              {pub?.liveVersion && (
                <>
                  <a
                    className="button full"
                    target="_blank"
                    href={"/m/" + pub.slug}
                  >
                    <ExternalLink size={15} />
                    View live publication
                  </a>
                  <button
                    className="button full"
                    onClick={() => {
                      navigator.clipboard
                        .writeText(location.origin + "/m/" + pub.slug)
                        .then(() => showToast("Publication link copied."));
                    }}
                  >
                    Copy share link
                  </button>
                  <button
                    className="button full danger"
                    onClick={async () => {
                      await api("/publications/" + id + "/unpublish", {
                        method: "POST",
                        body: {},
                      });
                      setPub((p) => ({ ...p, liveVersion: null }));
                      setJob(null);
                      showToast("Publication unpublished.");
                    }}
                  >
                    Unpublish
                  </button>
                </>
              )}
            </div>
          ) : active ? (
            <div className="inspector-content">
              <div className="inspector-label">
                <span className="eyebrow">{active.type} ELEMENT</span>
                <IconButton
                  label="Delete selected block"
                  disabled={active.locked}
                  onClick={deleteSelection}
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
              <Field
                label="Layer name"
                value={active.name || ""}
                maxLength={100}
                onChange={(e) =>
                  editBlock((b) => {
                    b.name = e.target.value;
                  })
                }
              />
              {active.locked && (
                <p className="notice">
                  This layer is locked. Unlock it in Layers to edit.
                </p>
              )}
              <fieldset disabled={active.locked}>
                {active.type === "text" && (
                  <RichTextEditor
                    key={active.id}
                    block={active}
                    doc={doc}
                    editBlock={editBlock}
                    change={change}
                  />
                )}
                {active.type === "image" && (
                  <>
                    <CropPreview
                      key={active.id}
                      block={active}
                      editBlock={editBlock}
                    />
                    <button
                      className="button full"
                      onClick={() => setPicker("block")}
                    >
                      <ImageIcon size={16} />
                      {active.assetId ? "Replace image" : "Choose image"}
                    </button>
                    <Field
                      label="Image description"
                      value={active.alt}
                      onChange={(e) =>
                        editBlock((b) => (b.alt = e.target.value))
                      }
                    />
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={active.decorative}
                        onChange={(e) =>
                          editBlock((b) => (b.decorative = e.target.checked))
                        }
                      />
                      Decorative image
                    </label>
                    {[
                      ["x", "Horizontal focus", 0, 100, 1],
                      ["y", "Vertical focus", 0, 100, 1],
                      ["zoom", "Crop / zoom", 1, 3, 0.1],
                    ].map(([k, l, min, max, step]) => (
                      <Field key={k} label={l}>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={step}
                          value={active.crop[k]}
                          onChange={(e) =>
                            editBlock(
                              (b) => (b.crop[k] = Number(e.target.value)),
                            )
                          }
                        />
                      </Field>
                    ))}
                  </>
                )}
                {active.type === "product" && (
                  <>
                    <Field label="Choose from your catalog">
                      <select
                        value=""
                        onChange={(e) => {
                          const p = products.find(
                            (p) => p.id === e.target.value,
                          );
                          if (p)
                            editBlock(
                              (b) => (b.product = structuredClone(p.content)),
                            );
                        }}
                      >
                        <option value="">Select a product…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.content.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <ProductFields
                      product={active.product}
                      onChange={(p) => editBlock((b) => (b.product = p))}
                      onImage={() => setPicker("product")}
                    />
                    <Field
                      label="Card text size"
                      type="number"
                      min={10}
                      max={32}
                      value={active.size}
                      onChange={(e) =>
                        editBlock((b) => (b.size = Number(e.target.value)))
                      }
                    />
                    <p className="muted small">
                      This page uses its own product copy. Catalog changes won’t
                      change it automatically.
                    </p>
                  </>
                )}
                {active.type === "button" && (
                  <>
                    <Field
                      label="Button label"
                      value={active.text}
                      onChange={(e) =>
                        editBlock((b) => (b.text = e.target.value))
                      }
                    />
                    <Field
                      label="Destination URL"
                      value={active.url}
                      onChange={(e) =>
                        editBlock((b) => (b.url = e.target.value))
                      }
                    />
                  </>
                )}
                <ExtendedBlockFields
                  block={active}
                  doc={doc}
                  editBlock={editBlock}
                  change={change}
                  pick={setPicker}
                />
                <hr />
                <span className="field-label">Position & size (page grid)</span>
                <div className="geometry-fields">
                  {["Column", "Row", "Width", "Height"].map((l, i) => (
                    <Field
                      key={l}
                      label={l}
                      type="number"
                      min={i < 2 ? 0 : 1}
                      max={i % 2 === 0 ? 12 : 36}
                      value={active.rect[i]}
                      onChange={(e) =>
                        editBlock((b) => {
                          const limit = i % 2 === 0 ? 12 : 36;
                          b.rect[i] = Math.max(
                            i < 2 ? 0 : 1,
                            Math.min(
                              Number(e.target.value),
                              i < 2
                                ? limit - b.rect[i + 2]
                                : limit - b.rect[i - 2],
                            ),
                          );
                        })
                      }
                    />
                  ))}
                </div>
                <div className="button-row">
                  <button
                    className="button small"
                    onClick={() =>
                      change((d) => {
                        const a = d.pages[pageIndex].blocks,
                          i = a.findIndex((b) => b.id === selected);
                        if (i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]];
                      })
                    }
                  >
                    Read earlier
                  </button>
                  <button
                    className="button small"
                    onClick={() =>
                      change((d) => {
                        const a = d.pages[pageIndex].blocks,
                          i = a.findIndex((b) => b.id === selected);
                        if (i < a.length - 1)
                          [a[i + 1], a[i]] = [a[i], a[i + 1]];
                      })
                    }
                  >
                    Read later
                  </button>
                </div>
              </fieldset>
            </div>
          ) : (
            <div className="inspector-empty">
              <MousePointer2 size={28} />
              <h3>Make it yours.</h3>
              <p>Select text, an image, or a product to start editing.</p>
              <div className="inspector-tip">
                A little space can make a big difference. Give your products
                room to breathe.
              </div>
            </div>
          )}
        </aside>
      </div>
      {editorDialog === "design" && (
        <PageDesign
          doc={doc}
          pageIndex={pageIndex}
          change={change}
          pick={(callback) => setPicker(() => callback)}
          onClose={() => setEditorDialog(null)}
        />
      )}
      {editorDialog === "resources" && (
        <ResourcesDialog
          doc={doc}
          pageIndex={pageIndex}
          ids={selectedIds}
          change={change}
          onSelectPage={setPageIndex}
          onClose={() => setEditorDialog(null)}
          onError={(e) => showToast(e.message)}
        />
      )}
      {editorDialog === "import" && (
        <ImportDialog
          assets={assets}
          change={change}
          onProducts={(rows) => setProducts((p) => [...p, ...rows])}
          onClose={() => setEditorDialog(null)}
          onError={(e) => showToast(e.message)}
        />
      )}
      {issueFocus !== null && findings.length > 0 && (
        <IssuesDialog
          findings={findings}
          focus={issueFocus}
          doc={doc}
          outdated={outdated}
          onClose={() => setIssueFocus(null)}
          onGoTo={(f, at) => {
            setIssueFocus(null);
            setPageIndex(at);
            if (f.blockId) setSelected(f.blockId);
          }}
        />
      )}
      {editorDialog === "history" && (
        <HistoryDialog
          id={id}
          restore={restoreRevision}
          onClose={() => setEditorDialog(null)}
          onError={(e) => showToast(e.message)}
        />
      )}
      {editorDialog === "review" && (
        <ReviewDialog
          id={id}
          doc={doc}
          pageIndex={pageIndex}
          selected={selected}
          change={change}
          saveRevision={saveRevision}
          onAnchor={(pageId, blockId) => {
            const at = doc.pages.findIndex((p) => p.id === pageId);
            if (at >= 0) {
              setPageIndex(at);
              setSelected(blockId);
            }
          }}
          onClose={() => setEditorDialog(null)}
          onError={(e) => showToast(e.message)}
        />
      )}
      {templates && (
        <Modal
          title="Every page, a possibility."
          onClose={() => setTemplates(false)}
          wide
        >
          <div className="template-picker">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  if (doc.pages.length >= 100)
                    return showToast("Maximum 100 pages per publication.");
                  change((d) => d.pages.push(makePage(t.id)));
                  setPageIndex(doc.pages.length);
                  setSelected(null);
                  setTemplates(false);
                }}
              >
                <Thumbnail doc={doc} page={makePage(t.id)} width={105} />
                <strong>{t.label}</strong>
                <small>{t.description}</small>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {picker && (
        <AssetPicker
          onClose={() => setPicker(null)}
          onPick={(id) => {
            if (typeof picker === "function") picker(id);
            else
              editBlock((b) => {
                if (picker === "gallery")
                  b.images.push({ assetId: id, alt: "" });
                else if (picker === "poster") b.posterId = id;
                else if (picker === "product")
                  b.product.images = [...new Set([...b.product.images, id])];
                else b.assetId = id;
              });
            setPicker(null);
          }}
        />
      )}
      {preview && (
        <Modal
          title="A reader’s point of view"
          wide
          onClose={() => setPreview(false)}
        >
          <BookPreview doc={doc} />
        </Modal>
      )}
    </div>
  );
}

// Built-in fonts come from one registry shared with the reader and PDF export.
document.head.append(
  Object.assign(document.createElement("style"), {
    textContent: builtinFontFaceCSS(),
  }),
);
createRoot(document.getElementById("root")).render(<App />);
