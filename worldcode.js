var { api } = require("./apimock");
console.log( api );
/** 
 * CODE FOR GAME BLOXD.IO
 * @author Alexey <AIRRUSSIA> 
 * @version 1.0
 */
class Player {

    constructor( dbId, pId ) {
        this._id = pId;
        this.dbId = dbId;
        this.name = api.getEntityName( pId );
    }

    get pId() {
        return this._id;
    }

    join( pId ) {
        this._id = pId;
        this.lastVisited = api.now();
    }

    leave() {
        this._id = undefined;
        this.lastVisited = api.now();
    }

}

class PlayerRepository {

    constructor() {
        this.players = new Map();
        this.online = new Map();
    }

    join( pId ) {
        var dbId = api.getPlayerDbId( pId );

        if ( !this.players.has( dbId ) )        
            this.players.set( dbId, new Player( dbId, pId ) );        

        var player = this.players.get( dbId );
        player.join( pId );
        
        return player;
    }

    leave( pId ) {
        var dbId = this.online.get( pId );
        this.online.delete( pId );        

        return this.players.get( dbId );             
    }

    save( player ) {
        this.players.set( player.dbId, player );
    }

}

class Track {

    constructor( name, params ) {
        this.name = name;
        this.checkpoints = new Map();
        this.circle = params?.circle ?? false;
        this.backLine = params.backLine;
        this.grid = params.grid;
        params.checkpoints.forEach( (checkpoint, index) => this.checkpoints.set( index, checkpoint ));
    }    

    nextCheckpoint( checkpoint ) {
        const count = this.checkpoints.size; 
        return ( checkpoint.index >= count ) ? this.checkpoints.get(0) : this.checkpoints.get(checkpoint.index + 1);
    }
    
}

class Member {

    constructor( player, race ) {
        // Игрок мира 
        this.player = player;

        // Событие в котором участвует участник 
        this.race = race;

        // Результаты 
        this.checkpoints = [];        

        // Позиция участника 
        this.place = 0;

        // Флаг находиться на трассе 
        this.inTrack = false;
    }

    /**
     * Участник посадить в машину 
     */
    inCar( inbuiltLevel = 10 ) {
        api.setPlayerPhysicsState(this.player.pId, {type: 1, tier: 0});
        api.applyEffect( this.player.pId, "Speed", 600000, { inbuiltLevel } );
        api.updateEntityNodeMeshAttachment(this.player.pId, "TorsoNode", "BloxdBlock", { 
            blockName: `INTERNAL_MESH_Kart`, 
            size: 10,
            meshOffset: [0, 0, 0] 
        }, [0, -0.75, 0], [0, Math.PI/2, 0]);            
        api.setPlayerPose(this.player.pId, "driving");
    }

    /**
     * Участник выходит из машины
     */
    outCar() {
        api.setPlayerPhysicsState( this.player.pId, { type: 0, tier: 0 });
        api.removeEffect(this.player.pId, "Frozen");
        api.removeEffect(this.player.pId, "Speed");
        api.updateEntityNodeMeshAttachment(this.player.pId, "TorsoNode", null );
        api.setPlayerPose( this.player.pId, "standart");
    }

    /**
     * Участник поместить на трассу 
     */
    onTrack() {
        this.inTrack = true;        
        this.inCar();
        if ( this.race.stage.type === "qual" ) 
            this.goto( this.race.track.backLine );
        if ( this.race.stage.type === "race" ) 
            this.goto( this.race.track.grid( this.place ) );
    }

    goto( pos ) {        
        api.setPosition( this.player.pId, pos );
    }

    frozenTo( pos ) {
        api.applyEffect( this.player.pId, "Frozen", 30000 );
        api.setPosition( this.player.pId, pos );
    }

    checkpoint( checkpoint ) {
        this.checkpoints.push({
            wt: this.race.now(),
            stage: this.race.stage,
            checkpoint 
        });        
    }

    getLastCheckpoint() {
        return this.checkpoints[ this.checkpoints.length - 1 ].checkpoint;
    }

    get inRace() {
        return false;
    }

    get isFinished() {
        return false;
    }

    toLobby() {
        this.outCar();
        this.goto( this.race.world.lobby );
    }

    dq() {
        this.inTrack = false;
        this.toLobby();
    }

}

class MembersRepository {

    constructor() {        
        this.members = new Map();
        this.dbIndex = new Map();
    }

    get( pId ) {
        const dbId = this.dbIndex.get( pId );
        return this.members.get( dbId );
    }

    join( player, race ) {
        if ( !this.members.has( player.dbId ) ) {
            const member = new Member( player, race );
            this.members.set( player.dbId, member );            
        } 

        this.dbIndex.set( player.pId, player.dbId );

        return this.members.get( player.dbId );
    }

    /**
     * Возращает TRUE если все участники закончили 
     */    

    all( fn ) {
        this.members.forEach( fn );
    }

}

class Race {

    constructor( world, track ) {
        this.world = world;
        this.track = track;
        this.stage = { type: 'qual', start: world.wt };
        this.members = new MembersRepository();
        this.rt = 0;
        this._end = false;        
    }

    now() {
        return this.rt;
    }

