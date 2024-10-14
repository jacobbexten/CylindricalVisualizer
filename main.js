import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  100,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth * 0.5, window.innerHeight * 0.5);
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

const starTexture = new THREE.TextureLoader().load("star.png");

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

camera.position.set(0, Math.PI, Math.PI * 2);
camera.position.x += 5;
controls.update();

// create cylinder geometry to represent segment
var radiusTop = 0.7;
var radiusBottom = 0.8;
var height = 8;
var radialSegments = 20;

let cylinder;
let edgeCylinder;
let topCircle;
let bottomCircle;

// Add lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);

// Post-processing
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const outlinePass = new OutlinePass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  scene,
  camera
);
outlinePass.visibleEdgeColor.set("#69b4cc");
outlinePass.hiddenEdgeColor.set("#69b4cc");
composer.addPass(outlinePass);

function createCylinder() {
  let currentRotation = { x: 0, y: 0, z: 0 };

  if (cylinder) {
    currentRotation.x = cylinder.rotation.x;
    currentRotation.y = cylinder.rotation.y;
    currentRotation.z = cylinder.rotation.z;

    scene.remove(cylinder);
    scene.remove(edgeCylinder);
    scene.remove(topCircle);
    scene.remove(bottomCircle);
    outlinePass.selectedObjects = [];
  }

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

  cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
  scene.add(cylinder);

  cylinder.rotation.set(
    currentRotation.x,
    currentRotation.y,
    currentRotation.z
  );

  // create edges of cylinder
  const edges = new THREE.EdgesGeometry(cylinderGeometry);

  // create dashed line material
  const dashedMaterial = new THREE.LineDashedMaterial({
    color: 0x69b4cc,
    linewidth: 1,
    dashSize: 0.25,
    gapSize: 0.25,
    transparent: true,
    opacity: 0.5,
  });

  edgeCylinder = new THREE.LineSegments(edges, dashedMaterial);
  edgeCylinder.scale.set(1.2, 1, 1.2);

  scene.add(edgeCylinder);

  edgeCylinder.rotation.set(
    currentRotation.x,
    currentRotation.y,
    currentRotation.z
  );

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

  topCircle = new THREE.Mesh(topCircleGeometry, topCircleMaterial);
  scene.add(topCircle);

  topCircle.rotation.set(
    currentRotation.x,
    currentRotation.y,
    currentRotation.z
  );

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

  bottomCircle = new THREE.Mesh(bottomCircleGeometry, bottomCircleMaterial);
  scene.add(bottomCircle);

  bottomCircle.rotation.set(
    currentRotation.x,
    currentRotation.y,
    currentRotation.z
  );

  outlinePass.selectedObjects = [cylinder];
  cylinder.rotation.z = Math.PI / 2;
  edgeCylinder.rotation.z = Math.PI / 2;
  topCircle.rotation.z = Math.PI / 2;
  bottomCircle.rotation.z = Math.PI / 2;
}

createCylinder();

function animate() {
  if (cylinder) {
    cylinder.rotation.x += 0.005;
    // cylinder.rotation.z += 0.001;

    edgeCylinder.rotation.x += 0.005;
    // edgeCylinder.rotation.z += 0.001;

    topCircle.rotation.x += 0.005;
    // topCircle.rotation.z += 0.001;

    bottomCircle.rotation.x += 0.005;
    // bottomCircle.rotation.z += 0.001;
  }
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
  height = event.target.value;
  updateLabels();
  createCylinder();
});

function updateLabels() {
  bottomLabel.textContent = Math.round(radiusBottom * 12 * 2);
  topLabel.textContent = Math.round(radiusTop * 12 * 2);
  lengthLabel.textContent = height;
}
