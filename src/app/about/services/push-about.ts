import { writeTextFile, writeBinaryFile } from '@/lib/local-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import { getFileExt } from '@/lib/utils'
import type { ImageItem } from '@/app/projects/components/image-upload-dialog'
import { toast } from 'sonner'

export type Work = {
	id: string
	name: string
	year: number
	tagline: string
	image: string
	demo?: string
	github?: string
	tags: string[]
	content: string
}

export type AboutData = {
	title: string
	description: string
	works: Work[]
}

export type PushAboutParams = {
	data: AboutData
	imageItems?: Map<string, ImageItem>
}

export async function pushAbout(params: PushAboutParams): Promise<AboutData> {
	const { data, imageItems } = params

	toast.info('正在保存...')

	let works = [...data.works]

	if (imageItems && imageItems.size > 0) {
		toast.info('正在上传图片...')
		const uploadedHashes = new Set<string>()

		for (const [workId, imageItem] of imageItems.entries()) {
			if (imageItem.type !== 'file') continue

			const hash = imageItem.hash || (await hashFileSHA256(imageItem.file))
			const filename = `${hash}${getFileExt(imageItem.file.name)}`

			if (!uploadedHashes.has(hash)) {
				const contentBase64 = await fileToBase64NoPrefix(imageItem.file)
				await writeBinaryFile(`public/images/work/${filename}`, contentBase64)
				uploadedHashes.add(hash)
			}

			works = works.map(w => (w.id === workId ? { ...w, image: `/images/work/${filename}` } : w))
		}
	}

	// Strip any blob: URLs that weren't replaced (e.g. upload failed)
	works = works.map(w => ({ ...w, image: w.image?.startsWith('blob:') ? '' : w.image }))

	const saved: AboutData = { ...data, works }
	await writeTextFile('public/data/about.json', JSON.stringify(saved, null, '\t'))
	toast.success('发布成功！')
	return saved
}
