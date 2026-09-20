/* Bautagebuch app: routing + views. Loaded after db.js and pdf.js. */

const appRoot = document.getElementById("app");
const topbarActions = document.getElementById("topbar-actions");
const modalRoot = document.getElementById("modal-root");
const toastEl = document.getElementById("toast");

const WEATHER_OPTIONS = [
  { value: "sonnig", label: "Sonnig", icon: "☀️" },
  { value: "bewoelkt", label: "Bewölkt", icon: "☁️" },
  { value: "regen", label: "Regen", icon: "\u{1F327}️" },
  { value: "schnee", label: "Schnee", icon: "❄️" },
  { value: "sturm", label: "Sturm", icon: "\u{1F32C}️" },
  { value: "neblig", label: "Neblig", icon: "\u{1F32B}️" },
];

const GROUND_OPTIONS = [
  { value: "trocken", label: "Trocken" },
  { value: "feucht", label: "Feucht" },
  { value: "nass", label: "Nass" },
  { value: "gefroren", label: "Gefroren" },
];

// ---------- Utilities ----------

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.add("hidden"), 2600);
}

function showConfirm(title, message, confirmLabel = "Bestätigen", danger = true) {
  return new Promise((resolve) => {
    modalRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-box">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(message)}</p>
          <div class="modal-actions">
            <button class="btn" data-action="cancel">Abbrechen</button>
            <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-action="confirm">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      </div>`;
    const overlay = modalRoot.querySelector(".modal-overlay");
    const close = (result) => {
      modalRoot.innerHTML = "";
      resolve(result);
    };
    overlay.querySelector('[data-action="cancel"]').onclick = () => close(false);
    overlay.querySelector('[data-action="confirm"]').onclick = () => close(true);
    overlay.onclick = (e) => { if (e.target === overlay) close(false); };
  });
}

function setTopbar(html) {
  topbarActions.innerHTML = html || "";
}

// ---------- Router ----------

function navigate(hash) {
  window.location.hash = hash;
}

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "sites" };
  if (parts[0] === "site" && parts[1] === "new") return { name: "site-new" };
  if (parts[0] === "site" && parts[2] === "edit") return { name: "site-edit", siteId: parts[1] };
  if (parts[0] === "site" && parts[2] === "entry" && parts[3] === "new") return { name: "entry-new", siteId: parts[1] };
  if (parts[0] === "site" && parts[2] === "entry" && parts[4] === "edit") return { name: "entry-edit", siteId: parts[1], entryId: parts[3] };
  if (parts[0] === "site" && parts[2] === "entry") return { name: "entry-view", siteId: parts[1], entryId: parts[3] };
  if (parts[0] === "site") return { name: "site-detail", siteId: parts[1] };
  return { name: "sites" };
}

async function render() {
  const route = parseRoute();
  try {
    switch (route.name) {
      case "sites": return await renderSitesList();
      case "site-new": return await renderSiteForm(null);
      case "site-edit": return await renderSiteForm(route.siteId);
      case "site-detail": return await renderSiteDetail(route.siteId);
      case "entry-new": return await renderEntryForm(route.siteId, null);
      case "entry-edit": return await renderEntryForm(route.siteId, route.entryId);
      case "entry-view": return await renderEntryView(route.siteId, route.entryId);
      default: return await renderSitesList();
    }
  } catch (err) {
    console.error(err);
    appRoot.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Ein Fehler ist aufgetreten</h3><p>${escapeHtml(err.message || String(err))}</p></div>`;
  }
}

window.addEventListener("hashchange", render);
document.getElementById("brand-home").addEventListener("click", () => navigate("#/"));

// ---------- View: Sites list ----------

async function renderSitesList() {
  setTopbar(`<button class="btn btn-primary" id="btn-new-site">+ Neue Baustelle</button>`);
  const sites = await DB.getAllSites();
  const entries = await DB.getAllEntries();
  const countBySite = {};
  const lastEntryBySite = {};
  for (const e of entries) {
    countBySite[e.siteId] = (countBySite[e.siteId] || 0) + 1;
    if (!lastEntryBySite[e.siteId] || e.date > lastEntryBySite[e.siteId]) lastEntryBySite[e.siteId] = e.date;
  }

  if (sites.length === 0) {
    appRoot.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">\u{1F3D7}️</div>
        <h3>Noch keine Baustellen angelegt</h3>
        <p>Lege deine erste Baustelle an, um mit dem Bautagebuch zu starten.</p>
        <button class="btn btn-primary" id="btn-new-site-empty" style="margin-top:14px;">+ Neue Baustelle anlegen</button>
      </div>`;
    document.getElementById("btn-new-site-empty").onclick = () => navigate("#/site/new");
  } else {
    appRoot.innerHTML = `
      <div class="page-header">
        <div><h1>Meine Baustellen</h1><div class="subtitle">${sites.length} Baustelle${sites.length === 1 ? "" : "n"}</div></div>
      </div>
      <div class="site-grid">
        ${sites.map((s) => `
          <div class="card site-card" data-id="${s.id}">
            <h3>${escapeHtml(s.name)}</h3>
            <div class="site-meta">${escapeHtml(s.address || "Keine Adresse")}</div>
            ${s.client ? `<div class="site-meta">Auftraggeber: ${escapeHtml(s.client)}</div>` : ""}
            <div class="site-stats">
              <span>\u{1F4C4} ${countBySite[s.id] || 0} Einträge</span>
              <span>\u{1F4C5} ${lastEntryBySite[s.id] ? formatDateDE(lastEntryBySite[s.id]) : "-"}</span>
            </div>
            ${s.active === false ? '<span class="badge-inactive">Inaktiv</span>' : ""}
          </div>`).join("")}
      </div>`;
    appRoot.querySelectorAll(".site-card").forEach((card) => {
      card.onclick = () => navigate(`#/site/${card.dataset.id}`);
    });
  }
  document.getElementById("btn-new-site").onclick = () => navigate("#/site/new");
}

