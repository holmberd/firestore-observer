export default class AbstractTimestampStore {
  constructor(key, storage) {
    this.key = key;
    this.storage = storage;
  }

  async get() {
    throw Error('Not implemented');
  }

  async set(data) {
    throw Error('Not implemented');
  }

  async remove() {
    throw Error('Not implemented');
  }
}
