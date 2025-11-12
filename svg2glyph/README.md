# SVG 2 GLYPH
Convert SVG calligraphy guide into animated glyph

## Installation
`npm i`

`chmod +x svg2glyph.mjs`

## Usage

### Basic:
`./svg2glyph.mjs input.svg`

### Custom metadata and output:
`./svg2glyph.mjs input.svg \
  --style gothic --char C --case upper \
  --nib-width 60 --nib-angle 35 \
  --baseline 800 --xheight 500 --ascender 900 --descender 150 \
  --speed 1.2 --min-dur 280 --max-dur 1600 --delay 60 \
  -o C_gothic.json`