// ---------- View: Site form (create/edit) ----------

async function renderSiteForm(siteId) {
  const isEdit = Boolean(siteId);
  const site = isEdit ? await DB.getSite(siteId) : { name: "", address: "", client: "", description: "", active: true, weatherPlace: "", lat: null, lon: null, locationLabel: "" };
  if (isEdit && !site) return navigate("#/");

  setTopbar(`<button class="btn" id="btn-cancel">Abbrechen</button>`);
  appRoot.innerHTML = `
    <div class="breadcrumb" id="crumb-back">&larr; Zurück zu Baustellen</div>
    <div class="page-header"><h1>${isEdit ? "Baustelle bearbeiten" : "Neue Baustelle"}</h1></div>
    <div class="card form-section">
      <div class="form-row">
        <div class="field"><label>Name der Baustelle *</label><input id="f-name" type="text" value="${escapeHtml(site.name)}" placeholder="z.B. Wohnbau Musterstraße 12"></div>
        <div class="field"><label>Auftraggeber / Bauherr</label><input id="f-client" type="text" value="${escapeHtml(site.client)}"></div>
      </div>
      <div class="form-row">
        <div class="field" style="grid-column: 1 / -1;"><label>Adresse</label><input id="f-address" type="text" value="${escapeHtml(site.address)}"></div>
      </div>
      <div class="form-row">
        <div class="field" style="grid-column: 1 / -1;"><label>Leistungsumfang / Beschreibung</label><textarea id="f-description">${escapeHtml(site.description)}</textarea></div>
      </div>
      <div class="form-row">
        <div class="field"><label><input type="checkbox" id="f-active" ${site.active !== false ? "checked" : ""} style="width:auto; margin-right:6px;">Baustelle aktiv</label></div>
      </div>
    </div>

    <div class="card form-section">
      <h4>Standort für automatischen Wetterabruf</h4>
      <div class="form-row" style="align-items:flex-end;">
        <div class="field" style="grid-column: span 2;">
          <label>Ort / PLZ des Bauvorhabens</label>
          <input id="f-weather-place" type="text" value="${escapeHtml(site.weatherPlace || "")}" placeholder="z.B. Klagenfurt am Wörthersee">
        </div>
        <div class="field"><button class="btn" id="btn-geocode" type="button">\u{1F50D} Standort suchen</button></div>
      </div>
      <div id="geocode-status" class="field-hint">${site.lat != null ? `✅ Hinterlegt: ${escapeHtml(site.locationLabel || "")}` : "Noch kein Standort hinterlegt – Wetter muss manuell ausgewählt werden."}</div>
      <div id="geocode-results"></div>
    </div>

    <div class="form-actions">
      ${isEdit ? '<button class="btn btn-danger" id="btn-delete-site">Löschen</button>' : ""}
      <div class="spacer"></div>
      <button class="btn" id="btn-cancel-2">Abbrechen</button>
      <button class="btn btn-primary" id="btn-save-site">Speichern</button>
    </div>`;

  const back = () => navigate(isEdit ? `#/site/${siteId}` : "#/");
  document.getElementById("crumb-back").onclick = () => navigate("#/");
  document.getElementById("btn-cancel").onclick = back;
  document.getElementById("btn-cancel-2").onclick = back;

  // Location search for automatic weather lookup
  let selectedLocation = site.lat != null ? { lat: site.lat, lon: site.lon, label: site.locationLabel } : null;
  const geocodeStatus = document.getElementById("geocode-status");
  const geocodeResults = document.getElementById("geocode-results");
  const geocodeBtn = document.getElementById("btn-geocode");

  function renderGeocodeCandidates(candidates) {
    geocodeResults.innerHTML = candidates.map((c, i) => `
      <div class="card" style="padding:8px 12px; margin-top:6px; cursor:pointer;" data-idx="${i}">${escapeHtml(c.label)}</div>
    `).join("");
    geocodeResults.querySelectorAll("[data-idx]").forEach((el) => {
      el.onclick = () => {
        const c = candidates[Number(el.dataset.idx)];
        selectedLocation = { lat: c.lat, lon: c.lon, label: c.label };
        geocodeStatus.textContent = `✅ Hinterlegt: ${c.label}`;
        geocodeResults.innerHTML = "";
      };
    });
  }

  geocodeBtn.onclick = async () => {
    const query = document.getElementById("f-weather-place").value.trim();
    if (!query) { showToast("Bitte zuerst einen Ort eingeben"); return; }
    geocodeBtn.disabled = true;
    geocodeStatus.textContent = "Suche läuft...";
    geocodeResults.innerHTML = "";
    try {
      const candidates = await Weather.geocodeLocation(query);
      if (candidates.length === 0) {
        geocodeStatus.textContent = "⚠️ Kein Standort gefunden. Bitte anderen Suchbegriff versuchen.";
      } else if (candidates.length === 1) {
        selectedLocation = candidates[0];
        geocodeStatus.textContent = `✅ Hinterlegt: ${candidates[0].label}`;
      } else {
        geocodeStatus.textContent = "Bitte den passenden Ort auswählen:";
        renderGeocodeCandidates(candidates);
      }
    } catch (e) {
      geocodeStatus.textContent = "⚠️ Standortsuche fehlgeschlagen. Internetverbindung prüfen.";
    } finally {
      geocodeBtn.disabled = false;
    }
  };

  if (isEdit) {
    document.getElementById("btn-delete-site").onclick = async () => {
      const ok = await showConfirm("Baustelle löschen", `"${site.name}" und alle zugehörigen Tagebucheinträge werden unwiderruflich gelöscht.`, "Löschen");
      if (ok) {
        await DB.deleteSite(siteId);
        showToast("Baustelle gelöscht");
        navigate("#/");
      }
    };
  }

  document.getElementById("btn-save-site").onclick = async () => {
    const name = document.getElementById("f-name").value.trim();
    if (!name) { showToast("Bitte einen Namen für die Baustelle angeben"); return; }
    const updated = {
      ...site,
      name,
      client: document.getElementById("f-client").value.trim(),
      address: document.getElementById("f-address").value.trim(),
      description: document.getElementById("f-description").value.trim(),
      active: document.getElementById("f-active").checked,
      weatherPlace: document.getElementById("f-weather-place").value.trim(),
      lat: selectedLocation ? selectedLocation.lat : null,
      lon: selectedLocation ? selectedLocation.lon : null,
      locationLabel: selectedLocation ? selectedLocation.label : "",
    };
    const saved = await DB.saveSite(updated);
    showToast("Baustelle gespeichert");
    navigate(`#/site/${saved.id}`);
  };
}

