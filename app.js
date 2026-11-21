// Resolve assets relative to this page's directory. This works on GitHub Pages
// project sites (username.github.io/repository/) and when served from a subfolder.
const PAGE_BASE = new URL(".", window.location.href);
const assetURL = (path) => new URL(path, PAGE_BASE).toString();

const SCREENSHOTS = [
  { page: 4,  file: "screenshot_page4.png",  x: 72, yTop: 95.98,  width: 251, height: 240, lineTop: 3,  left: 10, cleanup: [{x: 442, y: 447, w: 60, h: 33}] },
  { page: 8,  file: "screenshot_page8.png",  x: 72, yTop: 95.98,  width: 270.5, height: 212, lineTop: 6,  left: 4,  cleanup: [] },
  { page: 12, file: "screenshot_page12.png", x: 72, yTop: 119.97, width: 277.5, height: 243, lineTop: 9,  left: 4,  cleanup: [{x: 0, y: 482, w: 42, h: 5}] },
  { page: 17, file: "screenshot_page17.png", x: 72, yTop: 95.98,  width: 264.5, height: 266, lineTop: 7,  left: 9,  cleanup: [] },
  { page: 20, file: "screenshot_page20.png", x: 72, yTop: 143.95, width: 345.5, height: 227, lineTop: 2,  left: 5,  cleanup: [{x: 0, y: 447, w: 240, h: 8}] },
  { page: 24, file: "screenshot_page24.png", x: 72, yTop: 95.98,  width: 284, height: 256.5, lineTop: 8,  left: 7,  cleanup: [{x: 0, y: 509, w: 42, h: 5}] },
  { page: 28, file: "screenshot_page28.png", x: 72, yTop: 95.98,  width: 336, height: 212, lineTop: 5,  left: 7,  cleanup: [] },
  { page: 32, file: "screenshot_page32.png", x: 72, yTop: 95.98,  width: 336.5, height: 216, lineTop: 8,  left: 11, cleanup: [{x: 0, y: 425, w: 245, h: 10}] }
];

const form = document.getElementById("student-form");
const nameInput = document.getElementById("student-name");
const sectionInput = document.getElementById("section");
const rollInput = document.getElementById("roll");
const usernamePreview = document.getElementById("username-preview");
const statusEl = document.getElementById("status");
const generateBtn = document.getElementById("generate-btn");
const buttonText = generateBtn.querySelector(".button-text");

function makeLoginName(fullName) {
  const firstName = fullName.trim().split(/\s+/)[0] || "student";
  const clean = firstName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return clean || "student";
}
function updatePreview() {
  const login = nameInput.value.trim() ? makeLoginName(nameInput.value) : "student";
  usernamePreview.textContent = `${login}@${login.toUpperCase()}-PC1912`;
}
nameInput.addEventListener("input", updatePreview);
updatePreview();

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}
function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not prepare screenshot.")), "image/png"));
}

