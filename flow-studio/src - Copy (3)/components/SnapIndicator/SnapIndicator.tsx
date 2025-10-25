import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SnapIndicatorProps {
  position: number | null; // Time position in seconds
  zoom: number; // pixels per second
}

export const SnapIndicator: React.FC<SnapIndicatorProps> = ({ position, zoom }) => {
  if (position === null) return null;

  // IMPORTANT: Add track header width offset
  // Clips are positioned relative to track lanes (after 192px headers)
  // But the indicator is positioned relative to timeline container (includes headers)
  const TRACK_HEADER_WIDTH = 192;
  const left = position * zoom + TRACK_HEADER_WIDTH;

  return (
    <AnimatePresence>
      <motion.div
        className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 pointer-events-none z-30 shadow-lg"
        style={{ left: `${left}px` }}
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: 1, scaleY: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
      >
        {/* Top indicator */}
        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full" />
        {/* Bottom indicator */}
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full" />
      </motion.div>
    </AnimatePresence>
  );
};
