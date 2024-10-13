import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  100,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth * 0.5, window.innerHeight * 0.5);
renderer.setClearColor(0x244d69, 1);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// set orbital camera
const controls = new OrbitControls(camera, renderer.domElement);

camera.position.set(0, Math.PI, Math.PI * 2);
controls.update();

// create cylinder geometry to represent segment
var radiusTop = 0.7;
var radiusBottom = 0.8;
var height = 8;
var radialSegments = 12;

let cylinder;

function createCylinder() {
  let currentRotation = { x: 0, y: 0, z: 0 };

  if (cylinder) {
    currentRotation.x = cylinder.rotation.x;
    currentRotation.y = cylinder.rotation.y;
    currentRotation.z = cylinder.rotation.z;

    scene.remove(cylinder);
  }

  const geometry = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radialSegments
  );

  // create edges of cylinder
  const edges = new THREE.EdgesGeometry(geometry);

  // create dashed line material
  const dashedMaterial = new THREE.LineDashedMaterial({
    color: 0x69b4cc,
    linewidth: 1,
    dashSize: 0.25,
    gapSize: 0.25,
  });

  // create cylinder with dashed material and edges
  cylinder = new THREE.LineSegments(edges, dashedMaterial);

  cylinder.computeLineDistances();

  cylinder.rotation.x = currentRotation.x;
  cylinder.rotation.y = currentRotation.y;
  cylinder.rotation.z = currentRotation.z;

  scene.add(cylinder);

  cylinder.rotation.z = Math.PI / 2;
}

createCylinder();

function animate() {
  if (cylinder) {
    cylinder.rotation.x += 0.005;
    camera.rotation.z += 0.005;
  }

  renderer.render(scene, camera);
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
