/* PDF export for Bautagebuch entries, built on jsPDF (see vendor/jspdf.umd.min.js). */

const WEATHER_LABELS = {
  sonnig: "Sonnig",
  bewoelkt: "Bewoelkt",
  regen: "Regen",
  schnee: "Schnee",
  sturm: "Sturm",
  neblig: "Neblig",
};

const GROUND_LABELS = {
  trocken: "Trocken",
  feucht: "Feucht",
  nass: "Nass",
  gefroren: "Gefroren",
};

function formatDateDE(isoDate) {
  if (!isoDate) return "-";
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getImageSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve({ w: 4, h: 3 });
    img.src = dataUrl;
  });
}

const PAGE_MARGIN = 14;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

function drawSiteHeader(doc, site) {
  doc.setFillColor(217, 115, 13);
  doc.rect(0, 0, PAGE_WIDTH, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text("Bautagebuch", PAGE_MARGIN, 14);
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text(site.name || "Baustelle", PAGE_WIDTH - PAGE_MARGIN, 14, { align: "right" });
  doc.setTextColor(30, 30, 30);
}

function sectionTitle(doc, y, text) {
  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  doc.setTextColor(217, 115, 13);
  doc.text(text.toUpperCase(), PAGE_MARGIN, y);
  doc.setTextColor(30, 30, 30);
  doc.setFont(undefined, "normal");
  doc.setDrawColor(230, 230, 230);
  doc.line(PAGE_MARGIN, y + 1.5, PAGE_WIDTH - PAGE_MARGIN, y + 1.5);
  return y + 7;
}

function ensureSpace(doc, y, needed) {
  if (y + needed > 285) {
    doc.addPage();
    return 18;
  }
  return y;
}

async function renderEntrySection(doc, site, entry, startY) {
  let y = startY;

  doc.setFont(undefined, "bold");
  doc.setFontSize(13);
  doc.text(formatDateDE(entry.date), PAGE_MARGIN, y);
  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(entry.author ? `Verfasst von: ${entry.author}` : "", PAGE_WIDTH - PAGE_MARGIN, y, { align: "right" });
  doc.setTextColor(30, 30, 30);
  y += 8;

  // Weather block
  y = sectionTitle(doc, y, "Witterung");
  const w = entry.weather || {};
  const weatherLine = [
    WEATHER_LABELS[w.condition] || "-",
    (w.tempMin !== "" && w.tempMin != null) || (w.tempMax !== "" && w.tempMax != null)
      ? `${w.tempMin ?? "?"}°C bis ${w.tempMax ?? "?"}°C`
      : null,
    w.ground ? `Untergrund: ${GROUND_LABELS[w.ground] || w.ground}` : null,
  ].filter(Boolean).join("   |   ");
  doc.setFontSize(10);
  doc.text(weatherLine || "Keine Angaben", PAGE_MARGIN, y);
  y += 9;

  // Workers / trades, each with its own activity text
  y = ensureSpace(doc, y, 20);
  y = sectionTitle(doc, y, "Nachunternehmer / Gewerke");
  const workers = entry.workers || [];
  if (workers.length === 0) {
    doc.setFontSize(10);
    doc.text("Keine Angaben", PAGE_MARGIN, y);
    y += 9;
  } else {
    doc.setDrawColor(240, 240, 240);
    for (const row of workers) {
      y = ensureSpace(doc, y, 12);
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.text(String(row.company || "-"), PAGE_MARGIN, y);
      doc.setFont(undefined, "normal");
      doc.setTextColor(100, 100, 100);
      const headerRight = [row.trade || "-", row.count !== "" && row.count != null ? `${row.count} Personen` : null].filter(Boolean).join("   |   ");
      doc.text(headerRight, PAGE_WIDTH - PAGE_MARGIN, y, { align: "right" });
      doc.setTextColor(30, 30, 30);
      y += 5.5;
      doc.setFontSize(9.5);
      const activityLines = doc.splitTextToSize(row.activity || "Keine Taetigkeit angegeben", CONTENT_WIDTH);
      for (const line of activityLines) {
        y = ensureSpace(doc, y, 5.5);
        doc.text(line, PAGE_MARGIN, y);
        y += 5;
      }
      y += 2;
      doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
      y += 5;
    }
  }

  // General activities not tied to a specific trade
  y = ensureSpace(doc, y, 16);
  y = sectionTitle(doc, y, "Allgemeine Taetigkeiten / Sonstiges");
  doc.setFontSize(10);
  const activityLines = doc.splitTextToSize(entry.activities || "Keine Angaben", CONTENT_WIDTH);
  for (const line of activityLines) {
    y = ensureSpace(doc, y, 6);
    doc.text(line, PAGE_MARGIN, y);
    y += 5.5;
  }
  y += 3;

  // Special events
  y = ensureSpace(doc, y, 16);
  y = sectionTitle(doc, y, "Besondere Vorkommnisse / Behinderungen");
  doc.setFontSize(10);
  const eventLines = doc.splitTextToSize(entry.specialEvents || "Keine", CONTENT_WIDTH);
  for (const line of eventLines) {
    y = ensureSpace(doc, y, 6);
    doc.text(line, PAGE_MARGIN, y);
    y += 5.5;
  }
  y += 3;

  // Photos
  const photos = entry.photos || [];
  if (photos.length > 0) {
    y = ensureSpace(doc, y, 20);
    y = sectionTitle(doc, y, "Fotos");
    const colWidth = (CONTENT_WIDTH - 6) / 2;
    let col = 0;
    for (const photo of photos) {
      const dataUrl = await blobToDataURL(photo.blob);
      const { w: iw, h: ih } = await getImageSize(dataUrl);
      const imgH = colWidth * (ih / iw);
      y = ensureSpace(doc, y, imgH + 8);
      const x = PAGE_MARGIN + col * (colWidth + 6);
      try {
        doc.addImage(dataUrl, "JPEG", x, y, colWidth, imgH);
      } catch (e) {
        doc.addImage(dataUrl, "PNG", x, y, colWidth, imgH);
      }
      if (photo.caption) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(photo.caption, x, y + imgH + 4, { maxWidth: colWidth });
        doc.setTextColor(30, 30, 30);
      }
      if (col === 1) {
        y += imgH + (photo.caption ? 9 : 5);
        col = 0;
      } else {
        col = 1;
      }
    }
    if (col === 1) y += 5;
  }

  return y;
}

