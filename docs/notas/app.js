// La Gaceta · notas con forma de periódico. Cada libreta tiene sus páginas.
import { createSync, friendlyError } from "./sync.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

const COLORS = [
  ["#1F3A5F", "Azul marino"], ["#A8322A", "Rojo"], ["#2F5D46", "Verde inglés"], ["#C08A1E", "Mostaza"],
  ["#6B2132", "Burdeos"], ["#2A6F73", "Petróleo"], ["#4A5560", "Pizarra"], ["#22201C", "Negro"],
  ["#8A5A3B", "Cuero"], ["#5B4B8A", "Violeta"]
];

/* ───────── Datos en el dispositivo ───────── */
const KEY = "gaceta-notas:v1";
let db = null;
try { db = JSON.parse(localStorage.getItem(KEY)); } catch {}
if (!db || typeof db !== "object") db = {};
db.notebooks ||= {};
db.pages ||= {};
db.meta ||= { since: Date.now() };

let saveTimer = 0;
function persist(now) {
  clearTimeout(saveTimer);
  const write = () => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch { toast("No queda espacio para guardar en este dispositivo"); }
  };
  if (now) write(); else saveTimer = setTimeout(write, 200);
}

const pushTimers = {};
function put(kind, obj, delay = 0) {
  obj.updatedAt = Math.max(Date.now(), (obj.updatedAt || 0) + 1);
  db[kind][obj.id] = obj;
  persist();
  clearTimeout(pushTimers[obj.id]?.t);
  if (delay) pushTimers[obj.id] = { kind, t: setTimeout(() => { delete pushTimers[obj.id]; sync.push(kind, db[kind][obj.id]); }, delay) };
  else sync.push(kind, obj);
}
function flush() {
  for (const id in pushTimers) {
    const { kind, t } = pushTimers[id];
    clearTimeout(t);
    delete pushTimers[id];
    sync.push(kind, db[kind][id]);
  }
  persist(true);
}
addEventListener("pagehide", flush);
document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());

const notebooks = () => Object.values(db.notebooks).filter((n) => !n.deleted);
const pagesOf = (nb) => Object.values(db.pages).filter((p) => p.nb === nb && !p.deleted).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
const touched = (nb) => pagesOf(nb.id).reduce((m, p) => Math.max(m, p.updatedAt || 0), nb.updatedAt || 0);

// Libreta de bienvenida (mismo id en todos los dispositivos para que no se duplique al sincronizar).
if (!db.meta.seeded) {
  db.meta.seeded = true;
  if (!notebooks().length) {
    const t = 1; // muy antigua: cualquier versión de la nube gana
    db.notebooks.bienvenida = { id: "bienvenida", title: "Cómo usar La Gaceta", subtitle: "Edición especial de bienvenida", color: "#A8322A", createdAt: t, updatedAt: t };
    const pages = [
      ["Cada nota es una libreta", "En la portada ves todas tus libretas como noticias de un periódico. La que tocaste por última vez sale en primera plana.\n\nPulsa «+ Nueva libreta» para crear otra, elige su titular y el color de la tapa."],
      ["Dentro, páginas", "Cada libreta tiene sus páginas. Crea una con «+ Nueva página», pasa de una a otra con las flechas de abajo o desde el índice.\n\nCon las flechas de arriba cambias el orden de la página, y con la papelera la arrancas."],
      ["Las mismas notas en todas partes", "Instálala en el iPhone (Safari → Compartir → Añadir a pantalla de inicio) y en Windows (Edge o Chrome → Instalar aplicación).\n\nDespués pulsa «Cuenta», entra con el mismo correo en los dos y tus libretas se sincronizan solas. Funciona también sin conexión: los cambios se suben cuando vuelve internet."]
    ];
    pages.forEach(([title, body], i) => (db.pages["bienvenida-" + (i + 1)] = { id: "bienvenida-" + (i + 1), nb: "bienvenida", title, body, order: i + 1, createdAt: t, updatedAt: t }));
  }
  persist(true);
}

