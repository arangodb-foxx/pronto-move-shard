'use strict';
const createRouter = require('@arangodb/foxx/router');
const cluster = require('@arangodb/cluster');
const router = createRouter();
const db = require('@arangodb').db;
const joi = require('joi');

module.context.use(router);

let getMoveableShards = function() {
  let servers = global.ArangoClusterInfo.getDBServers();
  return db._collections().reduce((moveableShards, collection) => {
    let props = collection.properties();
    if (props.distributeShardsLike) {
      return moveableShards;
    }

    // must have at least 3 free servers
    if (props.replicationFactor > servers.length - 3) {
      return moveableShards;
    } 
    let shards = collection.shards();
    return shards.reduce((moveableShards, shardName) => {
      let shard = global.ArangoClusterInfo.getCollectionInfoCurrent(db._name(), collection.name(), shardName);
      moveableShards.push({shard: shardName, collection: collection.name(), servers: shard.servers});
      return moveableShards;
    }, moveableShards);
  }, []);
}

let getPossibleServers = function(collection, shard) {
  let shardInfo = global.ArangoClusterInfo.getCollectionInfoCurrent(db._name(), collection, shard);  
  let servers = global.ArangoClusterInfo.getDBServers();
  
  let possibleServers = servers.filter(server => {
    return shardInfo.servers.indexOf(server.serverId) === -1;
  });

  return possibleServers;
}

router.get('/moveable-shards', function (req, res) {
  let moveableShards = getMoveableShards();
  res.json(moveableShards);
})

router.get('/possible-servers', function(req, res) {
  res.json(getPossibleServers(req.queryParams.collection, req.queryParams.shard));
});

router.post('/move-shard', function(req, res) {
  let shard = req.body;
  let moveableShards = getMoveableShards();

  let moveableShard = moveableShards.filter(moveableShard => {
    return moveableShard.shard == shard;
  })[0];

  if (!moveableShard) {
    res.throw(404, 'Not a moveable shard');
    return;
  }

  let possibleServers = getPossibleServers(moveableShard.collection, moveableShard.shard);
  if (possibleServers.length < 3) {
    res.throw(404, 'Not enough possible servers');
    return;
  }

  let toServer = possibleServers[Math.floor(Math.random() * possibleServers.length)].serverId;

  let info = {
    shard,
    database: db._name(),
    collection: moveableShard.collection,
    // ideally take a follower :S - so simply always last
    fromServer: moveableShard.servers[moveableShard.servers.length-1],
    toServer
  };

  let result = cluster.moveShard(info);
  if (result.error) {
    res.throw(500, result);
    return;
  }
  res.json(result.id);
})
.body(joi.string().required());

router.get('/job-state/:id', function(req, res) {
  let id = req.pathParams.id;
  let result = global.ArangoAgency.read([[
    `/arango/Target/ToDo/${id}`,
    `/arango/Target/Pending/${id}`,
    `/arango/Target/Failed/${id}`,
    `/arango/Target/Finished/${id}`,
  ]]);
  if (typeof result == 'undefined'
    || typeof result[0].arango == 'undefined'
    || typeof result[0].arango == 'undefined'
    || typeof result[0].arango.Target == 'undefined'
    || typeof result[0].arango.Target.ToDo == 'undefined'
    || typeof result[0].arango.Target.Pending == 'undefined'
    || typeof result[0].arango.Target.Failed == 'undefined'
    || typeof result[0].arango.Target.Finished == 'undefined'
  ) {
    res.throw(500, 'Invalid agency response');
  }

  result = result[0].arango.Target;

  let job = null;
  let status = null;
  if (result.ToDo[id]) {
    status = 'working';
    job = result.ToDo[id];
  } else if (result.Pending[id]) {
    status = 'working';
    job = result.Pending[id];
  } else if (result.Failed[id]) {
    status = 'failed';
    job = result.Failed[id];
  } else if (result.Finished[id]) {
    job = result.Finished[id];
    status = 'finished';
  } else {
    res.throw(404, 'Job not found');
    return;
  }
  

  if (!job || job.type != 'moveShard' || !job.toServer) {
    res.throw(400, 'Invalid job');
    return;
  }

  let stateResult = {
    status
  };

  if (status == 'finished') {
    stateResult.toServer = job.toServer;
  }

  res.json(stateResult);
})
.pathParam('id', joi.number().required())