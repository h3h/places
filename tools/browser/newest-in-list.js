// Get the newest places in a Google Maps saved list (Starred places, Want to go, …).
//
// 1. Open https://www.google.com/maps, click Saved, and open the list. Google shows the most
//    recently added places first.
// 2. Paste this file into the DevTools console and run
//      await newestInList("Name of the newest place you already have")
//    It reads the list top-down until it reaches that name, opens each newer entry to read its
//    feature ID, and copies [{name, id}] to the clipboard.
// 3. Feed the IDs to tools/browser/place-status.js for coordinates and categories, then add the
//    records with `python3 tools/browser/places_tool.py add-new new.json results.json --kind w`.
async function newestInList(stopAtName, { wait = 2500 } = {}) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const names = [...document.querySelectorAll('.fontHeadlineSmall')].map(e => e.innerText.trim()).filter(Boolean);
  const stop = names.indexOf(stopAtName);
  if (stop < 0) throw new Error(`"${stopAtName}" isn't in the loaded part of the list; scroll down and retry`);
  const out = [];
  for (const name of names.slice(0, stop)) {
    const h = [...document.querySelectorAll('.fontHeadlineSmall')].find(e => e.innerText.trim() === name);
    (h.closest('button') || h.closest('[role=button]') || h.closest('[jsaction]')).click();
    await sleep(wait);
    out.push({ name, id: (location.href.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/) || [])[1] || null });
    history.back();
    await sleep(wait);
  }
  try { copy(JSON.stringify(out, null, 1)); console.log('Copied', out.length, 'new places to the clipboard.'); } catch { console.log(JSON.stringify(out)); }
  return out;
}
