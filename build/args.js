import { args } from 'unified-args'
import processor from './processor.js'

args({
	description: 'Carol processor',
	extensions: [
		'md',
		'markdown',
		'mdown',
		'mkdn',
		'mkd',
		'mdwn',
		'mkdown',
		'ron'
	],
	ignoreName: '.carolignore',
	name: 'carol',
	packageField: 'carolConfig',
	pluginPrefix: 'carol',
	processor: processor,
	rcName: '.carolrc',
	version: '1.0.0',
	detectConfig: false,
})
