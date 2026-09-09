type EnvKey =
  | 'AWS_REGION'
  | 'DYNAMODB_ENDPOINT'
  | 'SWIM_CORE_TABLE_NAME'
  | 'PHOTOS_BUCKET_NAME'
  | 'S3_ENDPOINT';

type AppConfig = {
  awsRegion: string;
  dynamoDbEndpoint?: string;
  swimCoreTableName: string;
  photosBucketName?: string;
  s3Endpoint?: string;
};

function getEnv(name: EnvKey) {
  return process.env[name];
}

function requireEnv(name: EnvKey) {
  const value = getEnv(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getConfig(): AppConfig {
  return {
    awsRegion: requireEnv('AWS_REGION'),
    dynamoDbEndpoint: getEnv('DYNAMODB_ENDPOINT'),
    swimCoreTableName: requireEnv('SWIM_CORE_TABLE_NAME'),
    photosBucketName: getEnv('PHOTOS_BUCKET_NAME'),
    s3Endpoint: getEnv('S3_ENDPOINT'),
  };
}
