import {assert} from '@augment-vir/assert';
import {HttpMethod, HttpStatus} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {defineApi, defineEndpoint} from '@rest-vir/api';
import {implementApi} from '../../implementation/implement-api.js';
import {createApiImplementor} from '../../implementation/implementor.js';
import type {ServerRequest, ServerResponse} from '../../implementation/raw-route-data.js';
import {silentServerLogger} from '../../implementation/server-logger.js';
import {preHandler} from './pre-handler.js';

const healthEndpoint = defineEndpoint({
    path: '/health',
    requests: {
        [HttpMethod.Get]: {
            responses: {
                [HttpStatus.Ok]: {
                    responseData: undefined,
                },
            },
        },
    },
});

const noRequestBodyEndpoint = defineEndpoint({
    path: '/no-request-body',
    requests: {
        [HttpMethod.Post]: {
            requestData: undefined,
            responses: {
                [HttpStatus.Ok]: {
                    responseData: undefined,
                },
            },
        },
    },
});

const api = defineApi({
    apiName: 'pre-handler test api',
    endpoints: [
        healthEndpoint,
        noRequestBodyEndpoint,
    ],
    webSockets: [],
});

const implementor = createApiImplementor<undefined>()(api);

const apiImplementation = implementApi<undefined>()(api, {
    createHostContext() {
        return {
            context: undefined,
        };
    },
    clientOriginRequirement: {
        anyOrigin: true,
    },
    endpoints: [
        implementor.implementEndpoint(healthEndpoint, {
            [HttpMethod.Get]() {
                return {
                    [HttpStatus.Ok]: {
                        responseData: undefined,
                    },
                };
            },
        }),
        implementor.implementEndpoint(noRequestBodyEndpoint, {
            [HttpMethod.Post]() {
                return {
                    [HttpStatus.Ok]: {
                        responseData: undefined,
                    },
                };
            },
        }),
    ],
});

type MockServerResponse = {
    raw: {
        removeHeader: () => void;
        setHeader: () => void;
    };
    header: () => void;
};

describe(preHandler.name, () => {
    it('ignores a missing implementation', async () => {
        await preHandler({
            request: {
                originalUrl: '/missing',
                headers: {},
            } as unknown as ServerRequest,
            response: {
                header() {},
            } as unknown as ServerResponse,
            api: apiImplementation,
            server: {
                serviceOrigin: '',
            },
            attachId: '',
            serverLogger: silentServerLogger,
        });
    });

    it('accepts an omitted body when requestData is explicitly undefined', async () => {
        const attachId = 'test';
        const request = {
            originalUrl: '/no-request-body',
            method: HttpMethod.Post,
            headers: {},
            body: undefined,
            params: {},
        } satisfies Partial<ServerRequest> as unknown as ServerRequest;

        const result = await preHandler({
            request,
            response: {
                raw: {
                    removeHeader() {},
                    setHeader() {},
                },
                header() {},
            } satisfies MockServerResponse as unknown as ServerResponse,
            api: apiImplementation,
            server: {
                serviceOrigin: '',
            },
            attachId,
            serverLogger: silentServerLogger,
        });

        assert.isUndefined(result);
        assert.isUndefined(request.restVirContext?.[attachId]?.requestData);
    });
});
