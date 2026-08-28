import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  iconOnly?: boolean;
  variant?: ButtonVariant;
};

export function Button({
  children,
  className = '',
  icon,
  iconOnly = false,
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const classes = [
    'button',
    `button-${variant}`,
    iconOnly ? 'button-icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} type={type} {...props}>
      {icon}
      {!iconOnly && children}
    </button>
  );
}
