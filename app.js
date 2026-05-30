const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

const elements = {
  video: $("#cameraFeed"),
  canvas: $("#captureCanvas"),
  stage: $("#cameraStage"),
  message: $("#cameraMessage"),
  countdown: $("#countdown"),
  flash: $("#flash"),
  startCameraBtn: $("#startCameraBtn"),
  captureBtn: $("#captureBtn"),
  switchCameraBtn: $("#switchCameraBtn"),
  shotStrip: $("#shotStrip"),
  shotCounter: $("#shotCounter"),
  timerSelect: $("#timerSelect"),
  ratioSelect: $("#ratioSelect"),
  mirrorToggle: $("#mirrorToggle"),
  soundToggle: $("#soundToggle"),
  filterGrid: $("#filterGrid"),
  filterName: $("#filterName"),
  frameSelect: $("#frameSelect"),
  stickerSelect: $("#stickerSelect"),
  eventInput: $("#eventInput"),
  captionInput: $("#captionInput"),
  textColorInput: $("#textColorInput"),
  accentColorInput: $("#accentColorInput"),
  overlayEvent: $("#overlayEvent"),
  overlayCaption: $("#overlayCaption"),
  resultPreview: $("#resultPreview"),
  resultStatus: $("#resultStatus"),
  downloadBtn: $("#downloadBtn"),
  printBtn: $("#printBtn"),
  shareBtn: $("#shareBtn"),
  resetBtn: $("#resetBtn"),
  galleryGrid: $("#galleryGrid"),
  galleryCount: $("#galleryCount"),
  helpBtn: $("#helpBtn"),
  helpDialog: $("#helpDialog"),
  installBtn: $("#installBtn"),
};

const filters = [
  { id: "clean", name: "Clean", css: "none", canvas: "none" },
  {
    id: "glow",
    name: "Glow",
    css: "brightness(1.08) saturate(1.12) contrast(1.04)",
    canvas: "brightness(1.08) saturate(1.12) contrast(1.04)",
  },
  {
    id: "mono",
    name: "Mono",
    css: "grayscale(1) contrast(1.12)",
    canvas: "grayscale(1) contrast(1.12)",
  },
  {
    id: "candy",
    name: "Candy",
    css: "saturate(1.36) hue-rotate(-8deg) brightness(1.04)",
    canvas: "saturate(1.36) hue-rotate(-8deg) brightness(1.04)",
  },
  {
    id: "film",
    name: "Film",
    css: "sepia(0.24) contrast(1.08) saturate(0.92)",
    canvas: "sepia(0.24) contrast(1.08) saturate(0.92)",
  },
  {
    id: "aqua",
    name: "Aqua",
    css: "hue-rotate(18deg) saturate(1.18) brightness(1.02)",
    canvas: "hue-rotate(18deg) saturate(1.18) brightness(1.02)",
  },
];

const layouts = {
  single: { label: "Single", shots: 1, width: 1440, height: 1800 },
  strip3: { label: "Strip 3", shots: 3, width: 960, height: 2400 },
  grid4: { label: "Grid 4", shots: 4, width: 1800, height: 2200 },
  postcard: { label: "Postcard", shots: 2, width: 1800, height: 1300 },
};

const frames = {
  mint: {
    bg: "#e9fbf6",
    rail: "#12b8a6",
    accent: "#ff5a5f",
    text: "#102421",
    label: "Mint Pop",
  },
  coral: {
    bg: "#fff5f3",
    rail: "#ff5a5f",
    accent: "#12b8a6",
    text: "#102421",
    label: "Coral Ticket",
  },
  ink: {
    bg: "#102421",
    rail: "#ffffff",
    accent: "#b7e75a",
    text: "#ffffff",
    label: "Ink Classic",
  },
  sunrise: {
    bg: "#fff9e8",
    rail: "#ffd35a",
    accent: "#ff5a5f",
    text: "#102421",
    label: "Sunrise Club",
  },
};

const state = {
  stream: null,
  facingMode: "user",
  activeFilter: filters[0],
  activeLayout: "single",
  shots: [],
  gallery: [],
  latestResult: null,
  latestBlob: null,
  isCapturing: false,
  deferredInstallPrompt: null,
};

const storageKey = "flashbox-gallery-v1";

function init() {
  renderFilterButtons();
  bindEvents();
  loadGallery();
  applyLiveSettings();
  updateShotCounter();
  registerServiceWorker();
}

