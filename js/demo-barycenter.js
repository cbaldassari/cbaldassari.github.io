(function () {
    'use strict';

    var demo = document.getElementById('wb-demo');
    if (!demo) return;

    // --- CONFIG ---
    var BINS = 200;
    var X_MIN = -3;
    var X_MAX = 9;
    var DX = (X_MAX - X_MIN) / BINS;
    var LERP = 0.07;
    var PARTICLE_COUNT = 35;

    var DIST_COLORS = [
        { r: 99, g: 102, b: 241 },   // indigo
        { r: 6, g: 182, b: 212 },     // cyan
        { r: 249, g: 115, b: 22 }     // orange
    ];
    var PRESETS = {
        energy: {
            label: 'Energy prices',
            names: ['Gas-driven spike', 'Stable baseload', 'Volatile bimodal'],
            desc: 'Three synthetic scenarios loosely inspired by energy price dynamics: a gas-dominated regime with price spikes, a stable baseload scenario, and a volatile market with two distinct price modes. Distributions are illustrative, not fitted to real data.',
            dists: [
                [{ mu: 2.0, s: 0.7, w: 0.65 }, { mu: 4.5, s: 0.5, w: 0.35 }],
                [{ mu: 2.5, s: 0.6, w: 1.0 }],
                [{ mu: 1.0, s: 0.9, w: 0.5 }, { mu: 5.0, s: 0.7, w: 0.5 }]
            ],
            weights: [0.33, 0.34, 0.33]
        },
        rates: {
            label: 'Interest rates',
            names: ['Low-rate regime', 'Normal regime', 'High-rate tail'],
            desc: 'Three synthetic interest rate regimes: a near-zero environment, a normal monetary policy scenario, and a regime with persistent high rates and fat tails. Distributions are illustrative, not fitted to real data.',
            dists: [
                [{ mu: 0.8, s: 0.4, w: 1.0 }],
                [{ mu: 3.0, s: 0.9, w: 1.0 }],
                [{ mu: 5.5, s: 1.0, w: 0.55 }, { mu: 1.5, s: 0.5, w: 0.45 }]
            ],
            weights: [0.5, 0.3, 0.2]
        },
        bimodal: {
            label: 'Bimodal mix',
            names: ['Unimodal narrow', 'Bimodal separated', 'Broad flat'],
            desc: 'A synthetic scenario to illustrate how the barycenter interpolates between distributions with very different shapes: a tight peak, two widely separated modes, and a broad diffuse distribution.',
            dists: [
                [{ mu: 1.0, s: 0.5, w: 1.0 }],
                [{ mu: -0.5, s: 0.6, w: 0.5 }, { mu: 6.0, s: 0.6, w: 0.5 }],
                [{ mu: 3.0, s: 2.0, w: 1.0 }]
            ],
            weights: [0.33, 0.34, 0.33]
        }
    };

    // --- STATE ---
    var pdfs = [];
    var weights = [];
    var currentBary = null;
    var targetBary = null;
    var particles = [];
    var canvas, ctx;
    var animId = null;
    var activePreset = 'energy';
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- MATH ---
    function gauss(x, mu, s) {
        var d = (x - mu) / s;
        return Math.exp(-0.5 * d * d) / (s * 2.5066282746);
    }

    function buildPDF(components) {
        var pdf = new Float64Array(BINS);
        for (var i = 0; i < BINS; i++) {
            var x = X_MIN + (i + 0.5) * DX;
            var v = 0;
            for (var c = 0; c < components.length; c++) {
                v += components[c].w * gauss(x, components[c].mu, components[c].s);
            }
            pdf[i] = v;
        }
        // normalize
        var sum = 0;
        for (var i = 0; i < BINS; i++) sum += pdf[i];
        if (sum > 0) for (var i = 0; i < BINS; i++) pdf[i] /= (sum * DX);
        return pdf;
    }

    function computeBarycenter(pdfs, weights) {
        var n = pdfs.length;

        // CDF for each
        var cdfs = [];
        for (var k = 0; k < n; k++) {
            var cdf = new Float64Array(BINS);
            cdf[0] = pdfs[k][0] * DX;
            for (var i = 1; i < BINS; i++) cdf[i] = cdf[i - 1] + pdfs[k][i] * DX;
            var total = cdf[BINS - 1];
            if (total > 0) for (var i = 0; i < BINS; i++) cdf[i] /= total;
            cdfs.push(cdf);
        }

        // Quantile functions
        var NQ = BINS * 2;
        var quantiles = [];
        for (var k = 0; k < n; k++) {
            var q = new Float64Array(NQ);
            for (var j = 0; j < NQ; j++) {
                var t = (j + 0.5) / NQ;
                var lo = 0, hi = BINS - 1;
                while (lo < hi) {
                    var mid = (lo + hi) >> 1;
                    if (cdfs[k][mid] < t) lo = mid + 1; else hi = mid;
                }
                // linear interpolation
                var xBase = X_MIN + lo * DX;
                if (lo > 0 && cdfs[k][lo] !== cdfs[k][lo - 1]) {
                    var frac = (t - cdfs[k][lo - 1]) / (cdfs[k][lo] - cdfs[k][lo - 1]);
                    xBase = X_MIN + (lo - 1 + frac) * DX;
                }
                q[j] = xBase;
            }
            quantiles.push(q);
        }

        // Weighted average of quantiles
        var baryQ = new Float64Array(NQ);
        for (var j = 0; j < NQ; j++) {
            var s = 0;
            for (var k = 0; k < n; k++) s += weights[k] * quantiles[k][j];
            baryQ[j] = s;
        }

        // Quantile -> PDF via histogram
        var baryPDF = new Float64Array(BINS);
        for (var j = 0; j < NQ; j++) {
            var bin = Math.floor((baryQ[j] - X_MIN) / DX);
            if (bin >= 0 && bin < BINS) baryPDF[bin] += 1.0 / NQ / DX;
        }

        // Smooth
        return smooth(baryPDF, 3);
    }

    function smooth(arr, passes) {
        var out = new Float64Array(arr);
        for (var p = 0; p < passes; p++) {
            var tmp = new Float64Array(BINS);
            for (var i = 0; i < BINS; i++) {
                var a = i > 0 ? out[i - 1] : out[i];
                var b = out[i];
                var c = i < BINS - 1 ? out[i + 1] : out[i];
                tmp[i] = a * 0.2 + b * 0.6 + c * 0.2;
            }
            out = tmp;
        }
        return out;
    }

    // --- PARTICLES ---
    function sampleFromPDF(pdf) {
        var r = Math.random();
        var cumul = 0;
        for (var i = 0; i < BINS; i++) {
            cumul += pdf[i] * DX;
            if (cumul >= r) return X_MIN + (i + Math.random()) * DX;
        }
        return X_MIN + BINS * DX * 0.5;
    }

    function spawnParticle() {
        var srcIdx = Math.floor(Math.random() * pdfs.length);
        var srcX = sampleFromPDF(pdfs[srcIdx]);
        var srcBin = Math.floor((srcX - X_MIN) / DX);
        if (srcBin < 0) srcBin = 0;
        if (srcBin >= BINS) srcBin = BINS - 1;
        var srcY = pdfs[srcIdx][srcBin];

        var tgtX = sampleFromPDF(targetBary || currentBary);
        var tgtBin = Math.floor((tgtX - X_MIN) / DX);
        if (tgtBin < 0) tgtBin = 0;
        if (tgtBin >= BINS) tgtBin = BINS - 1;
        var tgtY = (targetBary || currentBary)[tgtBin];

        return {
            srcX: srcX, srcY: srcY,
            tgtX: tgtX, tgtY: tgtY,
            srcIdx: srcIdx,
            progress: Math.random() * 0.3,
            speed: 0.008 + Math.random() * 0.008
        };
    }

    function initParticles() {
        particles = [];
        if (reducedMotion) return;
        var count = window.innerWidth < 768 ? 18 : PARTICLE_COUNT;
        for (var i = 0; i < count; i++) particles.push(spawnParticle());
    }

    // --- CANVAS ---
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

    function getColors() {
        var s = getComputedStyle(document.documentElement);
        return {
            bg: s.getPropertyValue('--color-bg').trim() || '#ffffff',
            bgAlt: s.getPropertyValue('--color-bg-alt').trim() || '#f8fafc',
            text: s.getPropertyValue('--color-text').trim() || '#0f172a',
            border: s.getPropertyValue('--color-border').trim() || '#e2e8f0',
            textTertiary: s.getPropertyValue('--color-text-tertiary').trim() || '#94a3b8'
        };
    }

    function xToCanvas(x, w, pad) {
        return pad + (x - X_MIN) / (X_MAX - X_MIN) * (w - pad * 2);
    }

    function yToCanvas(y, h, pad, maxY) {
        return h - pad - (y / maxY) * (h - pad * 2);
    }

    function render() {
        var w = parseFloat(canvas.style.width);
        var h = parseFloat(canvas.style.height);
        var pad = 20;
        var colors = getColors();

        // find global max for y-scale
        var maxY = 0.01;
        for (var k = 0; k < pdfs.length; k++)
            for (var i = 0; i < BINS; i++) if (pdfs[k][i] > maxY) maxY = pdfs[k][i];
        if (currentBary)
            for (var i = 0; i < BINS; i++) if (currentBary[i] > maxY) maxY = currentBary[i];
        maxY *= 1.15;

        // clear
        ctx.clearRect(0, 0, w, h);

        // grid
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.5;
        for (var g = 0; g < 5; g++) {
            var gy = pad + g * (h - pad * 2) / 4;
            ctx.beginPath();
            ctx.moveTo(pad, gy);
            ctx.lineTo(w - pad, gy);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // lerp barycenter
        if (currentBary && targetBary && !reducedMotion) {
            for (var i = 0; i < BINS; i++) {
                currentBary[i] += (targetBary[i] - currentBary[i]) * LERP;
            }
        } else if (targetBary) {
            currentBary = new Float64Array(targetBary);
        }

        // draw input distributions
        for (var k = 0; k < pdfs.length; k++) {
            var col = DIST_COLORS[k];
            var rgba = 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',';

            // fill
            ctx.beginPath();
            ctx.moveTo(xToCanvas(X_MIN, w, pad), yToCanvas(0, h, pad, maxY));
            for (var i = 0; i < BINS; i++) {
                var x = X_MIN + (i + 0.5) * DX;
                ctx.lineTo(xToCanvas(x, w, pad), yToCanvas(pdfs[k][i], h, pad, maxY));
            }
            ctx.lineTo(xToCanvas(X_MAX, w, pad), yToCanvas(0, h, pad, maxY));
            ctx.closePath();
            ctx.fillStyle = rgba + '0.08)';
            ctx.fill();

            // stroke
            ctx.beginPath();
            for (var i = 0; i < BINS; i++) {
                var x = X_MIN + (i + 0.5) * DX;
                var cx = xToCanvas(x, w, pad);
                var cy = yToCanvas(pdfs[k][i], h, pad, maxY);
                if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
            }
            ctx.strokeStyle = rgba + '0.7)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // draw particles
        if (!reducedMotion) {
            for (var p = 0; p < particles.length; p++) {
                var pt = particles[p];
                pt.progress += pt.speed;
                if (pt.progress >= 1) {
                    particles[p] = spawnParticle();
                    continue;
                }
                var t = pt.progress;
                var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

                var sx = xToCanvas(pt.srcX, w, pad);
                var sy = yToCanvas(pt.srcY, h, pad, maxY);
                var tx = xToCanvas(pt.tgtX, w, pad);
                var ty = yToCanvas(pt.tgtY, h, pad, maxY);
                var midY = Math.min(sy, ty) - 30;

                var px = sx + (tx - sx) * ease;
                var py = sy + (midY - sy) * 2 * ease * (1 - ease) + (ty - sy) * ease * ease;

                var col = DIST_COLORS[pt.srcIdx];
                var alpha = Math.sin(t * Math.PI) * 0.6;
                ctx.beginPath();
                ctx.arc(px, py, 2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(' + col.r + ',' + col.g + ',' + col.b + ',' + alpha + ')';
                ctx.fill();
            }
        }

        // draw barycenter
        if (currentBary) {
            // glow
            ctx.beginPath();
            for (var i = 0; i < BINS; i++) {
                var x = X_MIN + (i + 0.5) * DX;
                var cx = xToCanvas(x, w, pad);
                var cy = yToCanvas(currentBary[i], h, pad, maxY);
                if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
            }
            ctx.strokeStyle = 'rgba(99,102,241,0.25)';
            ctx.lineWidth = 8;
            ctx.stroke();

            // fill
            ctx.beginPath();
            ctx.moveTo(xToCanvas(X_MIN, w, pad), yToCanvas(0, h, pad, maxY));
            for (var i = 0; i < BINS; i++) {
                var x = X_MIN + (i + 0.5) * DX;
                ctx.lineTo(xToCanvas(x, w, pad), yToCanvas(currentBary[i], h, pad, maxY));
            }
            ctx.lineTo(xToCanvas(X_MAX, w, pad), yToCanvas(0, h, pad, maxY));
            ctx.closePath();
            ctx.fillStyle = 'rgba(99,102,241,0.12)';
            ctx.fill();

            // line
            ctx.beginPath();
            for (var i = 0; i < BINS; i++) {
                var x = X_MIN + (i + 0.5) * DX;
                var cx = xToCanvas(x, w, pad);
                var cy = yToCanvas(currentBary[i], h, pad, maxY);
                if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
            }
            ctx.strokeStyle = colors.text;
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }

        // axis labels
        ctx.font = '10px ' + getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim();
        ctx.fillStyle = colors.textTertiary;
        ctx.textAlign = 'right';
        ctx.fillText('density', w - pad, pad + 10);

        animId = requestAnimationFrame(render);
    }

    // --- UI ---
    function buildLegend(names) {
        var el = document.getElementById('wb-legend');
        if (!el) return;
        var labels = names || ['Distribution A', 'Distribution B', 'Distribution C'];
        var html = '';
        for (var i = 0; i < DIST_COLORS.length; i++) {
            var c = DIST_COLORS[i];
            html += '<div class="wb-legend-item">';
            html += '<span class="wb-legend-dot" style="background:rgb(' + c.r + ',' + c.g + ',' + c.b + ')"></span>';
            html += labels[i];
            html += '</div>';
        }
        html += '<div class="wb-legend-item">';
        html += '<span class="wb-legend-dot" style="background:var(--color-text);"></span>';
        html += 'Barycenter';
        html += '</div>';
        el.innerHTML = html;
    }

    function buildControls(names) {
        var el = document.getElementById('wb-controls');
        if (!el) return;
        var labels = names || ['Distribution A', 'Distribution B', 'Distribution C'];
        var html = '';
        for (var i = 0; i < weights.length; i++) {
            var val = Math.round(weights[i] * 100);
            html += '<div class="wb-control-row">';
            html += '<span class="wb-control-label">' + labels[i] + '</span>';
            html += '<input type="range" class="wb-control-slider" min="0" max="100" value="' + val + '" data-idx="' + i + '" aria-label="Weight for ' + labels[i] + '">';
            html += '<span class="wb-control-value">' + weights[i].toFixed(2) + '</span>';
            html += '</div>';
        }
        el.innerHTML = html;

        var sliders = el.querySelectorAll('.wb-control-slider');
        for (var s = 0; s < sliders.length; s++) {
            sliders[s].addEventListener('input', onSliderChange);
        }
    }

    function onSliderChange() {
        var sliders = document.querySelectorAll('#wb-controls .wb-control-slider');
        var raw = [];
        var total = 0;
        for (var i = 0; i < sliders.length; i++) {
            raw.push(parseFloat(sliders[i].value));
            total += raw[i];
        }
        if (total === 0) total = 1;
        for (var i = 0; i < raw.length; i++) {
            weights[i] = raw[i] / total;
        }
        updateValues();
        recomputeBarycenter();

        // clear active preset
        var btns = document.querySelectorAll('.wb-preset-btn');
        for (var b = 0; b < btns.length; b++) btns[b].classList.remove('active');
    }

    function updateValues() {
        var vals = document.querySelectorAll('#wb-controls .wb-control-value');
        for (var i = 0; i < vals.length; i++) {
            vals[i].textContent = weights[i].toFixed(2);
        }
    }

    function recomputeBarycenter() {
        targetBary = computeBarycenter(pdfs, weights);
        if (!currentBary) currentBary = new Float64Array(targetBary);
        initParticles();
    }

    function applyPreset(name) {
        var p = PRESETS[name];
        if (!p) return;
        activePreset = name;

        pdfs = [];
        for (var i = 0; i < p.dists.length; i++) {
            pdfs.push(buildPDF(p.dists[i]));
        }
        weights = p.weights.slice();
        recomputeBarycenter();
        buildLegend(p.names);
        buildControls(p.names);

        // update description
        var descEl = document.getElementById('wb-preset-desc');
        if (descEl) descEl.textContent = p.desc;

        var btns = document.querySelectorAll('.wb-preset-btn');
        for (var b = 0; b < btns.length; b++) {
            btns[b].classList.toggle('active', btns[b].dataset.preset === name);
        }
    }

    function bindPresets() {
        var btns = document.querySelectorAll('.wb-preset-btn');
        for (var b = 0; b < btns.length; b++) {
            btns[b].addEventListener('click', function () {
                applyPreset(this.dataset.preset);
            });
        }
    }

    // --- INIT ---
    function init() {
        canvas = document.getElementById('wb-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');

        resizeCanvas();
        applyPreset('energy');
        buildLegend();
        bindPresets();

        // resize
        var resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(resizeCanvas, 150);
        });

        // theme changes
        new MutationObserver(function () {
            // colors refresh on next frame automatically
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // only animate when visible
        var obs = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    if (!animId) render();
                } else {
                    if (animId) { cancelAnimationFrame(animId); animId = null; }
                }
            });
        }, { threshold: 0.05 });
        obs.observe(demo);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
