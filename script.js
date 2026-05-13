const form = document.querySelector("#card-form");
const eventNumberInput = document.querySelector("#event-number");
const eventDateInput = document.querySelector("#event-date");
const eventLocationInput = document.querySelector("#event-location");
const fightSectionInput = document.querySelector("#fight-section");
const boutTypeInput = document.querySelector("#bout-type");
const divisionControls = document.querySelector("#division-controls");
const divisionModeInput = document.querySelector("#division-mode");
const customDivisionWrap = document.querySelector("#custom-division-wrap");
const customDivisionInput = document.querySelector("#custom-division");
const fighterAInput = document.querySelector("#fighter-a");
const fighterBInput = document.querySelector("#fighter-b");
const weightPreview = document.querySelector("#weight-preview");
const addFightButton = document.querySelector("#add-fight");
const clearCardButton = document.querySelector("#clear-card");
const fightersList = document.querySelector("#fighters-list");
const fightList = document.querySelector("#fight-list");
const fightCount = document.querySelector("#fight-count");
const canvas = document.querySelector("#poster-canvas");
const ctx = canvas.getContext("2d");
const download = document.querySelector("#download");

const sectionLabels = {
  mainEvent: "MAIN EVENT",
  coMain: "CO-MAIN EVENT",
  mainCard: "MAIN CARD",
  prelims: "PRELIMS",
  earlyPrelims: "EARLY PRELIMS",
};

const sectionOrder = ["mainEvent", "coMain", "mainCard", "prelims", "earlyPrelims"];

const flagCodes = {
  "United States": "US",
  England: "GB-ENG",
  Scotland: "GB-SCT",
  Wales: "GB-WLS",
  Ireland: "IE",
  Brazil: "BR",
  Russia: "RU",
  France: "FR",
  Poland: "PL",
  Ukraine: "UA",
  Switzerland: "CH",
  "South Africa": "ZA",
  Nigeria: "NG",
  Australia: "AU",
  Italy: "IT",
  Kazakhstan: "KZ",
  Armenia: "AM",
  Azerbaijan: "AZ",
  Georgia: "GE",
  "Czech Republic": "CZ",
  Mexico: "MX",
  China: "CN",
  Ecuador: "EC",
  "New Zealand": "NZ",
  Angola: "AO",
  Iraq: "IQ",
  Japan: "JP",
  Kyrgyzstan: "KG",
  "United Arab Emirates": "AE",
};

let fighters = [];
let fights = [];
const imageCache = new Map();

function normalize(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getFighter(name) {
  const target = normalize(name);
  return fighters.find((fighter) => normalize(fighter.name) === target)
    || fighters.find((fighter) => normalize(fighter.name).includes(target) && target.length >= 3);
}

function getWeightClass(a, b) {
  if (!a || !b) return "Select two fighters";
  return a.weightClass === b.weightClass ? a.weightClass : "Catchweight";
}

function getBoutLabel(type, weightClass) {
  const division = String(weightClass || "Catchweight").toUpperCase();
  if (type === "title") return `WORLD ${division} CHAMPIONSHIP`;
  if (type === "interim") return `INTERIM ${division} CHAMPIONSHIP`;
  return `${division} BOUT`;
}

function getSelectedDivision(a, b) {
  if (!a || !b) return "Catchweight";
  if (a.weightClass === b.weightClass) return a.weightClass;
  if (divisionModeInput.value === "fighterA") return a.weightClass;
  if (divisionModeInput.value === "fighterB") return b.weightClass;
  if (divisionModeInput.value === "custom") return customDivisionInput.value.trim() || "Catchweight";
  return "Catchweight";
}

function updateWeightPreview() {
  const a = getFighter(fighterAInput.value);
  const b = getFighter(fighterBInput.value);
  const mismatch = Boolean(a && b && a.weightClass !== b.weightClass);
  divisionControls.hidden = !mismatch;
  customDivisionWrap.hidden = divisionModeInput.value !== "custom";
  const weightClass = getSelectedDivision(a, b);
  weightPreview.textContent = a && b
    ? `${weightClass}. ${getBoutLabel(boutTypeInput.value, weightClass)}.`
    : "Select two fighters to auto-detect the weight class.";
}

function renderFighterOptions() {
  fightersList.replaceChildren(
    ...fighters.map((fighter) => {
      const option = document.createElement("option");
      option.value = fighter.name;
      option.label = `${fighter.name} - ${fighter.weightClass}`;
      return option;
    }),
  );
}

function titleCaseSection(section) {
  return sectionLabels[section] || "MAIN CARD";
}

function renderFightList() {
  fightCount.textContent = `${fights.length} ${fights.length === 1 ? "fight" : "fights"}`;

  if (!fights.length) {
    const empty = document.createElement("p");
    empty.className = "status";
    empty.textContent = "No fights added yet.";
    fightList.replaceChildren(empty);
    return;
  }

  fightList.replaceChildren(
    ...fights.map((fight, index) => {
      const item = document.createElement("div");
      item.className = "fight-item";
      item.innerHTML = `
        <div>
          <strong>${fight.a.name} vs ${fight.b.name}</strong>
          <span>${titleCaseSection(fight.section)} - ${getBoutLabel(fight.type, fight.weightClass)}</span>
        </div>
      `;
      const remove = document.createElement("button");
      remove.className = "button button-dark";
      remove.type = "button";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        fights.splice(index, 1);
        renderFightList();
        renderPoster();
      });
      item.appendChild(remove);
      return item;
    }),
  );
}

