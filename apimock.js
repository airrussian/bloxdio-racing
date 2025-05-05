const players = new Map();

players.set("-1", {
    name: "AIRRUSSIA",
    db: "hashdbidcode",
    physicsState: { type: 0, tier: 0  },
    effects: [],
    pose: "standart",
    position: [0,0,0]
});

exports.api = {
    getPlayerDbId(pId) {
        return players.get(pId)?.db;
    },
    getEntityName(pId) {
        return players.get(pId)?.name;
    },
    now() {
        return Date.now();
    },
    setPlayerPhysicsState( pId, state ) {
        if ( !players.has(pId) ) 
            throw new Error("Not player");
        players.get(pId).physicsState = state;
    },
    getPlayerPhysicsState( pId ) {
        return players.get(pId)?.physicsState
    },
    applyEffect( pId, effect, timer, options ) {
        players.get(pId).effects.push( {effect, timer, options} );
    },
    updateEntityNodeMeshAttachment( pId, nodeMesh, typeMesh, option, offset, rotation ) {
        return true;
    },
    setPlayerPose( pId, pose ) {
        players.get(pId).pose = pose;   
    },
    setPosition( pId, position ) {
        players.get(pId).position = position
    }
}

exports.players = players;