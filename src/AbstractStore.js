export default class AbstractStorage {
  constructor(key) {
    this.key = key;
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
