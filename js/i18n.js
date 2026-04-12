// =============================================
// INTERNATIONALIZATION (EN / IT)
// =============================================

const translations = {
    en: {
        // Nav
        'nav.about': 'About',
        'nav.publications': 'Publications',
        'nav.cv': 'CV',
        'nav.contact': 'Get in touch',
        // Hero
        'hero.badge': 'Researcher',
        'hero.tagline.light': 'The interesting part is always in the noise.',
        'hero.tagline.dark': 'The noise is always in the interesting part.',
        'hero.cta.research': 'Explore research',
        'hero.cta.contact': 'Contact me',
        'hero.scroll': 'scroll',
        // About
        'about.label': '01 / About',
        'about.title': 'Background',
        'about.p1': 'I\'m a researcher at the <strong>University of Tuscia</strong> in Viterbo, with a physics degree from <strong>Sapienza</strong> in Rome. I started out in consulting, working on fraud detection, predictive models and analytics for banks and media companies, then eventually followed my curiosity into academia.',
        'about.p2': 'Today I work on unsupervised methods that connect time series and graph theory, mostly applied to energy and financial markets. I like finding structure where it\'s not obvious there is any.',
        // Publications
        'pub.label': '02 / Research',
        'pub.title': 'Publications',
        'pub.desc': 'Peer-reviewed research in machine learning, complex networks and quantitative finance.',
        'pub.scholar': 'View on Google Scholar &rarr;',
        'pub.filter.all': 'All',
        'pub.filter.ml': 'Machine Learning',
        'pub.filter.innovation': 'Innovation',
        'pub.search': 'Search publications...',
        'pub.bibtex.copied': 'BibTeX copied',
        // CV
        'cv.label': '03 / Experience',
        'cv.title': 'Curriculum Vitae',
        // Contact
        'contact.label': '04 / Connect',
        'contact.title': 'Let\'s collaborate',
        'contact.desc': 'Interested in collaborating or just exchanging ideas? Reach out.',
        'contact.scholar.hint': 'Publications & citations',
        // Footer
        'footer.privacy': 'Privacy Policy',
        // Back to top
        'backtotop.label': 'Back to top',
        // Photo tooltip
        'photo.tooltip': 'Hover to switch',
        'photo.tooltip.mobile': 'Tap to switch',
        // Keyboard shortcuts
        'shortcuts.hint': 'Press ? for shortcuts'
    },
    it: {
        // Nav
        'nav.about': 'Chi sono',
        'nav.publications': 'Pubblicazioni',
        'nav.cv': 'CV',
        'nav.contact': 'Contattami',
        // Hero
        'hero.badge': 'Ricercatore',
        'hero.tagline.light': 'La parte interessante è sempre nel rumore.',
        'hero.tagline.dark': 'Il rumore è sempre nella parte interessante.',
        'hero.cta.research': 'Esplora la ricerca',
        'hero.cta.contact': 'Contattami',
        'hero.scroll': 'scorri',
        // About
        'about.label': '01 / Chi sono',
        'about.title': 'Background',
        'about.p1': 'Sono un ricercatore presso l\'<strong>Università della Tuscia</strong> a Viterbo, con una laurea in fisica alla <strong>Sapienza</strong> di Roma. Ho iniziato nella consulenza, lavorando su rilevazione frodi, modelli predittivi e analytics per banche e aziende media, per poi seguire la mia curiosità verso il mondo accademico.',
        'about.p2': 'Oggi lavoro su metodi non supervisionati che collegano serie temporali e teoria dei grafi, applicati principalmente ai mercati energetici e finanziari. Mi piace trovare struttura dove non è evidente che ce ne sia.',
        // Publications
        'pub.label': '02 / Ricerca',
        'pub.title': 'Pubblicazioni',
        'pub.desc': 'Ricerca peer-reviewed in machine learning, reti complesse e finanza quantitativa.',
        'pub.scholar': 'Vedi su Google Scholar &rarr;',
        'pub.filter.all': 'Tutti',
        'pub.filter.ml': 'Machine Learning',
        'pub.filter.innovation': 'Innovazione',
        'pub.search': 'Cerca pubblicazioni...',
        'pub.bibtex.copied': 'BibTeX copiato',
        // CV
        'cv.label': '03 / Esperienza',
        'cv.title': 'Curriculum Vitae',
        // Contact
        'contact.label': '04 / Contatti',
        'contact.title': 'Collaboriamo',
        'contact.desc': 'Interessato a collaborare o semplicemente scambiare idee? Scrivimi.',
        'contact.scholar.hint': 'Pubblicazioni e citazioni',
        // Footer
        'footer.privacy': 'Privacy Policy',
        // Back to top
        'backtotop.label': 'Torna su',
        // Photo tooltip
        'photo.tooltip': 'Passa sopra per cambiare',
        'photo.tooltip.mobile': 'Tocca per cambiare',
        // Keyboard shortcuts
        'shortcuts.hint': 'Premi ? per le scorciatoie'
    }
};

function t(key) {
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    return translations[lang][key] || translations['en'][key] || key;
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = t(key);
        if (el.hasAttribute('data-i18n-html')) {
            el.innerHTML = val;
        } else {
            el.textContent = val;
        }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    // Update tagline
    const tagline = document.getElementById('hero-tagline');
    if (tagline) {
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        tagline.textContent = dark ? t('hero.tagline.dark') : t('hero.tagline.light');
    }
    // Update photo tooltip
    const tooltip = document.querySelector('.photo-tooltip');
    if (tooltip) {
        tooltip.textContent = ('ontouchstart' in window) ? t('photo.tooltip.mobile') : t('photo.tooltip');
    }
    // Update html lang
    const lang = document.documentElement.getAttribute('data-lang') || 'en';
    document.documentElement.setAttribute('lang', lang);
}
