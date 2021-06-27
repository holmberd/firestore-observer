 export default class EventEmitter {
  constructor() {
    this._events = {};
    this._counter = 0;
  }

  on(event, listener) {
    if (!this._events[event]) {
      this._events[event] = [];
    }
    const token = this._counter++;
    this._events[event].push({
      listener: listener,
      token: token,
    });
    return token;
  }

  emit(event, ...args) {
    if (!this._events[event]) {
      return false;
    }
    this._events[event].forEach((e) => e.listener(...args));
    return true;
  }

  removeListener(event, token) {
    if (this._events[event]) {
      if (token) {
        const index = this._events[event].findIndex((e) => e.token === token);
        if (index > -1) {
          this._events[event].splice(index, 1);
          return true;
        }
      }
    }
    return false;
  }

  removeAllListeners(event) {
    if (this._events[event]) {
      delete this._events[event];
      return true;
    }
    return false;
  }
}