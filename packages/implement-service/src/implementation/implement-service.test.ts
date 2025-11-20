import {assert} from '@augment-vir/assert';
import {HttpStatus} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {AnyOrigin, type BaseSearchParams, defineService} from '@rest-vir/define-service';
import {mockService} from '@rest-vir/define-service/src/service/define-service.mock.js';
import {unionShape} from 'object-shape-tester';
import {
    type EndpointImplementationOutput,
    type EndpointImplementationParams,
} from './implement-endpoint.js';
import {implementService} from './implement-service.js';
import {mockServiceImplementation} from './implement-service.mock.js';
import {type ContextInitOutput} from './service-context-init.js';

describe(implementService.name, () => {
    it('allows a separate function to be assigned to an endpoint implementation', () => {
        type Context = {
            value: string;
        };
        const service = defineService({
            endpoints: {
                '/test': {
                    methods: {
                        GET: true,
                    },
                    requestDataShape: {
                        a: -1,
                        b: unionShape(undefined, ''),
                    },
                    responseDataShape: undefined,
                },
                '/test2': {
                    methods: {
                        GET: true,
                    },
                    requestDataShape: {
                        a: -1,
                        b: unionShape(undefined, ''),
                    },
                    responseDataShape: undefined,
                },
            },
            requiredClientOrigin: AnyOrigin,
            serviceName: 'test',
            serviceOrigin: '',
        });

        type Service = typeof service;

        function testEndpoint({
            context,
            requestData,
        }: EndpointImplementationParams<
            Context,
            Service['endpoints']['/test']
        >): EndpointImplementationOutput<Service['endpoints']['/test']['ResponseType']> {
            assert.tsType(context).equals<Context>();
            assert.tsType<typeof requestData>().equals<{
                a: number;
                b: string | undefined;
            }>();

            return {
                statusCode: HttpStatus.Ok,
                responseData: undefined,
            };
        }

        const implementedService = implementService({
            service,
            createContext: async ({endpointDefinition}): Promise<ContextInitOutput<Context>> => {
                if (!endpointDefinition) {
                    return {
                        reject: {
                            statusCode: HttpStatus.NotFound,
                        },
                    };
                }
                return await Promise.resolve({
                    context: {
                        value: 'hi',
                    },
                });
            },
        })({
            endpoints: {
                '/test': testEndpoint,
                '/test2'({requestData, context}) {
                    assert.tsType(context).equals<Context>();
                    assert.tsType<typeof requestData>().equals<{
                        a: number;
                        b: string | undefined;
                    }>();

                    return {
                        statusCode: HttpStatus.Ok,
                        responseData: undefined,
                    };
                },
            },
        });

        assert.tsType<typeof implementedService.ContextType>().equals<Context>;
    });
    it('handles shape definitions', () => {
        implementService({
            createContext() {
                return {
                    context: 'hi',
                };
            },
            service: defineService({
                endpoints: {
                    '/test': {
                        methods: {
                            GET: true,
                        },
                        requestDataShape: {
                            a: -1,
                            b: unionShape(undefined, ''),
                        },
                        responseDataShape: undefined,
                    },
                },
                requiredClientOrigin: AnyOrigin,
                serviceName: 'test',
                serviceOrigin: '',
            }),
        })({
            endpoints: {
                '/test'({requestData}) {
                    assert.tsType<typeof requestData>().equals<{
                        a: number;
                        b: string | undefined;
                    }>();

                    return {
                        statusCode: HttpStatus.Ok,
                        responseData: undefined,
                    };
                },
            },
        });
    });
    it('rejects accessing ContextType at runtime', () => {
        assert.throws(() => mockServiceImplementation.ContextType);
    });
    it('preserves custom headers', () => {
        const mockCustomHeaders = ['hi'];
        const service = implementService({
            customHeaders: mockCustomHeaders,
            createContext() {
                return {
                    context: 'hi',
                };
            },
            service: defineService({
                requiredClientOrigin: AnyOrigin,
                serviceName: 'test',
                serviceOrigin: '',
            }),
        })({});

        assert.deepEquals(service.customHeaders, mockCustomHeaders);
    });
    it('blocks non-function endpoint implementations', () => {
        assert.throws(() =>
            implementService({
                service: defineService({
                    endpoints: {
                        '/test': {
                            methods: {
                                GET: true,
                            },
                            requestDataShape: undefined,
                            responseDataShape: undefined,
                        },
                    },
                    requiredClientOrigin: AnyOrigin,
                    serviceName: 'test',
                    serviceOrigin: '',
                }),

                createContext() {
                    return {
                        context: 'hi',
                    };
                },
            })({
                endpoints: {
                    // @ts-expect-error: this should be a function
                    '/test': 'hi',
                },
            }),
        );
    });
    it('blocks extra endpoint implementations', () => {
        assert.throws(() =>
            implementService({
                service: defineService({
                    endpoints: {
                        '/test': {
                            methods: {
                                GET: true,
                            },
                            requestDataShape: undefined,
                            responseDataShape: undefined,
                        },
                    },
                    requiredClientOrigin: AnyOrigin,
                    serviceName: 'test',
                    serviceOrigin: '',
                }),
                createContext() {
                    return {
                        context: 'hi',
                    };
                },
            })({
                endpoints: {
                    '/test'() {
                        return {
                            statusCode: HttpStatus.Ok,
                            responseData: undefined,
                        };
                    },
                    // @ts-expect-error: this endpoint is not part of the definition
                    '/test2'() {
                        return {
                            statusCode: HttpStatus.Ok,
                            responseData: undefined,
                        };
                    },
                },
            }),
        );
    });
    it('includes search params in context', () => {
        implementService({
            service: mockService,
            createContext({searchParams}) {
                assert.tsType(searchParams).equals<
                    | {
                          param1: [string];
                          param2: string[];
                      }
                    | BaseSearchParams
                >();

                searchParams;

                return {
                    context: 'hi',
                };
            },
        });
    });
    it('blocks endpoint with incorrect status code return', () => {
        implementService({
            service: defineService({
                endpoints: {
                    '/test': {
                        methods: {
                            GET: true,
                        },
                        requestDataShape: undefined,
                        responseDataShape: undefined,
                    },
                },
                requiredClientOrigin: AnyOrigin,
                serviceName: 'test',
                serviceOrigin: '',
            }),
        })({
            endpoints: {
                // @ts-expect-error: this endpoint does not return a status code
                '/test'() {
                    return {
                        statuscode: HttpStatus.Unauthorized,
                    };
                },
            },
        });
    });
    it('does not require response data output when it is undefined', () => {
        implementService({
            service: defineService({
                endpoints: {
                    '/test': {
                        methods: {
                            GET: true,
                        },
                        requestDataShape: undefined,
                        responseDataShape: undefined,
                    },
                },
                requiredClientOrigin: AnyOrigin,
                serviceName: 'test',
                serviceOrigin: '',
            }),
            createContext() {
                return {
                    context: 'hi',
                };
            },
        })({
            endpoints: {
                '/test'() {
                    return {
                        statusCode: HttpStatus.Ok,
                    };
                },
            },
        });
    });
    it('requires response data', () => {
        implementService({
            service: defineService({
                endpoints: {
                    '/test': {
                        methods: {
                            GET: true,
                        },
                        requestDataShape: undefined,
                        responseDataShape: {
                            data: '',
                        },
                    },
                },
                requiredClientOrigin: AnyOrigin,
                serviceName: 'test',
                serviceOrigin: '',
            }),
            createContext() {
                return {
                    context: 'hi',
                };
            },
        })({
            endpoints: {
                // @ts-expect-error: missing response data
                '/test'() {
                    return {
                        statusCode: HttpStatus.Ok,
                    };
                },
            },
        });
    });
    it('requires endpoints to be implemented', () => {
        assert.throws(() =>
            implementService({
                service: defineService({
                    endpoints: {
                        '/test': {
                            methods: {
                                GET: true,
                            },
                            requestDataShape: undefined,
                            responseDataShape: undefined,
                        },
                    },
                    requiredClientOrigin: AnyOrigin,
                    serviceName: 'test',
                    serviceOrigin: '',
                }),
                createContext() {
                    return {
                        context: 'hi',
                    };
                },
            })(
                // @ts-expect-error: endpoints implementations are missing
                {},
            ),
        );
    });
    it('requires WebSocket to be implemented', () => {
        assert.throws(() =>
            implementService({
                service: defineService({
                    webSockets: {
                        '/test': {
                            messageFromHostShape: undefined,
                            messageFromClientShape: undefined,
                        },
                    },
                    requiredClientOrigin: AnyOrigin,
                    serviceName: 'test',
                    serviceOrigin: '',
                }),
                createContext() {
                    return {
                        context: 'hi',
                    };
                },
            })(
                // @ts-expect-error: WebSocket implementations are missing
                {},
            ),
        );
    });
    it('implements WebSockets', () => {
        implementService({
            service: defineService({
                webSockets: {
                    '/test': {
                        messageFromHostShape: undefined,
                        messageFromClientShape: undefined,
                    },
                },
                requiredClientOrigin: AnyOrigin,
                serviceName: 'test',
                serviceOrigin: '',
            }),
            createContext() {
                return {
                    context: 'hi',
                };
            },
        })({
            webSockets: {
                '/test': {},
            },
        });
    });
    it('rejects a non function WebSocket listener', () => {
        assert.throws(
            () =>
                implementService({
                    service: defineService({
                        webSockets: {
                            '/test': {
                                messageFromHostShape: undefined,
                                messageFromClientShape: undefined,
                            },
                        },
                        requiredClientOrigin: AnyOrigin,
                        serviceName: 'test',
                        serviceOrigin: '',
                    }),
                    createContext() {
                        return {
                            context: 'hi',
                        };
                    },
                })({
                    webSockets: {
                        '/test': {
                            // @ts-expect-error: this should be a function
                            close: 'hi',
                        },
                    },
                }),
            {
                matchMessage: 'implementations are not functions for',
            },
        );
    });
    it('rejects extra WebSocket implementations', () => {
        assert.throws(
            () =>
                implementService({
                    service: defineService({
                        webSockets: {
                            '/test': {
                                messageFromHostShape: undefined,
                                messageFromClientShape: undefined,
                            },
                        },
                        requiredClientOrigin: AnyOrigin,
                        serviceName: 'test',
                        serviceOrigin: '',
                    }),
                    createContext() {
                        return {
                            context: 'hi',
                        };
                    },
                })({
                    webSockets: {
                        '/test': {},
                        // @ts-expect-error: this is an unexpected WebSocket path
                        '/fake': {},
                    },
                }),
            {
                matchMessage: 'implementations have extra paths',
            },
        );
    });
});
