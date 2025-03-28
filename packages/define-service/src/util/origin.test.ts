import {describe, it, itCases} from '@augment-vir/test';
import {assertValidShape, defineShape} from 'object-shape-tester';
import {AnyOrigin, isAnyOrigin, originRequirementShape} from './origin.js';

describe(isAnyOrigin.name, () => {
    itCases(isAnyOrigin, [
        {
            it: 'works with a separate object',
            input: {
                anyOrigin: true,
            },
            expect: true,
        },
        {
            it: 'rejects a string',
            input: 'AnyOrigin',
            expect: false,
        },
    ]);
});

describe('originRequirementShape', () => {
    it('works on AnyOrigin', () => {
        assertValidShape(AnyOrigin, defineShape(originRequirementShape));
    });
    it('blocks a random object', () => {
        assertValidShape({hello: 'there'}, defineShape(originRequirementShape));
    });
});