    tick( wt ) {
        if ( this._end ) return;

        this.rt = wt - this.stage.start;

        if ( this.stage.type === 'qual' ) {
            if ( this.rt > 60*1000 * 10 ) {
                if ( this.members.count > 2 ) {            
                    this.stage = { type: 'race', start: wt };
                } else {
                    this.stage = { type: 'qual', start: wt };            
                }
            }
        } 
        
        if ( this.stage.type === 'race' ) {
            if ( this.rt > 60*1000 * 5 ) {
                this.stage = { type: 'result', start: wt };
                this.members.all( member => member.finish() );
                return;
            } 

            let finished = true;
            this.members.all( member => {                
                !member.isFinished && (api.getPlayerPhysicsState( member.player.pId ).type !== 1) && member.dq();
                finished &&= member.isFinished;
            });

            if ( finished ) 
                this.stage = { type: 'result', start: wt };                        

        }

        if ( this.stage.type === 'result' ) {
            if ( this.rt > 60*1000 ) 
                this.end();            
        }

        


    }

    join( player ) {
        const member = this.members.join( player, this );
        if ( this.stage.type === 'qual' ) {
            member.inCar();
            member.goto( this.track.spawn );
        } else {
            member.outCar();
            member.goto( this.track.lobby );            
        }              
    }

    checkpoint( pId, coord ) {
        const member = this.members.get( pId );
        if ( !member ) return false;
        const checkpoint = this.track.nextCheckpoint( member.getLastCheckpoint() );
        if ( !api.isInsideRect( coord, ...checkpoint.rect )) return;
        member.checkpoint( checkpoint );
    }   

    end() {
        this._end = true;
        this.members.all( member => member.inRace && member.toLobby() );                    
    }
    

}

const track = new Track('Первая трасса', {
    checkpoints: [
        [[0,0,0], [0,0,0]], 
        [[1,1,1], [1,1,1]]
    ], 
    circle: true,
    backLine: [0,0,0],
    grid: [
        [0,0,0],
        [1,0,0],
        [2,0,0],
        [3,0,0],
    ]
});

var tracks = [ track ];

class World {

    constructor( tracks ) {
        this.wt = 0;
        this.players = new PlayerRepository();        
        this.tracks = tracks;
        this.race = null;        
        this.lobby = [0,0,0];
    }

    playerJoin( pId ) {
        var player = this.players.join( pId );
        
        if ( !this.race )
            this.race = new Race( this, this.tracks[0] );

        this.race.join( player );

    }

    playerLeave( pId ) {
        var player = this.players.leave( pId );
        this.players.save( player );
        
        if ( this.players.countOnline === 0 ) 
            this.race = null;
    }

    tick( dt ) {
        this.wt += dt;
        this.race?.tick( this.wt );
    }

    playerChat( pId, msg, channel ) {
        return false;
    }

}

var world = new World( tracks );

var tick = dt => world.tick(dt);
var onPlayerJoin = pId => world.playerJoin( pId );
var onPlayerLeave = pId => world.playerLeave( pId );
var onPlayerChat = ( pId, msg, channel ) => world.playerChat( pId, msg, channel );

/**
 * Ловит событие появление на экране сообщения о том, 
 * что установлен новый спавн блок 
 * 
 * При большой скорости даже 3-и блока не ловят, но в остальном самое лучшие решение. 
 */
var onClientOptionUpdated = (pId, option, value) => {
    const coords = api.getBlockCoordinatesPlayerStandingOn( pId );
	const types = api.getBlockTypesPlayerStandingOn( pId );	
    const idx = types.findIndex( e => e.indexOf("Checkpoint") === 0 );
    if ( idx === -1 ) return;
    world.race?.checkpoint( pId, coords[idx] )
}

exports.tick = tick;
exports.onPlayerJoin = onPlayerJoin;
exports.onPlayerLeave = onPlayerLeave;
exports.onPlayerChat = onPlayerChat;
exports.onClientOptionUpdated = onClientOptionUpdated;

exports.world = world;

// "Русские гонки" 

// Правила мира.
// У игроков полностью отключен чат!

// Описание работы сервера "Русские гонки". 
// Квалификация начинается сразу после создания сервера игры. 

// Квалификации продолжается 10 минут, по истечении которых, гонка начинается 
// только в том случает, если квалификационных времен входящие в 107% от лидера 
// больше 2х человек.

// Если квалификацированных игроков на сервере меньше 2х человок, то время
// квалификации продливается ещё на 10 минут. 

// После окончания квалификации, все игроки автоматически помещаются на стартовую решетку 
//в соответствии с показанной позицией в квалификации. Игроки которые не прошли в 107%, 
// помещаются в лобби трассы, до окончания гонки. 

// На всех игроков размещенных на стартовую решетку накладывается эффект "заморозки", до начала гонки. 

// Процедура гонки
// После размещения квалифицированных игроков на стартовой решетки, начинает загораться стартовый светофор,
// после того как всех огни светофора будут погашены, начинается гонки.
// С игроков снимается эффект "заморозки" и они должны начать движение по трассе. 

// Гонка состоит из 3х круга, побеждает тот кто преодолевает дистанции быстрее других игроков, 
// продолжительность гонки состовляет 5 минут, всех игроки не преодолевшие дистанцию за это время,
// считаются дисквалифицированными. 

// По окончанию гонки, всем игрокам начинасляются очки. 



