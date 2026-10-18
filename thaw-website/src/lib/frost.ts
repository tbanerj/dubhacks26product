// The living background: a sheet of frost over a warm, slowly churning color field.
// `scene.melt` (0..1, driven by scroll) melts the frost outward from `scene.origin`
// with a dripping, uneven front. The cursor carries heat too: a small simulation
// stores it, lets it spread and sink downward, so the frost thaws wherever you
// move and drips before it freezes over again.

export const scene = {
  melt: 0, // 0 = frozen black, 1 = fully melted
  lit: 0, // 0 = dark page, 1 = light page (washes the color field paler for dark text)
  origin: { x: 0.5, y: 0.5 }, // melt center, in viewport fractions from top-left
  active: true, // skip drawing while the canvas is covered
}

const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const HEAT = `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uPower;
out vec4 o;
void main() {
  vec2 px = 1.0 / uRes;
  vec2 uv = gl_FragCoord.xy * px;
  float c = texture(uPrev, uv).r;
  float n = texture(uPrev, uv + vec2(0.0, px.y)).r;
  float s = texture(uPrev, uv - vec2(0.0, px.y)).r;
  float e = texture(uPrev, uv + vec2(px.x, 0.0)).r;
  float w = texture(uPrev, uv - vec2(px.x, 0.0)).r;
  float h = c * 0.52 + (n + s + e + w) * 0.12;
  // meltwater runs down: pull a little heat from the pixel above
  h = max(h, texture(uPrev, uv + vec2(0.0, px.y * 1.5)).r * 0.97);
  h *= 0.986;
  vec2 d = gl_FragCoord.xy - uMouse;
  float r = uRes.y * 0.06;
  h += uPower * exp(-dot(d, d) / (r * r));
  o = vec4(min(h, 1.4), 0.0, 0.0, 1.0);
}`

const VIEW = `#version 300 es
precision highp float;
uniform sampler2D uHeat;
uniform vec2 uRes;
uniform float uTime;
uniform float uMelt;
uniform float uLit;
uniform vec2 uOrigin;
out vec4 fragColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
const mat2 R2 = mat2(0.8, 0.6, -0.6, 0.8);
float fbm(vec2 p) {
  float f = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    f += a * noise(p);
    p = R2 * p * 2.03;
    a *= 0.5;
  }
  return f;
}
// distance to nearest and second-nearest cell point: their gap draws the crystal seams
vec2 voronoi(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float F1 = 8.0;
  float F2 = 8.0;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + hash2(n + g) - f;
      float d = dot(r, r);
      if (d < F1) { F2 = F1; F1 = d; } else if (d < F2) { F2 = d; }
    }
  return vec2(sqrt(F1), sqrt(F2));
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / uRes;
  float asp = uRes.x / uRes.y;
  vec2 q = fc / uRes.y;                       // square units, fixed to the screen
  vec2 p = (fc - uOrigin * uRes) / uRes.y;    // centered on the melt origin

  // ---- the frost ----
  vec2 v1 = voronoi(q * 6.0 + 1.3);
  vec2 v2 = voronoi(q * 19.0 + 7.1);
  float seam1 = 1.0 - smoothstep(0.0, 0.035, v1.y - v1.x);
  float seam2 = 1.0 - smoothstep(0.0, 0.05, v2.y - v2.x);
  float haze = fbm(q * 3.2 + vec2(0.0, uTime * 0.015));
  float fern = pow(1.0 - abs(fbm(q * 8.0 + 3.0) * 2.0 - 1.0), 9.0);
  vec2 cuv = (uv - 0.5) * vec2(asp, 1.0);
  float edge = smoothstep(0.25, 1.05, length(cuv) / (0.5 * length(vec2(asp, 1.0))));
  float density = clamp(haze * 0.7 + edge * 1.15 - 0.5, 0.0, 1.0);
  density *= density;
  vec3 ice = vec3(0.867, 0.925, 0.816);
  vec3 frost = ice * 0.07 * density;
  frost += ice * (seam1 * 0.16 + seam2 * 0.1) * density;
  frost += vec3(0.973, 0.973, 0.953) * fern * 0.42 * density;
  float g = hash(floor(q * 110.0));
  float twinkle = pow(max(0.0, sin(uTime * 1.3 + g * 60.0)), 24.0);
  frost += step(0.982, g) * twinkle * density * 1.1;
  frost += vec3(0.071, 0.227, 0.176) * exp(-dot(p, p) * 5.0);  // cold glow behind the phone

  // ---- the warm field under it ----
  vec2 w = q * 1.15;
  float t = uTime * 0.045;
  vec2 o1 = vec2(fbm(w + vec2(0.0, t)), fbm(w + vec2(5.2, 1.3) - t));
  float f = fbm(w + 2.2 * o1 + vec2(t * 0.6, -t));
  vec3 violet = vec3(0.094, 0.208, 0.176);
  vec3 magenta = vec3(0.141, 0.361, 0.275);
  vec3 coral = vec3(0.867, 0.925, 0.816);
  vec3 amber = vec3(0.957, 0.816, 0.435);
  vec3 peach = vec3(0.973, 0.973, 0.953);
  vec3 warm = mix(violet, magenta, smoothstep(0.22, 0.45, f));
  warm = mix(warm, coral, smoothstep(0.42, 0.6, f));
  warm = mix(warm, amber, smoothstep(0.56, 0.74, f));
  warm = mix(warm, peach, smoothstep(0.7, 0.9, f));
  vec3 paper = vec3(0.973, 0.973, 0.953);
  warm = mix(warm, paper, uLit * (0.4 + 0.3 * smoothstep(0.3, 1.0, uv.y)));

  // ---- the melt front ----
  float ease = uMelt * uMelt * (3.0 - 2.0 * uMelt);
  float R = mix(-0.15, length(vec2(asp, 1.0)) * 1.25, ease);
  float ang = atan(p.y, p.x);
  float d = length(p) + (fbm(vec2(ang * 1.6, uTime * 0.08) + p * 2.5) - 0.5) * 0.45;
  // drips: below the origin the front runs down in streaks
  d -= max(0.0, -p.y) * pow(noise(vec2(p.x * 16.0, 2.0)), 3.0) * 0.8 * ease;
  float mask = smoothstep(R + 0.03, R - 0.03, d);
  float heat = texture(uHeat, uv).r;
  mask = clamp(mask + smoothstep(0.12, 0.65, heat), 0.0, 1.0);
  float rim = smoothstep(0.02, 0.5, mask) * smoothstep(0.98, 0.5, mask);

  vec3 col = mix(frost, warm, mask);
  col += rim * vec3(0.973, 0.953, 0.82) * 0.55;
  col += (hash(fc + uTime) - 0.5) * 0.018;    // film grain, kills banding
  fragColor = vec4(col, 1.0);
}`

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader')
  return s
}
function program(gl: WebGL2RenderingContext, frag: string) {
  const p = gl.createProgram()!
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link')
  return p
}

