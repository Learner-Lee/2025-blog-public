export type BlogIndexItem = {
	slug: string
	title: string
	tags: string[]
	date: string
	summary?: string
	cover?: string
	hidden?: boolean
	category?: string
}

export type BlogFormat = 'md' | 'html'

export type BlogConfig = {
	// 缺省为 md；html 笔记的正文存为 index.html
	format?: BlogFormat
	title?: string
	tags?: string[]
	date?: string
	summary?: string
	cover?: string
	hidden?: boolean
	category?: string
}

