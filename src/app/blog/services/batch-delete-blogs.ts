import { toast } from 'sonner'
import { deleteFile, listDirectory, writeTextFile } from '@/lib/local-client'
import { removeBlogsFromIndex } from '@/lib/blog-index'

export async function batchDeleteBlogs(slugs: string[]): Promise<void> {
	const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean)))
	if (uniqueSlugs.length === 0) throw new Error('需要至少选择一篇文章')

	for (const slug of uniqueSlugs) {
		toast.info(`正在删除 ${slug}...`)
		const basePath = `public/blogs/${slug}`
		const files = await listDirectory(basePath)
		for (const file of files) {
			await deleteFile(file)
		}
	}

	toast.info('正在更新索引...')
	const indexJson = await removeBlogsFromIndex(uniqueSlugs)
	await writeTextFile('public/blogs/index.json', indexJson)

	toast.success('删除成功！')
}
