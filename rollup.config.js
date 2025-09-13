import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { string } from 'rollup-plugin-string';
import terser from '@rollup/plugin-terser';

const config = {
	input: 'src/index.ts',
	output: {
		dir: 'build',
		format: 'es',
		compact: true,
	},
	plugins: [
		json(),

		typescript({
			tsconfig: 'tsconfig.json',
			outDir: 'build',
			sourceMap: false,
		}),
		string({
			include: '**/*.wgsl',
		}),
		resolve(),
		commonjs(),
		terser(),
	],
};

export default config;
