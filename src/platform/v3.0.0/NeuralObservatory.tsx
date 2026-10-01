import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { FlightFrame } from "../../lib/flight";
import { regionOfGroup } from "../../components/brainRegions";

const COLORS = ["#62efd0", "#a8b7ef", "#efbb79", "#c3a2ed", "#789da9"];
/** Measured soma locations. GPU halos are a viewing effect; spikes always come from the selected live frame. */
export function NeuralObservatory({
  frame,
  paused,
  identity,
  resetKey = 0,
  connections = true,
}: {
  frame?: FlightFrame;
  paused: boolean;
  identity: number;
  resetKey?: number;
  connections?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef({ frame, paused, identity, connections }),
    reset = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState("loading");
  latest.current = { frame, paused, identity, connections };
  useEffect(() => {
    reset.current?.();
  }, [resetKey]);
  useEffect(() => {
    const el = host.current!;
    const abort = new AbortController();
    let disposed = false,
      raf = 0;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      setStatus("WebGL is unavailable. Live values remain accessible below.");
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.setClearColor(0x050a0c, 0);
    renderer.domElement.setAttribute(
      "aria-label",
      "Measured MaleCNS neuron positions with live computed spike activity. Drag to rotate.",
    );
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 4.5;
    controls.maxDistance = 13;
    controls.enableZoom = false;
    const resetView = () => {
      camera.position.set(0.25, 0.6, 8.6);
      controls.target.set(0, 0.2, 0);
      controls.update();
    };
    resetView();
    reset.current = resetView;
    const group = new THREE.Group();
    scene.add(group);
    group.rotation.set(0.05, -0.2, -0.08);
    let geometry: THREE.BufferGeometry | undefined,
      core: THREE.ShaderMaterial | undefined,
      halo: THREE.ShaderMaterial | undefined;
    let links: THREE.LineSegments | undefined,
      linkGeometry: THREE.BufferGeometry | undefined,
      linkMaterial: THREE.ShaderMaterial | undefined;
    let linkPairs: number[][] = [],
      linkTimes = new Float32Array();
    const segments = 8,
      verticesPerLink = segments * 2;
    let indices: number[] = [],
      lastTick = -1,
      lastFrame: FlightFrame | undefined;
    let lastPaint = performance.now(),
      lastIdentity = identity;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const fit = () => {
      const w = Math.max(1, el.clientWidth),
        h = Math.max(1, el.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Preserve the whole measured brain on narrow observation panels.
      camera.fov =
        2 *
        THREE.MathUtils.radToDeg(
          Math.atan(
            Math.tan(THREE.MathUtils.degToRad(37 / 2)) *
              Math.max(1, 1.2 / camera.aspect),
          ),
        );
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    fit();
    let visible = true;
    const visibility = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    });
    visibility.observe(el);
    const vertex = `attribute vec3 regionColor; attribute float activation; attribute float firedAt;
      varying vec3 vColor; varying float vSpike; uniform float time; uniform float pointScale; uniform float pixelRatio;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.0);float spike=exp(-max(0.0,time-firedAt)*5.0);
      vSpike=spike;vColor=regionColor*(0.25+0.50*activation)+spike*vec3(0.18,0.85,0.61);
      gl_Position=projectionMatrix*p;gl_PointSize=clamp((1.5+activation*0.8+spike*2.2)*pointScale*pixelRatio*7.0/-p.z,1.0,22.0);}`;
    void Promise.all(
      [
        "/data/malecns/display-points.json",
        "/data/malecns/display-connections-v3.0.0.json",
      ].map(async (url) => {
        const r = await fetch(url, { signal: abort.signal });
        if (!r.ok)
          throw Error("Measured connectivity display could not be loaded.");
        return r.json();
      }),
    )
      .then(([data, connectionData]) => {
        if (disposed) return;
        const points = data.points as {
          position: number[];
          sortedIndex: number;
          group: string;
        }[];
        const bounds = [0, 1, 2].map((k) => {
          const v = points.map((p) => p.position[k]).sort((a, b) => a - b);
          return [
            v[Math.floor(v.length * 0.005)],
            v[Math.floor(v.length * 0.995)],
          ];
        });
        const scale = 5.3 / Math.max(...bounds.map((b) => b[1] - b[0])),
          n = points.length;
        const pos = new Float32Array(n * 3),
          colors = new Float32Array(n * 3),
          activation = new Float32Array(n),
          fired = new Float32Array(n).fill(-1000);
        const palette = COLORS.map((c) => new THREE.Color(c));
        points.forEach((p, i) => {
          indices.push(p.sortedIndex);
          pos.set(
            [
              (p.position[0] - (bounds[0][0] + bounds[0][1]) / 2) * scale,
              -(p.position[1] - (bounds[1][0] + bounds[1][1]) / 2) * scale,
              -(p.position[2] - (bounds[2][0] + bounds[2][1]) / 2) * scale,
            ],
            i * 3,
          );
          const c = palette[regionOfGroup(p.group)];
          colors.set([c.r, c.g, c.b], i * 3);
        });
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geometry.setAttribute(
          "regionColor",
          new THREE.BufferAttribute(colors, 3),
        );
        geometry.setAttribute(
          "activation",
          new THREE.BufferAttribute(activation, 1).setUsage(
            THREE.DynamicDrawUsage,
          ),
        );
        geometry.setAttribute(
          "firedAt",
          new THREE.BufferAttribute(fired, 1).setUsage(THREE.DynamicDrawUsage),
        );
        const make = (isHalo: boolean) =>
          new THREE.ShaderMaterial({
            uniforms: {
              time: { value: 0 },
              pointScale: { value: isHalo ? 3.5 : 1 },
              pixelRatio: { value: renderer.getPixelRatio() },
            },
            vertexShader: vertex,
            fragmentShader: `varying vec3 vColor;varying float vSpike;void main(){float d=length(gl_PointCoord-vec2(.5))*2.0;if(d>1.0)discard;float a=${isHalo ? "pow(1.0-d,3.5)*(0.025+vSpike*0.13)" : "pow(1.0-d,1.5)*0.88"};gl_FragColor=vec4(vColor,a);}`,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
        core = make(false);
        halo = make(true);
        group.add(
          new THREE.Points(geometry, halo),
          new THREE.Points(geometry, core),
        );
        linkPairs = connectionData.edges;
        linkTimes = new Float32Array(linkPairs.length).fill(-1000);
        const lp = new Float32Array(linkPairs.length * verticesPerLink * 3);
        const progress = new Float32Array(linkPairs.length * verticesPerLink);
        const firedAt = new Float32Array(progress.length).fill(-1000);
        linkPairs.forEach(([a, b], e) => {
          const start = new THREE.Vector3().fromArray(pos, a * 3),
            end = new THREE.Vector3().fromArray(pos, b * 3);
          const mid = start.clone().lerp(end, 0.5);
          // The endpoints are measured; the bowed path is explicitly a viewing aid.
          mid.z += start.distanceTo(end) * 0.12;
          const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
          for (let s = 0; s < segments; s++)
            for (let k = 0; k < 2; k++) {
              const v = e * verticesPerLink + s * 2 + k,
                t = (s + k) / segments;
              curve.getPoint(t).toArray(lp, v * 3);
              progress[v] = t;
            }
        });
        linkGeometry = new THREE.BufferGeometry();
        linkGeometry.setAttribute("position", new THREE.BufferAttribute(lp, 3));
        linkGeometry.setAttribute(
          "progress",
          new THREE.BufferAttribute(progress, 1),
        );
        linkGeometry.setAttribute(
          "firedAt",
          new THREE.BufferAttribute(firedAt, 1).setUsage(
            THREE.DynamicDrawUsage,
          ),
        );
        linkMaterial = new THREE.ShaderMaterial({
          uniforms: { time: { value: 0 } },
          vertexShader:
            "attribute float progress;attribute float firedAt;varying float along;varying float fired;void main(){along=progress;fired=firedAt;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
          fragmentShader:
            "uniform float time;varying float along;varying float fired;void main(){float age=time-fired;float pulse=exp(-pow((along-age*1.8)*9.0,2.0))*step(0.0,age)*step(age,0.8);gl_FragColor=vec4(mix(vec3(.38,.76,.64),vec3(1.,.88,.61),pulse),.022+pulse*.29);}",
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        links = new THREE.LineSegments(linkGeometry, linkMaterial);
        group.add(links);
        setStatus("ready");
      })
      .catch((e) => {
        if (!disposed) setStatus(String(e));
      });
    let visualTime = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (document.hidden || !visible) {
        lastPaint = now;
        return;
      }
      if (now - lastPaint < 33) return;
      const dt = Math.min(0.1, (now - lastPaint) / 1000);
      lastPaint = now;
      const f = latest.current.frame;
      if (!latest.current.paused) visualTime += dt;
      if (
        geometry &&
        f &&
        (f !== lastFrame ||
          f.tick !== lastTick ||
          latest.current.identity !== lastIdentity)
      ) {
        const acts = geometry.getAttribute(
            "activation",
          ) as THREE.BufferAttribute,
          fire = geometry.getAttribute("firedAt") as THREE.BufferAttribute;
        // Switching individuals must never leave the previous individual’s spike glow behind.
        const changedFly =
          latest.current.identity !== lastIdentity || f.tick < lastTick;
        if (changedFly) (fire.array as Float32Array).fill(-1000);
        if (changedFly) linkTimes.fill(-1000);
        for (let i = 0; i < indices.length; i++) {
          const k = f.compactDisplay ? i : indices[i];
          acts.setX(i, Math.min(1, Math.max(0, f.activity[k] || 0)));
          if (f.fireState[k]) fire.setX(i, visualTime);
        }
        acts.needsUpdate = true;
        fire.needsUpdate = true;
        if (linkGeometry) {
          const times = linkGeometry.getAttribute(
            "firedAt",
          ) as THREE.BufferAttribute;
          linkPairs.forEach(([a], e) => {
            const k = f.compactDisplay ? a : indices[a];
            if (f.fireState[k] && visualTime - linkTimes[e] > 0.6)
              linkTimes[e] = visualTime;
            (times.array as Float32Array).fill(
              linkTimes[e],
              e * verticesPerLink,
              (e + 1) * verticesPerLink,
            );
          });
          times.needsUpdate = true;
        }
        lastTick = f.tick;
        lastFrame = f;
        lastIdentity = latest.current.identity;
      }
      if (core && halo) {
        core.uniforms.time.value = visualTime;
        halo.uniforms.time.value = visualTime;
      }
      if (links) links.visible = latest.current.connections;
      if (linkMaterial) linkMaterial.uniforms.time.value = visualTime;
      controls.autoRotate = !latest.current.paused && !reduced.matches;
      controls.autoRotateSpeed = 0.28;
      controls.update();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(raf);
      observer.disconnect();
      visibility.disconnect();
      reset.current = null;
      controls.dispose();
      geometry?.dispose();
      core?.dispose();
      halo?.dispose();
      linkGeometry?.dispose();
      linkMaterial?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div className="neural-observatory" ref={host} data-scene-status={status}>
      {status !== "ready" && (
        <div className="scene-status" role="status">
          {status === "loading" ? "Loading measured neuron locations…" : status}
        </div>
      )}
    </div>
  );
}
