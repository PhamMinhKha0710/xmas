import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  PerspectiveCamera,
  shaderMaterial,
  Float,
  Stars,
  Sparkles,
  useTexture
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { MathUtils } from 'three';
import * as random from 'maath/random';
import { GestureRecognizer, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

// --- Tạo động danh sách ảnh (top.png + 1.png đến 31.png) ---
const TOTAL_NUMBERED_PHOTOS = 31;
// Sửa đổi: Thêm top.png vào đầu mảng
const bodyPhotoPaths = [
  '/photos/top.png',
  ...Array.from({ length: TOTAL_NUMBERED_PHOTOS }, (_, i) => `/photos/${i + 1}.png`)
];

// --- Cấu hình thị giác ---
const CONFIG = {
  colors: {
    emerald: '#004225', // Màu lục bảo nguyên chất
    gold: '#FFD700',
    silver: '#ECEFF1',
    red: '#D32F2F',
    green: '#2E7D32',
    white: '#FFFFFF',   // Màu trắng nguyên chất
    warmLight: '#FFD54F',
    lights: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'], // Đèn màu
    // Hồ màu viền Polaroid (gam màu cổ điển nhẹ nhàng)
    borders: ['#FFFAF0', '#F0E68C', '#E6E6FA', '#FFB6C1', '#98FB98', '#87CEFA', '#FFDAB9'],
    // Màu sắc yếu tố Giáng sinh
    giftColors: ['#D32F2F', '#FFD700', '#1976D2', '#2E7D32'],
    candyColors: ['#FF0000', '#FFFFFF']
  },
  counts: {
    foliage: 15000,
    ornaments: 300,   // Số lượng ảnh Polaroid
    elements: 200,    // Số lượng yếu tố Giáng sinh
    lights: 400       // Số lượng đèn màu
  },
  tree: { height: 22, radius: 9 }, // Kích thước thân cây
  photos: {
    // Thuộc tính top không còn cần thiết, vì đã chuyển vào body
    body: bodyPhotoPaths
  }
};

// --- Shader Material (Foliage) ---
const FoliageMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color(CONFIG.colors.emerald), uProgress: 0 },
  `uniform float uTime; uniform float uProgress; attribute vec3 aTargetPos; attribute float aRandom;
  varying vec2 vUv; varying float vMix;
  float cubicInOut(float t) { return t < 0.5 ? 4.0 * t * t * t : 0.5 * pow(2.0 * t - 2.0, 3.0) + 1.0; }
  void main() {
    vUv = uv;
    vec3 noise = vec3(sin(uTime * 1.5 + position.x), cos(uTime + position.y), sin(uTime * 1.5 + position.z)) * 0.15;
    float t = cubicInOut(uProgress);
    vec3 finalPos = mix(position, aTargetPos + noise, t);
    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_PointSize = (60.0 * (1.0 + aRandom)) / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    vMix = t;
  }`,
  `uniform vec3 uColor; varying float vMix;
  void main() {
    float r = distance(gl_PointCoord, vec2(0.5)); if (r > 0.5) discard;
    vec3 finalColor = mix(uColor * 0.3, uColor * 1.2, vMix);
    gl_FragColor = vec4(finalColor, 1.0);
  }`
);
extend({ FoliageMaterial });

// --- Helper: Hình dạng cây ---
const getTreePosition = () => {
  const h = CONFIG.tree.height; const rBase = CONFIG.tree.radius;
  const y = (Math.random() * h) - (h / 2); const normalizedY = (y + (h/2)) / h;
  const currentRadius = rBase * (1 - normalizedY); const theta = Math.random() * Math.PI * 2;
  const r = Math.random() * currentRadius;
  return [r * Math.cos(theta), y, r * Math.sin(theta)];
};