function sortedFights() {
  return [...fights].sort((a, b) => {
    const sectionGap = sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section);
    return sectionGap || a.createdAt - b.createdAt;
  });
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 45) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 45) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawPosterTexture() {
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let index = 0; index < 620; index += 1) {
    const x = (index * 83) % canvas.width;
    const y = (index * 149) % canvas.height;
    const size = ((index * 17) % 3) + 0.8;
    ctx.fillStyle = index % 5 === 0 ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.55)";
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  for (let index = 0; index < 24; index += 1) {
    const x = (index * 97) % canvas.width;
    const y = (index * 211) % canvas.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 40 + (index % 5) * 22, y - 16 + (index % 7) * 8);
    ctx.stroke();
  }
  ctx.restore();
}

function fitText(text, maxWidth, size, minSize, family = "Impact, Arial Black, sans-serif") {
  let current = size;
  while (current >= minSize) {
    ctx.font = `900 ${current}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return current;
    current -= 2;
  }
  return minSize;
}

function drawCenteredText(text, x, y, maxWidth, size, color = "#fff", family = "Impact, Arial Black, sans-serif") {
  const fitted = fitText(text, maxWidth, size, 12, family);
  ctx.fillStyle = color;
  ctx.font = `900 ${fitted}px ${family}`;
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

function drawCondensedText(text, x, y, maxWidth, size, color = "#fff", align = "center") {
  drawCenteredText(text, x, y, maxWidth, size, color, "'Arial Narrow', Arial, sans-serif");
}

function drawCondensedMiddle(text, x, y, maxWidth, size, color = "#fff") {
  const fitted = fitText(text, maxWidth, size, 12, "'Arial Narrow', Arial, sans-serif");
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `900 ${fitted}px 'Arial Narrow', Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawFightTitle(fight, x, y, maxWidth, size) {
  const left = lastName(fight.a.name).toUpperCase();
  const right = lastName(fight.b.name).toUpperCase();
  let current = size;
  let metrics;

  while (current >= 10) {
    ctx.font = `800 ${current}px 'Arial Narrow', Arial, sans-serif`;
    const leftWidth = ctx.measureText(left).width;
    const rightWidth = ctx.measureText(right).width;
    ctx.font = `800 ${Math.max(8, current * 0.58)}px 'Arial Narrow', Arial, sans-serif`;
    const vsWidth = ctx.measureText("VS").width;
    const total = leftWidth + rightWidth + vsWidth + current * 0.34;
    if (total <= maxWidth) {
      metrics = { leftWidth, rightWidth, vsWidth, total, vsSize: Math.max(8, current * 0.58) };
      break;
    }
    current -= 1;
  }

  if (!metrics) {
    ctx.font = `800 ${current}px 'Arial Narrow', Arial, sans-serif`;
    metrics = { leftWidth: ctx.measureText(left).width, rightWidth: ctx.measureText(right).width, vsWidth: 12, total: maxWidth, vsSize: 8 };
  }

  const start = x - metrics.total / 2;
  const gap = current * 0.11;
  let cursor = start;
  ctx.fillStyle = "#f5f5f0";
  ctx.textAlign = "left";
  ctx.font = `800 ${current}px 'Arial Narrow', Arial, sans-serif`;
  ctx.fillText(left, cursor, y);
  cursor += metrics.leftWidth + gap;

  ctx.font = `800 ${metrics.vsSize}px 'Arial Narrow', Arial, sans-serif`;
  const vsY = y - current * 0.1;
  ctx.fillText("VS", cursor, vsY);
  ctx.strokeStyle = "#f5f5f0";
  ctx.lineWidth = Math.max(1, current * 0.08);
  ctx.beginPath();
  ctx.moveTo(cursor, vsY + 3);
  ctx.lineTo(cursor + metrics.vsWidth, vsY + 3);
  ctx.stroke();
  cursor += metrics.vsWidth + gap;

  ctx.font = `800 ${current}px 'Arial Narrow', Arial, sans-serif`;
  ctx.fillText(right, cursor, y);
}

function getInitials(name) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
}

function lastName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const suffixes = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);
  while (parts.length > 1 && suffixes.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }
  return parts[parts.length - 1] || name;
}

