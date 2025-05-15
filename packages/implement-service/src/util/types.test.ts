import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {type EmptyObject} from 'type-fest';
import {type ReplaceUndefinedWithEmptyObject} from './types.js';

describe('ReplaceUndefinedWithEmptyObject', () => {
    it('works', () => {
        assert
            .tsType<ReplaceUndefinedWithEmptyObject<string | undefined>>()
            .equals<string | EmptyObject>();
    });
});