// --- Component: Trang trí ảnh (Polaroid hai mặt) với hỗ trợ EXPLODE/PHOTO ---
const PhotoOrnaments = ({ state, selectedPhotoIndex, camera }: { state: 'CHAOS' | 'FORMED' | 'HEART' | 'EXPLODE' | 'PHOTO', selectedPhotoIndex?: number, camera?: THREE.Camera }) => {
  const textures = useTexture(CONFIG.photos.body);
  const count = CONFIG.counts.ornaments;
  const groupRef = useRef<THREE.Group>(null);
  const orbitRadius = 25;

  const borderGeometry = useMemo(() => new THREE.PlaneGeometry(1.2, 1.5), []);
  const photoGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const chaosPos = new THREE.Vector3((Math.random()-0.5)*70, (Math.random()-0.5)*70, (Math.random()-0.5)*70);
      const h = CONFIG.tree.height; const y = (Math.random() * h) - (h / 2);
      const rBase = CONFIG.tree.radius;
      const currentRadius = (rBase * (1 - (y + (h/2)) / h)) + 0.5;
      const theta = Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(currentRadius * Math.cos(theta), y, currentRadius * Math.sin(theta));

      // Orbit position for EXPLODE mode
      const orbitAngle = (i / count) * Math.PI * 2;
      const orbitPos = new THREE.Vector3(
        Math.sin(orbitAngle) * orbitRadius,
        Math.sin(i * 0.5) * 3,
        Math.cos(orbitAngle) * orbitRadius
      );

      const isBig = Math.random() < 0.2;
      const baseScale = isBig ? 2.2 : 0.8 + Math.random() * 0.6;
      const weight = 0.8 + Math.random() * 1.2;
      const borderColor = CONFIG.colors.borders[Math.floor(Math.random() * CONFIG.colors.borders.length)];

      const rotationSpeed = {
        x: (Math.random() - 0.5) * 1.0,
        y: (Math.random() - 0.5) * 1.0,
        z: (Math.random() - 0.5) * 1.0
      };
      const chaosRotation = new THREE.Euler(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);

      return {
        chaosPos, targetPos, orbitPos, scale: baseScale, weight,
        textureIndex: i % textures.length,
        borderColor,
        currentPos: chaosPos.clone(),
        chaosRotation,
        rotationSpeed,
        wobbleOffset: Math.random() * 10,
        wobbleSpeed: 0.5 + Math.random() * 0.5,
        orbitAngle
      };
    });
  }, [textures, count]);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    const time = stateObj.clock.elapsedTime;
    let target: THREE.Vector3;
    let targetScale: number;

    if (state === 'FORMED') {
      groupRef.current.children.forEach((group, i) => {
        const objData = data[i];
        target = objData.targetPos;
        targetScale = objData.scale;
        objData.currentPos.lerp(target, delta * 0.8 * objData.weight);
        group.position.copy(objData.currentPos);
        group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 2);

        const targetLookPos = new THREE.Vector3(group.position.x * 2, group.position.y + 0.5, group.position.z * 2);
        group.lookAt(targetLookPos);
        const wobbleX = Math.sin(time * objData.wobbleSpeed + objData.wobbleOffset) * 0.05;
        const wobbleZ = Math.cos(time * objData.wobbleSpeed * 0.8 + objData.wobbleOffset) * 0.05;
        group.rotation.x += wobbleX;
        group.rotation.z += wobbleZ;
      });
    } else if (state === 'EXPLODE') {
      const baseAngle = groupRef.current.rotation.y;
      groupRef.current.rotation.y += delta * 0.3;

      groupRef.current.children.forEach((group, i) => {
        const objData = data[i];
        const angle = baseAngle + objData.orbitAngle;
        const orbitPos = new THREE.Vector3(
          Math.sin(angle) * orbitRadius,
          Math.sin(time + i) * 3,
          Math.cos(angle) * orbitRadius
        );
        target = orbitPos;
        objData.currentPos.lerp(target, delta * 2);
        group.position.copy(objData.currentPos);
        if (camera) group.lookAt(camera.position);

        const z = group.position.z;
        targetScale = z > 5 ? 0.6 + (z / orbitRadius) * 0.8 : 0.6;
        group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 2);
      });
    } else if (state === 'PHOTO' && selectedPhotoIndex !== undefined) {
      groupRef.current.children.forEach((group, i) => {
        const objData = data[i];
        if (i === selectedPhotoIndex) {
          target = new THREE.Vector3(0, 0, 60);
          targetScale = 5;
          objData.currentPos.lerp(target, delta * 2);
          group.position.copy(objData.currentPos);
          group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 2);
          if (camera) {
            group.lookAt(camera.position);
            group.rotation.z = 0;
          }
        } else {
          targetScale = 0;
          group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 3);
        }
      });
    } else {
      // CHAOS or HEART
      groupRef.current.children.forEach((group, i) => {
        const objData = data[i];
        target = objData.chaosPos;
        targetScale = 0;
        objData.currentPos.lerp(target, delta * 0.5);
        group.position.copy(objData.currentPos);
        group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 2);
        group.rotation.x += delta * objData.rotationSpeed.x;
        group.rotation.y += delta * objData.rotationSpeed.y;
        group.rotation.z += delta * objData.rotationSpeed.z;
      });
    }
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => (
        <group key={i} scale={state === 'PHOTO' && i !== selectedPhotoIndex ? [0, 0, 0] : [obj.scale, obj.scale, obj.scale]} rotation={state === 'CHAOS' || state === 'HEART' ? obj.chaosRotation : [0,0,0]}>
          {/* 正面 */}
          <group position={[0, 0, 0.015]}>
            <mesh geometry={photoGeometry}>
              <meshStandardMaterial
                map={textures[obj.textureIndex]}
                roughness={0.5} metalness={0}
                emissive={CONFIG.colors.white} emissiveMap={textures[obj.textureIndex]} emissiveIntensity={1.0}
                side={THREE.FrontSide}
              />
            </mesh>
            <mesh geometry={borderGeometry} position={[0, -0.15, -0.01]}>
              <meshStandardMaterial color={obj.borderColor} roughness={0.9} metalness={0} side={THREE.FrontSide} />
            </mesh>
          </group>
          {/* 背面 */}
          <group position={[0, 0, -0.015]} rotation={[0, Math.PI, 0]}>
            <mesh geometry={photoGeometry}>
              <meshStandardMaterial
                map={textures[obj.textureIndex]}
                roughness={0.5} metalness={0}
                emissive={CONFIG.colors.white} emissiveMap={textures[obj.textureIndex]} emissiveIntensity={1.0}
                side={THREE.FrontSide}
              />
            </mesh>
            <mesh geometry={borderGeometry} position={[0, -0.15, -0.01]}>
              <meshStandardMaterial color={obj.borderColor} roughness={0.9} metalness={0} side={THREE.FrontSide} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
};

