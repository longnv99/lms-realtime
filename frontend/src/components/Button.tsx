import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Button as ShadcnButton } from './ui/button';

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
  const shadcnVariant = variant === 'primary' ? 'default' : variant;
  const shadcnSize = iconOnly ? 'icon' : 'default';

  return (
    <ShadcnButton
      className={className}
      size={shadcnSize}
      type={type}
      variant={shadcnVariant}
      {...props}
    >
      {icon}
      {!iconOnly && children}
    </ShadcnButton>
  );
}
