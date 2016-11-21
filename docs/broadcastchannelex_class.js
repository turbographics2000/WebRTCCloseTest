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
            let msg = Object.assign({cmd: '-'}, JSON.parse(evt.data))
            if('toUUID' in msg && msg.toUUID !== this.uuid) return

            if(msg.eventName) {
                if(!this[eventHandlers][eventName]) return
                this[eventHandlers][eventName].forEach(eventHandler => eventHandler(msg))
                return
            }

            switch(msg.cmd) {
                case 'join':
                    if(this.connectedMembers) {
                        let resId = this.options.idList.filter(id => !this.connectedMembers[id])[0]
                        if(resId) {
                            this.connectedMembers[resId] = msg.remoteUUID
                            if(!this.isHost) return
                            this[bcSend]({
                                cmd: 'joinRes',
                                resId: resId,
                                toUUID: msg.remoteUUID,
                                connectedMembers: this.connectedMembers
                            })
                            this.options.onJoinMember(resId);
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
                        let resId = this.options.idList.filter(id => id !== this.myId)[0]
                        this.connectedMembers[resId] = msg.remoteUUID
                        this[bcSend]({
                            cmd: 'joinRes',
                            resId: resId,
                            toUUID: msg.remoteUUID,
                            connectedMembers: this.connectedMembers
                        })
                        this.isHost = true
                        this.options.onMyId(this.myId)
                        this.options.onJoinMember(resId)
                    }
                    break

                case 'joinRes':
                    this.myId = msg.resId
                    this.connectedMembers = msg.connectedMembers
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
        return this._isHost
    }

    set isHost(val) {
        if(!this._isHost && val) {
            this._isHost = val
            this.options.onHost()
        }
    }

    get myId() {
        return this._myId
    }

    set myId(val) {
        if(!this._myId && val) {
            this._myId = val
            this.options.onMyId(this._myId)
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
