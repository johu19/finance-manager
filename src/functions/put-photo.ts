import { json } from '../lib/http.js';
import { runner } from '../lib/lambda-runner.js';
import { updateProfilePhoto } from '../services/photo-service.js';
import { PutPhotoBody, putPhotoBodySchema } from '../validations/put-photo.js';

export const handler = runner(
  async ({ auth, body }) => {
    const { image, contentType } = body as PutPhotoBody;
    const profile = await updateProfilePhoto(auth.cognitoId, image, contentType);

    return json(200, { profile });
  },
  {
    bodySchema: putPhotoBodySchema,
  },
);
