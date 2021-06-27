import EventEmitter from './EventEmitter';
import AbstractStore from './AbstractStore';

const ChangeType = {
  ADDED: 'added',
  MODIFIED: 'modified',
  REMOVED: 'removed',
};

const Event = {
  DOCUMENT_CREATED: 'DOCUMENT_CREATED',
  DOCUMENT_REMOVED: 'DOCUMENT_REMOVED',
  DOCUMENT_UPDATED: 'DOCUMENT_UPDATED',
};

class DefaultStore extends AbstractStore {
  constructor(key) {
    super(key);
    this.storage = window.localStorage;
  }

  async get() {
    return JSON.parse(this.storage.getItem(this.key));
  }

  async set(data) {
    return this.storage.setItem(this.key, JSON.stringify(data));
  }

  async remove(data) {
    return this.storage.removeItem(this.key, data);
  }
}

export default class Observer {
  unsubscribeToken = null;

  constructor(firestore, collectionRef, lastUpdatedField, storeKey, store = new DefaultStore(storeKey)) {
    this.store = store;
    this.events = new EventEmitter();
    this.firestore = firestore;
    this.collectionRef = collectionRef;
    this.lastUpdatedField = lastUpdatedField;
  }

  /** Creates an Observer factory using the set Store. */
  static createFactory(store) {
    if (!store instanceof AbstractStore) {
      throw Error('store is not an instance of AbstractStore');
    }
    return (...args) => Observer.create(...args, store);
  }

  static create(store, firestore, collectionRef, lastUpdatedField) {
    return new Observer(store, firestore, collectionRef, lastUpdatedField);
  }

  /** @public */
  onCreated(callback) {
    this.events.on(Event.DOCUMENT_UPDATED, callback);
  }

  /** @public */
  onUpdated(callback) {
    this.events.on(Event.DOCUMENT_UPDATED, callback);
  }

  /** @public */
  onRemoved(callback) {
    this.events.on(Event.DOCUMENT_REMOVED, callback);
  }

  /** @public */
  async connect() {
    const timestamp = await this.getLastSyncTimestamp();
    return this.addCollectionListener(timestamp);
  }

  /** @public */
  disconnect() {
    this.removeCollectionListener();
  }

  /** @public */
  clearLastSyncTimestamp() {
    return this.store.remove(this.lastSyncStorageKey);
  }

  addCollectionListener(timestamp) {
    if (this.unsubscribeToken) {
      console.warn('Listener is already subscribed.');
      return false;
    }
    this.unsubscribeToken = this.onCollectionSnapshot(timestamp, (snapshot) => {
      try {
        return this.collectionListenerCallback(null, snapshot);
      } catch (err) {
        this.collectionListenerCallback(err);
      }
    }, this.collectionListenerCallback);
    return this.unsubscribeToken;
  }

  onCollectionSnapshot(timestamp, callback, error) {
    return this.collectionRef
      .where(this.lastUpdatedField, '>', timestamp)
      .onSnapshot(callback, error);
  }

  collectionListenerCallback(err, snapshot) {
    if (err) {
      throw err;
    }

    if (!snapshot) {
      throw Error('No snapshot in windows listener');
    }

    if (snapshot.metadata.hasPendingWrites) {
      return;
    }

    const changes = snapshot.docChanges();
    const { ADDED, MODIFIED } = ChangeType;

    for (let change of changes) {
      const { type, doc } = change;
      const docData = doc.data();

      await this.updateLastSyncTimestamp(docData[this.lastUpdatedField]);

      if (type === ADDED) {
        if (docData.isDeleted) {
          this.events.emit(Event.DOCUMENT_REMOVED, docData);
          continue;
        }
        this.events.emit(Event.DOCUMENT_CREATED, docData);
      }

      if (type === MODIFIED) {
        if (docData.isDeleted) {
          this.events.emit(Event.DOCUMENT_REMOVED, docData);
          continue;
        }
        this.events.emit(Event.DOCUMENT_UPDATED, docData);
      }
    }
  }

  removeCollectionListener() {
    if (!this.unsubscribeToken) {
      console.warn('No unsubcribe token');
      return;
    }
    this.unsubscribeToken();
    this.unsubscribeToken = null;
  }

  async getLastSyncTimestamp() {
    const data = this.store.get(this.lastSyncStorageKey);
    if (!data) {
      return this.firestore.Timestamp.fromDate(new Date(1900, 1, 1));
    }
    const { seconds, nanoseconds } = JSON.parse(data)
    return new this.firestore.Timestamp(seconds, nanoseconds).toDate();
  }

  async updateLastSyncTimestamp(timestamp) {
    if (!timestamp) {
      throw Error('Missing required argument: timestamp');
    }
    return this.store(this.lastSyncStorageKey, timestamp);
  }
}
