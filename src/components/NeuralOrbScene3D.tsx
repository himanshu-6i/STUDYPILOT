import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { StudyTask, ProgressMetrics } from '../lib/validation.ts';

export type CameraPreset = 'hero_home' | 'planner_focus' | 'architecture_grid' | 'top_matrix' | 'advantages_wide';

interface NeuralOrbScene3DProps {
  tasks: StudyTask[];
  progress: ProgressMetrics;
  isAgentBusy: boolean;
  isVoiceActive?: boolean;
  isFocusTimerActive?: boolean;
  cameraPreset: CameraPreset;
  scrollProgress?: number;
  orbitSpeed: number;
  ringExpansion: number;
  onSelectTaskFrom3D?: (task: StudyTask) => void;
}

// Pre-allocated math objects outside animation loop (Zero-GC render loop)
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3(0, 0, 0);
const _pointerNDC = new THREE.Vector2();
const _tempVec = new THREE.Vector3();

function createChromeCyberArm(
  chromeMat: THREE.MeshStandardMaterial,
  darkAlloyMat: THREE.MeshStandardMaterial,
  cyanGlowMat: THREE.MeshBasicMaterial,
  side: 'left' | 'right'
): {
  root: THREE.Group;
  upperPincer: THREE.Group;
  lowerPincer: THREE.Group;
  wristGroup: THREE.Group;
} {
  const root = new THREE.Group();

  const railGeo = new THREE.CylinderGeometry(0.065, 0.085, 2.2, 24);
  railGeo.rotateZ(Math.PI / 2);

  const topRail = new THREE.Mesh(railGeo, chromeMat);
  topRail.position.set(0, 0.16, 0);
  root.add(topRail);

  const bottomRail = new THREE.Mesh(railGeo, chromeMat);
  bottomRail.position.set(0, -0.16, 0);
  root.add(bottomRail);

  const coreGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.85, 24);
  coreGeo.rotateZ(Math.PI / 2);
  const coreMesh = new THREE.Mesh(coreGeo, darkAlloyMat);
  root.add(coreMesh);

  const collarGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.14, 28);
  collarGeo.rotateZ(Math.PI / 2);
  [-0.65, 0.15, 0.78].forEach((xPos) => {
    const collar = new THREE.Mesh(collarGeo, chromeMat);
    collar.position.set(xPos, 0, 0);
    root.add(collar);
  });

  const conduitGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.9, 12);
  conduitGeo.rotateZ(Math.PI / 2);
  const conduit = new THREE.Mesh(conduitGeo, cyanGlowMat);
  conduit.position.set(0, 0, 0.14);
  root.add(conduit);

  const wristGroup = new THREE.Group();
  const dir = side === 'left' ? 1 : -1;
  wristGroup.position.set(dir * 1.08, 0, 0);
  root.add(wristGroup);

  const knuckleGeo = new THREE.SphereGeometry(0.2, 28, 28);
  const knuckle = new THREE.Mesh(knuckleGeo, darkAlloyMat);
  wristGroup.add(knuckle);

  const knuckleRingGeo = new THREE.TorusGeometry(0.22, 0.035, 16, 36);
  knuckleRingGeo.rotateY(Math.PI / 2);
  const knuckleRing = new THREE.Mesh(knuckleRingGeo, chromeMat);
  wristGroup.add(knuckleRing);

  const upperPincer = new THREE.Group();
  const lowerPincer = new THREE.Group();
  wristGroup.add(upperPincer);
  wristGroup.add(lowerPincer);

  const fingerCurveGeo = new THREE.CylinderGeometry(0.032, 0.058, 0.95, 20);
  fingerCurveGeo.rotateZ(Math.PI / 2);

  const upperFinger = new THREE.Mesh(fingerCurveGeo, chromeMat);
  upperFinger.position.set(dir * 0.45, 0.16, 0);
  upperFinger.rotation.z = dir * -0.22;
  upperPincer.add(upperFinger);

  const lowerFinger = new THREE.Mesh(fingerCurveGeo, chromeMat);
  lowerFinger.position.set(dir * 0.45, -0.16, 0);
  lowerFinger.rotation.z = dir * 0.22;
  lowerPincer.add(lowerFinger);

  if (side === 'right') {
    const tineGeo = new THREE.CylinderGeometry(0.018, 0.035, 1.15, 16);
    tineGeo.rotateZ(Math.PI / 2);
    [-0.14, 0.14].forEach((zOff) => {
      const tine = new THREE.Mesh(tineGeo, chromeMat);
      tine.position.set(dir * 0.52, 0.04, zOff);
      tine.rotation.y = zOff * 0.35;
      upperPincer.add(tine);
    });
  }

  const tipGeo = new THREE.SphereGeometry(0.055, 16, 16);
  const tipMesh = new THREE.Mesh(tipGeo, cyanGlowMat);
  tipMesh.position.set(dir * 0.88, 0, 0);
  wristGroup.add(tipMesh);

  return { root, upperPincer, lowerPincer, wristGroup };
}

