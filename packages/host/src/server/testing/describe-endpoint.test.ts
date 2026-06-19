import {assert} from '@augment-vir/assert';
import {describe, extractTestName, it} from '@augment-vir/test';
import {defineApi, defineEndpoint, HttpMethod, HttpStatus} from '@rest-vir/api';
import {defineShape} from 'object-shape-tester';
import {createApiImplementor} from '../../implementation/implementor.js';
import {describeEndpoint} from './describe-endpoint.js';

type TestHostContext = {
    prefix: string;
};

const itemEndpoint = defineEndpoint({
    path: '/items/:itemId',
    requests: {
        [HttpMethod.Get]: {
            responses: {
                [HttpStatus.Ok]: {
                    responseData: defineShape({
                        hidden: '',
                        itemId: '',
                        prefix: '',
                    }),
                },
                [HttpStatus.NotFound]: {
                    responseData: defineShape({
                        missingId: '',
                    }),
                },
            },
        },
        [HttpMethod.Delete]: {
            responses: {
                [HttpStatus.NoContent]: {
                    responseData: undefined,
                },
            },
        },
    },
});

const testApiDefinition = defineApi({
    apiName: 'describeEndpoint helper api',
    endpoints: [
        itemEndpoint,
    ],
});

const implementor = createApiImplementor<TestHostContext>()(testApiDefinition);

const itemEndpointImplementation = implementor.implementEndpoint(itemEndpoint, {
    [HttpMethod.Get]({context, request}) {
        const itemId = (request.params satisfies unknown as Readonly<{itemId: string}>).itemId;

        if (itemId === 'missing') {
            return {
                [HttpStatus.NotFound]: {
                    responseData: {
                        missingId: itemId,
                    },
                },
            };
        } else if (itemId === 'unauthorized') {
            return {
                [HttpStatus.Unauthorized]: {
                    responseData: 'not allowed',
                },
            };
        } else if (itemId === 'forbidden') {
            return {
                [HttpStatus.Forbidden]: {
                    responseData: undefined,
                },
            };
        } else if (itemId === 'with-header') {
            return {
                [HttpStatus.Ok]: {
                    headers: {
                        'x-test-header': 'present',
                    },
                    responseData: {
                        hidden: 'not selected',
                        itemId,
                        prefix: context.prefix,
                    },
                },
            };
        } else {
            return {
                [HttpStatus.Ok]: {
                    responseData: {
                        hidden: 'not selected',
                        itemId,
                        prefix: context.prefix,
                    },
                },
            };
        }
    },
    [HttpMethod.Delete]() {
        return {
            [HttpStatus.NoContent]: {
                responseData: undefined,
            },
        };
    },
});

function createTestHostContext() {
    return {
        context: {
            prefix: 'suite',
        },
    };
}

describe(describeEndpoint.name, () => {
    it('requires the correct host context', () => {
        () => {
            describeEndpoint(itemEndpointImplementation, ({endpointCases}) => {
                endpointCases.GET(
                    {
                        // @ts-expect-error: intentionally incorrect host context return type
                        createHostContext() {
                            return {
                                context: {
                                    wrong: 'context',
                                },
                            };
                        },
                    },
                    [
                        {
                            it: 'stuff',
                            input: {
                                pathParams: {
                                    itemId: 'hi',
                                },
                            },
                            expect: {
                                result: {
                                    Ok: {
                                        status: HttpStatus.Ok,
                                        headers: {},
                                        responseData: {
                                            hidden: '',
                                            itemId: '',
                                            prefix: '',
                                        },
                                    },
                                },
                            },
                        },
                    ],
                );
            });
        };
    });
    it('requires createHostContext', () => {
        () => {
            describeEndpoint(itemEndpointImplementation, ({endpointCases}) => {
                endpointCases.GET(
                    // @ts-expect-error: intentionally missing createHostContext
                    {},
                    [],
                );
            });
        };
    });
});

