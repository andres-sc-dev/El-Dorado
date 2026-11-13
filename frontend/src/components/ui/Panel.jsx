// Panel con esquinas cortadas y borde fino: el contenedor externo tiene el color del borde y
// 1 px de padding; el interno, el fondo. Así el borde también se ve en las diagonales.
//   as: etiqueta del contenedor externo (div, section, article, aside…); recibe ...rest (aria, role).
//   tone: color del borde. size: 'lg' (16 px) o 'sm' (8 px).
//   className: contenedor externo (márgenes, ancho). innerClassName: contenido (padding, layout).
const TONES = {
  line: 'bg-line',
  strong: 'bg-line-strong',
  steel: 'bg-steel/70',
  gold: 'bg-gold',
  danger: 'bg-red-400/60',
  success: 'bg-emerald-400/60',
};

function Panel({ as: Tag = 'div', tone = 'line', size = 'lg', className = '', innerClassName = '', children, ...rest }) {
  const cut = size === 'sm' ? 'cut-s' : 'cut';
  return (
    <Tag className={`${cut} p-px ${TONES[tone] ?? TONES.line} ${className}`.trim()} {...rest}>
      <div className={`${cut} h-full bg-surface ${innerClassName}`.trim()}>{children}</div>
    </Tag>
  );
}

export default Panel;
