/* node:coverage disable: this whole file is just types */

/**
 * Removes `undefined` unions from the given type and replaces it with `Replace`.
 *
 * @category Internal
 * @category Package : @rest-vir/implement-service
 * @package [`@rest-vir/implement-service`](https://www.npmjs.com/package/@rest-vir/implement-service)
 */
export type ReplaceUndefined<T, Replace> = T extends undefined
    ? Exclude<T, undefined> | Replace
    : T;
