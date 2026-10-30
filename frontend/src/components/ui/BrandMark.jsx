import logo from '../../assets/el-dorado.png';

function BrandMark({ compact = false }) {
  return (
    <div className={compact ? 'flex items-center' : 'flex items-center'}>
      <img
        src={logo}
        alt="El Dorado — Apuestas del Fútbol Colombiano"
        className={compact ? 'h-12 w-auto max-w-[220px] object-contain' : 'h-16 w-auto max-w-[420px] object-contain'}
      />
    </div>
  );
}

export default BrandMark;
