import {describe, itCases} from '@augment-vir/test';
import {defineShape, nonEmptyStringShape} from 'object-shape-tester';
import {formDataShape, isFormDataShape} from './custom-shapes.js';

describe(isFormDataShape.name, () => {
    itCases(isFormDataShape, [
        {
            it: 'passes on a shape definition',
            input: defineShape(formDataShape()),
            expect: true,
        },
        {
            it: 'passes on form data shape',
            input: formDataShape(),
            expect: true,
        },
        {
            it: 'rejects a different custom shape',
            input: nonEmptyStringShape,
            expect: false,
        },
        {
            it: 'rejects a wrapped different custom shape',
            input: defineShape(nonEmptyStringShape),
            expect: false,
        },
        {
            it: 'rejects a different shape',
            input: defineShape({}),
            expect: false,
        },
        {
            it: 'rejects a plain object',
            input: {},
            expect: false,
        },
    ]);
});