// --- Component: Yếu tố Giáng sinh ---
const ChristmasElements = ({ state }: { state: 'CHAOS' | 'FORMED' | 'HEART' | 'EXPLODE' | 'PHOTO' }) => {
  const count = CONFIG.counts.elements;
  const groupRef = useRef<THREE.Group>(null);

  const boxGeometry = useMemo(() => new THREE.BoxGeometry(0.8, 0.8, 0.8), []);
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(0.5, 16, 16), []);
  const caneGeometry = useMemo(() => new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      const chaosPos = new THREE.Vector3((Math.random()-0.5)*60, (Math.random()-0.5)*60, (Math.random()-0.5)*60);
      const h = CONFIG.tree.height;
      const y = (Math.random() * h) - (h / 2);
      const rBase = CONFIG.tree.radius;
      const currentRadius = (rBase * (1 - (y + (h/2)) / h)) * 0.95;
      const theta = Math.random() * Math.PI * 2;

      const targetPos = new THREE.Vector3(currentRadius * Math.cos(theta), y, currentRadius * Math.sin(theta));

      const type = Math.floor(Math.random() * 3);
      let color; let scale = 1;
      if (type === 0) { color = CONFIG.colors.giftColors[Math.floor(Math.random() * CONFIG.colors.giftColors.length)]; scale = 0.8 + Math.random() * 0.4; }
      else if (type === 1) { color = CONFIG.colors.giftColors[Math.floor(Math.random() * CONFIG.colors.giftColors.length)]; scale = 0.6 + Math.random() * 0.4; }
      else { color = Math.random() > 0.5 ? CONFIG.colors.red : CONFIG.colors.white; scale = 0.7 + Math.random() * 0.3; }

      const rotationSpeed = { x: (Math.random()-0.5)*2.0, y: (Math.random()-0.5)*2.0, z: (Math.random()-0.5)*2.0 };
      return { type, chaosPos, targetPos, color, scale, currentPos: chaosPos.clone(), chaosRotation: new THREE.Euler(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI), rotationSpeed };
    });
  }, [boxGeometry, sphereGeometry, caneGeometry]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED';
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const objData = data[i];
      const target = isFormed ? objData.targetPos : objData.chaosPos;
      objData.currentPos.lerp(target, delta * 1.5);
      mesh.position.copy(objData.currentPos);
      mesh.rotation.x += delta * objData.rotationSpeed.x; mesh.rotation.y += delta * objData.rotationSpeed.y; mesh.rotation.z += delta * objData.rotationSpeed.z;
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => {
        let geometry; if (obj.type === 0) geometry = boxGeometry; else if (obj.type === 1) geometry = sphereGeometry; else geometry = caneGeometry;
        return ( <mesh key={i} scale={[obj.scale, obj.scale, obj.scale]} geometry={geometry} rotation={obj.chaosRotation}>
          <meshStandardMaterial color={obj.color} roughness={0.3} metalness={0.4} emissive={obj.color} emissiveIntensity={0.2} />
        </mesh> )})}
    </group>
  );
};

// --- Component: Đèn tiên ---
const FairyLights = ({ state }: { state: 'CHAOS' | 'FORMED' | 'HEART' | 'EXPLODE' | 'PHOTO' }) => {
  const count = CONFIG.counts.lights;
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.8, 8, 8), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      const chaosPos = new THREE.Vector3((Math.random()-0.5)*60, (Math.random()-0.5)*60, (Math.random()-0.5)*60);
      const h = CONFIG.tree.height; const y = (Math.random() * h) - (h / 2); const rBase = CONFIG.tree.radius;
      const currentRadius = (rBase * (1 - (y + (h/2)) / h)) + 0.3; const theta = Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(currentRadius * Math.cos(theta), y, currentRadius * Math.sin(theta));
      const color = CONFIG.colors.lights[Math.floor(Math.random() * CONFIG.colors.lights.length)];
      const speed = 2 + Math.random() * 3;
      return { chaosPos, targetPos, color, speed, currentPos: chaosPos.clone(), timeOffset: Math.random() * 100 };
    });
  }, []);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED';
    const time = stateObj.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const objData = data[i];
      const target = isFormed ? objData.targetPos : objData.chaosPos;
      objData.currentPos.lerp(target, delta * 2.0);
      const mesh = child as THREE.Mesh;
      mesh.position.copy(objData.currentPos);
      const intensity = (Math.sin(time * objData.speed + objData.timeOffset) + 1) / 2;
      if (mesh.material) { (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = isFormed ? 3 + intensity * 4 : 0; }
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => ( <mesh key={i} scale={[0.15, 0.15, 0.15]} geometry={geometry}>
          <meshStandardMaterial color={obj.color} emissive={obj.color} emissiveIntensity={0} toneMapped={false} />
        </mesh> ))}
    </group>
  );
};

// --- Component: Ngôi sao trên đỉnh (Không có ảnh, Ngôi sao vàng 3D nguyên chất) ---
const TopStar = ({ state }: { state: 'CHAOS' | 'FORMED' | 'HEART' | 'EXPLODE' | 'PHOTO' }) => {
  const groupRef = useRef<THREE.Group>(null);

  const starShape = useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = 1.3; const innerRadius = 0.7; const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      i === 0 ? shape.moveTo(radius*Math.cos(angle), radius*Math.sin(angle)) : shape.lineTo(radius*Math.cos(angle), radius*Math.sin(angle));
    }
    shape.closePath();
    return shape;
  }, []);

  const starGeometry = useMemo(() => {
    return new THREE.ExtrudeGeometry(starShape, {
      depth: 0.4, // 增加一点厚度
      bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3,
    });
  }, [starShape]);

  // 纯金材质
  const goldMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: CONFIG.colors.gold,
    emissive: CONFIG.colors.gold,
    emissiveIntensity: 1.5, // 适中亮度，既发光又有质感
    roughness: 0.1,
    metalness: 1.0,
  }), []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
      const targetScale = state === 'FORMED' ? 1 : 0;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 3);
    }
  });

  return (
    <group ref={groupRef} position={[0, CONFIG.tree.height / 2 + 1.8, 0]}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
        <mesh geometry={starGeometry} material={goldMaterial} />
      </Float>
    </group>
  );
};

