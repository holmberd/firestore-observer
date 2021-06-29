# firestore-observer

firestore-observer provides an API for adding a Firestore realtime collection query listeners in a cost effective way.

## How it works
Normally when you add a Firestore realtime collection query listener, or if a listener is disconnected for more than
30 minutes, you are charged for a read for each document in that query.

The Reason for this is because as the listener is added, it needs to read and fetch all the documents
in the query so that it later can determine if a remote database update will trigger a local listener change event.

This library helps reduce this issue by creating a query that only listens for documents in a collection that has changed
since the last time the local client synced with the cloud database. And since the steps involved in setting this up is
a pattern, this library and its API was added to make it easier to implement.

## Considerations
Currently if a document that is part of a listener query gets removed, it does not trigger a "document removed" change
event in the local query listener. This requires us to update the `lastUpdated` field on the document and flag the
document as deleted, e.g. `isDeleted`, to be able to trigger the change event.

Normally Firestore doesn't charge for removals in query listeners since it doesn't need to read and fetch any data.
But because we need to update the document we are charged for an extra read. This is worth considering if your collection
only holds a small amount of documents and you are creating and removing documents constantly.

## Usage Example

```js
import firebase from 'firebase/app';
import 'firebase/firestore';

import fObserver from 'firestore-observer';

firebase.initializeApp(firebaseConfig);

const db = firebase();

const CITIES_LAST_SYNC_KEY = 'citites-last-sync';
const LAST_UPDATED_FIELD = 'updatedAt';

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

await osloCityRef.set({ // console: city Oslo created
  name: 'Oslo',
  country: 'Norway',
  [LAST_UPDATED_FIELD]: firestore.FieldValue.serverTimestamp(),
});

await osloCityRef.update({ // console: city Oslo updated
  capital: true,
  [LAST_UPDATED_FIELD]: firestore.FieldValue.serverTimestamp(),
});

await osloCityRef.update({ // console: city Oslo removed
  isDeleted: true,
  [LAST_UPDATED_FIELD]: firestore.FieldValue.serverTimestamp(),
});

cititiesObserver.disconnect(); // Stop listening for changes.
```
