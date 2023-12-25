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
import { isElement } from 'hast-util-is-element'
import { select } from 'hast-util-select'
import { shiftHeading } from 'hast-util-shift-heading'
import { h } from 'hastscript'

/**
 * @param {import('hast').Root} tree
 */
const wrapFooter = (tree) => {
	const rulerIndex = tree.children.findLastIndex(node => isElement(node, 'hr'))
	if (rulerIndex < 0) {
		return
	}

	const footer = tree.children.splice(rulerIndex)
	tree.children.push(h('footer', footer.slice(1)))
}

const extractCarolData = () => (tree, file) => {
	shiftHeading(tree, +2)
	wrapFooter(tree)

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

const carols = await readDirectory('колядки')
const congrats = await readDirectory('віншування')

const templateFile = await read('template.html')
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
