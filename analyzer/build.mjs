import * as esbuild from "esbuild";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { copyFileSync, mkdirSync } from "fs";

const here = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");

mkdirSync(join(here, "dist"), { recursive: true });
copyFileSync(join(here, "index.html"), join(here, "dist/index.html"));

const config = {
  entryPoints: [join(here, "src/main.jsx")],
  bundle: true,
  outfile: join(here, "dist/bundle.js"),
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  jsx: "automatic",
  loader: { ".js": "jsx", ".css": "css" },
  define: { "process.env.NODE_ENV": '"production"' },
  minify: !watch,
  sourcemap: watch,
  logLevel: "info",
};

// esbuild emits the imported CSS next to the JS as dist/bundle.css.
if (watch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log("watching…");
} else {
  await esbuild.build(config);
  console.log("built dist/bundle.js");
}
