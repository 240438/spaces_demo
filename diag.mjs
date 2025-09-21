import process from "node:process";

console.log("Node version:", process.version);
console.log("Platform:", process.platform, process.arch);

try {
  const Turndown = (await import("turndown")).default;
  console.log("turndown OK:", typeof Turndown === "function");
} catch (e) {
  console.error("turndown import failed:", e.message || e);
}

try {
  const gfm = await import("turndown-plugin-gfm");
  console.log("turndown-plugin-gfm OK:", !!(gfm.gfm || gfm.default));
} catch (e) {
  console.error("turndown-plugin-gfm import failed:", e.message || e);
}

try {
  const got = await import("got");
  console.log("got OK:", typeof got.default === "function" || typeof got.got === "function");
} catch (e) {
  console.error("got import failed:", e.message || e);
}

try {
  const res = await (await import("got")).default("https://example.com", { timeout: { request: 10000 } });
  console.log("Network fetch OK:", res.statusCode);
} catch (e) {
  console.error("Network fetch failed:", e.message || e);
}