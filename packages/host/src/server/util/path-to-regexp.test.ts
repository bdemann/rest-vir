import {describe, itCases} from '@augment-vir/test';
import {match} from './path-to-regexp.js';

describe(match.name, () => {
    function testMatch({path, matchAgainst}: {path: string; matchAgainst: string}) {
        return !!match(path)(matchAgainst);
    }

    itCases(testMatch, [
        {
            it: 'matches a plain path',
            input: {
                path: '/hi/bye',
                matchAgainst: '/hi/bye',
            },
            expect: true,
        },
        {
            it: 'rejects a plain path mismatch',
            input: {
                path: '/hi/bye',
                matchAgainst: '/hi/bye2',
            },
            expect: false,
        },
        {
            it: 'matches a parameterized path',
            input: {
                path: '/hi/:param1/:param2',
                matchAgainst: '/hi/bye/see',
            },
            expect: true,
        },
        {
            it: 'matches an unnamed wildcard path',
            input: {
                path: '/hi/*',
                matchAgainst: '/hi/bye/see',
            },
            expect: true,
        },
        {
            /**
             * While this works, the server will fail to start with such an endpoint definition
             * with:
             *
             * > Wildcard must be the last character in the route
             */
            it: 'matches an unnamed wildcard in the middle',
            input: {
                path: '/hi/*/again',
                matchAgainst: '/hi/bye/again',
            },
            expect: true,
        },
        {
            it: 'rejects an invalid parameterized path',
            input: {
                path: '/hi/:param1/:param2',
                matchAgainst: '/hi/bye/see/you',
            },
            expect: false,
        },
    ]);
});
