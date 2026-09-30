# Despliegue · colecta.vidamas.uno

| | |
|---|---|
| Servidor | `217.77.3.87` · Ubuntu 24.04 · nginx 1.24 (compartido con softwarecubo.com) |
| Acceso | `root` por llave SSH (`~/.ssh/id_rsa`, cargada en el agente con `ssh-add --apple-use-keychain`) |
| Docroot | `/var/www/colecta.vidamas.uno/html` (dueño `www-data`) |
| nginx | `/etc/nginx/sites-available/colecta.vidamas.uno` = `deploy/nginx-colecta.vidamas.uno.conf` |
| Certificado | Let's Encrypt, `certbot certonly --webroot`, email `cegonmen@gmail.com` |
| Renovación | `certbot.timer` (automática) + `renew_hook = systemctl reload nginx` |

## Publicar cambios

```bash
pnpm deploy:prod
```

Hace install en frío → build → audit → `rsync --delete` de `dist/` → verifica que responda 200.

## Cambiar la config de nginx

1. Editar `deploy/nginx-colecta.vidamas.uno.conf` en el repo.
2. Subir y recargar solo si `nginx -t` pasa (si falla, se restaura la anterior):

```bash
scp deploy/nginx-colecta.vidamas.uno.conf root@217.77.3.87:/etc/nginx/sites-available/colecta.vidamas.uno.new
ssh root@217.77.3.87 'cd /etc/nginx/sites-available && cp colecta.vidamas.uno colecta.vidamas.uno.bak && mv colecta.vidamas.uno.new colecta.vidamas.uno && (nginx -t && systemctl reload nginx && rm colecta.vidamas.uno.bak) || (mv colecta.vidamas.uno.bak colecta.vidamas.uno && echo ROLLBACK)'
```

El bloque :80 debe conservar `location ^~ /.well-known/acme-challenge/`, que usa la renovación por webroot.

## Certificado

```bash
ssh root@217.77.3.87 'certbot certificates --cert-name colecta.vidamas.uno'
ssh root@217.77.3.87 'certbot renew --cert-name colecta.vidamas.uno --dry-run'
```

## Post-deploy (una sola vez)

- PageSpeed Insights: https://pagespeed.web.dev/analysis?url=https://colecta.vidamas.uno/
- Rich Results Test (Event): https://search.google.com/test/rich-results?url=https://colecta.vidamas.uno/
- Google Search Console: dar de alta `colecta.vidamas.uno`, enviar `sitemap.xml`, solicitar indexación.
- Vista previa al compartir: https://developers.facebook.com/tools/debug/ → "Scrape again".
- Enlazar el subdominio desde https://vidamas.uno/.

## Nota

El aviso `protocol options redefined for 0.0.0.0:443` que imprime `nginx -t` viene de
`ugaldesolis.softwarecubo.com` (declara `listen 443 ssl` sin `http2` mientras los demás sí).
Es preexistente e inofensivo.
