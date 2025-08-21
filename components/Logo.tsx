import React from 'react';
import { motion, Variants, SVGMotionProps } from 'framer-motion';

export const Logo: React.FC<SVGMotionProps> = (props) => {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { scale: 0, opacity: 0, rotate: -30 },
    visible: {
      scale: 1,
      opacity: 1,
      rotate: 0,
      transition: {
        type: 'spring',
        stiffness: 260,
        damping: 15,
      },
    },
  };

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      {...props}
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'var(--tw-gradient-from, #3b82f6)', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: 'var(--tw-gradient-to, #a855f7)', stopOpacity: 1 }} />
        </linearGradient>
      </defs>

      {/* Main question mark shape */}
      <motion.path
        d="M10 10.5c0-2.5 2-4.5 4.5-4.5 2.22 0 4.04 1.58 4.43 3.65"
        stroke="url(#logo-gradient)"
        strokeWidth="2"
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          visible: { pathLength: 1, opacity: 1, transition: { duration: 0.8, ease: "easeInOut" } }
        }}
      />
      <motion.path
        d="M12.5 14.5v-1.08c0-.62.25-1.2.69-1.64.44-.44 1.02-.69 1.64-.69h.3"
        stroke="url(#logo-gradient)"
        strokeWidth="2"
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          visible: { pathLength: 1, opacity: 1, transition: { duration: 0.5, ease: "easeInOut", delay: 0.6 } }
        }}
      />
      <motion.circle 
        cx="14.5" 
        cy="18.5" 
        r="1" 
        fill="url(#logo-gradient)" 
        stroke="none"
        variants={itemVariants} 
      />

      {/* Sparkle elements */}
      <motion.path
        d="M8.5 4.5l-.8-2- .8 2L5 3.7l1.9.8L5 5.3l1.9-.8z"
        fill="url(#logo-gradient)"
        stroke="none"
        variants={itemVariants}
      />
      <motion.path
        d="M3.5 10.5l-2-.8.8 1.9-.8 1.9 2-.8 1.1 1.6.8-2 .8 2 1.1-1.6z"
        fill="url(#logo-gradient)"
        stroke="none"
        variants={itemVariants}
      />
       <motion.path
        d="M19 14l.8 2 .8-2 1.9.8-1.9.8 1.9.8-1.9-.8-.8 2-.8-2-1.9-.8 1.9-.8z"
        fill="url(#logo-gradient)"
        stroke="none"
        variants={itemVariants}
      />
    </motion.svg>
  );
};
