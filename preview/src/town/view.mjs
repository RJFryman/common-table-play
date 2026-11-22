// Pure templates for the town map, pantry, places and menus; commands stay in ui.mjs.
import {
  townGuide,
  townBuildings,
  townOrderOptions,
  townRecipeOptions,
  townCurrentOrder,
  townProduction,
} from "./engine.mjs";
import { TOWN_ITEMS, TOWN_BUILDINGS } from "./content.mjs";
import { townIcon, townScene, TOWN_PLACES } from "./art.mjs";
const generator = {
  farm: "field",
  garden: "garden",
  coop: "coop",
  barn: "barn",
};
const purpose = {
  garden: "Grow herbs and harvest wheat in bundles.",
  coop: "Feed grain for eggs and new baking.",
  barn: "Feed grain for milk and richer bread.",
};
const label = (id) => TOWN_BUILDINGS[id]?.name || "Town";
export function townViews({
  state,
  view,
  selected,
  history,
  selectedRecipe,
  helpRequested,
  earlier,
  esc,
  feedbackMarkup,
}) {
  const guidanceOn = () => state.served === 0 || helpRequested;
  function guideMarkup() {
    if (!guidanceOn())
      return '<div class="town-help"><button id="town-hint-toggle" aria-expanded="false">Need an idea?</button></div>';
    const step = townGuide(state),
      atPlace = view === step.building;
    const route = atPlace
      ? ""
      : `<button id="town-next" class="primary">Go to ${esc(label(step.building).toLowerCase())}</button>`;
    return /* HTML */ `<div class="town-guide">
        <span class="guide-arrow" aria-hidden="true">→</span>
        <p>${esc(step.text)}</p>
        ${route}
      </div>
      ${state.served ? '<div class="town-help is-open"><button id="town-hint-toggle" aria-expanded="true">Hide idea</button></div>' : ""}`;
  }
  function map() {
    const step = guidanceOn() ? townGuide(state) : null;
    const places = townBuildings(state).filter((place) => place.visible);
    return /* HTML */ `<section class="town-home" aria-labelledby="town-title">
      <div class="town-intro">
        <span class="town-eyebrow">A little place, made by you</span>
        <h1 id="town-title">From grain to a town.</h1>
      </div>
      <div class="town-map">
        ${townScene(state)}
        <div class="town-places">
          ${places
            .map((place) => {
              const p = TOWN_PLACES[place.id];
              if (!p) return "";
              return /* HTML */ `<button
                class="town-place ${step?.building === place.id ? "is-next" : ""} ${place.built ? "" : place.available ? "is-build" : "is-future"}"
                data-place="${place.id}"
                style="left:${p.labelX ?? p.x}%;top:${p.labelY ?? p.y}%"
                aria-label="${place.built ? "Visit" : place.available ? "Build" : "View"} ${esc(place.name)}${place.built ? "" : ", " + place.cost + " coins" + (place.reason ? ", " + esc(place.reason) : "")}"
              >
                <span>${esc(place.name)}</span
                >${place.built ? "" : `<small>${place.cost} coins</small>`}
              </button>`;
            })
            .join("")}
        </div>
      </div>
      ${guideMarkup()}
      <p class="town-home-note">
        One town. One shared pantry. Your progress stays.
      </p>
    </section>`;
  }
  function board() {
    let cue = guidanceOn() ? townGuide(state).cue : null;
    // The first loaf teaches milling/baking; the first harvest still needs a local merge cue.
    if (!cue && view === "farm" && state.served === 1) {
      for (const type of ["sheaf", "sprig"]) {
        const pair = state.pantry
          .flatMap((item, i) => (item?.type === type ? [i] : []))
          .slice(0, 2);
        if (pair.length === 2) {
          cue = { kind: "merge", indices: pair };
          break;
        }
      }
    }
    const indices = cue?.indices || [];
    return /* HTML */ `<div class="town-pantry-heading">
        <h2>Shared pantry</h2>
        <span>${state.pantry.filter(Boolean).length}/30</span>
      </div>
      <div class="town-board" role="group" aria-label="Shared town pantry">
        ${state.pantry.map((item, i) => /* HTML */ `<button class="town-cell ${selected === i ? "is-selected" : ""} ${indices.includes(i) ? "is-cued" : ""}" data-town-cell="${i}" aria-pressed="${selected === i}" aria-label="Row ${Math.floor(i / 6) + 1}, column ${(i % 6) + 1}: ${item ? esc(TOWN_ITEMS[item.type].name) : "empty"}">${item ? townIcon(item.type) : ""}${indices.includes(i) ? '<i class="town-cue-dot" aria-hidden="true"></i>' : ""}</button>`).join("")}
      </div>`;
  }
  function activity() {
    const place = townBuildings(state).find((x) => x.id === view),
      order = townCurrentOrder(state),
      recipes = townRecipeOptions(state).filter((recipe) => recipe.available);
    let action = "";
    if (!place.built)
      action = /* HTML */ `<div class="town-improvement">
        <span class="town-eyebrow">A new part of your town</span>
        <h1>${esc(place.name)}</h1>
        <p>${esc(purpose[place.id] || "A new part of your town.")}</p>
        <p>${esc(place.reason || "Ready to open.")}</p>
        <button
          id="town-build"
          class="primary"
          ${place.available ? "" : "disabled"}
        >
          Build · ${place.cost} coins
        </button>
      </div>`;
    else if (generator[view]) {
      const production = townProduction(state, generator[view]);
      const feeding = production.inputs.length > 0;
      const title =
        view === "farm"
          ? "Grow a little wheat"
          : view === "garden"
            ? "Fresh garden herbs"
            : view === "coop"
              ? "Feed the chickens"
              : "Feed the cow";
      const detail = feeding
        ? `${production.inputCount} grain sack → ${production.count} ${production.output === "egg" ? "eggs" : "milk"}`
        : view === "farm"
          ? production.output === "sheaf"
            ? "Bundled wheat · two sheaves make a grain sack."
            : "Merge matching wheat into a grain sack."
          : "For a fragrant loaf in your kitchen.";
      action = /* HTML */ `<div class="town-work-action">
          <span class="town-action-art">${townIcon(production.output)}</span
          ><span
            ><strong>${esc(title)}</strong><small>${esc(detail)}</small></span
          ><button
            id="town-produce"
            class="primary"
            ${production.canMake ? "" : "disabled"}
          >
            ${feeding ? "Feed grain" : "Harvest"}
          </button>
        </div>
        ${!production.canMake ? /* HTML */ `<p class="town-production-reason">${esc(production.reason)}</p>` : ""}`;
    } else if (view === "mill")
      action = /* HTML */ `<div class="town-work-action">
        <span class="town-process"
          >${townIcon("grain")}<i aria-hidden="true">→</i
          >${townIcon("flour")}</span
        ><span
          ><strong>Grain into flour</strong
          ><small>Your kitchen shares this pantry.</small></span
        ><button
          id="town-mill"
          class="primary"
          ${state.pantry.some((x) => x?.type === "grain") ? "" : "disabled"}
        >
          Mill
        </button>
      </div>`;
    else if (view === "kitchen") {
      const recipe =
        recipes.find((x) => x.id === selectedRecipe) ||
        recipes.find((x) => x.id === order.type) ||
        recipes[0];
      const picker =
        recipes.length > 1
          ? /* HTML */ `<label class="town-recipe-choice"
              ><span>Recipe</span
              ><select id="town-recipe" aria-label="Choose a kitchen recipe">
                ${recipes.map((option) => /* HTML */ `<option value="${option.id}" ${option.id === recipe.id ? "selected" : ""}>${esc(option.name)} · ${option.reward} coins${option.id === order.type ? " · market order" : ""}</option>`).join("")}
              </select></label
            >`
          : "";
      action = /* HTML */ `<div class="town-kitchen-actions">
        ${picker}
        <div class="town-work-action">
          <span class="town-action-art">${townIcon(recipe.output)}</span
          ><span
            ><strong>${esc(recipe.name)}</strong
            ><small
              >${recipe.inputs.map((type) => esc(TOWN_ITEMS[type].name)).join(" + ")}${recipe.id === "loaf" ? " · basic baking supplies included" : ""}</small
            ></span
          ><button
            data-town-bake="${recipe.id}"
            class="primary"
            ${recipe.canMake ? "" : "disabled"}
          >
            Bake
          </button>
        </div>
      </div>`;
    } else if (view === "market")
      action = /* HTML */ `<div class="town-work-action">
        <span class="town-action-art">${townIcon(order.type)}</span
        ><button
          id="town-order-pick"
          class="town-order-name"
          ${state.served ? "" : "disabled"}
        >
          <strong>${esc(order.name)}${state.served ? " ▾" : ""}</strong
          ><small
            >${order.reward}
            coins${order.request ? " · town request" : ""}${state.served ? " · choose an order" : " · first order"}</small
          ></button
        ><button
          id="town-serve"
          class="primary"
          ${state.pantry.some((x) => x?.type === order.type) ? "" : "disabled"}
        >
          Serve
        </button>
      </div>`;
    return /* HTML */ `<section
      class="town-activity ${esc(view)}"
      aria-label="${esc(label(view))}"
    >
      ${action}${place.built ? `${board()}<div class="town-board-tools">${selected !== null && state.pantry[selected] ? /* HTML */ `<span>${esc(TOWN_ITEMS[state.pantry[selected].type].name)}</span><button id="town-remove">Remove</button>` : "<span>Everything you make stays in this pantry.</span>"}<button id="town-undo" ${history.length ? "" : "disabled"}>Undo</button></div>` : ""}${guideMarkup()}
    </section>`;
  }
  function orderPage() {
    return /* HTML */ `<section class="town-menu">
      <h1>Choose an order</h1>
      <p class="town-order-intro">
        A small bake or something richer. Each order waits for you. After three
        specialty sales, the town offers 20 coins for a plain loaf. That request
        stays until you fill it.
      </p>
      ${townOrderOptions(state)
        .filter((option) => option.available)
        .map(
          (option) =>
            `<article class="town-order-card"><span>${townIcon(option.type)}</span><div><h2>${esc(option.name)}</h2><p>${option.reward} coins${option.request ? " · standing town request" : ""}</p></div><button data-town-order="${option.type}" ${option.selected ? "disabled" : ""}>${option.selected ? "Current" : "Choose"}</button></article>`,
        )
        .join("")}
    </section>`;
  }
  function menu() {
    return /* HTML */ `<section class="town-menu">
      <h1>Your little town</h1>
      <section class="town-menu-card">
        <h2>Your save</h2>
        <p>
          Saved automatically in this browser. Export a copy to move your town.
        </p>
        <button id="town-export">Export town</button
        ><button id="town-export-backup">Export prior save</button
        ><label
          >Import town<input
            id="town-import"
            type="file"
            accept="application/json,.json"
        /></label>
        <p class="small">Import keeps your previous file as a backup.</p>
      </section>
      <details class="town-menu-card">
        <summary>How this town works</summary>
        <p>
          Mill grain into flour. Bake bread, then sell it at the market.
          Earnings open the garden and, later, animals with new ingredients.
        </p>
        <p>
          Tap matching wheat pieces to merge them, or drag one onto the other.
          Every building uses the same pantry.
        </p>
        <p>
          Basic water and baking supplies are included. There are no delivery
          chores between your own buildings.
        </p>
      </details>
      <details class="town-menu-card">
        <summary>Recent moments</summary>
        ${state.journal.map((text) => /* HTML */ `<p>${esc(text)}</p>`).join("") || "<p>Your town starts with a little grain.</p>"}
      </details>
      ${earlier ? '<a class="town-classic" href="?classic=1">Continue your earlier farm →</a><p class="small">Your earlier farm is saved separately and has not been changed.</p>' : ""}
      ${feedbackMarkup}
      <p class="town-solo-note">
        A solo town for now. Shared online play is still to come.
      </p>
    </section>`;
  }
  return { map, activity, menu, orderPage };
}
