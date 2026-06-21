import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import vueParser from 'vue-eslint-parser'
import vuePlugin from 'eslint-plugin-vue'

export default [
	{
		ignores: ['dist/**', 'node_modules/**', '.wrangler/**'],
	},
	{
		files: ['src/**/*.ts', 'src/**/*.js'],
		languageOptions: {
			parser: tsParser,
			parserOptions: { ecmaVersion: 2024, sourceType: 'module' },
		},
		plugins: { '@typescript-eslint': tsPlugin },
		rules: {
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'warn',
			'no-console': 'off',
			'prefer-const': 'warn',
			'no-var': 'error',
		},
	},
	{
		files: ['frontend/src/**/*.ts', 'frontend/src/**/*.vue'],
		languageOptions: {
			parser: vueParser,
			parserOptions: {
				parser: tsParser,
				ecmaVersion: 2022,
				sourceType: 'module',
			},
		},
		plugins: { vue: vuePlugin, '@typescript-eslint': tsPlugin },
		rules: {
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'warn',
			'vue/multi-word-component-names': 'off',
			'vue/no-v-html': 'off',
		},
	},
]