// --- Component: Text "MERRY CHRISTMAS" ---
const MerryChristmasText = ({ visible }: { visible: boolean }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = 'bold italic 90px "Times New Roman"';
      ctx.fillStyle = '#FFD700';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#FF0000';
      ctx.shadowBlur = 40;
      ctx.fillText('MERRY CHRISTMAS', 512, 130);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.visible = visible;
      if (visible) {
        meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        const material = meshRef.current.material as THREE.MeshBasicMaterial;
        if (material) {
          material.opacity = 0.7 + 0.3 * Math.sin(state.clock.elapsedTime * 2);
        }
      } else {
        meshRef.current.scale.lerp(new THREE.Vector3(0, 0, 0), 0.1);
      }
    }
  });

  return (
    <mesh ref={meshRef} position={[0, CONFIG.tree.height / 2 + 8, 0]} scale={[0, 0, 0]}>
      <planeGeometry args={[60, 15]} />
      <meshBasicMaterial map={texture} transparent blending={THREE.AdditiveBlending} />
    </mesh>
  );
};

// --- Component: Text "I LOVE YOU" ---
const LoveText = ({ visible }: { visible: boolean }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = 'bold 120px "Segoe UI", sans-serif';
      ctx.fillStyle = '#FF69B4';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#FF1493';
      ctx.shadowBlur = 40;
      ctx.fillText('I LOVE YOU ❤️', 512, 130);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.visible = visible;
      if (visible) {
        const beatScale = 1 + Math.abs(Math.sin(state.clock.elapsedTime * 3)) * 0.15;
        meshRef.current.scale.set(beatScale, beatScale, 1);
      } else {
        meshRef.current.scale.lerp(new THREE.Vector3(0, 0, 0), 0.1);
      }
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 20]} scale={[0, 0, 0]}>
      <planeGeometry args={[70, 18]} />
      <meshBasicMaterial map={texture} transparent blending={THREE.AdditiveBlending} />
    </mesh>
  );
};

// --- Helper: Heart shape position ---
const getHeartPosition = (index: number, total: number) => {
  const t = (index / total) * Math.PI * 2;
  const hx = 16 * Math.pow(Math.sin(t), 3);
  const hy = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
  const rFill = Math.pow(Math.random(), 0.3);
  const scaleH = 2.2;
  return [
    hx * scaleH * rFill,
    hy * scaleH * rFill + 5,
    (Math.random() - 0.5) * 8 * rFill
  ];
};

