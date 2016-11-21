const configuration = { "iceServers": [{ "urls": "stun:stun.l.google.com:19302" }] };
let pcs = {};
let streams = {};
//let audioSenders = {};
//let videoSenders = {};
let trackSenders = {};
let renderStreamId = null;
let audioContext = new AudioContext();
let myId = null;


let signalingChannel = new BroadcastChannel('webrtc-track-and-close-test');
signalingChannel.send = (msg, toId) => {
    msg = Object.assign(msg, {remoteId: myId, toId});
    signalingChannel.postMessage(JSON.stringify(msg));
}

addStream.onclick = function() {

};


window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;

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
    console.log('joinRoom');
    signalingChannel.postMessage(JSON.stringify({join: true, remoteId: idList[0]}));
}

function addStreamElement(userId, streamInfo) {
    console.log('addStreamElement', userId, streamInfo);
    var container = document.body;
    var stream = streamInfo.stream;

    streams[userId] = streams[userId] || {};
    streams[userId][stream.id] = streamInfo;
    
    var streamContainer = document.getElementById('streams_' + userId);
    if(!streamContainer) {
        var title = document.createElement('h3');
        title.id = 'streamstitle_' + userId;
        title.textContent = userId + 'のストリーム';
        container.appendChild(title);
        streamContainer = document.createElement('div');
        streamContainer.id = 'streams_' + userId;
        container.appendChild(streamContainer);
    }
    
    var audioMeterContainer = document.createElement('div');
    var audioMeter = document.createElement('div');
    audioMeterContainer.appendChild(audioMeter);

    var video = streamInfo.video = document.createElement('video');
    video.srcObject = stream;
    video.muted = !!streamInfo.cnv;
    video.controls = true;
    video.play();
    var streamItem = streamInfo.streamItem = document.createElement('div');
    streamItem.appendChild(audioMeterContainer);
    streamItem.appendChild(video);
    streamContainer.appendChild(streamItem);
    
    var audioTracks = stream.getAudioTracks();
    if(audioTracks.length) {
        streamInfo.mediaStreamSource = audioContext.createMediaStreamSource(stream);
        streamInfo.audioProcessor = audioContext.createScriptProcessor(512);
        streamInfo.audioProcessor.audioMeter = audioMeter;
        streamInfo.audioProcessor.onaudioprocess = function(evt) {
            var buf = evt.inputBuffer.getChannelData(0);
            var maxVal = 0;
            for(var i = buf.length; i--;) {
                maxVal = Math.max(maxVal, buf[i]);
            }
            this.audioMeter.style.width = Math.min(~~(maxVal * 100), 100) + '%';
        }
        streamInfo.mediaStreamSource.connect(streamInfo.audioProcessor);
        streamInfo.audioProcessor.connect(audioContext.destination);
    } else {
        audioMeter.classList.add('no');
    }
};

