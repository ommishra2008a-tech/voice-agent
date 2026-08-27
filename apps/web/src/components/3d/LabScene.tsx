"use client";

import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sphere, Float, Ring, Torus, Box, Cylinder, Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

interface LabSceneProps {
  mode?: "3d" | "2d";
  state?: string;
  isSpeaking?: boolean;
  performanceTier?: "ultra" | "high" | "medium" | "low";
  currentViseme?: string; // "A" | "E" | "I" | "O" | "U" | "SILENCE"
  audioAmplitude?: number; // 0.0 to 1.0
}

interface TrailPoint {
  x: number;
  y: number;
  age: number;
  speed: number;
  hue: number;
}

interface ClickPulse {
  id: number;
  x: number;
  y: number;
  radius: number;
  opacity: number;
}

// 3D AI Research Assistant in Deep Space Cyber Atmosphere
function AIResearchAssistantAvatar({
  state = "IDLE",
  isSpeaking = false,
  viseme = "SILENCE",
  amplitude = 0.0,
  performanceTier = "high"
}: {
  state: string;
  isSpeaking: boolean;
  viseme?: string;
  amplitude?: number;
  performanceTier?: string;
}) {
  const headGroupRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime();

    // 1. Organic Head Posture Tracking & Idle Breathing
    if (headGroupRef.current) {
      const targetRotY = pointer.x * 0.35 + Math.sin(t * 0.7) * 0.05;
      const targetRotX = -pointer.y * 0.2 + Math.sin(t * 1.1) * 0.03;
      headGroupRef.current.rotation.y = THREE.MathUtils.lerp(headGroupRef.current.rotation.y, targetRotY, 0.04);
      headGroupRef.current.rotation.x = THREE.MathUtils.lerp(headGroupRef.current.rotation.x, targetRotX, 0.04);
      headGroupRef.current.position.y = Math.sin(t * 1.4) * 0.04;
    }

    // 2. Viseme Mapping for Real Audio Lip-Sync
    if (mouthRef.current) {
      let targetScaleY = 0.12;
      let targetScaleX = 1.0;

      if (isSpeaking || amplitude > 0.03) {
        const amp = Math.max(0.2, Math.min(1.0, amplitude * 2.2));
        switch (viseme) {
          case "A":
            targetScaleY = 1.3 * amp;
            targetScaleX = 0.95;
            break;
          case "E":
            targetScaleY = 0.6 * amp;
            targetScaleX = 1.4;
            break;
          case "I":
            targetScaleY = 0.35 * amp;
            targetScaleX = 1.5;
            break;
          case "O":
            targetScaleY = 1.5 * amp;
            targetScaleX = 0.75;
            break;
          case "U":
            targetScaleY = 0.9 * amp;
            targetScaleX = 0.6;
            break;
          default:
            targetScaleY = (0.25 + Math.abs(Math.sin(t * 16.0)) * 0.75) * amp;
            targetScaleX = 1.0;
        }
      }

      mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, targetScaleY, 0.3);
      mouthRef.current.scale.x = THREE.MathUtils.lerp(mouthRef.current.scale.x, targetScaleX, 0.3);
    }

    // 3. Blinking & Eye Animation
    const blinkCycle = Math.sin(t * 2.2);
    const eyeScaleY = blinkCycle > 0.97 ? 0.08 : 1.0;
    if (leftEyeRef.current) leftEyeRef.current.scale.y = eyeScaleY;
    if (rightEyeRef.current) rightEyeRef.current.scale.y = eyeScaleY;

    // 4. Audio-Reactive Energy Aura & Orbital Rings
    if (auraRef.current) {
      const auraScale = isSpeaking ? 1.12 + amplitude * 0.3 : 1.04 + Math.sin(t * 1.8) * 0.03;
      auraRef.current.scale.set(auraScale, auraScale, auraScale);
    }

    if (ringRef.current) {
      const rotSpeed = isSpeaking ? 1.5 : 0.6;
      ringRef.current.rotation.z = -t * rotSpeed;
      ringRef.current.rotation.x = Math.PI / 3.2 + Math.sin(t * 0.5) * 0.1;
    }
  });

  const getThemeColor = () => {
    switch (state) {
      case "PROCESSING":
      case "GENERATING":
        return { primary: "#00f0ff", secondary: "#38bdf8", eye: "#00f0ff", core: "#070e22" };
      case "TRANSLATING":
        return { primary: "#38bdf8", secondary: "#60a5fa", eye: "#93c5fd", core: "#07132a" };
      case "DIARIZING":
      case "ANALYZING":
        return { primary: "#a855f7", secondary: "#c084fc", eye: "#e9d5ff", core: "#100922" };
      case "READY":
      case "COMPLETED":
        return { primary: "#10b981", secondary: "#34d399", eye: "#6ee7b7", core: "#061814" };
      default:
        return { primary: "#00f0ff", secondary: "#3b82f6", eye: "#38bdf8", core: "#081024" };
    }
  };

  const theme = getThemeColor();

  return (
    <group position={[0, 0.4, 0]}>
      <Float speed={1.8} rotationIntensity={0.2} floatIntensity={0.35}>
        <group ref={headGroupRef}>
          {/* Main Cyber Face Mask Chassis */}
          <Sphere args={[0.95, 36, 36]} scale={[1.0, 1.15, 1.0]}>
            <meshStandardMaterial
              color={theme.core}

              roughness={0.2}
              metalness={0.9}
              emissive={theme.primary}
              emissiveIntensity={isSpeaking ? 0.25 + amplitude * 0.4 : 0.1}
            />
          </Sphere>

          {/* Audio-Reactive Outer Energy Aura */}
          <Sphere ref={auraRef} args={[1.04, 24, 24]} scale={[1.0, 1.15, 1.0]}>
            <meshBasicMaterial
              color={theme.primary}
              transparent
              opacity={isSpeaking ? 0.25 + amplitude * 0.3 : 0.08}
              wireframe={performanceTier !== "low"}
            />
          </Sphere>

          {/* Cyber Visor Brow Shield */}
          <Torus args={[0.94, 0.08, 16, 48, Math.PI * 0.9]} position={[0, 0.22, 0.45]} rotation={[0.08, 0, 0]}>
            <meshStandardMaterial
              color="#02050e"
              emissive="#00f0ff"
              emissiveIntensity={1.8}
              roughness={0.1}
              metalness={0.95}
            />
          </Torus>

          {/* Left Glowing Cyber Eye */}
          <Sphere ref={leftEyeRef} args={[0.13, 24, 24]} position={[-0.30, 0.22, 0.86]}>
            <meshBasicMaterial color="#00f0ff" />
          </Sphere>

          {/* Right Glowing Cyber Eye */}
          <Sphere ref={rightEyeRef} args={[0.13, 24, 24]} position={[0.30, 0.22, 0.86]}>
            <meshBasicMaterial color="#00f0ff" />
          </Sphere>

          {/* Eye Socket Bezels */}
          <Torus args={[0.15, 0.025, 12, 24]} position={[-0.30, 0.22, 0.84]}>
            <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={0.5} roughness={0.1} metalness={0.95} />
          </Torus>
          <Torus args={[0.15, 0.025, 12, 24]} position={[0.30, 0.22, 0.84]}>
            <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={0.5} roughness={0.1} metalness={0.95} />
          </Torus>


          {/* Dynamic Lip-Sync Mouth Aperture */}
          <Box ref={mouthRef} args={[0.42, 0.08, 0.12]} position={[0, -0.32, 0.86]}>
            <meshStandardMaterial
              color="#02040a"
              emissive={theme.primary}
              emissiveIntensity={isSpeaking ? 1.5 : 0.4}
              roughness={0.2}
            />
          </Box>

          {/* Left & Right Acoustic Node Ears */}
          <Cylinder args={[0.14, 0.14, 0.12, 20]} position={[-0.98, 0.0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <meshStandardMaterial color="#081024" emissive={theme.secondary} emissiveIntensity={0.5} />
          </Cylinder>
          <Cylinder args={[0.14, 0.14, 0.12, 20]} position={[0.98, 0.0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <meshStandardMaterial color="#081024" emissive={theme.secondary} emissiveIntensity={0.5} />
          </Cylinder>

          {/* Orbital Holographic Ring */}
          <Ring ref={ringRef} args={[1.35, 1.42, 48]} position={[0, 0, 0]}>
            <meshBasicMaterial color={theme.primary} transparent opacity={0.4} side={THREE.DoubleSide} />
          </Ring>
        </group>
      </Float>
    </group>
  );
}

// 3D Spatial Audio-Reactive Waveform (Electric Cyan/Blue)
function SpatialWaveform({ isSpeaking = false, amplitude = 0.0 }: { isSpeaking: boolean; amplitude: number }) {
  const barsRef = useRef<THREE.Group>(null);
  const BAR_COUNT = 32;

  useFrame(({ clock }) => {
    if (!barsRef.current) return;
    const t = clock.getElapsedTime();

    barsRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const wave = isSpeaking
        ? Math.sin(t * 10.0 + i * 0.4) * (0.8 + amplitude * 1.6) + 1.0
        : Math.sin(t * 2.0 + i * 0.3) * 0.15 + 0.2;
      mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, Math.max(0.1, wave), 0.2);
    });
  });

  return (
    <group ref={barsRef} position={[0, -1.6, 0]}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const x = (i - BAR_COUNT / 2) * 0.10;
        return (
          <Box key={i} args={[0.05, 0.9, 0.05]} position={[x, 0, 0]}>
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.6} />
          </Box>
        );
      })}
    </group>
  );
}

