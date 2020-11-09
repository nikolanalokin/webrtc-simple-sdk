const pcDefaultConfig = {
  // bundlePolicy: 'balanced'
  // iceCandidatePoolSize: 0,
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302']
    }
  ],
  iceTransportPolicy: 'all',
  // peerIdentity: null,
  // rtcpMuxPolicy: 'require',
}

const offerOpts = {
  iceRestart: false,
  offerToReceiveAudio: true,
  offerToReceiveVideo: true,
  voiceActivityDetection: true
}

const answerOpts = {
  voiceActivityDetection: true
}

class Peer extends EventDispatcher {
  constructor (opts) {
    super()

    this.pcConfig = opts && opts.pcConfig ? Object.assign({}, pcDefaultConfig, opts.pcConfig) : pcDefaultConfig

    this.id = opts && opts.id || uuid()
    this.bandwidth = opts.bandwidth || null

    this.debug = true

    this.iceCandidatesLocalQueue = []
    this.iceCandidatesRemoteQueue = []
    this.senders = []

    this.createPeerConnection()
  }

  log (...args) {
    if (this.debug) {
      console.log(`[Peer] id: ${this.id}`, ...args)
    }
  }

  createPeerConnection () {
    this.log('createPeerConnection')
    this.pc = new RTCPeerConnection(this.pcConfig)
    
    this.pc.addEventListener('negotiationneeded', this.onnegotiationneeded.bind(this))
    this.pc.addEventListener('connectionstatechange', this.onconnectionstatechange.bind(this))
    this.pc.addEventListener('iceconnectionstatechange', this.oniceconnectionstatechange.bind(this))
    this.pc.addEventListener('icegatheringstatechange', this.onicegatheringstatechange.bind(this))
    this.pc.addEventListener('signalingstatechange', this.onsignalingstatechange.bind(this))
    this.pc.addEventListener('track', this.ontrack.bind(this))
    this.pc.addEventListener('datachannel', this.ondatachannel.bind(this))
    this.pc.addEventListener('icecandidate', this.onicecandidate.bind(this))
    this.pc.addEventListener('icecandidateerror', this.onicecandidateerror.bind(this))
    this.pc.addEventListener('isolationchange', this.onisolationchange.bind(this))
    this.pc.addEventListener('statsended', this.onstatsended.bind(this))
  }

  closePeerConnection () {
    this.log('closePeerConnection')
    this.pc.close()
    this.pc = null
  }

  setLocalStream (stream) {
    this.log('setLocalStream:', stream)
    this.localStream = stream
    let tracks = this.localStream.getTracks()
    tracks.forEach(track => {
      let sender = this.pc.addTrack(track, this.localStream)
      this.senders.push(sender)
    })
    this.log('senders:', this.senders)
  }

