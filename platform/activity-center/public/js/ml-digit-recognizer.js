/**
 * ML Handwritten Digit Recognizer for EduVision
 * Uses the exact scikit-learn load_digits() 8x8 dataset and k-NN (k=3, distance-weighted)
 * algorithm matching the original Python Objects_Counting & Draw_Missing_Number games.
 */
class MLDigitRecognizer {
    constructor() {
        this.dataset = null;
        this.isLoading = false;
        this.loadPromise = this.init();
    }

    async init() {
        if (this.dataset) return this.dataset;
        if (this.isLoading) return this.loadPromise;
        this.isLoading = true;
        try {
            const res = await fetch('/js/digits_knn.json');
            this.dataset = await res.json();
            console.log('[MLDigitRecognizer] Loaded', this.dataset.y.length, 'training samples from scikit-learn dataset.');
            return this.dataset;
        } catch (e) {
            console.error('[MLDigitRecognizer] Failed to load dataset:', e);
            return null;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Recognizes handwritten digit from an HTML5 Canvas
     * @param {HTMLCanvasElement} canvas
     * @returns {Promise<{digit: number|null, confidence: number, previewUrl: string}>}
     */
    async recognizeFromCanvas(canvas) {
        await this.loadPromise;
        if (!this.dataset || !this.dataset.X) {
            throw new Error('ML model not loaded yet');
        }

        const width = canvas.width;
        const height = canvas.height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // 1. Find bounding box of ink
        let minX = width, maxX = 0, minY = height, maxY = 0;
        let inkCount = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const a = data[idx + 3];

                // Consider non-white/drawn pixels as ink
                // Ink is darker or has significant opacity
                const isInk = a > 50 && (r < 220 || g < 220 || b < 220);
                if (isInk) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    inkCount++;
                }
            }
        }

        // Check if slate is blank or has negligible stroke
        if (inkCount < 30 || minX > maxX || minY > maxY) {
            return { digit: null, confidence: 0, reason: 'blank' };
        }

        const bboxW = maxX - minX + 1;
        const bboxH = maxY - minY + 1;

        if (bboxW < 8 && bboxH < 8) {
            return { digit: null, confidence: 0, reason: 'too_small' };
        }

        // 2. Crop to square with padding (matching Python np.zeros((max_dim, max_dim)))
        const maxDim = Math.max(bboxW, bboxH);
        const padding = Math.round(maxDim * 0.15); // 15% margin
        const squareSize = maxDim + (padding * 2);

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = squareSize;
        cropCanvas.height = squareSize;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.fillStyle = '#ffffff';
        cropCtx.fillRect(0, 0, squareSize, squareSize);

        // Center the bounding box inside the square
        const destX = padding + Math.floor((maxDim - bboxW) / 2);
        const destY = padding + Math.floor((maxDim - bboxH) / 2);

        cropCtx.drawImage(
            canvas,
            minX, minY, bboxW, bboxH,
            destX, destY, bboxW, bboxH
        );

        // 3. Downsample to 8x8 using smooth canvas interpolation
        const digit8Canvas = document.createElement('canvas');
        digit8Canvas.width = 8;
        digit8Canvas.height = 8;
        const digit8Ctx = digit8Canvas.getContext('2d');
        digit8Ctx.imageSmoothingEnabled = true;
        digit8Ctx.imageSmoothingQuality = 'high';
        digit8Ctx.drawImage(cropCanvas, 0, 0, 8, 8);

        // 4. Extract 64 features normalized to 0..16 as in scikit-learn
        const d8Data = digit8Ctx.getImageData(0, 0, 8, 8).data;
        const features = new Array(64);

        for (let i = 0; i < 64; i++) {
            const idx = i * 4;
            const r = d8Data[idx];
            const g = d8Data[idx + 1];
            const b = d8Data[idx + 2];
            // Invert: white background (0) to black ink (16)
            const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
            const ink = 255.0 - gray;
            features[i] = Math.max(0, Math.min(16, (ink / 255.0) * 16.0));
        }

        // 5. Run k-NN (k=3, distance weighting)
        const X = this.dataset.X;
        const y = this.dataset.y;
        const nSamples = y.length;

        const distances = new Array(nSamples);
        for (let i = 0; i < nSamples; i++) {
            const sample = X[i];
            let sumSq = 0;
            for (let j = 0; j < 64; j++) {
                const diff = features[j] - sample[j];
                sumSq += diff * diff;
            }
            distances[i] = { idx: i, dist: Math.sqrt(sumSq), label: y[i] };
        }

        // Sort by distance ascending
        distances.sort((a, b) => a.dist - b.dist);

        // Top k=3 neighbors
        const k = 3;
        const votes = {};
        for (let i = 0; i < 10; i++) votes[i] = 0;

        for (let i = 0; i < k; i++) {
            const neighbor = distances[i];
            const weight = 1.0 / (neighbor.dist + 1e-5);
            votes[neighbor.label] += weight;
        }

        let bestDigit = 0;
        let maxWeight = -1;
        let totalWeight = 0;

        for (let d = 0; d < 10; d++) {
            totalWeight += votes[d];
            if (votes[d] > maxWeight) {
                maxWeight = votes[d];
                bestDigit = d;
            }
        }

        const confidence = totalWeight > 0 ? Math.round((maxWeight / totalWeight) * 100) : 0;
        return {
            digit: bestDigit,
            confidence: confidence,
            nearestDist: distances[0].dist,
            previewUrl: cropCanvas.toDataURL()
        };
    }
}

// Global singleton instance
window.mlDigitRecognizer = new MLDigitRecognizer();