describeEndpoint(itemEndpointImplementation, ({endpointCases}) => {
    endpointCases.GET(
        {
            createHostContext: createTestHostContext,
        },
        [
            {
                it: 'selects an ok response body',
                input: {
                    pathParams: {
                        itemId: 'item-1',
                    },
                },
                expect: {
                    result: {
                        Ok: {
                            status: HttpStatus.Ok,
                            headers: {},
                            responseData: {
                                hidden: 'not selected',
                                itemId: 'item-1',
                                prefix: 'suite',
                            },
                        },
                    },
                },
            },
            {
                it: 'supports case-level createHostContext overrides',
                createHostContext() {
                    return {
                        context: {
                            prefix: 'case object',
                        },
                    };
                },
                input: {
                    pathParams: {
                        itemId: 'item-2',
                    },
                },
                expect: {
                    result: {
                        Ok: {
                            status: HttpStatus.Ok,
                            headers: {},
                            responseData: {
                                hidden: 'not selected',
                                itemId: 'item-2',
                                prefix: 'case object',
                            },
                        },
                    },
                },
            },
            {
                it: 'supports callback inputs',
                createHostContext() {
                    return {
                        context: {
                            prefix: 'case',
                        },
                    };
                },
                input() {
                    return {
                        pathParams: {
                            itemId: 'item-2',
                        },
                    };
                },
                expect: {
                    result: {
                        Ok: {
                            status: HttpStatus.Ok,
                            headers: {},
                            responseData: {
                                hidden: 'not selected',
                                itemId: 'item-2',
                                prefix: 'case',
                            },
                        },
                    },
                },
            },
            {
                it: 'returns custom response headers',
                input: {
                    pathParams: {
                        itemId: 'with-header',
                    },
                },
                expect: {
                    result: {
                        Ok: {
                            status: HttpStatus.Ok,
                            headers: {
                                'x-test-header': 'present',
                            },
                            responseData: {
                                hidden: 'not selected',
                                itemId: 'with-header',
                                prefix: 'suite',
                            },
                        },
                    },
                },
            },
        ],
    );

    endpointCases[HttpMethod.Get](
        {
            createHostContext: createTestHostContext,
        },
        [
            {
                it: 'returns declared error responses',
                input: {
                    pathParams: {
                        itemId: 'missing',
                    },
                },
                expect: {
                    result: {
                        NotFound: {
                            status: HttpStatus.NotFound,
                            headers: {},
                            responseData: {
                                missingId: 'missing',
                            },
                        },
                    },
                },
            },
            {
                it: 'returns unexpected error responses with string bodies',
                input: {
                    pathParams: {
                        itemId: 'unauthorized',
                    },
                },
                expect: {
                    result: {
                        unexpectedError: {
                            status: HttpStatus.Unauthorized,
                            headers: {},
                            responseData: 'not allowed',
                        },
                    },
                },
            },
            {
                it: 'returns unexpected error responses with empty bodies',
                input: {
                    pathParams: {
                        itemId: 'forbidden',
                    },
                },
                expect: {
                    result: {
                        unexpectedError: {
                            status: HttpStatus.Forbidden,
                            headers: {},
                            responseData: undefined,
                        },
                    },
                },
            },
        ],
    );

    endpointCases[HttpMethod.Delete](
        {
            createHostContext: createTestHostContext,
        },
        [
            {
                it: 'supports empty responses',
                input: {
                    pathParams: {
                        itemId: 'item-1',
                    },
                },
                expect: {
                    result: {
                        NoContent: {
                            status: HttpStatus.NoContent,
                            headers: {},
                            responseData: undefined,
                        },
                    },
                },
            },
        ],
    );
});

describeEndpoint(itemEndpointImplementation, ({endpointCases}) => {
    endpointCases.GET(
        {
            createTestParams({testContext}) {
                return {
                    prefix: extractTestName(testContext),
                };
            },
            createHostContext({testParams}) {
                return {
                    context: {
                        prefix: testParams.prefix,
                    },
                };
            },
            assembleResult({result, testParams}) {
                const okResult = 'Ok' in result ? result.Ok : undefined;

                return {
                    /**
                     * `input` selected this `itemId` only because it received a truthy
                     * `testParams`.
                     */
                    inputReceivedTestParams: okResult?.responseData.itemId === 'item-ok',
                    /** `prefix` flows `createTestParams` -> `createHostContext` -> response. */
                    contextPrefixMatchesTestParams:
                        okResult?.responseData.prefix === testParams.prefix,
                };
            },
        },
        [
            {
                it: 'threads testParams through createHostContext, input, and assembleResult',
                input({testParams}) {
                    return {
                        pathParams: {
                            itemId: testParams.prefix ? 'item-ok' : 'missing',
                        },
                    };
                },
                expect: {
                    inputReceivedTestParams: true,
                    contextPrefixMatchesTestParams: true,
                },
            },
        ],
    );
});

describeEndpoint(itemEndpointImplementation, ({endpointCases}) => {
    endpointCases.GET<{prefix: string}>(
        {
            createTestParams() {
                return {
                    prefix: 'teardown',
                };
            },
            createHostContext({testParams}) {
                return {
                    context: {
                        prefix: testParams.prefix,
                    },
                };
            },
            teardown({testParams, hostContext}) {
                /** A failure here throws from the tester's `finally`, failing the case. */
                assert.deepEquals(testParams, {
                    prefix: 'teardown',
                });
                assert.deepEquals(hostContext, {
                    prefix: 'teardown',
                });
            },
        },
        [
            {
                it: 'runs teardown with testParams and the created host context',
                input: {
                    pathParams: {
                        itemId: 'item-1',
                    },
                },
                expect: {
                    result: {
                        Ok: {
                            status: HttpStatus.Ok,
                            headers: {},
                            responseData: {
                                hidden: 'not selected',
                                itemId: 'item-1',
                                prefix: 'teardown',
                            },
                        },
                    },
                },
            },
        ],
    );
});
