export const ITEMS={
 sprig:{name:'Wheat sprig',next:'sheaf',family:'grain',tier:0},sheaf:{name:'Wheat sheaf',next:'grain',family:'grain',tier:1},grain:{name:'Grain sack',family:'grain',tier:2},
 tomato:{name:'Tomato',next:'vine',family:'garden',tier:0},vine:{name:'Tomato vine',next:'basket',family:'garden',tier:1},basket:{name:'Tomato basket',family:'garden',tier:2},
 milk:{name:'Milk',next:'cream',family:'dairy',tier:0},cream:{name:'Cream',next:'cheese',family:'dairy',tier:1},cheese:{name:'Cheese',family:'dairy',tier:2},
 loaf:{name:'Country loaf',family:'recipe',tier:0},sandwich:{name:'Garden sandwich',family:'recipe',tier:1}
};
export const RECIPES={loaf:{name:'Bake a country loaf',inputs:['grain','milk'],output:'loaf',note:'Grain + milk. Milling and baking are compressed into one action in this experiment.'},sandwich:{name:'Assemble a garden sandwich',inputs:['loaf','cheese','basket'],output:'sandwich',note:'A loaf + cheese + a tomato basket.'}};
export const GENERATORS={grain:{name:'Wheat plot',output:'sprig'},garden:{name:'Tomato patch',output:'tomato'},dairy:{name:'Dairy pantry',output:'milk'}};
export const ORDER_ITEMS=['loaf','sandwich','loaf','sandwich'];
// Orders pay only when a finished dish is served; choosing never grants a reward.
export const ORDER_REWARDS={loaf:12,sandwich:28};
export const WIDTH=6,HEIGHT=5;

// Food and produce make each permanent garden improvement tangible; nothing expires.
export const GARDEN_STAGES=[
 {name:'Overgrown',title:'Clear the garden beds',needs:{sheaf:2,loaf:1},cost:12},
 {name:'Cleared beds',title:'Plant the kitchen garden',needs:{vine:1,basket:1},cost:18},
 {name:'Kitchen garden',title:'Set a picnic table',needs:{loaf:2,cheese:1},cost:20},
 {name:'Picnic corner',title:'Welcome the rescue volunteers',needs:{sandwich:2},cost:24},
 {name:'Rescue garden',title:'Light the welcome lanterns',needs:{loaf:1,sandwich:1},cost:28}
];
export const GARDEN_DECOR={meadow:{name:'Meadow flowers',cost:30},sunset:{name:'Sunset flowers',cost:30},moonlight:{name:'Moonlight flowers',cost:30}};

// Places have different sources; the engine still accepts legacy local producer commands.
export const GENERATOR_SITES={farm:['grain','garden'],kitchen:['dairy']};
