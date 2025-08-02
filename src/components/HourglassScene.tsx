import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Extend Three.js with custom materials
extend({ 
  MeshPhysicalMaterial: THREE.MeshPhysicalMaterial,
  PointsMaterial: THREE.PointsMaterial,
  LatheGeometry: THREE.LatheGeometry,
  CylinderGeometry: THREE.CylinderGeometry,
  CircleGeometry: THREE.CircleGeometry,
});

interface HourglassSceneProps {
  timeProgress: number;
  isActive: boolean;
}

// Glass component with realistic material
function Glass() {
  const glassRef = useRef<THREE.Mesh>(null);

  const hourglassGeometry = useMemo(() => {
    const points = [];
    const segments = 40;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = (t - 0.5) * 3;
      
      let radius;
      const centerDist = Math.abs(t - 0.5);
      
      if (centerDist < 0.1) {
        radius = 0.1 + centerDist * 2;
      } else {
        radius = 0.3 + (centerDist - 0.1) * 1.8;
      }
      
      points.push(new THREE.Vector2(radius, y));
    }
    
    return new THREE.LatheGeometry(points, 32);
  }, []);

  const glassMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.05,
      transmission: 0.98,
      thickness: 0.25,
      ior: 1.52,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.2,
      attenuationColor: new THREE.Color(0xbdd8ff),
      attenuationDistance: 3.0,
      side: THREE.FrontSide
    });
  }, []);

  const innerGlassMaterial = useMemo(() => {
    const material = glassMaterial.clone();
    material.side = THREE.BackSide;
    return material;
  }, [glassMaterial]);

  return (
    <group>
      <mesh ref={glassRef} geometry={hourglassGeometry} material={glassMaterial} />
      <mesh geometry={hourglassGeometry} material={innerGlassMaterial} scale={0.97} />
    </group>
  );
}

// Metal caps and stands
function MetalParts() {
  const capMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: 0xb8860b,
      metalness: 0.8,
      roughness: 0.2,
    }), []
  );

  const standMaterial = useMemo(() =>
    new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.8,
      metalness: 0.1,
    }), []
  );

  return (
    <group>
      {/* Top cap */}
      <mesh position={[0, 1.58, 0]} material={capMaterial}>
        <cylinderGeometry args={[1.1, 1.1, 0.15, 32]} />
      </mesh>
      
      {/* Bottom cap */}
      <mesh position={[0, -1.58, 0]} material={capMaterial}>
        <cylinderGeometry args={[1.1, 1.1, 0.15, 32]} />
      </mesh>
      
      {/* Top stand */}
      <mesh position={[0, 1.7, 0]} material={standMaterial}>
        <cylinderGeometry args={[1.3, 1.3, 0.1, 32]} />
      </mesh>
      
      {/* Bottom stand */}
      <mesh position={[0, -1.7, 0]} material={standMaterial}>
        <cylinderGeometry args={[1.3, 1.3, 0.1, 32]} />
      </mesh>
    </group>
  );
}

