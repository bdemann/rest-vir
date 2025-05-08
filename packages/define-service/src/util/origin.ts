import {check} from '@augment-vir/assert';
import {type MaybePromise} from '@augment-vir/common';
import {classShape, defineShape, exact, or} from 'object-shape-tester';

/**
 * Explicity denotes that any origin is allowed. Use {@link isAnyOrigin} to check if something is
 * equal to this.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export const AnyOrigin = {
    anyOrigin: true,
};

/**
 * Checks if the input is equal to {@link AnyOrigin}.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export function isAnyOrigin(input: unknown): input is AnyOrigin {
    return check.jsonEquals(input, AnyOrigin);
}

/**
 * Type for {@link AnyOrigin}.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export type AnyOrigin = typeof AnyOrigin;

/**
 * Options explained:
 *
 * - `undefined`: when on an endpoint, this denotes that the endpoint defers origin checks to the
 *   parent service's origin requirement. When on the service, `undefined` is not allowed.
 * - `string`: require all request origins to exactly match the given string.
 * - `RegExp`: all request origins must match the RegExp.
 * - {@link AnyOrigin}: allow any origin.
 * - A function: allow custom checking. If this function returns something truthy, the origin is
 *   allowed.
 * - An array: a combination of `string` values, `RegExp` values, or functions to compare against. If
 *   any of the array entries allow a request origin, it passes.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export type OriginRequirement =
    | undefined
    | string
    | RegExp
    | AnyOrigin
    | (((origin: string | undefined) => MaybePromise<boolean>) | string | RegExp)[]
    | ((origin: string | undefined) => MaybePromise<boolean>);

/**
 * Shape definition for {@link OriginRequirement}.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export const originRequirementShape = defineShape(
    or(undefined, '', exact(AnyOrigin), classShape(RegExp), () => {}, [
        or('', exact(AnyOrigin), classShape(RegExp), () => {}),
    ]),
);

/**
 * - `boolean`: the origin was explicitly checked and passed (`true`) or failed (`false`)
 * - `undefined`: no origin checking occurred
 * - `AnyOrigin`: requirements explicitly allow any origin.
 */
export type OriginRequirementResult = boolean | undefined | AnyOrigin;

/**
 * Checks the given origin against the given origin requirement and determine if the origin matches.
 * See {@link OriginRequirementResult} for details on what each possible return value means.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export async function checkOriginRequirement(
    origin: string | undefined,
    originRequirement: OriginRequirement,
): Promise<OriginRequirementResult> {
    if (isAnyOrigin(originRequirement)) {
        /** Any origin has been explicitly allowed. */
        return AnyOrigin;
    } else if (originRequirement === undefined) {
        /** No checking occurred. */
        return undefined;
    } else if (!origin) {
        /** If there is an origin requirement but no origin then the origin automatically fails. */
        return false;
    } else if (check.isString(originRequirement)) {
        return origin === originRequirement;
    } else if (check.instanceOf(originRequirement, RegExp)) {
        return !!originRequirement.exec(origin);
    } else if (check.isArray(originRequirement)) {
        for (const requirement of originRequirement) {
            if (await checkOriginRequirement(origin, requirement)) {
                return true;
            }
        }
        return false;
    } else {
        return await originRequirement(origin);
    }
}

/**
 * Narrower version of {@link checkOriginRequirement} that simply returns `true` if the origin
 * matched or `false` otherwise.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export async function matchesOriginRequirement(
    origin: string | undefined,
    originRequirement: NonNullable<OriginRequirement>,
): Promise<boolean> {
    return !!(await checkOriginRequirement(origin, originRequirement));
}
