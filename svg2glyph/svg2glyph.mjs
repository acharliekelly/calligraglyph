#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import { svgPathProperties } from "svg-path-properties";
import { z } from "zod";

const GlyphSchema = z.object({
  schema: z.literal("calligraglyph/v1"),
  id: z.string(),
  style: z.string(),
  char: z.string(),
  case: z.enum(["upper", "lower"]),
  bbox: z.object({
    w: z.number(),
    h: z.number(),
    baseline: z.number(),
    xHeight: z.number().optional(),
    ascender: z.number().optional(),
    descender: z.number().optional()
  }),
  nib: z.object({
    width: z.number(),
    angleDeg: z.number(),
    type: z.enum(["broad", "pointed"]).optional()
  }).optional(),
  strokes: z.array(z.object({
    id: z.string(),
    order: z.number(),
    path: z.string(),
    durationMs: z.number(),
    delayMs: z.number().optional(),
    direction: z.enum(["forward","reverse"]).optional(),
    pressure: z.array(z.tuple([z.number(), z.number()])).optional(),
    guide: z.object({
      arrows: z.boolean().optional(),
      startMarker: z.enum(["dot","arrow"]).optional()
    }).optional(),
    tags: z.array(z.string()).optional()
  })),
  variants: z.object({ alt: z.array(z.string()).optional() }).optional(),
  attribution: z.object({
    source: z.string().optional(),
    license: z.string().optional(),
    author: z.string().optional()
  }).optional()
});

const program = new Command();
program
  .name("calligraglyph")
  .description("Convert an ordered SVG of per-stroke paths into calliform glyph JSON.")
  .argument("<input.svg>", "Input SVG file")
  .option("-o, --out <file.json>", "Output JSON path (defaults to <input>.json)")
  .option("--style <style>", "Style name (e.g., gothic)", "gothic")
  .option("--char <char>", "Character (e.g., C)", "C")
  .option("--case <case>", "Case: upper|lower", "upper")
  .option("--nib-width <num>", "Nib width (logical units)", "60")
  .option("--nib-angle <deg>", "Nib angle in degrees", "35")
  .option("--baseline <num>", "Baseline Y in viewBox units", "800")
  .option("--xheight <num>", "xHeight Y", "500")
  .option("--ascender <num>", "Ascender Y", "900")
  .option("--descender <num>", "Descender depth", "150")
  .option("--speed <k>", "ms per unit length multiplier", "1.2")
  .option("--min-dur <ms>", "minimum per-stroke duration", "280")
  .option("--max-dur <ms>", "maximum per-stroke duration", "1600")
  .option("--delay <ms>", "inter-stroke delay", "60")
  .parse(process.argv);

const opts = program.opts();
const [inputPath] = program.args;
if (!inputPath) {
  console.error("No input provided.");
  process.exit(1);
}
const svg = fs.readFileSync(inputPath, "utf8");
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  allowBooleanAttributes: true
});
const doc = parser.parse(svg);
if (!doc.svg) {
  console.error("Not an SVG file (missing <svg> root).");
  process.exit(1);
}

// ViewBox parsing & normalization
let vb = doc.svg.viewBox || doc.svg.viewbox || "0 0 1000 1000";
if (typeof vb !== "string") {
  // some exports make it an object; best-effort
  vb = [doc.svg.viewBox.x || 0, doc.svg.viewBox.y || 0, doc.svg.viewBox.width || 1000, doc.svg.viewBox.height || 1000].join(" ");
}
const [vx, vy, vw, vh] = vb.split(/\s+/).map(Number);
if (!(vw > 0 && vh > 0)) {
  console.warn("Warning: invalid viewBox. Defaulting to 1000x1000.");
}

// Gather <path> elements; fast-xml-parser collapses singletons—normalize to array
function flattenPaths(node) {
  const paths = [];
  if (!node) return paths;
  const p = node.path;
  if (Array.isArray(p)) {
    paths.push(...p);
  } else if (p) {
    paths.push(p);
  }
  // also drill into <g> if present
  const g = node.g;
  if (Array.isArray(g)) {
    for (const child of g) paths.push(...flattenPaths(child));
  } else if (g) {
    paths.push(...flattenPaths(g));
  }
  return paths;
}
const paths = flattenPaths(doc.svg);
if (paths.length === 0) {
  console.error("No <path> elements found. Make sure each stroke is a separate <path>.");
  process.exit(1);
}

// Determine order:
// 1) data-stroke-order attribute
// 2) numeric prefix in 'id' or 'inkscape:label' or 'name'
// 3) fallback to document order
function parseOrder(p) {
  if (p["data-stroke-order"] != null) {
    const n = Number(p["data-stroke-order"]);
    if (!Number.isNaN(n)) return n;
  }
  const candidates = [p.id, p.label, p.name, p["inkscape:label"]];
  for (const c of candidates) {
    if (typeof c === "string") {
      const m = c.match(/^(\d{1,3})[_\-\s]/);
      if (m) return Number(m[1]);
    }
  }
  return Infinity; // will be sorted to the end
}

const enriched = paths
  .filter(p => typeof p.d === "string" && p.d.trim().length > 0)
  .map((p, idx) => {
    const order = parseOrder(p);
    const id = p.id || `s${order !== Infinity ? String(order) : String(idx+1)}`;
    let length = 400; // fallback
    try {
      length = new svgPathProperties(p.d).getTotalLength();
    } catch {
      console.warn(`Warning: could not compute length for path ${id}; using fallback.`);
    }
    return { id, order, d: p.d, length };
  })
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

// If none had explicit order, keep original order
const hasExplicit = enriched.some(e => e.order !== Infinity);
const ordered = hasExplicit ? enriched : enriched.map((e, i) => ({ ...e, order: i + 1 }));

// Timing model
const k = Number(opts.speed);
const minDur = Number(opts["min-dur"]);
const maxDur = Number(opts["max-dur"]);
const delay = Number(opts.delay);
function clamp(min, max, v) { return Math.max(min, Math.min(max, v)); }

const strokes = ordered.map((s, i) => {
  const durationMs = clamp(minDur, maxDur, Math.round(s.length * k));
  return {
    id: s.id,
    order: i + 1,
    path: s.d,
    durationMs,
    delayMs: i === 0 ? 0 : delay
  };
});

const glyph = {
  schema: "calligraglyph/v1",
  id: `${opts.style}/${opts.char}/${opts.case}/v1`,
  style: opts.style,
  char: opts.char,
  case: opts.case.toLowerCase() === "lower" ? "lower" : "upper",
  bbox: {
    w: Number.isFinite(vw) && vw > 0 ? vw : 1000,
    h: Number.isFinite(vh) && vh > 0 ? vh : 1000,
    baseline: Number(opts.baseline),
    xHeight: Number(opts.xheight),
    ascender: Number(opts.ascender),
    descender: Number(opts.descender)
  },
  nib: {
    width: Number(opts["nib-width"]),
    angleDeg: Number(opts["nib-angle"])
  },
  strokes,
  attribution: { source: path.basename(inputPath) }
};

const res = GlyphSchema.safeParse(glyph);
if (!res.success) {
  console.error("Validation failed:", res.error.format());
  process.exit(1);
}

const outPath = opts.out || path.join(
  path.dirname(inputPath),
  path.basename(inputPath, path.extname(inputPath)) + ".json"
);
fs.writeFileSync(outPath, JSON.stringify(glyph, null, 2), "utf8");
console.log(`✅ Wrote ${outPath} (${strokes.length} strokes)`);
