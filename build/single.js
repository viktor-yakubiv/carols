import { glob } from 'glob'
import { read, write } from 'to-vfile'
import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import rehypeFormat from 'rehype-format'
import { select } from 'hast-util-select'
import { h } from 'hastscript'

import carolProcessor from './processor.js'

const inject = (files, tree, sectionName) => {
	const $section = select(`#${sectionName}`, tree)
	const $nav = select(`#зміст-${sectionName} ol`, tree)

	for (const file of files) {
		const { id, title, body } = file.data ?? {}
		const article = h('article', { id }, body)
		const item = h('li', h('a', { href: '#' + id }, title))

		$section.children.push(article)
		$nav.children.push(item)
	}
}

const contentInjector = () => (tree, file) => {
	inject(file.data.carols, tree, 'колядки')
	inject(file.data.congrats, tree, 'віншування')
}

const readDirectory = (name) => glob(`${name}/*.md`)
	.then(paths => Promise.all(paths.map(p => read(p))))
	.then(files => Promise.all(files.map(f => {
		return carolProcessor.process(f)
	})))
	.then(files => files.sort((a, b) => {
		return a.data.title.localeCompare(b.data.title, 'uk', {
			ignorePunctuation: true,
		})
	}))

const carol = await carolProcessor.process()

const templateFile = await read('single.html')
templateFile.data ??= {}
Object.assign(templateFile.data, { carols, congrats })

const indexFile = await unified()
	.use(rehypeParse)
	.use(rehypeStringify)
	.use(rehypeFormat)
	.use(contentInjector)
	.process(templateFile)

indexFile.path = 'index.html'
await write(indexFile)
