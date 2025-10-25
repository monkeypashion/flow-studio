import React from 'react';
import { motion } from 'framer-motion';

interface GhostClipProps {
  left: number;
  width: number;
  top: number; // Direct top position instead of calculating
  isIncompatible?: boolean;
}

export const GhostClip: React.FC<GhostClipProps> = ({
  left,
  width,
  top,
  isIncompatible = false,
}) => {

  return (
    <motion.div
      className={`
        absolute pointer-events-none
        rounded-md border-2 border-dashed
        ${isIncompatible
          ? 'bg-red-500 bg-opacity-10 border-red-500'
          : 'bg-green-500 bg-opacity-10 border-green-500'
        }
      `}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        top: `${top}px`,
        height: '72px', // Track height (80) - padding (8)
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 0.6, scale: 1 }}
      transition={{ duration: 0.1 }}
    >
      <div className="flex items-center justify-center h-full">
        <span className={`text-sm font-medium ${isIncompatible ? 'text-red-400' : 'text-green-400'}`}>
          {isIncompatible ? 'Incompatible' : 'Drop here'}
        </span>
      </div>
    </motion.div>
  );
};