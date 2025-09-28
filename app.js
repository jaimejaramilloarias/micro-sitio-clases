(() => {
  const STORAGE_KEY = 'micro-sitio-clases-content';
  const FONT_LINK_ID = 'dynamic-font';
  const elements = {
    title: document.getElementById('siteTitle'),
    subtitle: document.getElementById('siteSubtitle'),
    description: document.getElementById('siteDescription'),
    content: document.getElementById('content'),
    editor: document.getElementById('editorPanel'),
    toast: document.querySelector('.toast'),
    actions: document.querySelector('.actions'),
    body: document.body,
    toggleEdit: document.querySelector('[data-action="toggle-edit"]'),
    preview: document.querySelector('[data-action="preview"]'),
    save: document.querySelector('[data-action="save"]'),
    export: document.querySelector('[data-action="export"]'),
    import: document.querySelector('[data-action="import"] input'),
    toggleTheme: document.querySelector('[data-action="toggle-theme"]'),
    palette: document.getElementById('palette')
  };

  const BLOCK_LIBRARY = [
    { type: 'text', label: 'Texto' },
    { type: 'image', label: 'Imagen' },
    { type: 'audio', label: 'Audio' },
    { type: 'youtube', label: 'YouTube' },
    { type: 'pdf', label: 'PDF' },
    { type: 'quote', label: 'Cita' },
    { type: 'callout', label: 'Aviso' },
    { type: 'gallery', label: 'Galería' },
    { type: 'links', label: 'Lista de enlaces' }
  ];

  const seed = safeJSON(() => document.getElementById('seed').textContent) || {};
  let state = clone(seed);
  let editMode = location.hash.includes('edit');
  let previewMode = false;
  let blockSortable;
  let paletteSortable;
  let inlinePicker;
  let inlinePickerCloser;

  init();

  async function init() {
    state = await loadContent();
    bindActions();
    render();
    window.addEventListener('hashchange', handleHashChange);
  }

  function handleHashChange() {
    const nowEdit = location.hash.includes('edit');
    if (nowEdit !== editMode) {
      editMode = nowEdit;
      previewMode = false;
      render();
    }
  }

  async function loadContent() {
    const fromStorage = safeJSON(() => window.localStorage.getItem(STORAGE_KEY));
    if (fromStorage) {
      return normalizeState(fromStorage);
    }

    if (location.protocol === 'file:') {
      return normalizeState(seed);
    }

    try {
      const response = await fetch('./data/content.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo cargar el JSON remoto.');
      const json = await response.json();
      return normalizeState(json);
    } catch (err) {
      console.warn(err);
      return normalizeState(seed);
    }
  }

  function normalizeState(raw) {
    const base = clone(seed);
    const data = Object.assign({}, base, raw);
    data.site = Object.assign({}, base.site, raw.site || {});
    data.theme = Object.assign({}, base.theme, raw.theme || {});
    data.sections = Array.isArray(raw.sections) && raw.sections.length
      ? raw.sections.map((section, index) => ({
        title: section.title || base.sections[index]?.title || `Sección ${index + 1}`,
        blocks: Array.isArray(section.blocks) ? section.blocks.map(normalizeBlock) : []
      }))
      : clone(base.sections);
    return data;
  }

  function normalizeBlock(block) {
    const base = { id: createId(), type: 'text', markdown: '' };
    if (!block || typeof block !== 'object') return base;
    const normalized = Object.assign({}, block);
    normalized.id = block.id || createId();
    normalized.type = block.type || 'text';
    switch (normalized.type) {
      case 'text':
        normalized.markdown = block.markdown || '';
        break;
      case 'image':
        normalized.src = block.src || '';
        normalized.alt = block.alt || '';
        normalized.caption = block.caption || '';
        break;
      case 'audio':
        normalized.src = block.src || '';
        normalized.caption = block.caption || '';
        break;
      case 'youtube':
        normalized.url = block.url || '';
        normalized.caption = block.caption || '';
        break;
      case 'pdf':
        normalized.src = block.src || '';
        normalized.caption = block.caption || '';
        break;
      case 'quote':
        normalized.text = block.text || '';
        normalized.cite = block.cite || '';
        break;
      case 'callout':
        normalized.text = block.text || '';
        break;
      case 'gallery':
        normalized.items = Array.isArray(block.items)
          ? block.items.map(item => ({
            src: item.src || '',
            alt: item.alt || '',
            caption: item.caption || ''
          }))
          : [];
        break;
      case 'links':
        normalized.items = Array.isArray(block.items)
          ? block.items.map(item => ({
            label: item.label || '',
            url: item.url || ''
          }))
          : [];
        break;
      default:
        normalized.type = 'text';
        normalized.markdown = block.markdown || '';
    }
    return normalized;
  }

  function bindActions() {
    elements.toggleEdit?.addEventListener('click', () => {
      if (editMode) {
        history.replaceState(null, '', location.pathname + location.search);
      } else {
        location.hash = 'edit';
      }
    });

    elements.preview?.addEventListener('click', () => {
      previewMode = !previewMode;
      elements.body.classList.toggle('preview-mode', previewMode);
      elements.preview.textContent = previewMode ? 'Volver a editar' : 'Previsualizar';
    });

    elements.save?.addEventListener('click', () => {
      saveLocal();
      showToast('Cambios guardados en este navegador.');
    });

    elements.export?.addEventListener('click', exportJSON);
    elements.import?.addEventListener('change', handleImport);

    elements.toggleTheme?.addEventListener('click', () => {
      const modes = ['auto', 'light', 'dark'];
      const index = modes.indexOf(state.theme.mode || 'auto');
      state.theme.mode = modes[(index + 1) % modes.length];
      applyTheme();
      renderThemeControls();
      saveLocal();
      showToast(`Modo del tema: ${modeLabel(state.theme.mode)}.`);
    });
  }

  function render() {
    renderSite();
    renderThemeControls();
    renderBlocks();
    updateActions();
    applyTheme();
  }

  function renderSite() {
    elements.title.textContent = state.site.title || 'Micrositio educativo';
    elements.subtitle.textContent = state.site.subtitle || '';
    elements.subtitle.hidden = !state.site.subtitle;
    elements.description.textContent = state.site.description || '';
    elements.description.hidden = !state.site.description;
    document.title = state.site.title ? `${state.site.title} · Micrositio` : 'Micrositio educativo';
  }

  function renderThemeControls() {
    const bindings = elements.editor?.querySelectorAll('[data-bind]');
    if (!bindings) return;
    bindings.forEach(input => {
      const path = input.getAttribute('data-bind');
      const value = getValueByPath(state, path);
      if (input.type === 'checkbox') {
        input.checked = Boolean(value);
      } else if (input.tagName === 'SELECT' || input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
        if (document.activeElement === input) return;
        input.value = value ?? '';
      }
    });
  }

  function renderBlocks() {
    destroySortables();
    closeInlinePicker();
    const content = elements.content;
    content.innerHTML = '';
    content.classList.toggle('layout-narrow', state.theme.layout === 'narrow');
    const blocks = state.sections[0]?.blocks || [];

    if (editMode && !previewMode) {
      content.append(renderAddBetween(-1));
    }

    blocks.forEach((block, index) => {
      const blockEl = document.createElement('section');
      blockEl.className = `block block-${block.type}`;
      blockEl.dataset.id = block.id;
      blockEl.dataset.index = String(index);

      if (editMode && !previewMode) {
        blockEl.prepend(renderBlockControls(index));
      }

      const preview = document.createElement('div');
      preview.className = 'block-preview';
      preview.innerHTML = renderBlockView(block);
      blockEl.append(preview);

      if (editMode && !previewMode) {
        blockEl.append(renderBlockEditor(block, index));
      }

      content.append(blockEl);

      if (editMode && !previewMode) {
        content.append(renderAddBetween(index));
      }
    });

    if (!blocks.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = editMode ? 'No hay bloques aún. Usa la paleta para comenzar.' : 'Aún no hay contenido publicado.';
      content.append(empty);
    }

    if (editMode && !previewMode) {
      setupPalette();
      setupSortable();
      bindBlockInputs();
    }
    bindMediaFallbacks();
  }

  function renderBlockControls(index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'block-controls';
    const drag = document.createElement('button');
    drag.type = 'button';
    drag.className = 'drag-handle';
    drag.textContent = 'Mover';
    wrapper.append(drag);

    const duplicate = document.createElement('button');
    duplicate.type = 'button';
    duplicate.textContent = 'Duplicar';
    duplicate.addEventListener('click', () => duplicateBlock(index));
    wrapper.append(duplicate);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Eliminar';
    remove.addEventListener('click', () => removeBlock(index));
    wrapper.append(remove);

    return wrapper;
  }

  function renderAddBetween(index) {
    const wrap = document.createElement('div');
    wrap.className = 'add-between';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '+ Añadir bloque';
    button.dataset.insertAfter = String(index);
    wrap.append(button);
    return wrap;
  }

  function renderBlockEditor(block, index) {
    const editor = document.createElement('div');
    editor.className = 'block-editor';
    editor.dataset.index = String(index);
    switch (block.type) {
      case 'text':
        editor.append(createTextarea('Contenido (Markdown)', 'markdown', block.markdown));
        break;
      case 'image':
        editor.append(createInput('Ruta de la imagen', 'src', block.src));
        editor.append(createInput('Texto alternativo', 'alt', block.alt));
        editor.append(createInput('Pie de foto', 'caption', block.caption));
        break;
      case 'audio':
        editor.append(createInput('Ruta del audio', 'src', block.src));
        editor.append(createInput('Descripción', 'caption', block.caption));
        break;
      case 'youtube':
        editor.append(createInput('URL del video', 'url', block.url));
        editor.append(createInput('Leyenda', 'caption', block.caption));
        break;
      case 'pdf':
        editor.append(createInput('Ruta del PDF', 'src', block.src));
        editor.append(createInput('Descripción', 'caption', block.caption));
        break;
      case 'quote':
        editor.append(createTextarea('Texto de la cita', 'text', block.text));
        editor.append(createInput('Autor o fuente', 'cite', block.cite));
        break;
      case 'callout':
        editor.append(createTextarea('Mensaje destacado', 'text', block.text));
        break;
      case 'gallery':
        editor.append(createTextarea('Elementos (src|alt|caption por línea)', 'items', serializeGallery(block.items)));
        break;
      case 'links':
        editor.append(createTextarea('Enlaces (label|url por línea)', 'items', serializeLinks(block.items)));
        break;
    }
    return editor;
  }

  function bindBlockInputs() {
    elements.content.querySelectorAll('.block-editor').forEach(editor => {
      const index = Number(editor.dataset.index);
      editor.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('input', evt => {
          handleBlockInput(index, evt.target.name, evt.target.value);
        });
      });
    });

    elements.content.querySelectorAll('.add-between button').forEach(btn => {
      btn.addEventListener('click', evt => {
        evt.preventDefault();
        const after = Number(btn.dataset.insertAfter);
        showInlinePicker(btn, after + 1);
      });
    });
  }

  function handleBlockInput(index, field, value) {
    const blocks = state.sections[0].blocks;
    const block = blocks[index];
    if (!block) return;
    if (block.type === 'gallery' && field === 'items') {
      block.items = parseGallery(value);
    } else if (block.type === 'links' && field === 'items') {
      block.items = parseLinks(value);
    } else {
      block[field] = value;
    }
    updateBlockPreview(index);
    saveLocal();
  }

  function updateBlockPreview(index) {
    const blocks = state.sections[0].blocks;
    const block = blocks[index];
    if (!block) return;
    const el = elements.content.querySelector(`.block[data-index="${index}"] .block-preview`);
    if (!el) return;
    el.innerHTML = renderBlockView(block);
    bindMediaFallbacks(el);
  }

  function renderBlockView(block) {
    switch (block.type) {
      case 'text':
        return markdownToHtml(block.markdown || '');
      case 'image':
        return `<figure>${mediaImage(block)}</figure>`;
      case 'audio':
        return `<div>${mediaAudio(block)}</div>`;
      case 'youtube':
        return youtubeEmbed(block);
      case 'pdf':
        return pdfViewer(block);
      case 'quote':
        return quoteBlock(block);
      case 'callout':
        return calloutBlock(block);
      case 'gallery':
        return galleryBlock(block);
      case 'links':
        return linksBlock(block);
      default:
        return markdownToHtml(block.markdown || '');
    }
  }

  function mediaImage(block) {
    const alt = escapeHtml(block.alt || '');
    const caption = escapeHtml(block.caption || '');
    const src = escapeHtml(block.src || '');
    if (!src) return '<div class="media-fallback">[Imagen no encontrada]</div>';
    return `<img src="${src}" alt="${alt}" loading="lazy" data-fallback="image" />${caption ? `<figcaption>${caption}</figcaption>` : ''}`;
  }

  function mediaAudio(block) {
    const src = escapeHtml(block.src || '');
    const caption = escapeHtml(block.caption || '');
    if (!src) {
      return `<div class="audio-fallback">[Audio no disponible]</div>`;
    }
    return `${caption ? `<p>${caption}</p>` : ''}<audio controls preload="metadata" data-fallback="audio">` +
      `<source src="${src}" />Tu navegador no soporta audio HTML5.</audio>`;
  }

  function youtubeEmbed(block) {
    const url = block.url || '';
    const id = extractYouTubeId(url);
    if (!id) {
      return '<div class="media-fallback">[Video no disponible]</div>';
    }
    const caption = block.caption ? `<p class="muted">${escapeHtml(block.caption)}</p>` : '';
    return `<div class="youtube-wrapper"><iframe loading="lazy" src="https://www.youtube.com/embed/${id}" title="Video de YouTube" allowfullscreen></iframe></div>${caption}`;
  }

  function pdfViewer(block) {
    const src = escapeHtml(block.src || '');
    const caption = escapeHtml(block.caption || '');
    if (!src) {
      return '<div class="media-fallback">[PDF no disponible]</div>';
    }
    const download = `<p><a href="${src}" download>Descargar PDF</a></p>`;
    return `${caption ? `<p>${caption}</p>` : ''}<object type="application/pdf" data="${src}" data-fallback="pdf">` +
      'Tu navegador no puede mostrar PDF.</object>' + download;
  }

  function quoteBlock(block) {
    const text = markdownToHtml(block.text || '');
    const cite = block.cite ? `<cite>${escapeHtml(block.cite)}</cite>` : '';
    return `<blockquote>${text}${cite}</blockquote>`;
  }

  function calloutBlock(block) {
    const text = markdownToHtml(block.text || '');
    return `<div class="block-callout">${text}</div>`;
  }

  function galleryBlock(block) {
    if (!block.items?.length) {
      return '<div class="media-fallback">[Galería vacía]</div>';
    }
    const list = block.items.map(item => {
      const src = escapeHtml(item.src || '');
      const alt = escapeHtml(item.alt || '');
      const caption = escapeHtml(item.caption || '');
      return `<figure>${src ? `<img src="${src}" alt="${alt}" loading="lazy" data-fallback="image" />` : '<div class="media-fallback">[Imagen]</div>'}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
    }).join('');
    return `<div class="block-gallery">${list}</div>`;
  }

  function linksBlock(block) {
    if (!block.items?.length) {
      return '<div class="media-fallback">[Sin enlaces]</div>';
    }
    const list = block.items.map(item => {
      const url = escapeHtml(item.url || '#');
      const label = escapeHtml(item.label || url);
      return `<li><a href="${url}" target="_blank" rel="noopener">${label}</a></li>`;
    }).join('');
    return `<div class="block-links"><ul>${list}</ul></div>`;
  }

  function setupPalette() {
    if (!elements.palette) return;
    if (paletteSortable) {
      paletteSortable.destroy();
    }
    paletteSortable = new Sortable(elements.palette, {
      group: { name: 'blocks', pull: 'clone', put: false },
      sort: false,
      animation: 150,
      onClone: evt => {
        evt.clone.dataset.palette = 'true';
        evt.clone.dataset.type = evt.item.querySelector('button')?.dataset.add;
      }
    });

    elements.palette.querySelectorAll('button[data-add]').forEach(button => {
      if (button.dataset.bound) return;
      button.dataset.bound = 'true';
      button.addEventListener('click', () => {
        addBlock(button.dataset.add);
      });
    });
  }

  function blockOptions() {
    if (!elements.palette) {
      return BLOCK_LIBRARY;
    }
    const buttons = Array.from(elements.palette.querySelectorAll('button[data-add]'));
    if (!buttons.length) return BLOCK_LIBRARY;
    return buttons.map(button => ({
      type: button.dataset.add,
      label: button.textContent.trim()
    }));
  }

  function setupSortable() {
    blockSortable = new Sortable(elements.content, {
      handle: '.drag-handle',
      animation: 150,
      group: { name: 'blocks', put: true },
      draggable: '.block',
      onAdd: evt => {
        if (evt.item.dataset.palette === 'true') {
          const type = evt.item.dataset.type || 'text';
          const position = evt.newIndex;
          evt.item.remove();
          addBlock(type, position);
        }
      },
      onUpdate: evt => {
        const { oldIndex, newIndex } = evt;
        if (oldIndex === newIndex) return;
        const blocks = state.sections[0].blocks;
        const moved = blocks.splice(oldIndex, 1)[0];
        blocks.splice(newIndex, 0, moved);
        renderBlocks();
        saveLocal();
      }
    });
  }

  function destroySortables() {
    blockSortable?.destroy();
    blockSortable = null;
    paletteSortable?.destroy();
    paletteSortable = null;
  }

  function addBlock(type = 'text', index) {
    closeInlinePicker();
    const block = newBlock(type);
    const blocks = state.sections[0].blocks;
    const position = typeof index === 'number' && index >= 0 ? index : blocks.length;
    blocks.splice(position, 0, block);
    renderBlocks();
    saveLocal();
    requestAnimationFrame(() => {
      const element = elements.content.querySelector(`.block[data-id="${block.id}"]`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function showInlinePicker(anchor, position) {
    closeInlinePicker();
    const options = blockOptions();
    inlinePicker = document.createElement('div');
    inlinePicker.className = 'inline-picker';
    options.forEach(opt => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.type = opt.type;
      button.textContent = opt.label;
      button.addEventListener('click', () => {
        addBlock(opt.type, position);
        closeInlinePicker();
      });
      inlinePicker.append(button);
    });
    anchor.parentElement.insertAdjacentElement('afterend', inlinePicker);
    inlinePickerCloser = event => {
      if (inlinePicker && !inlinePicker.contains(event.target)) {
        closeInlinePicker();
      }
    };
    setTimeout(() => {
      if (inlinePickerCloser) {
        document.addEventListener('click', inlinePickerCloser);
      }
    }, 0);
  }

  function closeInlinePicker() {
    if (inlinePicker) {
      inlinePicker.remove();
      inlinePicker = null;
    }
    if (inlinePickerCloser) {
      document.removeEventListener('click', inlinePickerCloser);
      inlinePickerCloser = null;
    }
  }

  function newBlock(type) {
    const id = createId();
    switch (type) {
      case 'image':
        return { id, type, src: '', alt: '', caption: '' };
      case 'audio':
        return { id, type, src: '', caption: '' };
      case 'youtube':
        return { id, type, url: '', caption: '' };
      case 'pdf':
        return { id, type, src: '', caption: '' };
      case 'quote':
        return { id, type, text: '', cite: '' };
      case 'callout':
        return { id, type, text: '' };
      case 'gallery':
        return { id, type, items: [] };
      case 'links':
        return { id, type, items: [] };
      default:
        return { id, type: 'text', markdown: '' };
    }
  }

  function duplicateBlock(index) {
    const blocks = state.sections[0].blocks;
    const block = blocks[index];
    if (!block) return;
    const copy = JSON.parse(JSON.stringify(block));
    copy.id = createId();
    blocks.splice(index + 1, 0, copy);
    renderBlocks();
    saveLocal();
  }

  function removeBlock(index) {
    const blocks = state.sections[0].blocks;
    const block = blocks[index];
    if (!block) return;
    if (!confirm('¿Eliminar este bloque?')) return;
    blocks.splice(index, 1);
    renderBlocks();
    saveLocal();
  }

  function bindMediaFallbacks(scope = elements.content) {
    scope.querySelectorAll('[data-fallback]').forEach(node => {
      if (node.dataset.bound) return;
      node.dataset.bound = 'true';
      if (node.dataset.fallback === 'image' && node.tagName === 'IMG') {
        node.addEventListener('error', () => {
          const fallback = document.createElement('div');
          fallback.className = 'media-fallback';
          fallback.textContent = '[Imagen no encontrada]';
          node.replaceWith(fallback);
        });
      }
      if (node.dataset.fallback === 'audio' && node.tagName === 'AUDIO') {
        node.addEventListener('error', () => {
          const fallback = document.createElement('div');
          fallback.className = 'audio-fallback';
          fallback.textContent = '[Audio no disponible]';
          node.replaceWith(fallback);
        });
      }
      if (node.dataset.fallback === 'pdf' && node.tagName === 'OBJECT') {
        node.addEventListener('error', () => {
          const fallback = document.createElement('div');
          fallback.className = 'media-fallback';
          fallback.textContent = '[PDF no disponible]';
          node.replaceWith(fallback);
        });
      }
    });
  }

  function updateActions() {
    if (editMode) {
      elements.editor.hidden = previewMode;
      elements.preview.hidden = false;
      elements.preview.textContent = previewMode ? 'Volver a editar' : 'Previsualizar';
      elements.save.hidden = false;
      elements.export.hidden = false;
      elements.import?.closest('label').removeAttribute('hidden');
      elements.toggleEdit.textContent = 'Salir de edición';
      elements.body.classList.toggle('preview-mode', previewMode);
    } else {
      elements.editor.hidden = true;
      elements.preview.hidden = true;
      elements.preview.textContent = 'Previsualizar';
      elements.save.hidden = true;
      elements.export.hidden = true;
      elements.import?.closest('label').setAttribute('hidden', '');
      elements.toggleEdit.textContent = 'Editar';
      elements.body.classList.remove('preview-mode');
      previewMode = false;
    }
  }

  function applyTheme() {
    const theme = state.theme;
    const root = document.documentElement;
    const mode = theme.mode || 'auto';
    root.style.setProperty('--color', theme.color);
    root.style.setProperty('--color-soft', softColor(theme.color, 0.12));
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--fs', `${theme.scale || 1}rem`);
    const fontFamily = theme.font && theme.font !== 'system' ? theme.font.split(':')[0] : null;
    const fallbackFont = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    root.style.setProperty('--font', fontFamily ? `'${fontFamily}', ${fallbackFont}` : fallbackFont);
    root.dataset.mode = mode;
    elements.body.dataset.mode = mode;

    if (theme.font && theme.font !== 'system') {
      let link = document.getElementById(FONT_LINK_ID);
      if (!link) {
        link = document.createElement('link');
        link.id = FONT_LINK_ID;
        link.rel = 'stylesheet';
        document.head.append(link);
      }
      link.href = `https://fonts.googleapis.com/css2?family=${theme.font}&display=swap`;
    } else {
      const link = document.getElementById(FONT_LINK_ID);
      if (link) link.remove();
    }
  }

  function bindEditorChanges() {
    elements.editor?.querySelectorAll('[data-bind]').forEach(control => {
      control.addEventListener('input', () => {
        const path = control.getAttribute('data-bind');
        setValueByPath(state, path, control.value);
        if (path.startsWith('theme.')) {
          applyTheme();
          if (path === 'theme.layout') {
            renderBlocks();
          }
        }
        renderSite();
        saveLocal();
      });
    });
  }

  function bindActionsOnce() {
    // placeholder to keep API symmetrical if needed
  }

  function bindBlockEventsOnce() {
    // placeholder
  }

  function bindBlockEvents() {
    // intentionally empty
  }

  function modeLabel(mode) {
    switch (mode) {
      case 'light':
        return 'Claro';
      case 'dark':
        return 'Oscuro';
      default:
        return 'Automático';
    }
  }

  function saveLocal() {
    try {
      const json = JSON.stringify(state);
      window.localStorage.setItem(STORAGE_KEY, json);
    } catch (err) {
      console.warn('No se pudo guardar en localStorage', err);
    }
  }

  function exportJSON() {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'content.json';
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Descarga iniciada. Sube el archivo a /data/content.json para publicar.');
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      state = normalizeState(json);
      saveLocal();
      render();
      showToast('Contenido importado correctamente.');
    } catch (err) {
      console.error(err);
      showToast('El archivo no es un JSON válido.', true);
    } finally {
      event.target.value = '';
    }
  }

  function showToast(message, isError = false) {
    const toast = elements.toast;
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    toast.style.borderColor = isError ? 'var(--accent)' : 'var(--border)';
    toast.style.color = isError ? 'var(--accent)' : 'inherit';
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.hidden = true;
    }, 4000);
  }

  function markdownToHtml(markdown) {
    const escaped = escapeHtml(markdown);
    const lines = escaped.split(/\r?\n/);
    let html = '';
    let inList = false;
    lines.forEach(line => {
      if (!line.trim()) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        return;
      }
      const heading = line.match(/^(#{1,3})\s+(.*)$/);
      if (heading) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        const level = Math.min(heading[1].length, 3);
        const tag = `h${level}`;
        html += `<${tag}>${formatInline(heading[2])}</${tag}>`;
        return;
      }
      const list = line.match(/^[-*]\s+(.*)$/);
      if (list) {
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        html += `<li>${formatInline(list[1])}</li>`;
        return;
      }
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<p>${formatInline(line)}</p>`;
    });
    if (inList) {
      html += '</ul>';
    }
    return html || '<p></p>';
  }

  function formatInline(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  function escapeHtml(value) {
    return (value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function softColor(color, alpha = 0.12) {
    const rgb = hexToRgb(color);
    if (!rgb) {
      return `rgba(31, 111, 235, ${alpha})`;
    }
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  function hexToRgb(color) {
    if (typeof color !== 'string') return null;
    const hex = color.trim();
    const shorthand = /^#([a-f\d])([a-f\d])([a-f\d])$/i;
    const full = shorthand.test(hex) ? hex.replace(shorthand, (_, r, g, b) => `#${r}${r}${g}${g}${b}${b}`) : hex;
    const match = full.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!match) return null;
    return {
      r: parseInt(match[1], 16),
      g: parseInt(match[2], 16),
      b: parseInt(match[3], 16)
    };
  }

  function extractYouTubeId(url) {
    if (!url) return '';
    const regex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/;
    const match = url.match(regex);
    if (match) return match[1];
    const params = new URLSearchParams(url.split('?')[1] || '');
    return params.get('v') || '';
  }

  function parseGallery(value) {
    return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const [src = '', alt = '', caption = ''] = line.split('|').map(part => part.trim());
      return { src, alt, caption };
    });
  }

  function serializeGallery(items = []) {
    return items.map(item => `${item.src || ''}|${item.alt || ''}|${item.caption || ''}`).join('\n');
  }

  function parseLinks(value) {
    return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const [label = '', url = ''] = line.split('|').map(part => part.trim());
      return { label, url };
    });
  }

  function serializeLinks(items = []) {
    return items.map(item => `${item.label || ''}|${item.url || ''}`).join('\n');
  }

  function createInput(labelText, name, value) {
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.name = name;
    input.value = value || '';
    label.append(input);
    return label;
  }

  function createTextarea(labelText, name, value) {
    const label = document.createElement('label');
    label.textContent = labelText;
    const textarea = document.createElement('textarea');
    textarea.name = name;
    textarea.rows = name === 'markdown' ? 6 : 4;
    textarea.value = value || '';
    label.append(textarea);
    return label;
  }

  function setupSiteBindings() {
    bindEditorChanges();
  }

  setupSiteBindings();

  function getValueByPath(obj, path) {
    return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
  }

  function setValueByPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((acc, key) => {
      if (!acc[key]) acc[key] = {};
      return acc[key];
    }, obj);
    target[last] = value;
    if (path.startsWith('theme.')) {
      state.theme = Object.assign({}, state.theme);
    }
  }

  function clone(value) {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function safeJSON(getter) {
    try {
      const value = getter();
      return value ? JSON.parse(value) : null;
    } catch (err) {
      console.warn('JSON inválido, usando semilla.', err);
      return null;
    }
  }

  function createId() {
    return 'b-' + Math.random().toString(36).slice(2, 8);
  }

})();