// ---------- View: Site detail (entries list) ----------

async function renderSiteDetail(siteId) {
  const site = await DB.getSite(siteId);
  if (!site) return navigate("#/");
  const entries = await DB.getEntriesBySite(siteId);

  setTopbar(`
    <button class="btn" id="btn-edit-site">Baustelle bearbeiten</button>
    <button class="btn btn-primary" id="btn-new-entry">+ Neuer Eintrag</button>`);

  const dates = entries.map((e) => e.date).sort();
  const minDate = dates[0] || "";
  const maxDate = dates[dates.length - 1] || "";

  appRoot.innerHTML = `
    <div class="breadcrumb" id="crumb-back">&larr; Zurück zu Baustellen</div>
    <div class="page-header">
      <div>
        <h1>${escapeHtml(site.name)}</h1>
        <div class="subtitle">${escapeHtml(site.address || "")}${site.client ? " • " + escapeHtml(site.client) : ""}</div>
      </div>
    </div>

    <div class="card view-block">
      <h4>PDF Sammelbericht exportieren</h4>
      <div class="form-row" style="align-items:flex-end;">
        <div class="field"><label>Von</label><input type="date" id="f-range-from" value="${escapeHtml(minDate)}"></div>
        <div class="field"><label>Bis</label><input type="date" id="f-range-to" value="${escapeHtml(maxDate)}"></div>
        <div class="field"><button class="btn btn-primary" id="btn-export-range" ${entries.length === 0 ? "disabled" : ""}>\u{1F4C4} Sammelbericht als PDF</button></div>
      </div>
      <div class="field-hint">Exportiert alle Einträge im gewählten Zeitraum als einen zusammenhängenden PDF-Bericht.</div>
    </div>

    <div class="page-header" style="margin-top:22px;"><h3>Tagebucheinträge</h3></div>
    ${entries.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">\u{1F4DD}</div>
        <h3>Noch keine Einträge</h3>
        <p>Erstelle den ersten Bautagebuch-Eintrag für diese Baustelle.</p>
      </div>` : `
      <div class="entry-list">
        ${entries.map((e) => {
          const weatherOpt = WEATHER_OPTIONS.find((w) => w.value === e.weather?.condition);
          const workerCount = (e.workers || []).reduce((sum, r) => sum + (Number(r.count) || 0), 0);
          const photoCount = (e.photos || []).length;
          const summaryText = e.activities || (e.workers || []).map((w2) => w2.activity).find(Boolean) || "";
          return `
          <div class="card entry-row" data-id="${e.id}">
            <div class="entry-date">${weatherOpt ? weatherOpt.icon : ""} ${formatDateDE(e.date)}</div>
            <div class="entry-summary">${escapeHtml(summaryText.slice(0, 90)) || "Keine Beschreibung"}</div>
            <div class="entry-flags">
              ${workerCount ? `<span class="flag">\u{1F477} ${workerCount}</span>` : ""}
              ${photoCount ? `<span class="flag">\u{1F4F7} ${photoCount}</span>` : ""}
              ${e.specialEvents ? `<span class="flag flag-warning">⚠️ Vorkommnis</span>` : ""}
            </div>
          </div>`;
        }).join("")}
      </div>`}
  `;

  document.getElementById("crumb-back").onclick = () => navigate("#/");
  document.getElementById("btn-edit-site").onclick = () => navigate(`#/site/${siteId}/edit`);
  document.getElementById("btn-new-entry").onclick = () => navigate(`#/site/${siteId}/entry/new`);
  appRoot.querySelectorAll(".entry-row").forEach((row) => {
    row.onclick = () => navigate(`#/site/${siteId}/entry/${row.dataset.id}`);
  });

  const exportBtn = document.getElementById("btn-export-range");
  if (exportBtn) {
    exportBtn.onclick = async () => {
      const from = document.getElementById("f-range-from").value;
      const to = document.getElementById("f-range-to").value;
      const filtered = entries
        .filter((e) => (!from || e.date >= from) && (!to || e.date <= to))
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      if (filtered.length === 0) { showToast("Keine Einträge im gewählten Zeitraum"); return; }
      exportBtn.disabled = true;
      exportBtn.textContent = "Erstelle PDF...";
      try {
        await PDF.exportRangePDF(site, filtered, from || filtered[0].date, to || filtered[filtered.length - 1].date);
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = "\u{1F4C4} Sammelbericht als PDF";
      }
    };
  }
}

