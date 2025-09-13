import AWS from 'aws-sdk';

export function getS3() {
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET } = process.env;
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !AWS_S3_BUCKET) {
    throw new Error('AWS credentials/region/bucket not set in env');
  }
  AWS.config.update({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    region: AWS_REGION,
    signatureVersion: 'v4'
  });
  return new AWS.S3();
}

export const S3_BUCKET = process.env.AWS_S3_BUCKET;