// --- Component: Lá cây với hỗ trợ HEART ---
const Foliage = ({ state }: { state: 'CHAOS' | 'FORMED' | 'HEART' }) => {
  const materialRef = useRef<any>(null);
  const { positions, targetPositions, heartPositions, randoms } = useMemo(() => {
    const count = CONFIG.counts.foliage;
    const positions = new Float32Array(count * 3);
    const targetPositions = new Float32Array(count * 3);
    const heartPositions = new Float32Array(count * 3);
    const randoms = new Float32Array(count);
    const spherePoints = random.inSphere(new Float32Array(count * 3), { radius: 25 }) as Float32Array;
    for (let i = 0; i < count; i++) {
      positions[i*3] = spherePoints[i*3];
      positions[i*3+1] = spherePoints[i*3+1];
      positions[i*3+2] = spherePoints[i*3+2];
      const [tx, ty, tz] = getTreePosition();
      targetPositions[i*3] = tx;
      targetPositions[i*3+1] = ty;
      targetPositions[i*3+2] = tz;
      const [hx, hy, hz] = getHeartPosition(i, count);
      heartPositions[i*3] = hx;
      heartPositions[i*3+1] = hy;
      heartPositions[i*3+2] = hz;
      randoms[i] = Math.random();
    }
    return { positions, targetPositions, heartPositions, randoms };
  }, []);
  
  const pointsRef = useRef<THREE.Points>(null);
  
  useFrame((rootState, delta) => {
    if (materialRef.current) {
      materialRef.current.uTime = rootState.clock.elapsedTime;
      let targetProgress = 0;
      if (state === 'FORMED') targetProgress = 1;
      else if (state === 'HEART') targetProgress = 0.5; // Intermediate for heart
      materialRef.current.uProgress = MathUtils.damp(materialRef.current.uProgress, targetProgress, 1.5, delta);
    }
    
    // Update positions for heart shape
    if (state === 'HEART' && pointsRef.current) {
      const geometry = pointsRef.current.geometry;
      const posAttr = geometry.attributes.position;
      const heartAttr = geometry.attributes.aHeartPos;
      if (heartAttr && posAttr) {
        for (let i = 0; i < posAttr.count; i++) {
          const t = materialRef.current?.uProgress || 0.5;
          const currentX = posAttr.array[i*3];
          const currentY = posAttr.array[i*3+1];
          const currentZ = posAttr.array[i*3+2];
          const heartX = heartAttr.array[i*3];
          const heartY = heartAttr.array[i*3+1];
          const heartZ = heartAttr.array[i*3+2];
          posAttr.array[i*3] = THREE.MathUtils.lerp(currentX, heartX, t);
          posAttr.array[i*3+1] = THREE.MathUtils.lerp(currentY, heartY, t);
          posAttr.array[i*3+2] = THREE.MathUtils.lerp(currentZ, heartZ, t);
        }
        posAttr.needsUpdate = true;
      }
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aTargetPos" args={[targetPositions, 3]} />
        <bufferAttribute attach="attributes-aHeartPos" args={[heartPositions, 3]} />
        <bufferAttribute attach="attributes-aRandom" args={[randoms, 1]} />
      </bufferGeometry>
      {/* @ts-ignore */}
      <foliageMaterial ref={materialRef} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

// --- Trải nghiệm cảnh chính ---
const Experience = ({ sceneState, rotationSpeed, selectedPhotoIndex }: { sceneState: 'CHAOS' | 'FORMED' | 'HEART' | 'EXPLODE' | 'PHOTO', rotationSpeed: number, selectedPhotoIndex?: number }) => {
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.setAzimuthalAngle(controlsRef.current.getAzimuthalAngle() + rotationSpeed);
      controlsRef.current.update();
    }
  });

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 8, 60]} fov={45} />
      <OrbitControls ref={controlsRef} enablePan={false} enableZoom={true} minDistance={30} maxDistance={120} autoRotate={rotationSpeed === 0 && sceneState === 'FORMED'} autoRotateSpeed={0.3} maxPolarAngle={Math.PI / 1.7} />

      <color attach="background" args={['#000300']} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <Environment preset="night" background={false} />

      <ambientLight intensity={0.4} color="#003311" />
      <pointLight position={[30, 30, 30]} intensity={100} color={CONFIG.colors.warmLight} />
      <pointLight position={[-30, 10, -30]} intensity={50} color={CONFIG.colors.gold} />
      <pointLight position={[0, -20, 10]} intensity={30} color="#ffffff" />

      <group position={[0, -6, 0]}>
        <Foliage state={sceneState === 'HEART' ? 'HEART' : sceneState === 'FORMED' ? 'FORMED' : 'CHAOS'} />
        <Suspense fallback={null}>
           <PhotoOrnaments state={sceneState} selectedPhotoIndex={selectedPhotoIndex} camera={cameraRef.current || undefined} />
           <ChristmasElements state={sceneState === 'HEART' ? 'CHAOS' : sceneState} />
           <FairyLights state={sceneState === 'HEART' ? 'CHAOS' : sceneState} />
           <TopStar state={sceneState === 'HEART' || sceneState === 'EXPLODE' || sceneState === 'PHOTO' ? 'CHAOS' : sceneState} />
        </Suspense>
        <Sparkles count={600} scale={50} size={8} speed={0.4} opacity={0.4} color={CONFIG.colors.silver} />
      </group>

      {/* Text Components */}
      <MerryChristmasText visible={sceneState === 'FORMED'} />
      <LoveText visible={sceneState === 'HEART'} />

      <EffectComposer>
        <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.1} intensity={1.5} radius={0.5} mipmapBlur />
        <Vignette eskil={false} offset={0.1} darkness={1.2} />
      </EffectComposer>
    </>
  );
};

