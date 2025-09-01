/* app.js — MSA Tech Store
   Features:
   - Client-only demo store + admin dashboard
   - Admin password (default provided by user)
   - LocalStorage persistence (state saved under LS_KEY)
   - Slider, categories, products, deals, services, faq, blog, messages
   - Image uploads saved as base64 (readFileAsDataURL)
   - Admin login modal -> slide-in admin dashboard (no glitch)
   - Export / import JSON for backup
   - Toasts, debug helpers
*/

/* -------------------------
   CONFIG / KEYS
   ------------------------- */
(function () {
  'use strict';

  const LS_KEY = 'msa_store_v2';
  const LS_ADMIN_PASS_KEY = 'msa_admin_pass_v2';
  const DEFAULT_ADMIN_PASSWORD = '6996art85WT?#20630'; // user-provided default

  /* -------------------------
     Utilities
     ------------------------- */
  function $(sel, ctx = document) { return ctx.querySelector(sel); }
  function $all(sel, ctx = document) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function uid(prefix = 'id') { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }
  function log(...args) { console.log('[MSA]', ...args); }
  function saveToLS(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function readFromLS(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  function toast(message, ms = 2200) {
    const root = $('#toastRoot');
    if (!root) { console.warn('Toast root not found'); return; }
    const n = document.createElement('div');
    n.className = 'toast';
    n.textContent = message;
    root.appendChild(n);
    setTimeout(() => {
      n.style.opacity = '0';
      setTimeout(() => n.remove(), 360);
    }, ms);
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function safeParseNumber(str) {
    if (!str) return 0;
    const num = Number((str + '').replace(/[^\d.-]/g, ''));
    return isNaN(num) ? 0 : num;
  }

  /* -------------------------
     DEFAULT STATE
     ------------------------- */
  const DEFAULT_STATE = {
    shopInfo: {
      title: 'MSA Tech Store',
      tagline: 'Hardware • Services • Support',
      phone: '0958096302',
      email: 'support@msashop.com',
      address: '123 Tech Street',
      delivery: 'We deliver across Syria',
      footerText: 'MSA Tech Store — your trusted local IT partner.',
      logo: null
    },
    categories: ['pc', 'parts', 'accessories', 'phones'],
    slider: [
      { id: uid('s'), title: 'Gaming PCs', desc: 'High FPS builds ready to ship', img: null },
      { id: uid('s'), title: 'Creator Workstations', desc: 'Render and edit fast', img: null },
      { id: uid('s'), title: 'Monitors & Peripherals', desc: 'High refresh & precision', img: null }
    ],
    products: [
      { id: uid('p'), title: 'MSA Fury — i7 / 32GB / 1TB', category: 'pc', price: 'USD 1,350', oldPrice: 'USD 1,499', desc: '1440p gaming build', img: null },
      { id: uid('p'), title: 'MSA Studio — Ryzen 9 / 64GB', category: 'pc', price: 'USD 2,450', oldPrice: '', desc: 'Content creation workstation', img: null },
      { id: uid('p'), title: 'MSA RTX 4070 Ti — 12GB', category: 'parts', price: 'USD 899', oldPrice: 'USD 999', desc: 'GPU for gaming & rendering', img: null }
    ],
    deals: [],
    services: [
      { id: uid('sv'), title: 'Custom PC Builds', desc: 'Tailored configs for gaming & work' },
      { id: uid('sv'), title: 'On-site Support', desc: 'Business plans & emergency visits' },
      { id: uid('sv'), title: 'Data Recovery', desc: 'Secure data recovery attempts' }
    ],
    faq: [
      { id: uid('f'), q: 'Do you offer international shipping?', a: 'Yes — we ship to supported regions. Contact us for rates.' },
      { id: uid('f'), q: 'What is your return policy?', a: 'Returns accepted within 14 days (conditions apply).' }
    ],
    blog: [
      { id: uid('b'), title: 'Top 5 Laptops for 2025', excerpt: 'Our picks for students & creators.' }
    ],
    laptops: [],     // laptops-for-sale section
    messages: [],    // contact messages
    settings: {
      autoSave: true
    }
  };

  /* -------------------------
     STATE MANAGEMENT
     ------------------------- */
  let state = null;
  function loadState() {
    const raw = readFromLS(LS_KEY);
    if (!raw) {
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      saveState();
      return;
    }
    // Merge missing keys from DEFAULT_STATE
    state = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), raw);
  }
  function saveState() {
    saveToLS(LS_KEY, state);
  }

  /* -------------------------
     ADMIN PASSWORD
     ------------------------- */
  function ensureAdminPassword() {
    const stored = localStorage.getItem(LS_ADMIN_PASS_KEY);
    if (!stored) {
      // store default password
      localStorage.setItem(LS_ADMIN_PASS_KEY, DEFAULT_ADMIN_PASSWORD);
      log('Admin password set to default (stored locally).');
    }
  }
  function checkAdminPassword(candidate) {
    return candidate === localStorage.getItem(LS_ADMIN_PASS_KEY);
  }
  function changeAdminPassword(newPass) {
    localStorage.setItem(LS_ADMIN_PASS_KEY, newPass);
    toast('Admin password updated (stored locally).');
  }
  function resetAdminPasswordToDefault() {
    localStorage.setItem(LS_ADMIN_PASS_KEY, DEFAULT_ADMIN_PASSWORD);
    toast('Admin password reset to default.');
  }

  /* -------------------------
     DOM REFS (some common refs)
     ------------------------- */
  const refs = {};
  const refIds = [
    'carouselSlides', 'carouselDots', 'heroCarousel', 'productsGrid',
    'categoryList', 'filterCategory', 'searchProducts', 'sortProducts',
    'productsEmpty', 'laptopsGrid', 'dealsGrid', 'servicesGrid', 
    'blogGrid', 'faqGrid', 'testimonialsGrid', 'adminOpenBtn',
    'adminLoginModal', 'adminLoginForm', 'adminPassword', 'adminLoginClose',
    'adminDashboard', 'adminCloseBtn', 'adminLogoutBtn', 'slidesAdminList',
    'slideImageInput', 'slideTitleInput', 'slideSubtitleInput', 'addSlideAdminBtn',
    'clearSlidesAdminBtn', 'adminProductForm', 'adminProductTitle', 'adminProductCategory',
    'adminProductPrice', 'adminProductOldPrice', 'adminProductDesc', 'adminProductImage',
    'saveProductAdminBtn', 'newProductAdminBtn', 'adminProductsTable', 'addCategoryBtn',
    'newCategoryName', 'categoryAdminList', 'contactForm', 'contactName', 'contactEmail',
    'contactPhone', 'contactMessage', 'adminMessagesList', 'clearMessagesBtn',
    'exportMessagesBtn', 'changeAdminPassword', 'saveAdminPasswordBtn', 'resetAdminPasswordBtn',
    'adminShopTitleInput', 'adminShopSubtitleInput', 'adminPhoneInput', 'adminEmailInput',
    'adminAddressInput', 'adminDeliveryInput', 'saveShopInfo', 'adminSitePreview',
    'exportStoreBtn', 'importStoreFile', 'previewStoreBtn', 'debugDumpBtn', 'wipeStoreBtn',
    'mobileMenuBtn', 'navMenu'
  ];

  // Initialize refs safely
  function initRefs() {
    refIds.forEach(id => {
      refs[id] = document.getElementById(id);
    });
  }

  /* -------------------------
     RENDER FUNCTIONS
     ------------------------- */
  function renderShopInfo() {
    const info = state.shopInfo;
    $('#siteTitle').textContent = info.title || 'MSA Tech Store';
    $('#siteTag').textContent = info.tagline || 'Hardware • Services • Support';
    $('#heroHeadline').textContent = info.title || 'Modern IT hardware — built for performance';
    $('#heroSub').textContent = info.tagline || 'MSA brings reliable components, fast repairs and tailored IT services for gamers, creators and small businesses.';

    $('#infoPhone').textContent = info.phone || '';
    $('#infoEmail').textContent = info.email || '';
    $('#infoAddress').textContent = info.address || '';
    $('#infoDelivery').textContent = info.delivery || '';
    $('#footerPhone').textContent = info.phone || '';
    $('#footerEmail').textContent = info.email || '';
    $('#footerAddress').textContent = info.address || '';
    
    // admin inputs
    if (refs.adminShopTitleInput) refs.adminShopTitleInput.value = info.title || '';
    if (refs.adminShopSubtitleInput) refs.adminShopSubtitleInput.value = info.tagline || '';
    if (refs.adminPhoneInput) refs.adminPhoneInput.value = info.phone || '';
    if (refs.adminEmailInput) refs.adminEmailInput.value = info.email || '';
    if (refs.adminAddressInput) refs.adminAddressInput.value = info.address || '';
    if (refs.adminDeliveryInput) refs.adminDeliveryInput.value = info.delivery || '';
    if (refs.adminSitePreview) refs.adminSitePreview.textContent = `${info.title} — preview`;
  }

  /* ---------- Carousel ---------- */
  let carouselIndex = 0;
  let carouselTimer = null;
  function renderCarousel() {
    if (!refs.carouselSlides) return;
    refs.carouselSlides.innerHTML = '';
    refs.carouselDots.innerHTML = '';
    state.slider.forEach((s, idx) => {
      const slide = document.createElement('div');
      slide.className = 'carousel-slide';
      slide.setAttribute('role','group');
      slide.setAttribute('aria-label', `${idx+1} of ${state.slider.length}`);
      if (s.img) slide.style.background = `url(${s.img}) center/cover no-repeat`;
      slide.innerHTML = `<div><div class="title">${escapeHtml(s.title)}</div><div class="desc">${escapeHtml(s.desc||'')}</div></div>`;
      refs.carouselSlides.appendChild(slide);

      const dot = document.createElement('div');
      dot.className = 'dot';
      dot.dataset.index = idx;
      dot.addEventListener('click', () => setCarousel(idx));
      refs.carouselDots.appendChild(dot);
    });
    setCarousel(0);
    startCarouselTimer();
  }
  function setCarousel(i) {
    if (!state.slider.length) return;
    const slidesCount = Math.max(1, state.slider.length);
    carouselIndex = ((i % slidesCount) + slidesCount) % slidesCount;
    refs.carouselSlides.style.transform = `translateX(${-carouselIndex * 100}%)`;
    (refs.carouselDots ? Array.from(refs.carouselDots.children) : []).forEach((d, idx) => d.classList.toggle('active', idx === carouselIndex));
  }
  function startCarouselTimer() {
    if (carouselTimer) clearInterval(carouselTimer);
    if (state.slider.length > 1) {
      carouselTimer = setInterval(() => setCarousel(carouselIndex + 1), 4200);
    }
  }
  function stopCarouselTimer() {
    if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; }
  }

  /* ---------- Categories ---------- */
  function populateCategoryControls() {
    // Category chips
    if (refs.categoryList) refs.categoryList.innerHTML = '';
    (state.categories || []).forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.textContent = cat;
      btn.dataset.category = cat;
      btn.addEventListener('click', () => {
        // filter by category by applying to filter select
        if (refs.filterCategory) {
          refs.filterCategory.value = cat;
          renderProducts();
        }
      });
      if (refs.categoryList) refs.categoryList.appendChild(btn);
    });

    // filter select
    if (refs.filterCategory) {
      refs.filterCategory.innerHTML = `<option value="all">All categories</option>`;
      state.categories.forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = c;
        refs.filterCategory.appendChild(opt);
      });
    }

    // admin category list
    if (refs.categoryAdminList) {
      refs.categoryAdminList.innerHTML = '';
      state.categories.forEach((c, idx) => {
        const row = document.createElement('div');
        row.className = 'admin-card';
        row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.alignItems = 'center';
        row.innerHTML = `<div style="font-weight:800">${escapeHtml(c)}</div>`;
        const actions = document.createElement('div');
        const up = document.createElement('button'); up.className = 'btn btn-ghost'; up.textContent = '↑';
        up.addEventListener('click', () => {
          if (idx === 0) return;
          [state.categories[idx-1], state.categories[idx]] = [state.categories[idx], state.categories[idx-1]];
          saveState(); populateCategoryControls(); renderProducts();
        });
        const down = document.createElement('button'); down.className = 'btn btn-ghost'; down.textContent = '↓';
        down.addEventListener('click', () => {
          if (idx === state.categories.length - 1) return;
          [state.categories[idx+1], state.categories[idx]] = [state.categories[idx], state.categories[idx+1]];
          saveState(); populateCategoryControls(); renderProducts();
        });
        const del = document.createElement('button'); del.className = 'btn'; del.textContent = 'Delete';
        del.addEventListener('click', () => {
          if (!confirm(`Delete category "${c}"? Existing products will keep their category.`)) return;
          state.categories.splice(idx, 1);
          saveState(); populateCategoryControls(); renderProducts();
        });
        actions.appendChild(up); actions.appendChild(down); actions.appendChild(del);
        row.appendChild(actions);
        refs.categoryAdminList.appendChild(row);
      });
    }
  }

  /* ---------- Products ---------- */
  function renderProducts() {
    if (!refs.productsGrid) return;
    refs.productsGrid.innerHTML = '';
    const cat = (refs.filterCategory && refs.filterCategory.value) || 'all';
    const q = (refs.searchProducts && refs.searchProducts.value || '').trim().toLowerCase();
    let list = (state.products || []).slice();

    if (cat && cat !== 'all') list = list.filter(p => (p.category||'').toLowerCase() === cat.toLowerCase());
    if (q) list = list.filter(p => (p.title + ' ' + (p.desc || '')).toLowerCase().includes(q));

    const sort = (refs.sortProducts && refs.sortProducts.value) || 'default';
    if (sort === 'price-asc') list.sort((a,b)=> safeParseNumber(a.price) - safeParseNumber(b.price));
    if (sort === 'price-desc') list.sort((a,b)=> safeParseNumber(b.price) - safeParseNumber(a.price));

    if (!list.length) {
      if (refs.productsEmpty) refs.productsEmpty.classList.remove('hidden');
      refs.productsGrid.innerHTML = '';
      return;
    } else if (refs.productsEmpty) refs.productsEmpty.classList.add('hidden');

    list.forEach(p => {
      const card = document.createElement('article');
      card.className = 'product';
      card.dataset.id = p.id;
      // thumb
      const thumb = document.createElement('div'); thumb.className = 'product-thumb';
      if (p.img) thumb.style.background = `url(${p.img}) center/cover no-repeat`;
      else thumb.textContent = p.title.split(' ').slice(0,2).join(' ');
      // title/desc
      const title = document.createElement('div'); title.className = 'product-title'; title.textContent = p.title;
      const desc = document.createElement('div'); desc.className = 'product-desc'; desc.textContent = p.desc || '';
      // price
      const priceRow = document.createElement('div'); priceRow.className = 'product-price-row';
      const price = document.createElement('div'); price.className = 'product-price'; price.textContent = p.price || 'USD 0';
      priceRow.appendChild(price);
      if (p.oldPrice) {
        const old = document.createElement('div'); old.className = 'product-old'; old.textContent = p.oldPrice;
        priceRow.appendChild(old);
      }
      // footer / actions
      const footer = document.createElement('div'); footer.className = 'product-footer';
      const actions = document.createElement('div');
      const addBtn = document.createElement('button'); addBtn.className = 'btn btn-primary'; addBtn.textContent = 'Add';
      addBtn.addEventListener('click', () => {
        toast(`Added ${p.title} (demo)`);
      });
      const viewBtn = document.createElement('button'); viewBtn.className = 'btn btn-ghost'; viewBtn.textContent = 'Quick view';
      viewBtn.addEventListener('click', () => openProductModal(p));
      actions.appendChild(addBtn); actions.appendChild(viewBtn);
      footer.appendChild(actions);
      // assemble
      card.appendChild(thumb); card.appendChild(title); card.appendChild(desc); card.appendChild(priceRow); card.appendChild(footer);
      refs.productsGrid.appendChild(card);
    });
  }

  /* ---------- Laptops & deals & services & blog & faq ---------- */
  function renderLaptops() {
    if (!refs.laptopsGrid) return;
    refs.laptopsGrid.innerHTML = '';
    (state.laptops || []).forEach(p => {
      const card = document.createElement('article'); card.className = 'product';
      const thumb = document.createElement('div'); thumb.className = 'product-thumb';
      if (p.img) thumb.style.background = `url(${p.img}) center/cover no-repeat`; else thumb.textContent = p.title.split(' ').slice(0,2).join(' ');
      const title = document.createElement('div'); title.className='product-title'; title.textContent = p.title;
      const price = document.createElement('div'); price.className='product-price'; price.textContent = p.price || '';
      card.appendChild(thumb); card.appendChild(title); card.appendChild(price);
      refs.laptopsGrid.appendChild(card);
    });
  }
  function renderDeals() {
    if (!refs.dealsGrid) return;
    refs.dealsGrid.innerHTML = '';
    (state.deals || []).forEach(d => {
      const div = document.createElement('div'); div.className = 'deal-card';
      div.innerHTML = `<div class="deal-title" style="font-weight:800">${escapeHtml(d.title)}</div>
                       <div class="deal-desc">${escapeHtml(d.desc||'')}</div>
                       <div class="deal-price" style="color:var(--purple-600);font-weight:900">${escapeHtml(d.price||'')}</div>`;
      refs.dealsGrid.appendChild(div);
    });
  }
  function renderServices() {
    if (!refs.servicesGrid) return;
    refs.servicesGrid.innerHTML = '';
    (state.services || []).forEach(s => {
      const c = document.createElement('div'); c.className = 'service-card';
      c.innerHTML = `<div class="service-title" style="font-weight:900">${escapeHtml(s.title)}</div><div class="service-desc">${escapeHtml(s.desc||'')}</div>`;
      refs.servicesGrid.appendChild(c);
    });
  }
  function renderBlog() {
    if (!refs.blogGrid) return;
    refs.blogGrid.innerHTML = '';
    (state.blog || []).forEach(b => {
      const c = document.createElement('article'); c.className = 'blog-card';
      c.innerHTML = `<h3 style="margin:0 0 8px 0">${escapeHtml(b.title)}</h3><p class="muted">${escapeHtml(b.excerpt||'')}</p>`;
      refs.blogGrid.appendChild(c);
    });
  }
  function renderFaq() {
    if (!refs.faqGrid) return;
    refs.faqGrid.innerHTML = '';
    (state.faq || []).forEach(f => {
      const item = document.createElement('div'); item.className = 'faq-item';
      item.innerHTML = `<h4>${escapeHtml(f.q)}</h4><p class="muted">${escapeHtml(f.a)}</p>`;
      refs.faqGrid.appendChild(item);
    });
  }
  function renderTestimonials() {
    if (!refs.testimonialsGrid) return;
    refs.testimonialsGrid.innerHTML = '';
    // keep testimonials in services or blog? For now reuse some messages or static items
    const items = [
      { quote: 'Quick turnaround and clear updates — I trust MSA.', who: 'Layla, Creator' },
      { quote: 'They fixed my motherboard when others failed.', who: 'Omar, Streamer' },
      { quote: 'Great bundles and fair prices.', who: 'Karim, Gamer' }
    ];
    items.forEach(t => {
      const c = document.createElement('div'); c.className = 'testimonial-card';
      c.innerHTML = `<div class="quote">“${escapeHtml(t.quote)}”</div><div class="who muted">— ${escapeHtml(t.who)}</div>`;
      refs.testimonialsGrid.appendChild(c);
    });
  }

  /* ---------- Admin: render slides list and products list ---------- */
  function renderSlidesAdmin() {
    if (!refs.slidesAdminList) return;
    refs.slidesAdminList.innerHTML = '';
    state.slider.forEach((s, idx) => {
      const row = document.createElement('div');
      row.className = 'admin-card';
      row.style.display = 'flex'; row.style.justifyContent='space-between'; row.style.alignItems='center';
      const left = document.createElement('div'); left.innerHTML = `<div style="font-weight:900">${escapeHtml(s.title)}</div><div class="muted text-sm">${escapeHtml(s.desc||'')}</div>`;
      const actions = document.createElement('div');
      const imgBtn = document.createElement('button'); imgBtn.className = 'btn btn-ghost'; imgBtn.textContent = 'Image';
      imgBtn.addEventListener('click', async () => {
        const input = document.createElement('input'); input.type='file'; input.accept='image/*';
        input.onchange = async (ev) => {
          const file = ev.target.files[0]; if(!file) return;
          // Validate file
          if (file.size > 5 * 1024 * 1024) {
            toast('Image too large (max 5MB)');
            return;
          }
          if (!file.type.startsWith('image/')) {
            toast('Please select an image file');
            return;
          }
          s.img = await readFileAsDataURL(file);
          saveState(); renderSlidesAdmin(); renderCarousel();
          toast('Slide image uploaded');
        };
        input.click();
      });
      const up = document.createElement('button'); up.className='btn btn-ghost'; up.textContent='↑'; up.addEventListener('click', ()=> {
        if (idx===0) return; [state.slider[idx-1], state.slider[idx]]=[state.slider[idx], state.slider[idx-1]]; saveState(); renderSlidesAdmin(); renderCarousel();
      });
      const del = document.createElement('button'); del.className='btn'; del.textContent='Delete'; del.addEventListener('click', ()=> {
        if (!confirm('Delete slide?')) return;
        state.slider.splice(idx,1); saveState(); renderSlidesAdmin(); renderCarousel();
      });
      actions.appendChild(up); actions.appendChild(imgBtn); actions.appendChild(del);
      row.appendChild(left); row.appendChild(actions);
      refs.slidesAdminList.appendChild(row);
    });
  }

  function renderAdminProductsList() {
    if (!refs.adminProductsTable) return;
    refs.adminProductsTable.innerHTML = '';
    state.products.forEach((p, idx) => {
      const row = document.createElement('div'); row.className = 'admin-card';
      row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center';
      const left = document.createElement('div'); left.style.display='flex'; left.style.gap='10px'; left.style.alignItems='center';
      const img = document.createElement('div'); img.style.width='64px'; img.style.height='48px'; img.style.borderRadius='8px'; img.style.background='linear-gradient(90deg,#2b0033,#4b1a6a)'; img.style.display='grid'; img.style.placeItems='center'; img.style.color='white'; img.textContent = p.title.split(' ')[0];
      if (p.img) img.style.background = `url(${p.img}) center/cover no-repeat`;
      left.appendChild(img);
      const meta = document.createElement('div'); meta.innerHTML = `<div style="font-weight:900">${escapeHtml(p.title)}</div><div class="muted text-sm">${escapeHtml(p.category)} • ${escapeHtml(p.price||'')}</div>`;
      left.appendChild(meta);
      const actions = document.createElement('div');
      const editBtn = document.createElement('button'); editBtn.className='btn btn-ghost'; editBtn.textContent='Edit'; editBtn.addEventListener('click', ()=> {
        loadProductToAdminForm(p.id);
      });
      const delBtn = document.createElement('button'); delBtn.className='btn'; delBtn.textContent='Delete'; delBtn.addEventListener('click', ()=> {
        if (!confirm('Delete product?')) return;
        state.products = state.products.filter(x=>x.id !== p.id); saveState(); renderAdminProductsList(); renderProducts();
      });
      actions.appendChild(editBtn); actions.appendChild(delBtn);
      row.appendChild(left); row.appendChild(actions);
      refs.adminProductsTable.appendChild(row);
    });
  }

  /* ---------- Messages admin ---------- */
  function renderMessagesAdmin() {
    if (!refs.adminMessagesList) return;
    refs.adminMessagesList.innerHTML = '';
    (state.messages || []).slice().reverse().forEach(m => {
      const row = document.createElement('div'); row.className='admin-card';
      row.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:900">${escapeHtml(m.name||'Anonymous')}</div>
          <div class="muted text-sm">${escapeHtml(m.email||'')} ${escapeHtml(m.phone||'')}</div>
        </div>
        <div class="muted text-sm">${new Date(m.time).toLocaleString()}</div>
      </div>
      <div style="margin-top:8px" class="muted">${escapeHtml(m.message||'')}</div>`;
      refs.adminMessagesList.appendChild(row);
    });
  }

  /* ---------- Admin product form helpers ---------- */
  let editingProductId = null;
  function clearAdminProductForm() {
    editingProductId = null;
    refs.adminProductTitle.value = '';
    refs.adminProductCategory.value = (state.categories && state.categories[0]) || '';
    refs.adminProductPrice.value = '';
    refs.adminProductOldPrice.value = '';
    refs.adminProductDesc.value = '';
    refs.adminProductImage.value = '';
  }
  async function loadProductToAdminForm(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return toast('Product not found');
    editingProductId = id;
    refs.adminProductTitle.value = p.title || '';
    refs.adminProductCategory.value = p.category || (state.categories[0] || '');
    refs.adminProductPrice.value = p.price || '';
    refs.adminProductOldPrice.value = p.oldPrice || '';
    refs.adminProductDesc.value = p.desc || '';
    toast('Product loaded to form — edit then Save');
  }

  /* -------------------------
     ACTIONS / EVENT HANDLERS
     ------------------------- */
  function wireEvents() {
    // Mobile menu toggle
    if (refs.mobileMenuBtn && refs.navMenu) {
      refs.mobileMenuBtn.addEventListener('click', () => {
        refs.navMenu.classList.toggle('show');
      });
    }

    // Admin open (shows login modal)
    if (refs.adminOpenBtn) {
      refs.adminOpenBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        openAdminLoginModal();
      });
    }

    // login modal close
    if (refs.adminLoginClose) refs.adminLoginClose.addEventListener('click', closeAdminLoginModal);

    // admin login form
    if (refs.adminLoginForm) {
      refs.adminLoginForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const pwd = (refs.adminPassword && refs.adminPassword.value) || '';
        if (checkAdminPassword(pwd)) {
          // successfully authenticated
          const remember = $('#rememberAdmin') && $('#rememberAdmin').checked;
          if (remember) localStorage.setItem('msa_admin_last_login', new Date().toISOString());
          closeAdminLoginModal();
          openAdminDashboard();
          toast('Admin unlocked');
        } else {
          alert('Incorrect password (demo).');
        }
      });
    }

    // admin dashboard close / logout
    if (refs.adminCloseBtn) refs.adminCloseBtn.addEventListener('click', closeAdminDashboard);
    if (refs.adminLogoutBtn) refs.adminLogoutBtn.addEventListener('click', () => {
      closeAdminDashboard(); toast('Admin logged out (demo)'); // no session token used in this demo
    });

    // slides admin add
    if (refs.addSlideAdminBtn) refs.addSlideAdminBtn.addEventListener('click', async () => {
      const title = (refs.slideTitleInput && refs.slideTitleInput.value.trim()) || 'New slide';
      const desc = (refs.slideSubtitleInput && refs.slideSubtitleInput.value.trim()) || '';
      let img = null;
      if (refs.slideImageInput && refs.slideImageInput.files && refs.slideImageInput.files[0]) {
        const file = refs.slideImageInput.files[0];
        // Validate file
        if (file.size > 5 * 1024 * 1024) {
          toast('Image too large (max 5MB)');
          return;
        }
        if (!file.type.startsWith('image/')) {
          toast('Please select an image file');
          return;
        }
        img = await readFileAsDataURL(file);
      }
      state.slider.push({ id: uid('s'), title, desc, img });
      saveState(); renderSlidesAdmin(); renderCarousel();
      (refs.slideTitleInput) && (refs.slideTitleInput.value = ''); (refs.slideSubtitleInput) && (refs.slideSubtitleInput.value = '');
      if (refs.slideImageInput) refs.slideImageInput.value = '';
      toast('Slide added');
    });
    if (refs.clearSlidesAdminBtn) refs.clearSlidesAdminBtn.addEventListener('click', () => {
      if (!confirm('Clear all slides?')) return;
      state.slider = []; saveState(); renderSlidesAdmin(); renderCarousel(); toast('Slides cleared');
    });

    // category add
    if (refs.addCategoryBtn) refs.addCategoryBtn.addEventListener('click', () => {
      const name = (refs.newCategoryName && refs.newCategoryName.value.trim()) || '';
      if (!name) return toast('Category name required');
      if (!state.categories.includes(name)) state.categories.push(name);
      saveState(); populateCategoryControls(); renderAdminProductsList(); renderProducts();
      refs.newCategoryName.value = '';
      toast('Category added');
    });

    // product admin save
    if (refs.saveProductAdminBtn) refs.saveProductAdminBtn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const title = (refs.adminProductTitle && refs.adminProductTitle.value.trim()) || '';
      if (!title) return toast('Product title required');
      const category = (refs.adminProductCategory && refs.adminProductCategory.value) || (state.categories[0] || 'parts');
      const price = (refs.adminProductPrice && refs.adminProductPrice.value.trim()) || 'USD 0';
      const oldP = (refs.adminProductOldPrice && refs.adminProductOldPrice.value.trim()) || '';
      const desc = (refs.adminProductDesc && refs.adminProductDesc.value.trim()) || '';
      let img = null;
      if (refs.adminProductImage && refs.adminProductImage.files && refs.adminProductImage.files[0]) {
        const file = refs.adminProductImage.files[0];
        // Validate file
        if (file.size > 5 * 1024 * 1024) {
          toast('Image too large (max 5MB)');
          return;
        }
        if (!file.type.startsWith('image/')) {
          toast('Please select an image file');
          return;
        }
        img = await readFileAsDataURL(file);
      }
      if (editingProductId) {
        const p = state.products.find(x => x.id === editingProductId);
        if (!p) return toast('Editing product not found');
        p.title = title; p.category = category; p.price = price; p.oldPrice = oldP; p.desc = desc;
        if (img) p.img = img;
        toast('Product updated');
      } else {
        state.products.push({ id: uid('p'), title, category, price, oldPrice: oldP, desc, img });
        toast('Product added');
      }
      saveState(); renderAdminProductsList(); renderProducts(); clearAdminProductForm();
    });

    if (refs.newProductAdminBtn) refs.newProductAdminBtn.addEventListener('click', (ev) => { ev.preventDefault(); clearAdminProductForm(); });

    // search / filter / sort
    if (refs.filterCategory) refs.filterCategory.addEventListener('change', renderProducts);
    if (refs.searchProducts) refs.searchProducts.addEventListener('input', renderProducts);
    if (refs.sortProducts) refs.sortProducts.addEventListener('change', renderProducts);

    // contact form
    if (refs.contactForm) refs.contactForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const m = {
        id: uid('m'),
        name: refs.contactName.value || 'Anonymous',
        email: refs.contactEmail.value || '',
        phone: refs.contactPhone.value || '',
        message: refs.contactMessage.value || '',
        time: new Date().toISOString()
      };
      state.messages.push(m);
      saveState(); renderMessagesAdmin(); refs.contactForm.reset();
      toast('Message received (stored in local admin inbox)');
    });

    // messages admin actions
    if (refs.clearMessagesBtn) refs.clearMessagesBtn.addEventListener('click', () => {
      if (!confirm('Clear all contact messages?')) return;
      state.messages = []; saveState(); renderMessagesAdmin(); toast('Messages cleared');
    });
    if (refs.exportMessagesBtn) refs.exportMessagesBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state.messages || [], null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'msa-messages.json'; a.click(); URL.revokeObjectURL(url);
      toast('Messages exported');
    });

    // admin password management
    if (refs.saveAdminPasswordBtn) refs.saveAdminPasswordBtn.addEventListener('click', () => {
      const v = (refs.changeAdminPassword && refs.changeAdminPassword.value) || '';
      if (!v) return toast('Enter a new password');
      changeAdminPassword(v);
      refs.changeAdminPassword.value = '';
    });
    if (refs.resetAdminPasswordBtn) refs.resetAdminPasswordBtn.addEventListener('click', () => {
      if (!confirm('Reset admin password to default?')) return;
      resetAdminPasswordToDefault();
    });

    // shop info save
    if (refs.saveShopInfo) refs.saveShopInfo.addEventListener('click', () => {
      state.shopInfo.title = refs.adminShopTitleInput.value || state.shopInfo.title;
      state.shopInfo.tagline = refs.adminShopSubtitleInput.value || state.shopInfo.tagline;
      state.shopInfo.phone = refs.adminPhoneInput.value || state.shopInfo.phone;
      state.shopInfo.email = refs.adminEmailInput.value || state.shopInfo.email;
      state.shopInfo.address = refs.adminAddressInput.value || state.shopInfo.address;
      state.shopInfo.delivery = refs.adminDeliveryInput.value || state.shopInfo.delivery;
      saveState(); renderShopInfo();
      toast('Shop info saved locally');
    });

    // export / import store
    if (refs.exportStoreBtn) refs.exportStoreBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'msa-store-backup.json'; a.click(); URL.revokeObjectURL(url);
      toast('Store exported');
    });
    if (refs.importStoreFile) refs.importStoreFile.addEventListener('change', async (ev) => {
      const f = ev.target.files[0]; if (!f) return;
      if (!confirm('Import will replace local store data. Continue?')) return;
      try {
        const txt = await f.text();
        const parsed = JSON.parse(txt);
        state = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
        saveState(); fullRender(); toast('Store imported');
      } catch (e) {
        alert('Invalid JSON file');
      }
    });

    if (refs.previewStoreBtn) refs.previewStoreBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast('Preview scrolled to top (demo)');
    });
    if (refs.debugDumpBtn) refs.debugDumpBtn.addEventListener('click', () => { console.log('MSA state dump:', state); toast('State dumped to console'); });
    if (refs.wipeStoreBtn) refs.wipeStoreBtn.addEventListener('click', () => {
      if (!confirm('Wipe all local store data and reset to demo?')) return;
      localStorage.removeItem(LS_KEY); loadState(); fullRender(); toast('Local store reset');
    });

    // admin dashboard nav tabs
    $all('.admin-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        $all('.admin-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        $all('.admin-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(tab);
        if (panel) panel.classList.add('active');
      });
    });

    // product modal close / quick view (delegation is possible; we used dedicated buttons earlier)
    const productModalClose = $('#productModalClose');
    if (productModalClose) productModalClose.addEventListener('click', closeProductModal);

    // pause carousel on hover
    if (refs.heroCarousel) {
      refs.heroCarousel.addEventListener('mouseenter', stopCarouselTimer);
      refs.heroCarousel.addEventListener('mouseleave', startCarouselTimer);
    }

    // Pause carousel when page is not visible
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopCarouselTimer();
      } else {
        startCarouselTimer();
      }
    });

    // Prevent default form submission for all forms
    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', e => e.preventDefault());
    });
  }

  /* -------------------------
     Admin modal open/close and dashboard show/hide
     ------------------------- */
  function openAdminLoginModal() {
    if (!refs.adminLoginModal) return;
    refs.adminLoginModal.setAttribute('aria-hidden', 'false');
    refs.adminLoginModal.classList.add('open');
    // focus password input
    setTimeout(() => { refs.adminPassword && refs.adminPassword.focus(); }, 120);
  }
  function closeAdminLoginModal() {
    if (!refs.adminLoginModal) return;
    refs.adminLoginModal.setAttribute('aria-hidden', 'true');
    refs.adminLoginModal.classList.remove('open');
  }
  function openAdminDashboard() {
    // remove .hidden class (if exists) and add .open for slide-in
    if (!refs.adminDashboard) {
      toast('Admin dashboard not found in DOM');
      return;
    }
    refs.adminDashboard.classList.remove('hidden');
    // allow small delay then add 'open' so CSS transition applies
    setTimeout(() => {
      refs.adminDashboard.classList.add('open');
    }, 8);
    // render admin panes
    renderSlidesAdmin(); 
    renderAdminProductsList(); 
    renderMessagesAdmin();
    populateAdminCategoryDropdown(); // NEW: Populate the category dropdown in admin
  }
  function closeAdminDashboard() {
    if (!refs.adminDashboard) return;
    refs.adminDashboard.classList.remove('open');
    // hide after transition
    setTimeout(() => {
      refs.adminDashboard.classList.add('hidden');
    }, 420);
  }

  /* -------------------------
     NEW: Populate admin category dropdown
     ------------------------- */
  function populateAdminCategoryDropdown() {
    if (!refs.adminProductCategory) return;
    
    // Clear existing options
    refs.adminProductCategory.innerHTML = '';
    
    // Add "All Products" category option
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Products';
    refs.adminProductCategory.appendChild(allOption);
    
    // Add each category as an option
    state.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      refs.adminProductCategory.appendChild(option);
    });
  }

  /* -------------------------
     Product quick modal
     ------------------------- */
  function openProductModal(product) {
    const modal = $('#productQuickModal');
    if (!modal) return;
    $('#productModalTitle').textContent = product.title || 'Product';
    $('#productModalDesc').textContent = product.desc || '';
    $('#productModalPrice').textContent = product.price || 'USD 0';
    const modalImage = $('#productModalImage');
    if (product.img) {
      modalImage.style.background = `url(${product.img}) center/cover no-repeat`;
      modalImage.textContent = '';
    } else {
      modalImage.style.background = '';
      modalImage.textContent = product.title.split(' ').slice(0,2).join(' ');
    }
    modal.setAttribute('aria-hidden', 'false'); modal.classList.add('open');
  }
  function closeProductModal() {
    const modal = $('#productQuickModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true'); modal.classList.remove('open');
  }

  /* -------------------------
     Helper: escapeHtml
     ------------------------- */
  function escapeHtml(str = '') {
    return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  /* -------------------------
     Full render
     ------------------------- */
  function fullRender() {
    renderShopInfo();
    renderCarousel();
    populateCategoryControls();
    renderProducts();
    renderLaptops();
    renderDeals();
    renderServices();
    renderBlog();
    renderFaq();
    renderTestimonials();
    renderSlidesAdmin();
    renderAdminProductsList();
    renderMessagesAdmin();
    populateAdminCategoryDropdown(); // NEW: Populate admin category dropdown on full render
  }

  /* -------------------------
     On start
     ------------------------- */
  function start() {
    ensureAdminPassword();
    loadState();
    initRefs();
    // wire up events AFTER we read state
    wireEvents();
    // If admin was kept logged in (demo) we could auto-open; we skip auto-open for safety
    fullRender();
    log('MSA app started — open console for debug');
  }

  // start app
  start();

  /* ===========================
     Expose some helpers for console debugging
     =========================== */
  window._msa = {
    state,
    saveState: () => { saveState(); toast('State saved'); },
    resetDemo: () => { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_ADMIN_PASS_KEY); location.reload(); },
    setAdminPass: (p) => { changeAdminPassword(String(p)); }
  };
})();