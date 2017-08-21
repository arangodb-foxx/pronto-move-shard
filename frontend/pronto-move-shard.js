let possibleColors = [];
for (var r=0;r<=255;r+=20) {
  for (var g=0;g<=255;g+=20) {
    for (var b=0;b<=255;b+=20) {
      possibleColors.push({r,g,b});
    } 
  } 
}

let standaloneData = null;


let canvas = document.querySelector('canvas');
let ctx = canvas.getContext('2d');

let shardsElement = document.querySelector('#shards');
let prontoElement = document.querySelector('#pronto');

let salvatoreBodyImage = new Image();
salvatoreBodyImage.src = 'salvatore-body.svg';
let salvatoreHeadImage = new Image();
salvatoreHeadImage.src = 'salvatore.png';
let salvatoreHand = new Image();
salvatoreHand.src = 'hand.svg';
let capImage = new Image();
capImage.src = 'cap.svg';
let wrongImage = new Image();
wrongImage.src = 'wrong.svg';

let airHorn = new Audio();
airHorn.src = 'air-horn.mp3';

let ovation = new Audio();
ovation.src = 'ovation.mp3';

let gameSound = new Audio();
gameSound.src = 'game-loop.mp3';
gameSound.loop = true;

let fieldMiddle = canvas.height - 175;


let serverY = 470;
let shardY = 450;
let perServerWidth = 100;
let perServerHeight = 150;

let getMoveableShards = function() {
  if (standaloneData) {
    return Promise.resolve(standaloneData.shards);
  } else {
    return fetch('moveable-shards')
    .then(serversResponse => serversResponse.json())
  }
}

let getPossibleServers = function(shard, collection) {
  if (standaloneData) {
    return Promise.resolve(standaloneData.servers.slice(1));
  } else {
    return fetch('possible-servers?shard=' + shard + '&collection=' + collection)
    .then(serversResponse => serversResponse.json())
  }
}

let getJobState = function(jobId) {
  if (standaloneData) {
    if (--standaloneData.jobCalls == 0) {
      return getPossibleServers()
      .then(servers => {
        let chosenServer = servers[Math.floor(Math.random() * servers.length)];
        return {status: 'finished', toServer: chosenServer.serverId};
      })
    } else {
      return {'status': 'working'};
    }
  } else {
    return fetch('job-state/' + jobId).then(serversResponse => serversResponse.json());
  }
}

let startMoveShard = function() {
  if (standaloneData) {
    standaloneData.jobCalls = 3;
    return Promise.resolve(1);
  } else {
    return fetch('move-shard', { body: JSON.stringify(gameState.shard.name), method: 'POST'})
    .then(serversResponse => serversResponse.json());
  }
}

let gameState = {};
function reset() {
  prontoElement.setAttribute('disabled', 'disabled');
  shardsElement.setAttribute("disabled", "disabled");
  Array.from(shardsElement.children).slice(1).forEach(element => {
    shardsElement.removeChild(element);
  });
  gameState = {
    hands : {
      right: {
        current: new Victor(
          120,
          fieldMiddle,
        ),
        rest: new Victor(
          120,
          fieldMiddle,
        ),
      },
      left: {
        current: new Victor(
          canvas.width - 120,
          fieldMiddle,
        ),
        rest: new Victor(
          canvas.width - 120,
          fieldMiddle,
        ),
    },
    },
    shard: null,
    shards: null,
    caps: [],
    servers: null,
    highlightedServer: null,
    success: null,
  }

  return getMoveableShards()
  .then(moveableShards => {
    moveableShards.forEach(shard => {
      let option = document.createElement('option');
      option.value = shard.shard;
      option.text = shard.shard + " (Collection: " + shard.collection + ")";
      shardsElement.appendChild(option);
    })
    gameState.shards = moveableShards;
    shardsElement.removeAttribute("disabled");
  })
}