function bindEvents() {
  elements.startCameraBtn.addEventListener("click", () => startCamera());
  elements.switchCameraBtn.addEventListener("click", switchCamera);
  elements.captureBtn.addEventListener("click", runCaptureSession);
  elements.resetBtn.addEventListener("click", resetSession);
  elements.downloadBtn.addEventListener("click", downloadLatest);
  elements.printBtn.addEventListener("click", printLatest);
  elements.shareBtn.addEventListener("click", shareLatest);
  elements.helpBtn.addEventListener("click", () => elements.helpDialog.showModal());

  elements.timerSelect.addEventListener("change", updateShotCounter);
  elements.ratioSelect.addEventListener("change", applyRatio);
  elements.mirrorToggle.addEventListener("change", applyLiveSettings);
  elements.frameSelect.addEventListener("change", () => {
    if (state.shots.length) composeResult();
  });
  elements.stickerSelect.addEventListener("change", () => {
    if (state.shots.length) composeResult();
  });

  [elements.eventInput, elements.captionInput, elements.textColorInput, elements.accentColorInput].forEach(
    (input) => {
      input.addEventListener("input", () => {
        applyLiveSettings();
        if (state.shots.length) composeResult();
      });
    },
  );

  $$(".segmented button").forEach((button) => {
    button.addEventListener("click", () => {
      setLayout(button.dataset.layout);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.code === "Space" &&
      !state.isCapturing &&
      !elements.captureBtn.disabled &&
      document.activeElement?.tagName !== "INPUT"
    ) {
      event.preventDefault();
      runCaptureSession();
    }
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    elements.installBtn.hidden = false;
  });

  elements.installBtn.addEventListener("click", async () => {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    elements.installBtn.hidden = true;
  });
}

function renderFilterButtons() {
  elements.filterGrid.innerHTML = "";
  filters.forEach((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = filter.name;
    button.dataset.filter = filter.id;
    if (filter.id === state.activeFilter.id) button.classList.add("is-active");
    button.addEventListener("click", () => {
      state.activeFilter = filter;
      $$(".filter-grid button").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      applyLiveSettings();
      if (state.shots.length) composeResult();
    });
    elements.filterGrid.append(button);
  });
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraMessage("Browser tidak mendukung kamera", "Gunakan Chrome, Edge, atau Firefox versi terbaru.");
    return;
  }

  stopCamera();
  elements.captureBtn.disabled = true;
  elements.switchCameraBtn.disabled = true;
  showCameraMessage("Meminta akses kamera", "Pilih allow/izinkan saat browser meminta izin.");

  try {
    const constraints = {
      audio: false,
      video: {
        facingMode: state.facingMode,
        width: { ideal: 1920 },
        height: { ideal: 2400 },
      },
    };
    state.stream = await navigator.mediaDevices.getUserMedia(constraints);
    elements.video.srcObject = state.stream;
    await elements.video.play();
    elements.captureBtn.disabled = false;
    elements.switchCameraBtn.disabled = false;
    elements.startCameraBtn.textContent = "Restart kamera";
    elements.message.classList.add("is-hidden");
    applyLiveSettings();
  } catch (error) {
    console.error(error);
    showCameraMessage("Kamera gagal aktif", "Pastikan izin kamera diberikan dan halaman dibuka melalui localhost/HTTPS.");
  }
}

function stopCamera() {
  if (!state.stream) return;
  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  elements.video.srcObject = null;
}

async function switchCamera() {
  state.facingMode = state.facingMode === "user" ? "environment" : "user";
  await startCamera();
}

function setLayout(layoutId) {
  state.activeLayout = layoutId;
  $$(".segmented button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.layout === layoutId);
  });
  resetSession(false);
  updateShotCounter();
}

async function runCaptureSession() {
  if (state.isCapturing || !state.stream) return;

  state.isCapturing = true;
  document.body.classList.add("is-busy");
  elements.captureBtn.disabled = true;
  state.shots = [];
  renderShots();
  updateShotCounter();

  try {
    const needed = layouts[state.activeLayout].shots;
    for (let index = 0; index < needed; index += 1) {
      await runCountdown(Number(elements.timerSelect.value), index + 1, needed);
      flash();
      beep(index === needed - 1 ? 720 : 520);
      state.shots.push(captureFrame());
      renderShots();
      updateShotCounter();
      await sleep(420);
    }

    await composeResult();
  } finally {
    state.isCapturing = false;
    document.body.classList.remove("is-busy");
    elements.captureBtn.disabled = !state.stream;
  }
}

async function runCountdown(seconds, current, total) {
  if (!seconds) {
    elements.countdown.textContent = `${current}/${total}`;
    elements.countdown.classList.add("is-visible");
    await sleep(420);
    elements.countdown.classList.remove("is-visible");
    return;
  }

  for (let number = seconds; number > 0; number -= 1) {
    elements.countdown.textContent = number;
    elements.countdown.classList.add("is-visible");
    beep(number === 1 ? 660 : 440);
    await sleep(820);
    elements.countdown.classList.remove("is-visible");
    await sleep(180);
  }
}

