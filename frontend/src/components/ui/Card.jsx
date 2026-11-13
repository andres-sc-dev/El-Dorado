import Panel from './Panel';

function Card({ children, className = '' }) {
  return <Panel innerClassName={`p-4 ${className}`.trim()}>{children}</Panel>;
}

export default Card;