/* ───────── Sincronización ───────── */
const STATUS_TEXT = {
  off: "Solo en este dispositivo", connecting: "Conectando…", "signed-out": "Sin cuenta · solo aquí",
  syncing: "Sincronizando…", saving: "Guardando…", synced: "Sincronizado", offline: "Sin conexión · guardado aquí", error: "Error de sincronización"
};
let syncState = "off", syncDetail = "";
const sync = createSync({
  local: (kind) => db[kind],
  apply(kind, doc) {
    db[kind][doc.id] = doc;
    persist();
    scheduleRender(kind, doc);
  },
  status(s, detail) {
    syncState = s; syncDetail = detail || "";
    const pill = $("#sync-pill");
    pill.dataset.s = s;
    pill.querySelector("span").textContent = STATUS_TEXT[s] || s;
    pill.title = syncDetail;
    if (s === "error" && detail) toast(detail);
    renderAccount();
  },
  user() { renderAccount(); }
});

/* ───────── Fechas ───────── */
const fmtLong = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtShort = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });
const fmtTime = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });
function ago(t) {
  if (!t || t < 1000) return "edición de bienvenida";
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "hace un momento";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 172800) return `ayer, ${fmtTime.format(t)}`;
  return fmtShort.format(t);
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ───────── Portada ───────── */
let query = "";
let sortBy = "recent";
try { sortBy = localStorage.getItem("gaceta-sort") || "recent"; } catch {}
$("#sort").value = sortBy;

function bookHTML(nb, n) {
  return `<div class="book" style="--c:${esc(nb.color)}"><span class="stitch"></span><span class="band"></span>
    <span class="label"><b>${esc(nb.title || "Sin título")}</b><small>${n} ${n === 1 ? "página" : "páginas"}</small></span></div>`;
}
function excerpt(nb) {
  const pages = pagesOf(nb.id);
  const p = pages.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return { pages, latest: p, text: (p && p.body ? p.body : "").trim() };
}

function renderBoard() {
  $("#today").textContent = cap(fmtLong.format(new Date()));
  const days = Math.floor((Date.now() - (db.meta.since || Date.now())) / 86400000) + 1;
  $("#edition").textContent = `Edición nº ${days}`;
  const all = notebooks();
  const totalPages = Object.values(db.pages).filter((p) => !p.deleted && db.notebooks[p.nb] && !db.notebooks[p.nb].deleted).length;
  $("#stats").textContent = `${all.length} ${all.length === 1 ? "libreta" : "libretas"} · ${totalPages} ${totalPages === 1 ? "página" : "páginas"}`;

  const q = query.trim().toLowerCase();
  let list = all.map((nb) => ({ nb, t: touched(nb), ...excerpt(nb) }));
  if (q) list = list.filter(({ nb, pages }) =>
    (nb.title + " " + (nb.subtitle || "")).toLowerCase().includes(q) ||
    pages.some((p) => ((p.title || "") + " " + (p.body || "")).toLowerCase().includes(q)));
  if (sortBy === "alpha") list.sort((a, b) => (a.nb.title || "").localeCompare(b.nb.title || "", "es"));
  else if (sortBy === "created") list.sort((a, b) => a.nb.createdAt - b.nb.createdAt);
  else list.sort((a, b) => b.t - a.t);

  const board = $("#board");
  if (!all.length) {
    board.innerHTML = `<div class="empty">La redacción está en silencio.<br>Aún no hay ninguna libreta.<br><button class="btn solid" type="button" data-new>+ Nueva libreta</button></div>`;
    return;
  }
  if (!list.length) {
    board.innerHTML = `<div class="empty">Ninguna noticia sobre «${esc(query)}».</div>`;
    return;
  }
  const [lead, ...rest] = q || sortBy !== "recent" ? [null, ...list] : list;
  let html = "";
  if (lead) {
    const { nb, pages, latest, text, t } = lead;
    html += `<div class="section-h"><h2>Primera plana</h2></div>
    <article class="lead">
      <button class="story-link" type="button" data-open="${esc(nb.id)}" aria-label="Abrir ${esc(nb.title)}">${bookHTML(nb, pages.length)}</button>
      <div>
        <div class="kicker">Última hora · ${esc(ago(t))}</div>
        <button class="story-link" type="button" data-open="${esc(nb.id)}" data-page="${latest ? esc(latest.id) : ""}"><h2 class="headline">${esc(nb.title || "Sin título")}</h2></button>
        <p class="dek">${esc(nb.subtitle || (latest ? `Última página: «${latest.title || "Sin título"}»` : "Una libreta recién estrenada."))}</p>
        ${text ? `<p class="excerpt${text.length > 140 ? " long" : ""}">${esc(text.slice(0, 900))}${text.length > 900 ? "…" : ""}</p>` : ""}
      </div>
    </article>`;
  }
  if (rest.length) {
    html += `<div class="section-h"><h2>${q ? "Resultados" : lead ? "Más noticias" : "Todas las libretas"}</h2></div><div class="grid">`;
    for (const { nb, pages, latest, text, t } of rest) {
      html += `<article class="story"><button class="story-link" type="button" data-open="${esc(nb.id)}">
        ${bookHTML(nb, pages.length)}
        <h3>${esc(nb.title || "Sin título")}</h3>
        <p>${esc(nb.subtitle || text.slice(0, 200) || "Libreta en blanco")}</p>
        <div class="meta">${esc(cap(ago(t)))}${latest && latest.title ? " · «" + esc(latest.title) + "»" : ""}</div>
      </button></article>`;
    }
    html += `</div>`;
  }
  board.innerHTML = html;
}

