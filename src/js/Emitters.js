// Класс
class EventDispatcher {
  constructor () {
    this.__listeners = {}
  }
  on (eventName, handler) {
    if (!this.__listeners[eventName]) this.__listeners[eventName] = []
    if (handler instanceof Function) this.__listeners[eventName].push(handler)
    else console.warn('[EventDispatcher] Handler must be Function')
    return () => {
      this.__listeners[eventName] = this.__listeners[eventName].filter(eventFn => handler !== eventFn)
    }
  }
  off (eventName, handler) {
    let fns = this.__listeners[eventName]
    if (!fns) return
    for (let i = 0; i < fns; i++) {
      if (fns[i] === handler) fns.splice(i--, 1)
    }
  }
  dispatch (eventName, ...args) {
    let fns = this.__listeners[eventName]
    if (fns) fns.forEach(fn => {
      fn.apply(this, args)
    })
  }
}

// Миксин
const eventMixin = {
  on (eventName, handler) {
    if (!this.__listeners) this.__listeners = {}
    if (!this.__listeners[eventName]) this.__listeners[eventName] = []
    if (handler instanceof Function) this.__listeners[eventName].push(handler)
    else console.warn('[eventMixin] Handler must be Function')
    return () => {
      this.__listeners[eventName] = this.__listeners[eventName].filter(eventFn => handler !== eventFn)
    }
  },
  off (eventName, handler) {
    let fns = this.__listeners && this.__listeners[eventName]
    if (!fns) return
    for (let i = 0; i < fns; i++) {
      if (fns[i] === handler) fns.splice(i--, 1)
    }
  },
  dispatch (eventName, ...args) {
    let fns = this.__listeners && this.__listeners[eventName]
    if (fns) fns.forEach(fn => {
      fn.apply(this, args)
    })
  }
}