import mongoose from 'mongoose';

interface CachedConnection {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: CachedConnection | undefined;
}

const cached: CachedConnection = global.mongooseCache || { conn: null, promise: null };
global.mongooseCache = cached;

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI || '';
  if (!uri && process.env.NODE_ENV !== 'test') {
    throw new Error(
      'MONGODB_URI environment variable is not defined. ' +
      'Set it in your .env.local or environment configuration.'
    );
  }
  return uri;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(getMongoUri(), {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

export default connectDB;
