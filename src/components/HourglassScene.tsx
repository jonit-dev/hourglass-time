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
  startDate?: Date;
  endDate?: Date;
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
    const material = new THREE.MeshPhysicalMaterial({
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
      side: THREE.FrontSide,
      depthWrite: false // Prevent glass from hiding sand particles
    });
    return material;
  }, []);

  const innerGlassMaterial = useMemo(() => {
    const material = glassMaterial.clone();
    material.side = THREE.BackSide;
    material.depthWrite = false;
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
function SandParticles({ timeProgress, isActive, startDate, endDate }: { 
  timeProgress: number; 
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
}) {
  const topSandRef = useRef<THREE.Points>(null);
  const bottomSandRef = useRef<THREE.Points>(null);
  const fallingRef = useRef<THREE.Points>(null);
  
  // Realistic particle count with proper physics
  const PARTICLE_COUNT = 3000; // Balanced for performance and realism
  const particleSystem = useRef({
    positions: new Float32Array(PARTICLE_COUNT * 3),
    velocities: new Float32Array(PARTICLE_COUNT * 3),
    lifetimes: new Float32Array(PARTICLE_COUNT),
    colors: new Float32Array(PARTICLE_COUNT * 3),
    settled: new Float32Array(PARTICLE_COUNT), // Track if particle has settled
    restY: new Float32Array(PARTICLE_COUNT), // Resting Y position for settled particles
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
      
      // Enhanced bright golden sand colors for visibility
      const gold = 1.2;
      colors[i3] = gold;
      colors[i3 + 1] = gold * 1.1;
      colors[i3 + 2] = gold * 0.3;
    }
    
    return { positions, colors };
  };

  // Static sand geometries with massive particle count
  const topSandData = useMemo(() => createSandParticles(20000, 0.25, 1.4, true), []);
  const bottomSandData = useMemo(() => createSandParticles(20000, -1.45, -0.2, false), []);
  
  // Previous time progress to detect changes
  const prevTimeProgress = useRef(timeProgress);

  // Realistic particle initialization
  useEffect(() => {
    const { positions, velocities, lifetimes, colors, settled, restY } = particleSystem.current;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      
      // Start particles in top chamber
      const spawnY = 0.5 + Math.random() * 0.8;
      const maxR = glassRadiusAtY(spawnY) * 0.7;
      const spawnR = Math.random() * maxR;
      const ang = Math.random() * Math.PI * 2;
      
      positions[i3] = Math.cos(ang) * spawnR;
      positions[i3 + 1] = spawnY;
      positions[i3 + 2] = Math.sin(ang) * spawnR;
      
      // Minimal initial velocity
      velocities[i3] = (Math.random() - 0.5) * 0.0001;
      velocities[i3 + 1] = -Math.random() * 0.0005;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.0001;
      
      lifetimes[i] = Math.random() * 300;
      settled[i] = 0; // Not settled initially
      restY[i] = -10; // Invalid rest position
      
      // Natural sand colors
      const brightness = 0.9 + Math.random() * 0.2;
      colors[i3] = brightness;
      colors[i3 + 1] = brightness * 0.85;
      colors[i3 + 2] = brightness * 0.6;
    }
  }, []);

  // Calculate date-based flow rate
  const dateProgress = useMemo(() => {
    if (!startDate || !endDate) return timeProgress;
    const now = new Date();
    const total = endDate.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();
    return Math.max(0, Math.min(1, elapsed / total));
  }, [startDate, endDate, timeProgress]);

  // Animation loop with realistic physics
  useFrame(() => {
    if (!fallingRef.current) return;

    const { positions, velocities, lifetimes, settled, restY } = particleSystem.current;
    const margin = 0.015;
    const gravity = -0.003; // Strong gravity for natural fall
    const damping = 0.95; // High air resistance
    const friction = 0.7; // High surface friction
    const restitution = 0.1; // Low bounce
    const funnelHalfH = 0.15;
    const funnelStrength = 0.002;
    const neckY = 0.0;
    const neckR = 0.03;
    
    // Flow control
    const baseFlowRate = startDate && endDate ? dateProgress : timeProgress;
    const flowRate = isActive ? Math.min(baseFlowRate, 0.95) : baseFlowRate * 0.1;
    const activeParticles = Math.floor(PARTICLE_COUNT * (0.4 + flowRate * 0.6));
    
    // Pile tracking for realistic stacking
    const pileMap = new Map<string, number>(); // Grid-based height map
    const gridSize = 0.04;
    
    // First pass: build height map from settled particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      if (settled[i] > 0.5) {
        const x = positions[i3];
        const z = positions[i3 + 2];
        const gridX = Math.floor(x / gridSize);
        const gridZ = Math.floor(z / gridSize);
        const key = `${gridX},${gridZ}`;
        const currentHeight = pileMap.get(key) || -1.5;
        pileMap.set(key, Math.max(currentHeight, restY[i]));
      }
    }

    // Second pass: update particles with realistic physics
    for (let i = 0; i < activeParticles; i++) {
      const i3 = i * 3;
      const isSettled = settled[i] > 0.5;
      
      if (!isSettled) {
        // Apply gravity only to falling particles
        velocities[i3 + 1] += gravity;
        
        // Update positions
        positions[i3] += velocities[i3];
        positions[i3 + 1] += velocities[i3 + 1];
        positions[i3 + 2] += velocities[i3 + 2];
      } else {
        // Settled particles stay put
        positions[i3 + 1] = restY[i];
        velocities[i3] = 0;
        velocities[i3 + 1] = 0;
        velocities[i3 + 2] = 0;
        continue;
      }
      
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
      
      // Enhanced funnel effect with smooth transition
      if (y > -funnelHalfH && y < funnelHalfH) {
        const funnelFactor = 1 - Math.abs(y) / funnelHalfH;
        const r2 = Math.max(1e-6, x*x + z*z);
        const pull = funnelStrength * funnelFactor / (r2 + 0.01);
        velocities[i3] -= x * pull;
        velocities[i3 + 2] -= z * pull;
        
        // Add downward pull in funnel
        velocities[i3 + 1] -= 0.0008 * funnelFactor;
      }
      
      // Neck clamp to maintain stream
      if (y > neckY - 0.05 && y < neckY + 0.05) {
        const rr = Math.sqrt(x*x + z*z);
        if (rr > neckR) {
          const nx = x / (rr + 1e-6), nz = z / (rr + 1e-6);
          positions[i3] = nx * neckR;
          positions[i3 + 2] = nz * neckR;
          // Damp tangential velocity
          velocities[i3] *= 0.7;
          velocities[i3 + 2] *= 0.7;
        }
      }
      
      // Realistic ground collision and pile formation
      if (y < -1.0) {
        const gridX = Math.floor(x / gridSize);
        const gridZ = Math.floor(z / gridSize);
        const key = `${gridX},${gridZ}`;
        const groundHeight = pileMap.get(key) || -1.4;
        const particleRadius = 0.015;
        const targetHeight = groundHeight + particleRadius;
        
        if (y < targetHeight) {
          // Particle has hit ground or other particles
          positions[i3 + 1] = targetHeight;
          
          // Check if particle should settle
          const speed = Math.sqrt(velocities[i3]*velocities[i3] + velocities[i3+1]*velocities[i3+1] + velocities[i3+2]*velocities[i3+2]);
          if (speed < 0.008) {
            // Settle the particle
            settled[i] = 1;
            restY[i] = targetHeight;
            velocities[i3] = 0;
            velocities[i3 + 1] = 0;
            velocities[i3 + 2] = 0;
            
            // Update height map
            pileMap.set(key, targetHeight);
          } else {
            // Bounce with high friction
            velocities[i3 + 1] = Math.abs(velocities[i3 + 1]) * restitution;
            velocities[i3] *= friction;
            velocities[i3 + 2] *= friction;
          }
        }
      }
      
      // Top ceiling
      if (y > 1.4) {
        positions[i3 + 1] = 1.4;
        velocities[i3 + 1] = -Math.abs(velocities[i3 + 1]) * 0.3;
      }
      
      // Apply damping to falling particles only
      if (!isSettled) {
        velocities[i3] *= damping;
        velocities[i3 + 1] *= damping;
        velocities[i3 + 2] *= damping;
      }
      
      lifetimes[i] += 1;
      
      // Respawn particles when they exit or get too old
      if (positions[i3 + 1] < -1.6 || lifetimes[i] > 400) {
        const sandRemaining = 1 - (startDate && endDate ? dateProgress : timeProgress);
        if (sandRemaining > 0.01 && Math.random() < flowRate * 0.5) {
          // Respawn in top chamber
          const spawnY = 0.5 + Math.random() * 0.7 * sandRemaining;
          const maxR = glassRadiusAtY(spawnY) * 0.6;
          const spawnR = Math.random() * maxR;
          const ang = Math.random() * Math.PI * 2;
          
          positions[i3] = Math.cos(ang) * spawnR;
          positions[i3 + 1] = spawnY;
          positions[i3 + 2] = Math.sin(ang) * spawnR;
          
          velocities[i3] = (Math.random() - 0.5) * 0.0002;
          velocities[i3 + 1] = -Math.random() * 0.001;
          velocities[i3 + 2] = (Math.random() - 0.5) * 0.0002;
          
          settled[i] = 0;
          restY[i] = -10;
          lifetimes[i] = 0;
        } else {
          // Hide particle
          positions[i3 + 1] = -10;
          settled[i] = 1;
        }
      }
    }
    
    // Update geometry
    if (fallingRef.current.geometry.attributes.position) {
      fallingRef.current.geometry.attributes.position.needsUpdate = true;
    }
    if (fallingRef.current.geometry.attributes.color) {
      fallingRef.current.geometry.attributes.color.needsUpdate = true;
    }

    // Bottom sand amount directly represents progress percentage
    const progress = startDate && endDate ? dateProgress : timeProgress;
    const topSandAmount = Math.max(0, 1 - progress); // Top depletes as progress increases
    const bottomSandAmount = progress; // Bottom amount = exact progress percentage
    
    if (topSandRef.current) {
      (topSandRef.current.material as THREE.PointsMaterial).opacity = topSandAmount;
    }
    
    if (bottomSandRef.current) {
      (bottomSandRef.current.material as THREE.PointsMaterial).opacity = bottomSandAmount;
    }
    
    if (fallingRef.current) {
      (fallingRef.current.material as THREE.PointsMaterial).opacity = isActive ? 0.8 : 0.3;
    }
    
    // Move static sand levels based on date progress
    const currentProgress = startDate && endDate ? dateProgress : timeProgress;
    if (Math.abs(currentProgress - prevTimeProgress.current) > 0.0001) {
      if (topSandRef.current) {
        const geom = topSandRef.current.geometry as THREE.BufferGeometry;
        const arr = geom.attributes.position.array as Float32Array;
        const offset = -currentProgress * 1.1; // Lowers the top pile
        for (let i = 1; i < arr.length; i += 3) {
          arr[i] = topSandData.positions[i] + offset;
        }
        geom.attributes.position.needsUpdate = true;
      }
      
      if (bottomSandRef.current) {
        const geom = bottomSandRef.current.geometry as THREE.BufferGeometry;
        const arr = geom.attributes.position.array as Float32Array;
        const offset = currentProgress * 0.8; // Raises the bottom pile
        for (let i = 1; i < arr.length; i += 3) {
          arr[i] = bottomSandData.positions[i] + offset;
        }
        geom.attributes.position.needsUpdate = true;
      }
      
      prevTimeProgress.current = currentProgress;
    }
  });

  const sandMaterial = useMemo(() => 
    new THREE.PointsMaterial({
      size: 0.04, // Larger for better visibility and realistic sand grains
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      depthWrite: true, // Enable depth for realistic layering
      alphaTest: 0.1,
      blending: THREE.NormalBlending,
    }), []
  );

  const fallingMaterial = useMemo(() =>
    new THREE.PointsMaterial({
      size: 0.035, // Visible falling particles
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: true,
      alphaTest: 0.1,
      blending: THREE.NormalBlending,
    }), []
  );

  return (
    <group>
      {/* Top sand */}
      <points ref={topSandRef} material={sandMaterial} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[topSandData.positions, 3]}
            count={topSandData.positions.length / 3}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[topSandData.colors, 3]}
            count={topSandData.colors.length / 3}
          />
        </bufferGeometry>
      </points>

      {/* Bottom sand */}
      <points ref={bottomSandRef} material={sandMaterial} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[bottomSandData.positions, 3]}
            count={bottomSandData.positions.length / 3}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[bottomSandData.colors, 3]}
            count={bottomSandData.colors.length / 3}
          />
        </bufferGeometry>
      </points>

      {/* Falling particles */}
      <points ref={fallingRef} material={fallingMaterial} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particleSystem.current.positions, 3]}
            count={PARTICLE_COUNT}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[particleSystem.current.colors, 3]}
            count={PARTICLE_COUNT}
          />
        </bufferGeometry>
      </points>
    </group>
  );
}

// Main scene component
function Scene({ timeProgress, isActive, startDate, endDate }: { 
  timeProgress: number; 
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
}) {
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
      <Environment preset="studio" background={false} />
      
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
        <SandParticles 
          timeProgress={timeProgress} 
          isActive={isActive}
          startDate={startDate}
          endDate={endDate}
        />
      </group>
    </>
  );
}

export const HourglassScene: React.FC<HourglassSceneProps> = ({ timeProgress, isActive, startDate, endDate }) => {
  return (
    <div className="w-[400px] h-[400px] mx-auto rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-gray-900 via-black to-gray-800 border border-gray-700/30">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.6,
        }}
        shadows
      >
        <Scene 
          timeProgress={timeProgress} 
          isActive={isActive}
          startDate={startDate}
          endDate={endDate}
        />
      </Canvas>
    </div>
  );
};