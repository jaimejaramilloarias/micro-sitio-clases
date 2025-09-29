# Micrositio educativo

Micrositio estático para crear y publicar clases o materiales educativos desde el navegador. Incluye un modo de creación con edición en página y un modo de producción listo para GitHub Pages.

## Características

- Modo Creación (`#edit`) con panel lateral para configurar tema, tipografía, colores, layout y metadatos del sitio.
- Paleta de bloques con arrastrar y soltar (SortableJS) o selección contextual entre bloques.
- Bloques disponibles: texto (Markdown simple), imagen, audio, video de YouTube, PDF, cita, aviso, galería y lista de enlaces.
- Bloques de texto con barra de formato (negrita, itálica, listas) y controles por bloque para fuente, tamaño, color, alineación y espaciado.
- Reordenamiento drag & drop, duplicado y eliminación con confirmación.
- Autosave en `localStorage`, exportación/importación de `data/content.json` y semilla embebida para uso offline (`file://`).
- Gestión de assets locales (`/assets/images`, `/assets/audios`, `/assets/pdfs`). Imágenes, audios y PDFs pueden cargarse desde esas carpetas o incrustarse directamente desde archivos locales.
- Tema personalizable con soporte claro/oscuro, `prefers-color-scheme` y carga dinámica de Google Fonts.
- Accesible con etiquetas, `alt` y navegación con teclado. Imágenes, iframes y audios usan `loading="lazy"` / `preload="metadata"` para mejor rendimiento.

## Estructura

```
/
├── index.html
├── style.css
├── app.js
├── data/
│   └── content.json
└── assets/
    ├── images/
    ├── audios/
    └── pdfs/
```

## Uso

1. Abre `index.html#edit` en tu navegador para entrar al modo creación.
2. Configura el tema, añade bloques con la paleta o con los botones `+ Añadir bloque` y organiza el contenido mediante arrastrar y soltar.
3. Los cambios se guardan automáticamente en tu navegador. Usa **Guardar** para forzar el guardado, **Exportar JSON** para descargar `content.json` e **Importar JSON** para cargar un archivo previo.
4. Cuando estés conforme, visita `index.html` sin `#edit` para ver el modo producción.

## Publicación en GitHub Pages

1. Crea un repositorio público y sube todos los archivos.
2. Copia tu `content.json` exportado en `data/content.json` antes de hacer commit.
3. En GitHub, ve a **Settings → Pages**, selecciona la rama `main` y carpeta `/ (root)`.
4. Los assets deben referenciarse con rutas relativas como `assets/images/tu-imagen.png` o incrustarse como archivos locales desde el editor.

## Notas

- Si abres el proyecto con `file://`, el sitio usará automáticamente la semilla definida en `index.html`. En producción cargará `data/content.json`.
- Para restablecer la semilla en tu navegador, borra el elemento `micro-sitio-clases-content` de `localStorage`.
- Amplía la estructura de `content.json` siguiendo el formato exportado (`site`, `theme`, `sections[0].blocks`). Si incrustas archivos locales, el JSON incluirá los datos codificados en base64.

¡Feliz creación de clases! 🎓
