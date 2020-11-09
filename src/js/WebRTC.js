const connectionConfig = {
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302']
    }
  ]
}

const offerOptions = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true,
  voiceActivityDetection: true,
  iceRestart: false
}

const constraints = {
  video: true,
  audio: true
}

class WebRTC extends EventDispatcher {
  constructor (opts) {
    super()
    
    this.id = uuid()
    this.signalBus = opts.signalBus

    this.connected = false
    
    this.peersMap = new Map()

    this.signalBus.on('webrtc:signal:connect', this.onSignalConnect.bind(this))
    this.signalBus.on('webrtc:signal:connected', this.onSignalConnected.bind(this))
    this.signalBus.on('webrtc:signal:disconnect', this.onSignalDisconnect.bind(this))
    this.signalBus.on('webrtc:signal:offer', this.onSignalOffer.bind(this))
    this.signalBus.on('webrtc:signal:answer', this.onSignalAnswer.bind(this))
    this.signalBus.on('webrtc:signal:candidate', this.onSignalCandidate.bind(this))

    this.debug = false
  }

  log (...args) {
    if (this.debug) {
      console.log(`[WebRTC] id: ${this.id}`, ...args);
    }
  }

  connect () {
    this.connected = true

    this.signalBus.dispatch('webrtc:signal:connect', {
      source: this.id
    })
  }

  disconnect () {
    this.connected = false

    this.signalBus.dispatch('webrtc:signal:disconnect', {
      source: this.id
    })

    this.peersMap.forEach((peer) => {
      peer.destroy()
      this.dispatch('peerdestroy', { peer })
    })
    this.peersMap.clear()
  }

  onSignalDisconnect ({ source }) {
    if (source == this.id) return
    
    this.log('onSignalConnect', source)

    let peer = this.peersMap.get(source)
    if (peer) {
      this.dispatch('peerdestroy', { peer })
      peer.destroy()
      this.peersMap.delete(source)
    }
  }

  onSignalConnect ({ source }) {
    if (source == this.id) return
    
    this.log('onSignalConnect', source)

    this.peersMap.set(source, {})
    this.signalBus.dispatch('webrtc:signal:connected', {
      source: this.id,
      target: source
    })
  }

  async onSignalConnected ({ source, target }) {
    if (target !== this.id) return
    
    this.log('onSignalConnected', { source, target })

    try {
      let peer = this.createPeer(source)
      this.peersMap.set(source, peer)

      peer.setLocalStream(this.localStream)
      peer.on('negotiationneeded', async () => {
        let offer = await peer.createOffer()

        this.signalBus.dispatch('webrtc:signal:offer', {
          source: this.id,
          target: source,
          data: offer
        })
      })
    } catch (err) {
      console.warn(err)
    }
  }

  async onSignalOffer ({ source, target, data }) {
    if (target !== this.id) return
    
    this.log('onSignalOffer', { source, target, data })

    try {
      let peer = this.peersMap.get(source)
      
      if (peer.id) return
      
      peer = this.createPeer(source)
      this.peersMap.set(source, peer)

      peer.setLocalStream(this.localStream)
      peer.on('negotiationneeded', async () => {
        await peer.setRemoteDescription(data)
        let answer = await peer.createAnswer()
  
        this.signalBus.dispatch('webrtc:signal:answer', {
          source: this.id,
          target: source,
          data: answer
        })
      })
    } catch (err) {
      console.warn(err)
    }
  }

  async onSignalAnswer ({ source, target, data }) {
    if (target !== this.id) return
    
    this.log('onSignalAnswer', { source, target, data })

    try {
      let peer = this.peersMap.get(source)
      if (peer) await peer.setRemoteDescription(data)
    } catch (err) {
      console.warn(err)
    }
  }

  async onSignalCandidate ({ source, target, data }) {
    if (target !== this.id) return
    
    this.log('onSignalCandidate', { source, target, data })

    try {
      let peer = this.peersMap.get(source)
      if (peer) await peer.addIceCandidate(data)
    } catch (err) {
      console.warn(err)
    }
  }

  async getLocalStream (constraints) {
    try {
      this.localStream = await MediaHelper.getStream(constraints)
      this.dispatch('localstream', this.localStream)
    } catch (err) {
      console.warn(err)
    }
  }

  createPeer (id) {
    let peer = new Peer({ id, /* pcConfig: null */ })

    peer.on('icecandidate', (candidate) => {
      this.signalBus.dispatch('webrtc:signal:candidate', {
        source: this.id,
        target: peer.id,
        data: candidate
      })
    })
    peer.on('remotestream', (stream) => {
      this.dispatch('remotestream', {
        peer,
        stream
      })
    })
    peer.on('updateremotestream', (stream) => {
      this.dispatch('updateremotestream', {
        peer,
        stream
      })
    })
    peer.on('restartice', async () => {
      let offer = await peer.createOffer({ iceRestart: true })

      this.signalBus.dispatch('webrtc:signal:offer', {
        source: this.id,
        target: peer.id,
        data: offer
      })
    })

    return peer
  }

  /**
   * 
   * @param {Peer} peer 
   * @param {Object} opts: label, options
   * @param {Object} cbs: onChannelOpen, onChannelMessage, onChannelBufferedamountlow, onChannelClose, onChannelError
   */
  createChannel (peer, opts, cbs) {
    opts.label = opts.label || 'default'
    opts.options = opts.options || {}

    peer.createDataChannel(opts.label, opts.options)
    if (cbs.onChannelOpen) peer.on('datachannel:open', cbs.onChannelOpen)
    if (cbs.onChannelMessage) peer.on('datachannel:message', cbs.onChannelMessage)
    if (cbs.onChannelBufferedamountlow) peer.on('datachannel:bufferedamountlow', cbs.onChannelBufferedamountlow)
    if (cbs.onChannelClose) peer.on('datachannel:close', cbs.onChannelClose)
    if (cbs.onChannelError) peer.on('datachannel:error', cbs.onChannelError)
  }
}
