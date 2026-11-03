"use client";

import { motion } from "framer-motion";

interface ModalBackdropProps {
  onClose: () => void;
}

export function ModalBackdrop({ onClose }: ModalBackdropProps) {
  return (
    <motion.div
      className="fixed inset-0 z-40 cursor-pointer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClose}
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.95) 100%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Scan-line effect */}
      <div className="animate-scan-line pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
    </motion.div>
  );
}