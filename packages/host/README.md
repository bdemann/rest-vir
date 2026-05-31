# @rest-vir/host

`@rest-vir/host` is the Fastify runtime for an API defined with `@rest-vir/api`.

Use it to:

-   implement typed endpoint methods and WebSocket listeners
-   create per-request host context
-   validate request bodies, search params, headers, and WebSocket messages
-   run a new Fastify server or attach routes to an existing one
-   test implementations with real request and response objects

See the full reference docs at https://electrovir.github.io/rest-vir.

For a working package example, see
[`packages/demo`](https://github.com/electrovir/rest-vir/tree/dev/packages/demo) on GitHub.

## Install

```sh
npm i @rest-vir/host @rest-vir/api object-shape-tester
```

`@rest-vir/api` provides the shared API definition. `object-shape-tester` provides the runtime shapes used by that definition.

## Implement And Run An API

<!-- example-link: src/examples/start-api-server.example.ts -->

```TypeScript
import {defineApi, defineEndpoint, HttpMethod, HttpStatus} from '@rest-vir/api';
import {createApiImplementor, implementApi, startApiServer} from '@rest-vir/host';
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

const myApi = defineApi({
    apiName: 'my-api',
    endpoints: [
        healthEndpoint,
    ],
    webSockets: [],
});

const {implementEndpoint} = createApiImplementor<undefined>()(myApi);

export const healthImplementation = implementEndpoint(healthEndpoint, {
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

export const apiImplementation = implementApi<undefined>()(myApi, {
    createHostContext: () => ({
        context: undefined,
    }),
    endpoints: [healthImplementation],
});

const {kill} = await startApiServer(apiImplementation, {
    port: 3000,
    externalOrigin: 'http://localhost:3000',
});

// later, to shut down:
await kill();
```

`implementApi` accepts arrays of implementations. It validates that every endpoint and WebSocket declared by the API definition has exactly one matching implementation.

## Host Context

`createHostContext` runs before endpoint and WebSocket handlers. Return `{context}` to pass typed context into every implementation callback.

<!-- example-link: src/examples/host-context.example.ts -->

```TypeScript
import {defineApi, defineEndpoint, HttpMethod, HttpStatus} from '@rest-vir/api';
import {createApiImplementor, implementApi} from '@rest-vir/host';
import {defineShape} from 'object-shape-tester';

const healthEndpoint = defineEndpoint({
    path: '/health',
    requests: {
        [HttpMethod.Get]: {
            responses: {
                [HttpStatus.Ok]: {
                    responseData: defineShape({
                        requestId: '',
                    }),
                },
            },
        },
    },
});

const myApi = defineApi({
    apiName: 'my-api',
    endpoints: [
        healthEndpoint,
    ],
    webSockets: [],
});

type HostContext = {
    requestId: string;
};

const {implementEndpoint} = createApiImplementor<HostContext>()(myApi);

const healthImplementation = implementEndpoint(healthEndpoint, {
    [HttpMethod.Get]({context}) {
        return {
            [HttpStatus.Ok]: {
                responseData: {
                    requestId: context.requestId,
                },
            },
        };
    },
});

export const apiImplementation = implementApi<HostContext>()(myApi, {
    createHostContext() {
        return {
            context: {
                requestId: crypto.randomUUID(),
            },
        };
    },
    endpoints: [
        healthImplementation,
    ],
});
```

`createHostContext` can also reject a request by returning `{reject}` with a status code, response data, and optional headers.

## WebSocket Implementations

<!-- example-link: src/examples/web-socket-implementation.example.ts -->

```TypeScript
import {defineApi, defineWebSocket} from '@rest-vir/api';
import {createApiImplementor, implementApi} from '@rest-vir/host';
import {defineShape} from 'object-shape-tester';

const echoWebSocket = defineWebSocket({
    path: '/ws/echo',
    clientMessage: defineShape({
        value: '',
    }),
    hostMessage: defineShape({
        value: '',
    }),
});

const api = defineApi({
    apiName: 'socket-api',
    endpoints: [],
    webSockets: [
        echoWebSocket,
    ],
});

const implementor = createApiImplementor<undefined>()(api);

const echoImplementation = implementor.implementWebSocket(echoWebSocket, {
    message({message, webSocket}) {
        webSocket.send({
            value: message.value,
        });
    },
});

export const apiImplementation = implementApi<undefined>()(api, {
    createHostContext() {
        return {
            context: undefined,
        };
    },
    webSockets: [
        echoImplementation,
    ],
});
```

WebSocket listeners may implement `open`, `message`, and `close`. Incoming client messages are validated before `message` runs.

## Attach To An Existing Fastify Server

<!-- example-link: src/examples/attach-api.example.ts -->

```TypeScript
import {attachApi} from '@rest-vir/host';
import fastify from 'fastify';
import {apiImplementation} from './basic-api-implementation.example.js';

const server = fastify();

await attachApi(server, apiImplementation, {
    externalOrigin: 'http://localhost:3000',
});

await server.listen({
    port: 3000,
});
```

`attachApi` registers compression and WebSocket support automatically. Multipart support is registered only when an endpoint uses `formDataShape()`.

## CORS And Origins

If no `clientOriginRequirement` is set on a route or on `implementApi`, all origins are allowed. Set `clientOriginRequirement` for production APIs.

Accepted origin requirements come from `@rest-vir/api`:

-   exact origin string
-   `RegExp`
-   callback returning `true` or `false`
-   `AnyOrigin`
-   `{anyOrigin: true}`
-   `{anyOriginWithCredentials: true}`

Per-route requirements override the API-level requirement.

## Runtime Options

`startApiServer(api, options)` requires `externalOrigin`, which is the public origin clients use to reach the API. Common options include:

-   `port`: listen port, defaulting to `3000`
-   `host`: listen host, defaulting to `localhost`
-   `workerCount`: number of worker processes, defaulting to CPU count minus one
-   `bodyLimit`: maximum HTTP request body size
-   `webSocketMaxPayload`: maximum inbound WebSocket message size
-   `connectionTimeout`, `keepAliveTimeout`, and `requestTimeout`
-   `trustProxy`: Fastify proxy trust configuration

`startApiServer` serves plaintext HTTP. Terminate TLS in a reverse proxy or configure your own Fastify instance and use `attachApi`.

## Testing

Use `testApi` for integration tests without manually managing a server:

<!-- example-link: src/examples/test-api.example.ts -->

```TypeScript
import {HttpMethod} from '@rest-vir/api';
import {condenseResponse, testApi} from '@rest-vir/host';
import {apiImplementation, healthEndpoint} from './basic-api-implementation.example.js';

const {fetchEndpoint, kill} = await testApi(apiImplementation);

const response = await fetchEndpoint(healthEndpoint, HttpMethod.Get);

console.info(await condenseResponse(response));

await kill();
```

`describeEndpoint` wraps `testEndpoint` in table-driven tests:

<!-- example-link: src/examples/describe-endpoint.example.ts -->

```TypeScript
import {HttpStatus} from '@rest-vir/api';
import {describeEndpoint} from '@rest-vir/host';
import {healthImplementation} from './basic-api-implementation.example.js';

function createHostContext() {
    return {
        context: undefined,
    };
}

describeEndpoint(healthImplementation, ({endpointCases}) => {
    endpointCases.GET({createHostContext}, [
        {
            it: 'responds with ok',
            input: {},
            expect: {
                response: {
                    [HttpStatus.Ok]: {
                        body: {
                            status: 'ok',
                        },
                    },
                },
            },
        },
    ]);
});
```

`testApi` uses Fastify request injection by default, so it does not need a real port. Pass a `port` option when you need full network behavior. `describeApi`, `describeEndpoint`, `testEndpoint`, and `testWebSocket` are also exported for focused tests.
