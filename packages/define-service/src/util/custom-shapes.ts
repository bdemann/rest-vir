import {customShape, isCustomSpecifier, isShapeDefinition} from 'object-shape-tester';

/**
 * A custom shape definition for requests that require `FormData` as the body.
 *
 * @category Define Service
 * @category Package : @rest-vir/define-service
 * @example
 *
 * ```ts
 * import {defineService, formDataShape, AnyOrigin, HttpMethod} from '@rest-vir/define-shape';
 *
 * export const myService = defineService({
 *     serviceName: 'my-service',
 *     serviceOrigin: 'https://example.com',
 *     requiredClientOrigin: AnyOrigin,
 *     endpoints: {
 *         '/my-endpoint': {
 *             methods: {
 *                 [HttpMethod.Post]: true,
 *             },
 *             requestDataShape: formDataShape,
 *             responseDataShape: undefined,
 *         },
 *     },
 * });
 * ```
 *
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export const formDataShape = customShape<FormData>({
    customName: 'FormData',
    checker(value) {
        return value instanceof FormData;
    },
    defaultValue: new FormData(),
});

/**
 * Check if the input is a shape definition for {@link formDataShape}.
 *
 * @category Internal
 * @category Package : @rest-vir/define-service
 * @package [`@rest-vir/define-service`](https://www.npmjs.com/package/@rest-vir/define-service)
 */
export function isFormDataShape(shape: unknown): boolean {
    if (isShapeDefinition(shape)) {
        return isFormDataShape(shape.shape);
    } else if (isCustomSpecifier(shape)) {
        return shape.customName === formDataShape.customName;
    } else {
        return false;
    }
}