// --- Bộ điều khiển cử chỉ ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GestureController = ({ onGesture, onMove, onStatus, debugMode, onSelectPhoto, bodyPhotoPaths, selectedPhoto, sceneState }: any) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let gestureRecognizer: GestureRecognizer;
    let requestRef: number;

    const setup = async () => {
      onStatus("ĐANG TẢI AI...");
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2  // Support two hands for heart gesture
        });
        onStatus("ĐANG YÊU CẦU CAMERA...");
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            onStatus("AI SẴN SÀNG: HÃY GIỠ TAY");
            predictWebcam();
          }
        } else {
            onStatus("LỖI: TỪ CHỐI QUYỀN TRUY CẬP CAMERA");
        }
      } catch (err: any) {
        onStatus(`LỖI: ${err.message || 'MÔ HÌNH THẤT BẠI'}`);
      }
    };

    const predictWebcam = () => {
      if (gestureRecognizer && videoRef.current && canvasRef.current) {
        if (videoRef.current.videoWidth > 0) {
            const results = gestureRecognizer.recognizeForVideo(videoRef.current, Date.now());
            const ctx = canvasRef.current.getContext("2d");
            
            // Luôn vẽ camera preview và landmarks
            if (ctx && canvasRef.current) {
                // Chỉ set kích thước canvas một lần khi video sẵn sàng
                if (canvasRef.current.width !== videoRef.current.videoWidth || 
                    canvasRef.current.height !== videoRef.current.videoHeight) {
                    canvasRef.current.width = videoRef.current.videoWidth;
                    canvasRef.current.height = videoRef.current.videoHeight;
                }
                
                // Vẽ video frame trước (nền)
                ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
                
                // Vẽ landmarks với chấm sáng
                if (results.landmarks) {
                    const canvasWidth = canvasRef.current.width;
                    const canvasHeight = canvasRef.current.height;
                    for (const landmarks of results.landmarks) {
                        const drawingUtils = new DrawingUtils(ctx);
                        // Vẽ đường nối với màu vàng sáng
                        drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { 
                            color: "#FFD700", 
                            lineWidth: 2 
                        });
                        // Vẽ landmarks với chấm sáng
                        landmarks.forEach((landmark, idx) => {
                            const x = landmark.x * canvasWidth;
                            const y = landmark.y * canvasHeight;
                            
                            // Tạo hiệu ứng chấm sáng
                            const gradient = ctx.createRadialGradient(x, y, 0, x, y, 8);
                            gradient.addColorStop(0, '#FFFFFF');
                            gradient.addColorStop(0.3, '#FFD700');
                            gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
                            
                            ctx.fillStyle = gradient;
                            ctx.beginPath();
                            ctx.arc(x, y, 8, 0, Math.PI * 2);
                            ctx.fill();
                            
                            // Vẽ điểm trung tâm
                            ctx.fillStyle = idx === 9 ? '#FF0000' : '#00FF00'; // Wrist màu đỏ, các điểm khác màu xanh
                            ctx.beginPath();
                            ctx.arc(x, y, 3, 0, Math.PI * 2);
                            ctx.fill();
                        });
                    }
                }
            }

            // Check for heart gesture (two hands close together)
            if (results.landmarks && results.landmarks.length === 2) {
              const h1 = results.landmarks[0];
              const h2 = results.landmarks[1];
              const distIndex = Math.hypot(h1[8].x - h2[8].x, h1[8].y - h2[8].y);
              const distThumb = Math.hypot(h1[4].x - h2[4].x, h1[4].y - h2[4].y);
              if (distIndex < 0.15 && distThumb < 0.15) {
                onGesture("HEART");
                if (debugMode) onStatus("PHÁT HIỆN: HEART ❤️");
              }
            }

            if (results.gestures.length > 0) {
              const name = results.gestures[0][0].categoryName; const score = results.gestures[0][0].score;
              if (score > 0.4) {
                 if (name === "Open_Palm") onGesture("EXPLODE");
                 if (name === "Closed_Fist") onGesture("FORMED");
                 if (name === "Pointing_Up") {
                   // Chuyển sang chế độ PHOTO và chọn ảnh dựa trên vị trí tay
                   onGesture("PHOTO");
                 }
                 if (name === "Thumb_Up") {
                   onGesture("FORMED");
                   onSelectPhoto(undefined);
                 }
                 if (debugMode) onStatus(`PHÁT HIỆN: ${name}`);
              }
              if (results.landmarks.length > 0) {
                const wristX = results.landmarks[0][9].x; // Wrist position (0-1)
                
                if (sceneState === 'PHOTO' || name === "Pointing_Up") {
                  // Ở chế độ PHOTO: điều khiển chọn ảnh bằng tay trái/phải
                  // Tay sang phải (x > 0.5): ảnh 1-15
                  // Tay sang trái (x < 0.5): ảnh 15-31
                  let photoIndex: number;
                  if (wristX > 0.5) {
                    // Tay phải: ảnh từ 1 đến 15 (index 1-15 trong mảng, bỏ qua top.png ở index 0)
                    photoIndex = Math.floor((wristX - 0.5) * 2 * 15) + 1;
                    photoIndex = Math.min(Math.max(photoIndex, 1), 15);
                  } else {
                    // Tay trái: ảnh từ 16 đến 31 (index 16-31 trong mảng)
                    photoIndex = Math.floor(wristX * 2 * 16) + 16;
                    photoIndex = Math.min(Math.max(photoIndex, 16), 31);
                  }
                  onSelectPhoto(photoIndex);
                  onGesture("PHOTO");
                } else {
                  // Chế độ khác: điều khiển xoay cây
                  const speed = (0.5 - wristX) * 0.15;
                  onMove(Math.abs(speed) > 0.01 ? speed : 0);
                }
              }
            } else { 
              onMove(0); 
              if (debugMode) onStatus("AI SẴN SÀNG: KHÔNG CÓ TAY"); 
            }
        }
        requestRef = requestAnimationFrame(predictWebcam);
      }
    };
    setup();
    return () => {
      if (requestRef) cancelAnimationFrame(requestRef);
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onGesture, onMove, onStatus, debugMode, onSelectPhoto, bodyPhotoPaths, selectedPhoto, sceneState]);

  return (
    <>
      <video ref={videoRef} style={{ 
        opacity: 0, 
        position: 'fixed', 
        top: 0, 
        right: 0, 
        width: '1px', 
        zIndex: -1, 
        pointerEvents: 'none', 
        transform: 'scaleX(-1)' 
      }} playsInline muted autoPlay />
      <canvas ref={canvasRef} style={{ 
        position: 'fixed', 
        top: '15px', 
        right: '15px', 
        width: '320px', 
        height: '240px', 
        zIndex: 100, 
        pointerEvents: 'none', 
        transform: 'scaleX(-1)',
        border: '3px solid rgba(255, 215, 0, 0.8)',
        borderRadius: '12px',
        boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
        backgroundColor: '#000',
        imageRendering: 'auto',
        willChange: 'contents'
      }} />
    </>
  );
};

