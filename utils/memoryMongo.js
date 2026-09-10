import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer = null;

export const startMemoryMongo = async () => {
  if (mongoServer) return mongoServer.getUri();

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  console.log('⚡ Using in-memory MongoDB (install MongoDB for persistent data)');
  return uri;
};

export default startMemoryMongo;