function drawFlagFallback(country, x, y, width, height) {
  const code = flagCodes[country] || country.slice(0, 2).toUpperCase();
  ctx.fillStyle = "#f5f5f0";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#171512";
  ctx.font = "900 14px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(code, x + width / 2, y + height / 2 + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

async function drawFlag(fighter, x, y, width, height) {
  const image = await loadImage(fighter.flag);
  if (!image) {
    drawFlagFallback(fighter.country, x, y, width, height);
    return;
  }

  ctx.drawImage(image, x, y, width, height);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.strokeRect(x, y, width, height);
}

function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (imageCache.has(src)) return imageCache.get(src);

  const promise = new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => resolve(null), { once: true });
    image.src = src;
  });

  imageCache.set(src, promise);
  return promise;
}

async function drawFighterHeadshot(fighter, x, y, width, height, accent = "#f4d33f") {
  const image = await loadImage(fighter.image);
  ctx.save();
  roundRect(x, y, width, height, 4);
  ctx.clip();

  const grad = ctx.createLinearGradient(x, y, x + width, y + height);
  grad.addColorStop(0, "rgba(18,76,72,0.92)");
  grad.addColorStop(0.55, "rgba(9,42,43,0.96)");
  grad.addColorStop(1, "rgba(5,22,24,0.98)");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, width, height);

  if (image) {
    const scale = Math.max(width / image.width, height / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    ctx.drawImage(image, x + (width - drawW) / 2, y + (height - drawH) / 2, drawW, drawH);
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height * 0.38, width * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height * 0.82, width * 0.36, height * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    drawCenteredText(getInitials(fighter.name), x + width / 2, y + height * 0.56, width - 10, width * 0.28, "#f5f5f0");
  }

  ctx.restore();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, height);
  await drawFlag(fighter, x + 4, y + height - 22, 34, 18);
}

function sectionMeta(section) {
  if (section === "prelims") return { time: "PRELIMS", platform: "" };
  if (section === "earlyPrelims") return { time: "EARLY PRELIMS", platform: "" };
  return { time: "MAIN CARD", platform: "" };
}

function drawLogo(eventNumber) {
  ctx.fillStyle = "#050505";
  ctx.fillRect(338, 0, 224, 118);
  ctx.fillStyle = "#f4d33f";
  ctx.font = "italic 900 48px Impact, Arial Black, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("UFC", 421, 76);
  ctx.font = "italic 900 28px Impact, Arial Black, sans-serif";
  ctx.fillText(eventNumber || "000", 482, 76);
  ctx.strokeStyle = "#f4d33f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(462, 86);
  ctx.lineTo(508, 86);
  ctx.stroke();
  ctx.textAlign = "left";
}

async function drawFightPair(fight, x, y, width, headHeight, nameSize = 26, boutSize = 11) {
  const gap = 6;
  const headW = (width - gap) / 2;
  await drawFighterHeadshot(fight.a, x, y, headW, headHeight);
  await drawFighterHeadshot(fight.b, x + headW + gap, y, headW, headHeight);
  drawFightTitle(fight, x + width / 2, y + headHeight + nameSize + 1, width + 12, nameSize);
  drawCenteredText(getBoutLabel(fight.type, fight.weightClass).toUpperCase(), x + width / 2, y + headHeight + nameSize + boutSize + 5, width + 16, boutSize, "#f4d33f", "Arial Narrow, Arial, sans-serif");
}

