import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, OrbitControls, Instances, Instance } from '@react-three/drei';
import { Physics, RigidBody, BallCollider, useRapier, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

interface HourglassSceneProps {
  timeProgress: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
}

// Glass component with realistic material
function Glass() {
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
      depthWrite: false
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
      <mesh geometry={hourglassGeometry} material={glassMaterial} />
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

// Hourglass physics colliders - invisible walls
function HourglassColliders() {
  // Create trimesh collider for the hourglass shape
  const hourglassVertices = useMemo(() => {
    const vertices: number[] = [];
    const indices: number[] = [];
    const segments = 24;
    const heightSegments = 30;
    
    // Generate vertices for hourglass shape
    for (let h = 0; h <= heightSegments; h++) {
      const t = h / heightSegments;
      const y = (t - 0.5) * 3;
      
      let radius;
      const centerDist = Math.abs(t - 0.5);
      
      if (centerDist < 0.1) {
        radius = 0.08 + centerDist * 2; // Slightly smaller for collision
      } else {
        radius = 0.28 + (centerDist - 0.1) * 1.8; // Slightly smaller for collision
      }
      
      for (let s = 0; s <= segments; s++) {
        const angle = (s / segments) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        vertices.push(x, y, z);
      }
    }
    
    // Generate indices for the mesh
    for (let h = 0; h < heightSegments; h++) {
      for (let s = 0; s < segments; s++) {
        const a = h * (segments + 1) + s;
        const b = a + segments + 1;
        
        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }
    
    return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
  }, []);

  return (
    <RigidBody type="fixed" colliders="trimesh" position={[0, 0, 0]}>
      <mesh visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={hourglassVertices.vertices.length / 3}
            array={hourglassVertices.vertices}
            itemSize={3}
          />
          <bufferAttribute
            attach="index"
            count={hourglassVertices.indices.length}
            array={hourglassVertices.indices}
            itemSize={1}
          />
        </bufferGeometry>
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </RigidBody>
  );
}

// Static sand piles (visual only)
function StaticSandPiles({ timeProgress, startDate, endDate }: { 
  timeProgress: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const topSandRef = useRef<THREE.Mesh>(null);
  const bottomSandRef = useRef<THREE.Mesh>(null);
  const scatteredSandRef = useRef<THREE.Points>(null);
  
  // Calculate date-based progress if dates are provided
  const dateProgress = useMemo(() => {
    if (!startDate || !endDate) return timeProgress;
    const now = new Date();
    const total = endDate.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();
    return Math.max(0, Math.min(1, elapsed / total));
  }, [startDate, endDate, timeProgress]);
  
  // Use date progress if available, otherwise use time progress
  const effectiveProgress = startDate && endDate ? dateProgress : timeProgress;
  
  // Create cone geometry for sand piles - sized to fit through neck
  const topSandGeometry = useMemo(() => {
    // Top cone should be narrow at bottom to fit through neck (0.1 radius)
    return new THREE.ConeGeometry(0.45, 0.7, 32, 1, false, 0, Math.PI * 2);
  }, []);
  
  const bottomSandGeometry = useMemo(() => {
    // Bottom cone starts narrow from the neck and spreads out
    return new THREE.ConeGeometry(0.5, 0.5, 32, 1, false, 0, Math.PI * 2);
  }, []);
  
  const sandMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0xc2a674,
      roughness: 0.9,
      metalness: 0,
    });
  }, []);
  
  // Create scattered sand particles on the floor
  const scatteredSandData = useMemo(() => {
    const particleCount = 500;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Distribute particles around the bottom of the hourglass
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.6; // Wider spread around bottom chamber
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = -1.55 + Math.random() * 0.1; // More height variation
      
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      
      // Sand color with slight variation
      const brightness = 0.7 + Math.random() * 0.2;
      colors[i3] = brightness;
      colors[i3 + 1] = brightness * 0.85;
      colors[i3 + 2] = brightness * 0.6;
    }
    
    return { positions, colors };
  }, []);
  
  const particleMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 0.015,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });
  }, []);
  
  // Update sand pile sizes based on progress
  useFrame(() => {
    if (topSandRef.current) {
      const scale = Math.max(0, 1 - effectiveProgress);
      topSandRef.current.scale.set(scale, scale, scale);
      // Position the top sand pile with tip pointing toward neck
      topSandRef.current.position.y = 0.05 + scale * 0.15; // Moves from 0.05 to 0.2 as it fills
    }
    
    if (bottomSandRef.current) {
      const scale = Math.min(1, effectiveProgress);
      bottomSandRef.current.scale.set(scale, scale, scale);
      // Position bottom sand pile attached to the floor, growing upward
      bottomSandRef.current.position.y = -1.45 + scale * 0.35; // Moves from -1.45 to -1.1 as it fills
    }
    
    // Update scattered sand opacity based on progress
    if (scatteredSandRef.current) {
      (scatteredSandRef.current.material as THREE.PointsMaterial).opacity = Math.min(1, effectiveProgress * 2);
    }
  });
  
  return (
    <>
      {/* Top sand pile - inverted cone (point down) */}
      <mesh ref={topSandRef} geometry={topSandGeometry} material={sandMaterial} position={[0, 0.1, 0]} rotation={[Math.PI, 0, 0]} />
      
      {/* Bottom sand pile - normal cone (point up) */}
      <mesh ref={bottomSandRef} geometry={bottomSandGeometry} material={sandMaterial} position={[0, -1.45, 0]} />
      
      {/* Scattered sand particles on the floor */}
      <points ref={scatteredSandRef} material={particleMaterial}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[scatteredSandData.positions, 3]}
            count={scatteredSandData.positions.length / 3}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[scatteredSandData.colors, 3]}
            count={scatteredSandData.colors.length / 3}
          />
        </bufferGeometry>
      </points>
    </>
  );
}

