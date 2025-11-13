// packages/core/src/schema.ts
import { z } from "zod";
export const GlyphZ = z.object({
  // TODO: 
});
export type Glyph = z.infer<typeof GlyphZ>;
