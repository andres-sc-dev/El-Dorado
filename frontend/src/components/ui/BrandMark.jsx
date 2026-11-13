// WebP de 840x280 (61 KB; el PNG original pesaba 801 KB). width y height fijos evitan saltos al cargar.
import logo from '../../assets/el-dorado.webp';

// compact: hexágono dorado con estrella y el texto "EL DORADO" (barra de navegación).
// El texto se oculta por debajo de 640 px para que la barra quepa en 360 px.
function HexStar() {
  return (
    <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true" className="h-9 w-9 shrink-0 text-gold">
      <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <polygon
        points="20,11 22.23,16.93 28.56,17.22 23.61,21.17 25.29,27.28 20,23.8 14.71,27.28 16.39,21.17 11.44,17.22 17.77,16.93"
        fill="currentColor"
      />
    </svg>
  );
}

function BrandMark({ compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2.5">
        <HexStar />
        <span className="hidden font-display text-lg font-bold uppercase leading-none tracking-[0.22em] text-ink sm:inline">
          El <span className="text-gold">Dorado</span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <img
        src={logo}
        alt="El Dorado — Apuestas del Fútbol Colombiano"
        width={192}
        height={64}
        decoding="async"
        className="h-16 w-48 object-contain"
      />
    </div>
  );
}

export default BrandMark;