$("#board").addEventListener("click", (e) => {
  const b = e.target.closest("[data-open],[data-new]");
  if (!b) return;
  if (b.dataset.new !== undefined) return openNbDialog();
  go(b.dataset.open, b.dataset.page || "");
});
$("#search").addEventListener("input", (e) => { query = e.target.value; renderBoard(); });
$("#sort").addEventListener("change", (e) => {
  sortBy = e.target.value;
  try { localStorage.setItem("gaceta-sort", sortBy); } catch {}
  renderBoard();
});
$("#new-nb").addEventListener("click", () => openNbDialog());

/* ───────── Navegación (#/l/<libreta>/<página>) ───────── */
function go(nb, page) { location.hash = nb ? `#/l/${encodeURIComponent(nb)}${page ? "/" + encodeURIComponent(page) : ""}` : "#/"; }
function route() {
  const m = location.hash.match(/^#\/l\/([^/]+)(?:\/([^/]+))?/);
  const nb = m && db.notebooks[decodeURIComponent(m[1])];
  if (nb && !nb.deleted) {
    openNotebook(nb.id, m[2] ? decodeURIComponent(m[2]) : "");
  } else {
    if (current.nb) closeNotebook();
    if (m) history.replaceState(null, "", "#/");
    $("#board-view").hidden = false;
    $("#nb-view").hidden = true;
    document.title = "La Gaceta · Notas";
    renderBoard();
  }
}
addEventListener("hashchange", route);

/* ───────── Dentro de la libreta ───────── */
const current = { nb: "", page: "" };
const titleEl = $("#page-title"), bodyEl = $("#page-body");

function openNotebook(nbId, pageId) {
  const changed = current.nb !== nbId;
  current.nb = nbId;
  let pages = pagesOf(nbId);
  if (!pages.length) {
    const p = { id: newId(), nb: nbId, title: "", body: "", order: 1, createdAt: Date.now() };
    put("pages", p);
    pages = [p];
  }
  const want = pages.find((p) => p.id === pageId) || pages.find((p) => p.id === (changed ? db.meta["last:" + nbId] : current.page)) || pages[0];
  $("#board-view").hidden = true;
  $("#nb-view").hidden = false;
  showPage(want.id);
  if (changed) scrollTo(0, 0);
}
function closeNotebook() {
  flush();
  current.nb = ""; current.page = "";
  closeIndex();
}

function renderNbHeader() {
  const nb = db.notebooks[current.nb];
  if (!nb) return;
  $("#nb-view").style.setProperty("--c", nb.color);
  $("#nb-name").textContent = nb.title || "Sin título";
  $("#nb-sub").textContent = nb.subtitle || `${pagesOf(nb.id).length} páginas`;
  document.title = `${nb.title || "Libreta"} · La Gaceta`;
}

function renderIndex() {
  const pages = pagesOf(current.nb);
  $("#page-list").innerHTML = pages.map((p, i) =>
    `<li><button type="button" data-page="${esc(p.id)}" aria-current="${p.id === current.page}"><span class="n">${i + 1}</span><span class="t">${esc(p.title || "Sin título")}</span></button></li>`).join("");
  const i = pages.findIndex((p) => p.id === current.page);
  $("#pager-text").textContent = `Página ${i + 1} de ${pages.length}`;
  $("#prev").disabled = i <= 0;
  $("#next").disabled = i >= pages.length - 1;
  $("#move-up").disabled = i <= 0;
  $("#move-down").disabled = i >= pages.length - 1;
}

function renderMeta() {
  const p = db.pages[current.page];
  if (!p) return;
  $("#page-meta").textContent = p.updatedAt > 1000 ? `Escrita el ${fmtShort.format(p.createdAt)} · editada ${ago(p.updatedAt)}` : "Página de bienvenida";
}

function showPage(id) {
  const p = db.pages[id];
  if (!p) return;
  if (current.page && current.page !== id) flush();
  current.page = id;
  db.meta["last:" + current.nb] = id;
  persist();
  const want = `#/l/${encodeURIComponent(current.nb)}/${encodeURIComponent(id)}`;
  if (location.hash !== want) history.replaceState(null, "", want);
  titleEl.value = p.title || "";
  bodyEl.value = p.body || "";
  bodyEl.scrollTop = 0;
  renderNbHeader();
  renderIndex();
  renderMeta();
  const li = $(`#page-list [data-page="${CSS.escape(id)}"]`);
  li && li.scrollIntoView({ block: "nearest" });
}

function editPage(field, value) {
  const p = db.pages[current.page];
  if (!p || p[field] === value) return;
  put("pages", { ...p, [field]: value }, 700);
  if (field === "title") renderIndex();
  renderMeta();
}
titleEl.addEventListener("input", () => editPage("title", titleEl.value));
bodyEl.addEventListener("input", () => editPage("body", bodyEl.value));
titleEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); bodyEl.focus(); } });

