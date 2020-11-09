window.addEventListener('load', () => {
  let devices = {
    audio: [],
    video: []
  }

  let localVideos = []
  let videoWrappers = []

  let emitter = new EventDispatcher()
  let webrtcs = []
  let gumConstraints = {
    audio: true,
    video: true,
  }

  async function updateDevices () {
    devices = await MediaHelper.getDevices()
    console.log('devices', devices)

    let audioInputDevicesEl = document.getElementById('audioInputDevices')
    let videoInputDevicesEl = document.getElementById('videoInputDevices')

    let audioLabel = ''
    devices.audio.forEach(v => {
      audioLabel += `<div class="list-item">${v.label} - ${v.kind} - ${v.deviceId}</div>`
    })
    audioInputDevicesEl.innerHTML = audioLabel

    let videoLabel = ''
    devices.video.forEach(v => {
      videoLabel += `<div class="list-item">${v.label} - ${v.kind} - ${v.deviceId}</div>`
    })
    videoInputDevicesEl.innerHTML = videoLabel
  }

  navigator.mediaDevices.ondevicechange = () => {
    updateDevices()
  }

  let buttonAddPeer = document.getElementById('addPeer')
  buttonAddPeer.addEventListener('click', async () => {
    let w = createWebrtc()

    updateConstraints()
    
    await w.getLocalStream(gumConstraints)
    w.connect()
  })
  let buttonRemovePeer = document.getElementById('removePeer')
  buttonRemovePeer.addEventListener('click', () => {
    let w = webrtcs[webrtcs.length - 1]
    w.disconnect()
  })

  function addStream (container, id, stream) {
    let video = document.createElement('video')
    video.autoplay = true
    // video.muted = true
    video.srcObject = stream
    video.dataset.peerId = `${id}`
    video.dataset.streamId = `${stream.id}`

    let videoWrapper = document.createElement('div')
    videoWrapper.className = 'video-wrapper'
    
    videoWrapper.appendChild(video)
    container.appendChild(videoWrapper)
  }
  function updateStream (container, id, stream) {
    let video = container.querySelector(`[data-peer-id="${id}"][data-stream-id="${stream.id}"]`)
    video.srcObject = stream
  }
  function removeStream (container, id) {
    let video = container.querySelector(`[data-peer-id="${id}"]`)
    video.parentNode.remove()
  }

  let started = false
  window.addEventListener('click', () => {
    if (!started) {
      start()
      started = true
    }
  })

  function createWebrtc () {
    let container = document.createElement('div')
    container.className = 'video-container'

    let videoWrapper = document.createElement('div')
    videoWrapper.className = 'video-wrapper'

    let localVideo = document.createElement('video')
    localVideo.autoplay = true
    localVideo.muted = true
    
    videoWrapper.appendChild(localVideo)
    container.appendChild(videoWrapper)
    document.body.appendChild(container)

    localVideos.push(localVideo)
    videoWrappers.push(container)

    let webrtc = new WebRTC({
      signalBus: emitter
    })
    webrtc.on('localstream', (stream) => {
      localVideo.srcObject = stream
    })
    webrtc.on('remotestream', ({ peer, stream }) => {
      addStream(container, peer.id, stream)
    })
    webrtc.on('updateremotestream', ({ peer, stream }) => {
      updateStream(container, peer.id, stream)
    })
    webrtc.on('peerdestroy', ({ peer }) => {
      removeStream(container, peer.id)
    })

    webrtcs.push(webrtc)

    return webrtc
  }

  function randomInteger (min, max) {
    // случайное число от min до (max+1)
    let rand = min + Math.random() * (max + 1 - min);
    return Math.floor(rand);
  }

  function updateConstraints () {
    gumConstraints = {
      audio: true,
      video: {
        deviceId: devices.video[randomInteger(0, devices.video.length - 1)].deviceId,
        width: 640,
        height: 480
      },
    }
  }

  async function start () {
    await updateDevices()

    updateConstraints()
    
    let w1 = createWebrtc()
    await w1.getLocalStream(gumConstraints)

    updateConstraints()

    let w2 = createWebrtc()
    await w2.getLocalStream(gumConstraints)

    await w1.connect()
  }
})