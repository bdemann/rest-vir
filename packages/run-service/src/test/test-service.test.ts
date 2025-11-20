import {assert, waitUntil} from '@augment-vir/assert';
import {DeferredPromise, extractErrorMessage, randomInteger} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {
    AnyOrigin,
    type BaseSearchParams,
    buildEndpointUrl,
    defineService,
    HttpMethod,
    HttpStatus,
    type MinimalService,
    restVirServiceNameHeader,
} from '@rest-vir/define-service';
import {implementService, RejectRequestError} from '@rest-vir/implement-service';
import {mockServiceImplementation} from '@rest-vir/implement-service/src/implementation/implement-service.mock.js';
import fastify from 'fastify';
import {exactShape} from 'object-shape-tester';
import {buildUrl, parseUrl} from 'url-vir';
import {
    condenseResponse,
    describeService,
    testExistingServer,
    testService,
} from './test-service.js';

describeService({service: mockServiceImplementation}, ({fetchEndpoint}) => {
    it('responds to a request', async () => {
        const response = await fetchEndpoint['/empty']();

        assert.isTrue(response.ok);
    });
    it('rejects an invalid request', async () => {
        const response = await fetchEndpoint['/test']({
            // @ts-expect-error: invalid request data
            requestData: undefined,
        });

        assert.isFalse(response.ok);
    });
});

const plainService = implementService({
    service: defineService({
        webSockets: {
            '/socket': {
                messageFromClientShape: exactShape('from client'),
                messageFromHostShape: exactShape('from server'),
            },
        },
        endpoints: {
            '/health': {
                methods: {
                    [HttpMethod.Get]: true,
                },
                requestDataShape: undefined,
                responseDataShape: undefined,
            },
            '/internal-error': {
                methods: {
                    [HttpMethod.Get]: true,
                },
                requestDataShape: undefined,
                responseDataShape: undefined,
            },
        },
        requiredClientOrigin: AnyOrigin,
        serviceName: 'plain service',
        serviceOrigin: 'https://example.com',
    }),
    createContext({requestHeaders}) {
        if (requestHeaders.authorization === 'reject') {
            throw new Error('context failed');
        }

        return {
            context: undefined,
        };
    },
})({
    endpoints: {
        '/health'({context}) {
            assert.tsType(context).equals<undefined>();

            return {
                statusCode: HttpStatus.Ok,
            };
        },
        '/internal-error'() {
            throw new Error('Intentional error.');
        },
    },
    webSockets: {
        '/socket': {
            message({message, webSocket}) {
                assert.strictEquals(message, 'from client');
                webSocket.send('from server');
            },
        },
    },
});

describeService({service: plainService, options: {}}, ({fetchEndpoint}) => {
    it('responds to a request', async () => {
        const response = await fetchEndpoint['/health']();

        assert.isTrue(response.ok);
    });
    it('includes fastify headers', async () => {
        const response = await fetchEndpoint['/health']();

        assert.hasKeys((await condenseResponse(response, {includeDefaultHeaders: true})).headers, [
            'access-control-allow-origin',
            'connection',
            'content-length',
            'date',
        ]);
    });
});

