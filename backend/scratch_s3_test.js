require('dotenv').config();
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function listMyBuckets() {
  try {
    const res = await s3.send(new ListBucketsCommand({}));
    console.log('Buckets:', res.Buckets.map(b => b.Name));
  } catch (err) {
    console.error('List failed:', err);
  }
}

listMyBuckets();
