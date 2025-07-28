import {assert} from '@augment-vir/assert';
import {isErrorHttpStatus, type ErrorHttpStatus} from '@augment-vir/common';

export class RejectRequestError extends Error {
    public override readonly name = 'RejectRequestError';

    constructor(
        public readonly httpStatus: ErrorHttpStatus,
        public readonly responseErrorMessage?: string | undefined,
    ) {
        assert.isTrue(isErrorHttpStatus(httpStatus), `Not an error http status: ${httpStatus}.`);
        super(`Request rejected with status ${httpStatus}.`);
    }
}
