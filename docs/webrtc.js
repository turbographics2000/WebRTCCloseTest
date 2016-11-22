const configuration = { "iceServers": [{ "urls": "stun:stun.l.google.com:19302" }] };
let pcs = {};
let streams = {};
//let audioSenders = {};
//let videoSenders = {};
let trackSenders = {};
let renderStreamId = null;
let audioContext = new AudioContext();
let myId = null;

window.MediaStream = window.MediaStream || window.webkitMediaStream;
window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;

let signalingChannel = new BroadcastChannel('webrtc-track-and-close-test');
signalingChannel.send = (msg, toId) => {
    if(!toId) throw 'toId undefined';
    msg = Object.assign(msg, {remoteId: myId, toId});
    signalingChannel.postMessage(JSON.stringify(msg));
}

logDownload.onclick = function() {
    if(logs.length) {
        logs.sort((a, b) => a.time - b.time);
        var logTable = document.createElement('table');
        var thead = document.createElement('thead');
        var thtr = document.createElement('tr');
        var thId = document.createElement('th');
        thId.textContent = 'ID';
        var thMsg = document.createElement('th');
        thMsg.textContent = 'Message';
        var thArg = document.createElement('th');
        thArg.textContent = 'Arg';
        var thArg2 = document.createElement('th');
        thArg.textContent = 'Arg2';
        var thArg3 = document.createElement('th');
        thArg.textContent = 'Arg3';
        thtr.appendChild(thId);
        thtr.appendChild(thMsg);
        thtr.appendChild(thArg);
        thtr.appendChild(thArg2);
        thtr.appendChild(thArg3);
        thead.appendChild(thtr);
        logTable.appendChild(thead);
        var tbody = document.createElement('tbody');
        for(var i = 0; i < logs.length; i++) {
            var tbtr = document.createElement('tr');
            var tdId = document.createElement('td');
            tdId.textContent = logs[i].id;
            var tdMsg = document.createElement('td');
            tdMsg.textContent = logs[i].msg;
            var tdArg = document.createElement('td');
            tdArg.textContent = logs[i].arg;
            var tdArg2 = document.createElement('td');
            tdArg.textContent = logs[i].arg2;
            var tdArg3 = document.createElement('td');
            tdArg.textContent = logs[i].arg3;
            tbtr.appendChild(tdId);
            tbtr.appendChild(tdMsg);
            tbtr.appendChild(tdArg);
            tbtr.appendChild(tdArg2);
            tbtr.appendChild(tdArg3);
            tbody.appendChild(tbtr);
        }
        logTable.appendChild(tbody);
        document.body.appendChild(logTable);
    }
}

addStream.onclick = function() {
    createDummyStream(false, true).then(streamInfo => {
        addStreamElement(myId, streamInfo);
        for(var remoteId in pcs) {
            addTracks(pcs[remoteId], streamInfo.stream);
        }
        if(!renderStreamId) renderDummyVideoTrack();
    });
};

document.body.ondragover = function(evt) {
    evt.preventDefault();
}

document.body.ondrop = function(evt) {
    var video = document.createElement('video');
    evt.preventDefault();
    let files = Array.from(evt.dataTransfer.files);
    var streamCnt = Object.keys(streams[myId]).length;
    var playableFiles = files.filter(file => ['maybe', 'probably'].includes(video.canPlayType(file.type)));
    var addCnt = Math.min(3 - streamCnt, playableFiles.length);
    if(addCnt) {
        for(var i = 0; i < addCnt; i++){
            createVideoFileStream(playableFiles[i]);
        }
    }
}

addAudioTrack.onclick = function() {
    createDummyAundioTrack().then(([track]) => {
        var localStreams = Object.entries(streams[myId]).map(val => val[1].stream);
        for(let remoteId in pcs) {
            if(localStreams.length === 1){
                log('function', 'call', `pcs[${remoteId}].addTrack`, localStreams[0].id);
                trackSenders[track.id] = pcs[remoteId].addTrack(track, localStreams[0]);
            }else if(localStreams.length === 2) {
                log('function', 'call', `pcs[${remoteId}].addTrack`, localStreams[0].id, localStreams[1].id);
                trackSenders[track.id] = pcs[remoteId].addTrack(track, localStreams[1]);
            }else if(localStreams.length === 3) {
                log('function', 'call', `pcs[${remoteId}].addTrack`, localStreams[0].id, localStreams[1].id, localStreams[2].id);
                trackSenders[track.id] = pcs[remoteId].addTrack(track, localStreams[0], localStreams[1], localStreams[2]);
            }
        }
    })
}


