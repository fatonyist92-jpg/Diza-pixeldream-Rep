(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const state = {
    view: "create",
    mode: "image",
    ratio: "1:1",
    quality: "standard",
    reference: null,
    latest: null,
  };

  const promptInput = $("#promptInput");
  const charCount = $("#charCount");
  const generateButton = $("#generateButton");
  const resultSection = $("#resultSection");
  const progressState = $("#progressState");
  const previewState = $("#previewState");
  const progressTitle = $("#progressTitle");
  const progressDetail = $("#progressDetail");
  const progressBar = $("#progressBar");
  const previewCanvas = $("#previewCanvas");
  const previewPrompt = $("#previewPrompt");
  const previewMode = $("#previewMode");

  function switchView(view) {
    state.view = view;
    $$(".view").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.viewPanel === view));
    $$("[data-view]").forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("is-active", active);
      if (button.classList.contains("nav-item")) button.setAttribute("aria-current", active ? "page" : "false");
    });
    if (view === "gallery") renderGallery();
    window.scrollTo({ top: 0, behavior: document.body.classList.contains("reduce-motion") ? "auto" : "smooth" });
  }

  $$("[data-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));

  function updatePromptState() {
    const length = promptInput.value.length;
    charCount.textContent = `${length}/500`;
    generateButton.disabled = !promptInput.value.trim();
  }
  promptInput.addEventListener("input", updatePromptState);
  $("#clearPrompt").addEventListener("click", () => {
    promptInput.value = "";
    updatePromptState();
    promptInput.focus();
  });

  $$(".segment[data-mode]").forEach((button) => button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    $$(".segment[data-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
  }));

  $$("#ratioChips .chip").forEach((button) => button.addEventListener("click", () => {
    state.ratio = button.dataset.ratio;
    $$("#ratioChips .chip").forEach((item) => item.classList.toggle("is-active", item === button));
  }));

  $$("#qualityControl .segment").forEach((button) => button.addEventListener("click", () => {
    state.quality = button.dataset.quality;
    $$("#qualityControl .segment").forEach((item) => item.classList.toggle("is-active", item === button));
  }));

  const referenceInput = $("#referenceInput");
  const referencePreview = $("#referencePreview");
  const referenceImage = $("#referenceImage");
  $("#referenceButton").addEventListener("click", () => referenceInput.click());
  referenceInput.addEventListener("change", () => {
    const file = referenceInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.reference = reader.result;
      referenceImage.src = reader.result;
      referencePreview.hidden = false;
    };
    reader.readAsDataURL(file);
  });
  $("#removeReference").addEventListener("click", () => {
    state.reference = null;
    referenceInput.value = "";
    referenceImage.removeAttribute("src");
    referencePreview.hidden = true;
  });

  function ratioToCss(ratio) {
    return ratio.replace(":", " / ");
  }

  function hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return Math.abs(hash);
  }

  function setPreviewArt(prompt) {
    const seed = hashText(prompt);
    const a = 15 + (seed % 55);
    const b = 20 + ((seed >> 2) % 55);
    const c = 8 + ((seed >> 4) % 24);
    previewCanvas.style.aspectRatio = ratioToCss(state.ratio);
    previewCanvas.style.background = `
      radial-gradient(circle at ${a}% ${b}%, rgba(255,255,255,.62) 0 ${Math.max(2, c/5)}%, transparent ${Math.max(3, c/4)}%),
      radial-gradient(circle at ${100-a}% ${Math.max(20, 90-b)}%, rgba(255,255,255,.16) 0 ${c}%, transparent ${c+1}%),
      linear-gradient(${110 + seed % 80}deg, #222, #050505 48%, #171717)`;
  }

  const progressSteps = [
    ["Preparing composition", "Building the preview state…", 18],
    ["Expanding prompt", "Simulating the prompt workflow…", 44],
    ["Rendering preview", "Drawing a local monochrome placeholder…", 76],
    ["Finishing", "Polishing the result card…", 100],
  ];

  function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  generateButton.addEventListener("click", async () => {
    if (!promptInput.value.trim()) return;
    generateButton.disabled = true;
    resultSection.hidden = false;
    progressState.hidden = false;
    previewState.hidden = true;
    progressBar.style.width = "0%";
    resultSection.scrollIntoView({ behavior: document.body.classList.contains("reduce-motion") ? "auto" : "smooth", block: "start" });

    for (const [title, detail, percent] of progressSteps) {
      progressTitle.textContent = title;
      progressDetail.textContent = detail;
      progressBar.style.width = percent + "%";
      await wait(document.body.classList.contains("reduce-motion") ? 80 : 520);
    }

    const prompt = promptInput.value.trim();
    state.latest = {
      id: Date.now(),
      prompt,
      mode: state.mode,
      ratio: state.ratio,
      quality: state.quality,
      createdAt: new Date().toISOString(),
    };
    setPreviewArt(prompt);
    previewPrompt.textContent = prompt;
    previewMode.textContent = `${state.mode === "image" ? "Image" : "Video"} · ${state.ratio} · ${state.quality}`;
    progressState.hidden = true;
    previewState.hidden = false;
    generateButton.disabled = false;
  });

  $("#saveToGallery").addEventListener("click", () => {
    if (!state.latest) return;
    const gallery = JSON.parse(localStorage.getItem("dizaDreamGallery") || "[]");
    if (!gallery.some((item) => item.id === state.latest.id)) gallery.unshift(state.latest);
    localStorage.setItem("dizaDreamGallery", JSON.stringify(gallery.slice(0, 24)));
    $("#saveToGallery").textContent = "Saved";
    setTimeout(() => ($("#saveToGallery").textContent = "Save to gallery"), 1100);
  });

  function renderGallery() {
    const grid = $("#galleryGrid");
    const empty = $("#galleryEmpty");
    const gallery = JSON.parse(localStorage.getItem("dizaDreamGallery") || "[]");
    grid.innerHTML = "";
    empty.hidden = gallery.length > 0;
    gallery.forEach((item) => {
      const card = document.createElement("article");
      card.className = "gallery-card";
      card.innerHTML = `
        <div class="gallery-art"></div>
        <div class="gallery-card-body">
          <strong></strong>
          <span></span>
        </div>`;
      $("strong", card).textContent = item.prompt;
      $("span", card).textContent = `${item.mode} · ${item.ratio} · ${item.quality}`;
      grid.appendChild(card);
    });
  }

  const reduceMotion = $("#reduceMotion");
  reduceMotion.checked = localStorage.getItem("dizaDreamReduceMotion") === "1";
  document.body.classList.toggle("reduce-motion", reduceMotion.checked);
  reduceMotion.addEventListener("change", () => {
    document.body.classList.toggle("reduce-motion", reduceMotion.checked);
    localStorage.setItem("dizaDreamReduceMotion", reduceMotion.checked ? "1" : "0");
  });

  updatePromptState();
  renderGallery();
})();
