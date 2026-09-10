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
  const [reducedMotion, setReducedMotion] = useState(false);
  const hueRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    // 1. Accessibility: Detect prefers-reduced-motion
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", handleMotionChange);

    // 2. Strict Viewport Mouse Movement Listener
    const handleMouseMove = (e: MouseEvent) => {
      if (mql.matches) return; // Skip trail points if user prefers reduced motion
      hueRef.current = (hueRef.current + 4) % 360;
      setTrail((prev) => [
        ...prev.slice(-38),
        {
          x: e.clientX,
          y: e.clientY,
          age: 1.0,
          hue: hueRef.current
        }
      ]);
    };

    // 3. Strict Viewport Click Ripple Listener
    // clientX and clientY are exact viewport coordinates
    const handleClick = (e: MouseEvent) => {
      const newRipple: ClickRipple = {
        id: Date.now() + Math.random(),
        x: e.clientX,
        y: e.clientY
      };
      setRipples((prev) => [...prev, newRipple]);

      const timeoutDuration = mql.matches ? 300 : 700;
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, timeoutDuration);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("click", handleClick, { passive: true });

    // 4. Performance-Optimized Trail Decay Loop via requestAnimationFrame
    const updateDecay = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;

      if (delta >= 16) {
        lastTimeRef.current = timestamp;
        setTrail((prev) => {
          // If already empty, return same reference to prevent unneeded re-renders
          if (prev.length === 0) return prev;
          const next = prev
            .map((p) => ({ ...p, age: p.age - 0.032 }))
            .filter((p) => p.age > 0);
          return next.length === 0 && prev.length === 0 ? prev : next;
        });
      }

      animFrameRef.current = requestAnimationFrame(updateDecay);
    };

    animFrameRef.current = requestAnimationFrame(updateDecay);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      mql.removeEventListener("change", handleMotionChange);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes cursor-ripple-expand {
          0% {
            transform: scale(0.15);
            opacity: 0.95;
          }
          50% {
            opacity: 0.8;
          }
          100% {
            transform: scale(2.1);
            opacity: 0;
          }
        }
        @keyframes cursor-dot-fade {
          0% {
            transform: scale(1.0);
            opacity: 1;
          }
          100% {
            transform: scale(0.2);
            opacity: 0;
          }
        }
      `}</style>

      {/* Global Fixed Canvas Viewport Container */}
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
        {/* Rainbow / Continuous HSL Spectrum SVG Lines (Thinner, cleaner stroke) */}
        {!reducedMotion && (
          <svg
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              pointerEvents: "none"
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
                  strokeWidth={Math.max(0.75, p.age * 2.0)}
                  strokeOpacity={Math.min(0.9, p.age * 0.9)}
                  strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0px 0px 3px ${color})`,
                    pointerEvents: "none"
                  }}
                />
              );
            })}
          </svg>
        )}

        {/* 
          Mathematically Centered Click Ripple Anchor
          The parent anchor has position fixed at exactly (ripple.x, ripple.y) with width 0 and height 0.
          The child elements are symmetrically offset around (0, 0) via left/top = -width/2.
          This guarantees the cursor click hotspot (clientX, clientY) is the exact center of the ripple circle,
          regardless of CSS transform overwrites, scrolling, or scaling.
        */}
        {ripples.map((ripple) => (
          <div
            key={ripple.id}
            style={{
              position: "fixed",
              left: `${ripple.x}px`,
              top: `${ripple.y}px`,
              width: 0,
              height: 0,
              pointerEvents: "none",
              zIndex: 10000
            }}
          >
            {/* Symmetrically Centered Expanding Holographic Ripple */}
            <div
              style={{
                position: "absolute",
                left: "-28px",
                top: "-28px",
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                border: "2px solid #00f0ff",
                boxShadow: "0 0 16px rgba(0, 240, 255, 0.7), inset 0 0 8px rgba(168, 85, 247, 0.45)",
                pointerEvents: "none",
                transformOrigin: "center center",
                animation: reducedMotion
                  ? "cursor-dot-fade 0.3s ease-out forwards"
                  : "cursor-ripple-expand 0.65s cubic-bezier(0.1, 0.8, 0.3, 1) forwards"
              }}
            />

            {/* Symmetrically Centered Bright Spark Dot (Exact Hotspot Anchor) */}
            <div
              style={{
                position: "absolute",
                left: "-3px",
                top: "-3px",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#00f0ff",
                boxShadow: "0 0 8px #00f0ff, 0 0 3px #ffffff",
                pointerEvents: "none",
                transformOrigin: "center center",
                animation: "cursor-dot-fade 0.5s ease-out forwards"
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