// if(btnRemoveTrack) {
//     btnRemoveTrack.onclick = function () {
//         // 新しい仕様ではRTCPeerConnectionではgetLocalStream()およびgetRemoteStream()が廃止されるため
//         // RTCPeerConnectionからストリームを取得することができなくなる。
//         // そのため、自分でストリームを管理しなければならない。
//         if(localStreams) {
//             var tracks = localStreams[0].getTracks();
//             if(tracks.length) {
//                 //pc.removeTrack(tracks[0], localStreams[0]);
//                 localStreams[0].removeTrack(tracks[0]);
//                 pc.onnegotiationneeded();
//             }
//         }
//     }
// }

function joinRoom() {
    log('function', 'call', 'joinRoom');
    signalingChannel.postMessage(JSON.stringify({join: true, remoteId: idList[0]}));
}

function addStreamElement(userId, streamInfo) {
    log('function', 'call', 'addStreamElement', userId, streamInfo);
    //var container = document.body;
    var stream = streamInfo.stream;

    stream.onaddtrack = function(evt) {
        log('function', 'call', 'onaddtrack', 'streamId:' + this.id, 'trackId:' + evt.track.id);
        createTrackButton(this.id, evt.track.id);
    }
    stream.onremovetrack = function(evt) {
        log('function', 'call', 'onremovetrack', 'streamId:' + this.id, 'trackId:' + evt.track.id);
    }

    if(streams[userId] && streams[userId][stream.id]) return;

    streams[userId] = streams[userId] || {};
    streams[userId][stream.id] = streamInfo;
    
    var streamContainer = document.getElementById('streams_' + userId);
    if(!streamContainer) {
        var title = document.createElement('h3');
        title.id = 'streamstitle_' + userId;
        title.textContent = (userId === myId ? '自分' : userId) + 'のストリーム';
        streamContainer = document.createElement('div');
        streamContainer.id = 'streams_' + userId;
        streamContainer.classList.add('streams');
        streamContainer.appendChild(title);
        if(userId === myId) {
            container.insertBefore(streamContainer, container.firstChild);
        } else {
            container.appendChild(streamContainer);
        }
    }

    var streamIdLabel = document.createElement('div');
    streamIdLabel.classList.add('streamid-label');
    streamIdLabel.textContent = stream.id;
    
    var audioMeterContainer = document.createElement('div');
    audioMeterContainer.classList.add('audio-meter-container');
    var audioMeter = document.createElement('div');
    audioMeter.classList.add('audio-meter');
    audioMeterContainer.appendChild(audioMeter);

    var video = streamInfo.video = document.createElement('video');
    video.srcObject = stream;
    video.muted = !!streamInfo.cnv;
    video.controls = true;
    video.play();

    var trackButtonContainer = document.createElement('div');
    trackButtonContainer.id = stream.id + '_trackbutton';

    var streamItem = streamInfo.streamItem = document.createElement('div');
    streamItem.classList.add('stream-item');
    streamItem.appendChild(streamIdLabel);
    streamItem.appendChild(video);
    streamItem.appendChild(audioMeterContainer);
    streamItem.appendChild(trackButtonContainer);
    streamContainer.appendChild(streamItem);
    
    stream.getTracks().forEach(track => createTrackButton(stream.id, track.id));

    var audioTracks = stream.getAudioTracks();
    if(audioTracks.length) {
        streamInfo.mediaStreamSource = audioContext.createMediaStreamSource(stream);
        var processor = streamInfo.audioProcessor = audioContext.createScriptProcessor(512);
        processor.audioMeter = audioMeter;
        streamInfo.audioProcessor.onaudioprocess = function(evt) {
            var buf = evt.inputBuffer.getChannelData(0);
            var max = 0;
            for(var i = buf.Length; i--;) {
                max = Math.max(max, buf[i]);
            }
            this.audioMeter.style.width = Math.min(100, ~~(max * 150)) + '%';
        }
        streamInfo.mediaStreamSource.connect(streamInfo.audioProcessor);
        streamInfo.audioProcessor.connect(audioContext.destination);
    } else {
        audioMeter.classList.add('no');
    }
};

function createTrackButton(streamId, trackId) {
    var trackButtonContainer = document.getElementById(streamId + '_trackbutton');
    var removeTrackButton = document.createElement('div');
    removeTrackButton.textContent = trackId;
    removeTrackButton.dataset.trackId = trackId;
    removeTrackButton.classList.add('track-button');
    removeTrackButton.onmouseenter = removeTrackOnMouseEnter;
    removeTrackButton.onmouseleave = removeTrackOnMouseLeave;
    trackButtonContainer.appendChild(removeTrackButton);
}

