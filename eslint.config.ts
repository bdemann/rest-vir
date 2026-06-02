import {defineEslintConfig} from '@virmator/lint/configs/eslint.config.base.js';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
    ...defineEslintConfig(__dirname),
    {
        ignores: [
            /** Add file globs that should be ignored. */
            './packages/large-api-mock/src/endpoints/',
            './packages/large-api-mock/src/web-sockets/',
            './packages/large-api-mock/src/large-api.mock.ts',
            './packages/large-api-mock/src/implement-large-api.mock.ts',
        ],
    },
    {
        rules: {
            /**
             * Turn off or on specific rules. See {@link defineEslintConfig} for which plugins are
             * already enabled.
             */
        },
    },
];
