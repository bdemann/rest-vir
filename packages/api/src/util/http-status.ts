import {check} from '@augment-vir/assert';
import {HttpStatus} from '@augment-vir/common';

export function extractHttpStatus(status: number | string): HttpStatus {
    const numericStatus = Number(status);
    const stringStatus = String(status);

    if (check.isEnumValue(numericStatus, HttpStatus)) {
        return numericStatus;
    }

    console.error(`Invalid HTTP status: ${status}`);
    const fallbackStatus = Math.floor((Number(stringStatus[0]) || 0) * 100);

    if (check.isEnumValue(fallbackStatus, HttpStatus)) {
        return fallbackStatus;
    } else {
        return HttpStatus.InternalServerError;
    }
}
