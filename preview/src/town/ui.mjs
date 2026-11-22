// Presents one activity at a time; rendering and feedback own their separate boundaries.
import { townFeedbackPanel } from "./feedback-panel.mjs";
import { townViews } from "./view.mjs";
import { townCommand, townGuide, townCurrentOrder } from "./engine.mjs";
import { TOWN_ITEMS, TOWN_RECIPES, TOWN_BUILDINGS } from "./content.mjs";
import { townIcon } from "./art.mjs";
import {
  TOWN_KEY,
  loadTown,
  saveTown,
  importTown,
  townBackupAvailable,
  restoreTownBackup,
} from "./storage.mjs";
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const generator = {
  farm: "field",
  garden: "garden",
  coop: "coop",
  barn: "barn",
};
const label = (id) => TOWN_BUILDINGS[id]?.name || "Town";
export function mountTown(
  root,
  { toast: announce = () => {}, esc = escape } = {},
) {
  let storage;
  try {
    storage = window.localStorage;
  } catch (error) {
    const unavailable = () => {
      throw error;
    };
    storage = { getItem: unavailable, setItem: unavailable };
  }
  const notes = townFeedbackPanel({ storage, esc });
  let loaded;
  try {
    loaded = loadTown(storage);
  } catch (error) {
    loaded = { blocked: true, state: null, raw: null, error: error.message };
  }
  let state = loaded.state,
    savedRaw = loaded.raw,
    view = "town",
    selected = null,
    history = [],
    message = null,
    disposed = false,
    helpRequested = false,
    selectedRecipe = null,
    recipeChosen = false;
  const focus = (selector) =>
    root.querySelector(selector)?.focus({ preventScroll: true });
  const output = (name, raw) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([raw], { type: "application/json" }),
    );
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  };
  function feedback(text, error = false) {
    message = { text, error };
    try {
      announce(text);
    } catch {}
    renderFeedback(error || view === "menu" || view === "orders");
  }
  function renderFeedback(reveal = false) {
    const target = root.querySelector(".town-feedback");
    if (!target) return;
    target.hidden = !message;
    target.textContent = message?.text || "";
    target.classList.toggle("is-error", Boolean(message?.error));
    if (message?.error && /another tab/.test(message.text)) {
      const reload = document.createElement("button");
      reload.textContent = "Reload town";
      reload.onclick = () => window.location.reload();
      target.append(reload);
    }
    if (reveal && message)
      requestAnimationFrame(
        () =>
          target.isConnected &&
          target.scrollIntoView({ block: "nearest", behavior: "instant" }),
      );
  }
  function run(action) {
    try {
      const result = townCommand(state, action);
      if (!result.changed) {
        feedback(result.message);
        return false;
      }
      const raw = saveTown(storage, result.state, savedRaw);
      history.push(state);
      history = history.slice(-80);
      state = result.state;
      savedRaw = raw;
      selected = null;
      const note =
        action.type === "bake" && townCurrentOrder(state).type !== action.recipe
          ? `${result.message} Choose ${TOWN_RECIPES[action.recipe].name} at the market to sell it.`
          : result.message;
      message = { text: note, error: false };
      render();
      try {
        announce(note);
      } catch {}
      return true;
    } catch (error) {
      feedback("Action was not saved: " + error.message, true);
      return false;
    }
  }
  function undo() {
    if (!history.length) return;
    try {
      const previous = history.at(-1);
      savedRaw = saveTown(storage, previous, savedRaw);
      state = previous;
      history.pop();
      selected = null;
      message = { text: "Previous action undone.", error: false };
      render();
      try {
        announce(message.text);
      } catch {}
    } catch (error) {
      feedback("Undo was not saved: " + error.message, true);
    }
  }
  function navigate(next) {
    view = next;
    selected = null;
    message = null;
    if (next === "kitchen" && !recipeChosen)
      selectedRecipe = townCurrentOrder(state).type;
    render();
    focus("#town-main");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function recovery() {
    root.innerHTML = `<div class="town-shell"><header class="town-header"><strong>Common Table</strong></header><main id="town-main" tabindex="-1"><div class="town-feedback" hidden></div><section class="town-recovery"><h1>Let's keep your town safe</h1><p>${esc(loaded.error)}</p><p>Your original data has not been overwritten.</p>${townBackupAvailable(storage) ? '<button id="town-restore" class="primary">Restore automatic backup</button>' : ""}<button id="town-export-raw">Export original data</button><label>Import a valid town<input id="town-import" type="file" accept="application/json,.json"></label><a href="?classic=1">Open earlier farm</a></section></main></div>`;
    root.querySelector("#town-export-raw").onclick = () =>
      output("common-table-town-recovery.json", loaded.raw || "");
    bindImport();
    const restore = root.querySelector("#town-restore");
    if (restore)
      restore.onclick = () => {
        try {
          const restored = restoreTownBackup(storage, savedRaw);
          state = restored.state;
          savedRaw = restored.raw;
          loaded = { blocked: false };
          message = {
            text: "Restored the last automatic save. Your damaged copy is kept separately.",
            error: false,
          };
          render();
        } catch (error) {
          feedback(error.message, true);
        }
      };
    renderFeedback();
  }
  function render() {
    if (disposed) return;
    if (loaded.blocked) {
      recovery();
      return;
    }
    let earlier = false;
    try {
      earlier = storage.getItem("common-table.lab.save.v1") !== null;
    } catch {}
    const { map, menu, orderPage, activity } = townViews({
      state,
      view,
      selected,
      history,
      selectedRecipe,
      helpRequested,
      earlier,
      esc,
      feedbackMarkup: notes.markup(),
    });
    const active = document.activeElement,
      activeId = active?.id;
    root.innerHTML = `<div class="town-shell"><header class="town-header"><button id="town-home" aria-label="Return to town">${view === "town" ? "Common Table" : view === "orders" ? "← Market" : "← Town"}</button>${view !== "town" && view !== "menu" && view !== "orders" ? `<span class="town-current-place">${esc(label(view))}</span>` : ""}<span class="town-coins" aria-label="${state.coins} coins"><i aria-hidden="true">◈</i> ${state.coins}</span><button id="town-menu-button" aria-label="Open town menu">Menu</button></header><main id="town-main" tabindex="-1"><div class="town-feedback" hidden></div>${view === "town" ? map() : view === "menu" ? menu() : view === "orders" ? orderPage() : activity()}</main></div>`;
    root.querySelector("#town-home").onclick = () =>
      navigate(view === "orders" ? "market" : "town");
    root.querySelector("#town-menu-button").onclick = () => navigate("menu");
    root
      .querySelectorAll("[data-place]")
      .forEach((el) => (el.onclick = () => navigate(el.dataset.place)));
    const on = (id, fn) => {
      const element = root.querySelector("#" + id);
      if (element) element.onclick = fn;
    };
    on("town-hint-toggle", () => {
      helpRequested = !helpRequested;
      render();
      focus("#town-hint-toggle");
    });
    const recipePicker = root.querySelector("#town-recipe");
    if (recipePicker)
      recipePicker.onchange = () => {
        selectedRecipe = recipePicker.value;
        recipeChosen = true;
        message = null;
        render();
        focus("#town-recipe");
      };
    on("town-next", () => {
      const step = townGuide(state);
      if (view !== step.building) navigate(step.building);
      else if (step.command) run(step.command);
    });
    on("town-produce", () => {
      run({ type: "spawn", generator: generator[view] });
      focus("#town-produce");
    });
    on("town-order-pick", () => navigate("orders"));
    on("town-mill", () => run({ type: "mill" }));
    on("town-serve", () => run({ type: "serve" }));
    on("town-build", () => run({ type: "build", building: view }));
    on("town-remove", () => run({ type: "remove", index: selected }));
    on("town-undo", undo);
    root.querySelectorAll("[data-town-bake]").forEach(
      (el) =>
        (el.onclick = () => {
          run({ type: "bake", recipe: el.dataset.townBake });
          focus(
            root.querySelector("#town-recipe") ? "#town-recipe" : "#town-home",
          );
        }),
    );
    root.querySelectorAll("[data-town-order]").forEach(
      (el) =>
        (el.onclick = () => {
          if (run({ type: "choose_order", order: el.dataset.townOrder })) {
            selectedRecipe = el.dataset.townOrder;
            recipeChosen = false;
            view = "market";
            render();
            focus("#town-order-pick");
          }
        }),
    );
    on("town-export", () =>
      output("common-table-town.json", JSON.stringify(state, null, 2)),
    );
    on("town-export-backup", () => {
      const raw =
        storage.getItem(TOWN_KEY + ".before-import") ||
        storage.getItem(TOWN_KEY + ".backup");
      if (raw) output("common-table-town-backup.json", raw);
      else feedback("No previous town save yet.");
    });
    bindImport();
    notes.bind(root);
    bindCells();
    renderFeedback();
    if (
      activeId &&
      root.querySelector("#" + activeId) &&
      !root.querySelector("#" + activeId).disabled
    )
      focus("#" + activeId);
    if (!root.contains(document.activeElement))
      focus(root.querySelector("#town-next") ? "#town-next" : "#town-main");
  }
  function bindImport() {
    const importer = root.querySelector("#town-import");
    if (!importer) return;
    importer.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 2000000) {
        feedback("This save is too large.", true);
        return;
      }
      file
        .text()
        .then((raw) => {
          if (disposed) return;
          const result = importTown(storage, raw, savedRaw);
          state = result.state;
          savedRaw = result.raw;
          loaded = { blocked: false };
          selected = null;
          history = [];
          selectedRecipe = townCurrentOrder(state).type;
          recipeChosen = false;
          message = {
            text: "Town imported. Your previous file is kept as a backup.",
            error: false,
          };
          render();
          focus("#town-main");
        })
        .catch((error) => feedback("Import rejected: " + error.message, true));
    };
  }
  function bindCells() {
    let suppressClick = false;
    const select = (index) => {
      if (selected === index) {
        selected = null;
        render();
        focus(`[data-town-cell="${index}"]`);
        return;
      }
      if (selected === null) {
        if (state.pantry[index]) {
          selected = index;
          render();
          focus(`[data-town-cell="${index}"]`);
        }
        return;
      }
      const result = townCommand(state, {
        type: "drop",
        from: selected,
        to: index,
      });
      if (result.changed) run({ type: "drop", from: selected, to: index });
      else if (state.pantry[index]) {
        selected = index;
        render();
        feedback(result.message);
      } else feedback(result.message);
      focus(`[data-town-cell="${index}"]`);
    };
    root.querySelectorAll("[data-town-cell]").forEach((element) => {
      const index = Number(element.dataset.townCell);
      element.onclick = () => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        select(index);
      };
      element.onpointerdown = (event) => {
        if (!state.pantry[index] || event.button !== 0) return;
        const start = { x: event.clientX, y: event.clientY },
          type = state.pantry[index].type;
        let moved = false,
          ghost = null;
        element.setPointerCapture(event.pointerId);
        const clean = () => {
          element.removeEventListener("pointermove", move);
          element.removeEventListener("pointerup", end);
          element.removeEventListener("pointercancel", clean);
          ghost?.remove();
        };
        const move = (next) => {
          if (Math.hypot(next.clientX - start.x, next.clientY - start.y) > 7)
            moved = true;
          if (!moved) return;
          if (!ghost) {
            ghost = document.createElement("div");
            ghost.className = "town-drag-ghost";
            ghost.innerHTML = townIcon(type);
            document.body.append(ghost);
          }
          ghost.style.left = next.clientX + "px";
          ghost.style.top = next.clientY + "px";
        };
        const end = (next) => {
          clean();
          if (moved) {
            suppressClick = true;
            const target = document
              .elementFromPoint(next.clientX, next.clientY)
              ?.closest("[data-town-cell]");
            if (target && root.contains(target))
              run({
                type: "drop",
                from: index,
                to: Number(target.dataset.townCell),
              });
            setTimeout(() => (suppressClick = false), 0);
          }
        };
        element.addEventListener("pointermove", move);
        element.addEventListener("pointerup", end);
        element.addEventListener("pointercancel", clean);
      };
    });
  }
  render();
  return () => {
    disposed = true;
    document.querySelectorAll(".town-drag-ghost").forEach((el) => el.remove());
  };
}