function captureFrame() {
  const video = elements.video;
  const ratio = getRatio();
  const width = 1200;
  const height = Math.round(width / ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const sourceWidth = video.videoWidth || width;
  const sourceHeight = video.videoHeight || height;
  const sourceRatio = sourceWidth / sourceHeight;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > ratio) {
    sw = sourceHeight * ratio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / ratio;
    sy = (sourceHeight - sh) / 2;
  }

  ctx.save();
  ctx.filter = state.activeFilter.canvas;
  if (elements.mirrorToggle.checked) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
  ctx.restore();
  addFilmGrain(ctx, width, height);

  return canvas.toDataURL("image/jpeg", 0.92);
}

async function composeResult() {
  const layout = layouts[state.activeLayout];
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  const frame = getFrame();

  drawFrameBackground(ctx, canvas, frame);
  const slots = getSlots(layout, canvas);
  await drawShots(ctx, slots);
  drawFrameDetails(ctx, canvas, frame);
  drawSticker(ctx, canvas, frame);

  state.latestResult = canvas.toDataURL("image/png");
  state.latestBlob = await canvasToBlob(canvas);
  const galleryCopy = makeGalleryCopy(canvas);
  renderResult();
  saveToGallery(galleryCopy);
}

async function drawShots(ctx, slots) {
  const images = await Promise.all(state.shots.map(loadImage));
  slots.forEach((slot, index) => {
    const img = images[index % images.length];
    ctx.save();
    roundedRect(ctx, slot.x, slot.y, slot.w, slot.h, 28);
    ctx.clip();
    drawImageCover(ctx, img, slot.x, slot.y, slot.w, slot.h);
    ctx.restore();

    ctx.lineWidth = slot.border || 16;
    ctx.strokeStyle = "#ffffff";
    roundedRect(ctx, slot.x, slot.y, slot.w, slot.h, 28);
    ctx.stroke();
  });
}

function getSlots(layout, canvas) {
  if (layout.label === "Single") {
    return [{ x: 110, y: 120, w: canvas.width - 220, h: canvas.height - 360, border: 20 }];
  }

  if (layout.label === "Strip 3") {
    const margin = 72;
    const gap = 46;
    const slotW = canvas.width - margin * 2;
    const slotH = Math.floor((canvas.height - 310 - gap * 2) / 3);
    return [0, 1, 2].map((index) => ({
      x: margin,
      y: margin + index * (slotH + gap),
      w: slotW,
      h: slotH,
      border: 14,
    }));
  }

  if (layout.label === "Grid 4") {
    const margin = 110;
    const gap = 58;
    const slotW = (canvas.width - margin * 2 - gap) / 2;
    const slotH = 780;
    return [0, 1, 2, 3].map((index) => ({
      x: margin + (index % 2) * (slotW + gap),
      y: margin + Math.floor(index / 2) * (slotH + gap),
      w: slotW,
      h: slotH,
      border: 16,
    }));
  }

  return [
    { x: 90, y: 95, w: 990, h: 1060, border: 16 },
    { x: 1125, y: 95, w: 585, h: 700, border: 16 },
  ];
}

