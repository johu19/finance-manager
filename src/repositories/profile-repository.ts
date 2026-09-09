import { GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { createDynamoClient } from '../lib/dynamo.js';
import { getConfig } from '../lib/env.js';
import { PerformanceStroke } from '../validations/performance-fields.js';

export type ProfileRecord = {
  profileId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  gender?: 'male' | 'female';
  favStroke?: PerformanceStroke;
  teamName?: string;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
};

function getProfileKeys(cognitoId: string) {
  return {
    pk: `PROFILE#${cognitoId}`,
    sk: `PROFILE#${cognitoId}`,
  };
}

function mapItemToProfileRecord(
  item: Record<string, { S?: string }> | undefined,
): ProfileRecord | null {
  if (!item) {
    return null;
  }

  const profileId = item.profileId?.S;
  const email = item.email?.S;
  const firstName = item.firstName?.S;
  const lastName = item.lastName?.S;
  const birthDate = item.birthDate?.S;
  const gender = item.gender?.S;
  const favStroke = item.favStroke?.S;
  const teamName = item.teamName?.S;
  const photoUrl = item.photoUrl?.S;
  const createdAt = item.createdAt?.S;
  const updatedAt = item.updatedAt?.S;

  if (!profileId || !email || !createdAt || !updatedAt) {
    throw new Error('Profile item is missing one or more required attributes.');
  }

  if (gender && gender !== 'male' && gender !== 'female') {
    throw new Error(`Profile item has unsupported gender value "${gender}".`);
  }

  if (
    favStroke &&
    favStroke !== 'butterfly' &&
    favStroke !== 'backstroke' &&
    favStroke !== 'breaststroke' &&
    favStroke !== 'freestyle' &&
    favStroke !== 'medley'
  ) {
    throw new Error(
      `Profile item has unsupported favStroke value "${favStroke}".`,
    );
  }

  return {
    profileId,
    email,
    firstName,
    lastName,
    birthDate,
    gender: gender as ProfileRecord['gender'],
    favStroke: favStroke as ProfileRecord['favStroke'],
    teamName,
    photoUrl,
    createdAt,
    updatedAt,
  };
}

function mapProfileRecordToItem(profile: ProfileRecord) {
  return {
    pk: { S: getProfileKeys(profile.profileId).pk },
    sk: { S: getProfileKeys(profile.profileId).sk },
    profileId: { S: profile.profileId },
    email: { S: profile.email },
    ...(profile.firstName ? { firstName: { S: profile.firstName } } : {}),
    ...(profile.lastName ? { lastName: { S: profile.lastName } } : {}),
    ...(profile.birthDate ? { birthDate: { S: profile.birthDate } } : {}),
    ...(profile.gender ? { gender: { S: profile.gender } } : {}),
    ...(profile.favStroke ? { favStroke: { S: profile.favStroke } } : {}),
    ...(profile.teamName ? { teamName: { S: profile.teamName } } : {}),
    ...(profile.photoUrl ? { photoUrl: { S: profile.photoUrl } } : {}),
    createdAt: { S: profile.createdAt },
    updatedAt: { S: profile.updatedAt },
  };
}

export async function insertProfile(profile: ProfileRecord) {
  const client = createDynamoClient();
  const { swimCoreTableName } = getConfig();

  await client.send(
    new PutItemCommand({
      TableName: swimCoreTableName,
      Item: mapProfileRecordToItem(profile),
      ConditionExpression: 'attribute_not_exists(pk)',
    }),
  );

  return profile;
}

export async function saveProfile(profile: ProfileRecord) {
  const client = createDynamoClient();
  const { swimCoreTableName } = getConfig();

  await client.send(
    new PutItemCommand({
      TableName: swimCoreTableName,
      Item: mapProfileRecordToItem(profile),
    }),
  );

  return profile;
}

export async function getProfileById(profileId: string) {
  const client = createDynamoClient();
  const { swimCoreTableName } = getConfig();
  const keys = getProfileKeys(profileId);
  const response = await client.send(
    new GetItemCommand({
      TableName: swimCoreTableName,
      Key: {
        pk: { S: keys.pk },
        sk: { S: keys.sk },
      },
      ConsistentRead: true,
    }),
  );

  return mapItemToProfileRecord(response.Item as Record<string, { S?: string }> | undefined);
}
