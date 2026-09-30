# LLAMANDO 2026 · Colecta Navideña Vida Máxima

Landing estática de la colecta navideña → https://colecta.vidamas.uno/

Sin framework: HTML con CSS/JS inline, imágenes AVIF/WebP responsivas y fuentes subseteadas
self-hosted. El build genera `dist/`, que se sirve tal cual con nginx.

## Estructura

| Ruta | Contenido |
|---|---|
| `src/index.html`, `src/styles.css`, `src/main.js` | Fuente del sitio |
| `src/static/` | Imágenes y fuentes optimizadas (se fingerprintean en el build) |
| `public/` | Archivos con URL estable: `og-image.jpg`, iconos, `robots.txt`, `sitemap.xml` |
| `assets/`, `fonts/` | Originales de alta calidad (entrada de `pnpm images`) |
| `scripts/` | `build.mjs`, `build-images.py`, `serve.mjs` |
| `deploy/` | Config de nginx y guía de despliegue |

## Comandos

```bash
pnpm install --frozen-lockfile
pnpm build      # → dist/
pnpm preview    # http://localhost:4173
pnpm images     # solo si cambian assets/ o fonts/ (avifenc, cwebp, rsvg-convert, Pillow, fonttools)
```

Despliegue: ver `deploy/DEPLOY.md`.