async function exportEntryPDF(site, entry) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawSiteHeader(doc, site);
  let y = 32;
  y = await renderEntrySection(doc, site, entry, y);
  doc.save(`Bautagebuch_${sanitizeFilename(site.name)}_${entry.date}.pdf`);
}

async function exportRangePDF(site, entries, fromDate, toDate) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  drawSiteHeader(doc, site);
  doc.setFontSize(20);
  doc.setFont(undefined, "bold");
  doc.text("Sammelbericht", PAGE_MARGIN, 45);
  doc.setFont(undefined, "normal");
  doc.setFontSize(11);
  doc.text(`Zeitraum: ${formatDateDE(fromDate)} bis ${formatDateDE(toDate)}`, PAGE_MARGIN, 55);
  if (site.address) doc.text(`Adresse: ${site.address}`, PAGE_MARGIN, 62);
  if (site.client) doc.text(`Auftraggeber: ${site.client}`, PAGE_MARGIN, 69);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Anzahl Eintraege: ${entries.length}`, PAGE_MARGIN, 78);
  doc.setTextColor(30, 30, 30);

  let y = 90;
  doc.setFontSize(9);
  doc.setFont(undefined, "bold");
  doc.text("Datum", PAGE_MARGIN, y);
  doc.text("Witterung", PAGE_MARGIN + 35, y);
  doc.text("Firmen/Anzahl", PAGE_MARGIN + 80, y);
  doc.text("Besonderheiten", PAGE_MARGIN + 130, y);
  doc.setFont(undefined, "normal");
  y += 5;
  doc.setDrawColor(230, 230, 230);
  for (const entry of entries) {
    y = ensureSpace(doc, y, 6);
    const w = entry.weather || {};
    const workerCount = (entry.workers || []).reduce((sum, r) => sum + (Number(r.count) || 0), 0);
    doc.text(formatDateDE(entry.date), PAGE_MARGIN, y);
    doc.text(WEATHER_LABELS[w.condition] || "-", PAGE_MARGIN + 35, y);
    doc.text(String(workerCount || "-"), PAGE_MARGIN + 80, y);
    const flag = entry.specialEvents ? "Ja" : "-";
    doc.text(flag, PAGE_MARGIN + 130, y);
    doc.line(PAGE_MARGIN, y + 2, PAGE_WIDTH - PAGE_MARGIN, y + 2);
    y += 6;
  }

  for (const entry of entries) {
    doc.addPage();
    drawSiteHeader(doc, site);
    await renderEntrySection(doc, site, entry, 32);
  }

  doc.save(`Sammelbericht_${sanitizeFilename(site.name)}_${fromDate}_bis_${toDate}.pdf`);
}

function sanitizeFilename(name) {
  return String(name || "Baustelle").replace(/[^a-z0-9\-_]+/gi, "_");
}

window.PDF = { exportEntryPDF, exportRangePDF };
