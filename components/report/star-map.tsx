"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  InstancedMesh,
  LineLoop,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { GalaxyGameNode, GalaxyModel } from "@/lib/report/galaxy";
import {
  createGalaxyScene,
  getGalaxyFocusDistance,
  type GalaxySceneBody,
} from "@/lib/report/galaxy-scene";

import styles from "./story-player.module.css";

interface StarMapProps {
  galaxy: GalaxyModel;
}

interface ThemeColors {
  accent: Color;
  continent: string;
  gas: string;
  ice: string;
  ink: Color;
  inkCss: string;
  muted: Color;
  ocean: string;
  paper: Color;
  paperCss: string;
  rust: string;
  rule: Color;
}

const fullTurn = Math.PI * 2;
const canvasTextureWidth = 256;
const canvasTextureHeight = 128;
const textureVariantCount = 4;

function formatHours(minutes: number) {
  return (minutes / 60).toLocaleString("zh-CN", {
    maximumFractionDigits: 1,
  });
}

function stableHash(value: string) {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function createRandom(seed: string) {
  let value = stableHash(seed);

  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_295;
  };
}

function getTokenColor(canvas: HTMLCanvasElement, token: string) {
  const source = document.createElement("canvas");
  source.width = 1;
  source.height = 1;
  const context = source.getContext("2d");
  const value = window.getComputedStyle(canvas).getPropertyValue(token).trim();

  if (!context || !value) {
    return new Color(1, 1, 1);
  }

  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [red = 255, green = 255, blue = 255] = context.getImageData(
    0,
    0,
    1,
    1,
  ).data;

  return new Color(red / 255, green / 255, blue / 255);
}

function getTokenValue(canvas: HTMLCanvasElement, token: string) {
  return window.getComputedStyle(canvas).getPropertyValue(token).trim();
}

function getThemeColors(canvas: HTMLCanvasElement): ThemeColors {
  return {
    accent: getTokenColor(canvas, "--color-story-accent"),
    continent: getTokenValue(canvas, "--color-story-continent"),
    gas: getTokenValue(canvas, "--color-story-gas"),
    ice: getTokenValue(canvas, "--color-story-ice"),
    ink: getTokenColor(canvas, "--color-story-ink"),
    inkCss: getTokenValue(canvas, "--color-story-ink"),
    muted: getTokenColor(canvas, "--color-story-muted"),
    ocean: getTokenValue(canvas, "--color-story-ocean"),
    paper: getTokenColor(canvas, "--color-story-paper"),
    paperCss: getTokenValue(canvas, "--color-story-paper"),
    rust: getTokenValue(canvas, "--color-story-rust"),
    rule: getTokenColor(canvas, "--color-story-rule"),
  };
}

function createTextureCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = canvasTextureWidth;
  canvas.height = canvasTextureHeight;
  return canvas;
}

