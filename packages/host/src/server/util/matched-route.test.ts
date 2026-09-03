import {assert} from '@augment-vir/assert';
import {HttpMethod, HttpStatus} from '@augment-vir/common';
import {describe, it, itCases} from '@augment-vir/test';
import {defineApi, defineEndpoint} from '@rest-vir/api';
import {implementApi} from '../../implementation/implement-api.js';
import {createApiImplementor} from '../../implementation/implementor.js';
import {type ServerRequest} from '../../implementation/raw-route-data.js';
import {silentServerLogger} from '../../implementation/server-logger.js';
import {startApiServer} from '../run-api/start-api-server.js';
import {extractErrorRoutePath} from './matched-route.js';

type MatchedRouteContext = {
    contextWasCreated: true;
};

const staticEndpoint = defineEndpoint({
    path: '/static-route/stuff',
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

const parameterizedEndpoint = defineEndpoint({
    path: '/user/:userId',
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

const matchedRouteApi = defineApi({
    apiName: 'matched route test api',
    endpoints: [
        staticEndpoint,
        parameterizedEndpoint,
    ],
    webSockets: [],
});

/**
 * Records the context each implementation was handed, so a request that reached a handler without
 * one is distinguishable from a request that was never routed at all.
 */
async function startMatchedRouteServer() {
    const handledContexts: (MatchedRouteContext | undefined)[] = [];

    const implementor = createApiImplementor<MatchedRouteContext>()(matchedRouteApi);

    const implementation = implementApi<MatchedRouteContext>()(matchedRouteApi, {
        clientOriginRequirement: {
            anyOrigin: true,
        },
        serverLogger: silentServerLogger,
        createHostContext() {
            return {
                context: {
                    contextWasCreated: true,
                },
            };
        },
        endpoints: [
            staticEndpoint,
            parameterizedEndpoint,
        ].map((endpoint) => {
            return implementor.implementEndpoint(endpoint as typeof staticEndpoint, {
                [HttpMethod.Get]({context}) {
                    handledContexts.push(context);

                    return {
                        [HttpStatus.Ok]: {
                            responseData: undefined,
                        },
                    };
                },
            });
        }),
    });

    const serverOutput = await startApiServer(implementation, {
        host: '127.0.0.1',
        port: 40_500,
        workerCount: 1,
        preventWorkerRespawn: true,
        externalOrigin: 'http://localhost',
    });

    return {
        handledContexts,
        serverOutput,
    };
}

describe('matched route lookup', () => {
    it('builds a context for every path spelling Fastify routes', async () => {
        const {handledContexts, serverOutput} = await startMatchedRouteServer();

        try {
            const statuses = await Promise.all(
                [
                    '/static-route/stuff',
                    '/user/some-id',
                    /**
                     * Fastify decodes `%73` to `s` and routes this to the static endpoint.
                     * Re-matching the raw path instead would miss it, dispatching the endpoint with
                     * no context.
                     */
                    '/static-route/%73tuff',
                    /** Fastify matches this with an empty `userId`. */
                    '/user/',
                ].map(async (path) => {
                    return (await fetch(`http://localhost:${serverOutput.port}${path}`)).status;
                }),
            );

            assert.deepEquals(
                {
                    statuses,
                    handledContexts,
                },
                {
                    statuses: [
                        HttpStatus.Ok,
                        HttpStatus.Ok,
                        HttpStatus.Ok,
                        HttpStatus.Ok,
                    ],
                    handledContexts: [
                        {
                            contextWasCreated: true,
                        },
                        {
                            contextWasCreated: true,
                        },
                        {
                            contextWasCreated: true,
                        },
                        {
                            contextWasCreated: true,
                        },
                    ],
                },
            );
        } finally {
            await serverOutput.kill();
        }
    });
});

describe(extractErrorRoutePath.name, () => {
    itCases(extractErrorRoutePath, [
        {
            it: 'prefers the route path registered by this attachment',
            input: {
                request: {
                    routeOptions: {
                        url: '/fastify-template',
                        config: {
                            restVirRoute: {
                                attachId: 'attach-1',
                                routePath: '/rest-vir-route',
                            },
                        },
                    },
                } as unknown as ServerRequest,
                attachId: 'attach-1',
            },
            expect: '/rest-vir-route',
        },
        {
            it: 'falls back to the Fastify route template for a route from another attachment',
            input: {
                request: {
                    routeOptions: {
                        url: '/fastify-template',
                        config: {
                            restVirRoute: {
                                attachId: 'attach-2',
                                routePath: '/rest-vir-route',
                            },
                        },
                    },
                } as unknown as ServerRequest,
                attachId: 'attach-1',
            },
            expect: '/fastify-template',
        },
        {
            it: 'reports an unknown route when Fastify has no route either',
            input: {
                request: {
                    routeOptions: {
                        config: {},
                    },
                } as unknown as ServerRequest,
                attachId: 'attach-1',
            },
            expect: '<unknown route>',
        },
    ]);
});
