# AGENTS.md

## Cursor Cloud specific instructions

### Overview

TemplateMagic is a **purely static client-side web application** (vanilla JS, HTML5, CSS). There is no build step, no package manager, no server-side code, no tests, and no linter configured. All dependencies (Tailwind CSS, Lucide Icons) are loaded from CDNs at runtime.

### Running the development server

```bash
cd /workspace && python3 -m http.server 8000
```

Then open `http://localhost:8000/` in Chrome. A simple HTTP server is required (rather than `file://`) because Canvas operations may be restricted under the file protocol.

### Project structure

- `index.html` — Single-page application entry point
- `assets/app.js` — All application logic (~1,155 lines of vanilla JS)
- `assets/styles.css` — Custom CSS (Tailwind is loaded via CDN)
- `assets/logo.svg` — App logo
- `CNAME` — GitHub Pages custom domain (`templatemagic.app`)

### Key notes

- **No package manager or dependencies to install.** There is no `package.json`, no `node_modules`, and no lockfile.
- **No build step.** Files are served as-is.
- **No automated tests or linter.** Changes must be verified manually in the browser.
- **CDN dependency:** The app requires internet access to load Tailwind CSS from `cdn.tailwindcss.com` and Lucide Icons from `unpkg.com`. If those CDNs are unreachable, the UI will be unstyled and icons will not render.
- **Hello-world verification:** Upload any PNG image, select the "Auto Wand" tool, click on a colored region to trace it, and confirm a green outline appears with the export buttons enabled.
