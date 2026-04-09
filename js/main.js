// =============================================
// NAVBAR — scroll effect & active link
// =============================================

const navbar = document.getElementById('navbar');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.section, .hero');

window.addEventListener('scroll', () => {
    // Add shadow on scroll
    navbar.classList.toggle('scrolled', window.scrollY > 10);

    // Highlight active section in nav
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
    // Animate hamburger to X
    navToggle.classList.toggle('active');
});

// Close menu when clicking a link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        navToggle.classList.remove('active');
    });
});

// =============================================
// FADE-IN ON SCROLL
// =============================================

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// =============================================
// ANTI-SPAM EMAIL
// =============================================
// L'indirizzo è spezzato in parti e assemblato solo al click,
// così i bot che scansionano l'HTML non lo trovano.

function openMail(e) {
    e.preventDefault();
    const u = 'tuanome';       // ← parte prima della @
    const d = 'unitus.it';     // ← dominio
    window.location.href = 'mai' + 'lto:' + u + '@' + d;
}

// =============================================
// PUBLICATION ABSTRACT TOGGLE
// =============================================

document.querySelectorAll('.publication-abstract').forEach(el => {
    el.addEventListener('click', () => {
        el.classList.toggle('expanded');
    });
});

// Apply fade-in to section content
document.querySelectorAll('.section-title, .publication-item, .project-card, .video-card, .teaching-item, .timeline-item, .contact-card, .about-content, .hero-content').forEach(el => {
    el.classList.add('fade-in');
    observer.observe(el);
});
