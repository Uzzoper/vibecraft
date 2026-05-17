import * as THREE from "three";

export interface GameEngine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  clock: THREE.Clock;
  skyColors: {
    day: THREE.Color;
    night: THREE.Color;
  };
  lights: {
    ambientLight: THREE.AmbientLight;
    directionalLight: THREE.DirectionalLight;
    moonLight: THREE.DirectionalLight;
    hemisphereLight: THREE.HemisphereLight;
  };
}

function getRendererPixelRatio(): number {
  const isTouchDevice = "ontouchstart" in globalThis || navigator.maxTouchPoints > 0;
  const maxPixelRatio = isTouchDevice ? 1.5 : 2;
  return Math.min(window.devicePixelRatio, maxPixelRatio);
}

export function createEngine(container: HTMLElement = document.body): GameEngine {
  const scene = new THREE.Scene();
  const skyColors = {
    day: new THREE.Color(0x87ceeb),
    night: new THREE.Color(0x0a0a2e),
  };
  scene.background = skyColors.day;
  scene.fog = new THREE.Fog(skyColors.day, 20, 80);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(getRendererPixelRatio());
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 100, 50);
  scene.add(directionalLight);

  const moonLight = new THREE.DirectionalLight(0x4466aa, 0.15);
  moonLight.position.set(-50, 80, -50);
  scene.add(moonLight);

  const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x333333, 0.3);
  scene.add(hemisphereLight);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(getRendererPixelRatio());
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    scene,
    camera,
    renderer,
    clock: new THREE.Clock(),
    skyColors,
    lights: {
      ambientLight,
      directionalLight,
      moonLight,
      hemisphereLight,
    },
  };
}
