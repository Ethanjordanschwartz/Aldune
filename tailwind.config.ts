import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#172A3A', 2: '#4A5B67' },
        paper: '#F4F6F3',
        line: '#D5DCD6',
        ledger: { DEFAULT: '#1E6B52', tint: '#DCEDE5' },
        marker: '#F2CF3D',
        risk: { low: '#2F7D4F', moderate: '#B08900', elevated: '#C2671A', high: '#B42318', critical: '#7A1410' }
      },
      fontFamily: { sans: ['"Public Sans"', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
};
export default config;
