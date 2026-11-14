# Publish the browser builder

`npm run build:pages` prepares `dist/pages/` with the full source editor,
live preview, all icon assets, imports, and source/SVG/offline HTML exports.
Node.js is needed during preparation only; the published builder is static.
Generated files are ignored by Git.

Push this project to a GitHub repository with a `main` branch. In repository
Settings → Pages, select **GitHub Actions** as the source. The workflow at
`.github/workflows/pages.yml` publishes on pushes to `main` or manual runs.
For a different default branch, update the workflow trigger.

Both root domains and repository subpaths are supported. Browser-saved diagrams
stay in each visitor's localStorage; there is no server storage or collaboration.
The **Offline HTML** button still exports the separate diagram viewer.
