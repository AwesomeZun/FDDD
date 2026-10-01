import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  disposeMolecularObject,
  makeProteinComplex,
} from "../../components/ProteinRibbon";
import type { HabitatPair } from "../../lib/colonyPolicy";
export function MoleculeScene({ pair }: { pair: HabitatPair }) {
  const host = useRef<HTMLDivElement>(null),
    [status, setStatus] = useState("Loading experimental coordinates…");
  useEffect(() => {
    const el = host.current!,
      abort = new AbortController();
    let stopped = false,
      raf = 0;
    setStatus("Loading experimental coordinates…");
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      setStatus("WebGL is unavailable. Docking values are still available.");
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.setClearColor(0x060c10, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(36, 1, 0.01, 200);
    scene.add(new THREE.HemisphereLight(0xd7fff5, 0x11212c, 2.3));
    const light = new THREE.DirectionalLight(0x8fffe0, 3.5);
    light.position.set(4, 7, 5);
    scene.add(light);
    const rim = new THREE.DirectionalLight(0xa995ff, 3);
    rim.position.set(-4, 0, -5);
    scene.add(rim);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.autoRotate = !matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    controls.autoRotateSpeed = 0.7;
    const fit = () => {
      const w = Math.max(1, el.clientWidth),
        h = Math.max(1, el.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    fit();
    void Promise.all(
      [pair.receptorUrl, pair.poseUrl].map(async (url) => {
        const r = await fetch(url, { signal: abort.signal });
        if (!r.ok) throw Error("Structure data unavailable.");
        return r.text();
      }),
    )
      .then(([receptor, pose]) => {
        if (stopped) return;
        const molecule = makeProteinComplex(receptor, pose, 0x6cb6ba, 0xffd795);
        scene.add(molecule);
        const box = new THREE.Box3().setFromObject(molecule),
          center = box.getCenter(new THREE.Vector3()),
          size = box.getSize(new THREE.Vector3());
        const distance =
          Math.max(size.x / camera.aspect, size.y, size.z) * 1.95;
        controls.target.copy(center);
        camera.position
          .copy(center)
          .add(
            new THREE.Vector3(0.22, 0.12, 1)
              .normalize()
              .multiplyScalar(distance),
          );
        camera.lookAt(center);
        controls.update();
        setStatus("ready");
      })
      .catch((e) => {
        if (!stopped) setStatus(String(e));
      });
    let visible = true;
    const visibility = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    });
    visibility.observe(el);
    let last = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (document.hidden || !visible || now - last < 33) return;
      last = now;
      controls.update();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      abort.abort();
      cancelAnimationFrame(raf);
      observer.disconnect();
      visibility.disconnect();
      controls.dispose();
      disposeMolecularObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [pair.id, pair.poseUrl, pair.receptorUrl]);
  return (
    <div
      className="molecule-scene"
      ref={host}
      data-scene-status={status}
      role="img"
      aria-label={`${pair.name} in its computed docking pose with ${pair.targetName}`}
    >
      {status !== "ready" && (
        <span className="scene-status" role="status">
          {status}
        </span>
      )}
    </div>
  );
}