export default function LabScene({
  mode = "3d",
  state = "IDLE",
  isSpeaking = false,
  performanceTier = "high",
  currentViseme = "SILENCE",
  audioAmplitude = 0.0
}: LabSceneProps) {
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [clickPulses, setClickPulses] = useState<ClickPulse[]>([]);
  const lastMousePos = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: Date.now() });
  const hueCounter = useRef(0);

  // 1. Rainbow / Spectrum Cursor Trail with Multi-Point Spline Progression
  useEffect(() => {
    if (performanceTier === "low" && mode !== "2d") return;

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      const dt = Math.max(1, now - lastMousePos.current.time);
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      const speed = Math.sqrt(dx * dx + dy * dy) / dt;

      lastMousePos.current = { x: e.clientX, y: e.clientY, time: now };
      hueCounter.current = (hueCounter.current + 8) % 360;

      setTrail((prev) => [
        ...prev.slice(-20),
        { x: e.clientX, y: e.clientY, age: 1.0, speed, hue: hueCounter.current }
      ]);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [performanceTier, mode]);

  // Trail decay ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setTrail((prev) =>
        prev
          .map((p) => ({ ...p, age: p.age - 0.08 }))
          .filter((p) => p.age > 0)
      );
    }, 30);
    return () => clearInterval(interval);
  }, []);

  // 2. Holographic Click Pulse Handler (Electric Cyan / Purple Ripple)
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const newPulse: ClickPulse = {
      id: Date.now(),
      x: e.clientX,
      y: e.clientY,
      radius: 10,
      opacity: 0.9
    };
    setClickPulses((prev) => [...prev, newPulse]);

    setTimeout(() => {
      setClickPulses((prev) => prev.filter((p) => p.id !== newPulse.id));
    }, 600);
  };

  if (mode === "2d") {
    return (
      <div
        onClick={handleContainerClick}
        className="w-full h-full min-h-[360px] flex flex-col items-center justify-center bg-gradient-to-b from-[#050814] to-[#0a1226] border border-[#1e293b] rounded-2xl relative overflow-hidden p-6 text-center select-none shadow-2xl"
      >
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-[#00f0ff] to-[#3b82f6] flex items-center justify-center p-1 shadow-2xl shadow-cyan-500/20 mb-4 animate-pulse">
          <div className="w-full h-full rounded-xl bg-[#070d1e] flex items-center justify-center">
            <svg className="w-12 h-12 text-[#00f0ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>
        </div>
        <h3 className="text-base font-bold text-white mb-1">AI Voice Assistant (2D HUD Mode)</h3>
        <p className="text-xs text-slate-400 font-mono">
          State: <span className="text-[#00f0ff] font-bold">{state}</span> | Speaking:{" "}
          <span className="text-white">{isSpeaking ? "Active" : "Idle"}</span>
        </p>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full min-h-[280px] relative rounded-2xl overflow-hidden bg-gradient-to-b from-[#050814] via-[#070e22] to-[#0b142c] border border-[#1e293b] select-none"
    >
      {/* 3D Canvas Scene */}
      <Canvas
        camera={{ position: [0, 0.4, 2.7], fov: 45 }}
        dpr={performanceTier === "ultra" ? 2 : performanceTier === "high" ? 1.5 : 1}
      >
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={1.4} color="#00f0ff" />
        <pointLight position={[-10, -10, -10]} intensity={0.8} color="#a855f7" />

        <AIResearchAssistantAvatar
          state={state}
          isSpeaking={isSpeaking}
          viseme={currentViseme}
          amplitude={audioAmplitude}
          performanceTier={performanceTier}
        />

        <OrbitControls

          enableZoom={false}
          enablePan={false}
          maxPolarAngle={Math.PI / 2 + 0.2}
          minPolarAngle={Math.PI / 3}
        />
      </Canvas>

      {/* Spatial Studio Telemetry Overlay */}
      <div className="absolute top-3 left-4 flex items-center gap-2 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        <span className="text-[11px] font-mono text-slate-400">
          AI Voice Character | <strong className="text-[#00f0ff]">{isSpeaking ? `Speaking (${currentViseme})` : "Idle"}</strong>
        </span>
      </div>
    </div>
  );

}
