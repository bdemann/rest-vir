import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {type EmptyObject} from 'type-fest';
import {type ReplaceUndefined} from './types.js';

describe('ReplaceUndefined', () => {
    it('works', () => {
        assert
            .tsType<ReplaceUndefined<string | undefined, EmptyObject>>()
            .equals<string | EmptyObject>();
    });
});
