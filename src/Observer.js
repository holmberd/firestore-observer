import EventEmitter from './EventEmitter';
import DefaultStore from './DefaultStore';

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

export default class Observer {
  unsubscribeToken = null;

/**
 * @constructor
 * @param {Firestore} firestore
 * @param {CollectionReference} collectionRef
 * @param {string} lastUpdatedField - Document last updated field key.
 * @param {string} storeKey - Store key for last sync timestamp.
 * @param {Store} [store] - Last sync timestamp store instance, defaults to localstorage.
 * @returns {Observer}
 */
  constructor(firestore, collectionRef, lastUpdatedField, storeKey, store = new DefaultStore(storeKey)) {
    this.store = store;
    this.events = new EventEmitter();
    this.firestore = firestore;
    this.collectionRef = collectionRef;
    this.lastUpdatedField = lastUpdatedField;
  }

  /**
   * Creates an Observer factory that uses the custom store for storing last sync timestamps.
   * @static
   * @param {Store} store
   */
  static createFactory(store) {
    if (!(store instanceof AbstractStore)) {
      throw Error('store is not an instance of AbstractStore');
    }
    return (...args) => Observer.create(...args, store);
  }

  static create(store, firestore, collectionRef, lastUpdatedField) {
    return new Observer(store, firestore, collectionRef, lastUpdatedField);
  }

  /**
   * @public
   * @param {function} callback
   */
  onCreated(callback) {
    this.events.on(Event.DOCUMENT_UPDATED, callback);
  }

  /**
   * @public
   * @param {function} callback
   */
  onUpdated(callback) {
    this.events.on(Event.DOCUMENT_UPDATED, callback);
  }

  /**
   * @public
   * @param {function} callback
   */
  onRemoved(callback) {
    this.events.on(Event.DOCUMENT_REMOVED, callback);
  }

  /**
   * Start observing a query.
   * @public
   * @async
   */
  async connect() {
    const timestamp = await this.getLastSyncTimestamp();

    //  If an error occrus the listener will not receive any more events.
    return this.addQueryListener(timestamp, err => {
      throw err;
    });
  }

  /**
   * Stop observing a query.
   * @public
   */
  disconnect() {
    this.removeQueryListener();
  }

  /**
   * Clears the last sync timestamp from storage.
   * @public
   */
  clearLastSyncTimestamp() {
    return this.store.remove();
  }

  addQueryListener(timestamp, errorCallback) {
    if (this.unsubscribeToken) {
      console.warn('Listener is already subscribed.');
      return false;
    }
    this.unsubscribeToken = this.onQuerySnapshot(timestamp, async (snapshot) => {
      try {
        await this.collectionListenerCallback(snapshot);
      } catch(err) {
        return errorCallback(err);
      }
    }, errorCallback);
    return this.unsubscribeToken;
  }

  onQuerySnapshot(timestamp, callback, errorCallback) {
    return this.collectionRef
      .where(this.lastUpdatedField, '>', timestamp)
      .onSnapshot(callback, errorCallback);
  }

  async collectionListenerCallback(snapshot) {
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

  removeQueryListener() {
    if (!this.unsubscribeToken) {
      console.warn('No unsubcribe token');
      return;
    }
    this.unsubscribeToken();
    this.unsubscribeToken = null;
  }

  async getLastSyncTimestamp() {
    const data = this.store.get();
    if (!data) {
      return this.firestore.Timestamp.fromDate(new Date(1900, 1, 1));
    }
    const { seconds, nanoseconds } = data;
    return new this.firestore.Timestamp(seconds, nanoseconds).toDate();
  }

  async updateLastSyncTimestamp(timestamp) {
    if (!timestamp) {
      throw Error('Missing required argument: timestamp');
    }
    return this.store(timestamp);
  }
}
