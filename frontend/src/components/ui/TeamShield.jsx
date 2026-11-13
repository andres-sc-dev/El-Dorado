import { useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const SIZES = { sm: 'h-6 w-6', md: 'h-10 w-10', lg: 'h-14 w-14' };

// Escudo de un equipo desde GET /api/teams/:teamCode/crest (Drive, archivo local o SVG genérico).
// Carga diferida (loading="lazy") y, si la imagen falla, muestra las iniciales del equipo.
function TeamShield({ team, size = 'md', className = '' }) {
  const [failed, setFailed] = useState(false);
  const code = team?.team_code ?? '???';
  const src = `${API_BASE_URL}${team?.crest_url ?? `/api/teams/${code}/crest`}`;
  const box = `${SIZES[size] ?? SIZES.md} shrink-0 ${className}`;

  if (failed) {
    return (
      <span
        role="img"
        aria-label={`Escudo de ${team?.name ?? code}`}
        className={`${box} inline-flex items-center justify-center rounded-full border border-gold/40 bg-surface-2 font-mono text-[10px] font-bold text-gold`}
      >
        {code}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={`Escudo de ${team?.name ?? code}`}
      loading="lazy"
      decoding="async"
      width={56}
      height={56}
      className={`${box} object-contain`}
      onError={() => setFailed(true)}
    />
  );
}

export default TeamShield;
