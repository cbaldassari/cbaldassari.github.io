// =============================================
// THEME TOGGLE (dark / light)
// =============================================

(function() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();

function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const next = isDark() ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        // Reset photo state
        setPhotoState(false);
    });
}

// =============================================
// NAVBAR — scroll effect & active link
// =============================================

const navbar = document.getElementById('navbar');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.section, .hero');
const progressBar = document.getElementById('progress-bar');
const backToTop = document.getElementById('back-to-top');
const heroOrb1 = document.querySelector('.hero-orb-1');
const heroOrb2 = document.querySelector('.hero-orb-2');
const hero = document.querySelector('.hero');
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 10);

    let current = '';
    sections.forEach(section => {
        const top = section.offsetTop - 120;
        if (window.scrollY >= top) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + current) {
            link.classList.add('active');
        }
    });

    // Reading progress bar
    if (progressBar) {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        progressBar.style.width = progress + '%';
    }

    // Back to top button
    if (backToTop) {
        backToTop.classList.toggle('visible', window.scrollY > 400);
    }

    // Hero orb parallax (desktop only, respects reduced motion)
    if (!isTouch && !prefersReducedMotion && heroOrb1 && heroOrb2) {
        const sy = window.scrollY;
        const heroHeight = hero ? hero.offsetHeight : 800;
        if (sy < heroHeight * 1.2) {
            heroOrb1.style.translate = '0 ' + (sy * 0.08) + 'px';
            heroOrb2.style.translate = '0 ' + (sy * -0.05) + 'px';
        }
    }
});

// Back to top click
if (backToTop) {
    backToTop.addEventListener('click', () => {
        backToTop.classList.add('clicked');
        backToTop.blur();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    backToTop.addEventListener('animationend', () => {
        backToTop.classList.remove('clicked');
    });
}

// =============================================
// MOBILE MENU
// =============================================

const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');

navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('open');
    navToggle.classList.toggle('active');
});

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        navToggle.classList.remove('active');
    });
});

// =============================================
// PUBLICATION FILTERS
// =============================================

const filterBtns = document.querySelectorAll('.pub-filter');
const pubItems = document.querySelectorAll('.publication-item');
let activeFilter = 'all';

function filterPublications() {
    const searchTerm = (document.getElementById('pub-search')?.value || '').toLowerCase();
    pubItems.forEach(item => {
        const matchesFilter = activeFilter === 'all' || item.dataset.tags.includes(activeFilter);
        const text = item.textContent.toLowerCase();
        const matchesSearch = !searchTerm || text.includes(searchTerm);
        item.classList.toggle('hidden', !(matchesFilter && matchesSearch));
    });
}

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterPublications();
    });
});

// =============================================
// PUBLICATION SEARCH
// =============================================

const pubSearch = document.getElementById('pub-search');
if (pubSearch) {
    pubSearch.addEventListener('input', filterPublications);
}

// =============================================
// BIBTEX COPY
// =============================================

document.querySelectorAll('.bibtex-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const bibtex = btn.dataset.bibtex;
        if (bibtex) {
            navigator.clipboard.writeText(bibtex).then(() => {
                btn.classList.add('copied');
                const orig = btn.lastChild.textContent;
                btn.lastChild.textContent = typeof t === 'function' ? t('pub.bibtex.copied') : 'Copied';
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.lastChild.textContent = ' BibTeX';
                }, 2000);
            });
        }
    });
});

// =============================================
// PUBLICATION ABSTRACT TOGGLE
// =============================================

document.querySelectorAll('.publication-abstract').forEach(el => {
    el.addEventListener('click', () => {
        el.classList.toggle('expanded');
    });
});

// =============================================
// FADE-IN ON SCROLL
// =============================================

const observerOptions = {
    threshold: 0.08,
    rootMargin: '0px 0px -60px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.section-header, .publication-item, .project-card, .about-card, .timeline-item, .contact-card, .about-text, .hero-content, .stat-item').forEach(el => {
    el.classList.add('fade-in');
    observer.observe(el);
});

// =============================================
// STATS COUNTER
// =============================================

