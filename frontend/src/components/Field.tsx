import type { InputHTMLAttributes } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  help?: string;
  label: string;
  name: string;
};

export function Field({ error, help, id, label, name, ...props }: FieldProps) {
  const inputId = id ?? name;
  const helpId = help ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <label className="field" htmlFor={inputId}>
      <span className="field-label">{label}</span>
      <input
        aria-describedby={[helpId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? true : undefined}
        className="field-control"
        id={inputId}
        name={name}
        {...props}
      />
      {help && (
        <p className="field-help" id={helpId}>
          {help}
        </p>
      )}
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </label>
  );
}
