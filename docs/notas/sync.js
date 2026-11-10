// La Gaceta · sincronización con Firebase (cuenta con correo y contraseña + Firestore).
//
// Las notas viven siempre en el dispositivo (localStorage) y la nube es una copia más.
// Cada cuaderno y cada página es un documento con su fecha de última edición
// (`updatedAt`); al juntar dos versiones gana la más reciente. Lo borrado se marca
// con `deleted: true` para que el borrado también llegue a los demás dispositivos.
//
// Datos en Firestore:  users/{uid}/notebooks/{id}   y   users/{uid}/pages/{id}

import { FIREBASE_CONFIG } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const KINDS = ["notebooks", "pages"];

const AUTH_ERRORS = {
  "auth/invalid-email": "Ese correo no parece válido.",
  "auth/missing-password": "Escribe la contraseña.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Pulsa «Entrar».",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/user-not-found": "No hay ninguna cuenta con ese correo. Pulsa «Crear cuenta».",
  "auth/too-many-requests": "Demasiados intentos. Espera un momento y vuelve a probar.",
  "auth/network-request-failed": "Sin conexión. Revisa internet y vuelve a probar.",
  "auth/operation-not-allowed": "Activa «Correo electrónico/contraseña» en Firebase → Authentication.",
  "auth/configuration-not-found": "Activa «Correo electrónico/contraseña» en Firebase → Authentication.",
  "permission-denied": "Firestore ha rechazado el acceso. Revisa las reglas de seguridad (README)."
};

export function friendlyError(e) {
  const code = e && (e.code || "");
  return AUTH_ERRORS[code] || (e && e.message) || "Algo ha fallado.";
}

/**
 * hooks = {
 *   local(kind)        → objeto {id: doc} con los datos de este dispositivo
 *   apply(kind, doc)   → guarda en el dispositivo un documento que llega de la nube
 *   status(estado, detalle)  estado: off | connecting | signed-out | syncing | saving | synced | offline | error
 *   user(usuario|null)
 * }
 */
export function createSync(hooks) {
  const configured = !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
  let fb = null;
  let user = null;
  let unsubs = [];
  let pending = 0;
  let initial = 0; // colecciones que aún no han hecho la primera lectura
  let started = false;

  async function load() {
    if (fb) return fb;
    const [app, au, fs] = await Promise.all([
      import(SDK + "firebase-app.js"),
      import(SDK + "firebase-auth.js"),
      import(SDK + "firebase-firestore.js")
    ]);
    const a = app.initializeApp(FIREBASE_CONFIG);
    fb = { au, fs, auth: au.getAuth(a), db: fs.getFirestore(a) };
    return fb;
  }

  function settle() {
    if (!user) return;
    if (initial > 0) return hooks.status("syncing");
    if (pending > 0) return hooks.status(navigator.onLine ? "saving" : "offline");
    hooks.status(navigator.onLine ? "synced" : "offline");
  }

  async function start() {
    if (!configured) return hooks.status("off");
    if (started) return;
    hooks.status("connecting");
    try {
      await load();
    } catch (e) {
      hooks.status("offline");
      window.addEventListener("online", start, { once: true });
      return;
    }
    started = true;
    fb.au.onAuthStateChanged(fb.auth, (u) => {
      unsubs.forEach((f) => f());
      unsubs = [];
      user = u;
      hooks.user(u);
      if (!u) return hooks.status("signed-out");
      initial = KINDS.length;
      settle();
      KINDS.forEach(listen);
    });
    window.addEventListener("online", settle);
    window.addEventListener("offline", settle);
  }

  function ref(kind, id) {
    return fb.fs.doc(fb.db, "users", user.uid, kind, id);
  }

  function listen(kind) {
    let first = true;
    const owner = user;
    const col = fb.fs.collection(fb.db, "users", owner.uid, kind);
    const off = fb.fs.onSnapshot(
      col,
      (snap) => {
        if (user !== owner) return;
        const local = hooks.local(kind);
        if (first) {
          first = false;
          const remote = {};
          snap.forEach((d) => (remote[d.id] = d.data()));
          // Lo de la nube que es más nuevo, al dispositivo…
          for (const id in remote) {
            const r = remote[id], l = local[id];
            if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) hooks.apply(kind, { ...r, id });
          }
          // …y lo del dispositivo que es más nuevo (o que la nube no tiene), a la nube.
          const up = [];
          for (const id in local) {
            const l = local[id], r = remote[id];
            if (!r || (l.updatedAt || 0) > (r.updatedAt || 0)) up.push(l);
          }
          pushMany(kind, up);
          initial--;
          settle();
          return;
        }
        snap.docChanges().forEach((ch) => {
          if (ch.type === "removed") return;
          const r = ch.doc.data(), l = local[ch.doc.id];
          if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) hooks.apply(kind, { ...r, id: ch.doc.id });
        });
      },
      (err) => hooks.status("error", friendlyError(err))
    );
    unsubs.push(off);
  }

  const clean = (o) => JSON.parse(JSON.stringify(o));

  function track(promise) {
    pending++;
    settle();
    promise
      .catch((e) => hooks.status("error", friendlyError(e)))
      .finally(() => {
        pending--;
        settle();
      });
  }

  function push(kind, doc) {
    if (!user || !fb || !doc) return;
    track(fb.fs.setDoc(ref(kind, doc.id), clean(doc)));
  }

  function pushMany(kind, docs) {
    for (let i = 0; i < docs.length; i += 400) {
      const batch = fb.fs.writeBatch(fb.db);
      docs.slice(i, i + 400).forEach((d) => batch.set(ref(kind, d.id), clean(d)));
      track(batch.commit());
    }
  }

  async function needAuth() {
    if (!configured) throw new Error("La sincronización no está configurada.");
    try {
      await load();
    } catch {
      throw new Error("Sin conexión. Conéctate a internet para entrar en tu cuenta.");
    }
    if (!started) await start();
    return fb;
  }

  return {
    configured,
    get user() {
      return user;
    },
    start,
    push,
    async signIn(email, pass) {
      const f = await needAuth();
      await f.au.signInWithEmailAndPassword(f.auth, email, pass);
    },
    async signUp(email, pass) {
      const f = await needAuth();
      await f.au.createUserWithEmailAndPassword(f.auth, email, pass);
    },
    async reset(email) {
      const f = await needAuth();
      f.auth.languageCode = "es";
      await f.au.sendPasswordResetEmail(f.auth, email);
    },
    async signOut() {
      if (fb) await fb.au.signOut(fb.auth);
    }
  };
}

