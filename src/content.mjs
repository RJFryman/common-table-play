export const ITEMS={
 sprig:{name:'Wheat sprig',next:'sheaf',family:'grain',tier:0},sheaf:{name:'Wheat sheaf',next:'grain',family:'grain',tier:1},grain:{name:'Grain sack',family:'grain',tier:2},
 tomato:{name:'Tomato',next:'vine',family:'garden',tier:0},vine:{name:'Tomato vine',next:'basket',family:'garden',tier:1},basket:{name:'Tomato basket',family:'garden',tier:2},
 milk:{name:'Milk',next:'cream',family:'dairy',tier:0},cream:{name:'Cream',next:'cheese',family:'dairy',tier:1},cheese:{name:'Cheese',family:'dairy',tier:2},
 loaf:{name:'Country loaf',family:'recipe',tier:0},sandwich:{name:'Garden sandwich',family:'recipe',tier:1}
};
export const RECIPES={loaf:{name:'Bake a country loaf',inputs:['grain','milk'],output:'loaf',note:'Grain + milk. Milling and baking are compressed into one action in this experiment.'},sandwich:{name:'Assemble a garden sandwich',inputs:['loaf','cheese','basket'],output:'sandwich',note:'A loaf + cheese + a tomato basket.'}};
export const GENERATORS={grain:{name:'Wheat plot',output:'sprig'},garden:{name:'Tomato patch',output:'tomato'},dairy:{name:'Dairy pantry',output:'milk'}};
export const ORDER_ITEMS=['loaf','sandwich','loaf','sandwich'];
export const WIDTH=6,HEIGHT=5;
