import resolve from '@rollup/plugin-node-resolve';
import includePaths from 'rollup-plugin-includepaths';
//import { terser } from 'rollup-plugin-terser';

export default {
    input: './node_modules/luxon/src/luxon.js',
    plugins: [
        includePaths({
            include: {},
        }),
        resolve({mainFields: ['module']}),
        //terser()
    ],
    context: 'null',
    moduleContext: 'null',
    output: {
        file: '../web/lib/luxon.mjs',
        format: 'esm',
        name: 'lit-element'
    }
};