function step(d) {
  const pages = pagesOf(current.nb);
  const i = pages.findIndex((p) => p.id === current.page);
  const t = pages[i + d];
  if (t) showPage(t.id);
}
$("#prev").addEventListener("click", () => step(-1));
$("#next").addEventListener("click", () => step(1));
addEventListener("keydown", (e) => {
  if ($("#nb-view").hidden || document.querySelector("dialog[open]")) return;
  if ((e.ctrlKey || e.metaKey) && e.key === "PageUp") { e.preventDefault(); step(-1); }
  if ((e.ctrlKey || e.metaKey) && e.key === "PageDown") { e.preventDefault(); step(1); }
  if (e.key === "Escape" && !$("#index").classList.contains("open")) go("");
});

$("#page-list").addEventListener("click", (e) => {
  const b = e.target.closest("[data-page]");
  if (b) { showPage(b.dataset.page); closeIndex(); }
});
$("#add-page").addEventListener("click", () => {
  const pages = pagesOf(current.nb);
  const p = { id: newId(), nb: current.nb, title: "", body: "", order: (pages.at(-1)?.order || 0) + 1, createdAt: Date.now() };
  put("pages", p);
  touchNb();
  showPage(p.id);
  closeIndex();
  titleEl.focus();
});
function move(d) {
  const pages = pagesOf(current.nb);
  const i = pages.findIndex((p) => p.id === current.page);
  const j = i + d;
  if (j < 0 || j >= pages.length) return;
  // Reasigna el orden de todas para que sea estable entre dispositivos.
  [pages[i], pages[j]] = [pages[j], pages[i]];
  pages.forEach((p, k) => { if (p.order !== k + 1) put("pages", { ...p, order: k + 1 }); });
  renderIndex();
}
$("#move-up").addEventListener("click", () => move(-1));
$("#move-down").addEventListener("click", () => move(1));
$("#del-page").addEventListener("click", () => {
  const p = db.pages[current.page];
  if (!p) return;
  const empty = !(p.title || "").trim() && !(p.body || "").trim();
  if (!empty && !confirm(`¿Arrancar la página «${p.title || "Sin título"}»? No se puede deshacer.`)) return;
  const pages = pagesOf(current.nb);
  const i = pages.findIndex((x) => x.id === p.id);
  put("pages", { ...p, deleted: true, title: "", body: "" });
  const rest = pagesOf(current.nb);
  if (!rest.length) {
    const np = { id: newId(), nb: current.nb, title: "", body: "", order: 1, createdAt: Date.now() };
    put("pages", np);
    return showPage(np.id);
  }
  showPage(rest[Math.min(i, rest.length - 1)].id);
  toast("Página arrancada");
});
function touchNb() {
  const nb = db.notebooks[current.nb];
  if (nb) put("notebooks", { ...nb });
}

