import {HttpStatus} from '@augment-vir/common';
import {describe, itCases} from '@augment-vir/test';
import {extractHttpStatus} from './http-status.js';

describe(extractHttpStatus.name, () => {
    itCases(extractHttpStatus, [
        {
            it: 'returns exact known numeric statuses',
            input: HttpStatus.NotFound,
            expect: HttpStatus.NotFound,
        },
        {
            it: 'returns exact known string statuses',
            input: String(HttpStatus.Created),
            expect: HttpStatus.Created,
        },
        {
            it: 'falls back to the matching status category',
            input: 499,
            expect: HttpStatus.BadRequest,
        },
        {
            it: 'falls back to internal server error for unknown status categories',
            input: 999,
            expect: HttpStatus.InternalServerError,
        },
        {
            it: 'falls back to internal server error for non-numeric statuses',
            input: 'oops',
            expect: HttpStatus.InternalServerError,
        },
        {
            it: 'falls back to internal server error for non-three-digit statuses',
            input: 99,
            expect: HttpStatus.InternalServerError,
        },
    ]);
});