const serviceWithPostHook = implementService({
    service: defineService({
        webSockets: {
            '/socket': {
                messageFromClientShape: exactShape('from client'),
                messageFromHostShape: exactShape('from server'),
            },
        },
        endpoints: {
            '/health': {
                methods: {
                    [HttpMethod.Post]: true,
                },
                requestDataShape: exactShape('health request'),
                responseDataShape: exactShape('health response'),
                searchParamsShape: {
                    data: [''],
                },
            },
            '/health2': {
                methods: {
                    [HttpMethod.Post]: true,
                },
                requestDataShape: exactShape('health2 request'),
                responseDataShape: exactShape('health2 response'),
            },
            '/health3': {
                methods: {
                    [HttpMethod.Get]: true,
                },
                requestDataShape: undefined,
                responseDataShape: exactShape('data'),
            },
            '/health4': {
                methods: {
                    [HttpMethod.Get]: true,
                },
                requestDataShape: undefined,
                responseDataShape: undefined,
            },
            '/health5': {
                methods: {
                    [HttpMethod.Get]: true,
                },
                requestDataShape: undefined,
                responseDataShape: undefined,
            },
            '/health6': {
                methods: {
                    [HttpMethod.Get]: true,
                },
                requestDataShape: undefined,
                responseDataShape: undefined,
            },
            '/health7': {
                methods: {
                    [HttpMethod.Get]: true,
                },
                requestDataShape: undefined,
                responseDataShape: undefined,
            },
            '/always-accept-cors': {
                methods: {
                    [HttpMethod.Get]: true,
                },
                requestDataShape: undefined,
                responseDataShape: undefined,
                requiredClientOrigin() {
                    return true;
                },
            },
            '/always-accept-cors-fallback': {
                methods: {
                    [HttpMethod.Get]: true,
                },
                requestDataShape: undefined,
                responseDataShape: undefined,
            },
            '/rejects-with-error': {
                methods: {
                    [HttpMethod.Get]: true,
                },
                requestDataShape: undefined,
                responseDataShape: undefined,
            },
        },
        requiredClientOrigin() {
            return true;
        },
        serviceName: 'with postHook',
        serviceOrigin: 'https://example.com',
    }),
    createContext({endpointDefinition, requestHeaders, searchParams}) {
        if (requestHeaders.authorization === 'reject') {
            throw new Error('context failed');
        } else if (endpointDefinition?.path === '/health7') {
            return {
                reject: {
                    statusCode: HttpStatus.BadRequest,
                    responseErrorMessage: 'failed in context',
                },
            };
        }

        assert.tsType(searchParams).equals<{data: string[]} | BaseSearchParams>();

        return {
            context: 'hello there',
        };
    },
})({
    endpoints: {
        '/health'({context}) {
            assert.tsType(context).equals<string>();

            return {
                statusCode: HttpStatus.Ok,
                responseData: 'health response',
            };
        },
        '/health2'({context, searchParams}) {
            assert.tsType(searchParams).equals<BaseSearchParams>();
            assert.tsType(context).equals<string>();

            return {
                statusCode: HttpStatus.Ok,
                responseData: 'health2 response',
            };
        },
        '/health3'() {
            return {
                statusCode: HttpStatus.Ok,
                responseData: 'data',
            };
        },
        '/health4'() {
            return {
                statusCode: HttpStatus.Forbidden,
                responseErrorMessage: 'this is an error',
            };
        },
        '/health5'() {
            return {
                statusCode: HttpStatus.Forbidden,
                responseErrorMessage: 'this is an error',
            };
        },
        '/health6'() {
            return {
                statusCode: HttpStatus.Forbidden,
                responseErrorMessage: 'this is an error',
            };
        },
        '/health7'() {
            return {
                statusCode: HttpStatus.Forbidden,
                responseErrorMessage: 'this is an error',
            };
        },
        '/always-accept-cors'() {
            return {
                statusCode: HttpStatus.Ok,
            };
        },
        '/always-accept-cors-fallback'() {
            return {
                statusCode: HttpStatus.Ok,
            };
        },
        '/rejects-with-error'() {
            throw new RejectRequestError(HttpStatus.BadGateway);
        },
    },
    webSockets: {
        '/socket': {
            message({message, webSocket}) {
                assert.strictEquals(message, 'from client');
                webSocket.send('from server');
            },
        },
    },
    postHook({
        context,
        originalResponseData,
        requestData,
        searchParams,
        service,
        endpointDefinition,
        webSocketDefinition,
    }) {
        assert.tsType(context).equals<string | undefined>();
        assert
            .tsType(originalResponseData)
            .equals<'health response' | 'health2 response' | 'data' | undefined>();
        assert.tsType(requestData).equals<'health request' | 'health2 request' | undefined>();
        if (searchParams && 'data' in searchParams) {
            assert.tsType(searchParams.data[0]).equals<string | undefined>();
        }
        assert.tsType(service).equals<MinimalService<'with postHook'>>();

        if (endpointDefinition?.path === '/health') {
            /** Returning nothing should have no effect. */
            return undefined;
        } else if (endpointDefinition?.path === '/health2') {
            /** Returning something should overwrite original data. */
            return {
                statusCode: HttpStatus.Accepted,
                responseData: 'wrong data',
                dataType: 'application/json',
            };
        } else if (endpointDefinition?.path === '/health3') {
            /** Returning something should overwrite original data. */
            return {
                statusCode: HttpStatus.Unauthorized,
                responseData: undefined,
                headers: {
                    extra: 'value',
                },
            };
        } else if (endpointDefinition?.path === '/health4') {
            /** Returning something should overwrite original data. */
            return {
                responseErrorMessage: undefined,
            };
        } else if (endpointDefinition?.path === '/health5') {
            /** Returning something should overwrite original data. */
            return {
                responseErrorMessage: 'new error',
            };
        } else if (endpointDefinition?.path === '/health6') {
            return {};
        } else if (endpointDefinition?.path === '/health7') {
            return {};
        }

        return undefined;
    },
});

