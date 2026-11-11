"use client";

import { useEffect, useRef, useState } from "react";
import type * as ThreeNS from "three";

type ThreeModule = typeof import("three");

const DPR_CAP = 1.75;

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewW;
  varying vec3 vLocal;

  void main() {
    vLocal = position;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uRim;
  uniform vec3 uHot;
  uniform float uTime;

  varying vec3 vNormalW;
  varying vec3 vViewW;
  varying vec3 vLocal;

  void main() {
    float facing = clamp(dot(normalize(vNormalW), normalize(vViewW)), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 2.15);

    // Slow latitude bands read as a stadium scoreboard sweeping the orb.
    float band = smoothstep(0.62, 1.0, 0.5 + 0.5 * sin(vLocal.y * 18.0 + uTime * 0.55));
    float pulse = 0.5 + 0.5 * sin(uTime * 0.4);

    vec3 color = mix(uDeep, uRim, fresnel);
    color = mix(color, uHot, pow(fresnel, 3.0) * 0.7);
    color += uHot * band * fresnel * (0.18 + pulse * 0.12);

    float alpha = 0.06 + fresnel * 0.9;
    gl_FragColor = vec4(color, alpha);
  }
`;

/** Deterministic PRNG so the particle field is identical on every mount. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mount(
  THREE: ThreeModule,
  wrap: HTMLElement,
  canvas: HTMLCanvasElement,
  onReady: () => void,
  onFail: () => void,
): () => void {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  const geometries = new Set<ThreeNS.BufferGeometry>();
  const materials = new Set<ThreeNS.Material>();

  const geo = <T extends ThreeNS.BufferGeometry>(value: T): T => {
    geometries.add(value);
    return value;
  };
  const mat = <T extends ThreeNS.Material>(value: T): T => {
    materials.add(value);
    return value;
  };

  // --- core orb -------------------------------------------------------------
  const pivot = new THREE.Group();
  scene.add(pivot);

  const orbMaterial = mat(
    new THREE.ShaderMaterial({
      uniforms: {
        uDeep: { value: new THREE.Color("#101a2e") },
        uRim: { value: new THREE.Color("#93a7ff") },
        uHot: { value: new THREE.Color("#ff5236") },
        uTime: { value: 0 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const orb = new THREE.Mesh(geo(new THREE.SphereGeometry(1.4, 96, 96)), orbMaterial);
  pivot.add(orb);

  const shellMaterial = mat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color("#93a7ff"),
      wireframe: true,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const shell = new THREE.Mesh(geo(new THREE.IcosahedronGeometry(1.72, 1)), shellMaterial);
  pivot.add(shell);

  // --- particle field -------------------------------------------------------
  const COUNT = 720;
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const rand = mulberry32(20261110);
  const lime = new THREE.Color("#ff5236");
  const peri = new THREE.Color("#93a7ff");
  const magenta = new THREE.Color("#f2417c");

  for (let i = 0; i < COUNT; i += 1) {
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const radius = 1.86 + Math.pow(rand(), 0.65) * 1.12;
    const ring = Math.sqrt(Math.max(0, 1 - u * u));
    positions[i * 3] = Math.cos(theta) * ring * radius;
    positions[i * 3 + 1] = u * radius;
    positions[i * 3 + 2] = Math.sin(theta) * ring * radius;

    const pick = rand();
    const color = pick < 0.52 ? lime : pick < 0.86 ? peri : magenta;
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const particleGeometry = geo(new THREE.BufferGeometry());
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const particleMaterial = mat(
    new THREE.PointsMaterial({
      size: 0.036,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  pivot.add(particles);

  // --- orbit rails + travelling nodes --------------------------------------
  const orbit = new THREE.Group();
  orbit.rotation.set(0.62, 0.16, -0.42);
  scene.add(orbit);

  const railGeometry = geo(new THREE.TorusGeometry(2.28, 0.0045, 6, 220));
  const railMaterial = mat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color("#93a7ff"),
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  orbit.add(new THREE.Mesh(railGeometry, railMaterial));

  const outerRailMaterial = mat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ff5236"),
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const outerRail = new THREE.Mesh(geo(new THREE.TorusGeometry(2.74, 0.0035, 6, 240)), outerRailMaterial);
  outerRail.rotation.set(Math.PI / 2.5, 0.5, 0);
  orbit.add(outerRail);

  const nodeGeometry = geo(new THREE.SphereGeometry(0.05, 16, 16));
  const nodes = ["#ff5236", "#f2417c", "#93a7ff"].map((hex, index) => {
    const material = mat(new THREE.MeshBasicMaterial({ color: new THREE.Color(hex) }));
    const mesh = new THREE.Mesh(nodeGeometry, material);
    orbit.add(mesh);
    return {
      mesh,
      phase: (index / 3) * Math.PI * 2,
      speed: 0.4 + index * 0.09,
    };
  });

  // --- sizing ---------------------------------------------------------------
  const resize = () => {
    const width = Math.max(1, wrap.clientWidth);
    const height = Math.max(1, wrap.clientHeight);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
    renderer.setSize(width, height, false);

    camera.aspect = width / height;
    const halfFov = (camera.fov * Math.PI) / 360;
    const fit = 4.7;
    const distance = Math.max(fit / (2 * Math.tan(halfFov)), fit / (2 * Math.tan(halfFov) * camera.aspect));
    camera.position.z = distance * 1.02;
    camera.updateProjectionMatrix();
  };

  // --- pointer parallax -----------------------------------------------------
  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };

  const onPointerMove = (event: PointerEvent) => {
    target.x = (event.clientX / window.innerWidth) * 2 - 1;
    target.y = (event.clientY / window.innerHeight) * 2 - 1;
  };

  // --- render loop ----------------------------------------------------------
  let running = false;
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let firstFrame = false;

  const renderFrame = (now: number) => {
    if (!running) return;
    raf = window.requestAnimationFrame(renderFrame);

    const delta = last === 0 ? 1 / 60 : Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += delta;

    pointer.x += (target.x - pointer.x) * 0.055;
    pointer.y += (target.y - pointer.y) * 0.055;

    pivot.rotation.y = elapsed * 0.085 + pointer.x * 0.24;
    pivot.rotation.x = 0.12 + Math.sin(elapsed * 0.22) * 0.06 - pointer.y * 0.14;
    shell.rotation.y = -elapsed * 0.05;
    shell.rotation.z = elapsed * 0.03;
    particles.rotation.y = elapsed * 0.032;
    orbit.rotation.y = 0.16 + elapsed * 0.06;
    orbMaterial.uniforms.uTime.value = elapsed;

    for (const node of nodes) {
      const angle = node.phase + elapsed * node.speed;
      node.mesh.position.set(Math.cos(angle) * 2.28, Math.sin(angle) * 2.28, 0);
    }

    camera.position.x = pointer.x * 0.45;
    camera.position.y = -pointer.y * 0.3;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);

    if (!firstFrame) {
      firstFrame = true;
      onReady();
    }
  };

  const start = () => {
    if (running || reduceMotion) return;
    running = true;
    last = 0;
    raf = window.requestAnimationFrame(renderFrame);
  };

  const stop = () => {
    running = false;
    window.cancelAnimationFrame(raf);
  };

  const renderStatic = () => {
    for (const node of nodes) {
      node.mesh.position.set(Math.cos(node.phase) * 2.28, Math.sin(node.phase) * 2.28, 0);
    }
    renderer.render(scene, camera);
    if (!firstFrame) {
      firstFrame = true;
      onReady();
    }
  };

  // --- lifecycle ------------------------------------------------------------
  let inViewport = true;

  const sync = () => {
    if (reduceMotion) return;
    if (inViewport && document.visibilityState === "visible") start();
    else stop();
  };

  const onVisibility = () => {
    last = 0;
    sync();
  };

  const onContextLost = (event: Event) => {
    event.preventDefault();
    stop();
    // Stop observing before the fallback takes over, so a resize never tries
    // to draw into a lost context (three would log an error).
    observer.disconnect();
    resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pointermove", onPointerMove);
    onFail();
  };

  const observer = new IntersectionObserver(
    (entries) => {
      inViewport = entries[0]?.isIntersecting ?? true;
      sync();
    },
    { threshold: 0 },
  );
  observer.observe(wrap);

  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (!running) renderStatic();
  });
  resizeObserver.observe(wrap);

  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onContextLost);
  if (!reduceMotion) window.addEventListener("pointermove", onPointerMove, { passive: true });

  resize();
  if (reduceMotion) renderStatic();
  else start();

  return () => {
    stop();
    observer.disconnect();
    resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    window.removeEventListener("pointermove", onPointerMove);

    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    geometries.clear();
    materials.clear();

    renderer.dispose();
    renderer.forceContextLoss();
  };
}

function Fallback() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 h-[52%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-peri/30 bg-[radial-gradient(circle_at_34%_28%,rgba(255,82,54,0.2),rgba(147,167,255,0.22)_46%,rgba(242,65,124,0.16)_72%,rgba(21,10,18,0.55)_100%)] shadow-[0_0_90px_-18px_rgba(147,167,255,0.45)]" />
      <span
        className="absolute left-1/2 top-1/2 h-[64%] w-[92%] rounded-full border border-peri/20"
        style={{ transform: "translate(-50%, -50%) rotate(-22deg) scaleY(0.44)" }}
      />
      <span
        className="absolute left-1/2 top-1/2 h-[70%] w-[104%] rounded-full border border-lime/15"
        style={{ transform: "translate(-50%, -50%) rotate(28deg) scaleY(0.38)" }}
      />
      <span className="absolute left-[18%] top-[30%] h-1.5 w-1.5 rounded-full bg-lime/70" />
      <span className="absolute right-[16%] top-[62%] h-1 w-1 rounded-full bg-magenta/70" />
    </div>
  );
}

/** Cheap capability probe; releases the test context immediately. */
function supportsWebGL(): boolean {
  try {
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!context) return false;
    const lose = (context as WebGLRenderingContext).getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Signature hero scene: a fresnel-lit orb in lime / periwinkle / magenta,
 * ringed by orbit rails and a seeded particle field. Three is imported lazily
 * inside the effect, so nothing WebGL-related ever runs during SSR.
 */
export function HeroThree({ className = "" }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    let disposed = false;
    let teardown: (() => void) | null = null;

    // Probe WebGL first: three logs a console error when context creation
    // fails, and we want the fallback to be silent as well as graceful.
    if (!supportsWebGL()) {
      setFailed(true);
      return;
    }

    const boot = async () => {
      let THREE: ThreeModule;
      try {
        THREE = await import("three");
      } catch {
        if (!disposed) setFailed(true);
        return;
      }
      if (disposed) return;

      try {
        teardown = mount(
          THREE,
          wrap,
          canvas,
          () => {
            if (!disposed) setReady(true);
          },
          () => {
            if (!disposed) setFailed(true);
          },
        );
      } catch {
        if (!disposed) setFailed(true);
      }
    };

    void boot();

    return () => {
      disposed = true;
      teardown?.();
      teardown = null;
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    >
      <div className="absolute inset-0 rounded-[1.2rem] bg-[radial-gradient(115%_85%_at_60%_46%,rgba(147,167,255,0.16),rgba(242,65,124,0.05)_52%,rgba(21,10,18,0)_72%)]" />
      <canvas
        ref={canvasRef}
        className="relative block h-full w-full transition-opacity duration-700 ease-out"
        style={{ opacity: ready && !failed ? 1 : 0 }}
      />
      {failed ? <Fallback /> : null}
    </div>
  );
}