// Particle system for sand
function SandParticles({ timeProgress, isActive }: { timeProgress: number; isActive: boolean }) {
  const topSandRef = useRef<THREE.Points>(null);
  const bottomSandRef = useRef<THREE.Points>(null);
  const fallingRef = useRef<THREE.Points>(null);
  
  const particleSystem = useRef({
    positions: new Float32Array(600), // 200 particles * 3 coordinates
    velocities: new Float32Array(600),
    lifetimes: new Float32Array(200),
  });

  // Glass radius constraint function
  const glassRadiusAtY = (y: number): number => {
    const t = (y / 3) + 0.5;
    const centerDist = Math.abs(t - 0.5);
    if (centerDist < 0.1) {
      return 0.1 + centerDist * 2;
    } else {
      return 0.3 + (centerDist - 0.1) * 1.8;
    }
  };

  // Create sand particles with glass constraints
  const createSandParticles = (count: number, yMin: number, yMax: number, cavity = false) => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const y = yMin + Math.random() * (yMax - yMin);
      const rMax = Math.max(0.02, glassRadiusAtY(y) - 0.03);
      
      const bias = cavity ? Math.random() ** 0.4 : Math.random() ** 1.6;
      const r = bias * rMax;
      const a = Math.random() * Math.PI * 2;
      
      positions[i3] = Math.cos(a) * r;
      positions[i3 + 1] = y;
      positions[i3 + 2] = Math.sin(a) * r;
      
      // Very bright golden sand colors
      const gold = 1.0;
      colors[i3] = gold;
      colors[i3 + 1] = gold;
      colors[i3 + 2] = 0.2;
    }
    
    return { positions, colors };
  };

  // Static sand geometries
  const topSandData = useMemo(() => createSandParticles(500, 0.25, 1.4, true), []);
  const bottomSandData = useMemo(() => createSandParticles(600, -1.45, -0.2, false), []);

  // Falling particles initialization
  useEffect(() => {
    const { positions, velocities, lifetimes } = particleSystem.current;
    
    for (let i = 0; i < 200; i++) {
      const i3 = i * 3;
      
      // Spawn in top chamber, not just at neck
      const spawnY = 0.3 + Math.random() * 1.0; // Spread throughout top chamber
      const maxR = glassRadiusAtY(spawnY) * 0.85;
      const spawnR = Math.random() * maxR;
      const ang = Math.random() * Math.PI * 2;
      
      positions[i3] = Math.cos(ang) * spawnR;
      positions[i3 + 1] = spawnY;
      positions[i3 + 2] = Math.sin(ang) * spawnR;
      
      // Start with minimal velocity - let gravity do the work
      velocities[i3] = (Math.random() - 0.5) * 0.0005;
      velocities[i3 + 1] = -Math.random() * 0.001;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.0005;
      
      lifetimes[i] = Math.random() * 200;
    }
  }, []);

  // Animation loop
  useFrame(() => {
    if (!fallingRef.current) return;

    const { positions, velocities, lifetimes } = particleSystem.current;
    const margin = 0.015;
    const gravity = -0.0008; // Stronger gravity for more realistic fall
    const damping = 0.995; // More air resistance
    const funnelHalfH = 0.15;
    const funnelStrength = 0.001; // Stronger funnel effect

    // Update falling particles
    for (let i = 0; i < 200; i++) {
      const i3 = i * 3;
      
      // Apply gravity
      velocities[i3 + 1] += gravity;
      
      // Update positions
      positions[i3] += velocities[i3];
      positions[i3 + 1] += velocities[i3 + 1];
      positions[i3 + 2] += velocities[i3 + 2];
      
      const x = positions[i3];
      const y = positions[i3 + 1];
      const z = positions[i3 + 2];
      
      // Wall constraint
      const rMax = Math.max(0.02, glassRadiusAtY(y) - margin);
      const r = Math.sqrt(x*x + z*z);
      if (r > rMax) {
        const nx = x / r, nz = z / r;
        positions[i3] = nx * rMax;
        positions[i3 + 2] = nz * rMax;
        const vn = velocities[i3] * nx + velocities[i3 + 2] * nz;
        const restitution = 0.2;
        velocities[i3] -= (1 + restitution) * vn * nx;
        velocities[i3 + 2] -= (1 + restitution) * vn * nz;
        velocities[i3] *= 0.95;
        velocities[i3 + 2] *= 0.95;
      }
      
      // Funnel effect
      if (y > -funnelHalfH && y < funnelHalfH) {
        const r2 = Math.max(1e-6, x*x + z*z);
        const pull = funnelStrength / r2;
        velocities[i3] -= x * pull;
        velocities[i3 + 2] -= z * pull;
      }
      
      // Ground collision with better pile formation
      if (y < -1.1) {
        const pileCenter = -1.3;
        const pileHeight = 0.15 * (1 - Math.min(1, r / 0.4)); // Steeper pile
        const groundY = pileCenter + pileHeight;
        
        if (y < groundY) {
          positions[i3 + 1] = groundY + 0.01; // Slightly above ground
          velocities[i3 + 1] = Math.max(0, velocities[i3 + 1] * -0.3); // Bounce slightly
          velocities[i3] *= 0.7; // More friction
          velocities[i3 + 2] *= 0.7;
          
          // Slide toward center for pile formation
          const slideForce = 0.0008;
          velocities[i3] -= (x / (r + 1e-6)) * slideForce;
          velocities[i3 + 2] -= (z / (r + 1e-6)) * slideForce;
        }
      }
      
      // Top ceiling
      if (y > 1.45) {
        positions[i3 + 1] = 1.45;
        velocities[i3 + 1] *= -0.2;
      }
      
      // Damping
      velocities[i3] *= damping;
      velocities[i3 + 1] *= damping;
      velocities[i3 + 2] *= damping;
      
      lifetimes[i] += 1;
      
      // Reset particles - respawn in top chamber
      if (positions[i3 + 1] < -1.6 || lifetimes[i] > 800) {
        const spawnY = 0.5 + Math.random() * 0.8;
        const maxR = glassRadiusAtY(spawnY) * 0.8;
        const spawnR = Math.random() * maxR;
        const ang = Math.random() * Math.PI * 2;
        
        positions[i3] = Math.cos(ang) * spawnR;
        positions[i3 + 1] = spawnY;
        positions[i3 + 2] = Math.sin(ang) * spawnR;
        
        velocities[i3] = (Math.random() - 0.5) * 0.0005;
        velocities[i3 + 1] = -Math.random() * 0.001;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.0005;
        
        lifetimes[i] = 0;
      }
    }
    
    fallingRef.current.geometry.attributes.position.needsUpdate = true;

    // Update sand levels based on time progress
    const topSandAmount = Math.max(0.1, 1 - timeProgress);
    const bottomSandAmount = Math.min(1, timeProgress + 0.2);
    
    if (topSandRef.current) {
      (topSandRef.current.material as THREE.PointsMaterial).opacity = topSandAmount;
    }
    
    if (bottomSandRef.current) {
      (bottomSandRef.current.material as THREE.PointsMaterial).opacity = bottomSandAmount;
    }
    
    if (fallingRef.current) {
      (fallingRef.current.material as THREE.PointsMaterial).opacity = isActive ? 0.8 : 0.3;
    }
  });

  const sandMaterial = useMemo(() => 
    new THREE.PointsMaterial({
      size: 0.04,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
    }), []
  );

  const fallingMaterial = useMemo(() =>
    new THREE.PointsMaterial({
      size: 0.035,
      sizeAttenuation: true,
      color: 0xdaa520, // Goldenrod color for sand
      transparent: true,
      opacity: 0.9,
    }), []
  );

  return (
    <group>
      {/* Top sand */}
      <points ref={topSandRef} material={sandMaterial}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[topSandData.positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[topSandData.colors, 3]}
          />
        </bufferGeometry>
      </points>

      {/* Bottom sand */}
      <points ref={bottomSandRef} material={sandMaterial}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[bottomSandData.positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[bottomSandData.colors, 3]}
          />
        </bufferGeometry>
      </points>

      {/* Falling particles */}
      <points ref={fallingRef} material={fallingMaterial}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particleSystem.current.positions, 3]}
            count={200}
          />
        </bufferGeometry>
      </points>
    </group>
  );
}