describeService({service: serviceWithPostHook}, ({fetchEndpoint, getServer, service}) => {
    it('ignores postHook output', async () => {
        const response = await fetchEndpoint['/health']({
            requestData: 'health request',
            searchParams: {
                data: ['something'],
            },
        });
        assert.isTrue(response.ok);
        assert.strictEquals(response.status, HttpStatus.Ok);
        assert.strictEquals(await response.text(), 'health response');
    });
    it('uses postHook output', async () => {
        const response = await fetchEndpoint['/health2']({
            requestData: 'health2 request',
        });
        assert.isTrue(response.ok);
        assert.strictEquals(response.status, HttpStatus.Accepted);
        assert.strictEquals(await response.text(), 'wrong data');
    });
    it('handles invalid method to actual path', async () => {
        const {fullPath, href} = parseUrl(buildEndpointUrl(service.endpoints['/health2'], {}));

        const innerResponse = await (
            await getServer()
        ).inject({
            remoteAddress: href,
            // cspell:ignore PROPFIND
            method: 'PROPFIND' as any,
            url: fullPath,
        });

        const response = new Response(innerResponse.rawPayload as BodyInit, {
            status: innerResponse.statusCode,
            headers: innerResponse.headers as Record<string, string>,
            statusText: innerResponse.statusMessage,
        });

        assert.isFalse(response.ok);
        assert.strictEquals(response.status, HttpStatus.MethodNotAllowed);
        assert.strictEquals(await response.text(), '');
    });
    it('handles invalid method to invalid path', async () => {
        const {fullPath, href} = buildUrl(buildEndpointUrl(service.endpoints['/health2'], {}), {
            paths: ['invalid-path'],
        });

        const innerResponse = await (
            await getServer()
        ).inject({
            remoteAddress: href,
            // cspell:ignore PROPFIND
            method: 'PROPFIND' as any,
            url: fullPath,
        });

        const response = new Response(innerResponse.rawPayload as BodyInit, {
            status: innerResponse.statusCode,
            headers: innerResponse.headers as Record<string, string>,
            statusText: innerResponse.statusMessage,
        });

        assert.isFalse(response.ok);
        assert.strictEquals(response.status, HttpStatus.NotFound);
        assert.deepEquals(await response.json(), {
            message: 'Route PROPFIND:/invalid-path not found',
            error: 'Not Found',
            statusCode: HttpStatus.NotFound,
        });
    });
    it('can wipe output with postHook', async () => {
        const response = await condenseResponse(await fetchEndpoint['/health3']());
        assert.strictEquals(response.body, undefined);
        assert.strictEquals(response.status, HttpStatus.Unauthorized);
        assert.deepEquals(response.headers, {
            'access-control-allow-origin': '*',
            'access-control-expose-headers': 'rest-vir-service',
            extra: 'value',
        });
    });
    it('can wipe error messages with postHook', async () => {
        const response = await fetchEndpoint['/health4']();
        assert.isFalse(response.ok);
        assert.strictEquals(response.status, HttpStatus.Forbidden);
        assert.strictEquals(await response.text(), '');
    });
    it('uses a new error message', async () => {
        const response = await fetchEndpoint['/health5']();
        assert.isFalse(response.ok);
        assert.strictEquals(response.status, HttpStatus.Forbidden);
        assert.strictEquals(await response.text(), 'new error');
    });
    it('falls back to the original message', async () => {
        const response = await fetchEndpoint['/health6']();
        assert.isFalse(response.ok);
        assert.strictEquals(response.status, HttpStatus.Forbidden);
        assert.strictEquals(await response.text(), 'this is an error');
    });
    it('fires postHook if context rejects', async () => {
        const response = await fetchEndpoint['/health7']();
        assert.isFalse(response.ok);
        assert.strictEquals(response.status, HttpStatus.BadRequest);
        assert.strictEquals(await response.text(), 'failed in context');
    });
    it('handles a RejectRequestError', async () => {
        const response = await fetchEndpoint['/rejects-with-error']();
        assert.isFalse(response.ok);
        assert.strictEquals(response.status, HttpStatus.BadGateway);
        assert.isEmpty(await response.text());
    });
    it('handles no origin', async () => {
        assert.isTrue((await fetchEndpoint['/always-accept-cors']()).ok);
        assert.isTrue((await fetchEndpoint['/always-accept-cors-fallback']()).ok);
    });
    it('handles any origin', async () => {
        assert.isTrue(
            (
                await fetchEndpoint['/always-accept-cors']({
                    options: {
                        headers: {
                            origin: 'something',
                        },
                    },
                })
            ).ok,
        );
        assert.isTrue(
            (
                await fetchEndpoint['/always-accept-cors-fallback']({
                    options: {
                        headers: {
                            origin: 'something',
                        },
                    },
                })
            ).ok,
        );
    });
});

