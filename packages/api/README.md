# @rest-vir/api

`@rest-vir/api` is the shared definition, typed client, and client-side testing package for `rest-vir`.

Use it to:

-   define endpoint and WebSocket contracts with runtime shapes
-   export one API definition that frontend and backend code can share
-   call endpoints with `RestVirClient`
-   connect to typed WebSockets
-   create in-memory mock hosts for tests

See the full reference docs at https://electrovir.github.io/rest-vir.

For a working package example, see
[`packages/demo`](https://github.com/electrovir/rest-vir/tree/dev/packages/demo) on GitHub.

## Install

```sh
npm i @rest-vir/api object-shape-tester
```

`object-shape-tester` is required for request, response, search param, header, and WebSocket message shapes.

## Define An API

<!-- example-link: src/examples/define-api.example.ts -->

```TypeScript
import {defineApi, defineEndpoint, HttpMethod, HttpStatus} from '@rest-vir/api';
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

export const myApi = defineApi({
    apiName: 'my-api',
    endpoints: [
        healthEndpoint,
    ],
    webSockets: [],
});
```

Put this file in a shared package or shared source folder. The host imports it to implement the API, and clients import it to call the API.

For large APIs, batch related endpoint definitions together in files. TypeScript type checking is faster when many endpoint definitions are grouped in a few files instead of split into one endpoint per file.

## Endpoint Definition Notes

-   `path` supports Fastify-style path params such as `/users/:userId`.
-   `requestData` may be a shape, `undefined`, or omitted.
-   Omitting `requestData` disables body validation for that method.
-   Setting `requestData: undefined` means the endpoint must not receive request body data.
-   `responses` declares the statuses the client should expect and validate.
-   Undeclared error statuses are returned to the client as `unexpectedError`.
-   Undeclared success statuses throw, because the client cannot safely type them.
-   `searchParams` and `requiredRequestHeaders` can be declared on each method.
-   `formDataShape()` is available for multipart form uploads.

## Typed Fetch Client

<!-- example-link: src/examples/fetch-endpoint.example.ts -->

```TypeScript
import {defineApi, defineEndpoint, HttpMethod, HttpStatus, RestVirClient} from '@rest-vir/api';
import {defineShape} from 'object-shape-tester';

const healthEndpoint = defineEndpoint({
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

const client = new RestVirClient(myApi, 'https://api.example.com');

const result = await client.fetch(healthEndpoint).GET();

if (result.Ok) {
    console.info(result.Ok.responseData);
}
```

`RestVirClient` builds URLs, validates params, applies required headers, serializes JSON request bodies, parses JSON responses with JSON content types, and validates declared response shapes.

For Server-Sent Events or other streaming responses, use `client.fetchStream(endpoint, method, params)` to receive a `ReadableStream` instead of parsed response data.

## WebSockets

<!-- example-link: src/examples/web-socket.example.ts -->

```TypeScript
import {defineApi, defineWebSocket, RestVirClient} from '@rest-vir/api';
import {defineShape} from 'object-shape-tester';

export const chatWebSocket = defineWebSocket({
    path: '/ws/chat',
    clientMessage: defineShape({
        text: '',
    }),
    hostMessage: defineShape({
        text: '',
        sender: '',
    }),
});

export const chatApi = defineApi({
    apiName: 'chat-api',
    endpoints: [],
    webSockets: [
        chatWebSocket,
    ],
});

const client = new RestVirClient(chatApi, 'https://api.example.com');

const webSocket = await client.connectWebSocket(chatWebSocket, {
    listeners: {
        message({message}) {
            console.info(message.sender, message.text);
        },
    },
});

webSocket.send({
    text: 'Hello.',
});
```

WebSocket definitions may also declare search params and connection protocol requirements.

## Mocking A Host In Tests

<!-- example-link: src/examples/mock-host.example.ts -->

```TypeScript
import {createMockHost, defineApi, defineEndpoint, HttpMethod, HttpStatus} from '@rest-vir/api';
import {defineShape} from 'object-shape-tester';

const healthEndpoint = defineEndpoint({
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

export const mockClient = createMockHost(myApi, {
    endpoints: {
        '/health': {
            [HttpMethod.Get]: () => ({
                [HttpStatus.Ok]: {
                    responseData: {
                        status: 'ok',
                    },
                },
            }),
        },
    },
});
```

The mock host returns a real `RestVirClient`, so application code can use the same client calls in tests that it uses in production.

## Pair With @rest-vir/host

Use this package for the shared contract and client calls. Use `@rest-vir/host` in the server process to implement the same definition:

<!-- example-link: ../host/src/examples/pair-with-host.example.ts -->

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

const implementor = createApiImplementor<undefined>()(myApi);

export const myApiImplementation = implementApi<undefined>()(myApi, {
    createHostContext() {
        return {
            context: undefined,
        };
    },
    endpoints: [
        implementor.implementEndpoint(healthEndpoint, {
            [HttpMethod.Get]() {
                return {
                    [HttpStatus.Ok]: {
                        responseData: {
                            status: 'ok',
                        },
                    },
                };
            },
        }),
    ],
});
```
