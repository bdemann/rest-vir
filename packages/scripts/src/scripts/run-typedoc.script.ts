import {type PartialDeep} from '@augment-vir/common';
import {runTypedoc} from '@virmator/docs';
import {baseTypedocConfig} from '@virmator/docs/configs/typedoc.config.base.js';
import {join} from 'node:path';
import {type GlobString, type NormalizedPath, type TypeDocOptionMap} from 'typedoc';
import {eslintTsconfigPath, monoRepoDirPath, packagePaths} from '../file-paths.js';

async function main() {
    const typeDocConfig: PartialDeep<TypeDocOptionMap> = {
        ...baseTypedocConfig,
        out: join(monoRepoDirPath, 'dist-docs') as NormalizedPath,
        entryPoints: [
            join(packagePaths.scripts, 'src', 'typedoc-entry-point.ts') as GlobString,
        ],
        intentionallyNotExported: [],
        defaultCategory: 'MISSING CATEGORY',
        categoryOrder: [
            '*',
            'Error',
            'Util : API',
            'Util : Client',
            'Testing : Client',
            'Testing : Host',
            'Package : @rest-vir/api',
            'Package : @rest-vir/host',
            'Internal',
        ],
        tsconfig: eslintTsconfigPath as NormalizedPath,
        blockTags: [
            /** The default tags we use. */
            '@category',
            '@default',
            '@example',
            '@param',
            '@returns',
            '@template',
            '@throws',
            '@see',

            /** Custom tags we've added. */
            '@package',
        ],
        name: 'rest-vir',
        readme: join(monoRepoDirPath, 'README.md'),
    };

    await runTypedoc({
        config: typeDocConfig,
        checkOnly: false,
        packageDir: monoRepoDirPath,
    });
}

await main();
