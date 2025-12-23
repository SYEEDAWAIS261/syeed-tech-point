const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Subscriber = require('./models/Subscriber');
const crypto = require('crypto');

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const subs = await Subscriber.find({ unsubscribeToken: { $exists: false } });
    for (const s of subs) {
      s.unsubscribeToken = crypto.randomBytes(32).toString('hex');
      await s.save();
    }
    console.log(`✅ Added unsubscribe tokens for ${subs.length} old subscribers`);
    mongoose.disconnect();
  })
  .catch(console.error);
