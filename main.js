import "@fontsource-variable/space-grotesk";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";

// the canvas fills the whole window behind the UI; the cylinder is centered
// in the .stage element (the area not covered by panels)
const stage = document.querySelector(".stage");

function viewportSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

const initialSize = viewportSize();

// theme colors live in CSS custom properties (app.css); read them from there
// so the scene and the UI always match
const themes = ["ice", "nebula", "solar"];

function readThemeColors() {
  const style = getComputedStyle(document.documentElement);
  const color = (name) => new THREE.Color(style.getPropertyValue(name).trim());
  return {
    accent: color("--accent"),
    accentStrong: color("--accent-strong"),
    star: color("--star"),
    flaw: color("--flaw"),
    bg: style.getPropertyValue("--bg").trim(),
  };
}

let themeColors = readThemeColors();

const scene = new THREE.Scene();
const fov = 50;
const camera = new THREE.PerspectiveCamera(
  fov,
  initialSize.width / initialSize.height,
  0.1,
  1000,
);

// transparent so the CSS nebula background shows behind the stars
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(initialSize.width, initialSize.height);
renderer.setClearColor(0x000000, 0);
renderer.localClippingEnabled = true; // the flaw scan clips the flaws
renderer.setAnimationLoop(animate);
document.body.prepend(renderer.domElement);

// stars
const starsGeometry = new THREE.BufferGeometry();
const starCount = 2000;
const starPositions = new Float32Array(starCount * 3);

// randomize star positions
for (let i = 0; i < starCount * 3; i++) {
  starPositions[i] = (Math.random() - 0.5) * 1000;
}

starsGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(starPositions, 3),
);

// referenced via import.meta.url so Vite bundles it
const starTexture = new THREE.TextureLoader().load(
  new URL("./star.png", import.meta.url).href,
);

const starsMaterial = new THREE.PointsMaterial({
  color: themeColors.star,
  size: 1.2,
  sizeAttenuation: true,
  opacity: 0.7,
  map: starTexture,
  transparent: true,
  depthWrite: false,
});

// points object to represent all stars
const stars = new THREE.Points(starsGeometry, starsMaterial);
scene.add(stars);

// set orbital camera (rotate: drag / one finger, zoom: wheel / pinch)
const controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance = 4;
controls.maxDistance = 120;

// initial viewing direction; the distance is set by fitCamera()
camera.position.set(5, Math.PI, Math.PI * 2);
controls.update();

// sliders give diameters in inches and length in feet; the scene works in feet
const bottomDiameterSlider = document.getElementById("bottomDiameterSlider");
const topDiameterSlider = document.getElementById("topDiameterSlider");
const lengthSlider = document.getElementById("lengthSlider");

function diameterToRadius(inches) {
  return inches / 2 / 12;
}

// create cylinder geometry to represent segment, starting from the slider defaults
let radiusTop = diameterToRadius(parseFloat(topDiameterSlider.value));
let radiusBottom = diameterToRadius(parseFloat(bottomDiameterSlider.value));
let height = parseFloat(lengthSlider.value);
const radialSegments = 64; // smooth round surface and ends
const cageLines = 20; // lengthwise lines in the dashed cage

// all cylinder parts live in one group so they rotate together
const cylinderGroup = new THREE.Group();
cylinderGroup.rotation.z = Math.PI / 2;
scene.add(cylinderGroup);

// Post-processing
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const outlinePass = new OutlinePass(
  new THREE.Vector2(initialSize.width, initialSize.height),
  scene,
  camera,
);
outlinePass.edgeStrength = 4;
outlinePass.edgeGlow = 0.6;
outlinePass.edgeThickness = 2;
composer.addPass(outlinePass);

function applyOutlineColors() {
  outlinePass.visibleEdgeColor.copy(themeColors.accentStrong);
  outlinePass.hiddenEdgeColor.copy(themeColors.accent);
}

applyOutlineColors();

// --- layout ---

// half-extents (feet) the camera keeps in view: the longest segment
// horizontally, and some room vertically for the perspective of the ends
const fitHalfWidth = (parseFloat(lengthSlider.max) / 2) * 1.1;
const fitHalfHeight = 4;
// share of the stage the fitted segment may fill
const fitFraction = 0.9;
// the user's zoom, kept relative to the fitted distance across resizes
let zoomFactor = 1;
let fittedDistance = 0;

