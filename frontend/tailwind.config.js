import defaultTheme from 'tailwindcss/defaultTheme';

// Fase 7: paleta "Futurista". Los componentes usan solo estos tokens, nunca hexadecimales sueltos.
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      screens: {
        // Teléfonos de 400 px o más: ahí cabe el nombre "EL DORADO" junto al logo.
        xs: '400px',
      },
      colors: {
        night: '#050B16', // fondo de página
        surface: {
          DEFAULT: '#0A1424', // superficie de paneles
          2: '#12203A', // superficie 2: cuotas, campos y bloques internos
        },
        line: {
          DEFAULT: '#1E3354', // líneas y bordes finos
          strong: '#2A4065', // bordes que deben resaltar un poco más
        },
        gold: '#F5B942', // color principal
        steel: '#7FA6D4', // acento secundario apagado (azul acero, no neón)
        ink: {
          DEFAULT: '#E6EEFA', // texto
          muted: '#8FA6C6', // texto atenuado (contraste mayor a 4.5:1 sobre el fondo y la superficie 2)
        },
      },
      fontFamily: {
        display: ['"Chakra Petch"', ...defaultTheme.fontFamily.sans],
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        mono: ['"JetBrains Mono"', ...defaultTheme.fontFamily.mono],
      },
      dropShadow: {
        // Resplandor dorado de la cuota seleccionada. Es un filtro en un contenedor externo
        // porque una sombra normal quedaría recortada por el clip-path de la esquina.
        glow: '0 0 10px rgb(245 185 66 / 0.45)',
      },
    },
  },
  plugins: [],
};
