Quiero que generes un proyecto listo para subir a un repositorio público en GitHub y servirlo con GitHub Pages. Requisitos clave:

## Objetivo
Construir un micrositio educativo 100% estático (sin backend) con un **modo Creación** (editor in-page) y un **modo Producción** (solo lectura). El autor debe poder crear un tema (fuentes, tamaños, layout, colores) y añadir bloques en cualquier orden: texto (Markdown simple), imagen, audio, video de YouTube, PDF, cita, aviso, galería (múltiples imágenes) y lista de enlaces. Debe permitir **drag & drop** para reordenar bloques. El contenido se guarda en localStorage y se puede **exportar/importar** como `data/content.json`. Los **assets** (imágenes, audios, pdfs) estarán **en el mismo repo** bajo `/assets/...`.

## Stack
- HTML/CSS/JS puro (sin build).
- Usar **SortableJS** por CDN para drag & drop confiable en todos los navegadores.
- Usar una mini librería de Markdown propia (regex sencilla) o showdown por CDN (solo si es liviano).
- CORS-safe: si se abre con `file://`, cargar un JSON “seed” embebido en el HTML; si se sirve por http/https (GitHub Pages), cargar `/data/content.json`.
- Accesibilidad básica: labels, `alt`, contraste aceptable, navegación con teclado.
- Performance: `loading="lazy"` para iframes e imágenes, `preload="metadata"` en audio.

## Estructura de archivos
/
  index.html          # Vista producción y edición (controlada por #edit)
  style.css           # Estilos con variables CSS para tema
  app.js              # Render + editor + drag & drop
  /assets/
    /images/          # imágenes del autor
    /audios/          # audios del autor
    /pdfs/            # PDFs del autor
  /data/
    content.json      # se sobreescribe con la exportación del autor
  .gitignore          # ignora nada especial (proyecto estático)
  README.md           # Instrucciones de uso y deploy

## Comportamiento
- **Modos**:
  - Producción (por defecto): render de `data/content.json` (si falla, usar seed embebido).
  - Creación: si la URL contiene `#edit`, mostrar panel lateral con:
    - “Tema”: color primario, color acento, escala tipográfica (rem), layout (narrow/wide), fuente (selección de Google Fonts por `<link>` dinámico).
    - “Sitio”: título general, subtítulo, descripción.
    - “Paleta”: píldoras para añadir bloques (text, image, audio, youtube, pdf, quote, callout, gallery, links).
    - Botones: Previsualizar (oculta controles sin salir de edit), Guardar (localStorage), Exportar JSON, Importar JSON.
- **Bloques**:
  - `text`: textarea + preview con Markdown simple (**negrita**, *itálica*, listas `-`, enlaces `[txt](url)`).
  - `image`: campos `src`, `alt`, `caption` → `<figure><img><figcaption>`.
  - `audio`: campo `src`, `caption` → `<audio controls preload="metadata">`.
  - `youtube`: `url` (aceptar youtu.be o v=) + `caption` → `<iframe>` responsivo.
  - `pdf`: `src` → `<object type="application/pdf">` + botón “Descargar”.
  - `quote`: bloque `<blockquote>`.
  - `callout`: bloque destacado con borde/tono del color primario.
  - `gallery`: texto multilínea `src|alt|caption` por elemento, render en grid.
  - `links`: texto multilínea `label|url` por enlace.
- **Drag & drop**:
  - Usar **SortableJS** para reordenar bloques dentro del “canvas”.
  - Para crear un bloque nuevo: arrastrar una “píldora” desde la paleta a posiciones indicadas o hacer clic en “+ Añadir bloque” entre bloques.
- **Persistencia**:
  - Autosave en localStorage tras cambios.
  - Exportar: descarga `content.json` con `site`, `theme`, `sections[0].blocks`.
  - Importar: leer un JSON (validar mínimamente) y refrescar UI.
- **Tema**:
  - Variables CSS: `--color`, `--accent`, `--fs` (escala), familia tipográfica (Google Fonts: cargar vía `<link>` construido al elegir fuente).
  - `layout`: clases `layout-wide` / `layout-narrow` que ajustan `max-width`.
  - Botón para alternar **tema claro/oscuro** manual (además respetar `prefers-color-scheme`).
- **CORS y apertura local**:
  - Incluir `<script id="seed" type="application/json"> … </script>` con contenido por defecto.
  - En `app.js`, si `location.protocol==='file:'` o falla el fetch de `/data/content.json`, usar el objeto del seed.
- **Errores de medios**:
  - Si una imagen/audio/pdf falla, mostrar un cartel amable (`[Imagen no encontrada]`, etc.) sin romper la página.

## UI/UX
- Layout: barra superior con título/subtítulo y acciones (Editar/Previsualizar/Guardar/Exportar/Importar).
- En modo edición: **panel lateral** con paleta y controles de tema/sitio; **canvas** central con bloques.
- Cada bloque muestra herramientas: mover (drag handle), duplicar, eliminar.
- Grid y tipografías sobrias; sombras suaves; radios 12–16px; conservación del espacio en móvil.

## Código
- Entregar **todos los archivos** con contenido funcional.
- `app.js` bien modular (funciones: `render()`, `renderBlock()`, `newBlock()`, `bindEditor()`, `applyTheme()`, `saveLocal()`, `exportJSON()`, `importJSON()`, etc.).
- Comentar lo esencial.
- README con pasos:
  1) “Abrir `index.html#edit` para crear, exportar `content.json`”.
  2) “Subir a GitHub → Settings → Pages → branch main (/root)”.
  3) Rutas de assets (`assets/...`) y referencias en bloques.

## Semilla (seed)
- Un `content.json` mínimo con 1 sección “Contenido” y un bloque `text` de ejemplo; **sin** archivos demo inexistentes.

## Bonus (si cabe):
- Botón “Duplicar bloque”.
- Confirmación al eliminar.
- Scroll al bloque recién creado.
- Pequeño TOC (índice) opcional auto-generado a partir de los primeros encabezados en bloques de texto.