function fitCamera(size, stageRect) {
  // world units per pixel at distance d is 2 d tan(fov/2) / canvas height,
  // so the distance that fits a half-extent R into stage pixels s is
  // R * height / (fraction * s * tan(fov/2))
  const t = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const fitFor = (halfExtent, stagePixels) =>
    (halfExtent * size.height) / (fitFraction * Math.max(stagePixels, 1) * t);
  const distance = Math.max(
    fitFor(fitHalfWidth, stageRect.width),
    fitFor(fitHalfHeight, stageRect.height),
  );

  if (fittedDistance > 0) {
    zoomFactor = camera.position.distanceTo(controls.target) / fittedDistance;
  }
  fittedDistance = distance;

  const offset = camera.position.clone().sub(controls.target);
  offset.setLength(
    THREE.MathUtils.clamp(
      distance * zoomFactor,
      controls.minDistance,
      controls.maxDistance,
    ),
  );
  camera.position.copy(controls.target).add(offset);
}

function layout() {
  const size = viewportSize();
  const stageRect = stage.getBoundingClientRect();

  renderer.setSize(size.width, size.height);
  composer.setSize(size.width, size.height);

  // shift the projection so the scene origin lands at the stage's center
  // instead of the window's center
  camera.aspect = size.width / size.height;
  camera.setViewOffset(
    size.width,
    size.height,
    size.width / 2 - (stageRect.left + stageRect.width / 2),
    size.height / 2 - (stageRect.top + stageRect.height / 2),
    size.width,
    size.height,
  );
  camera.updateProjectionMatrix();

  fitCamera(size, stageRect);
  controls.update();
}

// the stage can change size without the window resizing (panel content,
// orientation, mobile browser bars), so watch both
window.addEventListener("resize", layout);
new ResizeObserver(layout).observe(stage);

// --- flaws ---

// each end has a random profile of 8 points, one per 45° radar spoke, that
// tapers inward to an apex on the axis: a pyramid inside the cylinder.
// stored as fractions of the end radius and of the allowed depth, so the
// sliders rescale the flaws instead of re-rolling them
const flawSpokes = 8;
const maxFlawDepth = 4; // feet
const radarRadius = 80; // outer ring of the radar charts, in SVG units
const radarRings = 4;
const flawFaceOffset = 0.01; // feet

function randomFlaw() {
  return {
    // squared to pull points toward the center, capped at half the radius
    profile: Array.from(
      { length: flawSpokes },
      () => 0.1 + 0.4 * Math.random() ** 2,
    ),
    // Math.random() < 1, so the depth stays below the allowed maximum
    depth: 0.2 + 0.8 * Math.random(),
  };
}

const bottomFlaw = randomFlaw();
const topFlaw = randomFlaw();

function spokeAngle(i) {
  return (i / flawSpokes) * Math.PI * 2;
}

const svgNamespace = "http://www.w3.org/2000/svg";

