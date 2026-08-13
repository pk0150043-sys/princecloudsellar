const mongoose = require('mongoose');

let isConnected = false;

const connectDB = () => {
  const connStr = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!connStr) {
    console.log('⚡ No MONGODB_URI provided. Using Disk Store Mode (data/db.json).');
    return;
  }

  console.log('Connecting to MongoDB Atlas Cluster...');
  mongoose.connect(connStr, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  }).then(() => {
    isConnected = true;
    console.log('⚡ MongoDB Atlas Connected Successfully to Cluster!');
  }).catch((error) => {
    isConnected = false;
    console.log('⚡ MongoDB Atlas connection fallback: Using Disk Store Mode (data/db.json). Error:', error.message);
  });
};

const getDBStatus = () => isConnected;

module.exports = { connectDB, getDBStatus };