// Individual sand particle with physics
function SandGrain({ position }: { position: [number, number, number] }) {
  const ref = useRef<RapierRigidBody>(null);
  
  return (
    <RigidBody
      ref={ref}
      position={position}
      colliders={false}
      restitution={0.2}
      friction={0.9}
      linearDamping={0.4}
      angularDamping={0.8}
      mass={0.0001}
    >
      <BallCollider args={[0.008]} />
      <Instance color="#c2a674" />
    </RigidBody>
  );
}

// Flowing sand particles
function FlowingSand({ isActive, timeProgress }: { isActive: boolean; timeProgress: number }) {
  const [particles, setParticles] = useState<Array<{ id: number; position: [number, number, number] }>>([]);
  const nextId = useRef(0);
  const lastSpawn = useRef(0);
  const rapier = useRapier();
  
  // Spawn particles at the neck
  useFrame((state) => {
    const now = state.clock.getElapsedTime();
    
    // Only spawn if active and there's sand left in top chamber
    if (isActive && timeProgress < 0.95 && now - lastSpawn.current > 0.05) {
      lastSpawn.current = now;
      
      // Add a few particles at the neck
      const newParticles: Array<{ id: number; position: [number, number, number] }> = [];
      const spawnCount = 2;
      
      for (let i = 0; i < spawnCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.02; // Very small radius at neck
        newParticles.push({
          id: nextId.current++,
          position: [
            Math.cos(angle) * r,
            0.1, // Just above the neck
            Math.sin(angle) * r
          ]
        });
      }
      
      setParticles(prev => [...prev, ...newParticles].slice(-100)); // Keep max 100 particles
    }
    
    // Clean up particles that have settled
    setParticles(prev => prev.filter(p => {
      const body = rapier.world.getRigidBody(p.id);
      if (body) {
        const pos = body.translation();
        // Remove if too low or too old
        return pos.y > -1.4;
      }
      return false;
    }));
  });
  
  return (
    <Instances limit={100}>
      <sphereGeometry args={[0.008, 6, 4]} />
      <meshStandardMaterial 
        color="#c2a674"
        roughness={0.9}
        metalness={0}
      />
      {particles.map(particle => (
        <SandGrain
          key={particle.id}
          position={particle.position}
        />
      ))}
    </Instances>
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
        
        {/* Static sand piles that shrink/grow */}
        <StaticSandPiles 
          timeProgress={timeProgress}
          startDate={startDate}
          endDate={endDate}
        />
        
        {/* Physics world for falling sand */}
        <Physics gravity={[0, -9.81, 0]} timeStep="vary">
          <HourglassColliders />
          <FlowingSand isActive={isActive} timeProgress={timeProgress} />
        </Physics>
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