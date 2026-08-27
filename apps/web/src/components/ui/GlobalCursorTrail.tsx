"use client";

import React, { useEffect, useRef, useState } from "react";

interface TrailPoint {
  x: number;
  y: number;
  age: number;
  hue: number;
}

interface ClickRipple {
  id: number;
  x: number;
  y: number;
}

export default function GlobalCursorTrail() {
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [ripples, setRipples] = useState<ClickRipple[]>([]);
  const hueRef = useRef(0);

  useEffect(() => {
    // 1. Strict Viewport Mouse Movement Listener
    const handleMouseMove = (e: MouseEvent) => {
      hueRef.current = (hueRef.current + 5) % 360;
      setTrail((prev) => [
        ...prev.slice(-45),
        {
          x: e.clientX,
          y: e.clientY,
          age: 1.0,
          hue: hueRef.current
        }
      ]);
    };

    // 2. Strict Viewport Click Ripple Listener
    const handleClick = (e: MouseEvent) => {
      const newRipple: ClickRipple = {
        id: Date.now(),
        x: e.clientX,
        y: e.clientY
      };
      setRipples((prev) => [...prev, newRipple]);

      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, 700);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("click", handleClick, { passive: true });

    // 3. Smooth, Longer Trail Decay Loop (~1.8x longer dissipation)
    const decayInterval = setInterval(() => {
      setTrail((prev) =>
        prev
          .map((p) => ({ ...p, age: p.age - 0.028 }))
          .filter((p) => p.age > 0)
      );
    }, 20);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      clearInterval(decayInterval);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden",
        margin: 0,
        padding: 0
      }}
    >
      {/* Rainbow / Continuous HSL Spectrum SVG Lines */}
      <svg
        style={{
          width: "100%",
          height: "100%",
          display: "block"
        }}
      >
        {trail.map((p, i) => {
          if (i === 0) return null;
          const prev = trail[i - 1];
          const color = `hsl(${p.hue}, 100%, 65%)`;
          return (
            <line
              key={i}
              x1={prev.x}
              y1={prev.y}
              x2={p.x}
              y2={p.y}
              stroke={color}
              strokeWidth={Math.max(1.8, p.age * 5.2)}
              strokeOpacity={Math.min(1.0, p.age * 0.95)}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0px 0px 8px ${color})` }}
            />
          );
        })}
      </svg>

      {/* Holographic Cyan / Purple Click Ripples (Centered Precisely on Cursor) */}
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          style={{
            position: "fixed",
            left: `${ripple.x}px`,
            top: `${ripple.y}px`,
            transform: "translate(-50%, -50%)",
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            border: "2px solid #00f0ff",
            boxShadow: "0 0 20px rgba(0, 240, 255, 0.7), inset 0 0 10px rgba(168, 85, 247, 0.5)",
            pointerEvents: "none",
            animation: "ping 0.65s cubic-bezier(0, 0, 0.2, 1) forwards",
            opacity: 0.9
          }}
        >
          {/* Centered Bright Spark Dot */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#00f0ff",
              boxShadow: "0 0 8px #00f0ff"
            }}
          />
        </div>
      ))}
    </div>
  );
}