$("#back").addEventListener("click", () => go(""));
$("#nb-edit").addEventListener("click", () => openNbDialog(current.nb));
function openIndex() { $("#index").classList.add("open"); $("#index-backdrop").classList.add("open"); }
function closeIndex() { $("#index").classList.remove("open"); $("#index-backdrop").classList.remove("open"); }
$("#index-toggle").addEventListener("click", openIndex);
$("#index-backdrop").addEventListener("click", closeIndex);

/* ───────── Diálogo: libreta ───────── */
const nbDialog = $("#nb-dialog");
let editing = "", pickedColor = COLORS[0][0];
function renderSwatches() {
  $("#swatches").innerHTML = COLORS.map(([c, n]) => `<button type="button" style="--c:${c}" data-c="${c}" aria-label="${n}" title="${n}" aria-pressed="${c === pickedColor}"></button>`).join("");
}
$("#swatches").addEventListener("click", (e) => {
  const b = e.target.closest("[data-c]");
  if (b) { pickedColor = b.dataset.c; renderSwatches(); }
});
function openNbDialog(id = "") {
  editing = id;
  const nb = id ? db.notebooks[id] : null;
  $("#nb-dialog-title").textContent = nb ? "Editar libreta" : "Nueva libreta";
  $("#nb-f-title").value = nb ? nb.title : "";
  $("#nb-f-sub").value = nb ? nb.subtitle || "" : "";
  pickedColor = nb ? nb.color : COLORS[notebooks().length % COLORS.length][0];
  $("#nb-danger").hidden = !nb;
  renderSwatches();
  nbDialog.showModal();
  if (!nb) $("#nb-f-title").focus();
}
$("#nb-form").addEventListener("submit", (e) => {
  if (e.submitter && e.submitter.value === "cancel") return;
  const title = $("#nb-f-title").value.trim();
  if (!title) { e.preventDefault(); $("#nb-f-title").focus(); return; }
  const subtitle = $("#nb-f-sub").value.trim();
  if (editing) {
    put("notebooks", { ...db.notebooks[editing], title, subtitle, color: pickedColor });
    renderNbHeader();
  } else {
    const nb = { id: newId(), title, subtitle, color: pickedColor, createdAt: Date.now() };
    put("notebooks", nb);
    const p = { id: newId(), nb: nb.id, title: "", body: "", order: 1, createdAt: Date.now() };
    put("pages", p);
    go(nb.id, p.id);
    setTimeout(() => titleEl.focus(), 50);
  }
});
$("#nb-delete").addEventListener("click", () => {
  const nb = db.notebooks[editing];
  if (!nb) return;
  if (!confirm(`¿Tirar la libreta «${nb.title}» con todas sus páginas? No se puede deshacer.`)) return;
  pagesOf(nb.id).forEach((p) => put("pages", { ...p, deleted: true, title: "", body: "" }));
  put("notebooks", { ...nb, deleted: true });
  nbDialog.close();
  go("");
  toast("Libreta tirada a la papelera");
});

/* ───────── Diálogo: cuenta ───────── */
const accDialog = $("#account");
function accMsg(text, ok) {
  const m = $("#acc-msg");
  m.hidden = !text;
  m.textContent = text || "";
  m.classList.toggle("ok", !!ok);
}
function renderAccount() {
  const u = sync.user;
  $("#acc-off").hidden = sync.configured;
  $("#acc-in").hidden = !sync.configured || !!u;
  $("#acc-user").hidden = !u;
  if (u) {
    $("#acc-who").textContent = u.email;
    $("#acc-state").textContent = (STATUS_TEXT[syncState] || "") + (syncDetail ? ` — ${syncDetail}` : "");
  }
}
$("#account-btn").addEventListener("click", () => { accMsg(""); renderAccount(); accDialog.showModal(); });
$("#sync-pill").addEventListener("click", () => { accMsg(""); renderAccount(); accDialog.showModal(); });
$("#account-close").addEventListener("click", () => accDialog.close());

