// A BitmapLayer that decides what is underwater on the GPU.
//
// Two textures come in - ground elevation and spill elevation, both 16-bit
// values packed into the red and green channels of an ordinary PNG. The shader
// decodes them, compares each against a set of waterlines, and colors the
// result. Moving a slider changes uniforms; nothing is refetched and nothing is
// recomputed on the CPU. That is the entire reason the pipeline stores a spill
// elevation per cell instead of a flood mask per scenario.
//
// FILLS AND LINES, PLURAL. The 09-08 reframe stopped picking one projection on
// the reader's behalf, so one waterline became up to four fills and up to
// sixteen lines:
//
//   one storm, four projections - one fill (the storm at today's sea level)
//                                 and four lines (that storm plus each of the
//                                 NPCC's four percentiles for the year).
//   every storm, every projection - four fills, one per storm, and sixteen
//                                 lines, four per storm.
//
// The cost of sixteen lines is not sixteen times the cost of one. A line is the
// wet-next-to-dry test at some level, and the level a cell floods at does not
// depend on which line is being drawn - so the five decodes (this cell and its
// four neighbors) happen once and every line after that is arithmetic.
//
// Every uniform in the block is a vec4, including the ones carrying single
// numbers. std140 packing of mixed scalars and vectors is the kind of thing
// that fails as a shifted-by-one-float map rather than as an error.
import { BitmapLayer } from '@deck.gl/layers';

const uniformBlock = `\
layout(std140) uniform floodUniforms {
  vec4 fillLevels;    // up to four, largest first; a cell takes the LAST it is under
  vec4 fillColor0;
  vec4 fillColor1;
  vec4 fillColor2;
  vec4 fillColor3;
  vec4 lineLevels0;   // storm 0's four percentile levels, 10th 25th 75th 90th
  vec4 lineLevels1;
  vec4 lineLevels2;
  vec4 lineLevels3;
  vec4 lineHue0;      // rgb of storm 0's lines
  vec4 lineHue1;
  vec4 lineHue2;
  vec4 lineHue3;
  vec4 lineAlphas;    // one per percentile, 10th lightest to 90th darkest
  vec4 texelAnd;      // texel.x, texel.y, baseline, connectivity
  vec4 flags;         // fillCount, lineStormCount, lineWidth, showLine
  vec4 flags2;        // showDepth, unused, unused, unused
} flood;
`;

const floodUniforms = {
  name: 'flood',
  vs: uniformBlock,
  fs: uniformBlock,
  uniformTypes: {
    fillLevels: 'vec4<f32>',
    fillColor0: 'vec4<f32>',
    fillColor1: 'vec4<f32>',
    fillColor2: 'vec4<f32>',
    fillColor3: 'vec4<f32>',
    lineLevels0: 'vec4<f32>',
    lineLevels1: 'vec4<f32>',
    lineLevels2: 'vec4<f32>',
    lineLevels3: 'vec4<f32>',
    lineHue0: 'vec4<f32>',
    lineHue1: 'vec4<f32>',
    lineHue2: 'vec4<f32>',
    lineHue3: 'vec4<f32>',
    lineAlphas: 'vec4<f32>',
    texelAnd: 'vec4<f32>',
    flags: 'vec4<f32>',
    flags2: 'vec4<f32>'
  }
};

