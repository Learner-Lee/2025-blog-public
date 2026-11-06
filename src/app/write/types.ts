import type { BlogFormat } from '@/app/blog/types'

export type PublishForm = {
	slug: string
	title: string
	// 正文内容；format 为 html 时这里是 HTML 源码
	md: string
	format: BlogFormat
	tags: string[]
	date: string
	summary: string
	hidden?: boolean
	category?: string
}

export type ImageItem = { id: string; type: 'url'; url: string } | { id: string; type: 'file'; file: File; previewUrl: string; filename: string; hash?: string }