(function initStats() {
    const pubCount = document.querySelectorAll('.publication-item').length;

    const years = [];
    document.querySelectorAll('.pub-year-badge').forEach(el => {
        const y = parseInt(el.textContent, 10);
        if (!isNaN(y)) years.push(y);
    });
    const yearSpan = years.length > 0 ? Math.max(...years) - Math.min(...years) : 0;

    const venues = new Set();
    document.querySelectorAll('.publication-venue').forEach(el => {
        const name = el.textContent.split(',')[0].trim();
        if (name) venues.add(name);
    });
    const venueCount = venues.size;

    const elPub = document.getElementById('stat-publications');
    const elYears = document.getElementById('stat-years');
    const elVenues = document.getElementById('stat-venues');

    function animateCounter(el, target, duration) {
        if (!el || target === 0) return;
        if (prefersReducedMotion) { el.textContent = target; return; }
        let start = null;
        function step(ts) {
            if (!start) start = ts;
            const p = Math.min((ts - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(eased * target);
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    const statsBar = document.getElementById('stats-bar');
    if (statsBar) {
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(elPub, pubCount, 1200);
                    animateCounter(elYears, yearSpan, 1000);
                    animateCounter(elVenues, venueCount, 800);
                    statsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        statsObserver.observe(statsBar);
    }
})();

// =============================================
// PROFILE PHOTO TOGGLE
// =============================================

const photoToggle = document.getElementById('photo-toggle');
const heroTagline = document.getElementById('hero-tagline');

// Add .has-hover only on real pointer devices — never on touch
if (!isTouch) {
    document.documentElement.classList.add('has-hover');
}

function getTagline(swapped) {
    const dark = isDark();
    const light = 'The interesting part is always in the noise.';
    const darkT = 'The noise is always in the interesting part.';
    return (dark !== swapped) ? darkT : light;
}

function updateTagline() {
    if (heroTagline) {
        const tapped = photoToggle && photoToggle.classList.contains('tapped');
        heroTagline.textContent = getTagline(tapped);
    }
}

// Set initial tagline
updateTagline();

function setPhotoState(swapped) {
    if (photoToggle) {
        photoToggle.classList.toggle('tapped', swapped);
    }
    if (heroTagline) heroTagline.textContent = getTagline(swapped);
}

if (photoToggle) {
    // On touch: disable transition so swap is instant (avoids compositor stale layers)
    if (isTouch) {
        photoToggle.querySelectorAll('img').forEach(img => {
            img.style.transition = 'none';
        });
    }

    if (!isTouch) {
        // Desktop only: hover swaps tagline
        photoToggle.addEventListener('mouseenter', () => {
            if (heroTagline) heroTagline.textContent = getTagline(true);
        });
        photoToggle.addEventListener('mouseleave', () => {
            if (heroTagline) heroTagline.textContent = getTagline(false);
        });
    } else {
        // Touch devices: tap to toggle
        photoToggle.addEventListener('click', () => {
            const tapped = photoToggle.classList.contains('tapped');
            setPhotoState(!tapped);
        });
    }
}

// =============================================
// EXPORT ALL BIBTEX
// =============================================

const exportBibtex = document.getElementById('export-bibtex');
if (exportBibtex) {
    exportBibtex.addEventListener('click', () => {
        const entries = [];
        document.querySelectorAll('.bibtex-btn').forEach(btn => {
            if (btn.dataset.bibtex) entries.push(btn.dataset.bibtex);
        });
        if (entries.length === 0) return;
        const content = entries.join('\n\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'baldassari_publications.bib';
        a.click();
        URL.revokeObjectURL(url);
    });
}

// =============================================
// KEYBOARD SHORTCUTS
// =============================================

const shortcutsModal = document.getElementById('shortcuts-modal');

document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
            e.target.blur();
        }
        return;
    }

    switch (e.key) {
        case 'd':
        case 'D':
            if (themeToggle) themeToggle.click();
            break;
        case 't':
        case 'T':
            window.scrollTo({ top: 0, behavior: 'smooth' });
            break;
        case '/':
            e.preventDefault();
            if (pubSearch) {
                pubSearch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => pubSearch.focus(), 400);
            }
            break;
        case '?':
            if (shortcutsModal) shortcutsModal.classList.toggle('visible');
            break;
        case 'Escape':
            if (shortcutsModal) shortcutsModal.classList.remove('visible');
            break;
    }
});

// Close modal on backdrop click
if (shortcutsModal) {
    shortcutsModal.addEventListener('click', (e) => {
        if (e.target === shortcutsModal) {
            shortcutsModal.classList.remove('visible');
        }
    });
}
