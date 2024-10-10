import * as THREE from "./node_modules/three";
import { OrbitControls } from "./node_modules/three/addons/controls/OrbitControls.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  100,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// set orbital camera
const controls = new OrbitControls(camera, renderer.domElement);

camera.position.set(0, Math.PI, Math.PI * 2);
controls.update();

// create cylinder geometry to represent segment
var radiusTop = 0.75;
var radiusBottom = 1;
var height = 12;
var radialSegments = 12;

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
  color: 0x00ff00,
  linewidth: 1,
  dashSize: 0.25,
  gapSize: 0.25,
});

// create cylinder with dashed material and edges
const cylinder = new THREE.LineSegments(edges, dashedMaterial);

cylinder.computeLineDistances();

// scene.add(cylinder);
scene.add(cylinder);

cylinder.rotation.z = Math.PI / 2;

function animate() {
  cylinder.rotation.x += 0.01;

  renderer.render(scene, camera);
}
