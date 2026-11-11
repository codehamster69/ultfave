"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionStyle,
} from "motion/react";

/**
 * Ambient atmosphere for the artist hero: drifting gradient glows, a fine
 * scoreboard grid, film grain and a slow conic sheen. Pure CSS/motion — no
 * canvas, no WebGL, so it server-renders deterministically and stays cheap.
 */
export function ArtistAura({ className = "" }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: hostRef,
    offset: ["start start", "end start"],
  });
  const scrollY = useTransform(scrollYProgress, [0, 1], [0, -56]);
  const _smoothScrollY = useSpring(scrollY, { stiffness: 70, damping: 22, mass: 0.5 });

  // Pointer parallax, only on fine pointers and only when motion is welcome.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 60, damping: 18, mass: 0.4 });
  const springY = useSpring(pointerY, { stiffness: 60, damping: 18, mass: 0.4 });
  const parallaxX = useTransform(springX, (value) => value * 26);
  const parallaxY = useTransform(springY, (value) => value * 18);

  useEffect(() => {
    const host = hostRef.current?.parentElement;
    if (!host || reduce) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    function onMove(event: PointerEvent) {
      const rect = host!.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      pointerX.set(Math.max(-1, Math.min(1, nx)));
      pointerY.set(Math.max(-1, Math.min(1, ny)));
    }

    function onLeave() {
      pointerX.set(0);
      pointerY.set(0);
    }

    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [pointerX, pointerY, reduce]);

  const floatTransform = reduce ? undefined : { x: parallaxX, y: parallaxY };

  return (
    <div ref={hostRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Deep base wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(118deg, #0a0d13 0%, #111623 42%, #0b0e16 72%, #080a0f 100%)",
        }}
      />

      {/* Fine scoreboard grid, masked toward the bottom */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(247,237,227,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(247,237,227,0.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "linear-gradient(180deg, #000 0%, rgba(0,0,0,0.4) 62%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(180deg, #000 0%, rgba(0,0,0,0.4) 62%, transparent 100%)",
        }}
      />

      {/* Drifting glows: outer layer follows the pointer, inner layer floats on its own */}
      <motion.div className="absolute inset-0" style={floatTransform}>
        <motion.div
          className="absolute -right-40 -top-48 h-[30rem] w-[30rem] rounded-full blur-[80px]"
          style={{ background: "radial-gradient(circle, rgba(147,167,255,0.32), transparent 68%)" }}
          animate={
            reduce
              ? undefined
              : { x: [0, 26, -14, 0], y: [0, -20, 12, 0], scale: [1, 1.08, 0.97, 1] }
          }
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-52 -left-32 h-[27rem] w-[27rem] rounded-full blur-[80px]"
          style={{ background: "radial-gradient(circle, rgba(255,82,54,0.2), transparent 68%)" }}
          animate={
            reduce
              ? undefined
              : { x: [0, -22, 16, 0], y: [0, 18, -10, 0], scale: [1, 1.06, 0.95, 1] }
          }
          transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-1/2 top-1/3 h-[20rem] w-[36rem] -translate-x-1/2 rounded-full blur-[90px]"
          style={{ background: "radial-gradient(ellipse, rgba(242,65,124,0.16), transparent 70%)" }}
          animate={reduce ? undefined : { opacity: [0.55, 0.9, 0.55] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      {/* Slow rotating sheen */}
      <motion.div
        className="absolute -left-1/3 -top-1/2 h-[150%] w-[150%] opacity-[0.14]"
        style={{
          background:
            "conic-gradient(from 90deg at 50% 50%, rgba(255,82,54,0) 0deg, rgba(255,82,54,0.22) 60deg, rgba(147,167,255,0) 140deg, rgba(147,167,255,0.16) 250deg, rgba(255,82,54,0) 360deg)",
        }}
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
      />

      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-soft-light"
        style={{ backgroundImage: GRAIN, backgroundSize: "160px 160px" }}
      />

      {/* Bottom fade so content below reads on the page ink */}
      <div
        className="absolute inset-x-0 bottom-0 h-24"
        style={{ background: "linear-gradient(180deg, transparent, rgba(21,10,18,0.75))" }}
      />

      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/60 to-transparent" />
    </div>
  );
}

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)' opacity='0.65'/%3E%3C/svg%3E\")";

/**
 * Subtle scroll parallax for hero layers. Depth > 1 travels further.
 * Renders its children at rest under prefers-reduced-motion.
 */
export function ParallaxLayer({
  children,
  depth = 1,
  className = "",
}: {
  children: ReactNode;
  depth?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const raw = useTransform(scrollYProgress, [0, 1], [depth * 16, depth * -16]);
  const y = useSpring(raw, { stiffness: 90, damping: 26, mass: 0.4 });

  const style: MotionStyle | undefined = reduce
    ? undefined
    : { y, willChange: "transform" };

  return (
    <motion.div ref={ref} className={className} style={style}>
      {children}
    </motion.div>
  );
}