function createPlanetTexture(
  variant: "star" | number,
  colors: ThemeColors,
): CanvasTexture {
  const canvas = createTextureCanvas();
  const context = canvas.getContext("2d");

  if (!context) {
    return new CanvasTexture(canvas);
  }

  const random = createRandom(`galaxy-texture:${variant}`);
  const surfaceKind =
    variant === "star"
      ? "star"
      : (["ocean", "rust", "ice", "gas"][variant % textureVariantCount] ??
        "ocean");
  const base =
    surfaceKind === "rust"
      ? colors.rust
      : surfaceKind === "ice"
        ? colors.ice
        : surfaceKind === "gas"
          ? colors.gas
          : surfaceKind === "star"
            ? colors.accent.getStyle()
            : colors.ocean;
  const surface = context.createLinearGradient(
    0,
    0,
    canvasTextureWidth,
    canvasTextureHeight,
  );
  surface.addColorStop(0, colors.paperCss);
  surface.addColorStop(0.38, base);
  surface.addColorStop(1, colors.paperCss);
  context.fillStyle = surface;
  context.fillRect(0, 0, canvasTextureWidth, canvasTextureHeight);

  if (surfaceKind === "gas" || surfaceKind === "star") {
    for (let index = 0; index < 18; index += 1) {
      context.fillStyle = index % 2 === 0 ? colors.inkCss : colors.paperCss;
      context.globalAlpha = 0.06 + random() * 0.18;
      context.fillRect(
        0,
        random() * canvasTextureHeight,
        canvasTextureWidth,
        3 + random() * 12,
      );
    }
  } else {
    const landColor =
      surfaceKind === "ocean" ? colors.continent : colors.inkCss;

    for (let index = 0; index < 17; index += 1) {
      context.fillStyle = landColor;
      context.globalAlpha = 0.3 + random() * 0.38;
      context.beginPath();
      context.ellipse(
        random() * canvasTextureWidth,
        random() * canvasTextureHeight,
        6 + random() * 20,
        3 + random() * 9,
        (random() - 0.5) * Math.PI,
        0,
        fullTurn,
      );
      context.fill();
    }

    for (let index = 0; index < 13; index += 1) {
      context.fillStyle = colors.inkCss;
      context.globalAlpha = 0.08 + random() * 0.16;
      context.beginPath();
      context.ellipse(
        random() * canvasTextureWidth,
        random() * canvasTextureHeight,
        8 + random() * 27,
        2 + random() * 5,
        (random() - 0.5) * Math.PI,
        0,
        fullTurn,
      );
      context.fill();
    }
  }

  context.globalAlpha = 1;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function createStarField(colors: ThemeColors) {
  const count = 1_100;
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const random = createRandom(`deep-field:${index}`);
    const distance = 78 + random() * 190;
    const theta = random() * fullTurn;
    const phi = Math.acos(2 * random() - 1);
    const offset = index * 3;

    positions[offset] = distance * Math.sin(phi) * Math.cos(theta);
    positions[offset + 1] = distance * Math.cos(phi);
    positions[offset + 2] = distance * Math.sin(phi) * Math.sin(theta);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = new PointsMaterial({
    color: colors.ink,
    size: 0.42,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.62,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  return {
    field: new Points(geometry, material),
    geometry,
    material,
  };
}

function createOrbit(orbitRadius: number, colors: ThemeColors) {
  const points: Vector3[] = [];

  for (let index = 0; index < 72; index += 1) {
    const angle = (index / 72) * fullTurn;
    points.push(
      new Vector3(
        Math.cos(angle) * orbitRadius,
        0,
        Math.sin(angle) * orbitRadius,
      ),
    );
  }

  const geometry = new BufferGeometry().setFromPoints(points);
  const material = new LineBasicMaterial({
    color: colors.rule,
    transparent: true,
    opacity: 0.18,
  });

  return {
    orbit: new LineLoop(geometry, material),
    geometry,
    material,
  };
}

function groupBodiesByTexture(bodies: GalaxySceneBody[]) {
  const groups = new Map<number, GalaxySceneBody[]>();

  bodies.forEach((body) => {
    const group = groups.get(body.textureVariant) ?? [];
    group.push(body);
    groups.set(body.textureVariant, group);
  });

  return groups;
}

function assignBodyMatrices(mesh: InstancedMesh, bodies: GalaxySceneBody[]) {
  const instance = new Object3D();

  bodies.forEach((body, index) => {
    instance.position.set(body.position.x, body.position.y, body.position.z);
    instance.scale.setScalar(body.radius);
    instance.updateMatrix();
    mesh.setMatrixAt(index, instance.matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

function selectedBodyKind(node: GalaxyGameNode) {
  return node.kind === "planet" ? "行星" : "档案信标";
}

export function StarMap({ galaxy }: StarMapProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const focusControllerRef = useRef<(nodeId: string | null) => void>(() => {});
  const galaxyScene = useMemo(() => createGalaxyScene(galaxy), [galaxy]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renderUnavailable, setRenderUnavailable] = useState(false);
  const selectedBody =
    galaxyScene.bodies.find((body) => body.node.id === selectedId) ?? null;
  const selectedNode = selectedBody?.node ?? null;
  const resetOverview = () => {
    focusControllerRef.current(null);
    setSelectedId(null);
  };

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount || typeof WebGLRenderingContext === "undefined") {
      const fallbackFrame = window.requestAnimationFrame(() => {
        setRenderUnavailable(true);
      });

      return () => window.cancelAnimationFrame(fallbackFrame);
    }

    let renderer: WebGLRenderer;

    try {
      renderer = new WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      const fallbackFrame = window.requestAnimationFrame(() => {
        setRenderUnavailable(true);
      });

      return () => window.cancelAnimationFrame(fallbackFrame);
    }

    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute(
      "aria-label",
      "交互 Steam 星系；可拖动旋转，缩放视角并选择游戏星球。",
    );
    canvas.setAttribute(
      "aria-describedby",
      "star-map-hint star-map-volume-note",
    );
    mount.replaceChildren(canvas);

    const colors = getThemeColors(canvas);
    const scene = new Scene();
    const camera = new PerspectiveCamera(39, 1, 0.1, 420);
    const overviewCameraPosition = new Vector3(
      galaxyScene.cameraDistance * 0.72,
      galaxyScene.cameraDistance * 0.42,
      galaxyScene.cameraDistance * 0.72,
    );
    const overviewTarget = new Vector3(0, 0, 0);
    camera.position.copy(overviewCameraPosition);
    const controls = new OrbitControls(camera, canvas);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    controls.target.copy(overviewTarget);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.22;
    controls.minDistance = Math.max(8, galaxyScene.cameraDistance * 0.1);
    controls.maxDistance = galaxyScene.cameraDistance * 1.75;
    controls.maxPolarAngle = Math.PI * 0.86;
    controls.minPolarAngle = Math.PI * 0.14;
    controls.update();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    scene.add(new AmbientLight(colors.ink, 0.46));
    const coreLight = new PointLight(colors.accent, 112, 132, 1.7);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);
    const field = createStarField(colors);
    scene.add(field.field);

    const sphereGeometry = new SphereGeometry(1, 32, 20);
    const archiveGeometry = new SphereGeometry(1, 14, 10);
    const ringGeometry = new TorusGeometry(1, 0.045, 8, 64);
    const ringMaterial = new MeshBasicMaterial({
      color: colors.accent,
      transparent: true,
      opacity: 0.94,
      blending: AdditiveBlending,
    });
    const selectedRing = new Mesh(ringGeometry, ringMaterial);
    selectedRing.rotation.x = Math.PI / 2;
    selectedRing.visible = false;
    scene.add(selectedRing);

    const pickable: Object3D[] = [];
    const bodyById = new Map(
      galaxyScene.bodies.map((body) => [body.node.id, body]),
    );
    const disposableTextures: CanvasTexture[] = [];
    const disposableMaterials: Array<
      | MeshStandardMaterial
      | MeshBasicMaterial
      | LineBasicMaterial
      | PointsMaterial
    > = [ringMaterial, field.material];
    const disposableGeometries: BufferGeometry[] = [
      sphereGeometry,
      archiveGeometry,
      ringGeometry,
      field.geometry,
    ];

    const selectPlanet = (node: GalaxyGameNode) => {
      const body = bodyById.get(node.id);

      if (body) {
        applyFocus(body);
      }

      setSelectedId(node.id);
    };

    const coreBody = galaxyScene.bodies.find((body) => body.isCore) ?? null;
    if (coreBody) {
      const starTexture = createPlanetTexture("star", colors);
      const coreMaterial = new MeshStandardMaterial({
        emissive: colors.accent,
        emissiveIntensity: 1.4,
        map: starTexture,
        metalness: 0.03,
        roughness: 0.45,
      });
      const coreMesh = new Mesh(sphereGeometry, coreMaterial);
      coreMesh.position.set(
        coreBody.position.x,
        coreBody.position.y,
        coreBody.position.z,
      );
      coreMesh.scale.setScalar(coreBody.radius);
      coreMesh.userData.body = coreBody;
      coreMesh.name = coreBody.node.game.name;
      scene.add(coreMesh);
      pickable.push(coreMesh);
      disposableTextures.push(starTexture);
      disposableMaterials.push(coreMaterial);
    }

    const planetBodies = galaxyScene.bodies.filter(
      (body) => !body.isCore && body.node.kind === "planet",
    );
    const textureGroups = groupBodiesByTexture(planetBodies);
    textureGroups.forEach((bodies, textureVariant) => {
      const texture = createPlanetTexture(textureVariant, colors);
      const material = new MeshStandardMaterial({
        emissive: colors.paper,
        emissiveIntensity: 0.035,
        map: texture,
        metalness: 0.04,
        roughness: 0.78,
      });
      const mesh = new InstancedMesh(sphereGeometry, material, bodies.length);
      mesh.userData.bodies = bodies;
      mesh.name = `planet-batch:${textureVariant}`;
      assignBodyMatrices(mesh, bodies);
      scene.add(mesh);
      pickable.push(mesh);
      disposableTextures.push(texture);
      disposableMaterials.push(material);
    });

    const archiveBodies = galaxyScene.bodies.filter(
      (body) => body.node.kind === "archive-signal",
    );
    if (archiveBodies.length > 0) {
      const archiveMaterial = new MeshBasicMaterial({
        color: colors.muted,
        transparent: true,
        opacity: 0.82,
      });
      const archiveMesh = new InstancedMesh(
        archiveGeometry,
        archiveMaterial,
        archiveBodies.length,
      );
      archiveMesh.userData.bodies = archiveBodies;
      archiveMesh.name = "archive-signals";
      assignBodyMatrices(archiveMesh, archiveBodies);
      scene.add(archiveMesh);
      pickable.push(archiveMesh);
      disposableMaterials.push(archiveMaterial);
    }

    const occupiedOrbits = new Set<number>();
    galaxyScene.bodies.forEach((body) => {
      if (body.isCore || occupiedOrbits.has(body.orbitBand)) {
        return;
      }

      occupiedOrbits.add(body.orbitBand);
      const orbit = createOrbit(body.orbitRadius, colors);
      scene.add(orbit.orbit);
      disposableMaterials.push(orbit.material);
      disposableGeometries.push(orbit.geometry);
    });

    const raycaster = new Raycaster();
    const pointer = new Vector2();
    let pointerDown: { x: number; y: number } | null = null;
    let animationFrame = 0;
    let isFocused = false;
    let focusGoal: { cameraPosition: Vector3; target: Vector3 } | null = null;

    const applyFocus = (body: GalaxySceneBody | null) => {
      isFocused = body !== null;
      selectedRing.visible = body !== null;

      const target = body
        ? new Vector3(body.position.x, body.position.y, body.position.z)
        : overviewTarget.clone();
      const relativeCameraPosition = camera.position
        .clone()
        .sub(controls.target);
      const direction =
        relativeCameraPosition.lengthSq() > 0.0001
          ? relativeCameraPosition.normalize()
          : overviewCameraPosition.clone().sub(overviewTarget).normalize();
      const distance = body
        ? getGalaxyFocusDistance(galaxyScene, body)
        : overviewCameraPosition.distanceTo(overviewTarget);
      const cameraPosition = target
        .clone()
        .add(direction.multiplyScalar(distance));

      if (body) {
        selectedRing.position.copy(target);
        selectedRing.scale.setScalar(Math.max(0.5, body.radius * 1.42));
      }

      controls.autoRotate = body ? false : !reduceMotion;

      if (reduceMotion) {
        camera.position.copy(cameraPosition);
        controls.target.copy(target);
        controls.update();
        focusGoal = null;
        render();
        return;
      }

      focusGoal = { cameraPosition, target };
    };

    const render = () => {
      if (focusGoal) {
        camera.position.lerp(focusGoal.cameraPosition, 0.12);
        controls.target.lerp(focusGoal.target, 0.12);

        if (
          camera.position.distanceToSquared(focusGoal.cameraPosition) < 0.001 &&
          controls.target.distanceToSquared(focusGoal.target) < 0.001
        ) {
          camera.position.copy(focusGoal.cameraPosition);
          controls.target.copy(focusGoal.target);
          focusGoal = null;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    focusControllerRef.current = (nodeId) => {
      const body = nodeId ? (bodyById.get(nodeId) ?? null) : null;

      applyFocus(body);
    };

    const animate = () => {
      render();
      animationFrame = window.requestAnimationFrame(animate);
    };

    const resize = () => {
      const bounds = mount.getBoundingClientRect();

      if (bounds.width === 0 || bounds.height === 0) {
        return;
      }

      camera.aspect = bounds.width / bounds.height;
      camera.updateProjectionMatrix();
      renderer.setSize(bounds.width, bounds.height, false);
      render();
    };

    const handlePointerDown = (event: PointerEvent) => {
      pointerDown = { x: event.clientX, y: event.clientY };
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (
        !pointerDown ||
        Math.hypot(
          event.clientX - pointerDown.x,
          event.clientY - pointerDown.y,
        ) > 8
      ) {
        pointerDown = null;
        return;
      }

      const bounds = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickable, false)[0];
      const directBody = hit?.object.userData.body as
        GalaxySceneBody | undefined;
      const batchBodies = hit?.object.userData.bodies as
        GalaxySceneBody[] | undefined;
      const node =
        directBody?.node ??
        (hit?.instanceId === undefined
          ? undefined
          : batchBodies?.[hit.instanceId]?.node);

      if (node) {
        selectPlanet(node);
      }

      pointerDown = null;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "0") {
        event.preventDefault();
        applyFocus(null);
        setSelectedId(null);
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        focusGoal = null;
        controls.autoRotate = false;
        const relativeCameraPosition = camera.position.sub(controls.target);
        relativeCameraPosition.applyAxisAngle(
          new Vector3(0, 1, 0),
          event.key === "ArrowLeft" ? 0.12 : -0.12,
        );
        camera.position.copy(controls.target).add(relativeCameraPosition);
        render();
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        focusGoal = null;
        controls.autoRotate = false;
        const relativeCameraPosition = camera.position.sub(controls.target);
        relativeCameraPosition.multiplyScalar(0.9);
        relativeCameraPosition.clampLength(
          controls.minDistance,
          controls.maxDistance,
        );
        camera.position.copy(controls.target).add(relativeCameraPosition);
        render();
      }

      if (event.key === "-") {
        event.preventDefault();
        focusGoal = null;
        controls.autoRotate = false;
        const relativeCameraPosition = camera.position.sub(controls.target);
        relativeCameraPosition.multiplyScalar(1.1);
        relativeCameraPosition.clampLength(
          controls.minDistance,
          controls.maxDistance,
        );
        camera.position.copy(controls.target).add(relativeCameraPosition);
        render();
      }
    };
    const cancelFocusOnControl = () => {
      focusGoal = null;
      controls.autoRotate = false;
    };
    const pauseAutoRotate = () => {
      controls.autoRotate = false;
    };
    const resumeAutoRotate = () => {
      controls.autoRotate = !reduceMotion && !isFocused;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("keydown", handleKeyDown);
    canvas.addEventListener("pointerenter", pauseAutoRotate);
    canvas.addEventListener("pointerleave", resumeAutoRotate);
    canvas.addEventListener("focus", pauseAutoRotate);
    canvas.addEventListener("blur", resumeAutoRotate);
    controls.addEventListener("start", cancelFocusOnControl);
    resize();

    if (!reduceMotion) {
      animationFrame = window.requestAnimationFrame(animate);
    }

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("keydown", handleKeyDown);
      canvas.removeEventListener("pointerenter", pauseAutoRotate);
      canvas.removeEventListener("pointerleave", resumeAutoRotate);
      canvas.removeEventListener("focus", pauseAutoRotate);
      canvas.removeEventListener("blur", resumeAutoRotate);
      controls.removeEventListener("start", cancelFocusOnControl);
      window.cancelAnimationFrame(animationFrame);
      controls.dispose();
      focusControllerRef.current = () => {};
      disposableTextures.forEach((texture) => texture.dispose());
      disposableMaterials.forEach((material) => material.dispose());
      disposableGeometries.forEach((geometry) => geometry.dispose());
      renderer.dispose();
      mount.replaceChildren();
    };
  }, [galaxyScene]);

  if (galaxy.games.length === 0) {
    return (
      <p className={styles.starMapMessage} role="status">
        当前公开库存没有可绘制的游戏记录。
      </p>
    );
  }

  const mapLabel = `Three.js Steam 星系，展示时长最高的 ${galaxy.games.length} 款游戏；已游玩星球的体积严格按游玩时长映射。`;

  return (
    <figure className={styles.starMapFigure}>
      <div className={styles.starMapStage}>
        <div
          ref={mountRef}
          className={styles.starMapCanvas}
          role="group"
          aria-label={mapLabel}
          aria-describedby="star-map-hint star-map-volume-note"
        >
          {renderUnavailable && (
            <p className={styles.starMapFallback} role="status">
              当前浏览器无法启动 3D 渲染，仍可阅读下方游戏档案。
            </p>
          )}
        </div>
        {selectedNode && (
          <section
            id="star-map-selection"
            className={styles.starMapTelemetry}
            aria-live="polite"
          >
            <div className={styles.starMapTelemetryHead}>
              <p>星体档案</p>
              <span>#{selectedNode.rank}</span>
            </div>
            <h3>{selectedNode.game.name}</h3>
            <dl className={styles.starMapTelemetryMetrics}>
              <div>
                <dt>累计时长</dt>
                <dd>{formatHours(selectedNode.game.playtimeMinutes)} 小时</dd>
              </div>
              <div>
                <dt>星体类型</dt>
                <dd>{selectedBodyKind(selectedNode)}</dd>
              </div>
            </dl>
            <div className={styles.starMapTelemetryActions}>
              <button
                className={styles.starMapTelemetryReset}
                type="button"
                onClick={resetOverview}
              >
                返回全景
              </button>
              <p>按 Esc 或 0 也可返回全景</p>
            </div>
          </section>
        )}
      </div>
      <p id="star-map-hint" className={styles.starMapHint}>
        单指拖动旋转 · 双指或滚轮缩放 · 轻触星球聚焦 · Esc 或 0 返回全景
      </p>
      <p id="star-map-volume-note" className={styles.starMapVolumeNote}>
        已游玩星球的半径按累计时长的立方根计算：1000 小时的星球体积是 100 小时的
        10 倍；0 小时游戏显示为档案信标。
      </p>
    </figure>
  );
}
