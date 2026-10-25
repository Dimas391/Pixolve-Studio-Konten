export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Terjadi kesalahan | Pixolve</title>
    <style>
      body { margin: 0; padding: 3rem 1.5rem; color: #292633; background: #faf9fb; font: 16px system-ui, sans-serif; }
      main { max-width: 36rem; margin: 10vh auto; }
      h1 { font-size: 1.75rem; }
      p { color: #625e69; line-height: 1.6; }
    </style>
  </head>
  <body><main><h1>Terjadi kesalahan</h1><p>Halaman tidak dapat dimuat saat ini. Silakan coba lagi.</p></main></body>
</html>`;
}
