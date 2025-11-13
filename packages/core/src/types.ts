// packages/core/src/types.ts
export type Case = "upper" | "lower";

export interface BBox {
  w: number; h: number;
  baseline: number; xHeight?: number; ascender?: number; descender?: number;
}

export interface Stroke {
  id: string;
  order: number;
  path: string;     // SVG path data
  durationMs: number;
  delayMs?: number;
  direction?: "forward" | "reverse";
  pressure?: Array<[number, number]>;
  tags?: string[];
}

export interface Glyph {
  schema: "calligraglyph/v1";
  id: string;
  style: string;
  char: string;   // can be multi-char later ("Th")
  case: Case;
  bbox: BBox;
  nib?: { width: number; angleDeg: number; type?: "broad"|"pointed"|"chisel"|"split"};
  strokes: Stroke[];
  variants?: { alt?: string[] };
  attribution?: { source?: string; license?: string; author?: string };
}