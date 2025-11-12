export interface CalligraGlyph {
  schema: "calligraglyph/v1";
  id: string;
  style: string;
  char: string;
  case: "upper" | "lower";
  bbox: { w: number; h: number; baseline: number; xHeight?: number; ascender?: number; descender?: number; };
  nib?: { width: number; angleDeg: number; type?: "broad" | "pointed" };
  strokes: Array<{
    id: string;
    order: number;
    path: string;              // valid SVG path data
    durationMs: number;
    delayMs?: number;
    direction?: "forward" | "reverse";
    pressure?: Array<[number, number]>; // t∈[0..1], pressure∈[0..1]
    guide?: { arrows?: boolean; startMarker?: "dot" | "arrow" };
    tags?: string[];
  }>;
  variants?: { alt?: string[] };
  attribution?: { source?: string; license?: string; author?: string };
}
