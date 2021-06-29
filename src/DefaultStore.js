import AbstractStore from './AbstractStore';

/* localstorage */
export default class DefaultStore extends AbstractStore {
  constructor(key) {
    super(key);
    this.storage = window ? window.localStorage : null;
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
