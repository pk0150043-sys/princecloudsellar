const mongoose = require('mongoose');

let isConnected = false;

const DIRECT_FALLBACK_URI = 'mongodb://princecloudsellar_db_user:PRINCE%409507325@cluster0-shard-00-00.so9svu.mongodb.net:27017,cluster0-shard-00-01.so9svu.mongodb.net:27017,cluster0-shard-00-02.so9svu.mongodb.net:27017/princecloudsellar?ssl=true&replicaSet=atlas-8ennvl-shard-0&authSource=admin&retryWrites=true&w=majority';

mongoose.connection.on('connected', () => {
  isConnected = true;
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log('⚠️ MongoDB disconnected.');
});

mongoose.connection.on('error', (err) => {
  console.error('⚠️ MongoDB Connection Error:', err.message);
});

const connectDB = async (onConnectedCallback) => {
  const primaryConnStr = process.env.MONGODB_URI || process.env.MONGO_URI || DIRECT_FALLBACK_URI;

  console.log('Connecting to MongoDB Atlas Cluster...');

  // Try 1: Primary Connection String
  try {
    await mongoose.connect(primaryConnStr, {
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 6000
    });
    isConnected = true;
    console.log('⚡ MongoDB Atlas Connected Successfully to Cluster!');
    if (typeof onConnectedCallback === 'function') {
      await onConnectedCallback();
    }
    return;
  } catch (primaryErr) {
    console.log('⚠️ Primary MongoDB connection attempt failed:', primaryErr.message);
  }

  // Try 2: Direct Shard ReplicaSet Connection Fallback (bypasses SRV DNS issues)
  try {
    console.log('🔄 Attempting Direct Shard ReplicaSet Connection to Atlas...');
    await mongoose.connect(DIRECT_FALLBACK_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000
    });
    isConnected = true;
    console.log('⚡ MongoDB Atlas Connected Successfully via Direct Shards!');
    if (typeof onConnectedCallback === 'function') {
      await onConnectedCallback();
    }
  } catch (fallbackErr) {
    isConnected = false;
    console.log('⚡ MongoDB Atlas connection fallback: Using Disk Store Mode (data/db.json). Error:', fallbackErr.message);
  }
};

const getDBStatus = () => isConnected;

module.exports = { connectDB, getDBStatus };

