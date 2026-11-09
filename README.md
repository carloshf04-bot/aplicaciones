# Aplicaciones

## Macrolab

Calculadora de calorías y macros con menú semanal a medida, lista de la compra y plan Pro.

| Carpeta | Qué contiene |
|---|---|
| `macrolab/` | Proyecto Capacitor de la app para Android e iOS. Instrucciones en [`macrolab/README.md`](macrolab/README.md) |
| `macrolab/store/` | Textos de la ficha de App Store y Google Play, capturas, gráfico destacado e icono |
| `web/macrolab.html` | Versión web gratuita en un solo archivo (ábrela con doble clic) |
| `web/macrolab-pro.html` | Versión web con plan gratis y Pro en modo demostración |
| `docs/` | Página de inicio, la app web instalable (`docs/app/`), política de privacidad y términos, listos para GitHub Pages |

### Publicar la política de privacidad con GitHub Pages

En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, rama `main`, carpeta `/docs`.
La política quedará en `https://carloshf04-bot.github.io/aplicaciones/privacy.html` (y los términos en `terms.html`).
Antes, rellena en `docs/privacy.html` y `docs/terms.html` los textos marcados en amarillo.

### Instalar Macrolab en el iPhone (sin App Store)

Con GitHub Pages activado, la app queda en `https://carloshf04-bot.github.io/aplicaciones/app/`.
Ábrela en **Safari**, pulsa **Compartir** y luego **Añadir a pantalla de inicio**. Se abre a pantalla completa, con su icono,
y funciona sin conexión. Si cambias `macrolab/www`, copia la carpeta a `docs/app` para actualizarla.