function removeMember(memberId) {
    console.log('removeMebmer', memberId);
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
    console.log('removeStream', streamInfo);
    streamInfo.audioProcessor.onaudioprocess = null;
    streamInfo.stream.getTracks().forEach(track => {
        delete trackSenders[track.id];
        track.stop();
    });
    if(streamInfo.mediaStreamSource) {
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
//             console.log(error.name + ": " + error.message);
//         });
// }

signalingChannel.onmessage = function(evt) {
    let msg = JSON.parse(evt.data);
    console.log('signalingChannel.onmessage', msg.toId);
    if('toId' in msg && msg.toId !== myId) return;
    if (msg.desc) {
        if (!pcs[msg.remoteId]) webrtcStart(msg.remoteId);
        let pc = pcs[msg.remoteId];
        let desc = msg.desc;
        if (desc.type === 'offer') {
            console.log('receive offer', msg.remoteId, desc);
            pc.setRemoteDescription(new RTCSessionDescription(desc))
                .then(_ =>{
                    return pc.createAnswer();
                })
                .then(answer => {
                    return pc.setLocalDescription(new RTCSessionDescription(answer));
                })
                .then(_ => {
                    signalingChannel.send({desc: pc.localDescription}, msg.remoteId);
                })
                .catch(error => {
                    console.log(error.name + ": " + error.message);
                });
        } else if (desc.type === 'answer') {
            console.log('recevie answer', msg.remoteId, desc);
            pc.setRemoteDescription(new RTCSessionDescription(desc))
                .catch(error => {
                    console.log(error.name + ": " + error.message);
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
            console.log("Unsupported SDP type. Your code may differ here.");
    } else {
        console.log('receve candidate', msg.remoteId, msg.candidate);
        pcs[msg.remoteId].addIceCandidate(new RTCIceCandidate(msg.candidate))
            .catch(error => {
                console.log(error.name + ": " + error.message);
            });
    }
};

function webrtcStart(remoteId) {
    console.log('webrtStart', remoteId);
    var pc = pcs[remoteId] = new RTCPeerConnection(configuration);
    pc.remoteId = remoteId;

    pc.onicecandidate = evt => {
        console.log('onicecandidate', evt.candidate);
        if(evt.candidate) {
            signalingChannel.send({candidate: evt.candidate}, remoteId);
        }
    }
    
    pc.onnegotiationneeded = _ => {
        console.log('onnegotiationneeded');
        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(_ => signalingChannel.send({desc: pc.localDescription}, remoteId))
            .catch(error => {
                console.log(error.name + ": " + error.message);
            });
    };
    
    pc.oniceconnectionstatechange = function(evt) {
        console.log('oniceconnectionstatechange', pc.iceConnectionState);
        if(['closed', 'failed'].includes(pc.iceConnectionState)) {
            delete pcs[this.remoteId];
        }
    }

    if('ontrack' in pc) {
        pc.ontrack = function(evt) {
            console.log('ontrack');
            if(evt.track.kind === 'video') {
                addStreamElement(remoteId, {stream: evt.streams[0]});
            }
        };
    } else {
        pc.onaddstream = function(evt) {
            console.log('onaddstream');
            addStreamElement(this.remoteId, {stream: evt.stream});
        }
    }

    if(streams[myId]) {
        pc.onnegotiationneeded();
        Object.entries(streams[myId]).forEach(([key, streamInfo]) => {
            //addStreamElement(myId, streamInfo);
            //addTracks(pc, streamInfo.stream);
        });
    } else {
        createDummyStream(true, true).then(streamInfo => {
            addStreamElement(myId, streamInfo);
            addTracks(pc, streamInfo.stream);
            if(!renderStreamId) renderDummyVideoTrack();
        });
    }
}

function addTracks(pc, stream) {
    console.log('addTracks', pc, stream);
    if(pc.addTrack) {
        stream.getTracks().forEach(track => {
            trackSenders[track.id] = pc.addTrack(track, stream);
        });
    } else {
        pc.addStream(stream);
    }
}

function createDummyStream(audio = false, video = true) {
    console.log('createDummyStream', audio, video);
    if(!audio && !video) throw 'createDummyStream argument error';
    if(Object.entries(streams[myId] || {}).length >= 3) {
        console.log('limit 3 streams');
        return;
    }
    return createDummyAundioTrack(audio)
        .then(tracks => createDummyVideoTrack(video, tracks))
        .then(([streamInfo, tracks]) => {
            streamInfo.stream = new (window.MediaStream || window.webkitMediaStream)(tracks);
            return streamInfo;
        });
}

function createDummyAundioTrack(flg) {
    console.log('createDummyAudioTrack', flg);
    if(!flg) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
        let oscillator = audioContext.createOscillator();
        let dst = oscillator.connect(audioContext.createMediaStreamDestination());
        oscillator.start();
        dst.stream.getAudioTracks()[0].enabled = false;
        resolve([dst.stream.getAudioTracks()[0]]);
    });
}

function createDummyVideoTrack(video, tracks) {
    console.log('createDummyVideoTrack', video, tracks);
    if(!video) return Promise.resolve([{}, tracks]);
    return new Promise((resolve, reject) => {
        let cnv = document.createElement('canvas');
        cnv.style.position = 'absolute';
        cnv.style.top = '-100000px';
        document.body.appendChild(cnv);
        cnv.width = 320;
        cnv.height = 240;
        var ctx = cnv.getContext('2d');
        ctx.font = '44px arial';
        ctx.strokStyle = 'black'
        ctx.fillStyle = 'white';
        ctx.textAlign = 'right';
        let img = new Image();
        img.onload = function() {
            var ratio = Math.min(cnv.width / img.naturalWidth, cnv.height / img.naturalHeight);
            tracks.push(cnv.captureStream().getVideoTracks()[0]);
            resolve([{
                cnv: cnv,
                ctx: ctx,
                img: img,
                left: (cnv.width - (img.naturalWidth * ratio)) / 2,
                top: (cnv.height - (img.naturalHeight * ratio)) / 2,
                width: img.naturalWidth * ratio,
                height: img.naturalHeight * ratio,
            }, tracks]);
        }
        var no = Object.entries(streams[myId] || {}).length;
        img.src = `./${myId}/${no}.jpg`;
    });
}

function renderDummyVideoTrack() {
    renderStreamId = requestAnimationFrame(renderDummyVideoTrack);
    var localStreams = streams[myId];
    var keys = Object.keys(localStreams);
    for(var i = keys.length; i--;) {
        var {cnv, ctx, img, left, top, width, height} = localStreams[keys[i]];
        ctx.fillRect(0, 0, cnv.width, cnv.height);
        ctx.drawImage(img, left, top, width, height);
        var dt = new Date();
        var dtStr = [dt.getHours(), dt.getMinutes(), dt.getSeconds()].map(v => ('0' + v).slice(-2)).join(':');
        ctx.fillText(dtStr, cnv.width - left - 3, cnv.height - top - 3);
        ctx.strokeText(dtStr, cnv.width - left - 3, cnv.height - top - 3);
    };
}