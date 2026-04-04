import { writeTextFile, writeBinaryFile, deleteFile } from '@/lib/local-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import type { ImageItem } from '../../projects/components/image-upload-dialog'
import { getFileExt } from '@/lib/utils'
import { toast } from 'sonner'
import { Picture } from '../page'

export type PushPicturesParams = {
	pictures: Picture[]
	imageItems?: Map<string, ImageItem>
}

export async function pushPictures(params: PushPicturesParams): Promise<void> {
	const { pictures, imageItems } = params

	toast.info('正在准备文件...')

	const uploadedHashes = new Set<string>()
	let updatedPictures = [...pictures]

	if (imageItems && imageItems.size > 0) {
		toast.info('正在上传图片...')
		for (const [key, imageItem] of imageItems.entries()) {
			if (imageItem.type === 'file') {
				const hash = imageItem.hash || (await hashFileSHA256(imageItem.file))
				const ext = getFileExt(imageItem.file.name)
				const filename = `${hash}${ext}`
				const publicPath = `/images/pictures/${filename}`

				if (!uploadedHashes.has(hash)) {
					const contentBase64 = await fileToBase64NoPrefix(imageItem.file)
					await writeBinaryFile(`public/images/pictures/${filename}`, contentBase64)
					uploadedHashes.add(hash)
				}

				const [groupId, indexStr] = key.split('::')
				const imageIndex = Number(indexStr) || 0

				updatedPictures = updatedPictures.map(p => {
					if (p.id !== groupId) return p
					const currentImages = p.images && p.images.length > 0 ? p.images : p.image ? [p.image] : []
					const nextImages = currentImages.map((img, idx) => (idx === imageIndex ? publicPath : img))
					return { ...p, image: undefined, images: nextImages }
				})
			}
		}
	}

	// Find removed images and delete them
	const currentImageUrls = new Set<string>()
	for (const picture of updatedPictures) {
		if (picture.image) currentImageUrls.add(picture.image)
		picture.images?.forEach(url => currentImageUrls.add(url))
	}

	try {
		const previousRes = await fetch('/data/pictures.json', { cache: 'no-store' })
		if (previousRes.ok) {
			const previousPictures: Picture[] = await previousRes.json()
			for (const picture of previousPictures) {
				const urls = picture.images?.length ? picture.images : picture.image ? [picture.image] : []
				for (const url of urls) {
					if (!currentImageUrls.has(url) && url.startsWith('/images/pictures/')) {
						await deleteFile(`public${url}`)
					}
				}
			}
		}
	} catch {}

	await writeTextFile('public/data/pictures.json', JSON.stringify(updatedPictures, null, '\t'))
	toast.success('发布成功！')
}
