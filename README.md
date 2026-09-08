# swim-core

`swim-core` is a TypeScript serverless backend for a swim application. The repository is organized around Lambda handlers, shared request-processing utilities, domain services, DynamoDB repositories, and a small AWS CDK app for the development stack.

The current API supports:

- `GET /health`
- `GET /me/profile`
- `PATCH /me/profile`
- `PUT /me/profile/photo`
- `DELETE /me/profile/photo`
- `POST /performances`
- `GET /performances`
- `PATCH /performances/:performanceId`
- `DELETE /performances/:performanceId`

## Architecture

### High-level shape

The project is split into two main areas:

- `src/`: application code for Lambda handlers and backend logic
- `infra/`: AWS CDK code that provisions the development stack

At runtime, the request flow looks like this:

1. API Gateway receives an HTTP request.
2. For protected routes, API Gateway validates a Cognito JWT.
3. A Lambda handler in `src/functions/` receives the API Gateway v2 event.
4. The shared runner in `src/lib/lambda-runner.ts` extracts auth, parses JSON, validates inputs, logs the request, and normalizes error handling.
5. A service in `src/services/` applies business rules.
6. A repository in `src/repositories/` reads from or writes to DynamoDB.

### Application layers

#### `src/functions/`

Lambda entrypoints. These files stay intentionally thin and delegate almost everything to shared helpers and services.

- `health.ts`: checks DynamoDB connectivity
- `get-profile.ts`: fetches the authenticated swimmer profile or creates a minimal one
- `patch-profile.ts`: updates profile fields for the authenticated swimmer
- `put-photo.ts`: uploads/replaces the authenticated swimmer's profile photo
- `delete-photo.ts`: removes the authenticated swimmer's profile photo
- `create-performance.ts`: stores a performance for the authenticated swimmer
- `get-performances.ts`: lists performances for the authenticated swimmer
- `patch-performance.ts`: updates a performance for the authenticated swimmer
- `delete-performance.ts`: deletes a performance for the authenticated swimmer

#### `src/lib/`

Shared infrastructure code used by multiple handlers.

- `auth.ts`: extracts Cognito-style JWT claims from the API Gateway event
- `lambda-runner.ts`: shared request wrapper for auth, parsing, validation, logging, and error mapping
- `dynamo.ts`: creates the DynamoDB client and exposes a health check helper
- `s3.ts`: creates the S3 client and exposes profile-photo object + URL helpers
- `env.ts`: reads required environment variables
- `http.ts`: small JSON response helper
- `error-handler.ts`: central app error type and HTTP error serialization

#### `src/services/`

Business logic and orchestration.

- `profile-service.ts`: gets, creates, and updates swimmer profiles
- `photo-service.ts`: validates, uploads to S3, and deletes swimmer profile photos
- `performance-service.ts`: creates, fetches, updates, and deletes swimmer performance records

#### `src/repositories/`

Low-level DynamoDB access using the AWS SDK v3.

- `profile-repository.ts`: reads and writes profile items
- `performance-repository.ts`: reads, writes, and deletes performance items

#### `src/validations/`

Zod schemas for request payload validation.

- `patch-profile.ts`
- `put-photo.ts`
- `create-performance.ts`
- `patch-performance.ts`
- `performance-path.ts`

#### `scripts/`

Local developer utilities.

- `scripts/db/create-swim-core-table.ts`: creates the local DynamoDB table if it does not exist
- `scripts/lambda/invoke.ts`: builds mock API Gateway events and invokes handlers locally using fixtures

#### `test/`

Unit tests for the service layer. These tests mock repository calls and do not require a running DynamoDB instance.

### Data model

The backend currently uses a single DynamoDB table with:

- partition key: `pk`
- sort key: `sk`

The table stores multiple item types in the same partition space.

Profile item shape:

- `pk = PROFILE#<cognitoId>`
- `sk = PROFILE#<cognitoId>`

Profile records always store:

- `profileId`
- `email`
- `createdAt`
- `updatedAt`

Profile records may also store these optional fields after the user updates them:

- `firstName`
- `lastName`
- `birthDate`
- `gender`
- `favStroke`
- `teamName`
- `photoUrl` (set by `PUT /me/profile/photo`, cleared by `DELETE /me/profile/photo`)

Performance item shape:

- `pk = PROFILE#<cognitoId>`
- `sk = PERFORMANCE#<performanceId>`

Performance records always store:

- `performanceId`
- `profileId`
- `stroke`
- `distance`
- `poolLength`
- `poolLengthUnit`
- `timeMs`
- `place` (optional, competition only)
- `splits` (optional)
- `performedAt`
- `sourceType`
- `createdAt`
- `updatedAt`

This means all performance records for a swimmer live under the same partition as that swimmer's profile, and performance listing is done with a `begins_with(sk, 'PERFORMANCE#')` query. Results are then sorted in application code by `performedAt`.

### Authentication model

Protected handlers expect Cognito JWT claims on the API Gateway request context.

Required claims:

- `sub`: treated as the authenticated swimmer identity
- `email`: used when creating a minimal profile for a new authenticated swimmer

Locally, these claims are provided by JSON fixtures in `scripts/lambda/fixtures/requests/`.

### Infrastructure

