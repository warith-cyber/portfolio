
(function(){
  // Core elements and storage key
  const root = document.documentElement;
  const themeBtn = document.getElementById('themeToggle');
  const key = 'prefers-theme';

  // Theme handling (system preference + manual toggle)
  const setTheme = (t, persist = true)=>{
    root.dataset.theme = t;
    themeBtn?.setAttribute(
      'aria-label',
      t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    );
    if (persist) {
      localStorage.setItem(key, t);
    }
  };
  const saved = localStorage.getItem(key);
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(saved || (systemPrefersDark ? 'dark' : 'light'), Boolean(saved));
  themeBtn?.addEventListener('click', ()=>{
    const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(t);
  });

  // Footer year
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Mobile navigation toggle
  const mobileBtn = document.getElementById('mobileMenu');
  const navList = document.getElementById('navList');
  mobileBtn?.addEventListener('click', ()=>{
    if (!navList) return;
    const open = navList.classList.toggle('open');
    mobileBtn.setAttribute('aria-expanded', String(open));
  });

  // Gallery lightbox preview
  const galleryImages = Array.from(document.querySelectorAll('.gallery-grid .gallery-item img'));
  if (galleryImages.length) {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Image preview');
    lightbox.innerHTML = `
      <button type="button" class="lightbox-close" aria-label="Close image preview">&times;</button>
      <figure class="lightbox-figure">
        <img class="lightbox-image" alt="" />
        <figcaption class="lightbox-caption"></figcaption>
      </figure>
    `;
    document.body.appendChild(lightbox);

    const lightboxImage = lightbox.querySelector('.lightbox-image');
    const lightboxCaption = lightbox.querySelector('.lightbox-caption');
    const closeBtn = lightbox.querySelector('.lightbox-close');
    let activeThumb = null;

    const closeLightbox = ()=>{
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
      closeBtn?.blur();
      activeThumb?.focus();
    };

    const openLightbox = (img)=>{
      if (!lightboxImage || !lightboxCaption) return;
      activeThumb = img;
      lightboxImage.src = img.currentSrc || img.src;
      lightboxImage.alt = img.alt || 'Gallery image';
      lightboxCaption.textContent = img.alt || '';
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
      closeBtn?.focus();
    };

    galleryImages.forEach((img)=>{
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', `Open image: ${img.alt || 'Gallery image'}`);
      img.addEventListener('click', ()=> openLightbox(img));
      img.addEventListener('keydown', (event)=>{
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openLightbox(img);
        }
      });
    });

    closeBtn?.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (event)=>{
      if (event.target === lightbox) {
        closeLightbox();
      }
    });
    document.addEventListener('keydown', (event)=>{
      if (event.key === 'Escape' && lightbox.classList.contains('open')) {
        closeLightbox();
      }
    });
  }
})();
