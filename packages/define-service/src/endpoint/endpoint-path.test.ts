import {assert} from '@augment-vir/assert';
import {describe, it, itCases} from '@augment-vir/test';
import {assertValidEndpointPath, type PathParams} from './endpoint-path.js';

describe('PathParams', () => {
    it('extracts named params', () => {
        assert.tsType<PathParams<'/my-path/:hello/something/:derp'>>().equals<{
            namedParams: 'hello' | 'derp';
            hasWildcard: false;
        }>();
    });
    it('extracts wildcard and named params', () => {
        assert.tsType<PathParams<'/my-path/:hello/something/:derp/*'>>().equals<{
            namedParams: 'hello' | 'derp';
            hasWildcard: true;
        }>();
    });
    it('extracts wildcard and no named params', () => {
        assert.tsType<PathParams<'/my-path/*'>>().equals<{
            namedParams: never;
            hasWildcard: true;
        }>();
    });
    it('extracts no named params', () => {
        assert.tsType<PathParams<'/my-path'>>().equals<{
            namedParams: never;
            hasWildcard: false;
        }>();
    });
});

describe(assertValidEndpointPath.name, () => {
    itCases(assertValidEndpointPath, [
        {
            it: 'matches the root path',
            input: '/',
            throws: undefined,
        },
        {
            it: 'matches a valid path',
            input: '/endpoint',
            throws: undefined,
        },
        {
            it: 'rejects missing leading slash',
            input: 'endpoint',
            throws: {
                matchMessage: 'Path does not start with /',
            },
        },
        {
            it: 'rejects trailing slash',
            input: '/endpoint/',
            throws: {
                matchMessage: 'Path cannot end with /',
            },
        },
    ]);
});
