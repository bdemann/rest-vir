import {describe, itCases} from '@augment-vir/test';
import {
    consolidateHeaders,
    headersToObject,
    mergeHeaders,
    type AllowedHeaders,
} from './merge-headers.js';

describe(mergeHeaders.name, () => {
    function testMergeHeaders(...headers: AllowedHeaders[]) {
        return headersToObject(mergeHeaders(...headers));
    }

    itCases(testMergeHeaders, [
        {
            it: 'passes a single object',
            inputs: [
                {
                    origin: 'hi',
                },
            ],
            expect: {
                origin: 'hi',
            },
        },
        {
            it: 'merges multiple object headers',
            inputs: [
                {foo: 'bar'},
                {baz: 'qux'},
            ],
            expect: {
                foo: 'bar',
                baz: 'qux',
            },
        },
        {
            it: 'accepts a Headers instance (HeadersInit)',
            inputs: [
                new Headers([
                    [
                        'x-test',
                        '1',
                    ],
                ]),
            ],
            expect: {
                'x-test': '1',
            },
        },
        {
            it: 'accepts string[][] (HeadersInit array)',
            inputs: [
                [
                    [
                        'alpha',
                        'a',
                    ],
                    [
                        'beta',
                        'b',
                    ],
                ],
            ],
            expect: {
                alpha: 'a',
                beta: 'b',
            },
        },
        {
            it: 'accepts Record<string, string[]> and joins values',
            inputs: [
                {
                    'set-cookie': [
                        'a=b',
                        'c=d',
                    ],
                },
            ],
            expect: {
                'set-cookie': [
                    'a=b',
                    'c=d',
                ],
            },
        },
        {
            it: 'accepts [string, string[]][] and joins values',
            inputs: [
                [
                    [
                        'accept',
                        [
                            'x',
                            'y',
                        ],
                    ],
                    [
                        'vary',
                        ['a'],
                    ],
                ] as unknown as AllowedHeaders,
            ],
            expect: {
                accept: 'x, y',
                vary: 'a',
            },
        },
        {
            it: 'accepts IncomingHttpHeaders-like object (string and string[])',
            inputs: [
                {
                    'content-type': 'text/plain',
                    'set-cookie': [
                        'e=f',
                        'g=h',
                    ],
                } as unknown as AllowedHeaders,
            ],
            expect: {
                'content-type': 'text/plain',
                'set-cookie': [
                    'e=f',
                    'g=h',
                ],
            },
        },
        {
            it: 'accepts OutgoingHttpHeaders-like object (number values become strings)',
            inputs: [
                {
                    'content-length': 123,
                    'x-num': 42,
                } as unknown as AllowedHeaders,
            ],
            expect: {
                'content-length': '123',
                'x-num': '42',
            },
        },
        {
            it: 'merges across different input types',
            inputs: [
                new Headers([
                    [
                        'multi',
                        'first',
                    ],
                ]),
                {multi: 'second'},
            ],
            expect: {
                multi: 'first, second',
            },
        },
    ]);
});

describe(consolidateHeaders.name, () => {
    function testConsolidateHeaders(headers: AllowedHeaders) {
        return headersToObject(consolidateHeaders(headers));
    }

    itCases(testConsolidateHeaders, [
        {
            it: 'handles undefined values',
            input: {
                header1: undefined,
                header2: 'hi',
            },
            expect: {
                header2: 'hi',
            },
        },
    ]);
});

describe(headersToObject.name, () => {
    itCases(headersToObject, [
        {
            it: 'handles duplicate header names in arrays',
            input: [
                [
                    'header1',
                    'hi',
                ],
                [
                    'set-cookie',
                    'bye1',
                ],
                [
                    'set-cookie',
                    'bye2',
                ],
                [
                    'set-cookie',
                    'bye3',
                ],
            ],
            expect: {
                header1: 'hi',
                'set-cookie': [
                    'bye1',
                    'bye2',
                    'bye3',
                ],
            },
        },
    ]);
});
