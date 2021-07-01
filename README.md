# Firestore Query Observer
Firestore Query Observer is a wrapper library for Firestore realtime collection query listeners. It provides an API for creating realtime collection query listeners optimized for document reads.

## Overview

1. [Installation](#Installation)
4. [Usage](#Usage)
5. [API](#API)
2. [How it Works](#How-it-Works)
7. [License](#License)

## Installation
`npm install firestore-query-observer`

## Usage

```js
import firebase from 'firebase/app';
import 'firebase/firestore';

import Observer from 'firestore-query-observer';

firebase.initializeApp(firebaseConfig);

const db = firebase();

const CITIES_LAST_SYNC_KEY = 'citites-last-sync'; // Last sync timestamp storage key.
const LAST_UPDATED_FIELD = 'updatedAt'; // Our collection documents last updated field key.

const citiesRef = db.collection('cities');

// Add citites to the collection.

const newCities = [
  {
    name: 'Tokyo',
    country: 'Japan',
  },
  {
    name: 'Stockholm',
    country: 'Sweden',
  },
  {
    name: 'Vancouver',
    country: 'Canada',
  },
];


const batch = db.batch();
for (let city in newCities) {
  let newCityRef = db.collection('cities').doc();
  batch.set(
    newCityRef,
    {
      ...city,
      [LAST_UPDATED_FIELD]: firestore.FieldValue.serverTimestamp()
    }
  );
}

await batch.commit();

// Add a collection query listener.

const citiesObserver = new Observer(firestore, citiesRef, LAST_UPDATED_FIELD,  CITIES_LAST_SYNC_KEY);

await citiesObserver.connect(); // Start listening for changes.

citiesObserver.onCreated(doc => console.log(`city ${doc.data().name} created`));
citiesObserver.onUpdated(doc => console.log(`city ${doc.data().name} updated`));
citiesObserver.onRemoved(doc => console.log(`city ${doc.data().name} removed`));

const osloCityRef = citiesRef.doc();

// Create
await osloCityRef.set({
  name: 'Oslo',
  country: 'Norway',
  [LAST_UPDATED_FIELD]: firestore.FieldValue.serverTimestamp(),
}); // console output: city Oslo created

// Update
await osloCityRef.update({
  capital: true,
  [LAST_UPDATED_FIELD]: firestore.FieldValue.serverTimestamp(),
}); // console output: city Oslo updated

// Delete
await osloCityRef.update({
  isDeleted: true, // Required for the observer to detect deleted documents.
  [LAST_UPDATED_FIELD]: firestore.FieldValue.serverTimestamp(),
}); // console output: city Oslo removed

citiesObserver.disconnect(); // Stop listening for changes.

citiesObserver.clearLastSyncTimestamp() // Clear last sync timestamp from storage.
```

## API

### `new Observer(firestore, collectionRef, lastUpdatedField, storeKey, store)`

- `firestore` <span style="color:#43853d">\<Firestore\></span>
- `collectionRef` \<CollectionReference\>
- `lastUpdatedField` \<string\>
- `storeKey` \<string\>
- `store` \<TimestampStore\> Optional TimestampStore, defaults to localstorage.
- Returns: \<Observer\>

### `Observer.createFactory(store)`
Creates an Observer factory with a custom store for storing last sync timestamps.

- `store` \<TimestampStore\>
- Returns: \<object\>

Example Usage:
```js
const observerFactory = Observer.createFactory(store);

const observer = observerFactory.create(firestore, collectionRef, lastUpdatedField);
```

### `observer.connect()`
- Returns: \<Promise\>

### `observer.disconnect()`
Stop observing the collection query.

### `observer.clearLastSyncTimestamp()`
Clears the last sync timestamp.

### `observer.onCreate(callback)`
Called when a new document has been created.

- `callback` \<Function\>

### observer.onUpdate(callback)
Called when a document has been updated.

- `callback` \<Function\>

### observer.onRemove(callback)
Called when a document has been removed.

- `callback` \<Function\>

### TimestampStore
Extend the AbstractTimestampStore to create custom TimestampStore instances which can be used in the observer factory to provide custom storage for the last sync timestamp instead of the DefaultTimestampStore(localstorage).

#### Example Usage:
```js
const lastSyncTimestampStore = new TimestampStore(LAST_SYNC_TIMESTAMP_STORAGE_KEY, storage);
const observerFactory = Observer.createFactory(lastSyncTimestampStore);
const observer = observerFactory.create(
  firestore,
  collectionRef,
  LAST_MODIFIED_FIELD
);
```

## How it Works
Normally when you add a Firestore realtime collection query listener, or if a listener is disconnected for more than 30 minutes,you are charged for a read for each document in that query.

The Reason for this is because as the listener is added, it needs to read and fetch all the documents in the query so that it later can determine if a remote database update will trigger a local listener change event.

This library helps reduce this issue by creating a query that only listens for documents in a collection that has changed since the last time the local client synced with the cloud database. And since the steps involved in setting this up is a pattern, this library and its API was added to make it easier to implement and re-use.

![image](https://user-images.githubusercontent.com/13058304/123870532-4a44cd00-d8e7-11eb-99ea-22d9b9f13b95.png)


## Considerations
Currently if a document that is part of a listener query gets removed, it does not trigger a `DocumentChange` event in the local query listener. This requires us to update the `lastUpdated` field on the document and flag the document as deleted, e.g. `isDeleted`, to be able to trigger the change event.

Normally Firestore doesn't charge for removals in query listeners since it doesn't need to read and fetch any data. But because we need to update the document we are charged for an extra read. This is worth considering if your collection only holds a small amount of documents and you are creating and removing documents constantly.

## License
See the LICENSE file.
