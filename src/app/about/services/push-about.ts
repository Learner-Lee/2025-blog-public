import { writeTextFile } from '@/lib/local-client'
import { toast } from 'sonner'

export type AboutData = {
	title: string
	description: string
	content: string
}

export async function pushAbout(data: AboutData): Promise<void> {
	toast.info('正在保存...')
	await writeTextFile('public/data/about.json', JSON.stringify(data, null, '\t'))
	toast.success('发布成功！')
}
