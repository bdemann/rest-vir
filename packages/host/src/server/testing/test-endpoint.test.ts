import {assert} from '@augment-vir/assert';
import {HttpMethod, HttpStatus, omitObjectKeys} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {defineApi, defineEndpoint, headersToObject, restVirApiNameHeader} from '@rest-vir/api';
import {defineShape} from 'object-shape-tester';
import {implementApi} from '../../implementation/implement-api.js';
import {createApiImplementor} from '../../implementation/implementor.js';
import {testEndpoint} from './test-endpoint.js';

const emptyEndpoint = defineEndpoint({
    path: '/empty',
    requests: {
        [HttpMethod.Get]: {
            responses: {
                [HttpStatus.Accepted]: {
                    responseData: undefined,
                },
            },
        },
    },
});

const echoEndpoint = defineEndpoint({
    path: '/echo',
    requests: {
        [HttpMethod.Post]: {
            requestData: defineShape({
                somethingHere: '',
                testValue: 0,
            }),
            responses: {
                [HttpStatus.Accepted]: {
                    responseData: defineShape({
                        somethingHere: '',
                        testValue: 0,
                        result: 0,
                    }),
                },
            },
        },
    },
});

const throwsErrorEndpoint = defineEndpoint({
    path: '/throws-error',
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

const pathParamsEndpoint = defineEndpoint({
    path: '/with/:param1/:param2/*',
    requests: {
        [HttpMethod.Get]: {
            responses: {
                [HttpStatus.Ok]: {
                    responseData: defineShape({
                        param1: '',
                        param2: '',
                        wildcard: '',
                    }),
                },
            },
        },
    },
});

const api = defineApi({
    apiName: 'testEndpoint helper api',
    endpoints: [
        emptyEndpoint,
        echoEndpoint,
        throwsErrorEndpoint,
        pathParamsEndpoint,
    ],
    webSockets: [],
});

const implementor = createApiImplementor<undefined>()(api);

const emptyImplementation = implementor.implementEndpoint(emptyEndpoint, {
    [HttpMethod.Get]() {
        return {
            [HttpStatus.Accepted]: {
                responseData: undefined,
            },
        };
    },
});

const echoImplementation = implementor.implementEndpoint(echoEndpoint, {
    [HttpMethod.Post]({requestData}) {
        return {
            [HttpStatus.Accepted]: {
                responseData: {
                    somethingHere: requestData.somethingHere,
                    testValue: requestData.testValue,
                    result: requestData.testValue + 5,
                },
            },
        };
    },
});

const throwsErrorImplementation = implementor.implementEndpoint(throwsErrorEndpoint, {
    [HttpMethod.Get]() {
        throw new Error('Intentional error.');
    },
});

const pathParamsImplementation = implementor.implementEndpoint(pathParamsEndpoint, {
    [HttpMethod.Get]({request}) {
        const url = new URL(request.url, 'http://localhost');
        const segments = url.pathname.split('/').filter(Boolean);
        const wildcard = segments.slice(3).join('/');
        return {
            [HttpStatus.Ok]: {
                responseData: {
                    param1: segments[1] ?? '',
                    param2: segments[2] ?? '',
                    wildcard,
                },
            },
        };
    },
});

type StrictHostContext = {
    prefix: string;
};

const strictContextImplementor = createApiImplementor<StrictHostContext>()(api);

const strictContextImplementation = strictContextImplementor.implementEndpoint(emptyEndpoint, {
    [HttpMethod.Get]({context}) {
        assert.strictEquals(context.prefix, 'strict');

        return {
            [HttpStatus.Accepted]: {
                responseData: undefined,
            },
        };
    },
});

function createTestHostContext() {
    return {
        context: undefined,
    };
}

function createStrictHostContext() {
    return {
        context: {
            prefix: 'strict',
        },
    };
}

function assertTestEndpointTypes() {
    void testEndpoint(strictContextImplementation, HttpMethod.Get, createStrictHostContext);

    void testEndpoint(
        strictContextImplementation,
        HttpMethod.Get,
        // @ts-expect-error: createHostContext must match the endpoint implementation context.
        createTestHostContext,
    );

    void testEndpoint(echoImplementation, HttpMethod.Post, createTestHostContext, {
        requestData: {
            somethingHere: 'hi',
            // @ts-expect-error: request data must match the endpoint's requestData shape.
            testValue: 'wrong',
        },
    });

    void testEndpoint(pathParamsImplementation, HttpMethod.Get, createTestHostContext, {
        pathParams: {
            param1: 'hi',
            param2: 'bye',
            // @ts-expect-error: path params must match the endpoint path.
            wrongParam: 'wild',
        },
    });
}

implementApi<undefined>()(api, {
    createHostContext: createTestHostContext,
    clientOriginRequirement: {
        anyOrigin: true,
    },
    endpoints: [
        emptyImplementation,
        echoImplementation,
        throwsErrorImplementation,
        pathParamsImplementation,
    ],
});

describe(testEndpoint.name, () => {
    it('has type checks', () => {
        assert.isDefined(assertTestEndpointTypes);
    });

    it('tests a basic endpoint', async () => {
        const response = await testEndpoint(
            emptyImplementation,
            HttpMethod.Get,
            createTestHostContext,
        );

        assert.strictEquals(response.status, HttpStatus.Accepted);

        assert.deepEquals(omitObjectKeys(headersToObject(response.headers), ['date']), {
            'access-control-allow-origin': '*',
            'access-control-expose-headers': restVirApiNameHeader,
            connection: 'keep-alive',
            'content-length': '0',
            'rest-vir-api': 'endpoint-test-/empty',
        });
    });

    it('tests a failed response', async () => {
        const response = await testEndpoint(
            echoImplementation,
            HttpMethod.Post,
            createTestHostContext,
            // @ts-expect-error: params are required for the request body
            {},
        );

        assert.strictEquals(response.status, HttpStatus.BadRequest);
    });

    it('fails a wrong method', async () => {
        await assert.throws(
            () =>
                testEndpoint(
                    echoImplementation,
                    // @ts-expect-error: incorrect method
                    HttpMethod.Get,
                    createTestHostContext,
                    {
                        requestData: {
                            somethingHere: 'hi',
                            testValue: -1,
                        },
                    },
                ),
            {
                matchMessage: "Method 'GET' does not exist on endpoint '/echo'",
            },
        );
    });

    it('requires path params', async () => {
        await assert.throws(
            () =>
                testEndpoint(
                    pathParamsImplementation,
                    HttpMethod.Get,
                    createTestHostContext,
                    // @ts-expect-error: this endpoint is missing its path params
                    {},
                ),
            {
                matchMessage: 'Missing value for path param',
            },
        );
    });

    it('requires wildcard', async () => {
        await assert.throws(
            () =>
                testEndpoint(pathParamsImplementation, HttpMethod.Get, createTestHostContext, {
                    // @ts-expect-error: this endpoint is missing its wildcard
                    pathParams: {
                        param1: 'hi',
                        param2: 'bye',
                    },
                }),
            {
                matchMessage: 'Missing value for wildcard param',
            },
        );
    });
    it('allows wildcard', async () => {
        const response = await testEndpoint(
            pathParamsImplementation,
            HttpMethod.Get,
            createTestHostContext,
            {
                pathParams: {
                    param1: 'hi',
                    param2: 'bye',
                    wildcard: 'wild',
                },
            },
        );

        assert.strictEquals(response.status, HttpStatus.Ok);
    });

    it('handles an internal error', async () => {
        const response = await testEndpoint(
            throwsErrorImplementation,
            HttpMethod.Get,
            createTestHostContext,
        );

        assert.strictEquals(response.status, HttpStatus.InternalServerError);
    });

    it('tests a post request', async () => {
        const response = await testEndpoint(
            echoImplementation,
            HttpMethod.Post,
            createTestHostContext,
            {
                requestData: {
                    somethingHere: 'hi',
                    testValue: -1,
                },
            },
        );

        assert.deepEquals(omitObjectKeys(headersToObject(response.headers), ['date']), {
            'access-control-allow-origin': '*',
            'access-control-expose-headers': restVirApiNameHeader,
            connection: 'keep-alive',
            'content-length': '48',
            'content-type': 'application/json; charset=utf-8',
            'rest-vir-api': 'endpoint-test-/echo',
        });

        assert.strictEquals(response.status, HttpStatus.Accepted);

        assert.deepEquals(
            await response.text(),
            JSON.stringify({
                somethingHere: 'hi',
                testValue: -1,
                result: 4,
            }),
        );
    });

    it('handles wildcard path params', async () => {
        const response = await testEndpoint(
            pathParamsImplementation,
            HttpMethod.Get,
            createTestHostContext,
            {
                pathParams: {
                    param1: 'hi',
                    param2: 'bye',
                    wildcard: 'yo',
                },
            },
        );

        assert.strictEquals(response.status, HttpStatus.Ok);
        assert.deepEquals(await response.json(), {
            param1: 'hi',
            param2: 'bye',
            wildcard: 'yo',
        });
    });
});
