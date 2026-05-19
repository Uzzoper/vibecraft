import * as THREE from "three";

const CYCLE_DURATION = 240;
const SUN_START_ANGLE = Math.PI * 0.2;
const SUN_ANGLE_SPEED = (Math.PI * 2) / CYCLE_DURATION;

export interface DayNightLights {
  ambientLight: THREE.AmbientLight;
  directionalLight: THREE.DirectionalLight;
  moonLight: THREE.DirectionalLight;
  hemisphereLight: THREE.HemisphereLight;
}

export interface DayNightState {
  update(deltaTime: number): void;
  getSunAngle(): number;
  isNight(): boolean;
  getMinutesLeft(): number;
}

export function createDayNightState(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  skyColors: {
    day: THREE.Color;
    night: THREE.Color;
  },
  lights: DayNightLights,
): DayNightState {
  let cycleTime = 0;

  function getSunAngle(): number {
    return SUN_START_ANGLE + cycleTime * SUN_ANGLE_SPEED;
  }

  function update(deltaTime: number): void {
    cycleTime += deltaTime;
    if (cycleTime >= CYCLE_DURATION) {
      cycleTime -= CYCLE_DURATION;
    }

    const sunAngle = getSunAngle();

    const sunX = Math.cos(sunAngle) * 100;
    const sunY = Math.max(Math.sin(sunAngle) * 100, 5);
    const sunZ = Math.sin(sunAngle * 0.3) * 50;
    lights.directionalLight.position.set(sunX, sunY, sunZ);

    lights.moonLight.position.set(-sunX * 0.5, Math.max(-sunY * 0.3 + 80, 40), -sunZ * 0.5);

    const sunHeight = Math.sin(sunAngle);
    const isDay = sunHeight > 0;

    const ambientIntensity = isDay ? THREE.MathUtils.mapLinear(sunHeight, 0, 1, 0.2, 0.8) : 0.08;
    lights.ambientLight.intensity = THREE.MathUtils.lerp(
      lights.ambientLight.intensity,
      ambientIntensity,
      0.05,
    );
    lights.directionalLight.intensity = isDay
      ? THREE.MathUtils.mapLinear(sunHeight, 0, 1, 0.05, 1.0)
      : 0.0;
    lights.moonLight.intensity = isDay
      ? 0.0
      : THREE.MathUtils.mapLinear(Math.max(-sunHeight, 0), 0, 1, 0.0, 0.25);
    lights.hemisphereLight.intensity = isDay
      ? THREE.MathUtils.mapLinear(sunHeight, 0, 1, 0.05, 0.4)
      : 0.03;

    const skyLerp = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(sunHeight * 4, -1, 1), -1, 1);
    (scene.background as THREE.Color).lerpColors(
      skyColors.day,
      skyColors.night,
      THREE.MathUtils.clamp(1 - skyLerp, 0, 1),
    );
    (scene.fog as THREE.Fog).color.lerpColors(
      skyColors.day,
      skyColors.night,
      THREE.MathUtils.clamp(1 - skyLerp, 0, 1),
    );

    renderer.toneMappingExposure = isDay
      ? THREE.MathUtils.mapLinear(sunHeight, 0, 1, 0.6, 1.2)
      : 0.3;
  }

  function isNight(): boolean {
    return Math.sin(getSunAngle()) < 0;
  }

  function getMinutesLeft(): number {
    const sunAngle = getSunAngle();
    const currentQuadrant = Math.floor(sunAngle / Math.PI);
    const nextCrossing = (currentQuadrant + 1) * Math.PI;
    const secondsLeft = (nextCrossing - sunAngle) / SUN_ANGLE_SPEED;
    return secondsLeft / 60;
  }

  return {
    update,
    getSunAngle,
    isNight,
    getMinutesLeft,
  };
}
