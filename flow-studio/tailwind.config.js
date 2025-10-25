/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'clip-idle': '#4a5568',
        'clip-uploading': '#4299e1',
        'clip-processing': '#48bb78',
        'clip-complete': '#38a169',
        'clip-error': '#f56565',
        'timeline-bg': '#1a202c',
        'track-bg': '#2d3748',
        'selection': 'rgba(66, 153, 225, 0.3)',
      },
      animation: {
        'progress': 'progress 2s ease-in-out infinite',
      },
      keyframes: {
        progress: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        }
      }
    },
  },
  plugins: [],
}