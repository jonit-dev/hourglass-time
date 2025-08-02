import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface HourglassSceneProps {
  timeProgress: number; // 0 to 1, where 0 is start time, 1 is end time
  isActive: boolean;
}

export const HourglassScene: React.FC<HourglassSceneProps> = ({ timeProgress, isActive }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    hourglass: THREE.Group;
    topSand: THREE.Points;
    bottomSand: THREE.Points;
    fallingParticles: THREE.Points;
    animationId: number;
    clock: THREE.Clock;
    particleSystem: {
      positions: Float32Array;
      velocities: Float32Array;
      lifetimes: Float32Array;
      count: number;
    };
  } | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 6);

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setSize(400, 400);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mountRef.current.appendChild(renderer.domElement);

    const clock = new THREE.Clock();

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(3, 4, 3);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 15;
    mainLight.shadow.camera.left = -3;
    mainLight.shadow.camera.right = 3;
    mainLight.shadow.camera.top = 3;
    mainLight.shadow.camera.bottom = -3;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.4);
    fillLight.position.set(-2, 1, -2);
    scene.add(fillLight);

    // Create hourglass group
    const hourglassGroup = new THREE.Group();
    scene.add(hourglassGroup);

    // Create proper hourglass shape
    const createHourglassGeometry = () => {
      const points = [];
      const segments = 40;
      
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const y = (t - 0.5) * 3; // Height from -1.5 to 1.5
        
        let radius;
        const centerDist = Math.abs(t - 0.5);
        
        if (centerDist < 0.1) {
          // Narrow neck
          radius = 0.1 + centerDist * 2;
        } else {
          // Wider chambers
          radius = 0.3 + (centerDist - 0.1) * 1.8;
        }
        
        points.push(new THREE.Vector2(radius, y));
      }
      
      return new THREE.LatheGeometry(points, 32);
    };

    const hourglassGeometry = createHourglassGeometry();

    // Create glass material that actually works
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      roughness: 0.05,
      metalness: 0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      ior: 1.5,
      thickness: 0.2,
      transmission: 0.9,
      side: THREE.DoubleSide,
    });

    const hourglassBody = new THREE.Mesh(hourglassGeometry, glassMaterial);
    hourglassBody.castShadow = true;
    hourglassBody.receiveShadow = true;
    hourglassGroup.add(hourglassBody);

    // Create metal caps
    const capGeometry = new THREE.CylinderGeometry(1.1, 1.1, 0.15, 32);
    const capMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8860b,
      metalness: 0.8,
      roughness: 0.2,
    });

    const topCap = new THREE.Mesh(capGeometry, capMaterial);
    topCap.position.y = 1.58;
    topCap.castShadow = true;
    hourglassGroup.add(topCap);

    const bottomCap = new THREE.Mesh(capGeometry, capMaterial);
    bottomCap.position.y = -1.58;
    bottomCap.castShadow = true;
    hourglassGroup.add(bottomCap);

    // Create base and top stands
    const standGeometry = new THREE.CylinderGeometry(1.3, 1.3, 0.1, 32);
    const standMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.8,
      metalness: 0.1,
    });

    const topStand = new THREE.Mesh(standGeometry, standMaterial);
    topStand.position.y = 1.7;
    topStand.castShadow = true;
    hourglassGroup.add(topStand);

    const bottomStand = new THREE.Mesh(standGeometry, standMaterial);
    bottomStand.position.y = -1.7;
    bottomStand.castShadow = true;
    hourglassGroup.add(bottomStand);

    // Particle system setup
    const maxParticles = 2000;
    const fallingParticleCount = 100;

    // Static sand particles
    const createSandParticles = (count: number, yMin: number, yMax: number, radiusMax: number) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const sizes = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        
        // Create realistic sand pile distribution
        const radius = Math.pow(Math.random(), 0.8) * radiusMax;
        const angle = Math.random() * Math.PI * 2;
        const height = yMin + Math.random() * (yMax - yMin);
        
        positions[i3] = Math.cos(angle) * radius;
        positions[i3 + 1] = height;
        positions[i3 + 2] = Math.sin(angle) * radius;
        
        // Golden sand colors with variation
        const goldBase = 0.8 + Math.random() * 0.3;
        colors[i3] = goldBase;
        colors[i3 + 1] = goldBase * 0.7;
        colors[i3 + 2] = goldBase * 0.2;
        
        sizes[i] = 0.02 + Math.random() * 0.02;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      return geometry;
    };

    // Top sand chamber
    const topSandGeometry = createSandParticles(800, 0.2, 1.4, 0.9);
    const topSandMaterial = new THREE.PointsMaterial({
      size: 0.03,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      alphaTest: 0.1,
    });
    const topSand = new THREE.Points(topSandGeometry, topSandMaterial);
    scene.add(topSand);

    // Bottom sand chamber
    const bottomSandGeometry = createSandParticles(600, -1.4, -0.2, 0.9);
    const bottomSandMaterial = new THREE.PointsMaterial({
      size: 0.03,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      alphaTest: 0.1,
    });
    const bottomSand = new THREE.Points(bottomSandGeometry, bottomSandMaterial);
    scene.add(bottomSand);

    // Falling particles system
    const fallingGeometry = new THREE.BufferGeometry();
    const fallingPositions = new Float32Array(fallingParticleCount * 3);
    const fallingVelocities = new Float32Array(fallingParticleCount * 3);
    const fallingLifetimes = new Float32Array(fallingParticleCount);
    const fallingColors = new Float32Array(fallingParticleCount * 3);

    // Initialize falling particles
    for (let i = 0; i < fallingParticleCount; i++) {
      const i3 = i * 3;
      
      // Start particles at the neck
      fallingPositions[i3] = (Math.random() - 0.5) * 0.2;
      fallingPositions[i3 + 1] = 0.1;
      fallingPositions[i3 + 2] = (Math.random() - 0.5) * 0.2;
      
      // Random velocities
      fallingVelocities[i3] = (Math.random() - 0.5) * 0.005;
      fallingVelocities[i3 + 1] = -0.01 - Math.random() * 0.02;
      fallingVelocities[i3 + 2] = (Math.random() - 0.5) * 0.005;
      
      fallingLifetimes[i] = Math.random() * 100;
      
      // Golden colors
      const gold = 0.9 + Math.random() * 0.2;
      fallingColors[i3] = gold;
      fallingColors[i3 + 1] = gold * 0.8;
      fallingColors[i3 + 2] = gold * 0.3;
    }

    fallingGeometry.setAttribute('position', new THREE.BufferAttribute(fallingPositions, 3));
    fallingGeometry.setAttribute('color', new THREE.BufferAttribute(fallingColors, 3));

    const fallingMaterial = new THREE.PointsMaterial({
      size: 0.025,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      alphaTest: 0.1,
    });

    const fallingParticles = new THREE.Points(fallingGeometry, fallingMaterial);
    scene.add(fallingParticles);

    // Store particle system data
    const particleSystem = {
      positions: fallingPositions,
      velocities: fallingVelocities,
      lifetimes: fallingLifetimes,
      count: fallingParticleCount,
    };

    sceneRef.current = {
      scene,
      camera,
      renderer,
      hourglass: hourglassGroup,
      topSand,
      bottomSand,
      fallingParticles,
      animationId: 0,
      clock,
      particleSystem,
    };

    return () => {
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
        mountRef.current?.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;

    const animate = () => {
      if (!sceneRef.current) return;

      const { 
        scene, 
        camera, 
        renderer, 
        hourglass, 
        topSand, 
        bottomSand, 
        fallingParticles,
        clock,
        particleSystem
      } = sceneRef.current;

      const elapsedTime = clock.getElapsedTime();

      // Gentle hourglass rotation
      hourglass.rotation.y = elapsedTime * 0.05;

      // Subtle camera movement
      camera.position.x = Math.sin(elapsedTime * 0.2) * 0.3;
      camera.position.z = 6 + Math.cos(elapsedTime * 0.15) * 0.2;
      camera.lookAt(0, 0, 0);

      if (isActive) {
        // Update falling particles
        const { positions, velocities, lifetimes, count } = particleSystem;

        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          
          // Update positions
          positions[i3] += velocities[i3];
          positions[i3 + 1] += velocities[i3 + 1];
          positions[i3 + 2] += velocities[i3 + 2];
          
          // Update lifetime
          lifetimes[i] += 1;

          // Reset particles that fall too low or live too long
          if (positions[i3 + 1] < -1.5 || lifetimes[i] > 150) {
            positions[i3] = (Math.random() - 0.5) * 0.15;
            positions[i3 + 1] = 0.1;
            positions[i3 + 2] = (Math.random() - 0.5) * 0.15;
            
            velocities[i3] = (Math.random() - 0.5) * 0.005;
            velocities[i3 + 1] = -0.01 - Math.random() * 0.02;
            velocities[i3 + 2] = (Math.random() - 0.5) * 0.005;
            
            lifetimes[i] = 0;
          }
        }

        fallingParticles.geometry.attributes.position.needsUpdate = true;

        // Adjust sand levels based on time progress
        const topSandAmount = Math.max(0.1, 1 - timeProgress);
        const bottomSandAmount = Math.min(1, timeProgress + 0.2);
        
        topSand.material.opacity = topSandAmount;
        bottomSand.material.opacity = bottomSandAmount;
        fallingParticles.material.opacity = 0.8;
      } else {
        // Reduce particle visibility when not active
        fallingParticles.material.opacity = 0.2;
      }

      renderer.render(scene, camera);
      sceneRef.current.animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }
    };
  }, [timeProgress, isActive]);

  return (
    <div 
      ref={mountRef} 
      className="w-[400px] h-[400px] mx-auto rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-gray-900 via-black to-gray-800 border border-gray-700/30"
    />
  );
};