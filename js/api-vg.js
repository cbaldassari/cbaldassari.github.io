(function () {
    'use strict';

    var api = document.getElementById('vg-api');
    if (!api) return;

    var MAX_POINTS = 100;
    var EMBED_DIM = 10;

    // --- Seeded PRNG (Mulberry32) ---
    function mulberry32(seed) {
        return function () {
            seed |= 0;
            seed = seed + 0x6D2B79F5 | 0;
            var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    // --- Sample data ---
    var SAMPLES = {};
    (function () {
        var rng, i;

        rng = mulberry32(42);
        var sine = [];
        for (i = 0; i < 60; i++) {
            sine.push(Math.sin(2 * Math.PI * i / 15) + (rng() - 0.5) * 0.3);
        }
        SAMPLES['sine'] = sine;

        rng = mulberry32(123);
        var walk = [0];
        for (i = 1; i < 80; i++) {
            walk.push(walk[i - 1] + (rng() - 0.5) * 0.6);
        }
        SAMPLES['random-walk'] = walk;

        rng = mulberry32(77);
        var seasonal = [];
        for (i = 0; i < 72; i++) {
            seasonal.push(Math.sin(2 * Math.PI * i / 12) * 2 + i * 0.03 + (rng() - 0.5) * 0.5);
        }
        SAMPLES['seasonal'] = seasonal;
    })();

    // --- State ---
    var canvas, ctx;
    var currentSeries = null;
    var currentEdges = null;
    var vgType = 'natural';

    // --- Natural Visibility Graph ---
    function naturalVG(series) {
        var n = series.length;
        var edges = [];
        for (var i = 0; i < n; i++) {
            for (var j = i + 1; j < n; j++) {
                var visible = true;
                for (var k = i + 1; k < j; k++) {
                    var lineY = series[i] + (series[j] - series[i]) * (k - i) / (j - i);
                    if (series[k] >= lineY) {
                        visible = false;
                        break;
                    }
                }
                if (visible) edges.push([i, j]);
            }
        }
        return edges;
    }

    // --- Horizontal Visibility Graph ---
    function horizontalVG(series) {
        var n = series.length;
        var edges = [];
        for (var i = 0; i < n; i++) {
            for (var j = i + 1; j < n; j++) {
                var threshold = Math.min(series[i], series[j]);
                var visible = true;
                for (var k = i + 1; k < j; k++) {
                    if (series[k] >= threshold) {
                        visible = false;
                        break;
                    }
                }
                if (visible) edges.push([i, j]);
            }
        }
        return edges;
    }

    // --- Normalized Laplacian ---
    function normalizedLaplacian(n, edges) {
        var i, j;
        var A = [];
        for (i = 0; i < n; i++) {
            A[i] = new Float64Array(n);
        }
        for (var e = 0; e < edges.length; e++) {
            A[edges[e][0]][edges[e][1]] = 1;
            A[edges[e][1]][edges[e][0]] = 1;
        }

        var deg = new Float64Array(n);
        for (i = 0; i < n; i++) {
            for (j = 0; j < n; j++) deg[i] += A[i][j];
        }

        var L = [];
        for (i = 0; i < n; i++) {
            L[i] = [];
            for (j = 0; j < n; j++) {
                if (i === j) {
                    L[i][j] = deg[i] > 0 ? 1 : 0;
                } else if (A[i][j] > 0 && deg[i] > 0 && deg[j] > 0) {
                    L[i][j] = -1 / Math.sqrt(deg[i] * deg[j]);
                } else {
                    L[i][j] = 0;
                }
            }
        }
        return L;
    }

    // --- Jacobi eigenvalue algorithm for symmetric matrices ---
    function jacobiEigenvalues(matrix) {
        var n = matrix.length;
        if (n === 0) return [];
        if (n === 1) return [matrix[0][0]];

        var i, j;
        var M = [];
        for (i = 0; i < n; i++) {
            M[i] = [];
            for (j = 0; j < n; j++) M[i][j] = matrix[i][j];
        }

        var maxIter = 50 * n;

        for (var iter = 0; iter < maxIter; iter++) {
            var maxVal = 0, p = 0, q = 1;
            for (i = 0; i < n; i++) {
                for (j = i + 1; j < n; j++) {
                    if (Math.abs(M[i][j]) > maxVal) {
                        maxVal = Math.abs(M[i][j]);
                        p = i;
                        q = j;
                    }
                }
            }
            if (maxVal < 1e-10) break;

            var diff = M[q][q] - M[p][p];
            var t;
            if (Math.abs(diff) < 1e-15) {
                t = 1;
            } else {
                var phi = diff / (2 * M[p][q]);
                t = 1 / (Math.abs(phi) + Math.sqrt(phi * phi + 1));
                if (phi < 0) t = -t;
            }

            var c = 1 / Math.sqrt(t * t + 1);
            var s = t * c;
            var tau = s / (1 + c);
            var tmp = M[p][q];

            M[p][q] = 0;
            M[q][p] = 0;
            M[p][p] -= t * tmp;
            M[q][q] += t * tmp;

            for (i = 0; i < n; i++) {
                if (i !== p && i !== q) {
                    var mip = M[i][p];
                    var miq = M[i][q];
                    M[i][p] = M[p][i] = mip - s * (miq + tau * mip);
                    M[i][q] = M[q][i] = miq + s * (mip - tau * miq);
                }
            }
        }

        var eigenvalues = [];
        for (i = 0; i < n; i++) eigenvalues.push(M[i][i]);
        return eigenvalues.sort(function (a, b) { return a - b; });
    }

    // --- Spectral embedding ---
    function spectralEmbedding(n, edges, dim) {
        var L = normalizedLaplacian(n, edges);
        var eigenvalues = jacobiEigenvalues(L);
        // Skip lambda_0 (always ~0), take next `dim` eigenvalues
        var emb = [];
        var start = 1;
        var end = Math.min(start + dim, n);
        for (var i = start; i < end; i++) {
            emb.push(eigenvalues[i]);
        }
        while (emb.length < dim) emb.push(0);
        return emb;
    }

    // --- Canvas ---
    function resizeCanvas() {
        var wrap = canvas.parentElement;
        var w = wrap.clientWidth;
        var ratio = window.innerWidth < 768 ? 1.3 : 1.8;
        var h = Math.round(w / ratio);
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawVG(series, edges) {
        var w = parseFloat(canvas.style.width);
        var h = parseFloat(canvas.style.height);
        var pad = 40;
        var n = series.length;

        var yMin = series[0], yMax = series[0];
        for (var i = 1; i < n; i++) {
            if (series[i] < yMin) yMin = series[i];
            if (series[i] > yMax) yMax = series[i];
        }
        var yRange = yMax - yMin || 1;
        yMin -= yRange * 0.1;
        yMax += yRange * 0.1;
        yRange = yMax - yMin;

        function tx(idx) { return pad + idx / (n - 1) * (w - pad * 2); }
        function ty(v) { return h - pad - ((v - yMin) / yRange) * (h - pad * 2); }

        ctx.clearRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.5;
        for (var g = 0; g < 5; g++) {
            var gy = pad + g * (h - pad * 2) / 4;
            ctx.beginPath();
            ctx.moveTo(pad, gy);
            ctx.lineTo(w - pad, gy);
            ctx.stroke();
        }

        // Edges
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.18)';
        ctx.lineWidth = 1;
        for (var e = 0; e < edges.length; e++) {
            var a = edges[e][0], b = edges[e][1];
            ctx.beginPath();
            ctx.moveTo(tx(a), ty(series[a]));
            ctx.lineTo(tx(b), ty(series[b]));
            ctx.stroke();
        }

        // Time series line
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (var i = 0; i < n; i++) {
            if (i === 0) ctx.moveTo(tx(i), ty(series[i]));
            else ctx.lineTo(tx(i), ty(series[i]));
        }
        ctx.stroke();

        // Nodes
        for (var i = 0; i < n; i++) {
            ctx.beginPath();
            ctx.arc(tx(i), ty(series[i]), 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgb(99, 102, 241)';
            ctx.fill();
        }

        // Axis labels
        var fontMono = getComputedStyle(document.documentElement)
            .getPropertyValue('--font-mono').trim() || 'monospace';
        ctx.font = '10px ' + fontMono;
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.textAlign = 'left';
        ctx.fillText('t=0', pad, h - 12);
        ctx.textAlign = 'right';
        ctx.fillText('t=' + (n - 1), w - pad, h - 12);
        ctx.fillText('value', w - pad, 14);
    }

    // --- File handling ---
    function handleFile(file) {
        var reader = new FileReader();
        var name = file.name.toLowerCase();

        reader.onload = function (e) {
            var text = e.target.result;
            var values = [];

            if (name.endsWith('.json')) {
                try {
                    var data = JSON.parse(text);
                    if (Array.isArray(data)) {
                        for (var i = 0; i < data.length; i++) {
                            var v = parseFloat(data[i]);
                            if (!isNaN(v) && isFinite(v)) values.push(v);
                        }
                    } else if (typeof data === 'object') {
                        var keys = Object.keys(data);
                        for (var k = 0; k < keys.length; k++) {
                            if (Array.isArray(data[keys[k]])) {
                                var arr = data[keys[k]];
                                for (var i = 0; i < arr.length; i++) {
                                    var v = parseFloat(arr[i]);
                                    if (!isNaN(v) && isFinite(v)) values.push(v);
                                }
                                if (values.length > 0) break;
                            }
                        }
                    }
                } catch (err) { /* invalid JSON */ }
            } else {
                // CSV / TSV
                var lines = text.trim().split(/\r?\n/);
                var sep = name.endsWith('.tsv') ? '\t' : ',';
                var startRow = 0;

                // Detect header
                if (lines.length > 1) {
                    var firstParts = lines[0].split(sep);
                    var allNonNumeric = true;
                    for (var i = 0; i < firstParts.length; i++) {
                        if (!isNaN(parseFloat(firstParts[i].trim()))) {
                            allNonNumeric = false;
                            break;
                        }
                    }
                    if (allNonNumeric) startRow = 1;
                }

                // Find first numeric column
                var numCols = 0;
                if (lines.length > startRow) {
                    numCols = lines[startRow].split(sep).length;
                }
                var colIdx = -1;
                for (var c = 0; c < numCols; c++) {
                    var allNumeric = true;
                    var count = 0;
                    for (var r = startRow; r < Math.min(lines.length, startRow + 5); r++) {
                        var parts = lines[r].split(sep);
                        if (c < parts.length) {
                            var v = parseFloat(parts[c].trim());
                            if (isNaN(v)) { allNumeric = false; break; }
                            count++;
                        }
                    }
                    if (allNumeric && count > 0) { colIdx = c; break; }
                }
                // If first col is non-numeric (dates), try second
                if (colIdx === -1 && numCols > 1) colIdx = 1;
                if (colIdx === -1) colIdx = 0;

                for (var r = startRow; r < lines.length; r++) {
                    var parts = lines[r].split(sep);
                    if (colIdx < parts.length) {
                        var v = parseFloat(parts[colIdx].trim());
                        if (!isNaN(v) && isFinite(v)) values.push(v);
                    }
                }
            }

            if (values.length > 0) {
                document.getElementById('vg-input').value =
                    values.map(function (v) { return v.toFixed(4); }).join(', ');
            }
        };

        reader.readAsText(file);
    }

    // --- Parse input ---
    function parseSeries(text) {
        var parts = text.trim().split(/[\s,;]+/);
        var values = [];
        for (var i = 0; i < parts.length; i++) {
            var v = parseFloat(parts[i]);
            if (!isNaN(v) && isFinite(v)) values.push(v);
        }
        return values;
    }

    // --- Compute ---
    function onCompute() {
        var input = document.getElementById('vg-input');
        var series = parseSeries(input.value);
        if (series.length < 3) return;
        if (series.length > MAX_POINTS) series = series.slice(0, MAX_POINTS);

        var loading = document.getElementById('vg-loading');
        var output = document.getElementById('vg-output');
        loading.classList.add('visible');
        output.classList.remove('visible');

        setTimeout(function () {
            var edges;
            if (vgType === 'horizontal') {
                edges = horizontalVG(series);
            } else {
                edges = naturalVG(series);
            }
            currentSeries = series;
            currentEdges = edges;

            var dim = Math.min(EMBED_DIM, series.length - 1);
            var embedding = spectralEmbedding(series.length, edges, dim);

            resizeCanvas();
            drawVG(series, edges);

            // Info line
            var maxEdges = series.length * (series.length - 1) / 2;
            var density = maxEdges > 0 ? edges.length / maxEdges : 0;
            document.getElementById('vg-info').textContent =
                series.length + ' nodes, ' +
                edges.length + ' edges, density ' +
                density.toFixed(3) + ', embedding dim ' + dim;

            // Embedding vector
            var embStr = '[' + embedding.map(function (v) {
                return v.toFixed(6);
            }).join(', ') + ']';
            document.getElementById('vg-embedding').textContent = embStr;

            loading.classList.remove('visible');
            output.classList.add('visible');
        }, 30);
    }

    // --- Events ---
    function bindEvents() {
        document.getElementById('vg-run').addEventListener('click', onCompute);

        // File upload
        var fileInput = document.getElementById('vg-file-input');
        var uploadArea = document.getElementById('vg-upload-area');

        if (fileInput) {
            fileInput.addEventListener('change', function () {
                if (this.files.length > 0) handleFile(this.files[0]);
            });
        }

        if (uploadArea) {
            uploadArea.addEventListener('dragover', function (e) {
                e.preventDefault();
                this.classList.add('dragover');
            });
            uploadArea.addEventListener('dragleave', function () {
                this.classList.remove('dragover');
            });
            uploadArea.addEventListener('drop', function (e) {
                e.preventDefault();
                this.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    handleFile(e.dataTransfer.files[0]);
                }
            });
        }

        var sampleBtns = api.querySelectorAll('.vg-sample-btn');
        for (var i = 0; i < sampleBtns.length; i++) {
            sampleBtns[i].addEventListener('click', function () {
                var data = SAMPLES[this.dataset.sample];
                if (data) {
                    document.getElementById('vg-input').value =
                        data.map(function (v) { return v.toFixed(4); }).join(', ');
                }
            });
        }

        var typeBtns = api.querySelectorAll('.vg-option-btn');
        for (var i = 0; i < typeBtns.length; i++) {
            typeBtns[i].addEventListener('click', function () {
                for (var j = 0; j < typeBtns.length; j++) typeBtns[j].classList.remove('selected');
                this.classList.add('selected');
                vgType = this.dataset.vgType;
            });
        }

        document.getElementById('vg-copy').addEventListener('click', function () {
            var text = document.getElementById('vg-embedding').textContent;
            var btn = this;
            navigator.clipboard.writeText(text).then(function () {
                btn.textContent = 'Copied';
                btn.classList.add('copied');
                setTimeout(function () {
                    btn.textContent = 'Copy vector';
                    btn.classList.remove('copied');
                }, 1500);
            });
        });

        var resizeTimer;
        window.addEventListener('resize', function () {
            if (currentSeries && currentEdges) {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(function () {
                    resizeCanvas();
                    drawVG(currentSeries, currentEdges);
                }, 150);
            }
        });

        // Redraw on theme change
        new MutationObserver(function () {
            if (currentSeries && currentEdges) {
                drawVG(currentSeries, currentEdges);
            }
        }).observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }

    // --- Init ---
    function init() {
        canvas = document.getElementById('vg-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        bindEvents();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