function svgElement(name, attributes) {
  const element = document.createElementNS(svgNamespace, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  return element;
}

// rings and one spoke per flaw point; returns the (empty) profile polygon
function createRadarChart(svg) {
  const extent = radarRadius * 1.25;
  svg.setAttribute(
    "viewBox",
    `${-extent} ${-extent} ${extent * 2} ${extent * 2}`,
  );
  for (let i = 1; i <= radarRings; i++) {
    svg.append(
      svgElement("circle", {
        r: (radarRadius * i) / radarRings,
        class: "ring",
      }),
    );
  }
  for (let i = 0; i < flawSpokes; i++) {
    const angle = spokeAngle(i);
    svg.append(
      svgElement("line", {
        x1: 0,
        y1: 0,
        x2: (radarRadius * Math.cos(angle)).toFixed(1),
        y2: (radarRadius * Math.sin(angle)).toFixed(1),
        class: "axis",
      }),
    );
  }
  const polygon = svgElement("polygon", { class: "data-polygon" });
  svg.append(polygon);
  return polygon;
}

function drawRadarChart(polygon, flaw) {
  const points = flaw.profile.map((fraction, i) => {
    const r = radarRadius * fraction;
    const angle = spokeAngle(i);
    return `${(r * Math.cos(angle)).toFixed(1)},${(r * Math.sin(angle)).toFixed(1)}`;
  });
  polygon.setAttribute("points", points.join(" "));
}

const bottomProfile = createRadarChart(document.getElementById("bottomRadar"));
const topProfile = createRadarChart(document.getElementById("topRadar"));
drawRadarChart(bottomProfile, bottomFlaw);
drawRadarChart(topProfile, topFlaw);

// no automatic spinning or scan sweep for users who ask for reduced motion
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// flaws start hidden; "Detect flaws" sweeps a scanner ring from the bottom
// end to the top, revealing the flaws behind it (and back again to hide).
// scanProgress runs 0..1 in time toward scanTarget; the ring's position
// along the length is that eased, so the sweep starts and stops gently
let scanProgress = 0;
let scanTarget = 0;
let scannerFade = 0; // 0..1 ring opacity, eased so it never pops in or out
const scanDuration = 2.4; // seconds for a full sweep
const scannerFadeDuration = 0.35; // seconds
const scanMargin = 0.05; // feet past each end, so 0 / 1 clip everything / nothing
const scanClock = new THREE.Clock();

// keeps the part of the flaws below the scan line; updated every frame in
// world space, since clipping planes ignore the group's rotation
const flawClipLocal = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
const flawClipPlane = new THREE.Plane();
let flawParts = [];
let scannerParts = [];

function scanPosition() {
  return THREE.MathUtils.smootherstep(scanProgress, 0, 1);
}

function scanY() {
  return THREE.MathUtils.lerp(
    -height / 2 - scanMargin,
    height / 2 + scanMargin,
    scanPosition(),
  );
}

function updateScan(delta) {
  const scanning = scanProgress !== scanTarget;
  if (reducedMotion.matches) {
    scanProgress = scanTarget;
    scannerFade = 0;
  } else {
    const step = delta / scanDuration;
    scanProgress += THREE.MathUtils.clamp(
      scanTarget - scanProgress,
      -step,
      step,
    );
    const fadeStep = delta / scannerFadeDuration;
    scannerFade += THREE.MathUtils.clamp(
      (scanning ? 1 : 0) - scannerFade,
      -fadeStep,
      fadeStep,
    );
  }

  const y = scanY();
  flawClipLocal.constant = y;
  cylinderGroup.updateMatrixWorld();
  flawClipPlane.copy(flawClipLocal).applyMatrix4(cylinderGroup.matrixWorld);
  for (const part of flawParts) part.visible = scanProgress > 0;

  // the ring follows the taper, just outside the dashed edges, and also
  // fades toward the ends so it doesn't appear on or vanish off a cap
  const t = THREE.MathUtils.clamp((y + height / 2) / height, 0, 1);
  const radius = THREE.MathUtils.lerp(radiusBottom, radiusTop, t) * 1.25;
  const edgeFade = Math.min(1, 3 * Math.sin(Math.PI * scanPosition()));
  const opacity = scannerFade * edgeFade;
  for (const part of scannerParts) {
    part.visible = opacity > 0;
    part.material.opacity = part.userData.opacity * opacity;
    part.position.y = y;
    part.scale.set(radius, 1, radius);
  }

  // each radar profile appears once the scan has passed its flaw's base
  bottomProfile.classList.toggle("revealed", scanPosition() > 0.02);
  topProfile.classList.toggle("revealed", scanPosition() > 0.98);
}

function addScanner() {
  // glowing ring plus a faint disc; unit radius, scaled in updateScan()
  const ringGeometry = new THREE.RingGeometry(0.92, 1, radialSegments);
  ringGeometry.rotateX(Math.PI / 2);
  const discGeometry = new THREE.CircleGeometry(0.92, radialSegments);
  discGeometry.rotateX(Math.PI / 2);

  const glow = (opacity) =>
    new THREE.MeshBasicMaterial({
      color: themeColors.flaw,
      side: THREE.DoubleSide,
      opacity,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

  scannerParts = [
    new THREE.Mesh(ringGeometry, glow(0.95)),
    new THREE.Mesh(discGeometry, glow(0.18)),
  ];
  for (const part of scannerParts) {
    part.userData.opacity = part.material.opacity; // full-strength opacity
    cylinderGroup.add(part);
  }
}

// pyramid with its base on the end face at faceY and its apex on the axis,
// direction (+1 / -1) pointing into the cylinder
function createFlawGeometry(flaw, radius, faceY, direction) {
  // at most half the length, so the two pyramids never overlap
  const depth = flaw.depth * Math.min(maxFlawDepth, height / 2);
  const apex = new THREE.Vector3(0, faceY + direction * depth, 0);
  // the base sits just proud of the end cap; coplanar faces z-fight
  const baseY = faceY - direction * flawFaceOffset;
  const center = new THREE.Vector3(0, baseY, 0);
  const base = flaw.profile.map((fraction, i) => {
    const angle = spokeAngle(i);
    return new THREE.Vector3(
      radius * fraction * Math.cos(angle),
      baseY,
      radius * fraction * Math.sin(angle),
    );
  });

  const vertices = [];
  base.forEach((point, i) => {
    const next = base[(i + 1) % base.length];
    vertices.push(apex, point, next); // side
    vertices.push(center, next, point); // base
  });
  return new THREE.BufferGeometry().setFromPoints(vertices);
}

function addFlaw(flaw, radius, faceY, direction) {
  const geometry = createFlawGeometry(flaw, radius, faceY, direction);

  const material = new THREE.MeshBasicMaterial({
    color: themeColors.flaw.clone().multiplyScalar(0.55),
    side: THREE.DoubleSide,
    opacity: 0.75,
    transparent: true,
    clippingPlanes: [flawClipPlane],
  });
  const mesh = new THREE.Mesh(geometry, material);
  // drawn before the translucent cylinder so it shows through it rather
  // than being depth-tested away behind the cylinder's surface
  mesh.renderOrder = -1;

  // edges make the pyramid's faces readable on the flat-shaded mesh
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: themeColors.flaw,
    clippingPlanes: [flawClipPlane],
  });
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    edgeMaterial,
  );

  for (const part of [mesh, edges]) {
    part.visible = scanProgress > 0;
    cylinderGroup.add(part);
    flawParts.push(part);
  }
}

