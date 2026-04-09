// =============================================
// NAVBAR — scroll effect & active link
// =============================================

const navbar = document.getElementById('navbar');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.section, .hero');

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
});

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

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;

        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        pubItems.forEach(item => {
            if (filter === 'all' || item.dataset.tags.includes(filter)) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });
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
// ANTI-SPAM EMAIL
// =============================================

function openMail(e) {
    e.preventDefault();
    const u = 'tuanome';       // ← your username before @
    const d = 'unitus.it';     // ← domain
    window.location.href = 'mai' + 'lto:' + u + '@' + d;
}

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

document.querySelectorAll('.section-header, .publication-item, .project-card, .about-card, .timeline-item, .contact-card, .about-text, .hero-content').forEach(el => {
    el.classList.add('fade-in');
    observer.observe(el);
});