function shardSelected(shardElement) {
  prontoElement.setAttribute('disabled', 'disabled');
  if (shardElement.value) {
    let shardInfo = gameState.shards.filter(shard => {
      return shard.shard == shardElement.value;
    })[0];
    return getPossibleServers(shardElement.value, shardInfo.collection)
    .then(servers => {
      let start = canvas.width/2-perServerWidth*servers.length/2;
      gameState.shard = {
        position: new Victor(
          canvas.width/2,
          shardY,
        ),
        server: shardInfo.servers[shardInfo.servers.length - 1],
        name: shardElement.value,
        capIndex: null,
      }
      gameState.servers = servers.map((server, index) => {
        return {
          id: server.serverId,
          color: possibleColors[Math.floor(Math.random() * possibleColors.length)],
          textColor: possibleColors[Math.floor(Math.random() * possibleColors.length)],
          position: new Victor(
            start + index * perServerWidth + perServerWidth/2,
            serverY + perServerHeight/2,
          )
        }
      })
      gameState.caps = gameState.servers.map((server, serverIndex) => {
        return {
          serverIndex,
          current: server.position.clone(),
        }
      });
      prontoElement.removeAttribute('disabled');
    });
  } else {
    reset();
  }
}


let render = function(t) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  let fieldTopOffset = 390;
  let bodyWidth = 140;
  let bodyOffset = 150;
  
  ctx.drawImage(salvatoreBodyImage, canvas.width/2 - 75, bodyWidth, bodyOffset, 250);
  ctx.save();
  ctx.translate(canvas.width/2, 75);
  ctx.rotate(Math.sin(t / 500) * Math.PI/8);
  ctx.drawImage(salvatoreHeadImage, -75, -75, 150, 150);
  ctx.restore();

  if (gameState.success === false) {
    ctx.drawImage(wrongImage, canvas.width/2 + 170, 70, 300, 100);
  }

  // background
  let backgroundMargin = 15;
  let widthMargin = 150;
  let round = 10;
  ctx.fillStyle = 'darkgreen';
  ctx.strokeStyle = 'brown';
  ctx.beginPath();
  ctx.moveTo(backgroundMargin + widthMargin + round, fieldTopOffset + backgroundMargin);
  ctx.lineTo(canvas.width - backgroundMargin - round - widthMargin, fieldTopOffset + backgroundMargin);
  ctx.quadraticCurveTo(canvas.width - backgroundMargin - widthMargin, fieldTopOffset + backgroundMargin, canvas.width - backgroundMargin - widthMargin, fieldTopOffset + backgroundMargin + round);
  ctx.lineTo(canvas.width - backgroundMargin - widthMargin, canvas.height - backgroundMargin - round);
  ctx.quadraticCurveTo(canvas.width - backgroundMargin - widthMargin, canvas.height - backgroundMargin, canvas.width - backgroundMargin - round - widthMargin, canvas.height - backgroundMargin);
  ctx.lineTo(backgroundMargin + round + widthMargin, canvas.height - backgroundMargin);
  ctx.quadraticCurveTo(backgroundMargin + widthMargin, canvas.height - backgroundMargin, backgroundMargin + widthMargin, canvas.height - backgroundMargin - round);
  ctx.lineTo(backgroundMargin + widthMargin, fieldTopOffset + backgroundMargin + round);
  ctx.quadraticCurveTo(backgroundMargin + widthMargin, fieldTopOffset + backgroundMargin, backgroundMargin + round + widthMargin, fieldTopOffset + backgroundMargin);
  ctx.lineWidth = 30;
  ctx.stroke();
  ctx.fill();

  ctx.textAlign = 'center';
  if (gameState.servers) {
    ctx.font = '11px Comic Sans MS';
    gameState.servers.forEach((server, index) => {
      ctx.strokeStyle = gameState.highlightedServer === index ? 'white' : 'black';
      ctx.fillStyle = 'rgb(' + server.color.r + ',' + server.color.g + ',' + server.color.b + ')';

      let x = (canvas.width - gameState.servers.length * perServerWidth) /2 + index * perServerWidth + 5;
      ctx.fillRect(x, serverY, perServerWidth - 10, perServerHeight);
      ctx.lineWidth = 5;
      ctx.strokeRect(x, serverY, perServerWidth - 10, perServerHeight);
      ctx.fillStyle = 'rgb(' + server.textColor.r + ',' + server.textColor.g + ',' + server.textColor.b + ')';
      ctx.save();
      ctx.translate(x, serverY + perServerHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(server.id.substr(0, server.id.length/2), 0, 12);
      ctx.fillText(server.id.substr(server.id.length/2), 0, perServerWidth - 18);
      ctx.restore();
    });
  } else {
    ctx.fillStyle = 'yellow';
    ctx.font = '32px Comic Sans MS';
    ctx.fillText('Please select a shard to begin!', canvas.width/2, serverY + perServerHeight / 2)
  }

  ctx.fillStyle = 'yellow';
  if (gameState.shard) {
    ctx.font = '14px Comic Sans MS';
    ctx.fillText(gameState.shard.server, canvas.width/2, shardY - 20);
    if (gameState.shard.position) {
      
      ctx.beginPath();
      ctx.arc(gameState.shard.position.x,gameState.shard.position.y,10,0,2*Math.PI);
      ctx.fill();
    }
  }

  gameState.caps.forEach(cap => ctx.drawImage(capImage, cap.current.x - 20, cap.current.y - 20, 40, 40));

  let armLength = 400;
  let handwidth = 140;
  ctx.lineWidth = 50;
  ctx.strokeStyle = '#484537';
  (function rightHand() {
    ctx.save();
    ctx.translate(gameState.hands.right.current.x, gameState.hands.right.current.y);
    ctx.scale(-1, 1);
    ctx.drawImage(salvatoreHand, -handwidth/2, -handwidth/2 + 30, handwidth, handwidth);
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(canvas.width/2 - bodyWidth/2, bodyOffset);
    ctx.lineTo(gameState.hands.right.current.x - 20, gameState.hands.right.current.y - 20);
    ctx.stroke();
  })();

  (function leftHand() {
    ctx.save();
    ctx.translate(gameState.hands.left.current.x, gameState.hands.left.current.y);
    ctx.scale(1, 1);
    ctx.drawImage(salvatoreHand, -handwidth/2, -handwidth/2 + 30, handwidth, handwidth);
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(canvas.width/2 + bodyWidth/2, bodyOffset);
    ctx.lineTo(gameState.hands.left.current.x + 20, gameState.hands.left.current.y - 20);
    ctx.stroke();
  })();

}