/**
 * Versión para el artefacto de Claude: guarda las libretas en el espacio privado
 * de tu cuenta de Claude (`data/users/<tu id>/`), así que el mismo enlace abierto
 * en el iPhone y en el ordenador con tu cuenta muestra las mismas libretas.
 * Cada cuaderno o página es un documento «nb~<id>» o «pg~<id>».
 */
export function createClaudeSync(hooks) {
  const PREFIX = { notebooks: "nb~", pages: "pg~" };
  let col = null, user = null;
  const queue = new Map(); // clave → {kind, doc} pendiente de escribir
  let writing = false, initialDone = false, unreachable = false;

  function settle() {
    if (!col) return;
    if (!initialDone) return hooks.status(unreachable ? "offline" : "syncing");
    if (queue.size || writing) return hooks.status("saving");
    hooks.status("synced");
  }

  async function start() {
    hooks.status("connecting");
    const c = window.claude;
    if (!c || !c.use) return hooks.status("off");
    const [db, u] = await Promise.all([c.use("db"), c.use("user")]);
    const uid = u ? await u.id() : null;
    if (!db || !uid) return hooks.status("off");
    user = { id: uid };
    hooks.user(user);
    col = db.collection("data/users/" + uid);
    const timer = setTimeout(() => { unreachable = true; settle(); }, 10000);
    settle();
    col.onSnapshot(
      (snap) => {
        const remote = { notebooks: {}, pages: {} };
        for (const d of snap.docs) {
          const body = d.data();
          if (!body || !body.doc || !remote[body.kind]) continue;
          remote[body.kind][body.doc.id] = body.doc;
          const l = hooks.local(body.kind)[body.doc.id];
          if (!l || (body.doc.updatedAt || 0) > (l.updatedAt || 0)) hooks.apply(body.kind, JSON.parse(JSON.stringify(body.doc)));
        }
        if (snap.metadata.fromCache) return;
        clearTimeout(timer);
        unreachable = false;
        if (!initialDone) {
          initialDone = true;
          // Sube lo que este dispositivo tiene más nuevo (o que la cuenta aún no tiene).
          for (const kind of ["notebooks", "pages"]) {
            const local = hooks.local(kind);
            for (const id in local) {
              const r = remote[kind][id];
              if (!r || (local[id].updatedAt || 0) > (r.updatedAt || 0)) push(kind, local[id]);
            }
          }
        }
        settle();
      },
      (err) => hooks.status("error", err && err.code === "quota_exceeded" ? "No queda espacio en tu cuenta para más libretas." : "Se ha perdido la conexión con tu cuenta. Recarga la página.")
    );
  }

  function push(kind, doc) {
    if (!col || !doc) return;
    queue.set(PREFIX[kind] + doc.id, { kind, doc: JSON.parse(JSON.stringify(doc)) });
    settle();
    drain();
  }

  // Escribe de uno en uno para respetar el ritmo del almacén.
  async function drain() {
    if (writing) return;
    writing = true;
    while (queue.size) {
      const [key, body] = queue.entries().next().value;
      queue.delete(key);
      try {
        await col.doc(key).set(body);
      } catch (e) {
        const code = e && e.code;
        if (code === "unavailable" || code === "resource_exhausted") {
          if (!queue.has(key)) queue.set(key, body);
          await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));
        } else {
          hooks.status("error", code === "quota_exceeded" ? "No queda espacio en tu cuenta para más libretas." : "No se ha podido guardar un cambio en tu cuenta.");
        }
      }
    }
    writing = false;
    settle();
  }

  return {
    configured: true,
    get user() { return user; },
    start,
    push,
    async signIn() {}, async signUp() {}, async reset() {}, async signOut() {}
  };
}