async function drawSmallFight(fight, x, y, width, headHeight = 78, nameSize = 18) {
  if (!fight) {
    drawEmptySlot(x, y, width, headHeight, nameSize);
    return;
  }
  const gap = 6;
  const headW = (width - gap) / 2;
  await drawFighterHeadshot(fight.a, x, y, headW, headHeight);
  await drawFighterHeadshot(fight.b, x + headW + gap, y, headW, headHeight);
  drawFightTitle(fight, x + width / 2, y + headHeight + nameSize + 3, width + 10, nameSize);
  const label = fight.type === "title" || fight.type === "interim"
    ? getBoutLabel(fight.type, fight.weightClass)
    : fight.weightClass;
  drawCenteredText(label.toUpperCase(), x + width / 2, y + headHeight + nameSize + 18, width, 9, "#f4d33f", "Arial Narrow, Arial, sans-serif");
}

function drawEmptySlot(x, y, width, headHeight = 78, nameSize = 18, label = "TBA") {
  const gap = 6;
  const headW = (width - gap) / 2;
  ctx.save();
  [x, x + headW + gap].forEach((boxX) => {
    const grad = ctx.createLinearGradient(boxX, y, boxX + headW, y + headHeight);
    grad.addColorStop(0, "rgba(255,255,255,0.07)");
    grad.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = grad;
    ctx.fillRect(boxX, y, headW, headHeight);
    ctx.strokeStyle = "rgba(244,211,63,0.34)";
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, y, headW, headHeight);
  });
  ctx.globalAlpha = 0.42;
  drawCondensedText(`${label} TBA`, x + width / 2, y + headHeight + nameSize + 3, width, nameSize, "#fff");
  drawCenteredText("ADD FIGHT", x + width / 2, y + headHeight + nameSize + 18, width, 9, "#f4d33f", "Arial Narrow, Arial, sans-serif");
  ctx.restore();
}

function drawSectionBar(text, y, platform = "") {
  ctx.fillStyle = "#050505";
  ctx.fillRect(28, y, canvas.width - 56, 43);
  ctx.strokeStyle = "#f5f5f0";
  ctx.lineWidth = 2;
  ctx.strokeRect(28, y, canvas.width - 56, 43);
  drawCondensedText(`${text}${platform ? `  ${platform}` : ""}`, canvas.width / 2, y + 31, canvas.width - 90, 28, "#fff");
}