let startTime = null;
let animate = function(time) {
  if (!startTime) {
    startTime = time;
  }
  render(time - startTime);
  window.requestAnimationFrame(animate);
  TWEEN.update(time);
}
window.requestAnimationFrame(animate);

let obj = document.querySelector('object');
obj.onload = function() {
  let offOpacity = 0.5;
  let circles = obj.contentDocument.querySelectorAll('circle');
  let circlesArr = Array.from(circles);
  let animateLights = function() {
    circlesArr.forEach(circle => {
      circle.style.fillOpacity = offOpacity;
    })

    return circlesArr.reduce((promise, circle) => {
      return promise.then(function() {
        return new Promise(function(resolve) {
          circle.style.fillOpacity = 1.0;
          setTimeout(function() {
            circle.style.fillOpacity = offOpacity;
            resolve();
          }, 200);
        })
      })
    }, Promise.resolve())
    .then(() => {
      let allOnOff = function() {
        return new Promise(function(resolve) {
          circlesArr.forEach(circle => {
            circle.style.fillOpacity = 1.0;
          })
          setTimeout(function() {
            resolve();
          }, 500);
        })
        .then(() => {
          return new Promise(function(resolve) {
            circlesArr.forEach(circle => {
              circle.style.fillOpacity = 0.5;
            })
            setTimeout(function() {
              resolve();
            }, 500);
          })
        })
      }
      return allOnOff()
      .then(() => {
        return allOnOff();
      })
      .then(() => {
        return allOnOff();
      })
    })
    .then(() => {
      return animateLights();
    })
  }
  animateLights();
}
obj.data = 'pronto.svg';

let bruteForcePlan = function(numServers, begin, end, iterations) {
  let plan;
  let current;
  do {
    current = begin;
    plan = [];
    for (var i=0;i<iterations;i++) {
      let leftHandCapIndex = Math.floor(Math.random() * numServers);
      let rightHandCapIndex;
      while (true) {
        rightHandCapIndex = Math.floor(Math.random() * numServers);
        if (rightHandCapIndex != leftHandCapIndex) {
          break;
        }
      }
      plan.push([leftHandCapIndex, rightHandCapIndex])
      if (leftHandCapIndex == current) {

        current = rightHandCapIndex;
      } else if (rightHandCapIndex == current) {
        current = leftHandCapIndex;
      }
    }
  } while (current !== end);
  return plan;
}

let createMoveTween = function(hand, target, updateFn) {
  let startVector = hand.current.clone();
  let movementVector = target.clone();
  movementVector.subtract(hand.current);
  
  let direction = [1,-1][Math.floor(Math.random() * 2)];
  let multiplier = new Victor(0, 0);
  return new TWEEN.Tween({value: 0})
  .to({value: 1}, Math.random() * 400 + 500)
  .onUpdate(value => {
    value = value.value;
    let change = movementVector.clone();
    let multi = new Victor(value, value);
    change.multiply(multi);

    let newVector = startVector.clone();
    newVector.add(change)
    newVector.add(new Victor(0, (value*2-1)*(value*2-1) * direction * 50 - 50 * direction));
    hand.current.copy(newVector);
    if (updateFn) {
      updateFn(newVector);
    }
  })
}

