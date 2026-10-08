import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod;
let currentDbName = '';

export async function setupTestDB() {
  const dbSuffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  currentDbName = `revise_live_test_${dbSuffix}`;
  const localUri = process.env.TEST_MONGODB_URI || `mongodb://127.0.0.1:27017/${currentDbName}`;

  try {
    // Attempt connecting to local MongoDB first with an isolated DB per test suite
    await mongoose.connect(localUri, { serverSelectionTimeoutMS: 1500 });
    return localUri;
  } catch {
    // Fall back to MongoMemoryServer if no local mongo is running
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    return uri;
  }
}

export async function teardownTestDB() {
  if (mongoose.connection.readyState !== 0) {
    try {
      if (mongoose.connection.db) {
        await mongoose.connection.db.dropDatabase();
      }
    } catch {
      // ignore drop errors on cleanup
    }
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
  }
}

export async function clearTestDB() {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
}
