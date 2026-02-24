/**
 * UI Enhancements for KitaNime
 * Provides smooth animations, dark mode toggle, and UX improvements
 */

(function () {
    'use strict';

    // Dark mode toggle
    function initDarkMode() {
        const darkModeToggle = document.querySelector('[data-dark-mode-toggle]');
        const html = document.documentElement;

        // Check saved preference or system preference
        const savedMode = localStorage.getItem('darkMode');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedMode === 'dark' || (!savedMode && prefersDark)) {
            html.classList.add('dark');
        }

        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', function () {
                html.classList.toggle('dark');
                localStorage.setItem('darkMode', html.classList.contains('dark') ? 'dark' : 'light');
            });
        }
    }

    // Smooth scroll for anchor links
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;

                const target = document.querySelector(targetId);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    // Lazy load images
    function initLazyLoad() {
        if ('IntersectionObserver' in window) {
            const lazyImages = document.querySelectorAll('img[data-src]');
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                });
            });

            lazyImages.forEach(img => imageObserver.observe(img));
        }
    }

    // Mobile menu toggle
    function initMobileMenu() {
        const menuToggle = document.querySelector('[data-menu-toggle]');
        const mobileMenu = document.querySelector('[data-mobile-menu]');

        if (menuToggle && mobileMenu) {
            menuToggle.addEventListener('click', function () {
                mobileMenu.classList.toggle('hidden');
                this.setAttribute('aria-expanded',
                    this.getAttribute('aria-expanded') === 'true' ? 'false' : 'true'
                );
            });
        }
    }

    // Back to top button
    function initBackToTop() {
        const backToTop = document.querySelector('[data-back-to-top]');

        if (backToTop) {
            window.addEventListener('scroll', function () {
                if (window.scrollY > 300) {
                    backToTop.classList.remove('opacity-0', 'pointer-events-none');
                    backToTop.classList.add('opacity-100');
                } else {
                    backToTop.classList.add('opacity-0', 'pointer-events-none');
                    backToTop.classList.remove('opacity-100');
                }
            });

            backToTop.addEventListener('click', function () {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }

    // Initialize all enhancements
    function init() {
        initDarkMode();
        initSmoothScroll();
        initLazyLoad();
        initMobileMenu();
        initBackToTop();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
                      
