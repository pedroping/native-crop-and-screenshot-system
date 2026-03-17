#include <emscripten.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>

EMSCRIPTEN_KEEPALIVE
uint8_t *perform_pixel_crop(uint8_t *src_pixels, int src_w, int src_h, int crop_x, int crop_y, int crop_w, int crop_h)
{
  printf("[WASM] Allocating memory for %dx%d cropped image...\n", crop_w, crop_h);

  int num_bytes = crop_w * crop_h * 4;
  uint8_t *dest_pixels = (uint8_t *)malloc(num_bytes);
  if (!dest_pixels)
  {
    printf("[WASM] Memory allocation failed!\n");
    return NULL;
  }

  printf("[WASM] Processing raw pixels in C...\n");

  for (int row = 0; row < crop_h; row++)
  {
    for (int col = 0; col < crop_w; col++)
    {
      int dest_idx = (row * crop_w + col) * 4;
      int src_row = crop_y + row;
      int src_col = crop_x + col;

      if (src_row >= 0 && src_row < src_h && src_col >= 0 && src_col < src_w)
      {
        int src_idx = (src_row * src_w + src_col) * 4;
        dest_pixels[dest_idx + 0] = src_pixels[src_idx + 0];
        dest_pixels[dest_idx + 1] = src_pixels[src_idx + 1];
        dest_pixels[dest_idx + 2] = src_pixels[src_idx + 2];
        dest_pixels[dest_idx + 3] = src_pixels[src_idx + 3];
      }
      else
      {
        dest_pixels[dest_idx + 0] = 0;
        dest_pixels[dest_idx + 1] = 0;
        dest_pixels[dest_idx + 2] = 0;
        dest_pixels[dest_idx + 3] = 0;
      }
    }
  }

  printf("[WASM] Pixel crop complete!\n");
  return dest_pixels;
}

EMSCRIPTEN_KEEPALIVE
void free_buffer(uint8_t *ptr)
{
  free(ptr);
}

