import { build, context } from "esbuild";
const options = {
  entryPoints: ["public/reader.js"],
  bundle: true,
  format: "esm",
  splitting: true,
  outdir: "dist/reader",
  publicPath: "/reader/",
  entryNames: "reader",
  chunkNames: "[name]-[hash]",
  minify: true,
  sourcemap: false,
  target: "es2022",
};
if (process.argv.includes("--watch")) await (await context(options)).watch();
else await build(options);