function removeMember(memberId) {
    log('function', 'call', 'removeMebmer', memberId);
    var streamInfos = Object.entries(streams[memberId] || {}).map(val => val[1]);
    var title = document.getElementById('streamstitle_' + memberId);
    var streamContainer = document.getElementById('streams_' + memberId);
    for(var i = streamInfos.length; i--;) {
        removeStream(streamInfos[i]);
        delete streams[memberId][streamInfos[i].stream.id];
    }
    if(title) title.parentElement.removeChild(title);
    if(streamContainer) streamContainer.parentElement.removeChild(streamContainer);
    delete streams[memberId];
    pcs[memberId].close();
    delete pcs[memberId];
}

function removeStream(streamInfo) {
    log('function', 'call', 'removeStream', streamInfo);
    if(streamInfo.srcURL) URL.revokeObjectURL(streamInfo.srcURL);
    streamInfo.stream.getTracks().forEach(track => {
        delete trackSenders[track.id];
        track.stop();
    });
    if(streamInfo.mediaStreamSource) {
        streamInfo.audioProcessor.onaudioprocess = null;
        streamInfo.mediaStreamSource.disconnect();
        streamInfo.audioProcessor.disconnect();
        delete streamInfo.mediaStreamSource;
        delete streamInfo.audioProcessor.audioMeter;
        delete streamInfo.audioProcessor;
    }
    streamInfo.video.srcObject = null;
    delete streamInfo.video;
    streamInfo.streamItem.parentElement.removeChild(streamInfo.streamItem);
    delete streamInfo.streamItem;
}

function removeTrackOnMouseEnter() {
    var trackId = this.dataset.trackId;
    Array.from(document.getElementsByClassName('track-button'))
        .filter(elm => elm.dataset.trackId === trackId)
        .forEach(elm => {
            if(!elm.classList.contains('hover')) {
                elm.classList.toggle('hover');
            }
        });
}

function removeTrackOnMouseLeave() {
    var trackId = this.dataset.trackId;
    Array.from(document.getElementsByClassName('track-button'))
        .filter(elm => elm.dataset.trackId === trackId)
        .forEach(elm => {
            if(elm.classList.contains('hover')) {
                elm.classList.remove('hover');
            }
        });
}

// function addStream() {
//     if(selfStreams.children.length >= 3) return;
//     navigator.mediaDevices.getUserMedia({
//             audio: false,
//             // audio: {
//             //     googEchoCancellation: true,
//             //     googAutoGainControl: true,
//             //     googNoizeSuppression: true,
//             //     googHighpassFilter: true,
//             //     googNoizeSuppression2: true,
//             //     googEchoCancellation2: true,
//             //     googAutoGainControl2: true
//             // },
//             video: true/*{
//                 width: {ideal: 320},
//                 height: {ideal: 240},
//                 frameRate: {min: 1, max: 15}
//             }*/
//         })
//         .then(stream => {
//             appendVideo('selfStream', stream);
//             localStreams = localStreams || [];
//             localStreams.push(stream);
//             if(pc.addStream) {
//                 pc.addStream(stream);
//             } else {
//                 if(stream.getAudioTracks().length)
//                     pc.addTrack(stream.getAudioTracks()[0], stream);
//                 if(stream.getVideoTracks().length)
//                     pc.addTrack(stream.getVideoTracks()[0], stream);
//             }
//         })
//         .catch(error => {
//             log('function', 'call', error.name + ": " + error.message);
//         });
// }

