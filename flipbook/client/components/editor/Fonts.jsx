import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, uploadFont } from "../../api.js";
import { fontFaceCSS } from "../../../shared/editor-render.mjs";

const FontsContext = createContext({ fonts: [], upload: async () => null });
export const useFonts = () => useContext(FontsContext);

// Loads the account's uploaded fonts once, declares their @font-face rules for
// the editor, previews and thumbnails, and shares the list with font pickers.
export function FontsProvider({ children }) {
  const [fonts, setFonts] = useState([]);
  const refresh = useCallback(
    () =>
      api("/fonts")
        .then(setFonts)
        .catch(() => {}),
    [],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);
  const upload = async (file) => {
    const font = await uploadFont(file);
    await refresh();
    return font;
  };
  return (
    <FontsContext.Provider value={{ fonts, upload }}>
      <style>
        {fontFaceCSS(
          fonts.map((f) => f.id),
          (id) => `/api/fonts/${id}/file`,
        )}
      </style>
      {children}
    </FontsContext.Provider>
  );
}

export function FontUpload() {
  const { fonts, upload } = useFonts();
  const [message, setMessage] = useState(null),
    [busy, setBusy] = useState(false);
  return (
    <div className="font-upload">
      <label className="field">
        <span>Upload font (TTF, OTF or WOFF)</span>
        <input
          type="file"
          aria-label="Upload font (TTF, OTF or WOFF)"
          accept=".ttf,.otf,.woff,font/ttf,font/otf,font/woff"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files[0];
            e.target.value = "";
            if (!file) return;
            if (file.size > 5 * 1024 ** 2)
              return setMessage({ error: "Fonts must be under 5 MB." });
            setBusy(true);
            setMessage(null);
            try {
              const font = await upload(file);
              setMessage({ ok: `${font.family} is ready to use.` });
            } catch (error) {
              setMessage({ error: error.message });
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {message?.ok && <p role="status">{message.ok}</p>}
      {message?.error && <p role="alert">{message.error}</p>}
      {fonts.length > 0 && (
        <p className="muted small">
          Your fonts: {fonts.map((f) => f.family).join(", ")}
        </p>
      )}
    </div>
  );
}
