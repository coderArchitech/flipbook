import { findRenderedBlock } from "../../shared/design.mjs";
import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Volume2, VolumeX } from "lucide-react";
import { BookViewer } from "../../public/book-viewer.js";
import { FlipSound } from "../../public/flip-sound.js";
import { renderPage } from "../../shared/render.mjs";
import { THEMES, formatPrice } from "../../shared/document.mjs";
import { imageUrl } from "../api.js";
import { Modal } from "./Modal.jsx";
function styleTheme(theme) {
  const t = THEMES[theme] || THEMES.editorial;
  return {
    "--ink": t.ink,
    "--paper": t.paper,
    "--accent": t.accent,
    "--font": t.font,
  };
}
export function BookPreview({ doc }) {
  const root = useRef(),
    viewer = useRef(),
    sound = useRef(),
    [soundEnabled, setSoundEnabled] = useState(true),
    [detail, setDetail] = useState(null),
    [photo, setPhoto] = useState(0),
    [state, setState] = useState({
      visible: [0],
      index: 0,
      total: doc.pages.length,
    });
  useEffect(() => {
    root.current.innerHTML = doc.pages
      .map((p, i) => renderPage(p, doc, imageUrl, i))
      .join("");
    sound.current = new FlipSound();
    setSoundEnabled(sound.current.enabled);
    viewer.current = new BookViewer(root.current, {
      onChange: setState,
      onTurn: () => sound.current.play(),
    });
    const open = (e) => {
      const pageLink = e.target.closest("[data-page-link]");
      if (pageLink) {
        e.preventDefault();
        const index = doc.pages.findIndex(
          (p) => p.id === pageLink.dataset.pageLink,
        );
        if (index >= 0) viewer.current.go(index);
        return;
      }
      const gallery = e.target.closest("[data-page-gallery]");
      if (gallery) {
        const b = findRenderedBlock(doc, gallery.dataset.pageGallery);
        if (b?.images?.length) {
          const index = Number(gallery.dataset.image) || 0;
          setPhoto(index);
          setDetail({
            name: b.name || "Image gallery",
            description: b.images[index]?.alt || "",
            images: b.images.map((i) => i.assetId),
            price: "",
            currency: "USD",
            url: "",
          });
        }
        return;
      }
      const target = e.target.closest("[data-product]");
      if (!target) return;
      const product = findRenderedBlock(doc, target.dataset.product)?.product;
      if (product) {
        setPhoto(0);
        setDetail(product);
      }
    };
    const key = (e) => {
      if (
        ["Enter", " "].includes(e.key) &&
        e.target.closest("[data-product]")
      ) {
        e.preventDefault();
        open(e);
      }
    };
    root.current.addEventListener("click", open);
    root.current.addEventListener("keydown", key);
    return () => {
      root.current?.removeEventListener("click", open);
      root.current?.removeEventListener("keydown", key);
      viewer.current.destroy();
      sound.current.destroy();
    };
  }, [doc]);
  return (
    <>
      <div className="preview-controls">
        <button
          className="button"
          aria-pressed={!!state.flow}
          onClick={() => viewer.current.setFlow(!viewer.current.flow)}
        >
          {state.flow ? "Book view" : "Scroll view"}
        </button>
        <button
          className="button"
          aria-label={soundEnabled ? "Mute flip sound" : "Enable flip sound"}
          aria-pressed={soundEnabled}
          onClick={() => {
            sound.current.setEnabled(!soundEnabled);
            setSoundEnabled(sound.current.enabled);
          }}
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <span className="muted small">
          Preview includes your current draft.
        </span>
      </div>
      <div className="book-preview-surround">
        <div ref={root} className="magazine" style={styleTheme(doc.theme)} />
      </div>
      <nav className="preview-book-nav" aria-label="Preview page navigation">
        <button
          className="button"
          aria-label="Previous preview page"
          disabled={!state.canPrevious}
          onClick={() => viewer.current.previous()}
        >
          <ArrowLeft size={17} />
        </button>
        <span role="status">{state.label}</span>
        <button
          className="button"
          aria-label="Next preview page"
          disabled={!state.canNext}
          onClick={() => viewer.current.next()}
        >
          <ArrowRight size={17} />
        </button>
      </nav>
      {detail && (
        <Modal
          title={detail.name || "Product details"}
          onClose={() => setDetail(null)}
        >
          <div className="preview-product">
            <img src={imageUrl(detail.images[photo])} alt={detail.name} />
            <div className="product-images">
              {detail.images.map((id, i) => (
                <button
                  key={id}
                  aria-label={"View image " + (i + 1)}
                  onClick={() => setPhoto(i)}
                >
                  <img src={imageUrl(id)} alt="" />
                </button>
              ))}
            </div>
            <strong>{formatPrice(detail)}</strong>
            <p>{detail.description || detail.summary}</p>
            {detail.url && (
              <a
                className="button primary"
                href={detail.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View product
              </a>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
