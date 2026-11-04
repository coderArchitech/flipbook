import React, { useEffect, useRef } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Modal } from "../Modal.jsx";
import { findingHelp } from "../../../shared/finding-help.mjs";

// Where a finding points: "Page 2 · Headline" or "Master Footer · Page number".
function locate(doc, f) {
  const pageIndex = doc.pages.findIndex((p) => p.id === f.pageId);
  const master = (doc.masters || []).find((m) => m.id === f.pageId);
  const page = pageIndex >= 0 ? doc.pages[pageIndex] : master;
  if (!page) return null;
  const block = page.blocks?.find((b) => b.id === f.blockId);
  return {
    pageIndex,
    label: [
      pageIndex >= 0 ? `Page ${pageIndex + 1}` : `Master ${master.name}`,
      block && (block.name || block.type),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export function ServerVersionNotice({ outdated }) {
  return (
    <div className="server-version-notice" role="status">
      <AlertTriangle size={18} aria-hidden="true" />
      <div>
        <strong>
          {outdated === "server"
            ? "The Flipbook server is older than this editor"
            : "The editor and the Flipbook server are different versions"}
        </strong>
        <p>
          {outdated === "server"
            ? "It was started before Flipbook was updated, so it may reject drafts saved by this editor. Restart the server (Ctrl+C then npm start, or docker compose up --build -d), then reload this page."
            : "Saves may be rejected until both match. Reload this page; if this message stays, restart the Flipbook server (npm start, or docker compose up --build -d)."}
        </p>
      </div>
    </div>
  );
}

export function IssuesDialog({
  findings,
  focus,
  doc,
  outdated,
  onGoTo,
  onClose,
}) {
  const list = useRef();
  useEffect(() => {
    list.current
      ?.querySelector(`[data-issue="${focus}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [focus]);
  const help = findings.map((f) => findingHelp(f.message));
  return (
    <Modal
      title={`${findings.length} ${findings.length === 1 ? "thing" : "things"} to check`}
      onClose={onClose}
      wide
    >
      {outdated && help.some((h) => h.server) && (
        <ServerVersionNotice outdated={outdated} />
      )}
      <ol className="issue-list" ref={list}>
        {findings.map((f, i) => {
          const h = help[i],
            where = locate(doc, f);
          return (
            <li
              key={i}
              data-issue={i}
              className={"issue" + (i === focus ? " focused" : "")}
              aria-current={i === focus ? "true" : undefined}
            >
              <h3>{h.title}</h3>
              <p className="issue-message">
                {f.message}
                {where && <span className="issue-where"> · {where.label}</span>}
              </p>
              <p>{h.why}</p>
              <h4>How to fix</h4>
              <ol className="issue-steps">
                {h.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {where && where.pageIndex >= 0 && (
                <button
                  className="button small"
                  onClick={() => onGoTo(f, where.pageIndex)}
                >
                  Show on page <ArrowRight size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </Modal>
  );
}
