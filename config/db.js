const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async (onConnectedCallback) => {
  const connStr = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!connStr) {
    console.log('⚡ No MONGODB_URI provided. Using Disk Store Mode (data/db.json).');
    return;
  }

  console.log('Connecting to MongoDB Atlas Cluster...');
  try {
    await mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    isConnected = true;
    console.log('⚡ MongoDB Atlas Connected Successfully to Cluster!');
    if (typeof onConnectedCallback === 'function') {
      await onConnectedCallback();
    }
  } catch (error) {
    isConnected = false;
    console.log('⚡ MongoDB Atlas connection fallback: Using Disk Store Mode (data/db.json). Error:', error.message);
  }
};

const getDBStatus = () => isConnected;

module.exports = { connectDB, getDBStatus };
