import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export const HERE = fileURLToPath(new URL(".", import.meta.url));
export const FLIPBOOK = resolve(HERE, "../../flipbook");
export const OUT = resolve(HERE, "out");
export const FFMPEG = resolve(HERE, "node_modules/ffmpeg-static/ffmpeg");
export const FONT = resolve(HERE, "node_modules/@fontsource/fraunces/files/fraunces-latin-600-italic.woff");
