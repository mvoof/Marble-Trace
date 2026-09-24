/**
 * Marble Trace Site V2 - Navbar & Mobile Drawer Controller
 * Handles mobile menu toggle, scroll states, active link highlighting, and a11y.
 */

(function () {
  'use strict';

  function initNavbar() {
    const header = document.querySelector('.site-header');
    const toggleBtn = document.querySelector('.mobile-toggle');
    const drawer = document.querySelector('.mobile-drawer');
    const backdrop = document.querySelector('.mobile-backdrop');
    const closeBtn = document.querySelector('.drawer-close');
    const drawerLinks = document.querySelectorAll(
      '.drawer-nav-link, .drawer-cta a'
    );
    const desktopLinks = document.querySelectorAll('.nav-desktop .nav-link');
    const sections = document.querySelectorAll('section[id]');

    let isOpen = false;

    // Open Mobile Drawer
    function openDrawer() {
      if (isOpen) return;
      isOpen = true;
      toggleBtn?.setAttribute('aria-expanded', 'true');
      drawer?.classList.add('is-open');
      backdrop?.classList.add('is-open');
      document.body.classList.add('mobile-menu-open');
      closeBtn?.focus();
    }

    // Close Mobile Drawer
    function closeDrawer() {
      if (!isOpen) return;
      isOpen = false;
      toggleBtn?.setAttribute('aria-expanded', 'false');
      drawer?.classList.remove('is-open');
      backdrop?.classList.remove('is-open');
      document.body.classList.remove('mobile-menu-open');
      toggleBtn?.focus();
    }

    // Toggle Mobile Drawer
    function toggleDrawer() {
      if (isOpen) {
        closeDrawer();
      } else {
        openDrawer();
      }
    }

    // Event Bindings for Drawer
    toggleBtn?.addEventListener('click', toggleDrawer);
    closeBtn?.addEventListener('click', closeDrawer);
    backdrop?.addEventListener('click', closeDrawer);

    drawerLinks.forEach((link) => {
      link.addEventListener('click', () => {
        closeDrawer();
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        closeDrawer();
      }
    });

    // Handle Header background & blur on scroll
    function onScroll() {
      if (!header) return;
      if (window.scrollY > 20) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Active Section Tracking with IntersectionObserver
    if ('IntersectionObserver' in window && sections.length > 0) {
      const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0,
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            if (!id) return;

            // Update desktop links
            desktopLinks.forEach((link) => {
              const href = link.getAttribute('href');
              if (href === `#${id}`) {
                link.classList.add('is-active');
              } else {
                link.classList.remove('is-active');
              }
            });

            // Update drawer links
            drawerLinks.forEach((link) => {
              const href = link.getAttribute('href');
              if (href === `#${id}`) {
                link.classList.add('is-active');
              } else {
                link.classList.remove('is-active');
              }
            });
          }
        });
      }, observerOptions);

      sections.forEach((section) => observer.observe(section));
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavbar);
  } else {
    initNavbar();
  }
})();
