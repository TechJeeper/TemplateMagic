        // Initialize Icons
        lucide.createIcons();
        const HOWTO_STORAGE_KEY = 'templatemagic_hide_howto_dialog';

        // --- State Management ---
        const state = {
            imageObj: null,
            originalWidth: 0,
            originalHeight: 0,
            // Scale factors mapping traced/display image coords -> original upload coords
            traceScaleX: 1,
            traceScaleY: 1,
            edgeData: null,
            
            toolMode: 'trace', // 'trace' | 'wand'
            paths: [], 
            points: [], 
            mousePos: null,
            isDragging: false,
            
            zoom: 1,
            autoSnap: true,
            threshold: 80,
            snapRadius: 15,
            smoothCurves: true,
            
            wandType: 'edge', // 'color' | 'edge'
            wandColorTolerance: 60,
            wandEdgeTolerance: 8.0,
            noiseReduction: 2.5,
            minHoleArea: 1000,

            fillImageObj: null,
            fillImageDataUrl: null,
            fillMode: 'pattern', // 'pattern' | 'single'
            fillScale: 1,
            fillOffsetX: 0,
            fillOffsetY: 0
        };

        // --- DOM Elements ---
        const els = {
            loadingOverlay: document.getElementById('loading-overlay'),
            howtoOverlay: document.getElementById('howto-overlay'),
            btnHowtoClose: document.getElementById('btn-howto-close'),
            btnHowtoGotit: document.getElementById('btn-howto-gotit'),
            inpHowtoNever: document.getElementById('inp-howto-never'),
            uploadImage: document.getElementById('upload-image'),
            btnExportSvg: document.getElementById('btn-export-svg'),
            btnExportPng: document.getElementById('btn-export-png'),
            statusEmpty: document.getElementById('status-empty'),
            statusActive: document.getElementById('status-active'),
            statusText: document.getElementById('status-text'),
            toolPanel: document.getElementById('tool-panel'),
            fillPanel: document.getElementById('fill-panel'),
            
            // Toggles
            btnModeTrace: document.getElementById('btn-mode-trace'),
            btnModeWand: document.getElementById('btn-mode-wand'),
            settingsTrace: document.getElementById('settings-trace'),
            settingsWand: document.getElementById('settings-wand'),
            btnSnap: document.getElementById('btn-snap'),
            inpSmooth: document.getElementById('inp-smooth'),
            btnWandEdge: document.getElementById('btn-wand-edge'),
            btnWandColor: document.getElementById('btn-wand-color'),
            wandColorSettings: document.getElementById('wand-color-settings'),
            wandEdgeSettings: document.getElementById('wand-edge-settings'),
            btnUndo: document.getElementById('btn-undo'),
            btnClear: document.getElementById('btn-clear'),
            
            // Sliders
            inpThreshold: document.getElementById('inp-threshold'), valThreshold: document.getElementById('val-threshold'),
            inpSnapRadius: document.getElementById('inp-snapRadius'), valSnapRadius: document.getElementById('val-snapRadius'),
            inpColorTol: document.getElementById('inp-colorTol'), valColorTol: document.getElementById('val-colorTol'),
            inpEdgeTol: document.getElementById('inp-edgeTol'), valEdgeTol: document.getElementById('val-edgeTol'),
            inpNoise: document.getElementById('inp-noise'), valNoise: document.getElementById('val-noise'),
            inpMinHole: document.getElementById('inp-minHole'), valMinHole: document.getElementById('val-minHole'),
            
            // Fill
            uploadFillBtn: document.getElementById('upload-fill-btn'),
            uploadFill: document.getElementById('upload-fill'),
            fillSettings: document.getElementById('fill-settings'),
            btnRemoveFill: document.getElementById('btn-remove-fill'),
            btnFillSingle: document.getElementById('btn-fill-single'),
            btnFillPattern: document.getElementById('btn-fill-pattern'),
            inpFillScale: document.getElementById('inp-fillScale'), valFillScale: document.getElementById('val-fillScale'),
            inpFillOffsetX: document.getElementById('inp-fillOffsetX'), valFillOffsetX: document.getElementById('val-fillOffsetX'),
            inpFillOffsetY: document.getElementById('inp-fillOffsetY'), valFillOffsetY: document.getElementById('val-fillOffsetY'),
            
            // Canvas
            zoomControls: document.getElementById('zoom-controls'),
            btnZoomIn: document.getElementById('btn-zoom-in'),
            btnZoomOut: document.getElementById('btn-zoom-out'),
            valZoom: document.getElementById('val-zoom'),
            canvasContainer: document.getElementById('canvas-container'),
            canvasWrapper: document.getElementById('canvas-wrapper'),
            canvasPlaceholder: document.getElementById('canvas-placeholder'),
            mainCanvas: document.getElementById('main-canvas'),
        };

        const showHowtoIfNeeded = () => {
            if (!els.howtoOverlay) return;
            const hideHowto = localStorage.getItem(HOWTO_STORAGE_KEY) === '1';
            if (!hideHowto) {
                els.howtoOverlay.classList.remove('hidden');
                els.howtoOverlay.classList.add('flex');
                lucide.createIcons();
            }
        };

        const hideHowtoDialog = () => {
            if (!els.howtoOverlay) return;
            els.howtoOverlay.classList.add('hidden');
            els.howtoOverlay.classList.remove('flex');
        };

        const ctx = els.mainCanvas.getContext('2d', { willReadFrequently: true });

        // --- Algorithm Helpers ---
        const floodFillColor = (imgData, startX, startY, tolerance) => {
            const w = imgData.width, h = imgData.height, data = imgData.data;
            const mask = new Uint8Array(w * h);
            const startIdx = (startY * w + startX) * 4;
            const sr = data[startIdx], sg = data[startIdx + 1], sb = data[startIdx + 2];
            const sqTolerance = tolerance * tolerance * 3;

            const match = (x, y) => {
                const i = (y * w + x) * 4;
                const dr = data[i] - sr, dg = data[i + 1] - sg, db = data[i + 2] - sb;
                return (dr * dr + dg * dg + db * db) <= sqTolerance;
            };

            const stack = new Int32Array(w * h * 2);
            let stackPtr = 0;
            stack[stackPtr++] = startX; stack[stackPtr++] = startY;
            mask[startY * w + startX] = 1;

            while (stackPtr > 0) {
                let cy = stack[--stackPtr], cx = stack[--stackPtr];
                if (cy > 0 && !mask[(cy - 1) * w + cx] && match(cx, cy - 1)) { mask[(cy - 1) * w + cx] = 1; stack[stackPtr++] = cx; stack[stackPtr++] = cy - 1; }
                if (cy < h - 1 && !mask[(cy + 1) * w + cx] && match(cx, cy + 1)) { mask[(cy + 1) * w + cx] = 1; stack[stackPtr++] = cx; stack[stackPtr++] = cy + 1; }
                if (cx > 0 && !mask[cy * w + cx - 1] && match(cx - 1, cy)) { mask[cy * w + cx - 1] = 1; stack[stackPtr++] = cx - 1; stack[stackPtr++] = cy; }
                if (cx < w - 1 && !mask[cy * w + cx + 1] && match(cx + 1, cy)) { mask[cy * w + cx + 1] = 1; stack[stackPtr++] = cx + 1; stack[stackPtr++] = cy; }
            }
            return mask;
        };

        const floodFillEdge = (edgeData, w, h, startX, startY, edgeThreshold) => {
            const mask = new Uint8Array(w * h);
            const stack = new Int32Array(w * h * 2);
            let stackPtr = 0;
            stack[stackPtr++] = startX; stack[stackPtr++] = startY;
            mask[startY * w + startX] = 1;

            while (stackPtr > 0) {
                let cy = stack[--stackPtr], cx = stack[--stackPtr];
                const match = (x, y) => edgeData[y * w + x] < edgeThreshold;
                if (cy > 0 && !mask[(cy - 1) * w + cx] && match(cx, cy - 1)) { mask[(cy - 1) * w + cx] = 1; stack[stackPtr++] = cx; stack[stackPtr++] = cy - 1; }
                if (cy < h - 1 && !mask[(cy + 1) * w + cx] && match(cx, cy + 1)) { mask[(cy + 1) * w + cx] = 1; stack[stackPtr++] = cx; stack[stackPtr++] = cy + 1; }
                if (cx > 0 && !mask[cy * w + cx - 1] && match(cx - 1, cy)) { mask[cy * w + cx - 1] = 1; stack[stackPtr++] = cx - 1; stack[stackPtr++] = cy; }
                if (cx < w - 1 && !mask[cy * w + cx + 1] && match(cx + 1, cy)) { mask[cy * w + cx + 1] = 1; stack[stackPtr++] = cx + 1; stack[stackPtr++] = cy; }
            }
            return mask;
        };

        const getMaskCoverage = (mask) => {
            let count = 0;
            for (let i = 0; i < mask.length; i++) if (mask[i]) count++;
            return count / Math.max(1, mask.length);
        };

        const isBoundaryPixel = (mask, w, h, x, y) => {
            if (!mask[y * w + x]) return false;
            if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return true;
            return (
                mask[y * w + (x - 1)] === 0 ||
                mask[y * w + (x + 1)] === 0 ||
                mask[(y - 1) * w + x] === 0 ||
                mask[(y + 1) * w + x] === 0
            );
        };

        const getContour = (mask, w, h) => {
            let startX = -1, startY = -1;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    if (isBoundaryPixel(mask, w, h, x, y)) { startX = x; startY = y; break; }
                }
                if (startX !== -1) break;
            }
            if (startX === -1) return [];

            const contour = [];
            let currX = startX, currY = startY;
            const dx = [ 0,  1,  1,  1,  0, -1, -1, -1 ];
            const dy = [-1, -1,  0,  1,  1,  1,  0, -1 ];
            let dir = 7; 

            let maxIters = w * h * 2;
            let firstStepX = -1, firstStepY = -1;
            while (maxIters-- > 0) {
                contour.push({ x: currX, y: currY });
                let found = false;
                for (let i = 0; i < 8; i++) {
                    let testDir = (dir + i) % 8;
                    let nx = currX + dx[testDir], ny = currY + dy[testDir];
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h && isBoundaryPixel(mask, w, h, nx, ny)) {
                        if (firstStepX === -1 && firstStepY === -1) { firstStepX = nx; firstStepY = ny; }
                        currX = nx; currY = ny; dir = (testDir + 5) % 8; found = true; break;
                    }
                }
                if (!found) break;
                if (currX === startX && currY === startY && contour.length > 2) break;
                if (firstStepX !== -1 && firstStepY !== -1 && contour.length > 3 && currX === firstStepX && currY === firstStepY) break;
            }
            return contour;
        };

        const findNearestSeedForEdgeFill = (edgeData, w, h, startX, startY, edgeThreshold, maxRadius = 10) => {
            if (edgeData[startY * w + startX] < edgeThreshold) return { x: startX, y: startY };
            let bestX = startX, bestY = startY;
            let bestVal = edgeData[startY * w + startX];

            for (let r = 1; r <= maxRadius; r++) {
                const minX = Math.max(0, startX - r), maxX = Math.min(w - 1, startX + r);
                const minY = Math.max(0, startY - r), maxY = Math.min(h - 1, startY + r);
                for (let y = minY; y <= maxY; y++) {
                    for (let x = minX; x <= maxX; x++) {
                        const edgeVal = edgeData[y * w + x];
                        if (edgeVal < edgeThreshold) return { x, y };
                        if (edgeVal < bestVal) { bestVal = edgeVal; bestX = x; bestY = y; }
                    }
                }
            }
            return { x: bestX, y: bestY };
        };

        const getPolygonArea = (pts) => {
            let area = 0;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                area += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
            }
            return Math.abs(area / 2);
        };

        const getPathSignature = (pts) => {
            if (!pts || pts.length < 3) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of pts) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            }
            const area = getPolygonArea(pts);
            return { minX, minY, maxX, maxY, area };
        };

        const isLikelyDuplicatePath = (candidate, existingPaths) => {
            const cSig = getPathSignature(candidate);
            if (!cSig) return true;
            return existingPaths.some((path) => {
                const pSig = getPathSignature(path);
                if (!pSig) return false;
                const boxDelta = Math.abs(cSig.minX - pSig.minX) + Math.abs(cSig.minY - pSig.minY) + Math.abs(cSig.maxX - pSig.maxX) + Math.abs(cSig.maxY - pSig.maxY);
                const areaDelta = Math.abs(cSig.area - pSig.area) / Math.max(1, cSig.area, pSig.area);
                return boxDelta <= 8 && areaDelta <= 0.03;
            });
        };

        const getAllContours = (mask, w, h, minHoleArea = 500) => {
            const paths = [];
            const outerContour = getContour(mask, w, h);
            if (outerContour.length < 3) return [];
            paths.push(outerContour);

            const bgMask = new Uint8Array(w * h);
            const stack = new Int32Array(w * h * 2);
            let stackPtr = 0;

            for (let x = 0; x < w; x++) {
                if (mask[x] === 0) { stack[stackPtr++] = x; stack[stackPtr++] = 0; bgMask[x] = 1; }
                if (mask[(h-1)*w + x] === 0) { stack[stackPtr++] = x; stack[stackPtr++] = h-1; bgMask[(h-1)*w + x] = 1; }
            }
            for (let y = 1; y < h - 1; y++) {
                if (mask[y*w] === 0 && bgMask[y*w] === 0) { stack[stackPtr++] = 0; stack[stackPtr++] = y; bgMask[y*w] = 1; }
                if (mask[y*w + w - 1] === 0 && bgMask[y*w + w - 1] === 0) { stack[stackPtr++] = w-1; stack[stackPtr++] = y; bgMask[y*w + w - 1] = 1; }
            }

            while (stackPtr > 0) {
                let cy = stack[--stackPtr], cx = stack[--stackPtr];
                if (cy > 0 && mask[(cy-1)*w + cx] === 0 && bgMask[(cy-1)*w + cx] === 0) { bgMask[(cy-1)*w + cx] = 1; stack[stackPtr++] = cx; stack[stackPtr++] = cy-1; }
                if (cy < h-1 && mask[(cy+1)*w + cx] === 0 && bgMask[(cy+1)*w + cx] === 0) { bgMask[(cy+1)*w + cx] = 1; stack[stackPtr++] = cx; stack[stackPtr++] = cy+1; }
                if (cx > 0 && mask[cy*w + cx-1] === 0 && bgMask[cy*w + cx-1] === 0) { bgMask[cy*w + cx-1] = 1; stack[stackPtr++] = cx-1; stack[stackPtr++] = cy; }
                if (cx < w-1 && mask[cy*w + cx+1] === 0 && bgMask[cy*w + cx+1] === 0) { bgMask[cy*w + cx+1] = 1; stack[stackPtr++] = cx+1; stack[stackPtr++] = cy; }
            }

            const visitedHoles = new Uint8Array(w * h);
            for (let i = 0; i < w * h; i++) {
                if (mask[i] === 0 && bgMask[i] === 0 && visitedHoles[i] === 0) {
                    const singleHoleMask = new Uint8Array(w * h);
                    let hStackPtr = 0;
                    stack[hStackPtr++] = i % w; stack[hStackPtr++] = Math.floor(i / w);
                    singleHoleMask[i] = 1; visitedHoles[i] = 1;

                    while (hStackPtr > 0) {
                        let cy = stack[--hStackPtr], cx = stack[--hStackPtr];
                        if (cy > 0 && mask[(cy-1)*w + cx] === 0 && bgMask[(cy-1)*w + cx] === 0 && visitedHoles[(cy-1)*w + cx] === 0) { singleHoleMask[(cy-1)*w + cx] = 1; visitedHoles[(cy-1)*w + cx] = 1; stack[hStackPtr++] = cx; stack[hStackPtr++] = cy-1; }
                        if (cy < h-1 && mask[(cy+1)*w + cx] === 0 && bgMask[(cy+1)*w + cx] === 0 && visitedHoles[(cy+1)*w + cx] === 0) { singleHoleMask[(cy+1)*w + cx] = 1; visitedHoles[(cy+1)*w + cx] = 1; stack[hStackPtr++] = cx; stack[hStackPtr++] = cy+1; }
                        if (cx > 0 && mask[cy*w + cx-1] === 0 && bgMask[cy*w + cx-1] === 0 && visitedHoles[cy*w + cx-1] === 0) { singleHoleMask[cy*w + cx-1] = 1; visitedHoles[cy*w + cx-1] = 1; stack[hStackPtr++] = cx-1; stack[hStackPtr++] = cy; }
                        if (cx < w-1 && mask[cy*w + cx+1] === 0 && bgMask[cy*w + cx+1] === 0 && visitedHoles[cy*w + cx+1] === 0) { singleHoleMask[cy*w + cx+1] = 1; visitedHoles[cy*w + cx+1] = 1; stack[hStackPtr++] = cx+1; stack[hStackPtr++] = cy; }
                    }

                    const holeContour = getContour(singleHoleMask, w, h);
                    if (holeContour.length > 8) {
                        const area = getPolygonArea(holeContour);
                        if (area >= minHoleArea) paths.push(holeContour);
                    }
                }
            }
            return paths;
        };

        const getSqSegDist = (p, p1, p2) => {
            let x = p1.x, y = p1.y, dx = p2.x - x, dy = p2.y - y;
            if (dx !== 0 || dy !== 0) {
                let t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
                if (t > 1) { x = p2.x; y = p2.y; }
                else if (t > 0) { x += dx * t; y += dy * t; }
            }
            dx = p.x - x; dy = p.y - y;
            return dx * dx + dy * dy;
        };

        const simplifyDPStep = (points, first, last, sqTol, simplified) => {
            let maxSqDist = sqTol, index = -1;
            for (let i = first + 1; i < last; i++) {
                let sqDist = getSqSegDist(points[i], points[first], points[last]);
                if (sqDist > maxSqDist) { index = i; maxSqDist = sqDist; }
            }
            if (index > 0) {
                if (index - first > 1) simplifyDPStep(points, first, index, sqTol, simplified);
                simplified.push(points[index]);
                if (last - index > 1) simplifyDPStep(points, index, last, sqTol, simplified);
            }
        };

        const simplifyPoints = (points, tolerance) => {
            if (points.length <= 2) return points;
            let sqTol = tolerance * tolerance;
            let simplified = [points[0]];
            simplifyDPStep(points, 0, points.length - 1, sqTol, simplified);
            simplified.push(points[points.length - 1]);
            return simplified;
        };

        const computeEdges = (img, blurRadius = 0) => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            if (blurRadius > 0) ctx.filter = `blur(${blurRadius}px)`;
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data, width = canvas.width, height = canvas.height;
            const edges = new Uint8Array(width * height);
            const luma = new Uint8Array(width * height);

            for (let i = 0; i < width * height; i++) {
                luma[i] = 0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2];
            }

            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const tl = luma[(y-1)*width + (x-1)], tc = luma[(y-1)*width + x], tr = luma[(y-1)*width + (x+1)];
                    const ml = luma[y*width + (x-1)], mr = luma[y*width + (x+1)];
                    const bl = luma[(y+1)*width + (x-1)], bc = luma[(y+1)*width + x], br = luma[(y+1)*width + (x+1)];
                    const gx = (tr + 2*mr + br) - (tl + 2*ml + bl);
                    const gy = (bl + 2*bc + br) - (tl + 2*tc + tr);
                    const mag = Math.sqrt(gx * gx + gy * gy) / 4;
                    edges[y*width + x] = Math.min(255, mag);
                }
            }
            return edges;
        };

        // Offload Sobel edge computation to a Web Worker so the UI doesn't freeze.
        // Blur is still applied on the main thread (Canvas-only), but the heavy pixel math runs in the worker.
        let edgesWorker = null;
        let edgesWorkerReqId = 0;

        const getEdgesWorker = () => {
            if (edgesWorker) return edgesWorker;
            const workerCode = `
self.onmessage = function(e) {
  const { reqId, width, height, dataBuffer } = e.data;
  const w = width, h = height;
  const data = new Uint8ClampedArray(dataBuffer);

  const luma = new Uint8Array(w * h);
  const edges = new Uint8Array(w * h);

  for (let i = 0; i < w * h; i++) {
    const di = i * 4;
    luma[i] = 0.299 * data[di] + 0.587 * data[di + 1] + 0.114 * data[di + 2];
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;

      const tl = luma[(y-1)*w + (x-1)], tc = luma[(y-1)*w + x], tr = luma[(y-1)*w + (x+1)];
      const ml = luma[y*w + (x-1)],     mr = luma[y*w + (x+1)];
      const bl = luma[(y+1)*w + (x-1)], bc = luma[(y+1)*w + x], br = luma[(y+1)*w + (x+1)];

      const gx = (tr + 2*mr + br) - (tl + 2*ml + bl);
      const gy = (bl + 2*bc + br) - (tl + 2*tc + tr);
      const mag = Math.sqrt(gx * gx + gy * gy) / 4;
      edges[idx] = mag > 255 ? 255 : mag;
    }
  }

  self.postMessage({ reqId, edges: edges.buffer }, [edges.buffer]);
};
            `;
            edgesWorker = new Worker(URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' })));
            return edgesWorker;
        };

        const computeEdgesAsync = (img, blurRadius = 0) => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            if (blurRadius > 0) ctx.filter = `blur(${blurRadius}px)`;
            ctx.drawImage(img, 0, 0);

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const dataBuffer = imgData.data.buffer; // Transferable

            const worker = getEdgesWorker();
            const reqId = ++edgesWorkerReqId;

            return new Promise((resolve, reject) => {
                const onMessage = (ev) => {
                    if (!ev.data || ev.data.reqId !== reqId) return;
                    worker.removeEventListener('message', onMessage);
                    worker.removeEventListener('error', onError);
                    resolve(new Uint8Array(ev.data.edges));
                };
                const onError = (err) => {
                    worker.removeEventListener('message', onMessage);
                    worker.removeEventListener('error', onError);
                    reject(err);
                };
                worker.addEventListener('message', onMessage);
                worker.addEventListener('error', onError);
                worker.postMessage({ reqId, width: canvas.width, height: canvas.height, dataBuffer }, [dataBuffer]);
            });
        };

        const normalizeImageForTracing = (img, maxDim = 1800, maxPixels = 3000000) => {
            const srcW = img.width;
            const srcH = img.height;
            if (srcW <= 0 || srcH <= 0) return { image: img, scaleX: 1, scaleY: 1 };

            let scale = 1;
            if (srcW > maxDim || srcH > maxDim) {
                scale = Math.min(scale, maxDim / Math.max(srcW, srcH));
            }
            if ((srcW * srcH) > maxPixels) {
                scale = Math.min(scale, Math.sqrt(maxPixels / (srcW * srcH)));
            }

            if (scale >= 0.999) return { image: img, scaleX: 1, scaleY: 1 };

            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(srcW * scale));
            canvas.height = Math.max(1, Math.round(srcH * scale));
            const c = canvas.getContext('2d');
            c.imageSmoothingEnabled = true;
            c.imageSmoothingQuality = 'high';
            c.drawImage(img, 0, 0, canvas.width, canvas.height);
            // scaleX/scaleY map from traced/display coordinates to original upload coordinates
            return { image: canvas, scaleX: srcW / canvas.width, scaleY: srcH / canvas.height };
        };

        // --- Core Functions ---
        const updateUI = () => {
            // Status Text
            if (state.paths.length > 0) {
                els.statusText.innerHTML = `<span class="text-emerald-400 flex items-center gap-1 font-medium"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> ${state.paths.length} Part(s)</span>`;
            } else if (state.points.length > 0) {
                els.statusText.innerHTML = `<span class="text-amber-400">Tracing (${state.points.length} pts)</span>`;
            } else {
                els.statusText.innerHTML = `<span class="text-slate-500">Empty</span>`;
            }
            lucide.createIcons(); // refresh dynamically added icon

            // Exporter Buttons
            const hasCompletePath = state.paths.length > 0;
            const btnClassBase = "px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ";
            
            els.btnExportSvg.disabled = !hasCompletePath;
            els.btnExportPng.disabled = !hasCompletePath;
            els.btnExportSvg.className = btnClassBase + (hasCompletePath ? 'hover:bg-emerald-500 text-emerald-400 hover:text-white' : 'text-slate-500 cursor-not-allowed disabled:opacity-50');
            els.btnExportPng.className = btnClassBase + (hasCompletePath ? 'hover:bg-emerald-500 text-emerald-400 hover:text-white' : 'text-slate-500 cursor-not-allowed disabled:opacity-50');

            // Top level tool buttons
            els.btnUndo.disabled = (state.points.length === 0 && state.paths.length === 0);
            els.btnClear.disabled = (state.points.length === 0 && state.paths.length === 0);

            // Active Tool toggles
            els.btnModeTrace.className = `flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded-md transition-all ${state.toolMode === 'trace' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`;
            els.btnModeWand.className = `flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded-md transition-all ${state.toolMode === 'wand' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`;
            
            els.settingsTrace.classList.toggle('hidden', state.toolMode !== 'trace');
            els.settingsTrace.classList.toggle('block', state.toolMode === 'trace');
            els.settingsWand.classList.toggle('hidden', state.toolMode !== 'wand');
            els.settingsWand.classList.toggle('block', state.toolMode === 'wand');

            els.btnSnap.className = `p-1.5 rounded-md transition-colors ${state.autoSnap ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`;
            
            els.btnWandEdge.className = `flex-1 text-[10px] uppercase font-bold tracking-wider py-1.5 rounded transition-colors ${state.wandType === 'edge' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`;
            els.btnWandColor.className = `flex-1 text-[10px] uppercase font-bold tracking-wider py-1.5 rounded transition-colors ${state.wandType === 'color' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`;
            
            els.wandColorSettings.classList.toggle('hidden', state.wandType !== 'color');
            els.wandColorSettings.classList.toggle('block', state.wandType === 'color');
            els.wandEdgeSettings.classList.toggle('hidden', state.wandType !== 'edge');
            els.wandEdgeSettings.classList.toggle('block', state.wandType === 'edge');

            // Fill Toggles
            if (state.fillImageObj) {
                els.uploadFillBtn.classList.add('hidden');
                els.fillSettings.classList.remove('hidden');
                els.btnFillSingle.className = `flex-1 text-[10px] uppercase font-bold tracking-wider py-1.5 rounded transition-colors ${state.fillMode === 'single' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`;
                els.btnFillPattern.className = `flex-1 text-[10px] uppercase font-bold tracking-wider py-1.5 rounded transition-colors ${state.fillMode === 'pattern' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`;
            } else {
                els.uploadFillBtn.classList.remove('hidden');
                els.fillSettings.classList.add('hidden');
            }
            
            renderCanvas();
        };

        const setLoading = (isLoading) => {
            if (isLoading) {
                els.loadingOverlay.classList.remove('hidden');
                els.loadingOverlay.classList.add('flex');
            } else {
                els.loadingOverlay.classList.add('hidden');
                els.loadingOverlay.classList.remove('flex');
            }
        };

        const buildPath = (targetCtx, pts, closed, smooth, previewMousePos = null) => {
            if (pts.length === 0) return;
            if (smooth && pts.length > 2) {
                if (closed) {
                    const startX = (pts[pts.length - 1].x + pts[0].x) / 2;
                    const startY = (pts[pts.length - 1].y + pts[0].y) / 2;
                    targetCtx.moveTo(startX, startY);
                    for (let i = 0; i < pts.length; i++) {
                        const nextIdx = (i + 1) % pts.length;
                        const xc = (pts[i].x + pts[nextIdx].x) / 2, yc = (pts[i].y + pts[nextIdx].y) / 2;
                        targetCtx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
                    }
                } else {
                    targetCtx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length - 1; i++) {
                        const xc = (pts[i].x + pts[i + 1].x) / 2, yc = (pts[i].y + pts[i + 1].y) / 2;
                        targetCtx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
                    }
                    targetCtx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
                    if (previewMousePos) targetCtx.lineTo(previewMousePos.x, previewMousePos.y);
                }
            } else {
                targetCtx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) targetCtx.lineTo(pts[i].x, pts[i].y);
                if (!closed && previewMousePos) targetCtx.lineTo(previewMousePos.x, previewMousePos.y);
            }
            if (closed) targetCtx.closePath();
        };

        const renderCanvas = () => {
            if (!state.imageObj) return;
            
            // Set canvas size
            els.mainCanvas.width = state.imageObj.width;
            els.mainCanvas.height = state.imageObj.height;
            els.canvasWrapper.style.width = state.imageObj.width + 'px';
            els.canvasWrapper.style.height = state.imageObj.height + 'px';
            els.canvasWrapper.style.transform = `scale(${state.zoom})`;

            // Draw Base Image
            ctx.clearRect(0, 0, els.mainCanvas.width, els.mainCanvas.height);
            ctx.globalAlpha = 0.7;
            ctx.drawImage(state.imageObj, 0, 0);
            ctx.globalAlpha = 1.0;

            if (state.paths.length > 0 || state.points.length > 0) {
                ctx.beginPath();
                
                state.paths.forEach(p => buildPath(ctx, p, true, state.smoothCurves, null));
                if (state.points.length > 0) buildPath(ctx, state.points, false, state.smoothCurves, state.mousePos);

                // Fill Logic
                if (state.paths.length > 0) {
                    if (state.fillImageObj) {
                        if (state.fillMode === 'pattern') {
                            const pCanvas = document.createElement('canvas');
                            pCanvas.width = Math.max(1, state.fillImageObj.width * state.fillScale);
                            pCanvas.height = Math.max(1, state.fillImageObj.height * state.fillScale);
                            pCanvas.getContext('2d').drawImage(state.fillImageObj, 0, 0, pCanvas.width, pCanvas.height);
                            const pattern = ctx.createPattern(pCanvas, 'repeat');
                            pattern.setTransform(new DOMMatrix().translate(state.fillOffsetX, state.fillOffsetY));
                            ctx.fillStyle = pattern;
                            ctx.fill('evenodd');
                        } else {
                            ctx.save();
                            ctx.clip('evenodd');
                            ctx.drawImage(state.fillImageObj, state.fillOffsetX, state.fillOffsetY, Math.max(1, state.fillImageObj.width * state.fillScale), Math.max(1, state.fillImageObj.height * state.fillScale));
                            ctx.restore();
                        }
                    } else {
                        ctx.fillStyle = 'rgba(0, 255, 0, 0.25)';
                        ctx.fill('evenodd');
                    }
                }
                
                // Stroke
                ctx.strokeStyle = '#00FF00';
                ctx.lineWidth = Math.max(3, state.imageObj.width / 500);
                ctx.stroke();

                // Points (Manual trace mode)
                if (state.toolMode === 'trace' && state.points.length > 0) {
                    state.points.forEach((p, i) => {
                        ctx.beginPath();
                        const isStart = i === 0;
                        const radius = isStart ? (state.snapRadius * 1.5) : Math.max(3, state.imageObj.width / 800);
                        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                        ctx.fillStyle = isStart ? 'rgba(255, 0, 255, 0.4)' : '#FF00FF';
                        ctx.fill();
                        if (isStart) {
                            ctx.strokeStyle = '#FFFFFF';
                            ctx.lineWidth = Math.max(1, state.imageObj.width / 1000);
                            ctx.stroke();
                        }
                    });
                    
                    if (state.mousePos) {
                        ctx.beginPath();
                        ctx.arc(state.mousePos.x, state.mousePos.y, Math.max(4, state.imageObj.width / 600), 0, Math.PI * 2);
                        ctx.fillStyle = '#FFFF00';
                        ctx.fill();
                    }
                }
            }
        };

        const getCanvasCoords = (e) => {
            const rect = els.mainCanvas.getBoundingClientRect();
            const scaleX = els.mainCanvas.width / rect.width;
            const scaleY = els.mainCanvas.height / rect.height;
            let x = Math.round((e.clientX - rect.left) * scaleX);
            let y = Math.round((e.clientY - rect.top) * scaleY);
            return { 
                x: Math.max(0, Math.min(x, els.mainCanvas.width - 1)), 
                y: Math.max(0, Math.min(y, els.mainCanvas.height - 1)) 
            };
        };

        const getSnappedCoords = (rawX, rawY) => {
            if (!state.autoSnap || !state.edgeData || !state.imageObj) return { x: rawX, y: rawY };
            let maxMag = -1, bestX = rawX, bestY = rawY;
            const minX = Math.max(0, rawX - state.snapRadius), maxX = Math.min(state.imageObj.width - 1, rawX + state.snapRadius);
            const minY = Math.max(0, rawY - state.snapRadius), maxY = Math.min(state.imageObj.height - 1, rawY + state.snapRadius);

            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const mag = state.edgeData[y * state.imageObj.width + x];
                    if (mag > maxMag && mag >= state.threshold) { maxMag = mag; bestX = x; bestY = y; }
                }
            }
            return { x: bestX, y: bestY };
        };

        // --- Event Listeners ---
        
        // Setup Slider Buttons (+ and -)
        document.querySelectorAll('.slider-btn-minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const inp = e.currentTarget.nextElementSibling;
                const step = parseFloat(inp.step) || 1;
                const min = parseFloat(inp.min);
                let val = parseFloat(inp.value) - step;
                if (val < min) val = min;
                inp.value = Number(val.toFixed(2));
                inp.dispatchEvent(new Event('input'));
            });
        });

        document.querySelectorAll('.slider-btn-plus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const inp = e.currentTarget.previousElementSibling;
                const step = parseFloat(inp.step) || 1;
                const max = parseFloat(inp.max);
                let val = parseFloat(inp.value) + step;
                if (val > max) val = max;
                inp.value = Number(val.toFixed(2));
                inp.dispatchEvent(new Event('input'));
            });
        });

        // Setup Image
        els.uploadImage.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            setLoading(true);
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    state.originalWidth = img.width;
                    state.originalHeight = img.height;
                    const norm = normalizeImageForTracing(img);
                    state.traceScaleX = norm.scaleX;
                    state.traceScaleY = norm.scaleY;
                    state.imageObj = norm.image;
                    state.paths = []; state.points = []; state.zoom = 1; els.valZoom.innerText = '100%';
                    if (state.imageObj !== img) {
                        const originalPixels = img.width * img.height;
                        const scaledPixels = state.imageObj.width * state.imageObj.height;
                        const scalePct = Math.round((scaledPixels / Math.max(1, originalPixels)) * 100);
                        els.statusText.innerHTML = `<span class="text-indigo-300">Optimized image to ${state.imageObj.width}x${state.imageObj.height} (${scalePct}%) for stable tracing</span>`;
                    }
                    
                    els.statusEmpty.classList.add('hidden');
                    els.statusActive.classList.remove('hidden');
                    els.toolPanel.classList.remove('opacity-50', 'pointer-events-none');
                    els.fillPanel.classList.remove('opacity-50', 'pointer-events-none');
                    els.zoomControls.classList.remove('hidden');
                    els.canvasPlaceholder.classList.add('hidden');
                    els.canvasWrapper.classList.remove('hidden');
                    els.canvasContainer.style.cursor = 'crosshair';
                    
                    els.inpFillOffsetX.min = -state.imageObj.width; els.inpFillOffsetX.max = state.imageObj.width;
                    els.inpFillOffsetY.min = -state.imageObj.height; els.inpFillOffsetY.max = state.imageObj.height;

                    setTimeout(() => {
                        (async () => {
                            try {
                                state.edgeData = await computeEdgesAsync(state.imageObj, state.noiseReduction);
                                setLoading(false);
                                updateUI();
                            } catch (err) {
                                console.error(err);
                                setLoading(false);
                                els.statusText.innerHTML = `<span class="text-red-400">Failed to process image. Try a smaller image or lower noise.</span>`;
                                updateUI();
                            } finally {
                                // Safely reset input after everything is done to allow re-uploading same file
                                e.target.value = '';
                            }
                        })();
                    }, 50);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        // Setup Fill
        els.uploadFill.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                state.fillImageDataUrl = event.target.result;
                const img = new Image();
                img.onload = () => {
                    state.fillImageObj = img;
                    state.fillScale = 1; state.fillOffsetX = 0; state.fillOffsetY = 0;
                    els.inpFillScale.value = 1; els.inpFillOffsetX.value = 0; els.inpFillOffsetY.value = 0;
                    els.valFillScale.innerText = '1.00x'; els.valFillOffsetX.innerText = '0px'; els.valFillOffsetY.innerText = '0px';
                    updateUI();
                    e.target.value = ''; 
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        els.btnRemoveFill.addEventListener('click', () => { state.fillImageObj = null; state.fillImageDataUrl = null; updateUI(); });
        els.btnFillSingle.addEventListener('click', () => { state.fillMode = 'single'; updateUI(); });
        els.btnFillPattern.addEventListener('click', () => { state.fillMode = 'pattern'; updateUI(); });

        // Tool Modes
        els.btnModeTrace.addEventListener('click', () => { state.toolMode = 'trace'; els.canvasContainer.style.cursor = 'crosshair'; updateUI(); });
        els.btnModeWand.addEventListener('click', () => { state.toolMode = 'wand'; els.canvasContainer.style.cursor = 'pointer'; updateUI(); });
        els.btnWandEdge.addEventListener('click', () => { state.wandType = 'edge'; updateUI(); });
        els.btnWandColor.addEventListener('click', () => { state.wandType = 'color'; updateUI(); });
        els.btnSnap.addEventListener('click', () => { state.autoSnap = !state.autoSnap; updateUI(); });
        
        // Standard inputs
        els.inpSmooth.addEventListener('change', (e) => { state.smoothCurves = e.target.checked; updateUI(); });
        els.inpThreshold.addEventListener('input', (e) => { state.threshold = Number(e.target.value); els.valThreshold.innerText = e.target.value; });
        els.inpSnapRadius.addEventListener('input', (e) => { state.snapRadius = Number(e.target.value); els.valSnapRadius.innerText = e.target.value + 'px'; });
        els.inpColorTol.addEventListener('input', (e) => { state.wandColorTolerance = Number(e.target.value); els.valColorTol.innerText = e.target.value; });
        els.inpEdgeTol.addEventListener('input', (e) => { state.wandEdgeTolerance = Number(e.target.value); els.valEdgeTol.innerText = Number(e.target.value).toFixed(1); });
        els.inpMinHole.addEventListener('input', (e) => { state.minHoleArea = Number(e.target.value); els.valMinHole.innerText = e.target.value; });
        els.inpFillScale.addEventListener('input', (e) => { state.fillScale = Number(e.target.value); els.valFillScale.innerText = Number(e.target.value).toFixed(2) + 'x'; renderCanvas(); });
        els.inpFillOffsetX.addEventListener('input', (e) => { state.fillOffsetX = Number(e.target.value); els.valFillOffsetX.innerText = e.target.value + 'px'; renderCanvas(); });
        els.inpFillOffsetY.addEventListener('input', (e) => { state.fillOffsetY = Number(e.target.value); els.valFillOffsetY.innerText = e.target.value + 'px'; renderCanvas(); });

        // Noise with Debounce
        let noiseTimeout;
        els.inpNoise.addEventListener('input', (e) => {
            state.noiseReduction = Number(e.target.value);
            els.valNoise.innerText = Number(e.target.value).toFixed(1) + 'px';
            if (!state.imageObj) return;
            clearTimeout(noiseTimeout);
            noiseTimeout = setTimeout(() => {
                setLoading(true);
                setTimeout(async () => {
                    try {
                        state.edgeData = await computeEdgesAsync(state.imageObj, state.noiseReduction);
                        setLoading(false);
                        renderCanvas();
                    } catch (err) {
                        console.error(err);
                        setLoading(false);
                        els.statusText.innerHTML = `<span class="text-red-400">Edge recompute failed. Try again.</span>`;
                        renderCanvas();
                    }
                }, 50);
            }, 400);
        });

        // Zoom
        els.btnZoomIn.addEventListener('click', () => { state.zoom = Math.min(5, state.zoom + 0.2); els.valZoom.innerText = Math.round(state.zoom * 100) + '%'; renderCanvas(); });
        els.btnZoomOut.addEventListener('click', () => { state.zoom = Math.max(0.1, state.zoom - 0.2); els.valZoom.innerText = Math.round(state.zoom * 100) + '%'; renderCanvas(); });

        // Canvas Mouse Events
        els.mainCanvas.addEventListener('mousedown', (e) => {
            if (!state.imageObj) return;
            const coords = getCanvasCoords(e);

            if (state.toolMode === 'wand') {
                setLoading(true);
                setTimeout(() => {
                    const tmpCanvas = document.createElement('canvas');
                    tmpCanvas.width = state.imageObj.width; tmpCanvas.height = state.imageObj.height;
                    const tmpCtx = tmpCanvas.getContext('2d');
                    if (state.wandType === 'color' && state.noiseReduction > 0) tmpCtx.filter = `blur(${state.noiseReduction}px)`;
                    tmpCtx.drawImage(state.imageObj, 0, 0);
                    
                    let mask;
                    if (state.wandType === 'color') {
                        mask = floodFillColor(tmpCtx.getImageData(0, 0, state.imageObj.width, state.imageObj.height), coords.x, coords.y, state.wandColorTolerance);
                    } else {
                        const seed = findNearestSeedForEdgeFill(
                            state.edgeData,
                            state.imageObj.width,
                            state.imageObj.height,
                            coords.x,
                            coords.y,
                            state.wandEdgeTolerance,
                            Math.max(6, Math.floor(state.snapRadius))
                        );
                        mask = floodFillEdge(state.edgeData, state.imageObj.width, state.imageObj.height, seed.x, seed.y, state.wandEdgeTolerance);

                        // If edge flood leaks almost the whole image, retry with a stricter threshold.
                        if (getMaskCoverage(mask) > 0.92) {
                            const stricterThreshold = Math.max(1, state.wandEdgeTolerance * 0.75);
                            mask = floodFillEdge(state.edgeData, state.imageObj.width, state.imageObj.height, seed.x, seed.y, stricterThreshold);
                        }
                    }
                    
                    const allRawContours = getAllContours(mask, state.imageObj.width, state.imageObj.height, state.minHoleArea);
                    if (allRawContours.length > 0) {
                        const simplifyTol = Math.max(1.25, Math.min(3, Math.min(state.imageObj.width, state.imageObj.height) / 700));
                        const simplifiedPaths = allRawContours
                            .map(contour => simplifyPoints(contour, simplifyTol))
                            .filter(path => path.length >= 3)
                            .filter(path => !isLikelyDuplicatePath(path, state.paths));
                        state.paths.push(...simplifiedPaths);
                    }
                    setLoading(false);
                    updateUI();
                }, 50);
                return;
            }

            const snapped = getSnappedCoords(coords.x, coords.y);
            if (state.points.length > 2) {
                if (Math.hypot(state.points[0].x - coords.x, state.points[0].y - coords.y) < (state.snapRadius * 1.5)) {
                    state.paths.push([...state.points]);
                    state.points = [];
                    state.isDragging = false;
                    updateUI();
                    return;
                }
            }
            state.points.push(snapped);
            state.isDragging = true;
            updateUI();
        });

        els.mainCanvas.addEventListener('mousemove', (e) => {
            if (!state.imageObj || state.toolMode === 'wand') return;
            const coords = getCanvasCoords(e);
            state.mousePos = getSnappedCoords(coords.x, coords.y);

            if (state.isDragging && state.points.length > 0) {
                const lastP = state.points[state.points.length - 1];
                if (Math.hypot(lastP.x - state.mousePos.x, lastP.y - state.mousePos.y) > (state.snapRadius / 2)) {
                    state.points.push(state.mousePos);
                }
            }
            renderCanvas();
        });

        els.mainCanvas.addEventListener('mouseup', () => state.isDragging = false);
        els.mainCanvas.addEventListener('mouseleave', () => { state.mousePos = null; state.isDragging = false; renderCanvas(); });

        // Keybindings & Clear
        const doUndo = () => { if (state.points.length > 0) state.points.pop(); else if (state.paths.length > 0) state.paths.pop(); updateUI(); };
        const doClear = () => { state.points = []; state.paths = []; updateUI(); };
        els.btnUndo.addEventListener('click', doUndo);
        els.btnClear.addEventListener('click', doClear);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); doUndo(); }
            if (e.key === 'Escape') { state.points = []; updateUI(); }
        });

        if (els.btnHowtoClose) els.btnHowtoClose.addEventListener('click', hideHowtoDialog);
        if (els.btnHowtoGotit) els.btnHowtoGotit.addEventListener('click', hideHowtoDialog);
        if (els.inpHowtoNever) {
            els.inpHowtoNever.checked = localStorage.getItem(HOWTO_STORAGE_KEY) === '1';
            els.inpHowtoNever.addEventListener('change', (e) => {
                localStorage.setItem(HOWTO_STORAGE_KEY, e.target.checked ? '1' : '0');
            });
        }
        if (els.howtoOverlay) {
            els.howtoOverlay.addEventListener('click', (e) => {
                if (e.target === els.howtoOverlay) hideHowtoDialog();
            });
        }
        showHowtoIfNeeded();

        // --- Exporters ---
        const getSvgPathString = (pts, closed) => {
            if (!pts || pts.length < 3) return '';
            let svgPath = '';
            if (state.smoothCurves && pts.length > 2) {
                if (closed) {
                    const startX = (pts[pts.length - 1].x + pts[0].x) / 2, startY = (pts[pts.length - 1].y + pts[0].y) / 2;
                    svgPath += `M ${startX} ${startY} `;
                    for (let i = 0; i < pts.length; i++) {
                        const nextIdx = (i + 1) % pts.length;
                        const xc = (pts[i].x + pts[nextIdx].x) / 2, yc = (pts[i].y + pts[nextIdx].y) / 2;
                        svgPath += `Q ${pts[i].x} ${pts[i].y}, ${xc} ${yc} `;
                    }
                } else {
                    svgPath += `M ${pts[0].x} ${pts[0].y} `;
                    for (let i = 1; i < pts.length - 1; i++) {
                        const xc = (pts[i].x + pts[i + 1].x) / 2, yc = (pts[i].y + pts[i + 1].y) / 2;
                        svgPath += `Q ${pts[i].x} ${pts[i].y}, ${xc} ${yc} `;
                    }
                    svgPath += `L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y} `;
                }
            } else {
                svgPath = `M ${pts[0].x} ${pts[0].y} `;
                for (let i = 1; i < pts.length; i++) svgPath += `L ${pts[i].x} ${pts[i].y} `;
            }
            if (closed) svgPath += 'Z';
            return svgPath;
        };

        els.btnExportSvg.addEventListener('click', () => {
            if (state.paths.length === 0) return;
            const outputW = state.originalWidth || state.imageObj.width;
            const outputH = state.originalHeight || state.imageObj.height;
            const sx = state.traceScaleX || 1;
            const sy = state.traceScaleY || 1;

            const scalePts = (pts) => pts.map(pt => ({ x: pt.x * sx, y: pt.y * sy }));
            const fullSvgPath = state.paths.map(p => getSvgPathString(scalePts(p), true)).join(' ');
            let svgContent = '';
            if (state.fillImageDataUrl) {
                if (state.fillMode === 'pattern') {
                    const pWidth = state.fillImageObj.width * state.fillScale * sx, pHeight = state.fillImageObj.height * state.fillScale * sy;
                    svgContent = `<defs><pattern id="fill-pattern" patternUnits="userSpaceOnUse" width="${pWidth}" height="${pHeight}" patternTransform="translate(${state.fillOffsetX * sx}, ${state.fillOffsetY * sy})"><image href="${state.fillImageDataUrl}" x="0" y="0" width="${pWidth}" height="${pHeight}" /></pattern></defs><path d="${fullSvgPath}" fill="url(#fill-pattern)" fill-rule="evenodd" stroke="none" />`;
                } else {
                    const imgWidth = state.fillImageObj.width * state.fillScale * sx, imgHeight = state.fillImageObj.height * state.fillScale * sy;
                    svgContent = `<defs><clipPath id="shape-clip"><path d="${fullSvgPath}" clip-rule="evenodd" /></clipPath></defs><image href="${state.fillImageDataUrl}" x="${state.fillOffsetX * sx}" y="${state.fillOffsetY * sy}" width="${imgWidth}" height="${imgHeight}" clip-path="url(#shape-clip)" />`;
                }
            } else {
                svgContent = `  <path d="${fullSvgPath}" fill="black" fill-rule="evenodd" stroke="none" />`;
            }

            const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${outputW} ${outputH}" width="${outputW}" height="${outputH}"><rect width="100%" height="100%" fill="white" />${svgContent}</svg>`;
            const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'uv_laser_template.svg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            setTimeout(() => URL.revokeObjectURL(url), 100);
        });

        els.btnExportPng.addEventListener('click', () => {
            if (state.paths.length === 0) return;
            const outputW = state.originalWidth || state.imageObj.width;
            const outputH = state.originalHeight || state.imageObj.height;
            const sx = state.traceScaleX || 1;
            const sy = state.traceScaleY || 1;
            const scalePts = (pts) => pts.map(pt => ({ x: pt.x * sx, y: pt.y * sy }));

            const expCanvas = document.createElement('canvas');
            expCanvas.width = outputW; 
            expCanvas.height = outputH;
            const eCtx = expCanvas.getContext('2d');
            
            eCtx.beginPath();
            state.paths.forEach(p => buildPath(eCtx, scalePts(p), true, state.smoothCurves));

            if (state.fillImageObj) {
                if (state.fillMode === 'pattern') {
                    const pCanvas = document.createElement('canvas');
                    pCanvas.width = Math.max(1, state.fillImageObj.width * state.fillScale * sx); 
                    pCanvas.height = Math.max(1, state.fillImageObj.height * state.fillScale * sy);
                    pCanvas.getContext('2d').drawImage(state.fillImageObj, 0, 0, pCanvas.width, pCanvas.height);
                    const pattern = eCtx.createPattern(pCanvas, 'repeat');
                    pattern.setTransform(new DOMMatrix().translate(state.fillOffsetX * sx, state.fillOffsetY * sy));
                    eCtx.fillStyle = pattern; 
                    eCtx.fill('evenodd');
                } else {
                    eCtx.save(); 
                    eCtx.clip('evenodd');
                    eCtx.drawImage(
                        state.fillImageObj,
                        state.fillOffsetX * sx,
                        state.fillOffsetY * sy,
                        Math.max(1, state.fillImageObj.width * state.fillScale * sx),
                        Math.max(1, state.fillImageObj.height * state.fillScale * sy)
                    );
                    eCtx.restore();
                }
            } else {
                eCtx.fillStyle = 'black'; 
                eCtx.fill('evenodd');
            }

            expCanvas.toBlob((blob) => {
                if (!blob) {
                    alert('Failed to generate PNG.');
                    return;
                }
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a'); 
                a.style.display = 'none';
                a.href = url; 
                a.download = 'uv_laser_template.png'; 
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                setTimeout(() => URL.revokeObjectURL(url), 100);
            }, 'image/png');
        });