// ---------- View: Entry form (create/edit) ----------

async function renderEntryForm(siteId, entryId) {
  const site = await DB.getSite(siteId);
  if (!site) return navigate("#/");
  const isEdit = Boolean(entryId);
  const entry = isEdit ? await DB.getEntry(entryId) : {
    siteId, date: todayISO(), author: "", weather: { condition: "", tempMin: "", tempMax: "", ground: "" },
    workers: [], activities: "", specialEvents: "", photos: [],
  };
  if (isEdit && !entry) return navigate(`#/site/${siteId}`);

  const photosState = (entry.photos || []).map((p) => ({ ...p }));

  setTopbar(`<button class="btn" id="btn-cancel">Abbrechen</button>`);
  appRoot.innerHTML = `
    <div class="breadcrumb" id="crumb-back">&larr; Zurück zu ${escapeHtml(site.name)}</div>
    <div class="page-header"><h1>${isEdit ? "Eintrag bearbeiten" : "Neuer Tagebucheintrag"}</h1></div>

    <div class="card form-section">
      <h4>Basisdaten</h4>
      <div class="form-row">
        <div class="field"><label>Datum *</label><input type="date" id="f-date" value="${escapeHtml(entry.date)}"></div>
        <div class="field"><label>Verfasst von</label><input type="text" id="f-author" value="${escapeHtml(entry.author)}" placeholder="Name Bauleiter/in"></div>
      </div>
    </div>

    <div class="card form-section">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <h4 style="margin-bottom:0;">Witterung</h4>
        ${site.lat != null ? `<button class="btn btn-sm" id="btn-fetch-weather" type="button">\u{1F310} Wetter aktualisieren</button>` : ""}
      </div>
      <div id="weather-status" class="field-hint" style="margin-bottom:10px;">
        ${site.lat != null ? `Standort: ${escapeHtml(site.locationLabel || site.weatherPlace || "")}` : "Kein Standort für automatischen Wetterabruf hinterlegt (in den Baustellen-Einstellungen ergänzen)."}
      </div>
      <div class="field" style="margin-bottom:14px;">
        <div class="weather-options" id="weather-options">
          ${WEATHER_OPTIONS.map((w) => `<div class="weather-opt${entry.weather?.condition === w.value ? " selected" : ""}" data-value="${w.value}"><span class="icon">${w.icon}</span>${w.label}</div>`).join("")}
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label>Temperatur min (°C)</label><input type="number" id="f-temp-min" value="${escapeHtml(entry.weather?.tempMin ?? "")}"></div>
        <div class="field"><label>Temperatur max (°C)</label><input type="number" id="f-temp-max" value="${escapeHtml(entry.weather?.tempMax ?? "")}"></div>
        <div class="field"><label>Untergrund</label>
          <select id="f-ground">
            <option value="">Keine Angabe</option>
            ${GROUND_OPTIONS.map((g) => `<option value="${g.value}" ${entry.weather?.ground === g.value ? "selected" : ""}>${g.label}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>

    <div class="card form-section">
      <h4>Nachunternehmer &amp; Gewerke</h4>
      <div id="worker-list"></div>
      <button class="btn btn-sm dyn-add" id="btn-add-worker">+ Firma hinzufügen</button>
    </div>

    <div class="card form-section">
      <h4>Allgemeine Tätigkeiten / Sonstiges</h4>
      <div class="field-hint" style="margin-top:-6px; margin-bottom:10px;">Für Tätigkeiten, die keinem einzelnen Gewerk zugeordnet sind. Gewerkespezifische Tätigkeiten bitte direkt bei der jeweiligen Firma oben eintragen.</div>
      <div class="field"><textarea id="f-activities" placeholder="Allgemeiner Fortschritt, Eigenleistung, Mengen ...">${escapeHtml(entry.activities)}</textarea></div>
    </div>

    <div class="card form-section">
      <h4>Besondere Vorkommnisse / Behinderungen</h4>
      <div class="field"><textarea id="f-events" placeholder="Verzögerungen, Unfälle, Materialengpässe, Witterungsbedingte Ausfälle ...">${escapeHtml(entry.specialEvents)}</textarea></div>
    </div>

    <div class="card form-section" style="padding-bottom:18px;">
      <h4>Fotos</h4>
      <div class="photo-grid" id="photo-grid">
        <label class="photo-upload-btn">
          <span style="font-size:22px;">+</span>
          <span>Fotos hinzufügen</span>
          <input type="file" id="f-photo-input" accept="image/*" multiple style="display:none;">
        </label>
      </div>
    </div>

    <div class="form-actions">
      <div class="spacer"></div>
      <button class="btn" id="btn-cancel-2">Abbrechen</button>
      <button class="btn btn-primary" id="btn-save-entry">Speichern</button>
    </div>`;

  // Weather selection
  let selectedWeather = entry.weather?.condition || "";
  function selectWeatherOption(value) {
    selectedWeather = value || "";
    document.querySelectorAll("#weather-options .weather-opt").forEach((o) => {
      o.classList.toggle("selected", o.dataset.value === value);
    });
  }
  document.querySelectorAll("#weather-options .weather-opt").forEach((opt) => {
    opt.onclick = () => selectWeatherOption(opt.dataset.value);
  });

  // Automatic weather lookup (Open-Meteo) based on the site's stored location
  const weatherStatusEl = document.getElementById("weather-status");
  const fetchWeatherBtn = document.getElementById("btn-fetch-weather");

  async function autoFillWeather(dateStr) {
    if (site.lat == null) return;
    const label = site.locationLabel || site.weatherPlace || "";
    weatherStatusEl.textContent = `\u{1F310} Lade Wetterdaten für ${label} (${formatDateDE(dateStr)}) ...`;
    if (fetchWeatherBtn) fetchWeatherBtn.disabled = true;
    try {
      const result = await Weather.fetchWeatherForDate(site.lat, site.lon, dateStr);
      if (!result) {
        weatherStatusEl.textContent = `⚠️ Keine Wetterdaten für dieses Datum verfügbar. Bitte manuell auswählen.`;
        return;
      }
      if (result.condition) selectWeatherOption(result.condition);
      if (result.tempMin !== "") document.getElementById("f-temp-min").value = result.tempMin;
      if (result.tempMax !== "") document.getElementById("f-temp-max").value = result.tempMax;
      if (result.ground) document.getElementById("f-ground").value = result.ground;
      weatherStatusEl.textContent = `✅ Wetterdaten automatisch geladen für ${label} (${formatDateDE(dateStr)}). Werte können bei Bedarf angepasst werden.`;
    } catch (e) {
      weatherStatusEl.textContent = `⚠️ Wetterdaten konnten nicht geladen werden (Internetverbindung prüfen). Bitte manuell auswählen.`;
    } finally {
      if (fetchWeatherBtn) fetchWeatherBtn.disabled = false;
    }
  }

  if (fetchWeatherBtn) {
    fetchWeatherBtn.onclick = () => autoFillWeather(document.getElementById("f-date").value);
  }
  if (!isEdit && site.lat != null) {
    autoFillWeather(document.getElementById("f-date").value);
  }
  document.getElementById("f-date").addEventListener("change", (e) => {
    if (!isEdit && site.lat != null) autoFillWeather(e.target.value);
  });

  // Worker / trade cards, each with its own activity textarea
  const workerList = document.getElementById("worker-list");
  function addWorkerRow(data) {
    const card = document.createElement("div");
    card.className = "worker-card";
    card.innerHTML = `
      <div class="worker-card-row">
        <div class="field"><label>Firma</label><input type="text" class="w-company" value="${escapeHtml(data?.company || "")}"></div>
        <div class="field"><label>Gewerk</label><input type="text" class="w-trade" value="${escapeHtml(data?.trade || "")}"></div>
        <div class="field" style="max-width:100px;"><label>Anzahl</label><input type="number" class="w-count" min="0" value="${escapeHtml(data?.count ?? "")}"></div>
        <span class="dyn-row-remove" title="Firma entfernen">&times;</span>
      </div>
      <div class="field">
        <label>Tätigkeit dieses Gewerks</label>
        <textarea class="w-activity" placeholder="Ausgeführte Arbeiten dieses Gewerks an diesem Tag ...">${escapeHtml(data?.activity || "")}</textarea>
      </div>`;
    card.querySelector(".dyn-row-remove").onclick = () => card.remove();
    workerList.appendChild(card);
  }
  (entry.workers || []).forEach((w) => addWorkerRow(w));
  document.getElementById("btn-add-worker").onclick = () => addWorkerRow();

  // Photos
  const photoGrid = document.getElementById("photo-grid");
  const uploadBtn = photoGrid.querySelector(".photo-upload-btn");
  function addPhotoThumb(photo) {
    const url = URL.createObjectURL(photo.blob);
    const div = document.createElement("div");
    div.className = "photo-thumb";
    div.dataset.photoId = photo.id;
    div.innerHTML = `
      <img src="${url}">
      <button class="photo-remove" title="Entfernen">&times;</button>
      <input class="photo-caption-input" style="display:none;">`;
    div.querySelector(".photo-remove").onclick = () => {
      const idx = photosState.findIndex((p) => p.id === photo.id);
      if (idx >= 0) photosState.splice(idx, 1);
      div.remove();
    };
    const captionSpan = document.createElement("div");
    captionSpan.className = "photo-caption";
    captionSpan.textContent = photo.caption || "Bildunterschrift +";
    captionSpan.onclick = (e) => {
      e.stopPropagation();
      const val = prompt("Bildunterschrift:", photo.caption || "");
      if (val !== null) {
        photo.caption = val.trim();
        captionSpan.textContent = photo.caption || "Bildunterschrift +";
      }
    };
    div.appendChild(captionSpan);
    photoGrid.insertBefore(div, uploadBtn);
  }
  photosState.forEach((p) => addPhotoThumb(p));

  document.getElementById("f-photo-input").addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const photo = { id: DB.newId(), blob: file, caption: "" };
      photosState.push(photo);
      addPhotoThumb(photo);
    }
    e.target.value = "";
  });

  const back = () => navigate(isEdit ? `#/site/${siteId}/entry/${entryId}` : `#/site/${siteId}`);
  document.getElementById("crumb-back").onclick = () => navigate(`#/site/${siteId}`);
  document.getElementById("btn-cancel").onclick = back;
  document.getElementById("btn-cancel-2").onclick = back;

  document.getElementById("btn-save-entry").onclick = async () => {
    const date = document.getElementById("f-date").value;
    if (!date) { showToast("Bitte ein Datum auswählen"); return; }

    if (!isEdit) {
      const existing = await DB.findEntryByDate(siteId, date);
      if (existing) {
        const ok = await showConfirm("Eintrag existiert bereits", `Für den ${formatDateDE(date)} existiert bereits ein Eintrag. Trotzdem einen zweiten Eintrag anlegen?`, "Trotzdem anlegen", false);
        if (!ok) return;
      }
    }

    const workers = Array.from(workerList.querySelectorAll(".worker-card")).map((card) => ({
      company: card.querySelector(".w-company").value.trim(),
      trade: card.querySelector(".w-trade").value.trim(),
      count: card.querySelector(".w-count").value === "" ? "" : Number(card.querySelector(".w-count").value),
      activity: card.querySelector(".w-activity").value.trim(),
    })).filter((w) => w.company || w.trade || w.count !== "" || w.activity);

    const updated = {
      ...entry,
      siteId,
      date,
      author: document.getElementById("f-author").value.trim(),
      weather: {
        condition: selectedWeather,
        tempMin: document.getElementById("f-temp-min").value,
        tempMax: document.getElementById("f-temp-max").value,
        ground: document.getElementById("f-ground").value,
      },
      workers,
      activities: document.getElementById("f-activities").value.trim(),
      specialEvents: document.getElementById("f-events").value.trim(),
      photos: photosState,
    };

    const saved = await DB.saveEntry(updated);
    showToast("Eintrag gespeichert");
    navigate(`#/site/${siteId}/entry/${saved.id}`);
  };
}

