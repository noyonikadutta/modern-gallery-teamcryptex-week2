require('dotenv').config();
const AWS = require('aws-sdk');

AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const s3 = new AWS.S3();

async function test() {
  try {
    const result = await s3.listBuckets().promise();
    console.log("✅ Connected to S3! Buckets:", result.Buckets.map(b => b.Name));
  } catch (err) {
    console.error("❌ S3 connection failed:", err.message);
  }
}

test();