signalingChannel.onmessage = function(evt) {
    var msg = JSON.parse(evt.data);
    log('function', 'call', 'signalingChannel.onmessage', msg.toId);
    if('toId' in msg && msg.toId !== myId) return;
    if (!pcs[msg.remoteId]) {
        webrtcStart(msg.remoteId);
        if(!streams[myId]) {
            createDummyStream(false, true).then(streamInfo => {
                addStreamElement(myId, streamInfo);
                addTracks(pcs[msg.remoteId], streamInfo.stream);
                if(!renderStreamId) renderDummyVideoTrack();
            });
        }
    }
    if (msg.desc) {
        let pc = pcs[msg.remoteId];
        pc.remoteId = msg.remoteId;
        let desc = msg.desc;
        if (desc.type === 'offer') {
            log('WebRTC', 'message', 'receive offer', msg.remoteId, desc);
            log('WebRTC', 'function', 'setRemoteDescription()', desc);
            pc.setRemoteDescription(new RTCSessionDescription(desc))
                .then(_ =>{
                    return pc.createAnswer();
                })
                .then(answer => {
                    log('WebRTC', 'function', 'setLocalDescription()', answer);
                    return pc.setLocalDescription(new RTCSessionDescription(answer));
                })
                .then(_ => {
                    signalingChannel.send({desc: pc.localDescription}, pc.remoteId);
                })
                .catch(error => {
                    log('WebRTC', 'error', error.name + ": " + error.message);
                });
        } else if (desc.type === 'answer') {
            log('WebRTC', 'message', 'recevie answer', msg.remoteId, desc);
            log('WebRTC', 'function', 'setRemoteDescription()', desc);
            pc.setRemoteDescription(new RTCSessionDescription(desc))
                .catch(error => {
                    log('WebRTC', 'error', error.name + ": " + error.message);
                })
                .then(_ => {
                    if(window.chrome) {
                        setTimeout(function() {
                            if(window.chromeGetStats) chromeGetStats().then(displayReport);
                        }, 1000);
                    } else {
                        setTimeout(function() {
                            if(window.firefoxGetStats) firefoxGetStats().then(displayReport);
                        }, 1000);
                    }
                });
        } else
            log('WebRTC error', 'Unsupported SDP type. Your code may differ here.');
    } else {
        log('WebRTC', 'message', 'receve candidate', msg.remoteId, msg.candidate);
        log('WebRTC', 'function', 'addIceCandidate()', msg.candidate);
        pcs[msg.remoteId].addIceCandidate(new RTCIceCandidate(msg.candidate))
            .catch(error => {
                log('WebRTC error', error.name + ": " + error.message);
            });
    }
};

function webrtcStart(remoteId) {
    logs = [];
    log('function', 'call', 'webrtStart', remoteId);
    log('WebRTC', 'function', 'new RTCPeerConnection', configuration);
    var pc = pcs[remoteId] = new RTCPeerConnection(configuration);
    pc.remoteId = remoteId;

    pc.onicecandidate = evt => {
        log('WebRTC', 'event', 'onicecandidate', evt.candidate);
        if(evt.candidate) {
            signalingChannel.send({candidate: evt.candidate}, remoteId);
        }
    }
    
    pc.onnegotiationneeded = _ => {
        log('WebRTC', 'event', 'onnegotiationneeded');
        log('WebRTC', 'function', 'createOffer');
        pc.createOffer()
            .then(offer => {
                log('WebRTC', 'function', 'setLocalDescription', offer);
                return pc.setLocalDescription(offer);
            })
            .then(_ => signalingChannel.send({desc: pc.localDescription}, remoteId))
            .catch(error => {
                log('WebRTC', 'error', error.name + ": " + error.message);
            });
    };
    
    pc.oniceconnectionstatechange = function(evt) {
        log('WebRTC', 'event', 'oniceconnectionstatechange', pc.iceConnectionState);
        if(['closed', 'failed'].includes(pc.iceConnectionState)) {
            if(pcs[this.remoteId]) removeMember(this.remoteId);
        }
    }

    if('ontrack' in pc) {
        pc.ontrack = function(evt) {
            log('WebRTC', 'event', 'ontrack');
            if(evt.track.kind === 'video') {
                addStreamElement(remoteId, {stream: evt.streams[0]});
            }
        };
    } else {
        pc.onaddstream = function(evt) {
            log('WebRTC', 'event', 'onaddstream');
            addStreamElement(this.remoteId, {stream: evt.stream});
        }
    }

    if(streams[myId]) {
        Object.entries(streams[myId]).forEach(([key, streamInfo]) => {
            addStreamElement(myId, streamInfo);
            addTracks(pc, streamInfo.stream);
        });
    }
}

function addTracks(pc, stream) {
    log('function', 'call', 'addTracks', pc, stream);
    if(pc.addTrack) {
        stream.getTracks().forEach(track => {
            log('WebRTC', 'function', 'pc.addTrack', stream.id);
            trackSenders[track.id] = pc.addTrack(track, stream);
        });
    } else {
        log('WebRTC', 'function', 'pc.addStream', stream.id);
        pc.addStream(stream);
    }
}

