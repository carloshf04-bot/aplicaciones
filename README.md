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
| `docs/notas/` | **La Gaceta**, app de notas para iPhone y Windows (ver más abajo) |

### Publicar la política de privacidad con GitHub Pages

En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, rama `main`, carpeta `/docs`.
La política quedará en `https://carloshf04-bot.github.io/aplicaciones/privacy.html` (y los términos en `terms.html`).
Antes, rellena en `docs/privacy.html` y `docs/terms.html` los textos marcados en amarillo.

### Instalar Macrolab en el iPhone (sin App Store)

Con GitHub Pages activado, la app queda en `https://carloshf04-bot.github.io/aplicaciones/app/`.
Ábrela en **Safari**, pulsa **Compartir** y luego **Añadir a pantalla de inicio**. Se abre a pantalla completa, con su icono,
y funciona sin conexión. Si cambias `macrolab/www`, copia la carpeta a `docs/app` para actualizarla.

## La Gaceta · notas para iPhone y Windows

App de notas con aspecto de periódico: la portada muestra tus libretas como noticias (la última que tocaste sale en
primera plana) y cada nota es una libreta con tapa de color e índice, dentro de la cual creas, ordenas y arrancas páginas.
Funciona sin conexión y, con una cuenta, tiene las mismas libretas en todos tus dispositivos.

Es una app web instalable (no necesita App Store ni Microsoft Store). Con GitHub Pages activado (ver arriba) queda en
`https://carloshf04-bot.github.io/aplicaciones/notas/`.

### Instalarla

- **iPhone:** abre la dirección en **Safari** → **Compartir** → **Añadir a pantalla de inicio**.
- **Windows:** ábrela en **Edge** → menú **⋯** → **Aplicaciones** → **Instalar este sitio como aplicación**
  (en Chrome, el icono de instalar de la barra de direcciones). Aparece en el menú Inicio como cualquier programa.

En el iPhone, la app instalada guarda sus datos aparte de Safari: entra en tu cuenta desde la app instalada.

### Activar la sincronización (una sola vez, gratis)

Sin esto la app funciona igual, pero cada dispositivo guarda sus propias libretas. Para compartirlas se usa
[Firebase](https://console.firebase.google.com) (plan gratuito Spark, de sobra para notas personales):

1. En la consola de Firebase, **Añadir proyecto** (puedes desactivar Google Analytics).
2. **Authentication → Comenzar → Correo electrónico/contraseña → Habilitar → Guardar.**
3. **Firestore Database → Crear base de datos** → ubicación en Europa (`eur3`) → **modo de producción**.
   En la pestaña **Reglas**, sustituye el contenido por esto y pulsa **Publicar**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

   Así cada cuenta solo puede leer y escribir sus propias notas.
4. **Configuración del proyecto (⚙) → Tus apps → icono web `</>`** → ponle un nombre → **Registrar app**.
   Copia los valores de `firebaseConfig` en [`docs/notas/firebase-config.js`](docs/notas/firebase-config.js) y súbelo a `main`.
5. **Authentication → Configuración → Dominios autorizados → Añadir dominio:** `carloshf04-bot.github.io`.

Después, en cada dispositivo pulsa **Cuenta**: la primera vez **Crear cuenta** y en los demás **Entrar** con el mismo
correo. Las libretas que ya tuvieras se suben al entrar. Si dos dispositivos cambian la misma página, se queda la versión
más reciente. En **Cuenta** también puedes descargar una copia de seguridad en un archivo y cargarla después.

| Archivo | Qué hace |
|---|---|
| `docs/notas/index.html` | Estructura y estilos (portada de periódico, libretas, páginas pautadas) |
| `docs/notas/app.js` | Libretas, páginas, búsqueda y guardado en el dispositivo |
| `docs/notas/sync.js` | Cuenta y sincronización con Firebase |
| `docs/notas/firebase-config.js` | Datos de tu proyecto de Firebase (vacío = sin sincronizar) |
| `docs/notas/sw.js` | Funcionamiento sin conexión |
