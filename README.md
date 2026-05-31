# rest-vir

`rest-vir` is a TypeScript-first toolkit for defining, hosting, calling, and testing REST endpoints and WebSockets from one shared API definition.

-   `@rest-vir/api`: define your API contract, create typed clients, and mock hosts in tests.
-   `@rest-vir/host`: implement and run that API on Fastify.
-   `@rest-vir/large-api-mock`: private stress-test package for TypeScript performance.

See the full reference docs at https://electrovir.github.io/rest-vir.

For a working package example, see
[`packages/demo`](https://github.com/electrovir/rest-vir/tree/dev/packages/demo) on GitHub.

> Migrating from the previously published `@rest-vir/define-service`, `@rest-vir/implement-service`, or `@rest-vir/run-service` packages? See [`MIGRATION.md`](./MIGRATION.md).

## Install

Install the definition and client package wherever the API contract or client is used:

```sh
npm i @rest-vir/api object-shape-tester
```

Install the host package in the server project that implements and runs the API:

```sh
npm i @rest-vir/host
```

`object-shape-tester` is a peer dependency because endpoint request and response data is validated from runtime shapes.

## Quick Start

The normal setup is:

1. Put the shared API definition in code that both the frontend and backend can import.
2. Implement that definition with `@rest-vir/host`.
3. Run or attach the Fastify host.
4. Call the same definition with `RestVirClient` from `@rest-vir/api`.

### Shared API Definition

<!-- example-link: packages/host/src/examples/root-api-definition.example.ts -->

```TypeScript
import {defineApi, defineEndpoint, defineWebSocket, HttpMethod, HttpStatus} from '@rest-vir/api';
import {defineShape} from 'object-shape-tester';

export const healthEndpoint = defineEndpoint({
    path: '/health',
    requests: {
        [HttpMethod.Get]: {
            responses: {
                [HttpStatus.Ok]: {
                    responseData: defineShape({
                        status: '',
                    }),
                },
            },
        },
    },
});

export const createUserEndpoint = defineEndpoint({
    path: '/users',
    requests: {
        [HttpMethod.Post]: {
            requestData: defineShape({
                name: '',
            }),
            responses: {
                [HttpStatus.Created]: {
                    responseData: defineShape({
                        id: '',
                        name: '',
                    }),
                },
                [HttpStatus.BadRequest]: {
                    responseData: defineShape({
                        message: '',
                    }),
                },
            },
        },
    },
});

export const notificationsWebSocket = defineWebSocket({
    path: '/ws/notifications',
    clientMessage: defineShape({
        subscribeTo: '',
    }),
    hostMessage: defineShape({
        event: '',
        message: '',
    }),
});

export const myApi = defineApi({
    apiName: 'my-api',
    endpoints: [
        healthEndpoint,
        createUserEndpoint,
    ],
    webSockets: [
        notificationsWebSocket,
    ],
});
```

### Server Implementation

<!-- example-link: packages/host/src/examples/root-server-implementation.example.ts -->

```TypeScript
import {AnyOrigin, HttpMethod, HttpStatus} from '@rest-vir/api';
import {createApiImplementor, implementApi, startApiServer} from '@rest-vir/host';
import {
    createUserEndpoint,
    healthEndpoint,
    myApi,
    notificationsWebSocket,
} from './root-api-definition.example.js';

type HostContext = {
    requestId: string;
};

const implementor = createApiImplementor<HostContext>()(myApi);

const healthImplementation = implementor.implementEndpoint(healthEndpoint, {
    [HttpMethod.Get]() {
        return {
            [HttpStatus.Ok]: {
                responseData: {
                    status: 'ok',
                },
            },
        };
    },
});

const createUserImplementation = implementor.implementEndpoint(createUserEndpoint, {
    [HttpMethod.Post]({requestData}) {
        const user = {
            id: crypto.randomUUID(),
            name: requestData.name,
        };

        return {
            [HttpStatus.Created]: {
                responseData: user,
            },
        };
    },
});

const notificationsImplementation = implementor.implementWebSocket(notificationsWebSocket, {
    message({message, webSocket}) {
        webSocket.send({
            event: message.subscribeTo,
            message: 'Subscribed.',
        });
    },
});

export const myApiImplementation = implementApi<HostContext>()(myApi, {
    createHostContext() {
        return {
            context: {
                requestId: crypto.randomUUID(),
            },
        };
    },
    clientOriginRequirement: AnyOrigin,
    endpoints: [
        healthImplementation,
        createUserImplementation,
    ],
    webSockets: [
        notificationsImplementation,
    ],
});

const {kill} = await startApiServer(myApiImplementation, {
    externalOrigin: 'http://localhost:3000',
    port: 3000,
    workerCount: 1,
});

await kill();
```

`clientOriginRequirement: AnyOrigin` is convenient for local development. Restrict it in production with an exact origin string, a `RegExp`, or an origin-check callback.

You can also attach to an existing Fastify server:

<!-- example-link: packages/host/src/examples/root-attach-existing-server.example.ts -->

```TypeScript
import {attachApi} from '@rest-vir/host';
import fastify from 'fastify';
import {myApiImplementation} from './root-api-implementation.example.js';

const server = fastify();

await attachApi(server, myApiImplementation, {
    externalOrigin: 'http://localhost:3000',
});

await server.listen({
    port: 3000,
});
```

### Typed Client

<!-- example-link: packages/host/src/examples/root-typed-client.example.ts -->

```TypeScript
import {RestVirClient} from '@rest-vir/api';
import {
    createUserEndpoint,
    healthEndpoint,
    myApi,
    notificationsWebSocket,
} from './root-api-definition.example.js';

const client = new RestVirClient(myApi, 'https://api.example.com');

const health = await client.fetch(healthEndpoint).GET();

if (health.Ok) {
    console.info(health.Ok.responseData.status);
}

const created = await client.fetch(createUserEndpoint).POST({
    requestData: {
        name: 'Example User',
    },
});

if (created.Created) {
    console.info(created.Created.responseData.id);
}

const webSocket = await client.connectWebSocket(notificationsWebSocket, {
    listeners: {
        message({message}) {
            console.info(message.event, message.message);
        },
    },
});

webSocket.send({
    subscribeTo: 'user-created',
});
```

Each `client.fetch(endpoint).METHOD(...)` call returns a status-keyed result such as `Ok`, `Created`, or `BadRequest`. If the server returns an undeclared error status, the result has `unexpectedError` and the response body is exposed as text.

## Core Concepts

Endpoint definitions describe paths, HTTP methods, request data, required request headers, search params, and response data. `defineShape` data is enforced in the client types and validated at runtime.

WebSocket definitions describe the connection path, optional search params, optional protocol requirements, client message shape, and host message shape. Both `.send()` and message listeners are typed from those shapes.

`implementApi` validates that every endpoint and WebSocket declared by `defineApi` has exactly one implementation. Missing or duplicate route implementations fail early.

For better TypeScript performance on large APIs, batch related endpoint or WebSocket definitions together in files. Avoid creating one file per endpoint when an API has many routes.

## Testing

`@rest-vir/api` exports `createMockHost` for frontend and unit tests that need a typed `RestVirClient` without a real server.

`@rest-vir/host` exports `testApi`, `testEndpoint`, `testWebSocket`, `describeApi`, and `condenseResponse` for backend integration tests against real request and response behavior.

## Development

From this monorepo root:

```sh
npm run init
npm run format
npm run test:lint
npm run compile
```

Run focused package tests from the package directory:

```sh
cd packages/api && npm test
cd packages/host && npm test
```
