import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  variant?: 'default' | 'transparent';
}

export const Input: React.FC<InputProps> = ({ icon, className, variant = 'default', ...props }) => {
  
  const baseClasses = `block w-full sm:text-sm sm:leading-6 transition-all duration-200`;
  
  const variantClasses = {
      default: 'rounded-md border-0 py-2.5 bg-white dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:focus:ring-blue-500',
      transparent: 'bg-transparent border-none ring-0 focus:ring-0 focus:outline-none p-0 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500'
  };

  return (
    <div className="relative">
      {icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <span className="text-slate-500 dark:text-slate-400">{icon}</span>
        </div>
      )}
      <input
        {...props}
        className={`${baseClasses} ${variantClasses[variant]} ${
          icon ? 'pl-10' : variant === 'default' ? 'px-3' : 'px-0'
        } ${className || ''}`}
      />
    </div>
  );
};