import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-lg shadow-slate-200/40 dark:shadow-black/20 p-6 border border-slate-200/80 dark:border-slate-700/60 transition-all duration-300 hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500 ${className}`}
    >
      {children}
    </div>
  );
};