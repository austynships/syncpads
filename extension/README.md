# SyncPads Chrome extension

Manifest V3, plain JavaScript, no build step.

| Feature | How |
| --- | --- |
| New tab (SP-2) | Every new tab opens `https://syncpad.tech/app`, which draws from its cache first and then syncs. |
| Save this page (SP-8) | Click the toolbar icon (or press **Alt+Shift+S**), pick a page and group, and click **Save**. The last page and group you used are preselected. |
| Save all tabs (SP-8) | In the popup, **Save all tabs in this window** adds every web tab as a new group ("Tabs · Nov 12, 2026") on the chosen page. |
| Import Chrome bookmarks (SP-9) | In the popup, **Import Chrome bookmarks…** shows how many links it found, then imports. Each top-level folder (Bookmarks bar, Other bookmarks) becomes a page, and each subfolder a group. |

It uses your normal SyncPads sign-in. If you're signed out, the popup shows a **Sign in** button.

## Install it (developer mode)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this `extension` folder.
4. Pin it: click the puzzle-piece icon in the toolbar, then the pin next to SyncPads.
5. Open a new tab. Chrome asks whether to keep the extension's new tab page; choose **Keep it**.

After changing any file here, click the reload icon on the SyncPads card in `chrome://extensions`.

## Permissions

- `tabs`: read the title and address of open tabs, for **Save this page** and **Save all tabs**.
- `bookmarks`: read your Chrome bookmarks, only when you click **Import Chrome bookmarks…**.
- `storage`: remember the last page and group you saved to.
- `https://syncpad.tech/*`: talk to your SyncPads account.

## Local development

In `config.js`, set `SYNCPADS_URL` to `http://localhost:3000`, add `"http://localhost:3000/*"` to `host_permissions` in `manifest.json`, then reload the extension.

## Publishing to the Chrome Web Store

Zip the contents of this folder (not the folder itself) and upload it in the Chrome Web Store developer dashboard. The listing needs a privacy policy URL, plus a short justification for each permission (use the list above).
