import {assert} from '@augment-vir/assert';
import {HttpMethod, HttpStatus, wait} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {type GenericEndpointDefinition} from '../endpoint/endpoint.js';
import {defineService} from '../service/define-service.js';
import {createMockResponse} from '../util/mock-fetch.js';
import {AnyOrigin} from '../util/origin.js';
import {generateApi, makeMockApi} from './generate-api.js';
import {mockServiceApi} from './generate-api.mock.js';
import {MockClientWebSocket} from './mock-client-web-socket.js';

describe(generateApi.name, () => {
    const testApi = generateApi(
        defineService({
            requiredClientOrigin: AnyOrigin,
            serviceName: 'test-service',
            serviceOrigin: 'localhost:0',
            endpoints: {
                '/test': {
                    methods: {
                        GET: true,
                    },
                    requestDataShape: undefined,
                    responseDataShape: undefined,
                },
            },
            webSockets: {
                '/test': {
                    messageFromClientShape: undefined,
                    messageFromHostShape: undefined,
                },
            },
        }),
    );

    it('sends a fetch', async () => {
        /** This will fail because the service origin is invalid. */
        await assert.throws(() => testApi.endpoints['/test'].fetch());
    });
    it('sends a fetchStream', async () => {
        /** This will fail because the service origin is invalid. */
        await assert.throws(() => testApi.endpoints['/test'].fetchStream());
    });
    it('connects a WebSocket', async () => {
        /** This will fail because the service origin is invalid. */
        await assert.throws(() => testApi.webSockets['/test'].connect());
    });
});

describe(makeMockApi.name, () => {
    const mockMockApi = makeMockApi(mockServiceApi, {
        fetch(url, init, endpoint) {
            assert.tsType(endpoint).matches<GenericEndpointDefinition | undefined>();
            assert
                .tsType(endpoint?.path)
                .equals<
                    | undefined
                    | '/array-origin'
                    | '/async-rejection'
                    | '/custom-props'
                    | '/empty-string-response'
                    | '/empty'
                    | '/form-data'
                    | '/function-origin'
                    | '/health'
                    | '/incorrectly-has-response-data'
                    | '/long-running'
                    | '/missing-status-code'
                    | '/missing'
                    | '/plain'
                    | '/requires-admin'
                    | '/requires-origin'
                    | '/returns-error-status'
                    | '/returns-response-error'
                    | '/test'
                    | '/throws-error'
                    | '/unknown-response'
                    | '/with-search-params'
                    | '/with/:param1/:param2'
                    | '/with/:param1/:param2/*'
                >();
            return createMockResponse({
                status: HttpStatus.Ok,
            });
        },
        webSocketConstructor: MockClientWebSocket,
    });

    it('preserves serviceOrigin', () => {
        assert.strictEquals(mockMockApi.serviceOrigin, 'https://example.com');
    });

    it('has proper types', () => {
        assert.tsType(mockServiceApi.endpoints['/with-search-params']).notEquals<never>();
        assert.tsType(mockServiceApi.endpoints['/empty']).notEquals<never>();
        assert
            .tsType<(typeof mockServiceApi.endpoints)['/long-running']['ResponseType']>()
            .equals<{result: number}>();
    });

    it('fetches a mock endpoint', async () => {
        const {data, response} = await mockMockApi.endpoints['/empty'].fetch();

        assert.isTrue(response.ok);
        assert.isUndefined(data);
    });
    it('stream-fetches a mock endpoint', async () => {
        const result = await mockMockApi.endpoints['/empty'].fetchStream();

        assert.isTrue(result.ok);
    });
    it('fetches with search params', async () => {
        // @ts-expect-error: missing search params
        await assert.throws(() => mockMockApi.endpoints['/with-search-params'].fetch({}));

        await mockMockApi.endpoints['/with-search-params'].fetch({
            method: HttpMethod.Get,
            searchParams: {
                param1: ['hi'],
                param2: [
                    'a',
                    'b',
                    'c',
                ],
            },
        });
    });
    it('builds an endpoint URL', () => {
        assert.strictEquals(
            mockMockApi.endpoints['/with/:param1/:param2'].buildUrl({
                pathParams: {
                    param1: 'hi',
                    param2: 'bye',
                },
            }),
            'https://example.com/with/hi/bye',
        );
    });
    it('connects to a mock WebSocket', async () => {
        const webSocket = await mockMockApi.webSockets['/no-client-data'].connect();

        const replyPromise = webSocket.sendAndWaitForReply();

        await wait({
            milliseconds: 100,
        });

        webSocket.sendFromHost('ok');

        assert.strictEquals(await replyPromise, 'ok');
    });
    it('can connect to a web socket that requires search params', async () => {
        // @ts-expect-error: missing search params
        await assert.throws(() => mockMockApi.webSockets['/with-search-params'].connect({}));

        await mockMockApi.webSockets['/with-search-params'].connect({
            searchParams: {
                param1: ['hi'],
                param2: [
                    'a',
                    'b',
                    'c',
                ],
            },
        });
    });
});
