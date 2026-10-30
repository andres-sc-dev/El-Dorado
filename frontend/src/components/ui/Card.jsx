function Card({ children, className = '' }) {
  return <div className={`glass-panel rounded-2xl p-4 ${className}`.trim()}>{children}</div>;
}

export default Card;
