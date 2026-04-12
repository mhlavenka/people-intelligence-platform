import mongoose from 'mongoose';
import { config } from '../config/env';

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB');

  const collection = mongoose.connection.collection('availabilityconfigs');

  const indexes = await collection.indexes();
  console.log('Current indexes:', indexes.map((i) => `${i.name} (unique: ${!!i.unique})`));

  const target = indexes.find((i) => i.key && (i.key as Record<string, unknown>)['coachId'] && i.unique);
  if (target) {
    console.log(`Dropping unique index: ${target.name}`);
    await collection.dropIndex(target.name!);
    console.log('Done — unique index on coachId dropped.');
  } else {
    console.log('No unique index on coachId found — nothing to drop.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