let createHandMovement = function(hand, capIndex, targetServerIndex) {
  let source = gameState.caps[capIndex];
  
  let tween = createMoveTween(hand, source.current);
  return new Promise((resolve, reject) => {
    tween.onComplete(resolve);
    tween.start();
  })
  .then(() => {
    let updateFn = function(newVector) {
      gameState.caps[capIndex].current.copy(newVector);
    }
    let moveCapTween = createMoveTween(hand, gameState.servers[targetServerIndex].position, updateFn);
    return new Promise((resolve, reject) => {
      moveCapTween.onComplete(resolve);
      moveCapTween.start();
    })
    .then(() => {
      return [capIndex, targetServerIndex];
    })
  })
}

let simulateMovement = function(jobId) {
  gameSound.play();

  let checkMoveReady = function(jobId) {
    let promises = [];

    let capIndex = Math.floor(Math.random() * gameState.caps.length);
    let otherCapIndex;
    do {
      otherCapIndex = Math.floor(Math.random() * gameState.caps.length);
    } while (capIndex === otherCapIndex);

    let targetServerIndex = gameState.caps[otherCapIndex].serverIndex;
    let otherTargetServerIndex = gameState.caps[capIndex].serverIndex;

    promises.push(createHandMovement(gameState.hands.left, capIndex, targetServerIndex));
    promises.push(createHandMovement(gameState.hands.right, otherCapIndex, otherTargetServerIndex));
    promises.push(getJobState(jobId));

    return Promise.all(promises)
    .then(([leftResult, rightResult, job]) => {
      gameState.caps[leftResult[0]].serverIndex = leftResult[1];
      gameState.caps[rightResult[0]].serverIndex = rightResult[1];

      if (job.status == 'working') {
        return checkMoveReady(jobId);
      } else if (job.status == 'finished') {
        return job.toServer;
      } else {
        alert('Job failed!');
      }
    });
  }

  return checkMoveReady(jobId)
  .then(newServerId => {
    let serverIndex = gameState.servers.reduce((foundServerIndex, server, serverIndex) => {
      if (foundServerIndex !== null) {
        return foundServerIndex;
      }
      if (server.id == newServerId) {
        return serverIndex;
      }
      return null;
    }, null);
    return stopMovement(serverIndex, Math.floor(Math.random() * 5) + 1);
  });
}

let stopMovement = function(end, iterations) {
  let plan = bruteForcePlan(gameState.caps.length, gameState.caps[gameState.shard.capIndex].serverIndex, end, iterations);
  return plan.reduce((previous, planItem) => {
    return previous.then(() => {
      let leftHandCapIndex;
      let rightHandCapIndex;

      gameState.caps.forEach((cap, index) => {
        if (cap.serverIndex === planItem[0]) {
          leftHandCapIndex = index;
        } else if (cap.serverIndex === planItem[1]) {
          rightHandCapIndex = index;
        }
      });

      let promises = [];
      promises.push(createHandMovement(gameState.hands.left, leftHandCapIndex, gameState.caps[rightHandCapIndex].serverIndex));
      promises.push(createHandMovement(gameState.hands.right, rightHandCapIndex, gameState.caps[leftHandCapIndex].serverIndex));
  
      return Promise.all(promises)
      .then(results => {
        return results.forEach(result => {
          gameState.caps[result[0]].serverIndex = result[1];
        })
      })
    });
  }, Promise.resolve())
  .then(() => {
    return Promise.all(Object.values(gameState.hands).map(hand => {
      return new Promise((resolve, reject) => {
        let tween = createMoveTween(hand, hand.rest);
        tween.onComplete(resolve);
        tween.start();
      })
    }))
  })
  .then(() => {
    gameSound.pause();
    return end;
  })
}