function createVideoFileStream(file) {
    log('functoin', 'call', 'createVideoFileStream', file);
    var video = document.createElement('video');
    video.width = 320;
    video.height = 240;
    var srcURL = URL.createObjectURL(file);
    video.src = srcURL;
    video.onloadedmetadata = function() { // oncanplayだと複数回イベントが発生してしまうためonloadedmetadataに変更
        var src = audioContext.createMediaElementSource(video);
        var dst = src.connect(audioContext.createMediaStreamDestination());
        video.play();
        var [cnv, ctx] = createRenderCanvas();
        var audioTrack = dst.stream.getAudioTracks()[0];
        var videoTrack = cnv.captureStream().getVideoTracks()[0];
        var stream = new MediaStream([audioTrack, videoTrack]);
        var ratio = Math.min(cnv.width / video.videoWidth, cnv.height / video.videoHeight);
        streams[myId][stream.id] = {
            cnv: cnv,
            ctx: ctx,
            media: video,
            srcURL: srcURL,
            left: (cnv.width - (video.videoWidth * ratio)) / 2,
            top: (cnv.height - (video.videoHeight * ratio)) / 2,
            width: video.videoWidth * ratio,
            height: video.videoHeight * ratio,
            stream: stream
        };
        var remoteIds = Object.keys(pcs);
        for(var remoteId in pcs) {
            addTracks(pcs[remoteId], stream);
        }
        if(!renderStreamId) renderDummyVideoTrack();
    }
}

function createDummyStream(audio = false, video = true) {
    log('function', 'call', 'createDummyStream', audio, video);
    if(!audio && !video) throw 'createDummyStream argument error';
    if(Object.entries(streams[myId] || {}).length >= 3) {
        log('log', 'limit 3 streams');
        return;
    }
    return createDummyAundioTrack(audio)
        .then(tracks => createDummyVideoTrack(video, tracks))
        .then(([streamInfo, tracks]) => {
            streamInfo.stream = new MediaStream(tracks);
            return streamInfo;
        });
}

function createDummyAundioTrack(flg = true) {
    log('function', 'call', 'createDummyAudioTrack', flg);
    if(!flg) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
        let oscillator = audioContext.createOscillator();
        let dst = oscillator.connect(audioContext.createMediaStreamDestination());
        oscillator.start();
        dst.stream.getAudioTracks()[0].enabled = false;
        resolve([dst.stream.getAudioTracks()[0]]);
    });
}

function createDummyVideoTrack(flg, tracks) {
    log('function', 'call', 'createDummyVideoTrack', flg, tracks);
    if(!flg) return Promise.resolve([{}, tracks]);
    return new Promise((resolve, reject) => {
        var [cnv, ctx] = createRenderCanvas();
        let img = new Image();
        img.onload = function() {
            var ratio = Math.min(cnv.width / img.naturalWidth, cnv.height / img.naturalHeight);
            tracks.push(cnv.captureStream().getVideoTracks()[0]);
            resolve([{
                cnv: cnv,
                ctx: ctx,
                media: img,
                left: (cnv.width - (img.naturalWidth * ratio)) / 2,
                top: (cnv.height - (img.naturalHeight * ratio)) / 2,
                width: img.naturalWidth * ratio,
                height: img.naturalHeight * ratio,
                time: true
            }, tracks]);
        }
        var no = Object.entries(streams[myId] || {}).length;
        img.src = `./${myId}/${no}.jpg`;
    });
}

function createRenderCanvas() {
    let cnv = document.createElement('canvas');
    cnv.style.position = 'absolute';
    cnv.style.top = '-100000px';
    document.body.appendChild(cnv);
    cnv.width = 320;
    cnv.height = 240;
    var ctx = cnv.getContext('2d');
    ctx.font = '44px arial';
    ctx.strokStyle = 'black';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'right';
    return [cnv, ctx];
}

function renderDummyVideoTrack() {
    renderStreamId = requestAnimationFrame(renderDummyVideoTrack);
    var localStreams = streams[myId];
    var keys = Object.keys(localStreams);
    for(var i = keys.length; i--;) {
        var {cnv, ctx, media, left, top, width, height, time = false} = localStreams[keys[i]];
        ctx.clearRect(0, 0, cnv.width, cnv.height);
        ctx.drawImage(media, left, top, width, height);
        if(time) {
            var dt = new Date();
            var dtStr = [dt.getHours(), dt.getMinutes(), dt.getSeconds()].map(v => ('0' + v).slice(-2)).join(':');
            ctx.strokeText(dtStr, cnv.width - left - 1, cnv.height - top - 1);
            ctx.fillText(dtStr, cnv.width - left - 3, cnv.height - top - 3);
        }
    };
}


var logs = [];
var logTypes = ['WebRTC'];
var logSubTypes = ['event', 'function'];
bcex.on('log', logData => {
    logs.push(logData);
});

function log(type, subType, msg, arg, arg2, arg3) {
    if(logTypes.includes(type) && logSubTypes.includes(subType)) {
        var time = window.performance.now();
        if(!bcex.isHost) {
            bcex.emit('log', {id: bcex.myId, msg, arg, arg2, arg3, time });
        }
        console.log(msg, dtStr);
    }
}

