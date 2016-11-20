let signalingChannel = new BroadcastChannel('webrtc-track-and-close-test');
const configuration = { "iceServers": [{ "urls": "stun:stun.l.google.com:19302" }] };
let pcs = {};
let localStreams = [];
let audioSenders = {};
let videoSenders = {};
let dummyStreams = [];
let renderStreamId = null;
let audioContext = new AudioContext();
let myId = null;
let connectedMembers = null;

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
    signalingChannel.postMessage(JSON.stringify({join: true, remoteId: idList[0]}));
}

function addStream(userId, stream) {
    var container = document.body;
    
    var remoteStreamContainer = document.getElementById('remoteStreams_' + userId);
    if(!remoteStreamContainer) {
        var title = document.createElement('h3');
        title.textContent = userId + 'のストリーム'; 
        remoteStreamContainer = document.createElement('div');
        remoteStreamContainer.id = 'remoteStreams_' + userId;
        container.appendChild(remoteStreamContainer);
    }
    
    var audioMeterContainer = document.createElement('div');
    var audioMeter = document.createElement('div');
    audioMeter.id = stream.id + '_audio';
    audioMeterContainer.appendChild(audioMeter);

    var video = document.createElement('video');
    video.id = stream.id + '_video';
    var streamContainer = document.createElement('div');
    streamContainer.appendChild(audioMeterContainer);
    streamContainer.appendChild(video);
    remoteStreamContainer.appendChild(streamContainer);
    
    var audioTracks = stream.getAudioTracks();
    if(audioTracks.length) {
        mediaStreamSource = audioContext.createMediaStreamSource(stream);
        audioProcessor = audioContext.createScriptProcessor(512);
        audioProcessor.meterId = stream.id + '_audio';
        audioProcessor.onaudioprocess = function(evt) {
            var buf = evt.inputBuffer.getChannelData(0);
            var maxVal = 0;
            for(var i = buf.length; i--;) {
                maxVal = Math.max(maxVal, buf[i]);
            }
            window[this.meterId].style.width = Math.min(~~(maxVal * 100), 100) + '%';
        }
        mediaStreamSource.connect(audioProcessor);
        audioProcessor.connect(audioContext.destination);
    } else {
        audioMeter.classList.add('no');
    }
    
    video.srcObject = stream;
    video.play();
};

function removeVideo(stream) {
    var video = document.getElementById(stream.id);
    if(!video) return;
    stream.getTracks().forEach(track => {
        track.stop();
    });
    video.srcObject = null;
    video.parentElement.removeChild(video);
    video = null;
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
    if('toId' in msg && msg.toId !== myId) return;
    if (msg.desc) {
        if (!pcs[msg.remoteId]) webrtcStart(msg.remoteId);
        let pc = pcs[msg.remoteId];
        let desc = msg.desc;
        if (desc.type === 'offer') {
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

    pc.oniceconnectionstatechange = evt => {
        console.log('oniceconnectionstatechange', evt);
    };
    
    pc.onicecandidate = evt => {
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
        if(pc.iceConnectionState === 'closed') {
            delete pcs[this.remoteId];
        }
    }

    if('ontrack' in pc) {
        pc.ontrack = function(evt) {
            if(evt.track.kind === 'video') {
                addStream(remoteId, evt.streams[0]);
            }
        };
    } else {
        pc.onaddstream = function(evt) {
            addStream(remoteId, evt.stream);
        }
    }

    if(localStreams.length) {
        localStreams.forEach(({stream}) => {
            addStream(myId, stream);
        });
    } else {
        createDummyStream(true, true).then(({stream}) => {
            addStream(myId, stream);
        });
    }
}

function addTracks(pc, stream) {
    if(pc.addTrack) {
        stream.getTracks().forEach(track => {
            if(track.kind === 'audio') {
                audioSenders.add(pc.addTrack(track, stream));
            } else if(track.kind === 'video') {
                videoSenders.add(pc.addTrack(track, stream));
            }
        });
    } else {
        pc.addStream(stream);
    }
}

function createDummyStream(audio = false, video = true) {
    if(!audio && !video) throw 'createDummyStream argument error';
    if(localStreams.length >= 3) {
        console.log('limit 3 streams');
        return;
    }
    return createDummyAundioTrack(audio)
        .then(tracks => createDummyVideoTrack(video, tracks))
        .then(([streamInfo, tracks]) => {
            //streamInfo.stream = new (window.MediaStream || window.webkitMediaStream)(tracks);
            localStreams.push(streamInfo);
            return streamInfo;
        });
}

function createDummyAundioTrack(flg) {
    if(!flg) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
        let oscillator = audioContext.createOscillator();
        let dst = oscillator.connect(audioContext.createMediaStreamDestination());
        oscillator.start();
        resolve([dst.stream.getAudioTracks()[0]]);
    });
}

function createDummyVideoTrack(video, tracks) {
    if(!video) return Promise.resolve([{}, tracks]);
    return new Promise((resolve, reject) => {
        let cnv = document.createElement('canvas');
        document.body.appendChild(cnv);
        cnv.width = 320;
        cnv.height = 240;
        var ctx = cnv.getContext('2d');
        ctx.font = '44px arial';
        ctx.strokStyle = 'black'
        ctx.fillStyle = 'white';
        ctx.textAlign = 'right';
        //ctx.textBaseline = 'middle';
        let img = new Image();
        img.onload = function() {
            var ratio = Math.min(cnv.width / img.naturalWidth, cnv.height / img.naturalHeight);
            var stream = cnv.captureStream(); 
            tracks.push(stream.getVideoTracks()[0]);
            resolve([{
                cnv: cnv,
                ctx: ctx,
                img: img,
                left: (cnv.width - (img.naturalWidth * ratio)) / 2,
                top: (cnv.height - (img.naturalHeight * ratio)) / 2,
                width: img.naturalWidth * ratio,
                height: img.naturalHeight * ratio,
                stream: stream
            }, tracks]);
            renderDummyVideoTrack();
        }
        img.src = `./${myId}/${localStreams.length}.jpg`;
    });
}

function renderDummyVideoTrack() {
    renderStreamId = requestAnimationFrame(renderDummyVideoTrack);
    for(var i = localStreams.length; i--;) {
        var {cnv, ctx, img, left, top, width, height} = localStreams[i];
        ctx.fillRect(0, 0, cnv.width, cnv.height);
        ctx.drawImage(img, left, top, width, height);
        var dt = new Date();
        var dtStr = [dt.getHours(), dt.getMinutes(), dt.getSeconds()].map(v => ('0' + v).slice(-2)).join(':');
        ctx.fillText(dtStr, cnv.width - left - 3, cnv.height - top - 3);
        ctx.strokeText(dtStr, cnv.width - left - 3, cnv.height - top - 3);
    };
}