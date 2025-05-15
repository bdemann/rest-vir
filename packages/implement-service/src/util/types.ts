/* node:coverage disable: this whole file is just types */

import {type EmptyObject} from 'type-fest';

/**
 * Removes `undefined` unions from the given type and replaces it with `EmptyObject`. This is used
 * specifically for SearchParamsType.
 *
 * @category Internal
 * @category Package : @rest-vir/implement-service
 * @package [`@rest-vir/implement-service`](https://www.npmjs.com/package/@rest-vir/implement-service)
 */
export type ReplaceUndefinedWithEmptyObject<T> = T extends undefined
    ? Exclude<T, undefined> | EmptyObject
    : T;
