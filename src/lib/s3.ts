import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getConfig } from './env.js';

export function createS3Client() {
  const { awsRegion, s3Endpoint } = getConfig();

  if (s3Endpoint) {
    return new S3Client({
      region: awsRegion,
      endpoint: s3Endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: 'local',
        secretAccessKey: 'local',
      },
      maxAttempts: 1,
    });
  }

  return new S3Client({
    region: awsRegion,
    maxAttempts: 1,
  });
}

function requirePhotosBucketName() {
  const { photosBucketName } = getConfig();

  if (!photosBucketName) {
    throw new Error('Missing required environment variable: PHOTOS_BUCKET_NAME');
  }

  return photosBucketName;
}

export function buildPhotoKey(cognitoId: string) {
  return `photos/${cognitoId}`;
}

export function buildPhotoUrl(cognitoId: string, version: number) {
  const { awsRegion } = getConfig();
  const bucketName = requirePhotosBucketName();

  return `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${buildPhotoKey(
    cognitoId,
  )}?v=${version}`;
}

export async function putPhotoObject(
  cognitoId: string,
  body: Buffer,
  contentType: string,
) {
  const client = createS3Client();
  const bucketName = requirePhotosBucketName();

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: buildPhotoKey(cognitoId),
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deletePhotoObject(cognitoId: string) {
  const client = createS3Client();
  const bucketName = requirePhotosBucketName();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: buildPhotoKey(cognitoId),
    }),
  );
}
