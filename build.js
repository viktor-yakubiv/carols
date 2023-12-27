import { parse as parsePath } from 'node:path'
import { glob } from 'glob'
import { read, write } from 'to-vfile'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import remarkDirective from 'remark-directive'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import rehypeRaw from 'rehype-raw'
import rehypeFormat from 'rehype-format'
import rehypeInferTitleMeta from 'rehype-infer-title-meta'
import { is, convert } from 'unist-util-is'
import { CONTINUE, SKIP, visit } from 'unist-util-visit'
import { select } from 'hast-util-select'
import { shiftHeading } from 'hast-util-shift-heading'
import { newlineToBreak } from 'mdast-util-newline-to-break'
import { u } from 'unist-builder'
import { h } from 'hastscript'

const isDivider = convert('thematicBreak')
const isHeading = convert('heading')
const isChorus = node =>
	is(node, 'containerDirective') &&
	node.name.toLowerCase() === 'chorus'

const withChorus = (tree) => {
	const chorus = tree.children.find(node => isChorus(node))
	if (chorus == null) {
		return
	}

	chorus.type = 'chorus'
	chorus.data ??= {}
	chorus.data.hProperties = { className: ['chorus'] }

	visit(chorus, 'paragraph', (node) => {
		node.children.unshift(u('html', '<i>'))
		node.children.push(u('html', '</i>'))
		return SKIP
	})

	visit(tree, 'paragraph', (node, i, parent) => {
		const next = parent.children[i + 1]
		if (node === chorus || parent === chorus || next === chorus) {
			return SKIP
		}

		// Insert chorus after the current paragraph
		parent.children = [
			...parent.children.slice(0, i + 1),
			chorus,
			...parent.children.slice(i + 1),
		]
		return [CONTINUE, i + 2]
	})
}

/**
 * @param {import('mdast').Root} tree
 */
const splitStructure = (tree) => {
	const lastRulerIndex = tree.children.findLastIndex(node => isDivider(node))
	const footerIndex = lastRulerIndex < 0
		? tree.children.length
		: lastRulerIndex + 1

	const title = tree.children.find(node => isHeading(node))

	const footer = u('footer', tree.children.slice(footerIndex))
	footer.data = { hName: 'footer' }

	const body = u('root', tree.children
		.slice(0, footerIndex - 1)
		.filter(node => node !== title))

	return { title, body, footer }
}

const carolSyntax = () => (tree) => {
	const { title, body, footer } = splitStructure(tree)
	newlineToBreak(body)
	withChorus(body)
	tree.children = [title, body]
	if (footer.children.length > 0) tree.children.push(footer)
}

const carolFormat = () => (tree) => {
	shiftHeading(tree, +2)
}

const carolData = () => (tree, file) => {
	file.data.title = file.data.meta.title
	file.data.body = tree
	file.data.id = parsePath(file.path).name
}

const carolProcessor = unified()
	.use(remarkParse)
	.use(remarkDirective)
	.use(carolSyntax)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
	.use(rehypeStringify)
	.use(rehypeInferTitleMeta)
	.use(carolFormat)
	.use(carolData)
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
