import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, RoundedBox, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

const CARD_COLORS = ['#ffffff', '#eef2ff', '#fdf2f8', '#e0f2fe', '#f0fdf4'];

function FallingBallot({ index }) {
  const ref = useRef();
  const startY = 2.1 + index * 0.35;
  const height = startY - 0.78;
  const speed = 0.55 + index * 0.1;
  const color = useMemo(() => new THREE.Color(CARD_COLORS[index % CARD_COLORS.length]), [index]);

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed;
    const phase = t % height;
    const y = startY - phase;
    const progress = phase / height;
    ref.current.position.set(
      Math.sin(index * 2.4) * 0.3,
      y,
      Math.cos(index * 3.1) * 0.22
    );
    ref.current.rotation.z = (progress - 0.5) * 0.5;
    ref.current.rotation.x = Math.sin(t * 1.2) * 0.12;
    const nearSlot = Math.max(0, 1 - progress * 1.4);
    ref.current.material.opacity = 0.35 + 0.65 * nearSlot;
  });

  return (
    <mesh ref={ref} rotation={[0, index, 0]}>
      <planeGeometry args={[0.4, 0.27]} />
      <meshStandardMaterial color={color} roughness={0.7} side={THREE.DoubleSide} transparent />
    </mesh>
  );
}

function BallotBox() {
  return (
    <Float speed={2} rotationIntensity={0.35} floatIntensity={0.6}>
      <group>
        <RoundedBox args={[1.7, 1.4, 1.2]} radius={0.09} smoothness={6} position={[0, 0, 0]}>
          <meshPhysicalMaterial
            color="#4f46e5"
            roughness={0.25}
            metalness={0.15}
            clearcoat={0.4}
            clearcoatRoughness={0.3}
          />
        </RoundedBox>

        {/* lid, slightly open */}
        <RoundedBox args={[1.74, 0.1, 1.26]} radius={0.05} position={[0, 0.82, 0]} rotation={[0.14, 0, 0]}>
          <meshPhysicalMaterial color="#4338ca" roughness={0.3} metalness={0.2} />
        </RoundedBox>

        {/* slot */}
        <RoundedBox args={[0.92, 0.06, 0.1]} radius={0.03} position={[0, 0.76, 0]}>
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </RoundedBox>

        {/* face detail */}
        <RoundedBox args={[0.8, 0.34, 0.04]} radius={0.03} position={[0, -0.2, 0.61]}>
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </RoundedBox>
        <RoundedBox args={[0.34, 0.34, 0.02]} radius={0.03} position={[0, -0.2, 0.64]}>
          <meshStandardMaterial color="#c7d2fe" roughness={0.6} />
        </RoundedBox>
      </group>
    </Float>
  );
}

function Scene() {
  const group = useRef();
  useFrame((state) => {
    group.current.rotation.y = state.clock.elapsedTime * 0.14;
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 4, 4]} intensity={30} color="#818cf8" />
      <pointLight position={[-4, -2, 3]} intensity={20} color="#22d3ee" />
      <directionalLight position={[0, 6, -4]} intensity={1.2} color="#ffffff" />

      <group ref={group}>
        <BallotBox />
        {[0, 1, 2, 3].map((i) => (
          <FallingBallot key={i} index={i} />
        ))}
      </group>

      <Sparkles count={90} scale={[7, 5, 4]} size={2.4} speed={0.35} opacity={0.7} color="#a5b4fc" />

      {/* ground shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.02, 0]}>
        <circleGeometry args={[1.7, 48]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} />
      </mesh>
    </>
  );
}

export default function BallotSceneContent() {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 5.4], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <Scene />
    </Canvas>
  );
}