async function renderPoster() {
  const ordered = sortedFights();
  const mainEvent = ordered.find((fight) => fight.section === "mainEvent") || ordered[0];
  const coMain = ordered.find((fight) => fight.section === "coMain");
  const mainCard = ordered.filter((fight) => fight.section === "mainCard");
  const prelims = ordered.filter((fight) => fight.section === "prelims");
  const earlyPrelims = ordered.filter((fight) => fight.section === "earlyPrelims");

  ctx.fillStyle = "#071010";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bg = ctx.createRadialGradient(450, 310, 10, 450, 460, 780);
  bg.addColorStop(0, "rgba(16,68,66,0.96)");
  bg.addColorStop(0.46, "rgba(11,46,45,0.94)");
  bg.addColorStop(0.78, "rgba(6,24,25,0.98)");
  bg.addColorStop(1, "rgba(3,8,9,1)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawPosterTexture();

  ctx.fillStyle = "rgba(255,255,255,0.055)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(130, 0);
  ctx.lineTo(0, 245);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(canvas.width, 160);
  ctx.lineTo(canvas.width, 710);
  ctx.lineTo(715, 710);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(190,10,34,0.18)";
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(canvas.width, canvas.height - 260);
  ctx.lineTo(0, canvas.height - 150);
  ctx.closePath();
  ctx.fill();

  drawLogo(eventNumberInput.value.trim());
  ctx.font = "900 25px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText("jakublabs.xyz", 450, 154);
  drawCondensedText("MAIN CARD", 450, 192, 250, 30, "#fff");

  if (mainEvent) {
    await drawFightPair(mainEvent, 32, 54, 284, 138, 24, 9);
  } else {
    drawEmptySlot(32, 54, 284, 138, 24, "MAIN EVENT");
  }

  if (coMain) {
    await drawFightPair(coMain, 584, 54, 284, 138, 24, 9);
  } else {
    drawEmptySlot(584, 54, 284, 138, 24, "CO-MAIN");
  }

  let y = 294;
  const mainGrid = mainCard.slice(0, 4);
  const mainCardW = 190;
  if (mainGrid.length) {
    for (let index = 0; index < mainGrid.length; index += 1) {
      await drawSmallFight(mainGrid[index], 34 + index * 216, y, mainCardW, 104, 16);
    }
  } else {
    drawEmptySlot(34, y, mainCardW, 104, 16, "MAIN CARD");
  }
  y += 156;

  const prelimMeta = sectionMeta("prelims");
  drawSectionBar(prelimMeta.time, y, prelimMeta.platform);
  y += 52;
  const cardW = 192;
  if (prelims.length) {
    for (let index = 0; index < Math.min(prelims.length, 4); index += 1) {
      await drawSmallFight(prelims[index], 34 + index * 216, y, cardW, 104, 16);
    }
  } else {
    drawEmptySlot(34, y, cardW, 104, 16, "PRELIMS");
  }
  y += 158;

  const earlyMeta = sectionMeta("earlyPrelims");
  drawSectionBar(earlyMeta.time, y, earlyMeta.platform);
  y += 52;
  if (earlyPrelims.length) {
    for (let index = 0; index < Math.min(earlyPrelims.length, 4); index += 1) {
      await drawSmallFight(earlyPrelims[index], 34 + index * 216, y, cardW, 104, 16);
    }
  } else {
    drawEmptySlot(34, y, cardW, 104, 16, "EARLY PRELIMS");
  }

  ctx.fillStyle = "#050505";
  ctx.fillRect(28, 928, canvas.width - 56, 58);
  ctx.strokeStyle = "#f4d33f";
  ctx.strokeRect(28, 928, canvas.width - 56, 58);
  drawCondensedMiddle(eventDateInput.value.trim().toUpperCase() || "DATE TBA", canvas.width / 2, 958, canvas.width - 80, 46, "#f4d33f");

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "900 14px Arial, sans-serif";
  ctx.fillText("jakublabs.xyz", 30, 1000);

  updateDownload();
}

function updateDownload() {
  download.href = canvas.toDataURL("image/png");
  download.download = `ufc-${eventNumberInput.value.trim() || "card"}.png`;
}

function addFight() {
  const a = getFighter(fighterAInput.value);
  const b = getFighter(fighterBInput.value);

  if (!a || !b || a.name === b.name) {
    weightPreview.textContent = "Pick two different fighters from the roster.";
    return;
  }

  const weightClass = getSelectedDivision(a, b);
  const section = fightSectionInput.value;
  const type = boutTypeInput.value;

  if (section === "mainEvent") fights = fights.filter((fight) => fight.section !== "mainEvent");
  if (section === "coMain") fights = fights.filter((fight) => fight.section !== "coMain");

  fights.push({ a, b, section, type, weightClass, createdAt: Date.now() + Math.random() });
  fighterAInput.value = "";
  fighterBInput.value = "";
  updateWeightPreview();
  renderFightList();
  renderPoster();
}

async function loadFighters() {
  try {
    const response = await fetch("data/fighters.json?v=1");
    fighters = await response.json();
  } catch {
    fighters = [];
    weightPreview.textContent = "Could not load fighter roster.";
  }
  renderFighterOptions();
}

[fighterAInput, fighterBInput, boutTypeInput, divisionModeInput, customDivisionInput].forEach((input) => {
  input.addEventListener("input", updateWeightPreview);
  input.addEventListener("change", updateWeightPreview);
});

[eventNumberInput, eventDateInput, eventLocationInput].forEach((input) => {
  input.addEventListener("input", renderPoster);
});

addFightButton.addEventListener("click", addFight);

clearCardButton.addEventListener("click", () => {
  fights = [];
  renderFightList();
  renderPoster();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  renderPoster();
});

download.addEventListener("click", (event) => {
  if (!download.href || download.href.endsWith("#")) {
    event.preventDefault();
    renderPoster();
  }
});

loadFighters().then(() => {
  renderFightList();
  renderPoster();
});
