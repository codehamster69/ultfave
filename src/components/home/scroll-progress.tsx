"use client";

import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Slim reading-progress accent pinned above the sticky nav. The motion value is
 * only attached after mount so server markup renders a zero-width bar.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const reduce = useReducedMotion();
  const smoothed = useSpring(scrollYProgress, { stiffness: 160, damping: 26, restDelta: 0.001 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const value = reduce ? scrollYProgress : smoothed;

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-lime via-peri to-magenta shadow-[0_0_14px_rgba(255,82,54,0.45)]"
      style={mounted ? { scaleX: value } : { scaleX: 0 }}
    />
  );
}
