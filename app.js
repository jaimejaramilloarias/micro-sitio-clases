(() => {
  const STORAGE_KEY = 'micro-sitio-clases-content';
  const FONT_LINK_ID = 'dynamic-font';
  const FONT_FALLBACK = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const TEXT_FONT_CHOICES = [
    { value: 'inherit', label: 'Heredar del tema', css: 'inherit' },
    { value: 'inter', label: 'Inter (sans)', css: `'Inter', ${FONT_FALLBACK}`, link: 'Inter:wght@400;600' },
    { value: 'lato', label: 'Lato (sans)', css: `'Lato', ${FONT_FALLBACK}`, link: 'Lato:wght@400;700' },
    { value: 'merriweather', label: 'Merriweather (serif)', css: `'Merriweather', Georgia, "Times New Roman", serif`, link: 'Merriweather:wght@400;700' },
    { value: 'montserrat', label: 'Montserrat (sans)', css: `'Montserrat', ${FONT_FALLBACK}`, link: 'Montserrat:wght@400;600' },
    { value: 'serif', label: 'Serif clásica', css: "Georgia, 'Times New Roman', serif" },
    { value: 'mono', label: 'Monoespaciada', css: "'Source Code Pro', 'Courier New', monospace", link: 'Source+Code+Pro:wght@400;600' }
  ];
  const loadedBlockFonts = new Set();

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
    palette: document.getElementById('palette'),
    layout: document.querySelector('.layout')
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

  function updateBlock(index, changes) {
    const block = state.sections[0].blocks[index];
    if (!block) return;
    Object.assign(block, changes);
    updateBlockPreview(index);
    saveLocal();
  }

  function applyTextFormat(textarea, format, index) {
    if (!textarea) return;
    if (format === 'ul' || format === 'ol') {
      applyListFormat(textarea, format, index);
      return;
    }
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const value = textarea.value;
    const before = value.slice(0, start);
    const selection = value.slice(start, end);
    const after = value.slice(end);
    let inserted = selection;
    let selectStart = start;
    let selectEnd = end;

    if (format === 'bold') {
      const content = selection || 'texto';
      inserted = `**${content}**`;
      selectStart = start + 2;
      selectEnd = selectStart + content.length;
    } else if (format === 'italic') {
      const content = selection || 'texto';
      inserted = `*${content}*`;
      selectStart = start + 1;
      selectEnd = selectStart + content.length;
    }

    textarea.value = before + inserted + after;
    textarea.focus();
    textarea.setSelectionRange(selectStart, selectEnd);
    handleBlockInput(index, 'markdown', textarea.value);
  }

  function applyListFormat(textarea, format, index) {
    const value = textarea.value;
    let start = textarea.selectionStart ?? 0;
    let end = textarea.selectionEnd ?? 0;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEndIndex = value.indexOf('\n', end);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const selection = value.slice(lineStart, lineEnd) || 'Elemento de la lista';
    const lines = selection.split(/\r?\n/);
    let counter = 1;
    const formatted = lines.map(line => {
      const clean = line.replace(/^([-*]\s+|\d+\.\s+)/, '').trim();
      const content = clean || `Elemento ${counter}`;
      const output = format === 'ol' ? `${counter}. ${content}` : `- ${content}`;
      counter += 1;
      return output;
    }).join('\n');
    textarea.value = value.slice(0, lineStart) + formatted + value.slice(lineEnd);
    textarea.focus();
    textarea.setSelectionRange(lineStart, lineStart + formatted.length);
    handleBlockInput(index, 'markdown', textarea.value);
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
        normalized.fontChoice = block.fontChoice || 'inherit';
        normalized.fontSize = typeof block.fontSize === 'number' || typeof block.fontSize === 'string'
          ? String(block.fontSize)
          : '';
        normalized.lineHeight = typeof block.lineHeight === 'number' || typeof block.lineHeight === 'string'
          ? String(block.lineHeight)
          : '';
        normalized.textColor = block.textColor || '';
        normalized.align = block.align || '';
        break;
      case 'image':
        normalized.src = block.src || '';
        normalized.alt = block.alt || '';
        normalized.caption = block.caption || '';
        normalized.sourceMode = block.sourceMode || (normalized.src?.startsWith('data:') ? 'local' : 'repo');
        normalized.sourceName = block.sourceName || '';
        normalized.repoPath = block.repoPath || (normalized.sourceMode === 'repo' ? normalized.src : '');
        normalized.width = sanitizeNumber(block.width, 10, 100);
        break;
      case 'audio':
        normalized.src = block.src || '';
        normalized.caption = block.caption || '';
        normalized.sourceMode = block.sourceMode || (normalized.src?.startsWith('data:') ? 'local' : 'repo');
        normalized.sourceName = block.sourceName || '';
        normalized.repoPath = block.repoPath || (normalized.sourceMode === 'repo' ? normalized.src : '');
        break;
      case 'youtube':
        normalized.url = block.url || '';
        normalized.caption = block.caption || '';
        break;
      case 'pdf':
        normalized.src = block.src || '';
        normalized.caption = block.caption || '';
        normalized.sourceMode = block.sourceMode || (normalized.src?.startsWith('data:') ? 'local' : 'repo');
        normalized.sourceName = block.sourceName || '';
        normalized.repoPath = block.repoPath || (normalized.sourceMode === 'repo' ? normalized.src : '');
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
        editor.append(renderTextEditor(block));
        break;
      case 'image':
        editor.append(createMediaSourceToggle(block, index));
        editor.append(createMediaRepoInput('Imagen en el repositorio (assets/images/...)', 'src', block, index, 'Ej: assets/images/diagrama.png'));
        editor.append(createMediaLocalInput('Selecciona una imagen local', 'image/*', block, index));
        setMediaSourceVisibility(editor, block.sourceMode || 'repo');
        editor.append(createInput('Texto alternativo', 'alt', block.alt));
        editor.append(createInput('Pie de foto', 'caption', block.caption));
        editor.append(createImageSizeInput(block));
        break;
      case 'audio':
        editor.append(createMediaSourceToggle(block, index));
        editor.append(createMediaRepoInput('Audio en el repositorio (assets/audios/...)', 'src', block, index, 'Ej: assets/audios/leccion.mp3'));
        editor.append(createMediaLocalInput('Selecciona un audio local', 'audio/*', block, index));
        setMediaSourceVisibility(editor, block.sourceMode || 'repo');
        editor.append(createInput('Descripción', 'caption', block.caption));
        break;
      case 'youtube':
        editor.append(createInput('URL del video', 'url', block.url));
        editor.append(createInput('Leyenda', 'caption', block.caption));
        break;
      case 'pdf':
        editor.append(createMediaSourceToggle(block, index));
        editor.append(createMediaRepoInput('PDF en el repositorio (assets/pdfs/...)', 'src', block, index, 'Ej: assets/pdfs/apuntes.pdf'));
        editor.append(createMediaLocalInput('Selecciona un PDF local', 'application/pdf,.pdf', block, index));
        setMediaSourceVisibility(editor, block.sourceMode || 'repo');
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

  function renderTextEditor(block) {
    const wrapper = document.createElement('div');
    wrapper.className = 'text-editor-wrapper';
    wrapper.append(createTextToolbar());
    const textareaLabel = createTextarea('Contenido', 'markdown', block.markdown);
    textareaLabel.classList.add('text-editor-area');
    wrapper.append(textareaLabel);
    wrapper.append(createTextStyleControls(block));
    return wrapper;
  }

  function createTextToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'text-toolbar';
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Formato rápido');
    const buttons = [
      { format: 'bold', label: 'Negrita' },
      { format: 'italic', label: 'Itálica' },
      { format: 'ul', label: 'Viñetas' },
      { format: 'ol', label: 'Numerada' }
    ];
    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = btn.label;
      button.dataset.format = btn.format;
      toolbar.append(button);
    });
    return toolbar;
  }

  function createTextStyleControls(block) {
    const controls = document.createElement('div');
    controls.className = 'text-style-controls';

    const fontLabel = document.createElement('label');
    fontLabel.textContent = 'Fuente';
    const fontSelect = document.createElement('select');
    fontSelect.name = 'fontChoice';
    TEXT_FONT_CHOICES.forEach(option => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      fontSelect.append(opt);
    });
    const initialFont = sanitizeFontChoice(block.fontChoice);
    fontSelect.value = initialFont;
    ensureFontChoiceLoaded(initialFont);
    fontLabel.append(fontSelect);
    controls.append(fontLabel);

    const alignLabel = document.createElement('label');
    alignLabel.textContent = 'Alineación';
    const alignSelect = document.createElement('select');
    alignSelect.name = 'align';
    [
      { value: '', label: 'Hereda del tema' },
      { value: 'left', label: 'Izquierda' },
      { value: 'center', label: 'Centrada' },
      { value: 'right', label: 'Derecha' },
      { value: 'justify', label: 'Justificada' }
    ].forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      alignSelect.append(option);
    });
    alignSelect.value = sanitizeAlign(block.align);
    alignLabel.append(alignSelect);
    controls.append(alignLabel);

    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = 'Tamaño (rem)';
    const sizeWrapper = document.createElement('div');
    sizeWrapper.className = 'text-style-inline';
    const sizeInput = document.createElement('input');
    sizeInput.type = 'number';
    sizeInput.name = 'fontSize';
    sizeInput.min = '0.6';
    sizeInput.max = '3';
    sizeInput.step = '0.05';
    sizeInput.placeholder = '1 (tema)';
    sizeInput.value = block.fontSize ? block.fontSize : '';
    const sizeReset = document.createElement('button');
    sizeReset.type = 'button';
    sizeReset.dataset.action = 'reset-size';
    sizeReset.textContent = 'Restablecer';
    sizeWrapper.append(sizeInput, sizeReset);
    sizeLabel.append(sizeWrapper);
    controls.append(sizeLabel);

    const lineHeightLabel = document.createElement('label');
    lineHeightLabel.textContent = 'Interlineado';
    const lineWrapper = document.createElement('div');
    lineWrapper.className = 'text-style-inline';
    const lineInput = document.createElement('input');
    lineInput.type = 'number';
    lineInput.name = 'lineHeight';
    lineInput.min = '1';
    lineInput.max = '3';
    lineInput.step = '0.05';
    lineInput.placeholder = '1.6 (auto)';
    lineInput.value = block.lineHeight ? block.lineHeight : '';
    const lineReset = document.createElement('button');
    lineReset.type = 'button';
    lineReset.dataset.action = 'reset-lineheight';
    lineReset.textContent = 'Restablecer';
    lineWrapper.append(lineInput, lineReset);
    lineHeightLabel.append(lineWrapper);
    controls.append(lineHeightLabel);

    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color del texto';
    const colorWrapper = document.createElement('div');
    colorWrapper.className = 'text-style-inline';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.name = 'textColor';
    colorInput.value = block.textColor || '#1b1f24';
    const colorReset = document.createElement('button');
    colorReset.type = 'button';
    colorReset.dataset.action = 'reset-color';
    colorReset.textContent = 'Tema';
    colorWrapper.append(colorInput, colorReset);
    colorLabel.append(colorWrapper);
    controls.append(colorLabel);

    return controls;
  }

  function createMediaSourceToggle(block, index) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'media-source-toggle';
    const legend = document.createElement('legend');
    legend.textContent = 'Origen del archivo';
    fieldset.append(legend);
    const modes = [
      { value: 'repo', label: 'Repositorio (/assets/...)' },
      { value: 'local', label: 'Archivo local (se incrusta)' }
    ];
    modes.forEach(mode => {
      const label = document.createElement('label');
      label.className = 'media-source-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `media-source-${block.id}`;
      input.value = mode.value;
      input.checked = (block.sourceMode || 'repo') === mode.value;
      input.addEventListener('change', () => {
        if (!input.checked) return;
        updateBlock(index, { sourceMode: mode.value });
        const editor = fieldset.closest('.block-editor');
        if (editor) {
          setMediaSourceVisibility(editor, mode.value);
        }
      });
      label.append(input, document.createTextNode(mode.label));
      fieldset.append(label);
    });
    return fieldset;
  }

  function createMediaRepoInput(labelText, name, block, index, hintText) {
    const label = document.createElement('label');
    label.className = 'media-source-field';
    label.dataset.sourceMode = 'repo';
    label.textContent = labelText;
    const input = document.createElement('input');
    input.name = name;
    input.placeholder = 'assets/...';
    input.value = block.sourceMode === 'repo' ? (block.repoPath || block.src || '') : (block.repoPath || '');
    input.addEventListener('input', evt => {
      updateBlock(index, {
        src: evt.target.value,
        repoPath: evt.target.value,
        sourceMode: 'repo',
        sourceName: ''
      });
    });
    label.append(input);
    const hint = document.createElement('span');
    hint.className = 'media-source-note';
    hint.textContent = hintText || 'Ej: assets/archivo.ext';
    label.append(hint);
    return label;
  }

  function createMediaLocalInput(labelText, accept, block, index) {
    const label = document.createElement('label');
    label.className = 'media-source-field';
    label.dataset.sourceMode = 'local';
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const result = typeof e.target?.result === 'string' ? e.target.result : '';
        if (!result) return;
        updateBlock(index, {
          src: result,
          sourceMode: 'local',
          sourceName: file.name
        });
        const editor = label.closest('.block-editor');
        if (editor) {
          setMediaSourceVisibility(editor, 'local');
          const status = editor.querySelector('.media-local-status');
          if (status) {
            status.textContent = `Archivo actual: ${file.name}`;
          }
        }
      };
      reader.readAsDataURL(file);
    });
    label.append(input);
    const status = document.createElement('span');
    status.className = 'media-source-note media-local-status';
    status.textContent = block.sourceMode === 'local' && block.sourceName
      ? `Archivo actual: ${block.sourceName}`
      : 'El archivo se guardará incrustado en el JSON';
    label.append(status);
    return label;
  }

  function createImageSizeInput(block) {
    const label = document.createElement('label');
    label.textContent = 'Ancho máximo (%)';
    const wrapper = document.createElement('div');
    wrapper.className = 'inline-field';
    const input = document.createElement('input');
    input.name = 'width';
    input.type = 'number';
    input.min = '10';
    input.max = '100';
    input.step = '5';
    input.placeholder = '100';
    input.value = block.width || '';
    wrapper.append(input);
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.dataset.action = 'reset-image-width';
    reset.textContent = 'Restablecer';
    wrapper.append(reset);
    label.append(wrapper);
    const hint = document.createElement('small');
    hint.className = 'field-hint';
    hint.textContent = 'Deja vacío para ocupar el ancho completo del bloque.';
    label.append(hint);
    return label;
  }

  function setMediaSourceVisibility(editor, mode) {
    editor.querySelectorAll('.media-source-field').forEach(field => {
      field.hidden = field.dataset.sourceMode !== mode;
    });
    const repoField = editor.querySelector('.media-source-field[data-source-mode="repo"] input[name="src"]');
    if (mode === 'repo' && repoField) {
      repoField.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function bindBlockInputs() {
    elements.content.querySelectorAll('.block-editor').forEach(editor => {
      const index = Number(editor.dataset.index);
      editor.querySelectorAll('input, textarea, select').forEach(input => {
        if (input.type === 'file') return;
        const handler = evt => {
          handleBlockInput(index, evt.target.name, evt.target.value);
        };
        input.addEventListener('input', handler);
        if (input.tagName === 'SELECT') {
          input.addEventListener('change', handler);
        }
      });

      editor.querySelectorAll('[data-format]').forEach(button => {
        button.addEventListener('click', evt => {
          evt.preventDefault();
          const textarea = editor.querySelector('textarea[name="markdown"]');
          if (!textarea) return;
          applyTextFormat(textarea, button.dataset.format, index);
        });
      });

      editor.querySelectorAll('[data-action="reset-color"]').forEach(button => {
        button.addEventListener('click', evt => {
          evt.preventDefault();
          const input = editor.querySelector('input[name="textColor"]');
          if (!input) return;
          input.value = '#1b1f24';
          handleBlockInput(index, 'textColor', '');
        });
      });

      editor.querySelectorAll('[data-action="reset-size"]').forEach(button => {
        button.addEventListener('click', evt => {
          evt.preventDefault();
          const input = editor.querySelector('input[name="fontSize"]');
          if (!input) return;
          input.value = '';
          handleBlockInput(index, 'fontSize', '');
        });
      });

      editor.querySelectorAll('[data-action="reset-lineheight"]').forEach(button => {
        button.addEventListener('click', evt => {
          evt.preventDefault();
          const input = editor.querySelector('input[name="lineHeight"]');
          if (!input) return;
          input.value = '';
          handleBlockInput(index, 'lineHeight', '');
        });
      });

      editor.querySelectorAll('[data-action="reset-image-width"]').forEach(button => {
        button.addEventListener('click', evt => {
          evt.preventDefault();
          const input = editor.querySelector('input[name="width"]');
          if (!input) return;
          input.value = '';
          handleBlockInput(index, 'width', '');
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
      updateBlock(index, { items: parseGallery(value) });
      return;
    }
    if (block.type === 'links' && field === 'items') {
      updateBlock(index, { items: parseLinks(value) });
      return;
    }
    if (block.type === 'text') {
      switch (field) {
        case 'fontChoice': {
          const fontChoice = sanitizeFontChoice(value);
          ensureFontChoiceLoaded(fontChoice);
          updateBlock(index, { fontChoice });
          return;
        }
        case 'fontSize': {
          updateBlock(index, { fontSize: sanitizeNumber(value, 0.6, 3) });
          return;
        }
        case 'lineHeight': {
          updateBlock(index, { lineHeight: sanitizeNumber(value, 1, 3) });
          return;
        }
        case 'textColor': {
          updateBlock(index, { textColor: sanitizeColor(value) });
          return;
        }
        case 'align': {
          updateBlock(index, { align: sanitizeAlign(value) });
          return;
        }
        default:
          break;
      }
    }
    if ((block.type === 'image' || block.type === 'audio' || block.type === 'pdf') && field === 'src') {
      updateBlock(index, {
        src: value,
        repoPath: value,
        sourceMode: 'repo',
        sourceName: ''
      });
      return;
    }
    if (block.type === 'image' && field === 'width') {
      const sanitized = sanitizeNumber(value, 10, 100);
      updateBlock(index, { width: sanitized });
      const editor = elements.content.querySelector(`.block-editor[data-index="${index}"] input[name="width"]`);
      if (editor && editor.value !== sanitized) {
        editor.value = sanitized;
      }
      return;
    }
    updateBlock(index, { [field]: value });
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
        return textBlockHtml(block);
      case 'image':
        return mediaImage(block);
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
    const width = sanitizeNumber(block.width, 10, 100);
    const figureStyles = [];
    if (width) {
      figureStyles.push(`width: ${width}%`);
      figureStyles.push('margin-inline: auto');
    }
    const figureAttr = figureStyles.length ? ` style="${escapeHtml(figureStyles.join('; '))}"` : '';
    return `<figure${figureAttr}><img src="${src}" alt="${alt}" loading="lazy" data-fallback="image" />${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
  }

  function textBlockHtml(block) {
    const fontChoice = sanitizeFontChoice(block.fontChoice);
    ensureFontChoiceLoaded(fontChoice);
    const style = buildTextBlockStyle(block);
    const styleAttr = style ? ` style="${escapeHtml(style)}"` : '';
    const content = markdownToHtml(block.markdown || '');
    return `<div class="text-rich"${styleAttr}>${content}</div>`;
  }

  function buildTextBlockStyle(block) {
    const styles = [];
    const fontCss = fontChoiceToCss(sanitizeFontChoice(block.fontChoice));
    if (fontCss && fontCss !== 'inherit') {
      styles.push(`font-family: ${fontCss}`);
    }
    const fontSize = sanitizeNumber(block.fontSize, 0.6, 3);
    if (fontSize) {
      styles.push(`font-size: ${fontSize}rem`);
    }
    const lineHeight = sanitizeNumber(block.lineHeight, 1, 3);
    if (lineHeight) {
      styles.push(`line-height: ${lineHeight}`);
    }
    const color = sanitizeColor(block.textColor);
    if (color) {
      styles.push(`color: ${color}`);
    }
    const align = sanitizeAlign(block.align);
    if (align) {
      styles.push(`text-align: ${align}`);
    }
    return styles.join('; ');
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
        return { id, type, src: '', alt: '', caption: '', width: '' };
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
      elements.body.classList.add('is-editing');
      elements.body.classList.remove('is-viewing');
      elements.layout?.classList.remove('view-mode');
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
      elements.body.classList.remove('is-editing');
      elements.body.classList.add('is-viewing');
      elements.layout?.classList.add('view-mode');
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
    root.style.setProperty('--font', fontFamily ? `'${fontFamily}', ${FONT_FALLBACK}` : FONT_FALLBACK);
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
    let listType = '';
    lines.forEach(line => {
      if (!line.trim()) {
        if (listType) {
          html += listType === 'ol' ? '</ol>' : '</ul>';
          listType = '';
        }
        return;
      }
      const heading = line.match(/^(#{1,3})\s+(.*)$/);
      if (heading) {
        if (listType) {
          html += listType === 'ol' ? '</ol>' : '</ul>';
          listType = '';
        }
        const level = Math.min(heading[1].length, 3);
        const tag = `h${level}`;
        html += `<${tag}>${formatInline(heading[2])}</${tag}>`;
        return;
      }
      const ordered = line.match(/^(\d+)\.\s+(.*)$/);
      if (ordered) {
        if (listType !== 'ol') {
          if (listType) {
            html += listType === 'ol' ? '</ol>' : '</ul>';
          }
          html += '<ol>';
          listType = 'ol';
        }
        html += `<li>${formatInline(ordered[2])}</li>`;
        return;
      }
      const unordered = line.match(/^[-*]\s+(.*)$/);
      if (unordered) {
        if (listType !== 'ul') {
          if (listType) {
            html += listType === 'ol' ? '</ol>' : '</ul>';
          }
          html += '<ul>';
          listType = 'ul';
        }
        html += `<li>${formatInline(unordered[1])}</li>`;
        return;
      }
      if (listType) {
        html += listType === 'ol' ? '</ol>' : '</ul>';
        listType = '';
      }
      html += `<p>${formatInline(line)}</p>`;
    });
    if (listType) {
      html += listType === 'ol' ? '</ol>' : '</ul>';
    }
    return html || '<p></p>';
  }

  function formatInline(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  function sanitizeNumber(value, min, max) {
    if (value === null || value === undefined || value === '') return '';
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    const clamped = clamp(num, min, max);
    return Number.isInteger(clamped) ? String(clamped) : String(Number(clamped.toFixed(2)));
  }

  function sanitizeColor(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : '';
  }

  function sanitizeAlign(value) {
    const allowed = new Set(['left', 'center', 'right', 'justify']);
    return allowed.has(value) ? value : '';
  }

  function sanitizeFontChoice(value) {
    const match = TEXT_FONT_CHOICES.find(option => option.value === value);
    return match ? match.value : 'inherit';
  }

  function fontChoiceToCss(choice) {
    const option = TEXT_FONT_CHOICES.find(opt => opt.value === choice);
    if (!option) return null;
    if (option.value === 'inherit') return null;
    return option.css;
  }

  function ensureFontChoiceLoaded(choice) {
    const option = TEXT_FONT_CHOICES.find(opt => opt.value === choice);
    if (!option || !option.link) return;
    if (loadedBlockFonts.has(option.link)) return;
    const id = `block-font-${option.value}`;
    if (document.getElementById(id)) {
      loadedBlockFonts.add(option.link);
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = id;
    link.href = `https://fonts.googleapis.com/css2?family=${option.link}&display=swap`;
    document.head.append(link);
    loadedBlockFonts.add(option.link);
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

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

})();
