import { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { runner } from '../lib/lambda-runner.js';
import { deleteProfilePhoto } from '../services/photo-service.js';

export const handler = runner(async ({ auth }) => {
  await deleteProfilePhoto(auth.cognitoId);

  return {
    statusCode: 204,
  } satisfies APIGatewayProxyStructuredResultV2;
});
