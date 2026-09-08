import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError, ErrorName } from '../src/lib/error-handler.js';
import * as s3 from '../src/lib/s3.js';
import { type ProfileRecord } from '../src/repositories/profile-repository.js';
import * as profileRepository from '../src/repositories/profile-repository.js';
import {
  deleteProfilePhoto,
  updateProfilePhoto,
} from '../src/services/photo-service.js';

const existingProfile: ProfileRecord = {
  profileId: 'cognito-123',
  email: 'jose@example.com',
  firstName: 'Jose',
  createdAt: '2026-05-27T00:00:00.000Z',
  updatedAt: '2026-05-27T00:00:00.000Z',
};

test.afterEach(() => {
  test.mock.restoreAll();
});

test('updateProfilePhoto uploads the image and stores the photo URL', async () => {
  let uploadedContentType: string | undefined;
  let savedProfile: unknown;

  test.mock.method(profileRepository, 'getProfileById', async () => ({
    ...existingProfile,
  }));
  test.mock.method(
    s3,
    'putPhotoObject',
    async (_cognitoId: string, _body: Buffer, contentType: string) => {
      uploadedContentType = contentType;
    },
  );
  test.mock.method(
    s3,
    'buildPhotoUrl',
    () => 'https://bucket.s3.us-east-1.amazonaws.com/photos/cognito-123?v=1',
  );
  test.mock.method(
    profileRepository,
    'saveProfile',
    async (profile: ProfileRecord) => {
      savedProfile = profile;
      return profile;
    },
  );

  const result = await updateProfilePhoto('cognito-123', 'aGVsbG8=', 'image/png');

  assert.equal(uploadedContentType, 'image/png');
  assert.ok(savedProfile);
  assert.deepEqual(result, savedProfile);
  assert.deepEqual(
    {
      ...(savedProfile as Record<string, unknown>),
      updatedAt: typeof (savedProfile as Record<string, unknown>).updatedAt,
    },
    {
      profileId: 'cognito-123',
      email: 'jose@example.com',
      firstName: 'Jose',
      photoUrl: 'https://bucket.s3.us-east-1.amazonaws.com/photos/cognito-123?v=1',
      createdAt: '2026-05-27T00:00:00.000Z',
      updatedAt: 'string',
    },
  );
});

test('updateProfilePhoto rejects an image larger than the size cap', async () => {
  const oversizedImage = 'A'.repeat(3 * 1024 * 1024);

  await assert.rejects(
    () => updateProfilePhoto('cognito-123', oversizedImage, 'image/png'),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.name, ErrorName.PayloadValidation);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test('updateProfilePhoto throws ProfileNotFound when profile does not exist', async () => {
  test.mock.method(profileRepository, 'getProfileById', async () => null);
  test.mock.method(s3, 'putPhotoObject', async () => undefined);

  await assert.rejects(
    () => updateProfilePhoto('cognito-123', 'aGVsbG8=', 'image/png'),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.name, ErrorName.ProfileNotFound);
      assert.equal(error.statusCode, 404);
      return true;
    },
  );
});

test('deleteProfilePhoto removes the object and clears the photo URL', async () => {
  let deletedCognitoId: string | undefined;
  let savedProfile: unknown;

  test.mock.method(profileRepository, 'getProfileById', async () => ({
    ...existingProfile,
    photoUrl: 'https://bucket.s3.us-east-1.amazonaws.com/photos/cognito-123?v=1',
  }));
  test.mock.method(s3, 'deletePhotoObject', async (cognitoId: string) => {
    deletedCognitoId = cognitoId;
  });
  test.mock.method(
    profileRepository,
    'saveProfile',
    async (profile: ProfileRecord) => {
      savedProfile = profile;
      return profile;
    },
  );

  const result = await deleteProfilePhoto('cognito-123');

  assert.equal(deletedCognitoId, 'cognito-123');
  assert.ok(savedProfile);
  assert.deepEqual(result, savedProfile);
  assert.equal(
    (savedProfile as Record<string, unknown>).photoUrl,
    undefined,
  );
});

test('deleteProfilePhoto throws ProfileNotFound when profile does not exist', async () => {
  test.mock.method(profileRepository, 'getProfileById', async () => null);

  await assert.rejects(
    () => deleteProfilePhoto('cognito-123'),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.name, ErrorName.ProfileNotFound);
      assert.equal(error.statusCode, 404);
      return true;
    },
  );
});
