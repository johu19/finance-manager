import { AppError, ErrorName } from '../lib/error-handler.js';
import {
  buildPhotoUrl,
  deletePhotoObject,
  putPhotoObject,
} from '../lib/s3.js';
import {
  getProfileById,
  ProfileRecord,
  saveProfile,
} from '../repositories/profile-repository.js';

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export async function updateProfilePhoto(
  cognitoId: string,
  image: string,
  contentType: string,
) {
  const buffer = Buffer.from(image, 'base64');

  if (buffer.byteLength === 0) {
    throw new AppError(
      ErrorName.PayloadValidation,
      'Image must be valid base64-encoded data.',
      400,
    );
  }

  if (buffer.byteLength > MAX_PHOTO_BYTES) {
    throw new AppError(
      ErrorName.PayloadValidation,
      `Image must be ${MAX_PHOTO_BYTES} bytes or smaller.`,
      400,
    );
  }

  const existingProfile = await getProfileById(cognitoId);

  if (!existingProfile) {
    throw new AppError(
      ErrorName.ProfileNotFound,
      `Profile "${cognitoId}" was not found.`,
      404,
    );
  }

  await putPhotoObject(cognitoId, buffer, contentType);

  const now = new Date();
  const updatedProfile: ProfileRecord = {
    ...existingProfile,
    photoUrl: buildPhotoUrl(cognitoId, now.getTime()),
    updatedAt: now.toISOString(),
  };

  return await saveProfile(updatedProfile);
}

export async function deleteProfilePhoto(cognitoId: string) {
  const existingProfile = await getProfileById(cognitoId);

  if (!existingProfile) {
    throw new AppError(
      ErrorName.ProfileNotFound,
      `Profile "${cognitoId}" was not found.`,
      404,
    );
  }

  await deletePhotoObject(cognitoId);

  const { photoUrl: _photoUrl, ...profileWithoutPhoto } = existingProfile;
  const updatedProfile: ProfileRecord = {
    ...profileWithoutPhoto,
    updatedAt: new Date().toISOString(),
  };

  return await saveProfile(updatedProfile);
}
