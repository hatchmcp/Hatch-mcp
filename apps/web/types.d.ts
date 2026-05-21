// Side-effect CSS imports — Next.js handles them at build time, but TS needs
// to know the module shape so `import './globals.css'` doesn't error.
declare module '*.css'
