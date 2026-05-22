let pdfjsLib;
let pdfDoc = null;
let currentScale = 1.0;
let fitScale = 1.0;
let isRendering = false;

const url = "https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf";

function loadStyles() {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf_viewer.min.css";

    link.onload = () => {
      resolve();
    };

    link.onerror = () => {
      reject();
    };

    document.head.append(link);
  });
}

function loadScripts() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";

    script.onload = () => {
      pdfjsLib = window["pdfjs-dist/build/pdf"];
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

      resolve();
    };

    script.onerror = () => {
      reject();
    };

    document.head.append(script);
  });
}

async function initPDF() {
  try {
    await loadStyles();
    await loadScripts();

    const loadingTask = pdfjsLib.getDocument(url);
    pdfDoc = await loadingTask.promise;

    await calculateFitScale();
    currentScale = fitScale;

    renderDocument();
  } catch (error) {
    console.error("Error loading PDF:", error);
  }
}

async function calculateFitScale() {
  const viewer = document.getElementById("pdf-viewer");
  const containerWidth = viewer.clientWidth - 40;
  const maxDesiredWidth = Math.min(containerWidth, 1000);

  const page = await pdfDoc.getPage(1);
  const unscaledViewport = page.getViewport({ scale: 1.0 });

  fitScale = maxDesiredWidth / unscaledViewport.width;
}

async function renderDocument() {
  if (isRendering) return;
  isRendering = true;

  const viewer = document.getElementById("pdf-viewer");
  viewer.innerHTML = "";

  document.getElementById("zoom-level").innerText =
    `${Math.round(currentScale * 100)}%`;

  try {
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale });

      const pageContainer = document.createElement("div");
      pageContainer.className = "page-container";
      viewer.appendChild(pageContainer);

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      pageContainer.appendChild(canvas);

      const textLayerDiv = document.createElement("div");
      textLayerDiv.className = "textLayer";
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;
      textLayerDiv.style.setProperty("--scale-factor", viewport.scale);
      pageContainer.appendChild(textLayerDiv);

      await page.render({ canvasContext: context, viewport: viewport }).promise;

      const textContent = await page.getTextContent();
      await pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport: viewport,
        textDivs: [],
      }).promise;
    }

    const pdfViewer = document.getElementById("pdf-viewer");
    const pageContainers = Array.from(pdfViewer.childNodes);

    if (!pdfViewer || !pageContainers[0]) return (isRendering = false);

    const viewerWidth = pdfViewer.offsetWidth;
    const containerWidth = pageContainers[0]?.offsetWidth;

    const isSmallDoc = containerWidth < viewerWidth;

    pageContainers.forEach((container) => {
      container.style.left = isSmallDoc
        ? ""
        : `${(containerWidth - viewerWidth) / 2}px`;
    });
  } catch (error) {
    console.error("Error rendering pages:", error);
  }

  isRendering = false;
}

document.getElementById("zoom-in").addEventListener("click", () => {
  if (currentScale >= 3.0) return;
  currentScale += 0.25;
  renderDocument();
});

document.getElementById("zoom-out").addEventListener("click", () => {
  if (currentScale <= 0.5) return;
  currentScale -= 0.25;
  renderDocument();
});

document.getElementById("zoom-fit").addEventListener("click", () => {
  currentScale = fitScale;
  renderDocument();
});

initPDF();
