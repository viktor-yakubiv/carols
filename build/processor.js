import { parse as parsePath } from 'node:path'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import remarkDirective from 'remark-directive'
import rehypeStringify from 'rehype-stringify'
import rehypeRaw from 'rehype-raw'
import rehypeInferTitleMeta from 'rehype-infer-title-meta'
import { is, convert } from 'unist-util-is'
import { CONTINUE, SKIP, visit } from 'unist-util-visit'
import { shiftHeading } from 'hast-util-shift-heading'
import { newlineToBreak } from 'mdast-util-newline-to-break'
import { u } from 'unist-builder'

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
		? tree.children.length + 1
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

export default carolProcessor
