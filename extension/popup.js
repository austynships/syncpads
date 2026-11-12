// SyncPads extension popup.
//  - SP-8: save the current page to a chosen page and group (open the popup, click Save),
//    or save every tab in the window as a new group.
//  - SP-9: import Chrome bookmarks; each top-level folder becomes a page.
// Calls the SyncPads API with the user's normal sign-in cookie.

const $ = (id) => document.getElementById(id);
let state = null;
let tab = null;
let pendingTree = null;

async function api(method, path, body) {
  const res = await fetch(`${SYNCPADS_URL}${path}`, {
    method,
    credentials: "include",
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function show(id, visible = true) {
  $(id).hidden = !visible;
}

function message(text, kind = "ok") {
  const el = $("message");
  el.textContent = text;
  el.className = kind;
  el.hidden = !text;
}

function isWebUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function openApp(path = "/app") {
  chrome.tabs.create({ url: `${SYNCPADS_URL}${path}` });
  window.close();
}

// ---------- page and group pickers ----------

function fillGroups(pageId, preferredGroupId) {
  const page = state.pages.find((p) => p.id === pageId) || state.pages[0];
  const select = $("group");
  select.replaceChildren(
    ...page.groups.map((g) => new Option(g.name, g.id, false, g.id === preferredGroupId)),
  );
  if (page.groups.length === 0) select.append(new Option("(no groups yet)", "", true, true));
  $("save").disabled = !select.value || !isWebUrl(tab?.url);
}

async function fillPickers() {
  const { lastPageId, lastGroupId } = await chrome.storage.local.get(["lastPageId", "lastGroupId"]);
  const pageId = state.pages.some((p) => p.id === lastPageId) ? lastPageId : state.pages[0].id;
  $("page").replaceChildren(...state.pages.map((p) => new Option(p.name, p.id, false, p.id === pageId)));
  fillGroups(pageId, lastGroupId);
}

function remember() {
  chrome.storage.local.set({ lastPageId: $("page").value, lastGroupId: $("group").value });
}

// ---------- actions ----------

async function saveCurrent(event) {
  event.preventDefault();
  if (!isWebUrl(tab?.url) || !$("group").value) return;
  $("save").disabled = true;
  message("");
  try {
    await api("POST", "/api/items", {
      groupId: $("group").value,
      type: "link",
      url: tab.url,
      title: $("title").value.trim() || null,
    });
    remember();
    const group = $("group").selectedOptions[0].text;
    message(`Saved to "${group}".`);
    setTimeout(() => window.close(), 1200);
  } catch (err) {
    message(err.message, "error");
    $("save").disabled = false;
  }
}

async function saveAllTabs() {
  const tabs = (await chrome.tabs.query({ currentWindow: true })).filter((t) => isWebUrl(t.url));
  if (tabs.length === 0) return message("No web pages open in this window.", "error");
  if (tabs.length > 500) return message("That's more than 500 tabs; close some and try again.", "error");

  $("save-tabs").disabled = true;
  message("");
  const name = `Tabs · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  try {
    const result = await api("POST", "/api/groups", {
      pageId: $("page").value,
      name,
      links: tabs.map((t) => ({ url: t.url, title: t.title || null })),
    });
    remember();
    message(`Saved ${result.added} ${result.added === 1 ? "tab" : "tabs"} as "${name}".`);
  } catch (err) {
    message(err.message, "error");
  } finally {
    $("save-tabs").disabled = false;
  }
}

/** chrome.bookmarks nodes -> the { title, url, children } shape the import API takes. */
function toTree(nodes) {
  return nodes.map((n) =>
    n.url ? { title: n.title || "", url: n.url } : { title: n.title || "", children: toTree(n.children || []) },
  );
}

function countLinks(nodes) {
  return nodes.reduce((n, node) => n + (node.children ? countLinks(node.children) : 1), 0);
}

async function prepareImport() {
  message("");
  const [root] = await chrome.bookmarks.getTree();
  // The root's children are "Bookmarks bar", "Other bookmarks" and "Mobile bookmarks".
  pendingTree = toTree(root.children || []).filter((folder) => countLinks(folder.children || []) > 0);
  const links = countLinks(pendingTree);
  if (links === 0) return message("You don't have any Chrome bookmarks to import.", "error");

  const names = pendingTree.map((f) => f.title).join(", ");
  $("import-summary").textContent =
    `Import ${links.toLocaleString()} bookmarks? Each top-level folder (${names}) becomes a new page ` +
    "and each subfolder a group. Your current pages won't change.";
  show("import-start", false);
  show("import-confirm");
}

async function runImport() {
  $("import-go").disabled = true;
  message("Importing…");
  try {
    const result = await api("POST", "/api/import", { tree: pendingTree });
    let text = `Imported ${result.links.toLocaleString()} links into ${result.pages} new ${result.pages === 1 ? "page" : "pages"}.`;
    if (result.skipped) text += ` Skipped ${result.skipped} that weren't web links.`;
    message(text);
    show("import-confirm", false);
    show("import-start");
  } catch (err) {
    message(err.message, "error");
  } finally {
    $("import-go").disabled = false;
  }
}

// ---------- start ----------

async function init() {
  $("open-app").addEventListener("click", (e) => {
    e.preventDefault();
    openApp();
  });
  $("sign-in").addEventListener("click", () => openApp("/login"));

  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    state = await api("GET", "/api/state");
  } catch (err) {
    show("loading", false);
    if (err.status === 401) return show("signed-out");
    return message(`Couldn't reach SyncPads. ${err.message}`, "error");
  }

  show("loading", false);
  show("main");

  $("title").value = tab?.title || "";
  $("url").textContent = isWebUrl(tab?.url) ? tab.url : "This page can't be saved (only http and https pages can).";
  await fillPickers();

  $("page").addEventListener("change", () => fillGroups($("page").value));
  $("save-form").addEventListener("submit", saveCurrent);
  $("save-tabs").addEventListener("click", saveAllTabs);
  $("import-start").addEventListener("click", prepareImport);
  $("import-go").addEventListener("click", runImport);
  $("import-cancel").addEventListener("click", () => {
    show("import-confirm", false);
    show("import-start");
    message("");
  });
  if (!$("save").disabled) $("save").focus();
}

init();
