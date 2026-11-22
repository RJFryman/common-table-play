// Authored ingredients, recipes and earned places for one connected town.
const freeze=value=>{for(const nested of Object.values(value))if(nested&&typeof nested==='object')freeze(nested);return Object.freeze(value);};
export const TOWN_WIDTH=6,TOWN_HEIGHT=5;
export const TOWN_ITEMS=freeze({
 sprig:{name:'Wheat sprig',next:'sheaf'},sheaf:{name:'Wheat sheaf',next:'grain'},
 grain:{name:'Grain sack'},flour:{name:'Flour'},loaf:{name:'Country loaf'},
 herb:{name:'Garden herbs'},herbloaf:{name:'Herb loaf'},
 egg:{name:'Egg'},milk:{name:'Milk'},eggbun:{name:'Egg bun'},milkbun:{name:'Milk bun'}
});
export const TOWN_RECIPES=freeze({
 loaf:{name:'Country loaf',inputs:['flour'],output:'loaf',reward:12,building:'kitchen',requires:null},
 herbloaf:{name:'Herb loaf',inputs:['flour','herb'],output:'herbloaf',reward:18,building:'kitchen',requires:'garden'},
 eggbun:{name:'Egg bun',inputs:['flour','egg'],output:'eggbun',reward:20,building:'kitchen',requires:'coop'},
 milkbun:{name:'Milk bun',inputs:['flour','milk'],output:'milkbun',reward:24,building:'kitchen',requires:'barn'}
});
export const TOWN_BUILDINGS=freeze({
 farm:{name:'Wheat field',cost:0,sales:0},mill:{name:'Mill',cost:0,sales:0},
 kitchen:{name:'Kitchen',cost:0,sales:0},market:{name:'Market stall',cost:0,sales:0},
 garden:{name:'Garden square',cost:12,sales:1},
 coop:{name:'Chicken coop',cost:24,sales:3,requires:'garden'},
 barn:{name:'Cow barn',cost:60,sales:8,requires:'coop'}
});
export const TOWN_GENERATORS=freeze({
 field:{name:'Wheat field',inputs:[],output:'sprig',count:1,building:'farm'},
 garden:{name:'Garden square',inputs:[],output:'herb',count:1,building:'garden',requires:'garden'},
 coop:{name:'Chicken coop',inputs:['grain'],output:'egg',count:3,building:'coop',requires:'coop'},
 barn:{name:'Cow barn',inputs:['grain'],output:'milk',count:2,building:'barn',requires:'barn'}
});
