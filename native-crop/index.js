const activateCropBtn = document.getElementById("activateCropBtn");
const downloadBtn = document.getElementById("downloadBtn");
const canvas = document.getElementById("canvas-output");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("crop-overlay");
const cropBox = document.getElementById("crop-box");
const target = document.getElementById("capture-target");

let isDrawing = false;
let startX, startY;
let cropCoordinates = null;

const canvas_1 = document.getElementById("canvas-01");
const ctx_1 = canvas_1.getContext("2d");

const imageUrl = "https://picsum.photos/200/300";
const imgSetup = new Image();

imgSetup.crossOrigin = "anonymous";

imgSetup.onload = function () {
  canvas_1.width = imgSetup.width;
  canvas_1.height = imgSetup.height;
  ctx_1.drawImage(imgSetup, 0, 0);
};
imgSetup.src = imageUrl;
imgSetup.onerror = () => {
  console.error("Error loading image from URL:", imageUrl);
};

activateCropBtn.addEventListener("click", () => {
  overlay.style.display = "block";
  cropBox.style.display = "none";
  activateCropBtn.textContent = "Draw a box on the left...";
  activateCropBtn.disabled = true;
});

overlay.addEventListener("mousedown", (e) => {
  isDrawing = true;
  const rect = overlay.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;

  cropBox.style.left = startX + "px";
  cropBox.style.top = startY + "px";
  cropBox.style.width = "0px";
  cropBox.style.height = "0px";
  cropBox.style.display = "block";
});

overlay.addEventListener("mousemove", (e) => {
  if (!isDrawing) return;
  const rect = overlay.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;

  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  const left = Math.min(currentX, startX);
  const top = Math.min(currentY, startY);

  cropBox.style.width = width + "px";
  cropBox.style.height = height + "px";
  cropBox.style.left = left + "px";
  cropBox.style.top = top + "px";
});

overlay.addEventListener("mouseup", (e) => {
  isDrawing = false;
  overlay.style.display = "none";

  cropCoordinates = {
    x: parseInt(cropBox.style.left),
    y: parseInt(cropBox.style.top),
    w: parseInt(cropBox.style.width),
    h: parseInt(cropBox.style.height),
  };

  if (cropCoordinates.w > 10 && cropCoordinates.h > 10) {
    takeScreenshot("capture-target", cropCoordinates);
  } else {
    activateCropBtn.textContent = "Select Area to Crop";
    activateCropBtn.disabled = false;
  }
});

function getBase64FromImage(imgEl) {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = imgEl.naturalWidth || imgEl.width;
  tempCanvas.height = imgEl.naturalHeight || imgEl.height;

  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(imgEl, 0, 0);

  return tempCanvas.toDataURL("image/png");
}

function takeScreenshot(elementId, crop) {
  activateCropBtn.textContent = "⏳ Processing...";

  const element = document.getElementById(elementId);
  const fullWidth = element.offsetWidth;
  const fullHeight = element.offsetHeight;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = crop.w * dpr;
  canvas.height = crop.h * dpr;
  canvas.style.width = crop.w + "px";
  canvas.style.height = crop.h + "px";

  const clone = element.cloneNode(true);

  const originalCanvases = element.querySelectorAll("canvas");
  const clonedCanvases = clone.querySelectorAll("canvas");

  clonedCanvases.forEach((clonedCanvas, index) => {
    const originalCanvas = originalCanvases[index];
    try {
      const dataUrl = originalCanvas.toDataURL("image/png");

      const imgReplacement = document.createElement("img");
      imgReplacement.src = dataUrl;
      imgReplacement.style.cssText = clonedCanvas.style.cssText; // keep original styles
      imgReplacement.width = originalCanvas.width || originalCanvas.offsetWidth;
      imgReplacement.height =
        originalCanvas.height || originalCanvas.offsetHeight;
      imgReplacement.className = clonedCanvas.className;

      clonedCanvas.parentNode.replaceChild(imgReplacement, clonedCanvas);
    } catch (error) {
      console.error("Could not export canvas data (Tainted?):", error);
    }
  });

  const originalImages = element.querySelectorAll("img");
  const clonedImages = clone.querySelectorAll("img");

  clonedImages.forEach((clonedImg, index) => {
    const originalImg = originalImages[index];

    if (
      originalImg &&
      originalImg.complete &&
      originalImg.naturalWidth > 0 &&
      !originalImg.src.startsWith("data:")
    ) {
      try {
        clonedImg.src = getBase64FromImage(originalImg);
      } catch (error) {
        console.error(
          "Image tainted! Did you add crossorigin='anonymous'?",
          error,
        );
      }
    }
  });

  const originalInputs = element.querySelectorAll("input, textarea");
  const clonedInputs = clone.querySelectorAll("input, textarea");
  originalInputs.forEach((input, index) => {
    clonedInputs[index].setAttribute("value", input.value);
  });

  const clonedOverlay = clone.querySelector("#crop-overlay");
  if (clonedOverlay) clonedOverlay.remove();

  const computedStyle = window.getComputedStyle(element);
  const fontFamily = computedStyle.fontFamily;
  let cssStyles = "";

  Array.from(document.styleSheets).forEach((sheet) => {
    try {
      Array.from(sheet.cssRules).forEach((rule) => {
        cssStyles += rule.cssText;
      });
    } catch (e) {
      console.warn("Skipping a stylesheet due to CORS restrictions.");
    }
  });

  const serializer = new XMLSerializer();
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  const elementHtml = serializer.serializeToString(clone);

  const svgData = `
                <svg xmlns="http://www.w3.org/2000/svg" width="${fullWidth}" height="${fullHeight}">
                    <foreignObject width="100%" height="100%">
                        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: ${fontFamily}; width: ${fullWidth}px; height: ${fullHeight}px;">
                            <style>${cssStyles}</style>
                            ${elementHtml}
                        </div>
                    </foreignObject>
                </svg>
            `;

  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
  const img = new Image();

  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(
      img,
      crop.x,
      crop.y,
      crop.w,
      crop.h,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    canvas.style.display = "block";
    downloadBtn.style.display = "flex";

    activateCropBtn.textContent = "Select Area to Crop";
    activateCropBtn.disabled = false;
  };

  img.src = url;
}

downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `crop-${new Date().getTime()}.png`;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});
