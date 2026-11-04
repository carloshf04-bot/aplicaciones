# Macrolab · app para iPhone y Android

Proyecto [Capacitor](https://capacitorjs.com) listo para abrir en Android Studio y Xcode.
La app es la versión Pro de Macrolab (con plan gratis y Pro) empaquetada como app nativa.

## Qué hay en la carpeta

| Ruta | Qué es |
|---|---|
| `www/` | La app web: `index.html`, fuentes locales (funciona sin internet), iconos y manifiesto |
| `www/purchases.js` | Capa de pagos. **Ahora en modo demostración**: activa Pro sin cobrar |
| `assets/` | Originales del icono (1024 px) y de la pantalla de inicio (2732 px) |
| `android/` | Proyecto nativo de Android (Android Studio) con iconos ya generados |
| `ios/` | Proyecto nativo de iOS (Xcode) con iconos ya generados |
| `capacitor.config.json` | Nombre, identificador (`com.macrolab.app`), colores de barra y splash |

## Requisitos

- Node.js 18 o superior.
- **Android:** Android Studio (incluye el SDK y Java).
- **iOS:** un Mac con Xcode 15 o superior y CocoaPods (`sudo gem install cocoapods`).
  Sin Mac puedes compilar en la nube con servicios como Codemagic o Ionic Appflow.

## 1. Instalar

```bash
npm install
npx cap sync
```

## 2. Probar en Android

```bash
npm run android
```

Se abre Android Studio. Conecta un móvil (con la depuración USB activada) o crea un emulador y pulsa ▶.

## 3. Probar en iPhone (en un Mac)

```bash
cd ios/App && pod install && cd ../..
npm run ios
```

En Xcode: selecciona el proyecto **App → Signing & Capabilities**, elige tu equipo de desarrollador y pulsa ▶.

## 4. Cada vez que cambies la web

Edita `www/index.html` y después:

```bash
npx cap sync
```

## 5. Cambiar el icono o la pantalla de inicio

Sustituye los PNG de `assets/` (mismo tamaño) y ejecuta:

```bash
npm run icons
npx cap sync
```

## 6. Pagos reales (RevenueCat ya integrado)

`www/purchases.js` ya usa RevenueCat (`@revenuecat/purchases-capacitor`). En el navegador funciona en modo
demostración; **en el móvil no deja comprar hasta que pongas tus claves**, así no se puede publicar por error
una versión que regale Pro.

1. Crea las suscripciones en App Store Connect y Google Play Console: mensual 4,99 € y anual 29,99 €, con 7 días de prueba.
2. En RevenueCat: crea el proyecto, conecta las dos tiendas, crea el *entitlement* `pro` y una *offering* `default`
   con los paquetes *Monthly* y *Annual*.
3. Pega tus claves públicas en `CONFIG` dentro de `www/purchases.js` (`appl_…` para iOS y `goog_…` para Android).
4. `npx cap sync` y prueba una compra con una cuenta de pruebas (Sandbox en iOS, testers de licencia en Android).

La pestaña Pro ya incluye **Restaurar compras**, el aviso de renovación automática y los enlaces a privacidad y términos
que piden Apple y Google.

## 7. Antes de enviar a revisión

Hecho en el proyecto:
- Identificador `es.macrolab.app` en Android e iOS. Si ya existe en las tiendas o tienes un dominio propio,
  cámbialo en `capacitor.config.json`, borra `android/` e `ios/`, y ejecuta `npx cap add android`, `npx cap add ios`,
  `npm run icons` y `npx cap sync`.
- Política de privacidad (`www/privacy.html`) y términos de uso (`www/terms.html`). **Rellena los textos marcados en
  amarillo** (nombre, NIF, dirección, correo) y revísalos con un asesor.
- Funciones nativas: recordatorios locales de comidas, agua y peso (`@capacitor/local-notifications`) y compartir menú y
  lista con el menú del sistema (`@capacitor/share`).
- Sin nombres de cadenas de supermercado en la interfaz: los precios aparecen como «ref. súper».

Pendiente (lo tienes que hacer tú):
- Darte de alta como desarrollador en Apple (unos 99 $ al año) y Google Play (pago único de unos 25 $).
- **Publicar la política de privacidad en una URL pública** (por ejemplo con GitHub Pages o Netlify, subiendo
  `privacy.html` y `terms.html`) y pegar esa URL en las fichas de las tiendas.
- Rellenar en App Store Connect la «etiqueta de privacidad» (datos de salud y estado físico, no vinculados a tu identidad,
  sin seguimiento) y en Google Play la sección «Seguridad de los datos».
- Capturas de pantalla, descripción, icono de la ficha y clasificación por edades.
- Versión: `versionName`/`versionCode` en `android/app/build.gradle`; *Version*/*Build* en Xcode.

## 8. Publicar

- **Android:** Android Studio → *Build → Generate Signed Bundle* → sube el `.aab` a Google Play Console.
- **iOS:** Xcode → *Product → Archive* → *Distribute App* → App Store Connect → envía a revisión.
