const eventHandlers = Symbol('eventHandlers')
const bcSend = Symbol('bcSend')
const onmessage = Symbol('onmessage')

class BroadcastChannelEx {
    constructor(options) {
        this.options = Object.assign({
            channel: 'BroadcastChannelEx',
            idList: ['cat', 'dog', 'fish', 'squirrel'],
            onMyId: _ => {},
            onHost: _ => {},
            onJoinMember: _ => {},
            onJoined: _ => {},
            onLeaveMember: _ => {},
            onFull: _ => {}
        }, options)
        this.connectedMembers = null
        this.uuid = new (window.MediaStream || window.webkitMediaStream)().id.replace(/[{}]/g, '');
        this.bc = new BroadcastChannel(this.options.channel)
        this.myId = null
        this._isHost = false
        this[eventHandlers] = null
        this[bcSend] = msg => {
            this.bc.postMessage(JSON.stringify(msg))
        }

        window.addEventListener('beforeunload', _ => {
            if(!this.myId) return
            this[bcSend]({
                cmd: 'leave',
                remoteId: this.myId,
                remoteIsHost: this.isHost
            })
        })

        this.bc.onmessage = evt => {
            var msg = Object.assign({cmd: '-'}, JSON.parse(evt.data))
            if('toUUID' in msg && msg.toUUID !== this.uuid) return

            if(msg.eventName) {
                if(!this[eventHandlers][eventName]) return
                this[eventHandlers][eventName].forEach(eventHandler => eventHandler(msg))
                return
            }

            switch(msg.cmd) {
                case 'join':
                    if(this.connectedMembers) {
                        let memberId = this.options.idList.filter(id => !this.connectedMembers[id])[0]
                        if(memberId) {
                            if(!this.isHost) return
                            var memberUUIDs = Object.entries(this.connectedMembers)
                                                .filter(val => val[0] !== this.myId)
                                                .map(val => val[1])
                            for(var i = memberUUIDs.length; i--;) {
                                this[bcSend]({
                                    cmd: 'joinMember',
                                    memberId: memberId,
                                    memberUUID: msg.remoteUUID,
                                    toUUID: memberUUIDs[i]
                                })
                            }
                            this.connectedMembers[memberId] = msg.remoteUUID
                            this[bcSend]({
                                cmd: 'joined',
                                memberId: memberId,
                                toUUID: msg.remoteUUID,
                                connectedMembers: this.connectedMembers
                            })
                            this.options.onJoinMember(this.connectedMembers)
                        } else {
                            this[bcSend]({
                                cmd: 'full',
                                toUUID: msg.remoteUUID,
                                connectedMembers: this.connectedMembers
                            })
                        }
                    } else {
                        this.connectedMembers = {}
                        this.myId = this.myId || this.options.idList[0]
                        this.connectedMembers[this.myId] = this.uuid
                        let memberId = this.options.idList.filter(id => id !== this.myId)[0]
                        this.connectedMembers[memberId] = msg.remoteUUID
                        this[bcSend]({
                            cmd: 'joined',
                            memberId: memberId,
                            toUUID: msg.remoteUUID,
                            connectedMembers: this.connectedMembers
                        })
                        this.isHost = true
                        this.options.onJoinMember(this.connectedMembers)
                    }
                    break

                case 'joinMember':
                    this.connectedMembers = this.connectedMembers || {}
                    this.connectedMembers[msg.memberId] = msg.memberUUID
                    this.options.onJoinMember(this.connectedMembers)
                    break

                case 'joined':
                    this.myId = msg.memberId
                    this.connectedMembers = msg.connectedMembers
                    this.options.onJoined(this.connectedMembers)
                    break

                case 'leave':
                    if(!this.connectedMembers) return
                    delete this.connectedMembers[msg.remoteId]
                    if(!Object.keys(this.connectedMembers).length) this.connectedMembers = null
                    if(msg.remoteIsHost) {
                        this.options.idList.some(id => {
                            if(this.connectedMembers[id]) {
                                if(this.myId === id) this.isHost = true
                                return true
                            }
                            return false
                        })
                    }
                    this.options.onLeaveMember(msg.remoteId)
                    break
                
                case 'full':
                    this.connectedMembers = msg.connectedMembers
                    this.options.onFull()
                    break
            }
        }
    }

    get isHost() {
        return this._isHost;
    }

    set isHost(val) {
        if(!this._isHost && val) {
            this._isHost = val;
            this.options.onHost();
        }
    }

    get myId() {
        return this._myId;
    }

    set myId(val) {
        if(!this._myId && val) {
            this._myId = val;
            this.options.onMyId(this._myId);
        }
    }

    join() {
        this[bcSend]({
            cmd: 'join',
            remoteUUID: this.uuid
        })
    }

    emit(eventName, msg, to) {
        to = to || this.connectedMembers
        if(to) {
            if(typeof to === 'string') to = [to]
            for(let toUUID of to) {
                bcSend({eventName, msg, toUUID})
            }
        } else {
            bcSend({eventName, msg})
        }
    }

    on(eventName, eventHandler) {
        this[eventHandlers][eventName] = this[eventHandlers][eventName] || []
        this[eventHandlers][eventName].push(eventHandler)
    }

    off(eventName, eventHandler) {
        if(!this[eventHandlers][eventName]) return
        if(eventHandler) {
            let idx = this[eventHandlers][eventName].indexOf(eventHandler)
            if(idx === -1) return
            this[eventHandlers][eventName].splice(idx, 1)
        } else {
            delete this[eventHandlers][eventName]
        }
    }
}
