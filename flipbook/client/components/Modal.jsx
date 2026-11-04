import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
function IconButton({ label, children, ...props }) {
  return (
    <button className="icon-button" aria-label={label} {...props}>
      {children}
    </button>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const prior = document.activeElement;
    ref.current.showModal();
    return () => prior?.focus?.();
  }, []);
  return (
    <dialog
      aria-label={title}
      className={"modal " + (wide ? "wide" : "")}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </header>
      {children}
    </dialog>
  );
}