async function personalizeScreenshot(spec, login) {
  const img = await loadImage(assetURL(spec.file));
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  // The source terminal uses a near-black background and green prompt text.
  const prompt = `${login}@${login.toUpperCase()}-PC1912:~$`;
  const promptLines = [0, 28, 56];
  for (const offset of promptLines) {
    const y = Math.max(0, spec.lineTop + offset - 3);
    ctx.fillStyle = "#0c0c0c";
    // Clear only the old username area; keep the command text immediately after it intact.
    ctx.fillRect(0, y, 270, 29);
    let fontSize = 23;
    ctx.font = `bold ${fontSize}px "DejaVu Sans Mono", "Courier New", monospace`;
    while (ctx.measureText(prompt).width > 260 && fontSize > 16) {
      fontSize -= 1;
      ctx.font = `bold ${fontSize}px "DejaVu Sans Mono", "Courier New", monospace`;
    }
    ctx.fillStyle = "#00df16";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(prompt, spec.left, y + 23);
  }

  // Remove clipped fragments of the old shell prompt at the very bottom of a few source captures.
  for (const r of spec.cleanup) {
    ctx.fillStyle = "#0c0c0c";
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  return canvasBlob(canvas);
}

function safeFilePart(value) {
  return value.trim().replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "student";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim().replace(/\s+/g, " ");
  const section = sectionInput.value.trim().replace(/^MCA\s*/i, "");
  const roll = rollInput.value.trim();
  if (!name || !section || !roll) {
    statusEl.textContent = "Please fill in your name, section and roll number.";
    statusEl.className = "status error";
    return;
  }
  if (!/[a-zA-Z0-9]/.test(name) || !/[a-zA-Z0-9]/.test(section) || !/[a-zA-Z0-9]/.test(roll)) {
    statusEl.textContent = "Please enter valid student details.";
    statusEl.className = "status error";
    return;
  }
  if (!window.PDFLib) {
    statusEl.textContent = "The PDF library did not load. Check your internet connection and refresh.";
    statusEl.className = "status error";
    return;
  }

  const login = makeLoginName(name);
  generateBtn.disabled = true;
  buttonText.textContent = "Preparing your PDF…";
  statusEl.textContent = "Personalizing the page headers and terminal screenshots. Please keep this tab open.";
  statusEl.className = "status";

  try {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const response = await fetch(assetURL("os-termwork-template.pdf"));
    if (!response.ok) {
      throw new Error(`Could not load the original OS termwork template (HTTP ${response.status}). Check that os-termwork-template.pdf exists in the repository root.`);
    }
    const templateBytes = await response.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateBytes);
    const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const pages = pdfDoc.getPages();
    if (pages.length !== 32) throw new Error(`The template should contain 32 pages, but ${pages.length} pages were found. Please re-upload the original template file.`);

    // Add a consistent student header to every page, fitting long entries safely.
    for (const page of pages) {
      const { width, height } = page.getSize();
      const headerY = height - 49;
      const ink = rgb(0.08, 0.08, 0.08);
      const sectionText = `MCA ${section.toUpperCase()}`;
      const rollText = `Roll no- ${roll}`;
      const maxSideWidth = width * 0.34;
      const fitSize = (text, maxWidth, preferred = 12) => {
        let size = preferred;
        while (size > 8 && boldFont.widthOfTextAtSize(text, size) > maxWidth) size -= 0.25;
        return size;
      };
      const nameSize = fitSize(name, maxSideWidth);
      const rollSize = fitSize(rollText, maxSideWidth);
      const sectionSize = fitSize(sectionText, width * 0.28);
      page.drawText(name, { x: 72, y: headerY, size: nameSize, font: boldFont, color: ink });
      const sectionWidth = boldFont.widthOfTextAtSize(sectionText, sectionSize);
      page.drawText(sectionText, { x: (width - sectionWidth) / 2, y: headerY, size: sectionSize, font: boldFont, color: ink });
      const rollWidth = boldFont.widthOfTextAtSize(rollText, rollSize);
      page.drawText(rollText, { x: width - 72 - rollWidth, y: headerY, size: rollSize, font: boldFont, color: ink });
    }

    // Replace the eight embedded output screenshots with personalized browser-canvas versions.
    for (const spec of SCREENSHOTS) {
      const blob = await personalizeScreenshot(spec, login);
      const bytes = await blob.arrayBuffer();
      const png = await pdfDoc.embedPng(bytes);
      const page = pages[spec.page - 1];
      const pageHeight = page.getHeight();
      const y = pageHeight - spec.yTop - spec.height;
      page.drawImage(png, { x: spec.x, y, width: spec.width, height: spec.height });
    }

    const pdfBytes = await pdfDoc.save();
    const fileName = `OS_Termwork_${safeFilePart(name)}.pdf`;
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    statusEl.textContent = "Your personalized PDF has been generated and downloaded.";
    statusEl.className = "status success";
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message || "Something went wrong while generating the PDF.";
    statusEl.className = "status error";
  } finally {
    generateBtn.disabled = false;
    buttonText.textContent = "Generate & download PDF";
  }
});
