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
  LineLoop,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
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

import { createStarMapLayout, type StarMapNode } from "@/lib/report/star-map";
import {
  createThreeStarSystem,
  type ThreeStarBody,
} from "@/lib/report/three-star-system";
import type { OwnedGame } from "@/lib/report/types";

import styles from "./story-player.module.css";

interface StarMapProps {
  games: readonly OwnedGame[];
}

interface ThemeColors {
  accent: Color;
  continent: string;
  gas: string;
  ice: string;
  ink: Color;
  inkCss: string;
  muted: Color;
  nebula: string;
  ocean: string;
  paper: Color;
  paperCss: string;
  rust: string;
  rule: Color;
}

const fullTurn = Math.PI * 2;
const canvasTextureWidth = 512;
const canvasTextureHeight = 256;

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
    nebula: getTokenValue(canvas, "--color-story-nebula"),
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
  body: ThreeStarBody,
  colors: ThemeColors,
): CanvasTexture {
  const canvas = createTextureCanvas();
  const context = canvas.getContext("2d");

  if (!context) {
    return new CanvasTexture(canvas);
  }

  const random = createRandom(body.node.id);
  const variant = body.isCore
    ? "star"
    : body.node.kind === "nebula"
      ? "nebula"
      : body.solarSystemRole === "地球"
        ? "ocean"
        : ["ocean", "rust", "ice", "gas"][stableHash(body.node.id) % 4];
  const base =
    variant === "rust"
      ? colors.rust
      : variant === "ice"
        ? colors.ice
        : variant === "gas"
          ? colors.gas
          : variant === "nebula"
            ? colors.nebula
            : variant === "star"
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

  if (variant === "gas" || variant === "star") {
    for (let index = 0; index < 18; index += 1) {
      context.fillStyle = index % 2 === 0 ? colors.inkCss : colors.paperCss;
      context.globalAlpha = 0.06 + random() * 0.18;
      context.fillRect(
        0,
        random() * canvasTextureHeight,
        canvasTextureWidth,
        5 + random() * 21,
      );
    }
  } else if (variant === "nebula") {
    for (let index = 0; index < 40; index += 1) {
      context.fillStyle = colors.inkCss;
      context.globalAlpha = 0.05 + random() * 0.15;
      context.beginPath();
      context.arc(
        random() * canvasTextureWidth,
        random() * canvasTextureHeight,
        4 + random() * 24,
        0,
        fullTurn,
      );
      context.fill();
    }
  } else {
    const landColor = variant === "ocean" ? colors.continent : colors.inkCss;

    for (let index = 0; index < 17; index += 1) {
      context.fillStyle = landColor;
      context.globalAlpha = 0.3 + random() * 0.38;
      context.beginPath();
      context.ellipse(
        random() * canvasTextureWidth,
        random() * canvasTextureHeight,
        12 + random() * 40,
        5 + random() * 17,
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
        16 + random() * 54,
        2 + random() * 9,
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
    const distance = 62 + random() * 138;
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
    opacity: 0.23,
  });

  return {
    orbit: new LineLoop(geometry, material),
    geometry,
    material,
  };
}

export function StarMap({ games }: StarMapProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const layout = useMemo(() => createStarMapLayout(games), [games]);
  const solarSystem = useMemo(() => createThreeStarSystem(layout), [layout]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renderUnavailable, setRenderUnavailable] = useState(false);
  const selectedNode =
    layout.nodes.find((node) => node.id === selectedId) ?? null;
  const selectedBody =
    solarSystem.bodies.find((body) => body.node.id === selectedNode?.id) ??
    null;

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
      "交互游戏太阳系；可拖动旋转，缩放视角并选择星球。",
    );
    canvas.setAttribute(
      "aria-describedby",
      "star-map-hint star-map-volume-note",
    );
    mount.replaceChildren(canvas);

    const colors = getThemeColors(canvas);
    const scene = new Scene();
    const camera = new PerspectiveCamera(39, 1, 0.1, 350);
    camera.position.set(
      solarSystem.cameraDistance * 0.72,
      solarSystem.cameraDistance * 0.42,
      solarSystem.cameraDistance * 0.72,
    );
    const controls = new OrbitControls(camera, canvas);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    controls.target.set(0, 0, 0);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.34;
    controls.minDistance = Math.max(8, solarSystem.cameraDistance * 0.22);
    controls.maxDistance = solarSystem.cameraDistance * 1.9;
    controls.maxPolarAngle = Math.PI * 0.86;
    controls.minPolarAngle = Math.PI * 0.14;
    controls.update();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    scene.add(new AmbientLight(colors.ink, 0.48));
    const coreLight = new PointLight(colors.accent, 88, 96, 1.7);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);
    const field = createStarField(colors);
    scene.add(field.field);

    const sphereGeometry = new SphereGeometry(1, 44, 28);
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
    const pickable: Mesh[] = [];
    const planetMeshes = new Map<string, Mesh>();
    const disposableTextures: CanvasTexture[] = [];
    const disposableMaterials: Array<
      | MeshStandardMaterial
      | MeshBasicMaterial
      | LineBasicMaterial
      | PointsMaterial
    > = [ringMaterial, field.material];
    const disposableGeometries: BufferGeometry[] = [
      sphereGeometry,
      ringGeometry,
      field.geometry,
    ];

    const selectPlanet = (node: StarMapNode) => {
      const mesh = planetMeshes.get(node.id);

      if (mesh) {
        const body = solarSystem.bodies.find(
          (item) => item.node.id === node.id,
        );
        selectedRing.position.copy(mesh.position);
        selectedRing.scale.setScalar(
          Math.max(0.75, (body?.radius ?? 1) * 1.38),
        );
        selectedRing.visible = true;
      }

      setSelectedId(node.id);
    };

    const occupiedOrbits = new Set<number>();
    solarSystem.bodies.forEach((body) => {
      if (!body.isCore && body.node.kind !== "dust") {
        const orbitKey = Math.round(body.orbitRadius / 8) * 8;

        if (!occupiedOrbits.has(orbitKey)) {
          occupiedOrbits.add(orbitKey);
          const orbit = createOrbit(orbitKey, colors);
          scene.add(orbit.orbit);
          disposableMaterials.push(orbit.material);
          disposableGeometries.push(orbit.geometry);
        }
      }

      const texture = createPlanetTexture(body, colors);
      disposableTextures.push(texture);
      const material = new MeshStandardMaterial({
        map: texture,
        roughness: body.isCore ? 0.45 : 0.78,
        metalness: body.node.kind === "nebula" ? 0.24 : 0.04,
        transparent: body.node.kind === "nebula",
        opacity: body.node.kind === "nebula" ? 0.66 : 1,
        emissive: body.isCore ? colors.accent : colors.paper,
        emissiveIntensity: body.isCore ? 1.4 : 0.03,
      });
      const mesh = new Mesh(sphereGeometry, material);
      mesh.position.set(body.position.x, body.position.y, body.position.z);
      mesh.scale.setScalar(body.radius);
      mesh.userData.node = body.node;
      mesh.name = body.node.name;
      scene.add(mesh);
      disposableMaterials.push(material);
      planetMeshes.set(body.node.id, mesh);

      if (body.node.kind !== "dust") {
        pickable.push(mesh);
      }
    });

    const raycaster = new Raycaster();
    const pointer = new Vector2();
    let pointerDown: { x: number; y: number } | null = null;
    let animationFrame = 0;

    const render = () => {
      controls.update();
      renderer.render(scene, camera);
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
      const node = hit?.object.userData.node as StarMapNode | undefined;

      if (node) {
        selectPlanet(node);
      }

      pointerDown = null;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        camera.position.applyAxisAngle(
          new Vector3(0, 1, 0),
          event.key === "ArrowLeft" ? 0.12 : -0.12,
        );
        render();
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        camera.position.multiplyScalar(0.9);
        render();
      }

      if (event.key === "-") {
        event.preventDefault();
        camera.position.multiplyScalar(1.1);
        render();
      }
    };
    const pauseAutoRotate = () => {
      controls.autoRotate = false;
    };
    const resumeAutoRotate = () => {
      controls.autoRotate = !reduceMotion;
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
      window.cancelAnimationFrame(animationFrame);
      controls.dispose();
      disposableTextures.forEach((texture) => texture.dispose());
      disposableMaterials.forEach((material) => material.dispose());
      disposableGeometries.forEach((geometry) => geometry.dispose());
      renderer.dispose();
      mount.replaceChildren();
    };
  }, [solarSystem]);

  if (layout.state === "empty" || solarSystem.bodies.length === 0) {
    return (
      <p className={styles.starMapMessage} role="status">
        当前公开库存没有可绘制的游玩记录。
      </p>
    );
  }

  const mapLabel = `Three.js 游戏太阳系，展示时长最高的 ${solarSystem.bodies.length} 款游戏；星球体积严格按游玩时长映射。`;

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
              <span>{selectedBody?.solarSystemRole ?? "轨道"}</span>
            </div>
            <h3>{selectedNode.name}</h3>
            <dl className={styles.starMapTelemetryMetrics}>
              <div>
                <dt>累计时长</dt>
                <dd>{formatHours(selectedNode.playtimeMinutes)} 小时</dd>
              </div>
              <div>
                <dt>体积规则</dt>
                <dd>V ∝ 时长</dd>
              </div>
            </dl>
          </section>
        )}
      </div>
      <p id="star-map-hint" className={styles.starMapHint}>
        单指拖动旋转 · 双指或滚轮缩放 · 轻触星球展开档案 · 方向键旋转
      </p>
      <p id="star-map-volume-note" className={styles.starMapVolumeNote}>
        半径按游玩时长的立方根计算：1000 小时的星球体积是 100 小时的 10 倍。
      </p>
    </figure>
  );
}
