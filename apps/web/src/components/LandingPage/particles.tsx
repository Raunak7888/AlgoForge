"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/reducedMotion";

type ParticleStyle = {
  width: number;
  height: number;
  left: string;
  top: string;
  background: string;
  duration: number;
  delay: number;
};

// ✅ deterministic random generator
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

function createParticle(i: number): ParticleStyle {
  return {
    width: seededRandom(i + 1) * 3 + 1,
    height: seededRandom(i + 2) * 3 + 1,
    left: `${seededRandom(i + 3) * 100}%`,
    top: `${seededRandom(i + 4) * 100}%`,
    background: `hsl(${seededRandom(i + 5) * 60 + 200}, 80%, 70%)`,
    duration: seededRandom(i + 6) * 8 + 5,
    delay: seededRandom(i + 7) * 5,
  };
}

const IndividualParticle = ({ style }: { style: ParticleStyle }) => {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: style.width,
        height: style.height,
        left: style.left,
        top: style.top,
        background: style.background,
        opacity: 0.25,
      }}
      animate={{
        y: [0, -40, 0],
        opacity: [0.15, 0.5, 0.15],
      }}
      transition={{
        duration: style.duration,
        repeat: Infinity,
        delay: style.delay,
        ease: "easeInOut",
      }}
    />
  );
};

export default function ParticleBg() {
  const [mounted, setMounted] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const particles = Array.from({ length: 30 }, (_, i) => createParticle(i));

  // Return null or a placeholder div on the server
  if (!mounted || reduced) return <div className="absolute inset-0" />;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((style, i) => (
        <IndividualParticle key={i} style={style} />
      ))}
    </div>
  );
}