// ---------- View: Entry view (read-only) ----------

async function renderEntryView(siteId, entryId) {
  const site = await DB.getSite(siteId);
  const entry = await DB.getEntry(entryId);
  if (!site || !entry) return navigate(`#/site/${siteId}`);

  setTopbar(`
    <button class="btn" id="btn-export-pdf">\u{1F4C4} PDF exportieren</button>
    <button class="btn" id="btn-edit-entry">Bearbeiten</button>
    <button class="btn btn-danger" id="btn-delete-entry">Löschen</button>`);

  const w = entry.weather || {};
  const weatherOpt = WEATHER_OPTIONS.find((o) => o.value === w.condition);
  const groundOpt = GROUND_OPTIONS.find((o) => o.value === w.ground);

  appRoot.innerHTML = `
    <div class="breadcrumb" id="crumb-back">&larr; Zurück zu ${escapeHtml(site.name)}</div>
    <div class="page-header">
      <div><h1>${formatDateDE(entry.date)}</h1><div class="subtitle">${escapeHtml(site.name)}${entry.author ? " • Verfasst von " + escapeHtml(entry.author) : ""}</div></div>
    </div>

    <div class="card view-block">
      <h4>Witterung</h4>
      <div class="view-grid">
        <div class="view-field"><div class="label">Wetter</div><div class="value">${weatherOpt ? weatherOpt.icon + " " + weatherOpt.label : "-"}</div></div>
        <div class="view-field"><div class="label">Temperatur</div><div class="value">${w.tempMin !== "" && w.tempMin != null ? w.tempMin : "?"}°C - ${w.tempMax !== "" && w.tempMax != null ? w.tempMax : "?"}°C</div></div>
        <div class="view-field"><div class="label">Untergrund</div><div class="value">${groundOpt ? groundOpt.label : "-"}</div></div>
      </div>
    </div>

    <div class="card view-block">
      <h4>Nachunternehmer &amp; Gewerke</h4>
      ${(entry.workers || []).length === 0 ? '<div class="text-block">Keine Angaben</div>' : `
        <div class="worker-view-list">
          ${entry.workers.map((w2) => `
            <div class="worker-view-item">
              <div class="worker-view-header">
                <span class="worker-view-company">${escapeHtml(w2.company || "-")}</span>
                <span class="worker-view-trade">${escapeHtml(w2.trade || "-")}</span>
                <span class="worker-view-count">${w2.count !== "" && w2.count != null ? w2.count + " Personen" : ""}</span>
              </div>
              <div class="text-block">${escapeHtml(w2.activity) || "Keine Tätigkeit angegeben"}</div>
            </div>`).join("")}
        </div>`}
    </div>

    <div class="card view-block">
      <h4>Allgemeine Tätigkeiten / Sonstiges</h4>
      <div class="text-block">${escapeHtml(entry.activities) || "Keine Angaben"}</div>
    </div>

    <div class="card view-block">
      <h4>Besondere Vorkommnisse / Behinderungen</h4>
      <div class="text-block">${escapeHtml(entry.specialEvents) || "Keine"}</div>
    </div>

    ${(entry.photos || []).length > 0 ? `
    <div class="card view-block">
      <h4>Fotos</h4>
      <div class="photo-grid" id="view-photo-grid"></div>
    </div>` : ""}
  `;

  if ((entry.photos || []).length > 0) {
    const grid = document.getElementById("view-photo-grid");
    for (const p of entry.photos) {
      const url = URL.createObjectURL(p.blob);
      const div = document.createElement("div");
      div.className = "photo-thumb";
      div.innerHTML = `<img src="${url}">${p.caption ? `<div class="photo-caption">${escapeHtml(p.caption)}</div>` : ""}`;
      grid.appendChild(div);
    }
  }

  document.getElementById("crumb-back").onclick = () => navigate(`#/site/${siteId}`);
  document.getElementById("btn-edit-entry").onclick = () => navigate(`#/site/${siteId}/entry/${entryId}/edit`);
  document.getElementById("btn-delete-entry").onclick = async () => {
    const ok = await showConfirm("Eintrag löschen", `Der Eintrag vom ${formatDateDE(entry.date)} wird unwiderruflich gelöscht.`, "Löschen");
    if (ok) {
      await DB.deleteEntry(entryId);
      showToast("Eintrag gelöscht");
      navigate(`#/site/${siteId}`);
    }
  };
  document.getElementById("btn-export-pdf").onclick = async (e) => {
    e.target.disabled = true;
    e.target.textContent = "Erstelle PDF...";
    try {
      await PDF.exportEntryPDF(site, entry);
    } finally {
      e.target.disabled = false;
      e.target.textContent = "\u{1F4C4} PDF exportieren";
    }
  };
}

// ---------- Boot ----------

render();

// Register service worker for offline/installable use (PWA). No-op if unsupported
// (e.g. when the file is opened directly via file:// instead of a web server).
if ("serviceWorker" in navigator && (location.protocol === "http:" || location.protocol === "https:")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service Worker Registrierung fehlgeschlagen:", err));
  });
}
