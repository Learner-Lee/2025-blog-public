'use client'

import { writeTextFile } from '@/lib/local-client'
import type { BlogIndexItem } from '@/app/blog/types'

export type { BlogIndexItem } from '@/app/blog/types'

async function readBlogsIndex(): Promise<BlogIndexItem[]> {
	try {
		const res = await fetch('/blogs/index.json', { cache: 'no-store' })
		if (!res.ok) return []
		return await res.json()
	} catch {
		return []
	}
}

export async function upsertBlogsIndex(item: BlogIndexItem): Promise<void> {
	const list = await readBlogsIndex()
	const map = new Map<string, BlogIndexItem>(list.map(i => [i.slug, i]))
	map.set(item.slug, item)
	const next = Array.from(map.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
	await writeTextFile('public/blogs/index.json', JSON.stringify(next, null, 2))
}

export async function prepareBlogsIndex(item: BlogIndexItem): Promise<string> {
	const list = await readBlogsIndex()
	const map = new Map<string, BlogIndexItem>(list.map(i => [i.slug, i]))
	map.set(item.slug, item)
	const next = Array.from(map.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
	return JSON.stringify(next, null, 2)
}

export async function removeBlogsFromIndex(slugs: string[]): Promise<string> {
	const list = await readBlogsIndex()
	const slugSet = new Set(slugs.filter(Boolean))
	if (slugSet.size === 0) return JSON.stringify(list, null, 2)
	const next = list.filter(item => !slugSet.has(item.slug))
	return JSON.stringify(next, null, 2)
}

export async function removeBlogFromIndex(slug: string): Promise<string> {
	return removeBlogsFromIndex([slug])
}
