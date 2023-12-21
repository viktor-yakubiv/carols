import { parse as parsePath } from 'node:path'
import { glob } from 'glob'
import { read, write } from 'to-vfile'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import rehypeRaw from 'rehype-raw'
import rehypeFormat from 'rehype-format'
import rehypeInferTitleMeta from 'rehype-infer-title-meta'
import { select } from 'hast-util-select'
import { shiftHeading } from 'hast-util-shift-heading'
import { h } from 'hastscript'

const extractCarolData = () => (tree, file) => {
	shiftHeading(tree, +1)

	file.data.title = file.data.meta.title
	file.data.body = tree
	file.data.id = parsePath(file.path).name
}

const carolProcessor = unified()
	.use(remarkParse)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
	.use(rehypeStringify)
	.use(rehypeInferTitleMeta)
	.use(extractCarolData)
	.freeze()

const carolInjector = () => (tree, file) => {
	const { carols } = file.data ?? []
	const main = select('main', tree)
	const listOfContents = select('nav ol', tree)

	for (const carolFile of carols) {
		const { id, title, body } = carolFile.data ?? {}
		const article = h('article', { id }, body)
		const item = h('li', h('a', { href: '#' + id }, title))

		main.children.push(article)
		listOfContents.children.push(item)
	}
}

const carols = await glob('songs/*.md')
	.then(paths => Promise.all(paths.map(p => read(p))))
	.then(files => Promise.all(files.map(f => {
		return carolProcessor.process(f)
	})))
	.then(files => files.sort((a, b) => {
		return a.data.title.localeCompare(b.data.title, 'uk', {
			ignorePunctuation: true,
		})
	}))

const templateFile = await read('template.html')
templateFile.data ??= {}
templateFile.data.carols = carols

const indexFile = await unified()
	.use(rehypeParse)
	.use(rehypeStringify)
	.use(rehypeFormat)
	.use(carolInjector)
	.process(templateFile)

indexFile.path = 'index.html'
await write(indexFile)