// Main scene component
function Scene({ timeProgress, isActive }: { timeProgress: number; isActive: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <>
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={3}
        maxDistance={15}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        autoRotate={false}
        autoRotateSpeed={0.5}
        dampingFactor={0.05}
        enableDamping={true}
      />
      <Environment preset="night" background={false} />
      
      {/* Lighting */}
      <ambientLight intensity={0.6} color={0x404040} />
      <directionalLight
        position={[3, 4, 3]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight
        position={[-2, 1, -2]}
        intensity={0.4}
        color={0x87ceeb}
      />
      
      {/* Ground for reflections */}
      <mesh position={[0, -1.8, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[3, 64]} />
        <meshStandardMaterial
          color={0x222222}
          metalness={0.2}
          roughness={0.6}
        />
      </mesh>

      <group ref={groupRef}>
        <Glass />
        <MetalParts />
        <SandParticles timeProgress={timeProgress} isActive={isActive} />
      </group>
    </>
  );
}

export const HourglassScene: React.FC<HourglassSceneProps> = ({ timeProgress, isActive }) => {
  return (
    <div className="w-[400px] h-[400px] mx-auto rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-gray-900 via-black to-gray-800 border border-gray-700/30">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        shadows
      >
        <Scene timeProgress={timeProgress} isActive={isActive} />
      </Canvas>
    </div>
  );
};