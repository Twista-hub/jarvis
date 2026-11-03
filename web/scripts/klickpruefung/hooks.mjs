export async function resolve(spec, ctx, next) {
  if (spec === "cloudflare:workers") return { url: new URL("./stub.mjs", import.meta.url).href, shortCircuit: true };
  if (spec.startsWith(".") && !/\.[a-z]+$/i.test(spec) && ctx.parentURL?.includes("/web/src/")) {
    try { return await next(spec + ".ts", ctx); } catch {}
  }
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url.endsWith(".json")) return next(url, { ...ctx, importAttributes: { type: "json" } });
  if (/\.(md|txt|html|css|svg)$/.test(url)) {
    const { readFile } = await import("node:fs/promises");
    const t = await readFile(new URL(url), "utf8");
    return { format: "module", source: `export default ${JSON.stringify(t)};`, shortCircuit: true };
  }
  return next(url, ctx);
}