function drawFrameBackground(ctx, canvas, frame) {
  ctx.fillStyle = frame.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = frame.rail;
  ctx.fillRect(0, 0, canvas.width, 28);
  ctx.fillRect(0, canvas.height - 28, canvas.width, 28);

  ctx.fillStyle = hexToRgba(frame.accent, 0.22);
  for (let x = -80; x < canvas.width; x += 190) {
    ctx.beginPath();
    ctx.arc(x, 88, 58, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = hexToRgba(frame.rail, 0.35);
  ctx.lineWidth = 3;
  for (let y = 52; y < canvas.height - 52; y += 64) {
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(54, y);
    ctx.moveTo(canvas.width - 24, y);
    ctx.lineTo(canvas.width - 54, y);
    ctx.stroke();
  }
}

function drawFrameDetails(ctx, canvas, frame) {
  const eventName = cleanText(elements.eventInput.value || "FLASHBOX").toUpperCase();
  const caption = cleanText(elements.captionInput.value || "Ready to snap");
  const textColor = elements.textColorInput.value || frame.text;
  const accentColor = elements.accentColorInput.value || frame.accent;
  const date = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

  ctx.fillStyle = frame.text;
  ctx.globalAlpha = 0.12;
  ctx.font = "900 220px Arial";
  ctx.textAlign = "center";
  ctx.fillText("FLASH", canvas.width / 2, canvas.height - 145);
  ctx.globalAlpha = 1;

  ctx.fillStyle = textColor;
  ctx.font = "900 54px Arial";
  ctx.textAlign = "left";
  ctx.fillText(eventName, 92, canvas.height - 105);

  ctx.fillStyle = accentColor;
  ctx.font = "800 34px Arial";
  ctx.fillText(caption, 94, canvas.height - 58);

  ctx.fillStyle = frame.text;
  ctx.textAlign = "right";
  ctx.font = "900 32px Arial";
  ctx.fillText(date, canvas.width - 94, canvas.height - 96);
  ctx.font = "700 24px Arial";
  ctx.fillText(frames[elements.frameSelect.value].label, canvas.width - 94, canvas.height - 58);

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(92, canvas.height - 150);
  ctx.lineTo(canvas.width - 92, canvas.height - 150);
  ctx.stroke();
}

function drawSticker(ctx, canvas, frame) {
  const sticker = elements.stickerSelect.value;
  if (sticker === "none") return;

  const stickers = {
    spark: { text: "SPARK", rotate: -0.18 },
    bestie: { text: "BESTIE", rotate: 0.16 },
    party: { text: "PARTY", rotate: -0.12 },
    stamp: { text: "SHOT OK", rotate: 0.08 },
  };
  const selected = stickers[sticker];
  const x = canvas.width - 310;
  const y = sticker === "stamp" ? 280 : 210;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(selected.rotate);
  ctx.fillStyle = hexToRgba(elements.accentColorInput.value || frame.accent, 0.9);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 10;
  roundedRect(ctx, -170, -58, 340, 116, 24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 48px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(selected.text, 0, 4);
  ctx.restore();
}

function renderShots() {
  elements.shotStrip.innerHTML = "";
  state.shots.forEach((shot, index) => {
    const img = document.createElement("img");
    img.src = shot;
    img.alt = `Foto ${index + 1}`;
    elements.shotStrip.append(img);
  });
}

function renderResult() {
  elements.resultPreview.innerHTML = "";
  const img = document.createElement("img");
  img.src = state.latestResult;
  img.alt = "Hasil fotobooth";
  elements.resultPreview.append(img);
  elements.resultStatus.textContent = `${layouts[state.activeLayout].label} siap`;
  elements.downloadBtn.disabled = false;
  elements.printBtn.disabled = false;
  elements.shareBtn.disabled = false;
}

function saveToGallery(dataUrl) {
  const item = {
    id: globalThis.crypto?.randomUUID?.() || String(Date.now()),
    title: cleanText(elements.eventInput.value || "FlashBox"),
    layout: layouts[state.activeLayout].label,
    createdAt: new Date().toISOString(),
    dataUrl,
  };
  state.gallery = [item, ...state.gallery].slice(0, 12);
  persistGallery();
  renderGallery();
}

function persistGallery() {
  while (state.gallery.length) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state.gallery));
      return;
    } catch {
      state.gallery.pop();
    }
  }
  localStorage.removeItem(storageKey);
}

