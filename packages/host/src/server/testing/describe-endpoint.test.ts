import {describe, it} from '@augment-vir/test';
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
        }

        return {
            [HttpStatus.Ok]: {
                responseData: {
                    hidden: 'not selected',
                    itemId,
                    prefix: context.prefix,
                },
            },
        };
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
            after() {
                return 'suite after';
            },
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
                    afterResult: 'suite after',
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
                    afterResult: 'suite after',
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
                it: 'supports callback inputs and case-level after overrides',
                createHostContext() {
                    return {
                        context: {
                            prefix: 'case',
                        },
                    };
                },
                after() {
                    return 'case after';
                },
                input() {
                    return {
                        pathParams: {
                            itemId: 'item-2',
                        },
                    };
                },
                expect: {
                    afterResult: 'case after',
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
                    afterResult: 'suite after',
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