const fs = `\
#version 300 es
#define SHADER_NAME flood-layer-fragment-shader
precision highp float;

uniform sampler2D bitmapTexture;   // ground elevation
uniform sampler2D spillTexture;    // spill elevation

in vec2 vTexCoord;
in vec2 vTexPos;
out vec4 fragColor;

// The level this cell and its four neighbors first go under at. Decoded once
// in main(); every fill and every line is a comparison against these.
float lvlC;
float lvlE;
float lvlW;
float lvlN;
float lvlS;
vec2 cellFrac;

// The encoding the pipeline writes: meters = ((R * 256 + G) - 1000) / 10.
// This only decodes correctly under NEAREST sampling - interpolating the high
// and low bytes independently across a 256 boundary yields nonsense.
float decode(sampler2D t, vec2 uv) {
  vec4 c = texture(t, uv);
  return ((c.r * 255.0 * 256.0 + c.g * 255.0) - 1000.0) / 10.0;
}

// Two models, one comparison each. This is the whole argument of the sandbox.
// levelAt is the waterline at which this cell first goes under: its spill
// elevation with connectivity on, its own ground without.
float levelAt(vec2 uv) {
  return flood.texelAnd.w > 0.5 ? decode(spillTexture, uv)
                                : decode(bitmapTexture, uv);
}

// Where the water already is, which is two facts and not one.
//
//   the stored mask - blue channel of the elevation texture, written by the
//   pipeline. 3DEP hydro-flattens each water body to its own constant (+0.10m
//   over Jamaica Bay, -1.62m over Upper New York Bay), so no single threshold
//   finds them all and the pipeline resolves it once, per cell.
//
//   below today's water - ground against the baseline. Without this the shore
//   reads as NEW flooding all the way down to the mask's 0.3m cut, which paints
//   a band of intertidal ground and marsh pond as though the sea had just
//   arrived there. The metric says "newly flooded"; this is the "newly".
//
// Note that the second test is deliberately NOT connectivity-aware, where every
// other comparison in this shader is. Connectivity is a claim about where water
// will spread TO; it says nothing about where water already IS. The lagoons in
// Jamaica Bay sit at 0.0m with a spill elevation of 1.2m, because the channels
// joining them to the bay are narrower than a 17m cell and Priority-Flood
// cannot find a way in. Ask the connectivity model and it calls open water dry
// land about to flood. Ask the ground, and it is water, which it is.
bool existingWater(vec2 uv, float ground) {
  return texture(bitmapTexture, uv).b > 0.5 || ground <= flood.texelAnd.z;
}

vec4 fillColorAt(int i) {
  if (i == 0) return flood.fillColor0;
  if (i == 1) return flood.fillColor1;
  if (i == 2) return flood.fillColor2;
  return flood.fillColor3;
}

vec4 lineLevelsAt(int s) {
  if (s == 0) return flood.lineLevels0;
  if (s == 1) return flood.lineLevels1;
  if (s == 2) return flood.lineLevels2;
  return flood.lineLevels3;
}

vec3 lineHueAt(int s) {
  if (s == 0) return flood.lineHue0.rgb;
  if (s == 1) return flood.lineHue1.rgb;
  if (s == 2) return flood.lineHue2.rgb;
  return flood.lineHue3.rgb;
}

// Distance, in cells, from this fragment to the nearest edge shared with a cell
// that is dry at level L; 1e9 if this cell is itself dry at L. The neighbor is
// always exactly one CELL away - that is what makes the line a property of the
// grid, and why it is a staircase.
float edgeDist(float L) {
  if (lvlC > L) return 1e9;
  float d = 1e9;
  if (lvlE > L) d = min(d, 1.0 - cellFrac.x);
  if (lvlW > L) d = min(d, cellFrac.x);
  if (lvlN > L) d = min(d, 1.0 - cellFrac.y);
  if (lvlS > L) d = min(d, cellFrac.y);
  return d;
}

void main(void) {
  vec2 uv = vTexCoord;
  vec2 t = flood.texelAnd.xy;
  float ground = decode(bitmapTexture, uv);

  // Cell units, and how many cells one screen pixel spans. Both are wanted
  // inside the line branches below, and a derivative taken inside non-uniform
  // control flow is undefined - so they are computed here, before anything
  // branches, and only read down there.
  vec2 cellPos = uv / t;
  float cellsPerPixel = max(fwidth(cellPos.x), fwidth(cellPos.y));
  cellFrac = fract(cellPos);

  // -100m is the pipeline's "no data" sentinel - outside the DEM's coverage.
  if (ground < -99.0) { fragColor = vec4(0.0); return; }

  lvlC = levelAt(uv);
  lvlE = levelAt(uv + vec2(t.x, 0.0));
  lvlW = levelAt(uv - vec2(t.x, 0.0));
  lvlN = levelAt(uv + vec2(0.0, t.y));
  lvlS = levelAt(uv - vec2(0.0, t.y));

  bool already = existingWater(uv, ground);
  int fillCount = int(flood.flags.x + 0.5);

  // The fills, largest first. A cell takes the color of the LAST fill it is
  // under, which is the smallest one that still covers it.
  vec4 color = vec4(0.0);
  int hit = -1;
  for (int i = 0; i < 4; i++) {
    if (i >= fillCount) break;
    if (lvlC <= flood.fillLevels[i]) hit = i;
  }

  if (hit >= 0 && !already) {
    color = fillColorAt(hit);
    // Depth shading is only meaningful when there is one fill; four fills
    // cannot each carry a depth.
    if (fillCount == 1 && flood.flags2.x > 0.5) {
      float depth = clamp((flood.fillLevels[0] - ground) / 6.0, 0.0, 1.0);
      vec3 shallow = vec3(0.36, 0.60, 0.75);
      vec3 deep    = vec3(0.06, 0.22, 0.42);
      color = vec4(mix(shallow, deep, depth), color.a);
    }
  } else if (fillCount == 1 && flood.texelAnd.w > 0.5
             && ground <= flood.fillLevels[0] && hit < 0 && !already) {
    // A cell a naive bathtub floods but water cannot physically reach. Only
    // meaningful for the single fill of the one-storm view.
    color = vec4(0.82, 0.27, 0.24, 0.42);
  }

  // The fill's own edge, drawn as the wet cells next to dry ones.
  if (flood.flags.w > 0.5 && hit >= 0) {
    float d = edgeDist(flood.fillLevels[hit]);
    if (d < flood.flags.z * cellsPerPixel) color = vec4(0.05, 0.09, 0.16, 0.95);
  }

  // The projection lines, drawn over the fill. Storm by storm, percentile by
  // percentile, lightest first so the 90th ends up on top where they coincide.
  int storms = int(flood.flags.y + 0.5);
  for (int s = 0; s < 4; s++) {
    if (s >= storms) break;
    vec4 levels = lineLevelsAt(s);
    vec3 hue = lineHueAt(s);
    for (int p = 0; p < 4; p++) {
      float d = edgeDist(levels[p]);
      if (d < flood.flags.z * cellsPerPixel) color = vec4(hue, flood.lineAlphas[p]);
    }
  }

  if (color.a <= 0.0) { fragColor = vec4(0.0); return; }

  fragColor = vec4(color.rgb, color.a * layer.opacity);
  geometry.uv = uv;
  DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;

const V4 = (a) => [a?.[0] ?? 0, a?.[1] ?? 0, a?.[2] ?? 0, a?.[3] ?? 0];

export default class FloodLayer extends BitmapLayer {
  getShaders() {
    const shaders = super.getShaders();
    return { ...shaders, fs, modules: [...shaders.modules, floodUniforms] };
  }

  draw(opts) {
    const { model, coordinateConversion, bounds, disablePicking } = this.state;
    const {
      image, spillImage, fills, fillColors, lines, lineHues, lineAlphas,
      baseline, connectivity, showLine, showDepth, lineWidth,
      gridWidth, gridHeight
    } = this.props;
    if (opts.shaderModuleProps.picking.isActive && disablePicking) return;
    if (!image || !spillImage || !model) return;

    const fc = fillColors ?? [];
    const ll = lines ?? [];
    const lh = lineHues ?? [];

    model.shaderInputs.setProps({
      bitmap: {
        bitmapTexture: image,
        bounds,
        coordinateConversion,
        desaturate: 0,
        tintColor: [1, 1, 1],
        transparentColor: [0, 0, 0, 0]
      },
      flood: {
        spillTexture: spillImage,
        fillLevels: V4(fills),
        fillColor0: V4(fc[0]),
        fillColor1: V4(fc[1]),
        fillColor2: V4(fc[2]),
        fillColor3: V4(fc[3]),
        lineLevels0: V4(ll[0]),
        lineLevels1: V4(ll[1]),
        lineLevels2: V4(ll[2]),
        lineLevels3: V4(ll[3]),
        lineHue0: V4(lh[0]),
        lineHue1: V4(lh[1]),
        lineHue2: V4(lh[2]),
        lineHue3: V4(lh[3]),
        lineAlphas: V4(lineAlphas),
        texelAnd: [1 / gridWidth, 1 / gridHeight, baseline, connectivity ? 1 : 0],
        flags: [
          (fills ?? []).length,
          ll.length,
          lineWidth ?? 1.5, // screen pixels, not texels
          showLine ? 1 : 0
        ],
        flags2: [showDepth ? 1 : 0, 0, 0, 0]
      }
    });
    model.draw(this.context.renderPass);
  }
}

FloodLayer.layerName = 'FloodLayer';
FloodLayer.defaultProps = {
  ...BitmapLayer.defaultProps,
  // type 'image' so deck loads it as a texture and applies textureParameters -
  // which must specify NEAREST filtering, or the byte-pair decode breaks.
  spillImage: { type: 'image', value: null, async: true },
  // Up to four fill levels in meters NAVD88, largest first, with an rgba each.
  fills: { type: 'array', value: [], compare: true },
  fillColors: { type: 'array', value: [], compare: true },
  // Up to four storms, each with its four percentile levels and one hue; the
  // four alphas are shared, 10th lightest to 90th darkest.
  lines: { type: 'array', value: [], compare: true },
  lineHues: { type: 'array', value: [], compare: true },
  lineAlphas: { type: 'array', value: [0.4, 0.6, 0.8, 1], compare: true },
  baseline: { type: 'number', value: 0 },
  connectivity: { type: 'boolean', value: true },
  showLine: { type: 'boolean', value: true },
  showDepth: { type: 'boolean', value: true },
  lineWidth: { type: 'number', value: 1.5 },
  gridWidth: { type: 'number', value: 1 },
  gridHeight: { type: 'number', value: 1 }
};
