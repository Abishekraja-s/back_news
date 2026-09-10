import mongoose from 'mongoose';
import startMemoryMongo from '../utils/memoryMongo.js';

const isAtlasUri = () => process.env.MONGODB_URI?.startsWith('mongodb+srv://');

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    if (process.env.NODE_ENV === 'production' || isAtlasUri()) {
      console.error(`MongoDB connection failed: ${error.message}`);
      if (isAtlasUri()) {
        console.error('Check Atlas: IP whitelist (Network Access) and database user credentials.');
      }
      process.exit(1);
    }

    console.log('Local MongoDB unavailable — using in-memory database for development');
    await startMemoryMongo();
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log('In-memory MongoDB connected');
    return conn;
  }
};

export default connectDB;
