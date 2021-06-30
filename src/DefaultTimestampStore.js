import AbstractTimestampStore from './AbstractTimestampStore';

/* localstorage */
export default class DefaultTimestampStore extends AbstractTimestampStore {
  constructor(key) {
    super(key, window ? window.localStorage : null);
  }

  async get() {
    return JSON.parse(this.storage.getItem(this.key));
  }

  async set(data) {
    return this.storage.setItem(this.key, JSON.stringify(data));
  }

  async remove() {
    return this.storage.removeItem(this.key);
  }
}
