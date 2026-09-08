// A BitmapLayer that decides what is underwater on the GPU.
//
// Two textures come in - ground elevation and spill elevation, both 16-bit
// values packed into the red and green channels of an ordinary PNG. The shader
// decodes them, compares each against the waterline, and colors the result.
// Moving a slider changes one uniform; nothing is refetched and nothing is
// recomputed on the CPU. That is the entire reason the pipeline stores a spill
// elevation per cell instead of a flood mask per scenario.
//
// The flood line is drawn by edge detection in the same pass: a cell is on the
// line if it is wet and one of its four neighbors is dry. So the line is
// visibly a by-product of the threshold rather than a separate published
// object - and at high zoom you can see it is a staircase of grid cells, which
// is what every smooth blue polygon on a published flood map is hiding.
import { BitmapLayer } from '@deck.gl/layers';

const uniformBlock = `\
layout(std140) uniform floodUniforms {
  float waterline;
  float baseline;
  float connectivity;
  float showLine;
  float lineWidth;
  vec2 texel;
  float showDepth;
} flood;
`;

const floodUniforms = {
  name: 'flood',
  vs: uniformBlock,
  fs: uniformBlock,
  uniformTypes: {
    waterline: 'f32',
    baseline: 'f32',
    connectivity: 'f32',
    showLine: 'f32',
    lineWidth: 'f32',
    texel: 'vec2<f32>',
    showDepth: 'f32'
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
  return flood.connectivity > 0.5 ? decode(spillTexture, uv)
                                  : decode(bitmapTexture, uv);
}

bool wet(vec2 uv) { return levelAt(uv) <= flood.waterline; }

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
bool existingWater(vec2 uv) {
  return texture(bitmapTexture, uv).b > 0.5
      || decode(bitmapTexture, uv) <= flood.baseline;
}

void main(void) {
  vec2 uv = vTexCoord;
  float ground = decode(bitmapTexture, uv);

  // Cell units, and how many cells one screen pixel spans. Both are wanted
  // inside the flood-line branch below, and a derivative taken inside
  // non-uniform control flow is undefined - so they are computed here, before
  // anything branches, and only read down there.
  vec2 cellPos = uv / flood.texel;
  float cellsPerPixel = max(fwidth(cellPos.x), fwidth(cellPos.y));

  // -100m is the pipeline's "no data" sentinel - outside the DEM's coverage.
  if (ground < -99.0) { fragColor = vec4(0.0); return; }

  bool isWet = wet(uv);
  bool already = existingWater(uv);

  // A cell a naive bathtub floods but water cannot physically reach.
  bool unreachable = ground <= flood.waterline && !isWet && !already;

  // Existing sea is left to the basemap, except that it still carries the line.
  bool draw = (isWet && !already) || unreachable;
  if (!draw && !(isWet && flood.showLine > 0.5)) { fragColor = vec4(0.0); return; }

  vec4 color = vec4(0.0);
  if (unreachable) {
    color = vec4(0.82, 0.27, 0.24, 0.42);
  } else if (isWet && !already) {
    float depth = clamp((flood.waterline - ground) / 6.0, 0.0, 1.0);
    vec3 shallow = vec3(0.36, 0.60, 0.75);
    vec3 deep    = vec3(0.06, 0.22, 0.42);
    color = vec4(mix(shallow, deep, flood.showDepth > 0.5 ? depth : 0.35), 0.72);
  }

  // Edge detect: wet next to dry. Drawn last so it sits over the fill.
  //
  // The neighbor is always exactly one CELL away - that is what makes the line
  // a property of the grid, and why it is a staircase. The line's WIDTH is a
  // separate question, and it is in screen pixels. Measured in texels, as it
  // was, the stroke grew with the zoom until a "contour" was a solid one-cell
  // black block sitting on top of the fill - which is the one thing a flood
  // line must never look like. So: find which neighbors are dry, take the
  // distance to that cell edge, and convert it to pixels.
  if (flood.showLine > 0.5 && isWet) {
    vec2 t = flood.texel;
    vec2 f = fract(cellPos);
    float d = 1e9;
    if (!wet(uv + vec2(t.x, 0.0))) d = min(d, 1.0 - f.x);
    if (!wet(uv - vec2(t.x, 0.0))) d = min(d, f.x);
    if (!wet(uv + vec2(0.0, t.y))) d = min(d, 1.0 - f.y);
    if (!wet(uv - vec2(0.0, t.y))) d = min(d, f.y);
    // Zoomed out, a cell is smaller than a pixel and the whole cell is line -
    // which is the hairline it always was. Zoomed in, only the rim is.
    if (d < flood.lineWidth * cellsPerPixel) color = vec4(0.05, 0.09, 0.16, 0.95);
  }

  fragColor = vec4(color.rgb, color.a * layer.opacity);
  geometry.uv = uv;
  DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;

export default class FloodLayer extends BitmapLayer {
  getShaders() {
    const shaders = super.getShaders();
    return { ...shaders, fs, modules: [...shaders.modules, floodUniforms] };
  }

  draw(opts) {
    const { model, coordinateConversion, bounds, disablePicking } = this.state;
    const { image, spillImage, waterline, baseline, connectivity, showLine,
            showDepth, gridWidth, gridHeight } = this.props;
    if (opts.shaderModuleProps.picking.isActive && disablePicking) return;
    if (!image || !spillImage || !model) return;

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
        waterline,
        baseline,
        connectivity: connectivity ? 1 : 0,
        showLine: showLine ? 1 : 0,
        showDepth: showDepth ? 1 : 0,
        lineWidth: 1.5,   // screen pixels, not texels

        texel: [1 / gridWidth, 1 / gridHeight]
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
  waterline: { type: 'number', value: 0 },
  baseline: { type: 'number', value: 0 },
  connectivity: { type: 'boolean', value: true },
  showLine: { type: 'boolean', value: true },
  showDepth: { type: 'boolean', value: true },
  gridWidth: { type: 'number', value: 1 },
  gridHeight: { type: 'number', value: 1 }
};
