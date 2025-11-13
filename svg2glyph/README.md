# SVG 2 Glyph
Convert SVG calligraphy letter stroke guide into animated glyph

## Installation
`npm i`

`chmod +x svg2glyph.mjs`

## Usage

### Basic:
`./svg2glyph.mjs ./uploads/sample_C.svg`

### Custom metadata and output:
`./svg2glyph.mjs ./uploads/sample_C.svg \
  --style basic --char C --case upper \
  --nib-width 60 --nib-angle 35 \
  --baseline 800 --xheight 500 --ascender 900 --descender 150 \
  --speed 1.2 --min-dur 280 --max-dur 1600 --delay 60 \
  -o ./uploads/C_basic.json`
