'use client'

import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import type { Mesh } from 'three'

function MockModel() {
  const meshRef = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.4
  })
  return (
    <mesh ref={meshRef} castShadow>
      {/* Stylised garment silhouette: tall, slightly wide box */}
      <boxGeometry args={[1.2, 2.2, 0.45]} />
      <meshStandardMaterial
        color="#7c3e22"
        roughness={0.85}
        metalness={0.05}
      />
    </mesh>
  )
}

function GlbModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene} />
}

interface ModelViewerProps {
  modelUrl: string
  isMock?: boolean
}

export default function ModelViewer({ modelUrl, isMock }: ModelViewerProps) {
  return (
    <div className="w-full rounded-2xl overflow-hidden bg-stone-100" style={{ height: 560 }}>
      <Canvas
        camera={{ position: [0, 1, 4], fov: 45 }}
        shadows
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[8, 12, 6]} intensity={1.2} castShadow />
        <directionalLight position={[-6, -4, -6]} intensity={0.25} />

        <Suspense fallback={null}>
          {isMock ? <MockModel /> : <GlbModel url={modelUrl} />}
        </Suspense>

        <OrbitControls
          makeDefault
          enablePan={false}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI * 0.8}
          minDistance={2}
          maxDistance={8}
        />
      </Canvas>
    </div>
  )
}
