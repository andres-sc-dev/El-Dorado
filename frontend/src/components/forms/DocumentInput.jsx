import { formatDocument } from '../../utils/format';

// Cédula con puntos de miles mientras se escribe (1.234.567.890), sin enmascarar.
// value y onChange trabajan con los dígitos sin puntos: eso es lo que se envía a la API.
function DocumentInput({ id = 'documentNumber', value, onChange, maxDigits = 10, ...props }) {
  const handleChange = (event) => {
    const digits = event.target.value.replace(/\D/g, '').slice(0, maxDigits);
    onChange(digits);
  };

  return (
    <input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      value={value ? formatDocument(value) : ''}
      onChange={handleChange}
      className="form-input"
      {...props}
    />
  );
}

export default DocumentInput;
