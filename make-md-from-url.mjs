import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import got from "got";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import gfmPkg from "turndown-plugin-gfm";
import { HttpsProxyAgent } from "https-proxy-agent";
import { HttpProxyAgent } from "http-proxy-agent";

const gfm = gfmPkg.gfm || gfmPkg;
const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const args = {
    url: "",
    out: "install-ubuntu-server.md",
    imagesDir: "",
    toc: true,
    frontmatter: true,
    debug: false,
    transport: "auto" // auto | got | curl
  };
  const rest = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-toc") args.toc = false;
    else if (a === "--no-frontmatter") args.frontmatter = false;
    else if (a === "--toc") args.toc = true;
    else if (a === "--frontmatter") args.frontmatter = true;
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--images-dir") args.imagesDir = argv[++i];
    else if (a === "--debug") args.debug = true;
    else if (a === "--transport") args.transport = (argv[++i] || "").toLowerCase();
    else if (a.startsWith("--")) throw new Error(`Unknown option: ${a}`);
    else rest.push(a);
  }
  if (!args.url && rest[0]) args.url = rest[0];
  if (!args.url) {
    throw new Error("Usage: node make-md-from-url.mjs <url> [--out install-ubuntu-server.md] [--images-dir images/install-ubuntu-server] [--toc|--no-toc] [--frontmatter|--no-frontmatter] [--debug] [--transport auto|got|curl]");
  }
  if (!args.imagesDir) {
    const base = path.parse(args.out).name;
    args.imagesDir = path.join("images", base);
  }
  if (!["auto", "got", "curl"].includes(args.transport)) {
    throw new Error(`Invalid --transport value: ${args.transport} (use auto|got|curl)`);
  }
  return args;
}

function log(debug, ...msgs) {
  if (debug) console.log("[debug]", ...msgs);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\u2000-\u206F\u2E00-\u2E7F\\/'"“”‘’()[\]{}:;.,!?`~@#$%^&*+=<>|]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getExtFromContentType(ct) {
  if (!ct) return "";
  const m = String(ct).split(";")[0].trim().toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return ".jpg";
  if (m === "image/png") return ".png";
  if (m === "image/webp") return ".webp";
  if (m === "image/gif") return ".gif";
  if (m === "image/svg+xml") return ".svg";
  if (m === "image/avif") return ".avif";
  return "";
}

function pickBestFromSrcset(srcset) {
  const parts = srcset
    .split(",")
    .map(s => s.trim())
    .map(s => {
      const [u, d] = s.split(/\s+/);
      const width = d && d.endsWith("w") ? parseInt(d) : (d && d.endsWith("x") ? Math.round(parseFloat(d) * 1000) : 0);
      return { url: u, width: isNaN(width) ? 0 : width };
    })
    .filter(x => x.url);
  if (parts.length === 0) return "";
  parts.sort((a, b) => b.width - a.width);
  return parts[0].url;
}

function toAbsoluteUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function buildAgent(debug) {
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy || "";
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy || "";
  const agent = {};
  if (httpsProxy) {
    agent.https = new HttpsProxyAgent(httpsProxy);
    log(debug, "Using HTTPS proxy:", httpsProxy);
  }
  if (httpProxy) {
    agent.http = new HttpProxyAgent(httpProxy);
    log(debug, "Using HTTP proxy:", httpProxy);
  }
  return agent;
}

// curl helpers
async function curlGetString(url, debug) {
  log(debug, "curl GET (text):", url);
  const { stdout } = await execFileAsync("curl", ["-L", "--fail", "--silent", "--show-error", url], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  return stdout;
}
async function curlGetBuffer(url, debug) {
  log(debug, "curl GET (buffer):", url);
  const { stdout } = await execFileAsync("curl", ["-L", "--fail", "--silent", "--show-error", url], { encoding: "buffer", maxBuffer: 100 * 1024 * 1024 });
  return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
}

// Fetch HTML with selected transport
async function fetchHtml(url, debug, transport) {
  if (transport === "curl") {
    return await curlGetString(url, debug);
  }
  if (transport === "got") {
    return await got(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; url-to-markdown/1.0)",
        "accept": "text/html,application/xhtml+xml"
      },
      dnsLookupIpVersion: "ipv4",
      http2: false,
      timeout: { request: 60000 },
      retry: { limit: 3 },
      agent: buildAgent(debug)
    }).then(r => r.body);
  }
  // auto: try got, fall back to curl
  try {
    return await fetchHtml(url, debug, "got");
  } catch (e) {
    console.warn("! got failed for HTML, falling back to curl:", e.code || e.name || e.message);
    return await fetchHtml(url, debug, "curl");
  }
}

// Fetch binary with selected transport
async function fetchBuffer(url, debug, transport) {
  if (transport === "curl") {
    return { buffer: await curlGetBuffer(url, debug), contentType: "" };
  }
  if (transport === "got") {
    const res = await got(url, {
      responseType: "buffer",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; url-to-markdown/1.0)",
        "accept": "*/*"
      },
      dnsLookupIpVersion: "ipv4",
      http2: false,
      timeout: { request: 60000 },
      retry: { limit: 3 },
      agent: buildAgent(debug)
    });
    return { buffer: res.body, contentType: res.headers["content-type"] || "" };
  }
  // auto: try got, fall back to curl
  try {
    return await fetchBuffer(url, debug, "got");
  } catch (e) {
    console.warn("! got failed for image, falling back to curl:", e.code || e.name || e.message);
    return await fetchBuffer(url, debug, "curl");
  }
}

