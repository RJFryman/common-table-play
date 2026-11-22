// Pure shared-pantry town commands: harvest → mill → bake → sell → earn a new place.
import {
  TOWN_ITEMS,
  TOWN_RECIPES,
  TOWN_BUILDINGS,
  TOWN_GENERATORS,
  TOWN_WIDTH,
  TOWN_HEIGHT,
} from "./content.mjs";
const own = (object, key) =>
  typeof key === "string" && Object.hasOwn(object, key);
const copy = (state) => structuredClone(state);
const SIZE = TOWN_WIDTH * TOWN_HEIGHT,
  MAX = Number.MAX_SAFE_INTEGER;
const units = (type, count) =>
  type === "milk"
    ? `${count} bottles of milk`
    : `${count} ${TOWN_ITEMS[type].name.toLowerCase()}${count > 1 ? "s" : ""}`;
const PLACE_ITEMS = {
  herb: "garden",
  herbloaf: "garden",
  egg: "coop",
  eggbun: "coop",
  milk: "barn",
  milkbun: "barn",
};
function item(s, type) {
  return { id: `town-item-${s.next++}`, type };
}
export function newTown() {
  const state = {
    schema: 1,
    kind: "town",
    next: 1,
    revision: 0,
    pantry: Array(SIZE).fill(null),
    coins: 0,
    served: 0,
    unlocks: { garden: false, coop: false, barn: false },
    journal: [],
  };
  state.pantry[0] = item(state, "grain");
  return state;
}
export function validateTown(s) {
  if (!s || s.schema !== 1 || s.kind !== "town")
    throw Error("Unsupported town save. The original is preserved.");
  for (const key of ["next", "revision", "coins", "served"])
    if (!Number.isSafeInteger(s[key]) || s[key] < 0)
      throw Error("Invalid town counter.");
  if (s.next < 1 || !Array.isArray(s.pantry) || s.pantry.length !== SIZE)
    throw Error("Invalid town pantry.");
  if (
    !s.unlocks ||
    typeof s.unlocks !== "object" ||
    Array.isArray(s.unlocks) ||
    Object.keys(s.unlocks).length !== 3
  )
    throw Error("Invalid town places.");
  for (const id of ["garden", "coop", "barn"]) {
    if (typeof s.unlocks[id] !== "boolean") throw Error("Invalid town place.");
    if (
      s.unlocks[id] &&
      (s.served < TOWN_BUILDINGS[id].sales ||
        (TOWN_BUILDINGS[id].requires &&
          !s.unlocks[TOWN_BUILDINGS[id].requires]))
    )
      throw Error("Town place was not earned.");
  }
  const ids = new Set();
  let max = 0;
  for (const x of s.pantry) {
    if (x === null) continue;
    if (
      !x ||
      typeof x.id !== "string" ||
      !/^town-item-[1-9]\d*$/.test(x.id) ||
      !own(TOWN_ITEMS, x.type) ||
      ids.has(x.id)
    )
      throw Error("Invalid or duplicate town item.");
    const serial = Number(x.id.slice(10));
    if (!Number.isSafeInteger(serial))
      throw Error("Invalid town item identity.");
    if (PLACE_ITEMS[x.type] && !s.unlocks[PLACE_ITEMS[x.type]])
      throw Error("This ingredient needs its town place.");
    ids.add(x.id);
    max = Math.max(max, serial);
  }
  if (s.next <= max) throw Error("Invalid town item sequence.");
  if (
    own(s, "orderChoice") &&
    (!own(TOWN_RECIPES, s.orderChoice) ||
      s.served === 0 ||
      !recipeUnlocked(s, TOWN_RECIPES[s.orderChoice]))
  )
    throw Error("Invalid town order choice.");
  if (
    own(s, "plainDemand") &&
    (!Number.isInteger(s.plainDemand) || s.plainDemand < 0 || s.plainDemand > 3)
  )
    throw Error("Invalid town request.");
  if (
    !Array.isArray(s.journal) ||
    s.journal.length > 60 ||
    s.journal.some((text) => typeof text !== "string" || text.length > 300)
  )
    throw Error("Invalid town journal.");
  return s;
}
function recipeUnlocked(s, recipe) {
  return !recipe.requires || s.unlocks[recipe.requires];
}
function indicesFor(s, inputs) {
  const used = [];
  for (const type of inputs) {
    const index = s.pantry.findIndex(
      (x, i) => x?.type === type && !used.includes(i),
    );
    if (index < 0) return null;
    used.push(index);
  }
  return used;
}
// A standing request never expires; specialty sales create a reason to bake plain bread again.
function rewardFor(s, type) {
  return type === "loaf" && s.unlocks.garden && (s.plainDemand || 0) === 3
    ? 20
    : TOWN_RECIPES[type].reward;
}
export function townCurrentOrder(s) {
  const type =
      s.orderChoice ||
      (s.unlocks.barn
        ? "milkbun"
        : s.unlocks.coop
          ? "eggbun"
          : s.unlocks.garden
            ? "herbloaf"
            : "loaf"),
    recipe = TOWN_RECIPES[type];
  return {
    type,
    name: TOWN_ITEMS[type].name,
    reward: rewardFor(s, type),
    request: rewardFor(s, type) > recipe.reward,
  };
}
export function townOrderOptions(s) {
  const current = townCurrentOrder(s);
  return Object.entries(TOWN_RECIPES).map(([type, r]) => ({
    type,
    name: r.name,
    reward: rewardFor(s, type),
    request: rewardFor(s, type) > r.reward,
    selected: type === current.type,
    available: s.served > 0 && recipeUnlocked(s, r),
  }));
}
export function townRecipeOptions(s) {
  return Object.entries(TOWN_RECIPES).map(([id, r]) => ({
    ...r,
    id,
    reward: rewardFor(s, id),
    available: recipeUnlocked(s, r),
    canMake: recipeUnlocked(s, r) && !!indicesFor(s, r.inputs),
    reason:
      r.requires && !s.unlocks[r.requires]
        ? `Build the ${TOWN_BUILDINGS[r.requires].name.toLowerCase()} first.`
        : "",
    command: { type: "bake", recipe: id },
  }));
}
// Input multisets and complete batch capacity are shared by the engine and presentation.
export function townProduction(s, id) {
  if (!own(TOWN_GENERATORS, id)) return null;
  const g = TOWN_GENERATORS[id],
    inputs = [...g.inputs],
    used = indicesFor(s, inputs);
  const oddStem =
    s.pantry.filter((item) => item?.type === "sprig").length % 2 === 1;
  const output =
    id === "field" && s.unlocks.garden && !oddStem ? "sheaf" : g.output;
  const available = !g.requires || s.unlocks[g.requires];
  const room =
    used !== null &&
    s.pantry.filter((x) => x === null).length + used.length >= g.count;
  const reason = !available
    ? `Build the ${TOWN_BUILDINGS[g.requires].name.toLowerCase()} first.`
    : used === null
      ? `Bring ${inputs.map((type) => TOWN_ITEMS[type].name).join(" + ")} to feed the animals.`
      : !room
        ? `Make room for ${units(output, g.count)} first.`
        : "";
  return {
    id,
    name: g.name,
    building: g.building,
    inputs,
    inputCount: inputs.length,
    output,
    count: g.count,
    available,
    canMake: available && used !== null && room,
    reason,
    command: { type: "spawn", generator: id },
  };
}
export function townBuildings(s) {
  return Object.entries(TOWN_BUILDINGS).map(([id, b]) => {
    const base = !own(s.unlocks, id),
      built = base || s.unlocks[id],
      prerequisite = !b.requires || s.unlocks[b.requires];
    const visible = base || id === "garden" || Boolean(s.unlocks[b.requires]);
    const reasons = [];
    if (!built) {
      if (!prerequisite)
        reasons.push(
          `Build the ${TOWN_BUILDINGS[b.requires].name.toLowerCase()}`,
        );
      if (s.served < b.sales)
        reasons.push(
          `Serve ${b.sales - s.served} more ${b.sales - s.served === 1 ? "order" : "orders"}`,
        );
      if (s.coins < b.cost) reasons.push(`${b.cost - s.coins} more coins`);
    }
    return {
      id,
      name: b.name,
      visible,
      built,
      available:
        built || (prerequisite && s.served >= b.sales && s.coins >= b.cost),
      cost: b.cost,
      requiredSales: b.sales,
      reason: reasons.join(" · "),
      command: built ? null : { type: "build", building: id },
    };
  });
}
export function townCommand(state, c) {
  validateTown(state);
  const fail = (message) => ({ state, changed: false, message });
  if (!c || typeof c !== "object") return fail("Choose a town action.");
  if (state.revision >= MAX || state.next > MAX - 4)
    return fail(
      "The town ledger is full. Export this world before continuing.",
    );
  const s = copy(state),
    slot = (index) => Number.isInteger(index) && index >= 0 && index < SIZE;
  let message;
  switch (c.type) {
    case "spawn": {
      const production = townProduction(s, c.generator);
      if (!production) return fail("Choose a source in your town.");
      if (!production.canMake) return fail(production.reason);
      const used = indicesFor(s, production.inputs);
      for (const index of used) s.pantry[index] = null;
      for (let i = 0; i < production.count; i++)
        s.pantry[s.pantry.indexOf(null)] = item(s, production.output);
      message = production.inputs.length
        ? `Fed a grain sack. Collected ${units(production.output, production.count)}.`
        : `Collected ${TOWN_ITEMS[production.output].name}.`;
      break;
    }
    case "drop": {
      if (!slot(c.from) || !slot(c.to) || c.from === c.to || !s.pantry[c.from])
        return fail("Choose an item and another square.");
      const source = s.pantry[c.from],
        target = s.pantry[c.to];
      if (!target) {
        s.pantry[c.to] = source;
        s.pantry[c.from] = null;
        message = `Moved ${TOWN_ITEMS[source.type].name}.`;
      } else if (source.type === target.type && TOWN_ITEMS[source.type].next) {
        s.pantry[c.to] = item(s, TOWN_ITEMS[source.type].next);
        s.pantry[c.from] = null;
        message = `Merged ${TOWN_ITEMS[s.pantry[c.to].type].name}.`;
      } else
        return fail("Choose a matching piece to merge, or an empty square.");
      break;
    }
    case "remove": {
      if (!slot(c.index) || !s.pantry[c.index])
        return fail("Choose an item to remove.");
      message = `Removed ${TOWN_ITEMS[s.pantry[c.index].type].name}. Undo can restore it.`;
      s.pantry[c.index] = null;
      break;
    }
    case "mill": {
      const index =
        c.index === undefined
          ? s.pantry.findIndex((x) => x?.type === "grain")
          : c.index;
      if (!slot(index) || s.pantry[index]?.type !== "grain")
        return fail("Bring a grain sack to the mill.");
      s.pantry[index] = item(s, "flour");
      message = "Milled grain into flour. It is ready in your shared pantry.";
      break;
    }
    case "bake": {
      if (!own(TOWN_RECIPES, c.recipe)) return fail("Choose a kitchen recipe.");
      const r = TOWN_RECIPES[c.recipe];
      if (!recipeUnlocked(s, r))
        return fail(
          `Build the ${TOWN_BUILDINGS[r.requires].name.toLowerCase()} first.`,
        );
      const indices = indicesFor(s, r.inputs);
      if (!indices)
        return fail(
          `Gather ${r.inputs.map((type) => TOWN_ITEMS[type].name).join(" + ")} in your pantry.`,
        );
      for (const index of indices) s.pantry[index] = null;
      s.pantry[indices[0]] = item(s, r.output);
      message = `Baked ${r.name}.`;
      break;
    }
    case "choose_order": {
      if (s.served === 0)
        return fail("Bake and serve your first country loaf first.");
      if (
        !own(TOWN_RECIPES, c.order) ||
        !recipeUnlocked(s, TOWN_RECIPES[c.order])
      )
        return fail("Choose an order your town can make.");
      if (townCurrentOrder(s).type === c.order)
        return fail("That is already your current order.");
      s.orderChoice = c.order;
      message = `Chose ${TOWN_ITEMS[c.order].name}. Serve it to earn ${rewardFor(s, c.order)} coins.`;
      break;
    }
    case "serve": {
      const order = townCurrentOrder(s),
        index = s.pantry.findIndex((x) => x?.type === order.type);
      if (index < 0) return fail(`This order needs ${order.name}.`);
      if (s.coins > MAX - order.reward || s.served >= MAX)
        return fail(
          "The town ledger is full. Export this world before continuing.",
        );
      s.pantry[index] = null;
      s.coins += order.reward;
      s.served++;
      s.orderChoice = order.type;
      if (order.type !== "loaf")
        s.plainDemand = Math.min(3, (s.plainDemand || 0) + 1);
      else if (order.request) s.plainDemand = 0;
      message = `Served ${order.name}. Earned ${order.reward} coins.`;
      break;
    }
    case "build": {
      if (!own(s.unlocks, c.building))
        return fail("Choose an improvement for your town.");
      if (s.unlocks[c.building]) return fail("That place is already open.");
      const b = TOWN_BUILDINGS[c.building];
      if (b.requires && !s.unlocks[b.requires])
        return fail(
          `Build the ${TOWN_BUILDINGS[b.requires].name.toLowerCase()} first.`,
        );
      if (s.served < b.sales)
        return fail(
          `Serve ${b.sales - s.served} more ${b.sales - s.served === 1 ? "order" : "orders"} first.`,
        );
      if (s.coins < b.cost)
        return fail(`This improvement needs ${b.cost} coins.`);
      // Capture legacy defaults before the unlock changes the available recipe set.
      s.orderChoice = townCurrentOrder(s).type;
      s.coins -= b.cost;
      s.unlocks[c.building] = true;
      message = {
        garden: "Planted herbs. The field now harvests wheat bundles.",
        coop: "Opened the chicken coop. Choose egg buns at the market when you are ready.",
        barn: "Opened the cow barn. Choose milk buns at the market when you are ready.",
      }[c.building];
      break;
    }
    default:
      return fail("Choose a town action.");
  }
  s.revision++;
  s.journal = [message, ...s.journal].slice(0, 60);
  validateTown(s);
  return { state: s, changed: true, message };
}
// One causal suggestion, with a visual target; never mutates the world or performs an action.
export function townGuide(s) {
  const build = townBuildings(s).find((b) => !b.built && b.available);
  if (build)
    return {
      text: `Open your ${build.name.toLowerCase()} · ${build.cost} coins.`,
      building: build.id,
      command: build.command,
      cue: { kind: "building", building: build.id },
    };
  const order = townCurrentOrder(s),
    ready = s.pantry.findIndex((x) => x?.type === order.type);
  if (ready >= 0)
    return {
      text: `Your ${order.name.toLowerCase()} is ready for the market.`,
      building: "market",
      command: { type: "serve" },
      cue: { kind: "serve", indices: [ready] },
    };
  const recipe = TOWN_RECIPES[order.type];
  if (indicesFor(s, recipe.inputs))
    return {
      text: `Bake ${recipe.name.toLowerCase()} in your kitchen.`,
      building: "kitchen",
      command: { type: "bake", recipe: order.type },
      cue: { kind: "recipe", recipe: order.type },
    };
  const missingInputs = recipe.inputs.filter(
    (type) => !s.pantry.some((x) => x?.type === type),
  );
  const missing =
    missingInputs.find((type) => type !== "flour") || missingInputs[0];
  if (missing === "egg" || missing === "milk" || missing === "herb") {
    const generator =
        missing === "egg" ? "coop" : missing === "milk" ? "barn" : "garden",
      production = townProduction(s, generator);
    if (production.canMake)
      return {
        text:
          missing === "herb"
            ? "Harvest herbs for your kitchen."
            : `Feed one grain sack for ${units(missing, production.count)}.`,
        building: generator,
        command: production.command,
        cue: { kind: "generator", generator },
      };
    if (production.inputs.length && !s.pantry.some((x) => x?.type === "grain"))
      return growGrain(
        s,
        `Grow grain to feed the ${generator === "coop" ? "chickens" : "cow"}.`,
      );
    return spaceGuide();
  }
  const grain = s.pantry.findIndex((x) => x?.type === "grain");
  if (grain >= 0)
    return {
      text: "Mill your grain into flour.",
      building: "mill",
      command: { type: "mill", index: grain },
      cue: { kind: "mill", indices: [grain] },
    };
  return growGrain(
    s,
    `Harvest wheat for your next ${order.name.toLowerCase()}.`,
  );
}
function growGrain(s, text) {
  for (const type of ["sheaf", "sprig"]) {
    const pair = s.pantry
      .flatMap((x, i) => (x?.type === type ? [i] : []))
      .slice(0, 2);
    if (pair.length === 2)
      return {
        text: `Merge the two ${TOWN_ITEMS[type].name.toLowerCase()} pieces.`,
        building: "farm",
        command: { type: "drop", from: pair[0], to: pair[1] },
        cue: { kind: "merge", indices: pair },
      };
  }
  return s.pantry.includes(null)
    ? {
        text,
        building: "farm",
        command: { type: "spawn", generator: "field" },
        cue: { kind: "generator", generator: "field" },
      }
    : spaceGuide();
}
function spaceGuide() {
  return {
    text: "Your pantry is full. Merge, mill, bake, sell or remove an item to make room.",
    building: "farm",
    cue: { kind: "space" },
  };
}
