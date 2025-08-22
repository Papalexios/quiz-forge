import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'normal' | 'large';
}

export const Button: React.FC<ButtonProps> = ({ children, className = '', variant = 'primary', size = 'normal', ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm';

  const sizeClasses = {
    normal: 'px-4 py-2 text-sm',
    large: 'px-6 py-3 text-base',
  };

  const variantClasses = {
    primary: 'text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 transform hover:scale-[1.02] border-transparent',
    secondary: 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md hover:bg-slate-50 dark:hover:bg-slate-700/90 focus:ring-blue-500',
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};