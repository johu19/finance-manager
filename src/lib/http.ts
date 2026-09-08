import { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

export function json(
  statusCode: number,
  payload: unknown,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}