function loadGallery() {
  try {
    state.gallery = JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch {
    state.gallery = [];
  }
  renderGallery();
}

function renderGallery() {
  elements.galleryGrid.innerHTML = "";
  elements.galleryCount.textContent = `${state.gallery.length} tersimpan`;

  if (!state.gallery.length) {
    const empty = document.createElement("div");
    empty.className = "gallery-empty";
    empty.textContent = "Belum ada hasil. Ambil foto pertama untuk mengisi galeri.";
    elements.galleryGrid.append(empty);
    return;
  }

  const template = $("#galleryItemTemplate");
  state.gallery.forEach((item) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const thumb = $(".gallery-thumb", node);
    const title = $("strong", node);
    const meta = $("span", node);
    const deleteButton = $(".delete-button", node);

    thumb.style.backgroundImage = `url(${item.dataUrl})`;
    thumb.setAttribute("aria-label", `Buka ${item.title}`);
    title.textContent = item.title;
    meta.textContent = `${item.layout} - ${formatDate(item.createdAt)}`;

    thumb.addEventListener("click", async () => {
      state.latestResult = item.dataUrl;
      state.latestBlob = await dataUrlToBlob(item.dataUrl);
      renderResult();
      elements.resultStatus.textContent = "Dibuka dari galeri";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    deleteButton.addEventListener("click", () => {
      state.gallery = state.gallery.filter((galleryItem) => galleryItem.id !== item.id);
      persistGallery();
      renderGallery();
    });

    elements.galleryGrid.append(node);
  });
}

function resetSession(clearResult = true) {
  state.shots = [];
  renderShots();
  updateShotCounter();
  if (clearResult) {
    state.latestResult = null;
    state.latestBlob = null;
    elements.resultPreview.innerHTML = "<span>Hasil akhir muncul di sini</span>";
    elements.resultStatus.textContent = "Belum ada";
    elements.downloadBtn.disabled = true;
    elements.printBtn.disabled = true;
    elements.shareBtn.disabled = true;
  }
}

function downloadLatest() {
  if (!state.latestResult) return;
  const link = document.createElement("a");
  link.href = state.latestResult;
  link.download = `flashbox-${Date.now()}.${getImageExtension()}`;
  document.body.append(link);
  link.click();
  link.remove();
}

function printLatest() {
  if (!state.latestResult) return;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Print FlashBox</title>
        <style>
          body { margin: 0; display: grid; place-items: center; min-height: 100vh; background: #fff; }
          img { max-width: 100%; max-height: 100vh; }
          @media print { body { min-height: auto; } img { width: 100%; max-height: none; } }
        </style>
      </head>
      <body><img src="${state.latestResult}" alt="Hasil fotobooth"></body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => printWindow.print();
}

async function shareLatest() {
  if (!state.latestResult) return;
  const type = state.latestBlob?.type || "image/png";
  const file = new File([state.latestBlob], `flashbox.${getImageExtension()}`, { type });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: "FlashBox Studio",
      text: "Hasil fotobooth saya",
      files: [file],
    });
    return;
  }

  await navigator.clipboard?.writeText(state.latestResult);
  elements.resultStatus.textContent = "Data URL disalin";
}

function applyLiveSettings() {
  elements.video.style.filter = state.activeFilter.css;
  elements.video.classList.toggle("is-mirrored", elements.mirrorToggle.checked);
  elements.filterName.textContent = state.activeFilter.name;
  elements.overlayEvent.textContent = cleanText(elements.eventInput.value || "FLASHBOX");
  elements.overlayCaption.textContent = cleanText(elements.captionInput.value || "Ready to snap");
  elements.overlayEvent.style.color = elements.textColorInput.value;
  elements.overlayCaption.style.color = elements.accentColorInput.value;
  applyRatio();
}

function applyRatio() {
  elements.stage.classList.remove("ratio-square", "ratio-wide", "ratio-portrait");
  elements.stage.classList.add(`ratio-${elements.ratioSelect.value}`);
}

function updateShotCounter() {
  const needed = layouts[state.activeLayout].shots;
  elements.shotCounter.textContent = `${state.shots.length}/${needed} foto`;
}

function getRatio() {
  const ratios = {
    portrait: 4 / 5,
    square: 1,
    wide: 16 / 10,
  };
  return ratios[elements.ratioSelect.value] || ratios.portrait;
}

function getFrame() {
  const selected = frames[elements.frameSelect.value] || frames.mint;
  return {
    ...selected,
    accent: elements.accentColorInput.value || selected.accent,
    text: elements.textColorInput.value || selected.text,
  };
}

function showCameraMessage(title, detail) {
  elements.message.innerHTML = `<strong>${title}</strong><span>${detail}</span>`;
  elements.message.classList.remove("is-hidden");
}

function flash() {
  elements.flash.classList.remove("is-on");
  void elements.flash.offsetWidth;
  elements.flash.classList.add("is-on");
}

function beep(frequency = 520) {
  if (!elements.soundToggle.checked) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const audio = new AudioContext();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.frequency.value = frequency;
  oscillator.type = "sine";
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.14);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.16);
}

function addFilmGrain(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 28) {
    const noise = (Math.random() - 0.5) * 10;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }
  ctx.putImageData(imageData, 0, 0);
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawImageCover(ctx, img, x, y, width, height) {
  const ratio = width / height;
  const imageRatio = img.width / img.height;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imageRatio > ratio) {
    sw = img.height * ratio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / ratio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.96));
}

function getImageExtension() {
  return state.latestBlob?.type === "image/jpeg" ? "jpg" : "png";
}

function makeGalleryCopy(sourceCanvas) {
  const maxWidth = 720;
  const scale = Math.min(1, maxWidth / sourceCanvas.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourceCanvas.width * scale);
  canvas.height = Math.round(sourceCanvas.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.84);
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value) {
  return String(value).replace(/[<>]/g, "").trim().slice(0, 48);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function hexToRgba(hex, alpha) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;
  const number = Number.parseInt(value, 16);
  const r = (number >> 16) & 255;
  const g = (number >> 8) & 255;
  const b = number & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

init();
