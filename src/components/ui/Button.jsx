export default function Button({ children, variant = 'primary', disabled, onClick, className = '', ...props }) {
  const base = 'btn';
  const variants = {
    primary: 'btn-primary',
    ghost: 'btn-ghost',
    submit: 'btn-primary btn-submit',
  };

  return (
    <button
      className={`${base} ${variants[variant] || ''} ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
