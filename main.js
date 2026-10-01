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
    defect: color("--defect"),
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
const radialSegments = 20;

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

// --- defects ---

// each end has a random profile of 8 points, one per 45° radar spoke, that
// tapers inward to an apex on the axis: a pyramid inside the cylinder.
// stored as fractions of the end radius and of the allowed depth, so the
// sliders rescale the defects instead of re-rolling them
const defectSpokes = 8;
const maxDefectDepth = 4; // feet
const radarRadius = 80; // outer ring of the radar charts in index.html

function randomDefect() {
  return {
    // squared to pull points toward the center, capped at half the radius
    profile: Array.from(
      { length: defectSpokes },
      () => 0.1 + 0.4 * Math.random() ** 2,
    ),
    // Math.random() < 1, so the depth stays below the allowed maximum
    depth: 0.2 + 0.8 * Math.random(),
  };
}

const bottomDefect = randomDefect();
const topDefect = randomDefect();

function spokeAngle(i) {
  return (i / defectSpokes) * Math.PI * 2;
}

function drawRadarChart(polygon, defect) {
  const points = defect.profile.map((fraction, i) => {
    const r = radarRadius * fraction;
    const angle = spokeAngle(i);
    return `${(r * Math.cos(angle)).toFixed(1)},${(r * Math.sin(angle)).toFixed(1)}`;
  });
  polygon.setAttribute("points", points.join(" "));
}

drawRadarChart(document.getElementById("bottomProfile"), bottomDefect);
drawRadarChart(document.getElementById("topProfile"), topDefect);

// pyramid with its base on the end face at faceY and its apex on the axis,
// direction (+1 / -1) pointing into the cylinder
function createDefectGeometry(defect, radius, faceY, direction) {
  // at most half the length, so the two pyramids never overlap
  const depth = defect.depth * Math.min(maxDefectDepth, height / 2);
  const apex = new THREE.Vector3(0, faceY + direction * depth, 0);
  const center = new THREE.Vector3(0, faceY, 0);
  const base = defect.profile.map((fraction, i) => {
    const angle = spokeAngle(i);
    return new THREE.Vector3(
      radius * fraction * Math.cos(angle),
      faceY,
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

function addDefect(defect, radius, faceY, direction) {
  const geometry = createDefectGeometry(defect, radius, faceY, direction);

  // opaque, so it renders before the translucent cylinder and shows through it
  const material = new THREE.MeshBasicMaterial({
    color: themeColors.defect.clone().multiplyScalar(0.55),
    side: THREE.DoubleSide,
  });
  cylinderGroup.add(new THREE.Mesh(geometry, material));

  // edges make the pyramid's faces readable on the flat-shaded mesh
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: themeColors.defect,
  });
  cylinderGroup.add(
    new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial),
  );
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

  // create edges of cylinder
  const edges = new THREE.EdgesGeometry(cylinderGeometry);

  // create dashed line material
  const dashedMaterial = new THREE.LineDashedMaterial({
    color: themeColors.accentStrong,
    dashSize: 0.25,
    gapSize: 0.25,
    transparent: true,
    opacity: 0.5,
  });

  const edgeCylinder = new THREE.LineSegments(edges, dashedMaterial);
  edgeCylinder.computeLineDistances(); // required for dashes to render
  edgeCylinder.scale.set(1.2, 1, 1.2);
  cylinderGroup.add(edgeCylinder);

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

  addDefect(bottomDefect, radiusBottom, -height / 2, 1);
  addDefect(topDefect, radiusTop, height / 2, -1);

  outlinePass.selectedObjects = [cylinder];
}

createCylinder();
layout();

// no automatic spinning for users who ask for reduced motion
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function animate() {
  if (!reducedMotion.matches) {
    cylinderGroup.rotation.x += 0.005;
  }
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
