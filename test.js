const worldcode = require("./worldcode");
const { players } = require("./apimock");

setInterval( () => worldcode.tick(20), 20 );

setTimeout(() => {
    worldcode.onPlayerJoin( "-1" );
}, 1000);

setInterval( () => console.log( players, worldcode.world ), 1000 );