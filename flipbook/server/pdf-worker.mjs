import { parentPort, workerData } from "node:worker_threads";
import { renderPDF } from "./pdf-render.mjs";
try {
  const bytes = await renderPDF(workerData);
  parentPort.postMessage({ bytes });
} catch (e) {
  console.error(e.stack);
  parentPort.postMessage({ error: e.message, findings: e.findings });
}