The CDK app in `infra/` defines a development stack that provisions:

- one DynamoDB table
- one S3 bucket for profile photos (objects under `photos/` are public-read)
- one Cognito User Pool
- one Cognito User Pool Client
- one API Gateway HTTP API
- nine Lambda functions

The protected routes are wired to a JWT authorizer backed by Cognito. The stack also outputs the API endpoint and Cognito identifiers needed by a client application.

## Repository layout

```text
.
|-- src/
|   |-- functions/
|   |-- lib/
|   |-- repositories/
|   |-- services/
|   `-- validations/
|-- scripts/
|   |-- db/
|   `-- lambda/
|-- test/
`-- infra/
```

## Development

### Prerequisites

- Node.js `24.x`
- npm
- Docker Desktop or another Docker runtime

### Install dependencies

Install root dependencies:

```bash
npm install
```

Install CDK dependencies:

```bash
cd infra
npm install
```

### Environment variables

The application expects these environment variables:

```bash
AWS_REGION=us-east-1
DYNAMODB_ENDPOINT=http://localhost:8000
SWIM_CORE_TABLE_NAME=swim-core
```

The profile-photo handlers additionally use:

```bash
PHOTOS_BUCKET_NAME=swim-core-dev-photos
# Optional: point the S3 client at a local emulator (e.g. LocalStack/MinIO)
S3_ENDPOINT=http://localhost:4566
```

`PHOTOS_BUCKET_NAME` is only required by `put-photo` and `delete-photo`. The CDK
stack wires it automatically for those functions. There is no local S3 in the
Docker setup, so invoking the photo handlers locally requires either real AWS
credentials or a local S3 emulator via `S3_ENDPOINT`.

For local DynamoDB usage, the AWS SDK client also assumes local credentials internally when `DYNAMODB_ENDPOINT` is set, so no real AWS credentials are required for the app to talk to DynamoDB Local.

Local helper scripts such as `npm run create:table:swim-core` and `npm run dev:invoke -- <lambda-name>` automatically load variables from the root `.env` file.

### Run local DynamoDB

Start DynamoDB Local and the table initialization helper:

```bash
docker compose up -d
```

This starts:

- `dynamodb-local` on `http://localhost:8000`
- `dynamodb-init`, which waits for DynamoDB to be ready and then creates the table

If you want to create the table manually instead, run:

```bash
npm run create:table:swim-core
```

### Build the project

```bash
npm run build
```

Compiled output is written to `dist/`.

### Invoke Lambdas locally

The local invoker compiles the project, loads fixture data, constructs a mock API Gateway v2 event, and runs a handler directly.

Supported commands:

```bash
npm run dev:invoke -- health
npm run dev:invoke -- get-profile
npm run dev:invoke -- patch-profile
npm run dev:invoke -- put-photo
npm run dev:invoke -- delete-photo
npm run dev:invoke -- create-performance
npm run dev:invoke -- get-performances
npm run dev:invoke -- patch-performance
npm run dev:invoke -- delete-performance
```

Useful fixtures live in:

- `scripts/lambda/fixtures/requests/`
- `scripts/lambda/fixtures/bodies/`

If you need to test different auth claims or request bodies, update those JSON files and invoke the handler again.

### Run tests

```bash
npm test
```

The current test suite covers the service layer for:

- profile get-or-create, retrieval, and updates
- performance creation, listing, updates, and deletion

### Deploy or inspect the AWS dev stack

From the `infra/` directory:

Build the CDK app:

```bash
npm run build
```

Synthesize the CloudFormation template:

```bash
npx cdk synth
```

Deploy the development stack:

```bash
npx cdk deploy
```

The stack creates the API, Cognito resources, Lambda functions, and DynamoDB table described above.

## Current development workflow

For day-to-day backend work, the simplest loop is:

1. Start DynamoDB Local with `docker compose up -d`.
2. Set the required environment variables.
3. Run `npm run dev:invoke -- <lambda-name>` to exercise handlers locally.
4. Run `npm test` to verify the service layer.
5. Use the CDK app in `infra/` when you want to validate the AWS deployment shape.

## Notes

- The application code and the CDK app are intentionally separate npm projects.
- The local table name defaults to `swim-core`, while the CDK development stack currently provisions a table named `swim-core-dev`.
- Protected routes rely on Cognito-style JWT claims even during local invocation, but those claims are mocked from fixtures rather than obtained from a real sign-in flow.
- `GET /me/profile` creates a minimal profile automatically when one does not yet exist.
- `PATCH /me/profile` updates an existing profile and returns `404` if the profile has not been created yet.
- `PATCH /performances/:performanceId` and `DELETE /performances/:performanceId` both return `404` when the performance does not exist for the authenticated user.
- `PUT /me/profile/photo` accepts a JSON body `{ "image": "<base64>", "contentType": "image/jpeg | image/png | image/webp" }`. The client is expected to compress the image before sending; the handler rejects payloads larger than 2 MB after decoding. It stores the object at `photos/<cognitoId>` and returns the profile with a `photoUrl` that carries a `?v=<timestamp>` cache-buster.
- `PUT /me/profile/photo` and `DELETE /me/profile/photo` return `404` when the profile has not been created yet (create it first via `GET /me/profile`). `DELETE` returns `204`.
