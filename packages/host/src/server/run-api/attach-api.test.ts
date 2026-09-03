import {assert, waitUntil} from '@augment-vir/assert';
import {HttpMethod, HttpStatus} from '@augment-vir/common';
import {describe, it, itCases} from '@augment-vir/test';
import {defineApi, defineEndpoint, defineWebSocket} from '@rest-vir/api';
import fastify from 'fastify';
import {type AddressInfo} from 'node:net';
import {implementApi} from '../../implementation/implement-api.js';
import {createApiImplementor} from '../../implementation/implementor.js';
import {attachApi, extractRunningServerInfo} from './attach-api.js';

describe(extractRunningServerInfo.name, () => {
    itCases(extractRunningServerInfo, [
        {
            it: 'handles a missing address',
            inputs: [
                {
                    externalOrigin: 'http://localhost:4321',
                },
                {
                    server: {
                        address() {
                            return null;
                        },
                    },
                },
            ],
            expect: {
                serviceOrigin: 'http://localhost:4321',
            },
        },
        {
            it: 'handles a string address',
            inputs: [
                {
                    externalOrigin: 'http://localhost:4321',
                },
                {
                    server: {
                        address() {
                            return 'something';
                        },
                    },
                },
            ],
            expect: {
                serviceOrigin: 'http://localhost:4321',
            },
        },
        {
            it: 'handles an address with a port',
            inputs: [
                {
                    externalOrigin: 'http://localhost:4321',
                },
                {
                    server: {
                        address() {
                            return {
                                address: '',
                                family: '',
                                port: 1234,
                            };
                        },
                    },
                },
            ],
            expect: {
                serviceOrigin: 'http://localhost:1234',
            },
        },
        {
            it: 'handles an service origin without a port',
            inputs: [
                {
                    externalOrigin: 'http://localhost',
                },
                {
                    server: {
                        address() {
                            return {
                                address: '',
                                family: '',
                                port: 1234,
                            };
                        },
                    },
                },
            ],
            expect: {
                serviceOrigin: 'http://localhost',
            },
        },
    ]);
});

/**
 * A value that only ever appears in the request's query string. If it shows up in a logged error,
 * the error is carrying credentials to wherever those errors get forwarded.
 */
const secretSearchParamValue = 'super-secret-credential';

type ErrorRouteContext = {
    contextWasCreated: true;
};

const contextFailureEndpoint = defineEndpoint({
    path: '/context-failure',
    requests: {
        [HttpMethod.Get]: {
            clientOriginRequirement: {
                anyOrigin: true,
            },
            responses: {
                [HttpStatus.Ok]: {
                    responseData: undefined,
                },
            },
        },
    },
});

const openFailureWebSocket = defineWebSocket({
    path: '/open-failure',
    clientMessage: undefined,
    hostMessage: undefined,
});

const errorRouteApi = defineApi({
    apiName: 'attach api error test',
    endpoints: [
        contextFailureEndpoint,
    ],
    webSockets: [
        openFailureWebSocket,
    ],
});

/**
 * Starts a server whose endpoint blows up inside `createHostContext` (hitting the `preValidation`
 * catch-all in {@link attachApi}) and whose WebSocket blows up inside `open` (hitting the
 * `@fastify/websocket` `errorHandler` in {@link attachApi}), recording every error the server logs.
 *
 * `attachApi` is used directly rather than `startApiServer` because only the former allows
 * `throwErrorsForExternalHandling`, which is what lets a WebSocket failure escape `handleRoute` and
 * reach `@fastify/websocket`'s `errorHandler`.
 */
async function startErrorRouteServer() {
    const loggedErrors: Error[] = [];

    const implementor = createApiImplementor<ErrorRouteContext>()(errorRouteApi);

    const implementation = implementApi<ErrorRouteContext>()(errorRouteApi, {
        clientOriginRequirement: {
            anyOrigin: true,
        },
        serverLogger: {
            error(error) {
                loggedErrors.push(error);
            },
            info: undefined,
        },
        createHostContext({endpointDefinition}) {
            if (endpointDefinition) {
                throw new Error('Context creation exploded.');
            }

            return {
                context: {
                    contextWasCreated: true,
                },
            };
        },
        endpoints: [
            implementor.implementEndpoint(contextFailureEndpoint, {
                [HttpMethod.Get]() {
                    return {
                        [HttpStatus.Ok]: {
                            responseData: undefined,
                        },
                    };
                },
            }),
        ],
        webSockets: [
            implementor.implementWebSocket(openFailureWebSocket, {
                open() {
                    throw new Error('WebSocket open exploded.');
                },
            }),
        ],
    });

    const server = fastify();

    await attachApi(server, implementation, {
        externalOrigin: 'http://localhost',
        throwErrorsForExternalHandling: true,
    });

    await server.listen({
        host: '127.0.0.1',
        port: 0,
    });

    const {port} = server.server.address() as AddressInfo;

    return {
        loggedErrors,
        port,
        async kill(this: void) {
            await server.close();
        },
    };
}

/** Asserts that no logged error carries the request's query string in its message or its stack. */
function assertNoQueryInErrors(loggedErrors: ReadonlyArray<Error>, expectedRoutePath: string) {
    assert.isAbove(loggedErrors.length, 0, 'expected at least one logged error');

    const errorStrings = loggedErrors.map((error) => {
        return [
            error.message,
            error.stack,
        ].join('\n');
    });

    errorStrings.forEach((errorString) => {
        assert.isFalse(
            errorString.includes(secretSearchParamValue),
            `logged error leaked a search param value: ${errorString}`,
        );
        assert.isFalse(
            errorString.includes('?'),
            `logged error leaked a query string: ${errorString}`,
        );
    });

    assert.isTrue(
        errorStrings.some((errorString) => errorString.includes(`'${expectedRoutePath}'`)),
        `no logged error named the route template '${expectedRoutePath}'`,
    );
}

describe('logged request errors', () => {
    it('omits the query string from endpoint handler errors', async () => {
        const {loggedErrors, port, kill} = await startErrorRouteServer();

        try {
            const response = await fetch(
                `http://127.0.0.1:${port}${contextFailureEndpoint.path}?code=${secretSearchParamValue}`,
            );

            assert.strictEquals(response.status, HttpStatus.InternalServerError);
            assertNoQueryInErrors(loggedErrors, contextFailureEndpoint.path);
        } finally {
            await kill();
        }
    });

    it('omits the query string from WebSocket handler errors', async () => {
        const {loggedErrors, port, kill} = await startErrorRouteServer();

        try {
            const webSocket = new WebSocket(
                `ws://127.0.0.1:${port}${openFailureWebSocket.path}?code=${secretSearchParamValue}`,
            );

            try {
                await waitUntil.isTrue(() => loggedErrors.length > 0);

                assertNoQueryInErrors(loggedErrors, openFailureWebSocket.path);
            } finally {
                webSocket.close();
            }
        } finally {
            await kill();
        }
    });
});