describe(testService.name, () => {
    it('works with an actual port', async () => {
        const {fetchEndpoint, connectWebSocket, kill} = await testService(plainService, {
            port: 4500 + randomInteger({min: 0, max: 4000}),
        });

        try {
            assert.deepEquals(await condenseResponse(await fetchEndpoint['/health']()), {
                headers: {
                    'access-control-allow-origin': '*',
                    'access-control-expose-headers': restVirServiceNameHeader,
                },
                status: HttpStatus.Ok,
            });

            const webSocketMessageReceived = new DeferredPromise<string>();

            const webSocket = await connectWebSocket['/socket']({
                listeners: {
                    message({message}) {
                        webSocketMessageReceived.resolve(message);
                    },
                },
            });
            try {
                const reply = await webSocket.sendAndWaitForReply({message: 'from client'});
                assert.tsType(reply).equals<'from server'>();
                assert.strictEquals(reply, 'from server');
                webSocket.send('from client');

                const messageReceived = await webSocketMessageReceived.promise;

                assert.strictEquals(messageReceived, 'from server');
            } finally {
                await webSocket.close();
            }
        } finally {
            await kill();
        }
    });
    it('can connect with search params', async () => {
        const {fetchEndpoint, connectWebSocket, kill} = await testService(
            mockServiceImplementation,
            {
                port: 4500 + randomInteger({min: 0, max: 4000}),
            },
        );

        try {
            assert.deepEquals(
                await condenseResponse(
                    await fetchEndpoint['/with-search-params']({
                        method: HttpMethod.Get,
                        searchParams: {
                            param1: ['hi'],
                            param2: [
                                'a',
                                'b',
                                'c',
                            ],
                        },
                    }),
                ),
                {
                    headers: {
                        'access-control-allow-origin': '*',
                        'access-control-expose-headers': restVirServiceNameHeader,
                    },
                    status: HttpStatus.Ok,
                },
            );

            await connectWebSocket['/with-search-params']({
                searchParams: {
                    param1: ['hi'],
                    param2: [
                        'a',
                        'b',
                        'c',
                    ],
                },
            });
        } finally {
            await kill();
        }
    });
    it('works without a port', async () => {
        const {fetchEndpoint, connectWebSocket, kill} = await testService(plainService);

        try {
            assert.deepEquals(await condenseResponse(await fetchEndpoint['/health']()), {
                headers: {
                    'access-control-allow-origin': '*',
                    'access-control-expose-headers': restVirServiceNameHeader,
                },
                status: HttpStatus.Ok,
            });

            const webSocketMessageReceived = new DeferredPromise<string>();

            const webSocket = await connectWebSocket['/socket']({
                listeners: {
                    message({message}) {
                        webSocketMessageReceived.resolve(message);
                    },
                },
            });
            try {
                const reply = await webSocket.sendAndWaitForReply({message: 'from client'});
                assert.tsType(reply).equals<'from server'>();
                assert.strictEquals(reply, 'from server');
                webSocket.send('from client');

                const messageReceived = await webSocketMessageReceived.promise;

                assert.strictEquals(messageReceived, 'from server');
            } finally {
                await webSocket.close();
            }
        } finally {
            await kill();
        }
    });
});

describe(testExistingServer.name, () => {
    it('works with an existing fastify instance', async () => {
        const server = fastify();

        const errors: string[] = [];

        server.setErrorHandler((error, request, reply) => {
            errors.push(extractErrorMessage(error));
            reply.status(HttpStatus.InternalServerError).send();
        });

        const {fetchEndpoint} = await testExistingServer(server, plainService, {
            throwErrorsForExternalHandling: true,
        });
        try {
            assert.deepEquals(
                await condenseResponse(await fetchEndpoint['/health']()),
                {
                    headers: {
                        'access-control-allow-origin': '*',
                        'access-control-expose-headers': restVirServiceNameHeader,
                    },
                    status: HttpStatus.Ok,
                },
                'should work with a simple request',
            );

            assert.isFalse((await fetchEndpoint['/internal-error']()).ok);

            await waitUntil.isLengthExactly(1, () => errors);

            assert.strictEquals(
                errors[0],
                "Endpoint '/internal-error' failed in service 'plain service': Intentional error.",
            );
            assert.isFalse(
                (
                    await fetchEndpoint['/health']({
                        options: {
                            headers: {
                                authorization: 'reject',
                            },
                        },
                    })
                ).ok,
            );

            await waitUntil.isLengthExactly(2, () => errors);

            assert.strictEquals(errors[1], 'Failed to generate request context: context failed');
        } finally {
            await server.close();
        }
    });
});
