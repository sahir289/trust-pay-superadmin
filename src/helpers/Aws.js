import { S3Client } from '@aws-sdk/client-s3';
import config from '../config/config.js';
export const s3 = new S3Client({
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.secretKeyS3,
  },
  region: config.bucketRegion,
});
