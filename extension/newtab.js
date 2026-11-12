// SP-2: every new tab opens the SyncPads start page. The app draws from its
// own cache first, so the page appears right away and then syncs.
location.replace(`${SYNCPADS_URL}/app`);