// lengthwise lines of the cage, at the same angles as CylinderGeometry's
// vertices so they meet the rims (one per radial segment would be a dense
// wall of dashes)
function createCageLinesGeometry() {
  const points = [];
  for (let i = 0; i < cageLines; i++) {
    const angle = (i / cageLines) * Math.PI * 2;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    points.push(
      new THREE.Vector3(radiusBottom * sin, -height / 2, radiusBottom * cos),
      new THREE.Vector3(radiusTop * sin, height / 2, radiusTop * cos),
    );
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

function createCylinder() {
  // free GPU resources of the previous parts before rebuilding
  for (const part of cylinderGroup.children) {
    part.geometry.dispose();
    part.material.dispose();
  }
  cylinderGroup.clear();

  const cylinderGeometry = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radialSegments,
  );

  const cylinderMaterial = new THREE.MeshBasicMaterial({
    color: themeColors.accent,
    opacity: 0.45,
    transparent: true,
  });

  const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
  cylinderGroup.add(cylinder);

  // cage around the cylinder: dashed lengthwise lines, solid rims
  const cageMaterial = {
    color: themeColors.accentStrong,
    transparent: true,
    opacity: 0.5,
  };

  const edgeCylinder = new THREE.LineSegments(
    createCageLinesGeometry(),
    new THREE.LineDashedMaterial({
      ...cageMaterial,
      dashSize: 0.25,
      gapSize: 0.25,
    }),
  );
  edgeCylinder.computeLineDistances(); // required for dashes to render

  // a 30° threshold keeps only the rims (sides meet the caps at 90°,
  // neighboring side faces at 360° / radialSegments)
  const cageRims = new THREE.LineSegments(
    new THREE.EdgesGeometry(cylinderGeometry, 30),
    new THREE.LineBasicMaterial(cageMaterial),
  );

  for (const part of [edgeCylinder, cageRims]) {
    part.scale.set(1.2, 1, 1.2);
    cylinderGroup.add(part);
  }

  // add top end
  const topCircleGeometry = new THREE.CircleGeometry(radiusTop, radialSegments);
  topCircleGeometry.rotateX(Math.PI / 2);
  topCircleGeometry.translate(0, height / 2, 0);

  const topCircleMaterial = new THREE.MeshBasicMaterial({
    color: themeColors.accent,
    side: THREE.DoubleSide,
    opacity: 0.8,
    transparent: true,
  });

  const topCircle = new THREE.Mesh(topCircleGeometry, topCircleMaterial);
  cylinderGroup.add(topCircle);

  // add bottom end
  const bottomCircleGeometry = new THREE.CircleGeometry(
    radiusBottom,
    radialSegments,
  );
  bottomCircleGeometry.rotateX(Math.PI / 2);
  bottomCircleGeometry.translate(0, -height / 2, 0);

  const bottomCircleMaterial = new THREE.MeshBasicMaterial({
    color: themeColors.accent,
    side: THREE.DoubleSide,
    opacity: 0.8,
    transparent: true,
  });

  const bottomCircle = new THREE.Mesh(
    bottomCircleGeometry,
    bottomCircleMaterial,
  );
  cylinderGroup.add(bottomCircle);

  flawParts = [];
  addFlaw(bottomFlaw, radiusBottom, -height / 2, 1);
  addFlaw(topFlaw, radiusTop, height / 2, -1);
  addScanner();
  updateScan(0);

  outlinePass.selectedObjects = [cylinder];
}

createCylinder();
layout();

function animate() {
  if (!reducedMotion.matches) {
    cylinderGroup.rotation.x += 0.005;
  }
  updateScan(scanClock.getDelta());
  controls.update();
  composer.render();
}

// --- theme picker ---

const themeButtons = document.querySelectorAll("[data-theme-option]");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

function applyTheme(name) {
  if (!themes.includes(name)) name = themes[0];
  document.documentElement.dataset.theme = name;
  for (const button of themeButtons) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.themeOption === name),
    );
  }

  themeColors = readThemeColors();
  themeColorMeta.content = themeColors.bg;
  starsMaterial.color.copy(themeColors.star);
  applyOutlineColors();
  createCylinder();
}

