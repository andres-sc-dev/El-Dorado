// Logo real de El Dorado: WebP de 840x280 (proporción 3:1, fondo transparente; el PNG original
// pesaba 801 KB). Ya incluye el nombre y la frase, así que no se le agrega texto al lado.
// width y height fijos evitan saltos al cargar; object-contain impide que se deforme.
//   compact: barra de navegación, 36 px de alto en móvil y 48 px desde 640 px.
import logo from '../../assets/el-dorado.webp';

function BrandMark({ compact = false }) {
  return (
    <div className="flex items-center">
      <img
        src={logo}
        alt="El Dorado, apuestas del fútbol colombiano"
        width={compact ? 144 : 192}
        height={compact ? 48 : 64}
        decoding="async"
        className={compact ? 'h-9 w-[108px] object-contain sm:h-12 sm:w-36' : 'h-16 w-48 object-contain'}
      />
    </div>
  );
}

export default BrandMark;
