# Firestore Query Observer
Firestore Query Observer is a wrapper library for Firestore realtime collection query listeners. It provides an API for creating realtime collection query listeners optimized for reducing document reads.

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

import fObserver from 'firestore-observer';

firebase.initializeApp(firebaseConfig);

const db = firebase();

const CITIES_LAST_SYNC_KEY = 'citites-last-sync'; // Last sync timestamp storage key.
const LAST_UPDATED_FIELD = 'updatedAt'; // Our collection documents last updated field key.

const citiesRef = db.collection('cities');

// Add some citites to the collection.

const newCities = [
  {
    name: 'Tokyo',
    country: 'Japan',
    [LAST_UPDATED_FIELD]: firestore.FieldValue.serverTimestamp(),
  },
  {
    name: 'Stockholm',
    country: 'Sweden',
    [LAST_UPDATED_FIELD]: firestore.FieldValue.serverTimestamp(),
  },
  {
    name: 'San Francisco',
    country: 'USA',
    [LAST_UPDATED_FIELD]: firestore.FieldValue.serverTimestamp(),
  },
];

const batch = db.batch();

for (let city in newCities) {
  let newCityRef = db.collection('cities').doc();
  batch.set(newCityRef, city);
}

await batch.commit();

// Add a collection query listener.

const cititesObserver = new Observer(firestore, citiesRef, LAST_UPDATED_FIELD,  CITIES_LAST_SYNC_KEY);

await cititiesObserver.connect(); // Start listening for changes.

citiesObserver.onCreated(city => console.log(`city ${city.name} created`));
citiesObserver.onUpdated(city => console.log(`city ${city.name} updated`));
citiesObserver.onRemoved(city => console.log(`city ${city.name} removed`));

const osloCityRef = citiesRef.doc();

await osloCityRef.set({
  name: 'Oslo',
  country: 'Norway',
  [LAST_UPDATED_FIELD]: firestore.FieldValue.serverTimestamp(),
}); // console output: city Oslo created

await osloCityRef.update({
  capital: true,
  [LAST_UPDATED_FIELD]: firestore.FieldValue.serverTimestamp(),
}); // console output: city Oslo updated

await osloCityRef.update({
  isDeleted: true,
  [LAST_UPDATED_FIELD]: firestore.FieldValue.serverTimestamp(),
}); // console output: city Oslo removed

cititiesObserver.disconnect(); // Stop listening for changes.

cititiesObserver.clearLastSyncTimestamp() // Clear last sync timestamp from storage.
```

## API

### Observer
The Observer class is used to construct new listener query instances.

```js
/**
 * @constructor
 * @param {Firestore} firestore
 * @param {CollectionReference} collectionRef
 * @param {string} lastUpdatedField - Document last updated field key.
 * @param {string} storeKey - Store key for last sync timestamp.
 * @param {Store} [store] - Last sync timestamp store instance, defaults to localstorage.
 * @returns {Observer}
 */
const observer = new Observer(firestore, collectionRef, lastUpdatedField, storeKey);

/**
 * Creates an Observer factory that uses the custom store for storing last sync timestamps.
 * @static
 * @param {Store} store
 */
const observerFactory = Observer.createFactory(store);

const observer = observerFactory(firestore, collectionRef, lastUpdatedField, storeKey);

/* Observer Instance Methods */

/**
 * Start observing the collection query.
 * @async
 */
await observer.connect();

/**
 * Stop observing the collection query.
 */
observer.disconnect();

/**
 * Clears the last sync timestamp.
 */
observer.clearLastSyncTimestamp();

/* DocumentChange event callbacks */
observer.onCreate(callback);
observer.onUpdate(callback);
observer.onRemove(callback);
observer.onCreate(callback);
```

### Store
Extend the AbstractStore to create custom Store instances which can be used in the observer factory to provide custom storage for the last sync timestamp instead of the DefaultStore(localstorage).

## How it Works
Normally when you add a Firestore realtime collection query listener, or if a listener is disconnected for more than 30 minutes,you are charged for a read for each document in that query.

The Reason for this is because as the listener is added, it needs to read and fetch all the documents in the query so that it later can determine if a remote database update will trigger a local listener change event.

This library helps reduce this issue by creating a query that only listens for documents in a collection that has changed since the last time the local client synced with the cloud database. And since the steps involved in setting this up is a pattern, this library and its API was added to make it easier to implement and re-use.

## Considerations
Currently if a document that is part of a listener query gets removed, it does not trigger a `DocumentChange` event in the local query listener. This requires us to update the `lastUpdated` field on the document and flag the document as deleted, e.g. `isDeleted`, to be able to trigger the change event.

Normally Firestore doesn't charge for removals in query listeners since it doesn't need to read and fetch any data. But because we need to update the document we are charged for an extra read. This is worth considering if your collection only holds a small amount of documents and you are creating and removing documents constantly.

## License
See the LICENSE file.