for (const button of themeButtons) {
  button.addEventListener("click", () => {
    const name = button.dataset.themeOption;
    applyTheme(name);
    try {
      localStorage.setItem("theme", name);
    } catch {
      // storage unavailable: the theme still applies for this visit
    }
  });
}

// index.html already set data-theme from storage before first paint;
// this validates it and syncs the buttons and scene
applyTheme(document.documentElement.dataset.theme);

// --- flaw detection toggle ---

const detectFlawsButton = document.getElementById("detectFlawsButton");

detectFlawsButton.addEventListener("click", () => {
  scanTarget = scanTarget === 1 ? 0 : 1;
  detectFlawsButton.setAttribute("aria-pressed", String(scanTarget === 1));
});

// --- sliders ---

// slider labels
const bottomLabel = document.getElementById("bottomValue");
const topLabel = document.getElementById("topValue");
const lengthLabel = document.getElementById("lengthValue");

updateLabels();

// keep the top no wider than the bottom: dragging one diameter past the
// other pushes the other along with it
function updateDiameters(changedSlider) {
  const bottom = parseFloat(bottomDiameterSlider.value);
  const top = parseFloat(topDiameterSlider.value);
  if (top > bottom) {
    if (changedSlider === bottomDiameterSlider) {
      topDiameterSlider.value = bottom;
    } else {
      bottomDiameterSlider.value = top;
    }
  }

  radiusBottom = diameterToRadius(parseFloat(bottomDiameterSlider.value));
  radiusTop = diameterToRadius(parseFloat(topDiameterSlider.value));
  updateLabels();
  createCylinder();
}

// event listeners to change the diameters of the ends
bottomDiameterSlider.addEventListener("input", () =>
  updateDiameters(bottomDiameterSlider),
);
topDiameterSlider.addEventListener("input", () =>
  updateDiameters(topDiameterSlider),
);

// an event listener to change the length
lengthSlider.addEventListener("input", (event) => {
  height = parseFloat(event.target.value);
  updateLabels();
  createCylinder();
});

// filled part of a slider's track (WebKit has no ::range-progress)
function updateSliderFill(slider) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const fill = ((parseFloat(slider.value) - min) / (max - min)) * 100;
  slider.style.setProperty("--fill", `${fill}%`);
}

function updateLabels() {
  bottomLabel.textContent = bottomDiameterSlider.value;
  topLabel.textContent = topDiameterSlider.value;
  lengthLabel.textContent = height;
  for (const slider of [
    bottomDiameterSlider,
    topDiameterSlider,
    lengthSlider,
  ]) {
    updateSliderFill(slider);
  }
}
