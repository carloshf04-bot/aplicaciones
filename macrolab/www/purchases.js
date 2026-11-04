/*
 * Macrolab · pagos con RevenueCat
 * ------------------------------------------------------------
 * 1. Crea en App Store Connect y Google Play Console dos suscripciones
 *    (mensual 4,99 € y anual 29,99 €, con 7 días de prueba).
 * 2. En RevenueCat: crea el proyecto, conecta las dos tiendas, crea el
 *    entitlement "pro" y una offering "default" con los paquetes
 *    Monthly y Annual.
 * 3. Pega aquí tus claves públicas de RevenueCat (Project settings → API keys).
 *
 * En el navegador (fuera de la app) funciona en modo demostración.
 * En el móvil, sin claves, no deja comprar: así nunca se publica
 * una versión que regale Pro por error.
 */
(function () {
  var CONFIG = {
    iosApiKey: "",      // empieza por "appl_"
    androidApiKey: "",  // empieza por "goog_"
    entitlement: "pro"
  };

  var cap = window.Capacitor;
  var native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  var P = native && cap.Plugins ? cap.Plugins.Purchases : null;
  var platform = cap && cap.getPlatform ? cap.getPlatform() : "web";
  var key = platform === "ios" ? CONFIG.iosApiKey : platform === "android" ? CONFIG.androidApiKey : "";

  // ---------- Modo demostración (navegador) ----------
  if (!native) {
    var KEY = "macrolab-pro-demo";
    var get = function () { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } };
    var set = function (v) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} };
    window.MacrolabPay = {
      demo: true,
      buy: function () { set(true); return Promise.resolve(true); },
      restore: function () { return Promise.resolve(get()); }
    };
    return;
  }

  // ---------- RevenueCat (app nativa) ----------
  var ready = null;
  function configure() {
    if (!ready) {
      if (!P || !key) {
        ready = Promise.reject(new Error("Pagos sin configurar: falta la clave de RevenueCat en purchases.js"));
      } else {
        ready = P.configure({ apiKey: key });
      }
    }
    return ready;
  }
  function isPro(info) {
    var c = info && (info.customerInfo || info);
    return !!(c && c.entitlements && c.entitlements.active && c.entitlements.active[CONFIG.entitlement]);
  }
  function findPackage(offerings, plan) {
    var cur = offerings && offerings.current;
    if (!cur) return null;
    if (plan === "mensual" && cur.monthly) return cur.monthly;
    if (plan === "anual" && cur.annual) return cur.annual;
    var want = plan === "mensual" ? "MONTHLY" : "ANNUAL";
    var list = cur.availablePackages || [];
    for (var i = 0; i < list.length; i++) if (list[i].packageType === want) return list[i];
    return list[0] || null;
  }

  window.MacrolabPay = {
    demo: false,
    buy: function (plan) {
      return configure()
        .then(function () { return P.getOfferings(); })
        .then(function (off) {
          var pkg = findPackage(off, plan);
          if (!pkg) throw new Error("No hay productos disponibles todavía.");
          return P.purchasePackage({ aPackage: pkg });
        })
        .then(function (res) { return isPro(res); })
        .catch(function (e) {
          if (e && (e.userCancelled || e.code === "1" || e.code === 1)) return false; // el usuario canceló
          throw e;
        });
    },
    restore: function () {
      return configure()
        .then(function () { return P.restorePurchases(); })
        .then(isPro);
    },
    status: function () {
      return configure().then(function () { return P.getCustomerInfo(); }).then(isPro);
    }
  };
})();
