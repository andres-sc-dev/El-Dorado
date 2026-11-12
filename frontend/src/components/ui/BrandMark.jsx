// WebP de 840x280 (61 KB; el PNG original pesaba 801 KB). width y height fijos evitan saltos al cargar.
import logo from '../../assets/el-dorado.webp';

function BrandMark({ compact = false }) {
  return (
    <div className={compact ? 'flex items-center' : 'flex items-center'}>
      <img
        src={logo}
        alt="El Dorado — Apuestas del Fútbol Colombiano"
        width={compact ? 144 : 192}
        height={compact ? 48 : 64}
        decoding="async"
        className={compact ? 'h-12 w-36 object-contain' : 'h-16 w-48 object-contain'}
      />
    </div>
  );
}

export default BrandMark;
