/**
 * Код для тестирования идеи пересечения чекпоита
 */

class Member { 

    constructor( player, event ) {
        this.player = player;
        this.event = event;
        this.lastTick = 0;
        this.lastPos = [0, 0, 0];
        this.v = [0, 0, 0];
        this.lastCheckpoint = -1;
        this.distanceNextCheckpoint = Infinity;      
		this.checkpoints = [];  
		this.pos = [];
    } 


    tick( now ) {
        var pos = api.getPosition( this.player.pId );		
		this.pos = pos;
        
        if ( !this.lastTick ) {
            this.lastTick = now;
            this.lastPos = pos;
            return;
        }              

        var dt = now - this.lastTick;
        this.v = pos.map( (coord, i) => Math.abs(coord - this.lastPos[i]) * 1000 / dt );         

        var crossTime = this.event.crossPoint( this, pos );
        if ( crossTime ) {
            this.checkpoints.push( crossTime );
            this.player.showMiddleTextLower("Пересечение чек поинта", 2500);
        } 

        this.lastTick = now;
        this.lastPos = pos;
    }

}

class Members {

    constructor() {
        this.members = new Map();
    }

    joinPlayer( player, event ) {

        var member;
        if ( !this.members.has( player.db ) ) {
            member = new Member( player, event );
            this.members.set( player.db, member );
        }
        return this.members.get( player.db );    

    }

    leavePlayer( player, event ) {
        if ( !this.members.has( player.db ) ) 
            return;
        this.members.delete( player.db );        
    }

    tick( now ) {
        this.members.forEach( member => member.tick( now ));
    }

}

class Track {

    constructor( checkpoints ) {
        this.checkpoints = checkpoints;
    }

    getCheckpoint( index ) {
        return this.checkpoints[ index ];
    }

}

class Race {

    constructor( track ) {
        this.track = track;
        this.members = new Members();
    }

    tick( now ) {
        this.members.tick( now );
    }

    joinPlayer( player ) {
        this.members.joinPlayer( player, this );
    }

    leavePlayer( player ) {
        this.members.leavePlayer( player, this );
    }

    crossPoint( member, pos ) {

        var nextCheckpoint = 0;

        if ( member.lastCheckpoint < this.track.checkpoints.length - 1 ) 
            nextCheckpoint = member.lastCheckpoint + 1;

        const checkpoint = this.track.getCheckpoint( nextCheckpoint );

        var dx_pv_to_ch = member.lastPos[0] - checkpoint.center[0];
        var dz_pv_to_ch = member.lastPos[2] - checkpoint.center[2];

        const lsx = dx_pv_to_ch * checkpoint.norm[0];
        const lsz = dz_pv_to_ch * checkpoint.norm[2];

        var dx_ch_to_nw = pos[0] - checkpoint.center[0];
        var dz_ch_to_nw = pos[2] - checkpoint.center[2];

        const csx = dx_ch_to_nw * checkpoint.norm[0];
        const csz = dz_ch_to_nw * checkpoint.norm[2];

        var ls = lsx + lsz;
        var cs = csx + csz;

		var n1 = dx_pv_to_ch * (+!!checkpoint.norm[0]) + dz_pv_to_ch * (+!!checkpoint.norm[2])
        var n2 = checkpoint.norm[0] + checkpoint.norm[2];

		api.setClientOption( member.player.pId, "RightInfoText", 
				`Speed: ${(member.v[2]).toFixed(2)} \n` + 
				`lp: ${member.lastPos[2].toFixed(2)} now: ${pos[2].toFixed(2)} \n` + 
				`lt: ${(member.lastTick / 1000).toFixed(3)}, now: ${(Date.now() / 1000).toFixed(3)} \n` +
				`dt: ${((Date.now() - member.lastTick) / 1000).toFixed(3)}`
	        );

        if (ls * cs < 0) {
			
			if ( Math.sign( n1 ) === Math.sign( n2 ) ) {
            	var v = member.v[0] * checkpoint.norm[0] + member.v[2] * checkpoint.norm[2];
            	member.lastCheckpoint = nextCheckpoint;            
            	return member.lastTick + Math.abs( ls ) / v * 1000;
			}
        }
        return undefined;
    }

}

const checkPointTrack01 = [
    { center: [-671,2,-18], norm: [ 0, 1, -1] }, 
    { center: [-683,2,16], norm: [ 1, 1, 0] },
    { center: [-692,2,0], norm: [0, 1, 1] },
    { center: [-686,2,-28], norm: [ -1, 1, 0] }
];

class Player {

    constructor( db ) {
        this.db = db;
        this._pId = undefined;
        this._name = undefined;
        this.tasks = [];

        this.lt = 0;
    }

    set pId( pId ) {
        this._pId = pId;        
    }

    get pId() {
        return this._pId;
    }

    get name() {
        return this._name;
    }

    set name( name ) {
        this._name = name;        
    }

    showMiddleTextLower( text, duration ) {        
		console.log( text );
        api.setClientOption( this.pId, "middleTextUpper", text );
        const time = api.now() + duration;
        this.tasks.push( ( now ) => {
            if ( now < time ) return false;
            api.setClientOption( this.pId, "middleTextUpper", "" );
            return true;
        } )
    } 

    tick( now ) {        
        var completeTasks = this.tasks.reduce( (completeTasks, task, idx) => {
            if ( task( now ) ) completeTasks.push( idx );
            return completeTasks;
        }, []);	
	
        if ( now - this.lt > 1000 ) {
            console.log( this.tasks, completeTasks );
            this.lt = now;
        }

		completeTasks.forEach( () => {
			var idx = completeTasks.pop(); 
			this.tasks.splice( idx, 1 );        
		});
    }
    
}

class Players {

    constructor() {
        this.players = new Map();
        this.indexId = new Map();		
    }

    joinPlayer( pId ) {        
        var db = api.getPlayerDbId( pId );
        var player;
        
        if ( !this.players.has( db ) ) {
            player = new Player( db );
            player.name = api.getEntityName( pId );
            this.players.set( db, player);            
        }

        player = this.players.get( db );
		this.indexId.set( pId, db );
        player.pId = pId;
        return player;
    }

    leavePlayer( pId ) {
        var db = this.indexId.has(pId) ?? this.indexId.get( pId );
        if ( !db ) return undefined;
        this.indexId.delete( pId );        
        return this.players.has( db ) ?? this.players.get( db );
    }

    tick( now ) {
        this.players.forEach( player => player.tick( now ));
    }

}

class Events {

    constructor() {
        this.events = [];
    }

    tick( now ) {
        this.events.forEach( event => event.tick( now ));
    }

    addEvent( event ) {
        this.events.push( event );
    }

    getEvent( idx ) {
        return this.events?.[idx];
    }
}

class World {

    constructor() {
        this.players = new Players();      
        this.events = new Events();          
    }

    tick( now ) {
        this.events.tick( now );
        this.players.tick( now );
    }

    joinPlayer( pId ) {
        var player = this.players.joinPlayer( pId );

        // player.welcome();

        const event = this.events.getEvent(0);
        if ( event ) event.joinPlayer( player );
    }

    leavePlayer( pId ) {
        var player = this.players.leavePlayer( pId );            

        const event = this.events.getEvent(0);
        if ( event ) event.leavePlayer( player );
    }

	addEvent( event ) {
		this.events.addEvent( event );
	}

}

var world = new World();

var track = new Track(checkPointTrack01);
var race = new Race( track );
world.addEvent( race );

var tick = () => world.tick( Date.now() );
var onPlayerJoin = pId => world.joinPlayer( pId );
var onPlayerLeave = pId => world.leavePlayer( pId );