EM_JS(void, execute_screenshot, (int crop_x, int crop_y, int crop_w, int crop_h), {
  const activateCropBtn = document.getElementById("activateCropBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const canvas = document.getElementById("canvas-output");
  const ctx = canvas.getContext("2d");
  const element = document.getElementById("capture-target");

  activateCropBtn.textContent = "Processing...";

  function getBase64FromImage(imgEl)
  {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = imgEl.naturalWidth || imgEl.width;
    tempCanvas.height = imgEl.naturalHeight || imgEl.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(imgEl, 0, 0);
    return tempCanvas.toDataURL("image/png");
  }

  const fullWidth = element.offsetWidth;
  const fullHeight = element.offsetHeight;
  const clone = element.cloneNode(true);

  const originalCanvases = element.querySelectorAll("canvas");
  const clonedCanvases = clone.querySelectorAll("canvas");
  
  clonedCanvases.forEach(function(clonedCanvas, index) {
    const originalCanvas = originalCanvases[index];
    try
    {
      const dataUrl = originalCanvas.toDataURL("image/png");
      const imgReplacement = document.createElement("img");
      imgReplacement.src = dataUrl;
      imgReplacement.style.cssText = clonedCanvas.style.cssText;
      imgReplacement.width = originalCanvas.width || originalCanvas.offsetWidth;
      imgReplacement.height = originalCanvas.height || originalCanvas.offsetHeight;
      imgReplacement.className = clonedCanvas.className;
      clonedCanvas.parentNode.replaceChild(imgReplacement, clonedCanvas);
    }
    catch(error)
    {
      console.error("Canvas export failed:", error);
    }
  });

  const originalImages = element.querySelectorAll("img");
  const clonedImages = clone.querySelectorAll("img");
  
  clonedImages.forEach(function(clonedImg, index) {
    const originalImg = originalImages[index];
    if (originalImg && originalImg.complete && originalImg.naturalWidth > 0 && !originalImg.src.startsWith("data:"))
    {
      try { clonedImg.src = getBase64FromImage(originalImg); }
      catch(error) { console.error("Image tainted:", error); }
    }
  });

  const originalInputs = element.querySelectorAll("input, textarea");
  const clonedInputs = clone.querySelectorAll("input, textarea");
  
  originalInputs.forEach(function(input, index) {
    clonedInputs[index].setAttribute("value", input.value);
  });

  const clonedOverlay = clone.querySelector("#crop-overlay");
  if (clonedOverlay) {
    clonedOverlay.remove();
  }

  const computedStyle = window.getComputedStyle(element);
  const fontFamily = computedStyle.fontFamily;
  let cssStyles = "";
  
  Array.from(document.styleSheets).forEach(function(sheet) {
    try { 
      Array.from(sheet.cssRules).forEach(function(rule) {
        cssStyles += rule.cssText; 
      }); 
    } 
    catch (e) {}
  });

  const serializer = new XMLSerializer();
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  const elementHtml = serializer.serializeToString(clone);

  const svgData = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + fullWidth + "\" height=\"" + fullHeight + "\">" +
                  "<foreignObject width=\"100%\" height=\"100%\">" +
                  "<div xmlns=\"http://www.w3.org/1999/xhtml\" style=\"font-family: " + fontFamily + "; width: " + fullWidth + "px; height: " + fullHeight + "px;\">" +
                  "<style>" + cssStyles + "</style>" +
                  elementHtml + "</div>" +
                  "</foreignObject>" +
                  "</svg>";

  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
  const img = new Image();

  img.onload = function() {
    const offCanvas = document.createElement("canvas");
    offCanvas.width = fullWidth;
    offCanvas.height = fullHeight;
    const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
    offCtx.drawImage(img, 0, 0);

    const imgData = offCtx.getImageData(0, 0, fullWidth, fullHeight);
    const srcPixels = imgData.data; 
    const numBytes = srcPixels.length;
    
    const srcPtr = _malloc(numBytes);
    HEAPU8.set(srcPixels, srcPtr);

    const destPtr = _perform_pixel_crop(srcPtr, fullWidth, fullHeight, crop_x, crop_y, crop_w, crop_h);

    const destBytes = new Uint8ClampedArray(HEAPU8.buffer, destPtr, crop_w * crop_h * 4);
    const newImgData = new ImageData(destBytes, crop_w, crop_h);
    
    canvas.width = crop_w;
    canvas.height = crop_h;
    canvas.style.width = crop_w + "px";
    canvas.style.height = crop_h + "px";
    ctx.putImageData(newImgData, 0, 0);

    canvas.style.display = "block";
    downloadBtn.style.display = "flex";
    activateCropBtn.textContent = "✂️ Select Area to Crop";
    activateCropBtn.disabled = false;

    _free(srcPtr);
    _free_buffer(destPtr);
  };
  img.src = url;
});

EMSCRIPTEN_KEEPALIVE
void process_crop(int x, int y, int w, int h)
{
  printf("[WASM] Crop coordinates received: X:%d, Y:%d, W:%d, H:%d\n", x, y, w, h);

  if (w > 10 && h > 10)
  {
    printf("[WASM] Crop valid. Triggering DOM serialization...\n");
    execute_screenshot(x, y, w, h);
  }
  else
  {
    printf("[WASM] Crop area too small. Aborting.\n");

    EM_ASM({
      const btn = document.getElementById("activateCropBtn");
      btn.textContent = "✂️ Select Area to Crop";
      btn.disabled = false;
    });
  }
}

EM_JS(void, setup_ui, (void), {
  const activateCropBtn = document.getElementById("activateCropBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const overlay = document.getElementById("crop-overlay");
  const cropBox = document.getElementById("crop-box");

  let isDrawing = false;
  let startX, startY;

  const canvas_1 = document.getElementById("canvas-01");
  const ctx_1 = canvas_1.getContext("2d");
  const imgSetup = new Image();
  imgSetup.crossOrigin = "anonymous";
  imgSetup.onload = function()
  {
    canvas_1.width = imgSetup.width;
    canvas_1.height = imgSetup.height;
    ctx_1.drawImage(imgSetup, 0, 0);
  };
  imgSetup.src = "https://picsum.photos/200/300";

  activateCropBtn.addEventListener("click", function() {
    overlay.style.display = "block";
    cropBox.style.display = "none";
    activateCropBtn.textContent = "Draw a box on the left...";
    activateCropBtn.disabled = true; 
  });

  overlay.addEventListener("mousedown", function(e) {
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

  overlay.addEventListener("mousemove", function(e) {
    if (!isDrawing) return;
    const rect = overlay.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    cropBox.style.width = Math.abs(currentX - startX) + "px";
    cropBox.style.height = Math.abs(currentY - startY) + "px";
    cropBox.style.left = Math.min(currentX, startX) + "px";
    cropBox.style.top = Math.min(currentY, startY) + "px"; 
  });

  overlay.addEventListener("mouseup", function(e) {
    isDrawing = false;
    overlay.style.display = "none";

    const x = parseInt(cropBox.style.left);
    const y = parseInt(cropBox.style.top);
    const w = parseInt(cropBox.style.width);
    const h = parseInt(cropBox.style.height);

    if (Module._process_crop) {
        Module._process_crop(x, y, w, h);
    } 
  });

  downloadBtn.addEventListener("click", function() {
    const canvas = document.getElementById("canvas-output");
    const link = document.createElement("a");
    link.download = "crop-" + new Date().getTime() + ".png";
    link.href = canvas.toDataURL("image/png");
    link.click(); 
  });
});

int main()
{
  printf("[WASM] Initializing App...\n");
  setup_ui();
  return 0;
}