// --- Điểm vào ứng dụng ---
export default function GrandTreeApp() {
  const [sceneState, setSceneState] = useState<'CHAOS' | 'FORMED' | 'HEART' | 'EXPLODE' | 'PHOTO'>('CHAOS');
  const [rotationSpeed, setRotationSpeed] = useState(0);
  const [aiStatus, setAiStatus] = useState("CHƯA BẮT ĐẦU");
  const [debugMode, setDebugMode] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | undefined>(undefined);
  const [isStarted, setIsStarted] = useState(false);
  const [photoTransition, setPhotoTransition] = useState<'fadeIn' | 'fadeOut' | 'none'>('none');
  const [prevPhotoIndex, setPrevPhotoIndex] = useState<number | undefined>(undefined);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | 'none'>('none');

  // Nhạc nền
  useEffect(() => {
    if (isStarted) {
      const bgMusic = new Audio('/audio.mp3');
      bgMusic.loop = true;
      bgMusic.volume = 0.5;
      bgMusic.play().catch(err => console.log('Không thể play nhạc:', err));
    }
  }, [isStarted]);

  // Hiệu ứng chuyển đổi ảnh
  useEffect(() => {
    if (selectedPhotoIndex !== undefined && selectedPhotoIndex !== prevPhotoIndex && prevPhotoIndex !== undefined) {
      // Xác định hướng slide dựa trên việc ảnh tăng hay giảm
      const direction = selectedPhotoIndex > prevPhotoIndex ? 'right' : 'left';
      setSlideDirection(direction);
      setPhotoTransition('fadeOut');
      setTimeout(() => {
        setPrevPhotoIndex(selectedPhotoIndex);
        setPhotoTransition('fadeIn');
        setTimeout(() => {
          setPhotoTransition('none');
          setSlideDirection('none');
        }, 400);
      }, 200);
    } else if (selectedPhotoIndex !== undefined && prevPhotoIndex === undefined) {
      // Lần đầu hiển thị
      setPrevPhotoIndex(selectedPhotoIndex);
      setPhotoTransition('fadeIn');
      setTimeout(() => {
        setPhotoTransition('none');
      }, 400);
    }
  }, [selectedPhotoIndex, prevPhotoIndex]);

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000', position: 'relative', overflow: 'hidden' }}>
      {!isStarted ? (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', backgroundColor: '#000' }}>
          <h1 style={{ color: '#FFD700', fontSize: '3rem', marginBottom: '20px' }}>🎄 Cây Thông Noel Ma Thuật</h1>
          <button onClick={() => setIsStarted(true)} style={{
            background: 'linear-gradient(to bottom, #D32F2F, #8B0000)', 
            color: '#FFF', border: '2px solid #FFD700',
            padding: '15px 50px', borderRadius: '30px', 
            fontWeight: '800', fontSize: '16px',
            boxShadow: '0 0 30px rgba(255, 0, 0, 0.6)',
            cursor: 'pointer'
          }}>
            BẮT ĐẦU MA THUẬT
          </button>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '20px', textAlign: 'center', maxWidth: '800px', lineHeight: '1.8' }}>
            🖐 <b>Mở tay:</b> Quỹ đạo ảnh &nbsp;|&nbsp; ✊ <b>Siết nắm đấm:</b> Tập hợp cây &nbsp;|&nbsp; 👋 <b>Chỉ tay:</b> Phóng to ảnh &nbsp;|&nbsp; ❤️ <b>Hai tay trái tim:</b> Hình trái tim
          </p>
        </div>
      ) : (
        <React.Fragment>
          <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
            <Canvas dpr={[1, 2]} gl={{ toneMapping: THREE.ReinhardToneMapping }} shadows>
                <Experience sceneState={sceneState} rotationSpeed={rotationSpeed} selectedPhotoIndex={selectedPhotoIndex} />
            </Canvas>
          </div>
          <GestureController onGesture={setSceneState} onMove={setRotationSpeed} onStatus={setAiStatus} debugMode={debugMode} onSelectPhoto={setSelectedPhotoIndex} bodyPhotoPaths={bodyPhotoPaths} selectedPhoto={selectedPhotoIndex} sceneState={sceneState} />

      {/* UI - Thống kê */}
      <div style={{ position: 'absolute', bottom: '30px', left: '40px', color: '#888', zIndex: 10, fontFamily: 'sans-serif', userSelect: 'none' }}>
        <div style={{ marginBottom: '15px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Ký Ức</p>
          <p style={{ fontSize: '24px', color: '#FFD700', fontWeight: 'bold', margin: 0 }}>
            {CONFIG.counts.ornaments.toLocaleString()} <span style={{ fontSize: '10px', color: '#555', fontWeight: 'normal' }}>POLAROIDS</span>
          </p>
        </div>
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Lá Cây</p>
          <p style={{ fontSize: '24px', color: '#004225', fontWeight: 'bold', margin: 0 }}>
            {(CONFIG.counts.foliage / 1000).toFixed(0)}K <span style={{ fontSize: '10px', color: '#555', fontWeight: 'normal' }}>CHIỀU KIM CƯƠNG LỤC BẢO</span>
          </p>
        </div>
      </div>

      {/* UI - Nút */}
      <div style={{ position: 'absolute', bottom: '30px', right: '40px', zIndex: 10, display: 'flex', gap: '10px' }}>
        <button onClick={() => setDebugMode(!debugMode)} style={{ padding: '12px 15px', backgroundColor: debugMode ? '#FFD700' : 'rgba(0,0,0,0.5)', border: '1px solid #FFD700', color: debugMode ? '#000' : '#FFD700', fontFamily: 'sans-serif', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
           {debugMode ? 'ẨN DEBUG' : '🛠 DEBUG'}
        </button>
        <button onClick={() => {
          if (sceneState === 'CHAOS' || sceneState === 'EXPLODE' || sceneState === 'HEART' || sceneState === 'PHOTO') {
            setSceneState('FORMED');
            setSelectedPhotoIndex(undefined);
          } else {
            setSceneState('EXPLODE');
          }
        }} style={{ padding: '12px 30px', backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255, 215, 0, 0.5)', color: '#FFD700', fontFamily: 'serif', fontSize: '14px', fontWeight: 'bold', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
           {sceneState === 'FORMED' ? 'Quỹ Đạo Ảnh' : 'Lắp Ráp Cây'}
        </button>
        <button onClick={() => {
          setSceneState('HEART');
          setSelectedPhotoIndex(undefined);
        }} style={{ padding: '12px 20px', backgroundColor: 'rgba(255, 20, 147, 0.3)', border: '1px solid rgba(255, 20, 147, 0.5)', color: '#FF69B4', fontFamily: 'serif', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
           ❤️ Trái Tim
        </button>
      </div>

      {/* UI - Trạng thái AI */}
      <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', color: aiStatus.includes('LỖI') ? '#FF0000' : 'rgba(255, 215, 0, 0.4)', fontSize: '10px', letterSpacing: '2px', zIndex: 10, background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px' }}>
        {aiStatus}
      </div>

      {/* Copyright */}
      <div style={{ position: 'absolute', bottom: '10px', right: '15px', color: 'rgba(255,255,255,0.3)', fontSize: '12px', zIndex: 10, fontFamily: 'sans-serif', pointerEvents: 'none', fontStyle: 'italic' }}>
        © by Pham Minh Kha
      </div>

      {/* Overlay ảnh phóng to với hiệu ứng */}
      {sceneState === 'PHOTO' && selectedPhotoIndex !== undefined && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          backgroundColor: 'rgba(0,0,0,0.9)', 
          zIndex: 200, 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          pointerEvents: 'auto',
          transition: 'opacity 0.5s ease'
        }}>
          <div style={{
            position: 'relative',
            maxWidth: '80vw',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            {/* Ảnh với hiệu ứng fade và zoom */}
            <div style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img 
                key={selectedPhotoIndex}
                src={bodyPhotoPaths[selectedPhotoIndex]} 
                alt={`Ảnh ${selectedPhotoIndex}`} 
                style={{ 
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  border: '8px solid #FFD700', 
                  borderRadius: '15px',
                  boxShadow: '0 0 40px rgba(255, 215, 0, 0.8)',
                  objectFit: 'contain',
                  opacity: photoTransition === 'fadeOut' ? 0 : photoTransition === 'fadeIn' ? 1 : 1,
                  transform: photoTransition === 'fadeIn' && slideDirection === 'right'
                    ? 'translateX(0)' 
                    : photoTransition === 'fadeIn' && slideDirection === 'left'
                    ? 'translateX(0)'
                    : photoTransition === 'fadeOut' && slideDirection === 'right'
                    ? 'translateX(-30px)'
                    : photoTransition === 'fadeOut' && slideDirection === 'left'
                    ? 'translateX(30px)'
                    : 'translateX(0)',
                  transition: 'opacity 0.2s ease, transform 0.3s ease',
                  filter: photoTransition === 'fadeIn' ? 'brightness(1)' : photoTransition === 'fadeOut' ? 'brightness(0.7)' : 'brightness(1)'
                }} 
              />
              {/* Hiệu ứng ánh sáng xung quanh */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100%',
                height: '100%',
                borderRadius: '15px',
                background: 'radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%)',
                pointerEvents: 'none',
                animation: 'pulseGlow 2s ease-in-out infinite',
                zIndex: -1
              }} />
            </div>
            
            {/* Thông tin ảnh với hiệu ứng */}
            <div style={{
              marginTop: '20px',
              color: '#FFD700',
              fontSize: '24px',
              fontWeight: 'bold',
              textShadow: '0 0 10px rgba(255, 215, 0, 0.8)',
              textAlign: 'center',
              opacity: photoTransition === 'fadeOut' ? 0 : 1,
              transition: 'opacity 0.2s ease'
            }}>
              Ảnh {selectedPhotoIndex} / {bodyPhotoPaths.length - 1}
            </div>
            
            {/* Thanh tiến trình */}
            <div style={{
              marginTop: '15px',
              width: '400px',
              height: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${((selectedPhotoIndex) / (bodyPhotoPaths.length - 1)) * 100}%`,
                height: '100%',
                backgroundColor: '#FFD700',
                borderRadius: '2px',
                transition: 'width 0.5s ease',
                boxShadow: '0 0 10px rgba(255, 215, 0, 0.8)'
              }} />
            </div>
            
            <div style={{
              marginTop: '15px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '14px',
              textAlign: 'center',
              maxWidth: '600px',
              opacity: photoTransition === 'fadeOut' ? 0 : 1,
              transition: 'opacity 0.3s ease'
            }}>
              👋 <b>Chỉ tay lên:</b> Xem ảnh &nbsp;|&nbsp; 
              ➡️ <b>Tay phải:</b> Ảnh 1-15 &nbsp;|&nbsp; 
              ⬅️ <b>Tay trái:</b> Ảnh 16-31 &nbsp;|&nbsp;
              👍 <b>Thumb up:</b> Thoát
            </div>
          </div>
        </div>
      )}
      
      {/* CSS Animations */}
      <style>{`
        @keyframes pulseGlow {
          0%, 100% {
            opacity: 0.3;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 0.5;
            transform: translate(-50%, -50%) scale(1.05);
          }
        }
      `}</style>
        </React.Fragment>
      )}
    </div>
  );
}