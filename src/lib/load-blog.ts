import type { BlogConfig, BlogFormat } from '@/app/blog/types'

export type { BlogConfig } from '@/app/blog/types'

export type LoadedBlog = {
	slug: string
	config: BlogConfig
	format: BlogFormat
	// 正文内容；format 为 html 时这里是 HTML 源码
	markdown: string
	cover?: string
}

/**
 * Load blog data from public/blogs/{slug}
 * Used by both view page and edit page
 */
export async function loadBlog(slug: string): Promise<LoadedBlog> {
	if (!slug) {
		throw new Error('Slug is required')
	}

	// Load config.json
	let config: BlogConfig = {}
	const configRes = await fetch(`/blogs/${encodeURIComponent(slug)}/config.json`)
	if (configRes.ok) {
		try {
			config = await configRes.json()
		} catch {
			config = {}
		}
	}

	// Load index.md / index.html
	const format: BlogFormat = config.format === 'html' ? 'html' : 'md'
	const mdRes = await fetch(`/blogs/${encodeURIComponent(slug)}/index.${format}`)
	if (!mdRes.ok) {
		throw new Error('Blog not found')
	}
	const markdown = await mdRes.text()

	return {
		slug,
		config,
		format,
		markdown,
		cover: config.cover
	}
}
