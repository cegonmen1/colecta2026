# Despliegue · colecta.vidamas.uno

Servidor: `217.77.3.87` (nginx 1.24 / Ubuntu). DNS ya resuelve. Hoy el subdominio cae en el
server block por defecto, que redirige a `softwarecubo.com`; por eso hace falta un bloque propio.

## 1. Build local

```bash
pnpm install --frozen-lockfile
pnpm build            # genera dist/
pnpm preview          # opcional: http://localhost:4173
```

`pnpm images` solo si cambias fotos o fuentes en `assets/` o `fonts/` (requiere avifenc, cwebp,
rsvg-convert y Pillow/fonttools).

## 2. Subir archivos

```bash
ssh <usuario>@217.77.3.87 'sudo mkdir -p /var/www/colecta.vidamas.uno && sudo chown $USER /var/www/colecta.vidamas.uno'
rsync -avz --delete dist/ <usuario>@217.77.3.87:/var/www/colecta.vidamas.uno/
```

## 3. nginx

```bash
scp deploy/nginx-colecta.vidamas.uno.conf <usuario>@217.77.3.87:/tmp/
ssh <usuario>@217.77.3.87
sudo mv /tmp/nginx-colecta.vidamas.uno.conf /etc/nginx/sites-available/colecta.vidamas.uno
sudo ln -s /etc/nginx/sites-available/colecta.vidamas.uno /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 4. HTTPS (obligatorio para SEO y Lighthouse)

```bash
sudo apt install -y certbot python3-certbot-nginx     # si no está
sudo certbot --nginx -d colecta.vidamas.uno --redirect
```

Certbot agrega el bloque 443 y el redirect 80→443. Después, dentro del bloque 443, se puede
activar HTTP/2 (`http2 on;`) y HSTS:
`add_header Strict-Transport-Security "max-age=31536000" always;`

## 5. Post-deploy

- PageSpeed Insights: https://pagespeed.web.dev/analysis?url=https://colecta.vidamas.uno/
- Rich Results Test (Event): https://search.google.com/test/rich-results?url=https://colecta.vidamas.uno/
- Google Search Console: dar de alta `colecta.vidamas.uno`, enviar `sitemap.xml`, solicitar indexación.
- Previsualización al compartir: https://developers.facebook.com/tools/debug/ (WhatsApp usa la misma OG).
- Enlazar el subdominio desde https://vidamas.uno/ (un link desde el dominio principal acelera la indexación).
