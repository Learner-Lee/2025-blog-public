import { toast } from 'sonner'
import { deleteFile, listDirectory } from '@/lib/local-client'
import { removeBlogFromIndex } from '@/lib/blog-index'
import { writeTextFile } from '@/lib/local-client'

export async function deleteBlog(slug: string): Promise<void> {
	if (!slug) throw new Error('需要 slug')

	const basePath = `public/blogs/${slug}`

	toast.info('正在收集文章文件...')
	const files = await listDirectory(basePath)
	if (files.length === 0) throw new Error('文章不存在或已删除')

	toast.info('正在删除文件...')
	for (const file of files) {
		await deleteFile(file)
	}

	toast.info('正在更新索引...')
	const indexJson = await removeBlogFromIndex(slug)
	await writeTextFile('public/blogs/index.json', indexJson)

	toast.success('删除成功！')
}