  destroy () {
    this.log('destroy')
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop())
      this.localStream = null
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
      this.remoteStream = null
    }

    if (this.pc) {
      this.closePeerConnection()
    }

    if (this.dc) {
      this.closeDataChannel()
    }

    this.iceCandidatesLocalQueue = []
    this.iceCandidatesRemoteQueue = []

    this.sdOffer = null
    this.sdAnswer = null

    this.senders = []
  }
 
  /**
   * состояния:
   * new, connecting, connected, disconnected, failed, closed
   * @support Edge, Chrome, Safari
   * @param {*} e 
   */
  onconnectionstatechange (e) {
    let state = e.target.connectionState
    this.log('on connection state change:', state)
    switch(state) {
      case 'connected':
        // The connection has become fully connected
        break
      case 'disconnected':
      case 'failed':
        // One or more transports has terminated unexpectedly or in an error
        break
      case 'closed':
        // The connection has been closed
        break
    }

  }
  /**
   * состояния:
   * new, checking, connected, completed, failed, disconnected, closed
   */
  oniceconnectionstatechange (e) {
    let state = e.target.iceConnectionState
    this.log('on ice connection state change:', state)
    switch(state) {
      case 'disconnected':
        break
      case 'failed':
        this.dispatch('restartice')
        break
      case 'closed':
        break
    }
  }
  /**
   * состояния:
   * new, gathering, complete
   */
  onicegatheringstatechange (e) {
    let state = e.target.iceGatheringState
    this.log('on ice gathering state change:', state)
    if (state === 'complete') {
      const senders = this.pc.getSenders()
      const transceivers = this.pc.getTransceivers()

      senders.forEach((sender) => {
        console.log(sender.track.kind, sender.track.id, sender.getParameters())
      })
      transceivers.forEach((transceiver) => {
        console.log(transceiver)
      })
    }
  }
  /**
   * состояния:
   * stable, have-local-offer, have-remote-offer, have-local-pranswer, have-remote-pranswer
   */
  onsignalingstatechange (e) {
    let state = e.target.signalingState
    this.log('on signaling state change:', state)
  }
  onicecandidate (e) {
    this.log('onicecandidate:')
    if (e.candidate) {
      this.iceCandidatesDispatchEnded = false
      this.iceCandidatesLocalQueue.push(e.candidate)
      this.dispatch('icecandidate', e.candidate)
    } else {
      this.iceCandidatesDispatchEnded = true
    }
  }
  onicecandidateerror (e) {
    this.log('onicecandidateerror:', e)
    // if (e.errorCode >= 300 && e.errorCode <= 699) {
    //   // Ошибки STUN находятся в диапазоне 300-699. См. RFC 5389, раздел 15.6. для списка кодов.
    //   // TURN добавляет еще несколько кодов ошибок. См. RFC 5766, раздел 15 для деталей.
    // } else if (e.errorCode >= 700 && e.errorCode <= 799) {
    //   // Сервер не может быть достигнут; конкретный номер ошибки предоставлены, но они еще не указаны.
    // }
  }
  onnegotiationneeded () {
    this.log('onnegotiationneeded')
    this.dispatch('negotiationneeded')
  }
  ontrack (e) {
    this.log('ontrack:', e)
    let stream = e.streams && e.streams[0]
    if (stream) {
      if (!this.remoteStream) this.dispatch('remotestream', stream)
      this.remoteStream = stream
    } else {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream()
        this.dispatch('remotestream', this.remoteStream)
      }
      if (e.track) {
        this.remoteStream.addTrack(e.track)
      }
      this.dispatch('updateremotestream', this.remoteStream)
    }
  }
  ondatachannel (e) {
    this.log('ondatachannel')
  }
  onisolationchange (e) {
    this.log('onisolationchange')
  }
  onstatsended (e) {
    this.log('onstatsended')
  }

  async addIceCandidate (candidate) {
    this.log('addIceCandidate:', candidate)
    try {
      if (!this.hasOffer) {
        this.iceCandidatesRemoteQueue.push(candidate)
      } else {
        if (this.iceCandidatesRemoteQueue.length > 0) {
          while (this.iceCandidatesRemoteQueue.length > 0) {
            await this.pc.addIceCandidate(new RTCIceCandidate(this.iceCandidatesRemoteQueue.shift()))
          }
        }
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
    } catch (err) {
      console.error(err)
    }
  }

  async createOffer (opts) {
    this.log('createOffer')
    let confs = Object.assign({}, offerOpts, opts)
    try {
      this.sdOffer = await this.pc.createOffer(confs)
      await this.setLocalDescription(this.sdOffer)
      return this.sdOffer
    } catch (err) {
      console.error(err)
    }
  }

  get hasOffer () {
    return Boolean(this.pc.localDescription)
  }

  async createAnswer (opts) {
    this.log('createAnswer')
    let confs = Object.assign({}, answerOpts, opts)
    try {
      this.sdAnswer = await this.pc.createAnswer(confs)
      await this.setLocalDescription(this.sdAnswer)
      return this.sdAnswer
    } catch (err) {
      console.error(err)
    }
  }

  get hasAnswer () {
    return Boolean(this.pc.remoteDescription)
  }
  
  async setLocalDescription (sd) {
    this.log('setLocalDescription')
    try {
      await this.pc.setLocalDescription(new RTCSessionDescription(sd))
    } catch (err) {
      console.error(err)
    }
  }
  
  async setRemoteDescription (sd) {
    this.log('setRemoteDescription')
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(sd))
    } catch (err) {
      console.error(err)
    }
  }

  // changeAudioCodec (mimeType) {
  //   const transceivers = this.pc.getTransceivers()
  
  //   transceivers.forEach(transceiver => {
  //     const kind = transceiver.sender.track.kind
  //     let sendCodecs = RTCRtpSender.getCapabilities(kind).codecs
  //     let recvCodecs = RTCRtpReceiver.getCapabilities(kind).codecs
  
  //     if (kind === 'audio') {
  //       sendCodecs = preferCodec(sendCodecs, mimeType)
  //       recvCodecs = preferCodec(recvCodecs, mimeType)
  //       transceiver.setCodecPreferences([...sendCodecs, ...recvCodecs])
  //     }
  //   })
  
  //   this.pc.onnegotiationneeded()
  // }

  // changeVideoCodec (mimeType) {
  //   const transceivers = this.pc.getTransceivers()
  
  //   transceivers.forEach(transceiver => {
  //     const kind = transceiver.sender.track.kind
  //     let sendCodecs = RTCRtpSender.getCapabilities(kind).codecs
  //     let recvCodecs = RTCRtpReceiver.getCapabilities(kind).codecs
  
  //     if (kind === 'video') {
  //       sendCodecs = preferCodec(sendCodecs, mimeType)
  //       recvCodecs = preferCodec(recvCodecs, mimeType)
  //       transceiver.setCodecPreferences([...sendCodecs, ...recvCodecs])
  //     }
  //   })
  
  //   this.pc.onnegotiationneeded()
  // }

  getPeerConnectionStat () {
    if (this.peer.pc) {
      this.peer.pc.getStats().then(response => {
        let stats = []
        response.forEach(report => {
          stats.push(report)
        })
        this.runCallback('onPeerConnectionStats', stats)
      })
    }
  }

  getPeerConnectionSendersStats () {
    return new Promise((resolve, reject) => {
      let senders = this.peer.pc.getSenders()
      let ps = []
      senders.forEach(sender => {
        ps.push(sender.getStats())
      })
      Promise.all(ps).then(responses => {
        let res = []
        responses.forEach((response, index) => {
          let stats = []
          response.forEach(report => {
            stats.push(report)
          })
          res.push({
            sender: senders[index],
            stats
          })
        })
        resolve(res)
      }).catch(err => {
        reject(err)
      })
    })
  }

  setBitrate (bitrate = 'unlimited') {
    if ((adapter.browserDetails.browser === 'chrome' ||
      adapter.browserDetails.browser === 'safari' ||
      (adapter.browserDetails.browser === 'firefox' &&
      adapter.browserDetails.version >= 64)) &&
      'RTCRtpSender' in window &&
      'setParameters' in window.RTCRtpSender.prototype) {
      if (this.peer.pc) {
        let senders = this.peer.pc.getSenders()
        senders.forEach(sender => {
          if (sender.track.kind === 'video') {
            let parameters = sender.getParameters()
            if (parameters.encodings && parameters.encodings.length > 0) {
              parameters.encodings.forEach(item => {
                if (bitrate === 'unlimited') {
                  delete item.maxBitrate
                } else {
                  item.maxBitrate = bitrate
                }
              })
              console.log('Sender parameters:', parameters)
              sender.setParameters(parameters).then(() => {
                console.log('Bitrate successful setted.')
              }).catch(err => {
                console.log('Failed to set bitrate:', err)
              })
            }
          }
        })
      }
    }
  }

  updateSdpForBandwidth (sdp) {
    let modifier = 'AS'
    let bandwidth = this.bandwidth
    if (bandwidth) {
      if (adapter.browserDetails.browser === 'firefox') {
        bandwidth = (bandwidth >>> 0) * 1000
        modifier = 'TIAS'
      }
      if (sdp.indexOf('b=' + modifier + ':') === -1) {
        // insert b= after c= line.
        sdp = sdp.replace(/c=IN (.*)\r\n/, 'c=IN $1\r\nb=' + modifier + ':' + bandwidth + '\r\n')
      } else {
        sdp = sdp.replace(new RegExp('b=' + modifier + ':.*\r\n'), 'b=' + modifier + ':' + bandwidth + '\r\n')
      }
    }
    console.log('sdp bandwidth added', bandwidth)
    return sdp
  }
  
  createDataChannel (label, opts) {
    this.log('createDataChannel')
    try {
      this.dc = this.pc.createDataChannel(label, opts)
      this.dc.onopen = (e) => {
        this.dispatch('datachannel:open', e)
      }
      this.dc.onmessage = (e) => {
        this.dispatch('datachannel:message', e.data)
      }
      this.dc.onbufferedamountlow = (e) => {
        this.dispatch('datachannel:bufferedamountlow', e)
      }
      this.dc.onclose = (e) => {
        this.dispatch('datachannel:close', e)
      }
      this.dc.onerror = (e) => {
        this.dispatch('datachannel:error', e)
      }
    } catch (err) {
      console.error(err)
    }
  }

  closeDataChannel () {
    this.log('closeDataChannel')
    this.dc.close()
    this.dc = null
  }
}

function uuid () {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15 >> c/4).toString(16))
}

// function preferCodec (codecs, mimeType) {
//   let otherCodecs = []
//   let sortedCodecs = []

//   codecs.forEach(codec => {
//     if (codec.mimeType === mimeType) {
//       sortedCodecs.push(codec)
//     } else {
//       otherCodecs.push(codec)
//     }
//   })

//   return sortedCodecs.concat(otherCodecs)
// }