// Returns a stop function, or null when WebGL2 isn't available (the CSS fallback shows instead).
export function startFrost(canvas: HTMLCanvasElement, reduced: boolean): (() => void) | null {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' })
  if (!gl) return null
  let view: WebGLProgram
  let heatProg: WebGLProgram | null = null
  try {
    view = program(gl, VIEW)
    // the heat buffer needs float render targets; without them the cursor just doesn't melt
    if (gl.getExtension('EXT_color_buffer_float')) heatProg = program(gl, HEAT)
  } catch (err) {
    console.warn('Thaw background disabled:', err)
    return null
  }
  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)

  const U = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n)
  const uv = {
    heat: U(view, 'uHeat'), res: U(view, 'uRes'), time: U(view, 'uTime'),
    melt: U(view, 'uMelt'), lit: U(view, 'uLit'), origin: U(view, 'uOrigin'),
  }
  const uh = heatProg && {
    prev: U(heatProg, 'uPrev'), res: U(heatProg, 'uRes'), mouse: U(heatProg, 'uMouse'), power: U(heatProg, 'uPower'),
  }

  // heat ping-pong at low resolution
  type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer }
  let heat: Target[] = []
  let hw = 1
  let hh = 1
  const makeTarget = (w: number, h: number): Target => {
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    return { tex, fbo }
  }
  // a 1x1 black texture stands in for heat when float targets are missing
  const blank = makeTarget(1, 1)

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * 0.8
    canvas.width = Math.max(1, Math.round(innerWidth * dpr))
    canvas.height = Math.max(1, Math.round(innerHeight * dpr))
    if (heatProg) {
      hw = Math.max(32, Math.round(innerWidth / 6))
      hh = Math.max(32, Math.round(innerHeight / 6))
      heat.forEach((t) => { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo) })
      heat = [makeTarget(hw, hh), makeTarget(hw, hh)]
    }
  }
  resize()
  addEventListener('resize', resize)

  // cursor: power follows how fast it moves, so resting the mouse doesn't burn a hole
  const mouse = { x: -999, y: -999, power: 0 }
  const onMove = (e: PointerEvent) => {
    const dx = e.clientX - mouse.x
    const dy = e.clientY - mouse.y
    const fresh = mouse.x < -900
    mouse.x = e.clientX
    mouse.y = e.clientY
    if (!fresh) mouse.power = Math.min(0.5, mouse.power + Math.hypot(dx, dy) * 0.004)
  }
  addEventListener('pointermove', onMove, { passive: true })

  const start = performance.now()
  let raf = 0
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    if (!scene.active) return
    const time = reduced ? 8 : (now - start) / 1000

    let heatTex = blank.tex
    if (heatProg && uh) {
      gl.useProgram(heatProg)
      gl.viewport(0, 0, hw, hh)
      gl.bindFramebuffer(gl.FRAMEBUFFER, heat[1].fbo)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, heat[0].tex)
      gl.uniform1i(uh.prev, 0)
      gl.uniform2f(uh.res, hw, hh)
      gl.uniform2f(uh.mouse, (mouse.x / innerWidth) * hw, (1 - mouse.y / innerHeight) * hh)
      gl.uniform1f(uh.power, reduced ? 0 : mouse.power)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      heat = [heat[1], heat[0]]
      heatTex = heat[0].tex
      mouse.power *= 0.85
    }

    gl.useProgram(view)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, heatTex)
    gl.uniform1i(uv.heat, 0)
    gl.uniform2f(uv.res, canvas.width, canvas.height)
    gl.uniform1f(uv.time, time)
    gl.uniform1f(uv.melt, scene.melt)
    gl.uniform1f(uv.lit, scene.lit)
    gl.uniform2f(uv.origin, scene.origin.x, 1 - scene.origin.y)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  raf = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(raf)
    removeEventListener('resize', resize)
    removeEventListener('pointermove', onMove)
  }
}
