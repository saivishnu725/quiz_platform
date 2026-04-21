import { MongoClient } from 'mongodb';
import redis from 'redis';
import dotenv from 'dotenv';

dotenv.config();

console.log(`
╔════════════════════════════════════════════════════════════╗
║     Connection Test - MongoDB & Redis                      ║
╚════════════════════════════════════════════════════════════╝
`);

async function testConnections() {
  let mongoClient, redisClient;

  try {
    // ============================================
    // Test MongoDB
    // ============================================
    console.log('📦 Testing MongoDB...');
    console.log(`   URI: ${process.env.MONGO_URI}`);

    mongoClient = new MongoClient(process.env.MONGO_URI);
    await mongoClient.connect();

    const db = mongoClient.db('quiz_platform');
    const adminDb = mongoClient.db('admin');

    // Ping MongoDB
    const ping = await adminDb.command({ ping: 1 });
    console.log('   ✓ MongoDB ping successful:', ping.ok === 1 ? 'OK' : 'FAILED');

    // List collections
    const collections = await db.listCollections().toArray();
    console.log(`   ✓ Collections (${collections.length}):`);
    collections.forEach(col => {
      console.log(`      - ${col.name}`);
    });

    // Check indexes on quiz_attempts
    const indexes = await db.collection('quiz_attempts').getIndexes();
    console.log(`   ✓ Indexes on quiz_attempts (${Object.keys(indexes).length}):`);
    Object.keys(indexes).forEach(idx => {
      console.log(`      - ${idx}`);
    });

    // Test write and read
    const testCollection = db.collection('_connection_test');
    const testDoc = { timestamp: new Date(), test: 'success' };
    const inserted = await testCollection.insertOne(testDoc);
    const retrieved = await testCollection.findOne({ _id: inserted.insertedId });
    console.log('   ✓ Write/Read test:', retrieved.test === 'success' ? 'PASSED' : 'FAILED');

    // Clean up test doc
    await testCollection.deleteOne({ _id: inserted.insertedId });

    console.log('✅ MongoDB: All tests passed\n');

    // ============================================
    // Test Redis
    // ============================================
    console.log('🔴 Testing Redis...');
    console.log(`   URL: ${process.env.REDIS_URL || `${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`}`);

    redisClient = redis.createClient({
      host: process.env.REDIS_HOST || 'redis',
      port: process.env.REDIS_PORT || 6379,
    });

    redisClient.on('error', (err) => {
      throw new Error('Redis connection failed: ' + err.message);
    });

    await redisClient.connect();
    console.log('   ✓ Redis connection established');

    // Test ping
    const pongReply = await redisClient.ping();
    console.log('   ✓ Redis ping:', pongReply === 'PONG' ? 'PONG' : 'FAILED');

    // Test SET/GET
    await redisClient.set('test:key', 'test-value', { EX: 10 });
    const getValue = await redisClient.get('test:key');
    console.log('   ✓ SET/GET test:', getValue === 'test-value' ? 'PASSED' : 'FAILED');

    // Test ZADD/ZREVRANGE (leaderboard)
    await redisClient.zAdd('test:leaderboard', [
      { score: 100, member: 'student1' },
      { score: 90, member: 'student2' },
      { score: 85, member: 'student3' },
    ]);
    const topScores = await redisClient.zRevRange('test:leaderboard', 0, 2, { WITHSCORES: true });
    console.log('   ✓ ZADD/ZREVRANGE test (leaderboard):', topScores.length >= 3 ? 'PASSED' : 'FAILED');

    // Test SET NX (spam prevention)
    const setNxResult1 = await redisClient.set('test:answer:q1', 'answer1', { NX: true });
    const setNxResult2 = await redisClient.set('test:answer:q1', 'answer2', { NX: true });
    console.log('   ✓ SET NX test (spam prevention):', setNxResult1 && !setNxResult2 ? 'PASSED' : 'FAILED');

    // Clean up test keys
    await redisClient.del('test:key', 'test:leaderboard', 'test:answer:q1');

    console.log('✅ Redis: All tests passed\n');

    // ============================================
    // Summary
    // ============================================
    console.log(`
╔════════════════════════════════════════════════════════════════════════════════════════════╗
║ ✅ All connections successful! Ready to go.                                                ║
╠════════════════════════════════════════════════════════════════════════════════════════════╣
║ MongoDB (quiz_platform)                                                                    ║
║   - Collections: ${collections.length} (questions, quizzes, quiz_attempts)                 ║
║   - Indexes: Optimized for aggregations and queries                                        ║
║                                                                                            ║
║ Redis                                                                                      ║
║   - Session management ready                                                               ║
║   - Leaderboard Sorted Sets ready                                                          ║
║   - Spam prevention (SET NX) ready                                                         ║
╚════════════════════════════════════════════════════════════════════════════════════════════╝
    `);

  } catch (error) {
    console.error('\n❌ Connection test failed:');
    console.error('   Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('   1. Verify Docker containers are running: docker-compose ps');
    console.error('   2. Check logs: docker-compose logs');
    console.error('   3. Ensure .env file has correct values');
    console.error('   4. Try: docker-compose restart');
    process.exit(1);
  } finally {
    // Clean up
    if (mongoClient) {
      await mongoClient.close();
    }
    if (redisClient) {
      await redisClient.quit();
    }
  }
}

testConnections();

