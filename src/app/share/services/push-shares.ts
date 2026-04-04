import { writeTextFile, writeBinaryFile } from '@/lib/local-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import type { Share } from '../components/share-card'
import type { LogoItem } from '../components/logo-upload-dialog'
import { getFileExt } from '@/lib/utils'
import { toast } from 'sonner'

export type PushSharesParams = {
	shares: Share[]
	logoItems?: Map<string, LogoItem>
}

export async function pushShares(params: PushSharesParams): Promise<void> {
	const { shares, logoItems } = params

	toast.info('正在准备文件...')

	const uploadedHashes = new Set<string>()
	let updatedShares = [...shares]

	if (logoItems && logoItems.size > 0) {
		toast.info('正在上传图标...')
		for (const [url, logoItem] of logoItems.entries()) {
			if (logoItem.type === 'file') {
				const hash = logoItem.hash || (await hashFileSHA256(logoItem.file))
				const ext = getFileExt(logoItem.file.name)
				const filename = `${hash}${ext}`
				const publicPath = `/images/share/${filename}`

				if (!uploadedHashes.has(hash)) {
					const contentBase64 = await fileToBase64NoPrefix(logoItem.file)
					await writeBinaryFile(`public/images/share/${filename}`, contentBase64)
					uploadedHashes.add(hash)
				}

				updatedShares = updatedShares.map(s => (s.url === url ? { ...s, logo: publicPath } : s))
			}
		}
	}

	await writeTextFile('public/data/shares.json', JSON.stringify(updatedShares, null, '\t'))
	toast.success('发布成功！')
}