export function NeuralOrbScene3D({
  tasks,
  progress,
  isAgentBusy,
  isVoiceActive = false,
  isFocusTimerActive = false,
  cameraPreset,
  scrollProgress = 0,
  orbitSpeed,
  ringExpansion,
  onSelectTaskFrom3D,
}: NeuralOrbScene3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef({
    tasks,
    progress,
    isAgentBusy,
    isVoiceActive,
    isFocusTimerActive,
    cameraPreset,
    scrollProgress,
    orbitSpeed,
    ringExpansion,
    onSelectTaskFrom3D,
  });

  useEffect(() => {
    stateRef.current = {
      tasks,
      progress,
      isAgentBusy,
      isVoiceActive,
      isFocusTimerActive,
      cameraPreset,
      scrollProgress,
      orbitSpeed,
      ringExpansion,
      onSelectTaskFrom3D,
    };
  }, [
    tasks,
    progress,
    isAgentBusy,
    isVoiceActive,
    isFocusTimerActive,
    cameraPreset,
    scrollProgress,
    orbitSpeed,
    ringExpansion,
    onSelectTaskFrom3D,
  ]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.15, 9.0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTexture = pmremGenerator.fromScene(roomEnv, 0.03).texture;
    scene.environment = envTexture;

    const ambientLight = new THREE.AmbientLight(0xdbeafe, 1.35);
    scene.add(ambientLight);

    const mainKeyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    mainKeyLight.position.set(5, 8, 7);
    scene.add(mainKeyLight);

    const cyanRimLight = new THREE.DirectionalLight(0x38bdf8, 2.6);
    cyanRimLight.position.set(-7, -4, 5);
    scene.add(cyanRimLight);

    const corePointLight = new THREE.PointLight(0x0ea5e9, 4.5, 12);
    corePointLight.position.set(0, 0, 0);
    scene.add(corePointLight);

    const sculptureGroup = new THREE.Group();
    scene.add(sculptureGroup);

    const capsuleClusterGroup = new THREE.Group();
    sculptureGroup.add(capsuleClusterGroup);

    const innerCoreGeo = new THREE.SphereGeometry(0.68, 48, 48);
    const innerCoreMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.4,
      roughness: 0.15,
      metalness: 0.3,
    });
    const innerCoreMesh = new THREE.Mesh(innerCoreGeo, innerCoreMat);
    capsuleClusterGroup.add(innerCoreMesh);

    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.95,
      roughness: 0.08,
    });
    const innerRingGeo = new THREE.TorusGeometry(0.95, 0.022, 16, 96);
    const innerRing1 = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing1.rotation.set(0.6, 0.4, 0);
    capsuleClusterGroup.add(innerRing1);

    const innerRing2 = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing2.rotation.set(-0.5, 0.8, 0.4);
    capsuleClusterGroup.add(innerRing2);

    const glassCapsuleGeo = new RoundedBoxGeometry(1.52, 1.38, 1.38, 8, 0.38);

    const capsuleConfigs: Array<{
      basePos: THREE.Vector3;
      baseRot: THREE.Euler;
      scale: THREE.Vector3;
    }> = [
      {
        basePos: new THREE.Vector3(-0.72, 0.64, 0.48),
        baseRot: new THREE.Euler(0.32, 0.45, -0.18),
        scale: new THREE.Vector3(1.05, 0.96, 0.95),
      },
      {
        basePos: new THREE.Vector3(0.76, 0.58, 0.42),
        baseRot: new THREE.Euler(-0.25, 0.62, 0.28),
        scale: new THREE.Vector3(1.08, 1.0, 0.92),
      },
      {
        basePos: new THREE.Vector3(-0.78, -0.58, 0.52),
        baseRot: new THREE.Euler(0.48, -0.35, 0.22),
        scale: new THREE.Vector3(1.0, 0.95, 0.95),
      },
      {
        basePos: new THREE.Vector3(0.72, -0.62, 0.55),
        baseRot: new THREE.Euler(-0.38, -0.48, -0.24),
        scale: new THREE.Vector3(1.04, 0.94, 0.98),
      },
      {
        basePos: new THREE.Vector3(0.0, 0.15, -0.68),
        baseRot: new THREE.Euler(0.15, 0.85, 0.35),
        scale: new THREE.Vector3(1.12, 1.05, 0.92),
      },
      {
        basePos: new THREE.Vector3(0.05, -0.18, 0.82),
        baseRot: new THREE.Euler(-0.18, 0.22, -0.42),
        scale: new THREE.Vector3(0.95, 0.9, 0.88),
      },
    ];

    const glassCapsules: Array<{
      mesh: THREE.Mesh;
      rimMesh: THREE.LineSegments;
      basePos: THREE.Vector3;
      baseRot: THREE.Euler;
      phase: number;
    }> = [];

    const edgesGeo = new THREE.EdgesGeometry(glassCapsuleGeo, 28);

    capsuleConfigs.forEach((cfg, idx) => {
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: idx % 2 === 0 ? 0xe0f2fe : 0xf0f9ff,
        transmission: 0.92,
        opacity: 1,
        transparent: true,
        roughness: 0.05,
        metalness: 0.05,
        ior: 1.46,
        thickness: 2.1,
        specularIntensity: 1.0,
        specularColor: new THREE.Color(0xffffff),
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        envMapIntensity: 2.2,
      });

      const mesh = new THREE.Mesh(glassCapsuleGeo, glassMat);
      mesh.position.copy(cfg.basePos);
      mesh.rotation.copy(cfg.baseRot);
      mesh.scale.copy(cfg.scale);
      mesh.userData = { capsuleIndex: idx };

      const rimMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.28,
      });
      const rimMesh = new THREE.LineSegments(edgesGeo, rimMat);
      mesh.add(rimMesh);

      capsuleClusterGroup.add(mesh);
      glassCapsules.push({
        mesh,
        rimMesh,
        basePos: cfg.basePos.clone(),
        baseRot: cfg.baseRot.clone(),
        phase: idx * 1.15,
      });
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.96,
      roughness: 0.12,
      envMapIntensity: 2.0,
    });
    const darkAlloyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.28,
    });
    const cyanGlowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
    });

    const leftArm = createChromeCyberArm(chromeMat, darkAlloyMat, cyanGlowMat, 'left');
    leftArm.root.position.set(-3.45, 1.38, 0.25);
    leftArm.root.rotation.set(0.12, 0.18, -0.46);
    sculptureGroup.add(leftArm.root);

    const rightArm = createChromeCyberArm(chromeMat, darkAlloyMat, cyanGlowMat, 'right');
    rightArm.root.position.set(3.55, 0.08, 0.15);
    rightArm.root.rotation.set(-0.08, -0.22, 0.14);
    sculptureGroup.add(rightArm.root);

    const dropletGeo = new THREE.SphereGeometry(0.09, 20, 20);
    const dropletMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      transmission: 0.9,
      transparent: true,
      roughness: 0.05,
      ior: 1.4,
    });
    const droplets: Array<{ mesh: THREE.Mesh; basePos: THREE.Vector3; speed: number }> = [];
    const dropletCoords = [
      [-2.1, 0.9, 0.9],
      [2.2, 0.85, 0.7],
      [-1.8, -1.1, 0.6],
      [1.95, -0.95, 0.8],
      [0.2, 1.65, 0.4],
    ];
    dropletCoords.forEach(([x, y, z], i) => {
      const m = new THREE.Mesh(dropletGeo, dropletMat);
      const bp = new THREE.Vector3(x, y, z);
      m.position.copy(bp);
      sculptureGroup.add(m);
      droplets.push({ mesh: m, basePos: bp, speed: 1.2 + i * 0.25 });
    });

    const raycaster = new THREE.Raycaster();
    let pointerX = 0;
    let pointerY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let userYaw = 0;
    let userPitch = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        userYaw += dx * 0.006;
        userPitch = Math.max(-0.5, Math.min(0.5, userPitch + dy * 0.005));
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
    };

    const handlePointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
      isDragging = false;
      if (moved < 6) {
        const rect = renderer.domElement.getBoundingClientRect();
        _pointerNDC.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(_pointerNDC, camera);
        const targets = glassCapsules.map((c) => c.mesh);
        const hits = raycaster.intersectObjects(targets, false);
        if (hits.length > 0) {
          const idx = hits[0].object.userData?.capsuleIndex ?? 0;
          const currentTasks = stateRef.current.tasks;
          if (currentTasks.length > 0 && stateRef.current.onSelectTaskFrom3D) {
            const targetTask = currentTasks[idx % currentTasks.length];
            stateRef.current.onSelectTaskFrom3D(targetTask);
          }
        }
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointermove', handlePointerMove);
    domElem.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const timer = new THREE.Timer();
    let animFrameId = 0;

    const animate = (timestamp?: number) => {
      animFrameId = requestAnimationFrame(animate);
      timer.update(timestamp);
      const elapsed = timer.getElapsed();
      const {
        isAgentBusy: busy,
        isVoiceActive: voiceActive = false,
        isFocusTimerActive: focusActive = false,
        cameraPreset: preset,
        scrollProgress: scroll = 0,
        orbitSpeed: speed,
        ringExpansion: expansion,
      } = stateRef.current;

      // Scroll-driven + Preset camera choreography across Home -> Study Planner -> My Tasks -> Activity -> Advantages
      const scrollAngle = scroll * Math.PI * 1.4;
      const scrollCamX = Math.sin(scrollAngle) * 0.85;
      const scrollCamY = 0.1 + Math.sin(scroll * Math.PI * 2) * 0.45;
      const scrollCamZ = 8.8 - Math.sin(scroll * Math.PI) * 0.9;

      if (preset === 'hero_home') {
        _targetCamPos.set(scrollCamX, scrollCamY, scrollCamZ);
        _targetLookAt.set(0, -0.05, 0);
      } else if (preset === 'planner_focus') {
        _targetCamPos.set(-0.55 + scrollCamX * 0.4, 0.32, 8.1);
        _targetLookAt.set(0.15, 0.0, 0);
      } else if (preset === 'architecture_grid') {
        _targetCamPos.set(0.45 + scrollCamX * 0.4, 0.38, 8.2);
        _targetLookAt.set(-0.1, -0.15, 0);
      } else if (preset === 'top_matrix') {
        _targetCamPos.set(0.2, 1.85, 7.9);
        _targetLookAt.set(0, 0, 0);
      } else {
        _targetCamPos.set(-0.25, 0.25, 8.6);
        _targetLookAt.set(0, 0, 0);
      }

      camera.position.lerp(_targetCamPos, 0.06);
      _currentLookAt.lerp(_targetLookAt, 0.06);
      camera.lookAt(_currentLookAt);

      // Sculpture rotation driven by scroll progress + preset + mouse parallax
      const presetRotY =
        preset === 'planner_focus'
          ? 0.65
          : preset === 'architecture_grid'
            ? 1.25
            : preset === 'top_matrix'
              ? 1.95
              : preset === 'advantages_wide'
                ? 2.55
                : 0.0;

      const activeSpeedBoost = voiceActive ? 1.8 : focusActive ? 1.35 : 1.0;
      const targetRotY =
        presetRotY +
        scroll * 2.4 +
        userYaw +
        pointerX * 0.18 +
        elapsed * 0.14 * speed * activeSpeedBoost;
      const targetRotX =
        Math.sin(scroll * Math.PI * 2) * 0.28 + userPitch - pointerY * 0.12;

      capsuleClusterGroup.rotation.y = THREE.MathUtils.lerp(
        capsuleClusterGroup.rotation.y,
        targetRotY,
        0.06
      );
      capsuleClusterGroup.rotation.x = THREE.MathUtils.lerp(
        capsuleClusterGroup.rotation.x,
        targetRotX,
        0.06
      );

      // Capsules breathe and expand dynamically as user scrolls down or uses Alexa+ Voice
      const scrollSpread = 1.0 + Math.sin(scroll * Math.PI) * 0.18;
      const acousticWave = voiceActive ? 1.0 + Math.sin(elapsed * 9.5) * 0.12 : 1.0;
      const busyBoost = busy ? 1.18 : 1.0;
      glassCapsules.forEach((cap, idx) => {
        const floatOffset =
          Math.sin(elapsed * (voiceActive ? 5.5 : 1.4) + cap.phase) *
          (voiceActive ? 0.16 : 0.08);
        const spread = expansion * scrollSpread * busyBoost * acousticWave;
        _tempVec.copy(cap.basePos).multiplyScalar(spread);
        _tempVec.y += floatOffset;
        cap.mesh.position.lerp(_tempVec, 0.08);

        cap.mesh.rotation.x = cap.baseRot.x + Math.sin(elapsed * 0.9 + idx) * 0.08 + scroll * 0.4;
        cap.mesh.rotation.y = cap.baseRot.y + Math.cos(elapsed * 0.8 + idx) * 0.08 + scroll * 0.5;
      });

      const pulseFreq = voiceActive ? 11.0 : busy ? 5.0 : focusActive ? 3.5 : 2.0;
      const coreScale = 1 + Math.sin(elapsed * pulseFreq) * (voiceActive ? 0.22 : 0.07);
      innerCoreMesh.scale.setScalar(coreScale);
      innerCoreMat.emissiveIntensity = voiceActive
        ? 2.4 + Math.sin(elapsed * 12) * 0.8
        : focusActive
          ? 1.9
          : 1.4;
      innerRing1.rotation.z = elapsed * (focusActive ? 1.6 : 0.7) + scroll * 3.0;
      innerRing2.rotation.x = -elapsed * (focusActive ? 1.3 : 0.55) - scroll * 2.5;

      // Chrome Cybernetic Arms articulate smoothly as you scroll through sections
      const armReach = Math.sin(scroll * Math.PI * 2) * 0.35 + (busy ? 0.4 : 0.0);
      const armTilt = Math.cos(scroll * Math.PI) * 0.15;

      leftArm.root.position.x = THREE.MathUtils.lerp(
        leftArm.root.position.x,
        -3.45 + armReach + pointerX * 0.12,
        0.06
      );
      leftArm.root.position.y = THREE.MathUtils.lerp(
        leftArm.root.position.y,
        1.38 - scroll * 0.55 + Math.sin(elapsed * 1.5) * 0.06,
        0.06
      );
      leftArm.root.rotation.z = THREE.MathUtils.lerp(
        leftArm.root.rotation.z,
        -0.46 + scroll * 0.28,
        0.06
      );
      leftArm.wristGroup.rotation.z = Math.sin(elapsed * 1.8) * 0.12 + armTilt;
      const pincerOpen = 0.08 + Math.sin(elapsed * (busy ? 6 : 2) + scroll * 4) * 0.05;
      leftArm.upperPincer.rotation.z = pincerOpen;
      leftArm.lowerPincer.rotation.z = -pincerOpen;

      rightArm.root.position.x = THREE.MathUtils.lerp(
        rightArm.root.position.x,
        3.55 - armReach + pointerX * 0.12,
        0.06
      );
      rightArm.root.position.y = THREE.MathUtils.lerp(
        rightArm.root.position.y,
        0.08 + scroll * 0.45 + Math.cos(elapsed * 1.4) * 0.06,
        0.06
      );
      rightArm.root.rotation.z = THREE.MathUtils.lerp(
        rightArm.root.rotation.z,
        0.14 - scroll * 0.22,
        0.06
      );
      rightArm.wristGroup.rotation.y = Math.cos(elapsed * 1.6) * 0.14 - armTilt;
      rightArm.upperPincer.rotation.z = -pincerOpen;
      rightArm.lowerPincer.rotation.z = pincerOpen;

      droplets.forEach((d, idx) => {
        d.mesh.position.y = d.basePos.y + Math.sin(elapsed * d.speed + idx + scroll * 3) * 0.14;
      });

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
      domElem.removeEventListener('pointermove', handlePointerMove);
      domElem.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      glassCapsuleGeo.dispose();
      edgesGeo.dispose();
      innerCoreGeo.dispose();
      innerCoreMat.dispose();
      innerRingGeo.dispose();
      innerRingMat.dispose();
      chromeMat.dispose();
      darkAlloyMat.dispose();
      cyanGlowMat.dispose();
      dropletGeo.dispose();
      dropletMat.dispose();
      envTexture.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="relative h-full w-full select-none overflow-hidden"
      style={{
        background:
          'linear-gradient(125deg, #8A96A3 0%, #96A3B0 32%, #76B4DC 72%, #479BE1 100%)',
      }}
      aria-label="Interactive 3D Aero-Glass Capsule Cluster and Chrome Cybernetic Study Core"
    />
  );
}
