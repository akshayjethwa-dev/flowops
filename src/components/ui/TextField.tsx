import React from 'react';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  helperText?: string;
}

export const TextField: React.FC<TextFieldProps> = ({
  id,
  label,
  error,
  helperText,
  className = '',
  required,
  ...props
}) => {
  return (
    <div className="flex flex-col space-y-1.5 w-full">
      <label 
        htmlFor={id} 
        className="block text-xs font-mono font-bold text-slate-500 uppercase tracking-wider"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={id}
        required={required}
        className={`w-full bg-slate-50 border transition-all duration-150 px-3 py-2 text-slate-900 text-xs rounded outline-hidden placeholder:text-slate-450
          ${error 
            ? 'border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-500/20' 
            : 'border-slate-350 hover:border-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20'
          } ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-[11px] text-red-500 font-medium">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-[10px] text-slate-450 font-mono">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};
