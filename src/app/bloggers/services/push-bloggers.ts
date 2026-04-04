import { writeTextFile, writeBinaryFile } from '@/lib/local-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import type { Blogger } from '../grid-view'
import type { AvatarItem } from '../components/avatar-upload-dialog'
import { getFileExt } from '@/lib/utils'
import { toast } from 'sonner'

export type PushBloggersParams = {
	bloggers: Blogger[]
	avatarItems?: Map<string, AvatarItem>
}

export async function pushBloggers(params: PushBloggersParams): Promise<void> {
	const { bloggers, avatarItems } = params

	toast.info('正在准备文件...')

	const uploadedHashes = new Set<string>()
	let updatedBloggers = [...bloggers]

	if (avatarItems && avatarItems.size > 0) {
		toast.info('正在上传头像...')
		for (const [url, avatarItem] of avatarItems.entries()) {
			if (avatarItem.type === 'file') {
				const hash = avatarItem.hash || (await hashFileSHA256(avatarItem.file))
				const ext = getFileExt(avatarItem.file.name)
				const filename = `${hash}${ext}`
				const publicPath = `/images/blogger/${filename}`

				if (!uploadedHashes.has(hash)) {
					const contentBase64 = await fileToBase64NoPrefix(avatarItem.file)
					await writeBinaryFile(`public/images/blogger/${filename}`, contentBase64)
					uploadedHashes.add(hash)
				}

				updatedBloggers = updatedBloggers.map(b => (b.url === url ? { ...b, avatar: publicPath } : b))
			}
		}
	}

	await writeTextFile('public/data/bloggers.json', JSON.stringify(updatedBloggers, null, '\t'))
	toast.success('发布成功！')
}