let processResult = function(serverIndex) {
  let moveListener = function(evt) {
    var rect = canvas.getBoundingClientRect();
    let localX = evt.clientX - rect.left;
    let localY = evt.clientY - rect.top;
  
    gameState.highlightedServer = null;
    gameState.servers.forEach((server, index) => {
      let serverLocation = server.position;
      if (serverLocation.x - perServerWidth/2 <= localX && serverLocation.x + perServerWidth/2 >= localX
      && serverLocation.y - perServerHeight/2 <= localY && serverLocation.y + perServerHeight/2 >= localY) {
        gameState.highlightedServer = index;
      }
    });
  }
  gameState.shard.position = Victor.fromObject(gameState.servers[serverIndex].position);

  let openCap = function(cap) {
    let hand = Math.random() < 0.5 ? gameState.hands.left : gameState.hands.right;
    let target = cap.current.clone();
    return new Promise((resolve, reject) => {
      let tween = createMoveTween(hand, cap.current);
      tween.onComplete(resolve);
      tween.start();
    })
    .then(() => {
      target.y -= 120;
      
      let tween = new TWEEN.Tween(hand.current);
      tween.to(target);
      return new Promise((resolve, reject) => {
        tween.onUpdate(function(value) {
          cap.current.copy(value);
        })
        tween.onComplete(resolve);
        tween.start();
      })
    })
  }
  
  canvas.addEventListener('mousemove', moveListener);

  return new Promise((resolve, reject) => {
    let clickListener = function() {
      if (gameState.highlightedServer !== null) {   
        canvas.removeEventListener('click', clickListener);
        canvas.removeEventListener('mousemove', moveListener);

        let selectedServer = gameState.highlightedServer;
        gameState.highlightedServer = null;
        resolve(selectedServer);
      }
    }
    canvas.addEventListener('click', clickListener);
  })
  .then(selectedServer => {
    let cap = gameState.caps.filter(cap => {
      return cap.serverIndex === selectedServer;
    })[0];
    
    return openCap(cap)
    .then(() => {
      return serverIndex === selectedServer;
    })
  })
  .then(success => {
    gameState.success = success;
    if (!success) {
      let soundPromise = new Promise((resolve, reject) => {
        let endFunction = function() {
          gameState.success = null;
          airHorn.removeEventListener('ended', endFunction);
          resolve();
        }
        airHorn.addEventListener('ended', endFunction);
        airHorn.play();
      })

      let cap = gameState.caps.filter(cap => {
        return cap.serverIndex === serverIndex;
      })[0];

      return Promise.all([soundPromise, openCap(cap)]);
    } else {
      return new Promise((resolve, reject) => {
        let endFunction = function() {
          gameState.success = null;
          ovation.removeEventListener('ended', endFunction);
          resolve();
        }
        ovation.addEventListener('ended', endFunction);
        ovation.play();
      })
    }
  })
}

function startMoving() {
  if (!gameState.shard) {
    return;
  }
  prontoElement.setAttribute('disabled', 'disabled');

  return startMoveShard()
  .then(jobId => {
    moveShard(jobId);
  });
}

let moveShard = function(jobId) {
  let begin = Math.floor(Math.random() * gameState.servers.length);
  gameState.shard.capIndex = begin;

  return new Promise((resolve, reject) => {
    let hand = Math.round(Math.random()) == 0 ? gameState.hands.right : gameState.hands.left;
    let handOriginal = hand.current.clone();
    let mainTween = new TWEEN.Tween(hand.current)
    .to(gameState.caps[begin].current, 1000)
    
    let catchShardTween = new TWEEN.Tween(hand.current)
    .to(gameState.shard.position, 1000)
    .onUpdate(value => {
      gameState.caps[begin].current.copy(value);
    })
    .onComplete(() => {
      gameState.shard.position = null;
    })
    mainTween.chain(catchShardTween);

    let moveCapBack = new TWEEN.Tween(hand.current)
    .to(gameState.servers[begin].position, 1000)
    .onUpdate(value => {
      gameState.caps[begin].current.copy(value);
    })
    catchShardTween.chain(moveCapBack);

    let backtoRest = new TWEEN.Tween(hand.current)
    .to(handOriginal, 1000)
    .onComplete(resolve)

    moveCapBack.chain(backtoRest);
    mainTween.start();
  })
  .then(() => {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 1000);
    })
  })
  .then(() => {
    return simulateMovement(jobId);
  })
  .then(result => {
    return processResult(result);
  })
  .then(() => {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 1000);
    })
  })
  .then(() => {
    reset();
  })
  .catch(err => {
    gameSound.pause();
    console.error(err);
    alert('Error: ' + err);
    reset();
  })
}

function setStandaloneData(data) {
  standaloneData = data;
}

function start() {
  reset();
}