function Input({ className = '', ...props }) {
  return <input className={`form-input ${className}`.trim()} {...props} />;
}

export default Input;
