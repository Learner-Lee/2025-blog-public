import { writeTextFile } from '@/lib/local-client'
import { toast } from 'sonner'

export type PushSnippetsParams = {
	snippets: string[]
}

export async function pushSnippets(params: PushSnippetsParams): Promise<void> {
	const { snippets } = params
	toast.info('正在保存...')
	await writeTextFile('public/data/snippets.json', JSON.stringify(snippets, null, '\t'))
	toast.success('发布成功！')
}
