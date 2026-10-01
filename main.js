import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";

// the canvas fills half the window in each dimension
function viewportSize() {
  return { width: window.innerWidth * 0.5, height: window.innerHeight * 0.5 };
}

const initialSize = viewportSize();

const scene = new THREE.Scene();
const fov = 50;
const camera = new THREE.PerspectiveCamera(
  fov,
  initialSize.width / initialSize.height,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(initialSize.width, initialSize.height);
renderer.setClearColor(0x0f172a, 0.5);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// stars
const starsGeometry = new THREE.BufferGeometry();
const starCount = 1000;
const starPositions = new Float32Array(starCount * 3);

// randomize star positions
for (let i = 0; i < starCount * 3; i++) {
  starPositions[i] = (Math.random() - 0.5) * 1000;
}

starsGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(starPositions, 3)
);

// referenced via import.meta.url so Vite bundles it
const starTexture = new THREE.TextureLoader().load(
  new URL("./star.png", import.meta.url).href
);

const starsMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 1,
  sizeAttenuation: true,
  opacity: 0.5,
  map: starTexture,
  transparent: true,
});

// points object to represent all stars
const stars = new THREE.Points(starsGeometry, starsMaterial);
scene.add(stars);

// set orbital camera
const controls = new OrbitControls(camera, renderer.domElement);

// pull the camera back so the origin is framed as it was with the old 100° FOV
const framingScale =
  Math.tan(THREE.MathUtils.degToRad(100 / 2)) /
  Math.tan(THREE.MathUtils.degToRad(fov / 2));
camera.position.set(5, Math.PI, Math.PI * 2).multiplyScalar(framingScale);
controls.update();

// create cylinder geometry to represent segment
var radiusTop = 0.7;
var radiusBottom = 0.8;
var height = 8;
var radialSegments = 20;

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
  camera
);
outlinePass.visibleEdgeColor.set("#69b4cc");
outlinePass.hiddenEdgeColor.set("#69b4cc");
composer.addPass(outlinePass);

window.addEventListener("resize", () => {
  const size = viewportSize();
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
  renderer.setSize(size.width, size.height);
  composer.setSize(size.width, size.height);
});

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
    radialSegments
  );

  const cylinderMaterial = new THREE.MeshBasicMaterial({
    color: 0x69b4cc,
    opacity: 0.5,
    transparent: true,
  });

  const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
  cylinderGroup.add(cylinder);

  // create edges of cylinder
  const edges = new THREE.EdgesGeometry(cylinderGeometry);

  // create dashed line material
  const dashedMaterial = new THREE.LineDashedMaterial({
    color: 0x69b4cc,
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
    color: 0x69b4cc,
    side: THREE.DoubleSide,
    opacity: 0.8,
    transparent: true,
  });

  const topCircle = new THREE.Mesh(topCircleGeometry, topCircleMaterial);
  cylinderGroup.add(topCircle);

  // add bottom end
  const bottomCircleGeometry = new THREE.CircleGeometry(
    radiusBottom,
    radialSegments
  );
  bottomCircleGeometry.rotateX(Math.PI / 2);
  bottomCircleGeometry.translate(0, -height / 2, 0);

  const bottomCircleMaterial = new THREE.MeshBasicMaterial({
    color: 0x69b4cc,
    side: THREE.DoubleSide,
    opacity: 0.8,
    transparent: true,
  });

  const bottomCircle = new THREE.Mesh(bottomCircleGeometry, bottomCircleMaterial);
  cylinderGroup.add(bottomCircle);

  outlinePass.selectedObjects = [cylinder];
}

createCylinder();

function animate() {
  cylinderGroup.rotation.x += 0.005;
  controls.update();
  composer.render();
}

// sliders
const radiusBottomSlider = document.getElementById("radiusBottomSlider");
const radiusTopSlider = document.getElementById("radiusTopSlider");
const lengthSlider = document.getElementById("lengthSlider");

const bottomLabel = document.getElementById("bottomValue");
const topLabel = document.getElementById("topValue");
const lengthLabel = document.getElementById("lengthValue");

updateLabels();

// an event listener to change the radius of the bottom end
radiusBottomSlider.addEventListener("input", (event) => {
  radiusBottom = parseFloat(event.target.value);
  updateLabels();
  createCylinder();
});

// an event listener to change the radius of the top end
radiusTopSlider.addEventListener("input", (event) => {
  radiusTop = parseFloat(event.target.value);
  updateLabels();
  createCylinder();
});

// an event listener to change the length
lengthSlider.addEventListener("input", (event) => {
  height = parseFloat(event.target.value);
  updateLabels();
  createCylinder();
});

function updateLabels() {
  bottomLabel.textContent = Math.round(radiusBottom * 12 * 2);
  topLabel.textContent = Math.round(radiusTop * 12 * 2);
  lengthLabel.textContent = height;
}