async function authAction(fn, okText) {
  const email = $("#acc-email").value.trim(), pass = $("#acc-pass").value;
  const btns = accDialog.querySelectorAll("#acc-in button");
  btns.forEach((b) => (b.disabled = true));
  accMsg("");
  try {
    await fn(email, pass);
    if (okText) accMsg(okText, true);
    $("#acc-pass").value = "";
  } catch (e) {
    accMsg(friendlyError(e));
  } finally {
    btns.forEach((b) => (b.disabled = false));
  }
}
$("#acc-in").addEventListener("submit", (e) => { e.preventDefault(); authAction((a, b) => sync.signIn(a, b), "¡Dentro! Tus libretas se están sincronizando."); });
$("#acc-signup").addEventListener("click", () => {
  if ($("#acc-pass").value.length < 6) return accMsg("La contraseña debe tener al menos 6 caracteres.");
  authAction((a, b) => sync.signUp(a, b), "Cuenta creada. Usa este mismo correo en tus otros dispositivos.");
});
$("#acc-reset").addEventListener("click", () => {
  if (!$("#acc-email").value.trim()) return accMsg("Escribe tu correo y vuelve a pulsar.");
  authAction((a) => sync.reset(a), "Te hemos enviado un correo para elegir una contraseña nueva.");
});
$("#acc-signout").addEventListener("click", async () => {
  flush();
  await sync.signOut();
  accMsg("Sesión cerrada. Las libretas siguen guardadas en este dispositivo.", true);
});

/* Copia de seguridad */
$("#export").addEventListener("click", () => {
  flush();
  const data = { app: "la-gaceta", version: 1, exportedAt: new Date().toISOString(), notebooks: db.notebooks, pages: db.pages };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
  a.download = `la-gaceta-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
});
$("#import").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data || !data.notebooks || !data.pages) throw 0;
    let n = 0;
    for (const kind of ["notebooks", "pages"]) {
      for (const id in data[kind]) {
        const r = data[kind][id], l = db[kind][id];
        if (r && r.id === id && (!l || (r.updatedAt || 0) > (l.updatedAt || 0))) {
          db[kind][id] = r;
          sync.push(kind, r);
          n++;
        }
      }
    }
    persist(true);
    route();
    accMsg(n ? `Copia cargada: ${n} elementos recuperados.` : "La copia no tenía nada más nuevo que lo que ya tienes.", true);
  } catch {
    accMsg("Ese archivo no es una copia de La Gaceta.");
  }
});

/* ───────── Cambios que llegan de otro dispositivo ───────── */
let renderQueued = false;
function scheduleRender(kind, doc) {
  // Si la página abierta ha cambiado en otro dispositivo, se actualiza sin perder el cursor.
  if (kind === "pages" && doc.id === current.page) {
    if (doc.deleted) return setTimeout(route, 0);
    if (titleEl.value !== (doc.title || "")) titleEl.value = doc.title || "";
    if (bodyEl.value !== (doc.body || "")) {
      const { selectionStart: s, selectionEnd: en } = bodyEl;
      bodyEl.value = doc.body || "";
      if (document.activeElement === bodyEl) bodyEl.setSelectionRange(s, en);
    }
  }
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    if (current.nb) {
      const nb = db.notebooks[current.nb];
      if (!nb || nb.deleted) return route();
      if (!db.pages[current.page] || db.pages[current.page].deleted) return route();
      renderNbHeader(); renderIndex(); renderMeta();
    } else renderBoard();
  });
}

/* ───────── Avisos ───────── */
let toastTimer = 0;
function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

/* ───────── Arranque ───────── */
route();
sync.start();
setInterval(() => { if (!current.nb) renderBoard(); else renderMeta(); }, 60000);
