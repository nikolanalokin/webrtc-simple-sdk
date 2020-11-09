class MediaHelper {
  constructor () {}

  static async getDevices () {
    try {
      let stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      let devices = await navigator.mediaDevices.enumerateDevices()
      let audioList = []
      let videoList = []
      devices.forEach(device => {
        let [kind, type, direction] = device.kind.match(/(\w+)(input|output)/i)
        if (direction === 'output') return false
        let info = JSON.parse(JSON.stringify(device))
        if (type === 'audio') {
          if (audioList.some(v => v.groupId === device.groupId && device.groupId !== '')) return false
          if (!info.label) info.label = `Microphone (${audioList.length || 'default'})`
          audioList.push(info)
        } else if (type === 'video') {
          if (videoList.some(v => v.groupId === device.groupId && device.groupId !== '')) return false
          if (!info.label) info.label = `Camera (${videoList.length || 'default'})`
          videoList.push(info)
        }
      })
      stream.getTracks().forEach(v => {
        v.stop()
        v = null
      })
      stream = null
      return {
        audio: audioList,
        video: videoList
      }
    } catch (err) {
      console.error(err)
      throw err
    }
  }
  static async getAudioInputDevices () {
    try {
      let stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      let devices = await navigator.mediaDevices.enumerateDevices()
      devices = devices.filter(v => v.kind === 'audioinput')
      let devicesList = []
      devices.forEach(device => {
        if (devicesList.some(v => v.groupId === device.groupId && device.groupId !== '')) return false
        let info = JSON.parse(JSON.stringify(device))
        if (!info.label) info.label = `Microphone (${devicesList.length || 'default'})`
        devicesList.push(info)
      })
      stream.getTracks().forEach(v => {
        v.stop()
        v = null
      })
      stream = null
      return devicesList
    } catch (err) {
      console.error(err)
    }
  }
  static async getAudioOutputDevices () {
    try {
      let devices = await navigator.mediaDevices.enumerateDevices()
      devices = devices.filter(v => v.kind === 'audiooutput')
      let devicesList = []
      devices.forEach(device => {
        if (devicesList.some(v => v.groupId === device.groupId && device.groupId !== '')) return false
        let info = JSON.parse(JSON.stringify(device))
        if (!info.label) info.label = `Speakers (${devicesList.length || 'default'})`
        devicesList.push(info)
      })
      return devicesList
    } catch (err) {
      console.error(err)
    }
  }
  static async getVideoInputDevices () {
    try {
      let stream = await navigator.mediaDevices.getUserMedia({ video: true })
      let devices = await navigator.mediaDevices.enumerateDevices()
      devices = devices.filter(v => v.kind === 'videoinput')
      let devicesList = []
      devices.forEach(device => {
        if (devicesList.some(v => v.groupId === device.groupId && device.groupId !== '')) return false
        let info = JSON.parse(JSON.stringify(device))
        if (!info.label) info.label = `Camera (${devicesList.length || 'default'})`
        devicesList.push(info)
      })
      stream.getTracks().forEach(v => {
        v.stop()
        v = null
      })
      stream = null
      return devicesList
    } catch (err) {
      console.error(err)
    }
  }
  static async getStream (constraints) {
    try {
      let stream = await navigator.mediaDevices.getUserMedia(constraints)
      return stream
    } catch (err) {
      console.error(err)
    }
  }


  static async ___ () {
    try {

    } catch (err) {
      
    }
  }
}