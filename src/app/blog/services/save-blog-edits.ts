import { toast } from 'sonner'
import { writeTextFile, deleteFile, listDirectory } from '@/lib/local-client'
import type { BlogIndexItem } from '@/lib/blog-index'

export async function saveBlogEdits(originalItems: BlogIndexItem[], nextItems: BlogIndexItem[], categories: string[]): Promise<void> {
	const removedSlugs = originalItems.filter(item => !nextItems.some(next => next.slug === item.slug)).map(item => item.slug)
	const uniqueRemoved = Array.from(new Set(removedSlugs.filter(Boolean)))

	for (const slug of uniqueRemoved) {
		toast.info(`正在删除 ${slug}...`)
		try {
			const files = await listDirectory(`public/blogs/${slug}`)
			for (const file of files) {
				await deleteFile(`public/blogs/${slug}/${file}`)
			}
			await deleteFile(`public/blogs/${slug}`)
		} catch {
			// ignore if directory doesn't exist
		}
	}

	toast.info('正在更新索引...')
	const sortedItems = [...nextItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
	await writeTextFile('public/blogs/index.json', JSON.stringify(sortedItems, null, 2))

	toast.info('正在更新分类...')
	const uniqueCategories = Array.from(new Set(categories.map(c => c.trim()).filter(Boolean)))
	await writeTextFile('public/blogs/categories.json', JSON.stringify({ categories: uniqueCategories }, null, 2))

	toast.success('保存成功！')
}