function setupTurndown() {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    linkStyle: "inlined"
  });
  td.use(gfm);
  td.options.br = true;
  return td;
}

function buildToc(markdown) {
  const lines = markdown.split("\n");
  const headings = [];
  for (const line of lines) {
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/#+\s*$/, "").trim();
    if (!text) continue;
    headings.push({ level, text, slug: slugify(text) });
  }
  const tocLines = [];
  for (const h of headings) {
    if (h.level === 1) continue;
    const indent = "  ".repeat(Math.max(0, h.level - 2));
    tocLines.push(`${indent}- [${h.text}](#${h.slug})`);
  }
  if (tocLines.length === 0) return "";
  return ["## Table of contents", "", ...tocLines, ""].join("\n");
}

async function downloadAndRewriteImages(doc, baseUrl, imagesDir, mdDir, debug, transport) {
  await ensureDir(imagesDir);
  const imgEls = Array.from(doc.querySelectorAll("img"));
  const usedNames = new Set();
  let counter = 1;

  for (const img of imgEls) {
    let src = img.getAttribute("src") || "";
    const dataSrc = img.getAttribute("data-src") || "";
    const srcset = img.getAttribute("srcset") || "";
    if (!src && srcset) src = pickBestFromSrcset(srcset);
    if (!src && dataSrc) src = dataSrc;
    if (!src) continue;

    const abs = toAbsoluteUrl(baseUrl, src);
    if (abs.startsWith("data:")) continue;

    let urlObj;
    try {
      urlObj = new URL(abs);
    } catch {
      continue;
    }
    let baseName = path.basename(urlObj.pathname);
    if (!baseName || baseName === "/" || baseName.startsWith("?")) {
      baseName = `image-${counter++}`;
    }
    baseName = baseName.split("?")[0].split("#")[0];
    let ext = path.extname(baseName);
    let nameNoExt = ext ? baseName.slice(0, -ext.length) : baseName;

    let buffer, contentType;
    try {
      const fetched = await fetchBuffer(abs, debug, transport);
      buffer = fetched.buffer;
      contentType = fetched.contentType;
    } catch (e) {
      console.warn(`! Failed to download image: ${abs} (${e.message || e})`);
      continue;
    }

    if (!ext || !/^\.(png|jpg|jpeg|webp|gif|svg|avif)$/i.test(ext)) {
      const guessed = getExtFromContentType(contentType);
      ext = guessed || ext || ".bin";
    }
    nameNoExt = slugify(nameNoExt) || `image-${counter++}`;
    let finalName = `${nameNoExt}${ext}`;
    while (usedNames.has(finalName)) {
      finalName = `${nameNoExt}-${counter++}${ext}`;
    }
    usedNames.add(finalName);

    const outPath = path.join(imagesDir, finalName);
    await fs.writeFile(outPath, buffer);

    const rel = path.relative(mdDir, outPath).split(path.sep).join("/");
    img.setAttribute("src", rel);
    img.removeAttribute("srcset");
    log(debug, "Saved image:", outPath, "-> markdown src:", rel);
  }
}

async function convert({ url, out, imagesDir, toc, frontmatter, debug, transport }) {
  log(debug, "Starting conversion with args:", { url, out, imagesDir, toc, frontmatter, transport });
  const html = await fetchHtml(url, debug, transport);
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (!article) throw new Error("Failed to extract the main article from the page (Readability returned null).");

  log(debug, "Article extracted. Title:", article.title);

  const articleDom = new JSDOM(article.content, { url });
  const doc = articleDom.window.document;

  // Remove non-article elements
  doc.querySelectorAll("script,noscript,iframe").forEach(n => n.remove());

  // Make links absolute
  doc.querySelectorAll("a[href]").forEach(a => {
    const href = a.getAttribute("href") || "";
    if (href.startsWith("#")) return;
    a.setAttribute("href", toAbsoluteUrl(url, href));
  });

  const mdDir = path.dirname(path.resolve(out));
  await ensureDir(mdDir);
  await downloadAndRewriteImages(doc, url, path.resolve(imagesDir), mdDir, debug, transport);

  const turndown = setupTurndown();
  const bodyMarkdown = turndown.turndown(doc.body);

  const fm = frontmatter
    ? [
        "---",
        `title: "${(article.title || dom.window.document.title || "Document").replace(/"/g, '\\"')}"`,
        `source_url: "${url}"`,
        `retrieved_at: "${new Date().toISOString()}"`,
        ...(article.byline ? [`byline: "${article.byline.replace(/"/g, '\\"')}"`] : []),
        ...(article.siteName ? [`site_name: "${article.siteName.replace(/"/g, '\\"')}"`] : []),
        "---",
        ""
      ].join("\n")
    : "";

  const tocBlock = toc ? buildToc(bodyMarkdown) : "";
  const finalMd = [fm, tocBlock, bodyMarkdown].filter(Boolean).join("\n");

  await fs.writeFile(path.resolve(out), finalMd, "utf8");
  log(debug, "Markdown written:", path.resolve(out));

  return {
    outFile: path.resolve(out),
    imagesDir: path.resolve(imagesDir),
    title: article.title || dom.window.document.title || ""
  };
}

(async () => {
  try {
    const args = parseArgs(process.argv);
    const result = await convert(args);
    console.log(`✓ Wrote Markdown: ${result.outFile}`);
    console.log(`✓ Images saved to: ${result.imagesDir}`);
    if (result.title) console.log(`Title: ${result.title}`);
  } catch (err) {
    console.error("Error:", err && (err.stack || err.message || String(err)));
    process.exit(1);
  }
})();