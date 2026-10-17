# Local folder import

This page explains how to add a BMAD project from a folder on the machine that runs the server, which folders and files are read, the limits that apply and the security consequences. Local import is off by default and is meant for self-hosted use on a trusted machine.

## Enabling

Set this in `.env` and restart the server:

```
ENABLE_LOCAL_FS=true
```

Only the exact value `true` enables it. See [configuration.md](./configuration.md).

## Adding a folder

1. Press **Add a project** in the sidebar or on the home page.
2. Open the **Local Folder** tab (it is the first tab when local import is enabled).
3. Enter the absolute path of the project folder, for example `/home/user/acme`.
4. Submit. The folder is checked and added to the project list.

The server resolves the path on its own disk, not on the machine of the browser. If you open the console from a phone or another computer, the path must exist on the server.

### Path rules

- The path must be 1 to 4096 characters.
- It must not contain a null byte or a `..` segment.
- Use an absolute path. A relative path would be resolved against the server's working directory and is not supported.
- The folder must be readable and must be a directory.
- It must contain a `_bmad` or a `_bmad-output` folder at its top level. Otherwise the import is refused with "No _bmad or _bmad-output directory found in this folder." A symbolic link named `_bmad` does not count.
- The same path cannot be added twice. The project is stored as owner `local` and a name made of the folder name and a short hash of the full path, and the display name is the folder name.

## What gets scanned

The provider does not walk the whole project. It only reads these top-level folders of the project:

- `_bmad` and `_bmad-output`, always.
- The output folder named by the BMAD configuration, when it differs from `_bmad-output`. The configuration is read from `_bmad/core/config.yaml` or `_bmad/config.toml` (see [layouts.md](./layouts.md)). A nested value such as `custom/out` opens the folder `custom`, but only files under `custom/out` can be read.
- Folders that the detected layout declares: `docs` and `.agentic` for the v6 project layout, `docs` for v4. They are opened after the layout is detected. `.agentic` is the only folder starting with a dot that can ever be opened.

Everything else in the project (source code, `.git`, `node_modules`, other dot-folders) is never listed or read. Inside the allowed folders these are skipped: `node_modules`, `.git`, `.next`, `.nuxt`, `.svelte-kit`, `dist`, `build`, `.cache`, `.turbo`, `.vercel`, `.output`, `__pycache__`, `.venv`, `venv`, `target`, `.now`, and the files `.DS_Store`, `Thumbs.db` and `desktop.ini`.

## Limits

| Limit | Value | What happens |
| --- | --- | --- |
| File size | 10 MB per file | The file cannot be read |
| Images served to documents | 5 MB, types svg, png, jpg, jpeg, gif, webp | The image is refused (413 from `/api/repo-asset`) |
| File count | 10,000 files in the allowed folders | The scan fails with an error |
| Depth | 20 directory levels | Deeper folders are not scanned |

## Using the project

A local project behaves like a GitHub project, except that:

- There is no branch. The project always shows what is on disk now, and the Settings entry (branch selection) is hidden.
- Files are read from disk on every request. **Refresh data** in the project's row menu re-counts the files and updates the sync time.
- Relative images in Markdown documents are served through `/api/repo-asset`.
- If you move or rename the folder, Refresh reports that the folder no longer exists. Remove the project and add it again at the new path.

Removing a project deletes its row in the database only. Your files are not touched.

## Security notes

The app has no authentication. Anyone who can reach the server can register any readable folder that contains a `_bmad` or `_bmad-output` directory and then read the files in the allowed folders. Enable local import only on a machine you control, on `localhost` or a private network.

The guards that remain:

- The feature switch `ENABLE_LOCAL_FS`.
- Path traversal protection: null bytes, look-alike slash characters and `..` are rejected, and a resolved path must stay inside the project folder.
- Only the declared folders can be read, and checking happens on the normalised path, so `_bmad-output/../x` cannot reach `x`.
- Symbolic links are skipped when scanning and refused when reading, and the real path of a file must remain inside the project root, so a linked folder inside an allowed folder cannot lead out.
- File size, file count and depth limits.
- Error messages sent to the browser do not contain file system paths.

See [SECURITY.md](../SECURITY.md) for the wider model.
