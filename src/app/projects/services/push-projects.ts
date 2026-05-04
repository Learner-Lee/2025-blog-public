import { writeTextFile, writeBinaryFile } from '@/lib/local-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import type { Project } from '../components/project-card'
import type { ImageItem } from '../components/image-upload-dialog'
import { getFileExt } from '@/lib/utils'
import { toast } from 'sonner'

export type PushProjectsParams = {
	projects: Project[]
	imageItems?: Map<string, ImageItem>
}

export async function pushProjects(params: PushProjectsParams): Promise<Project[]> {
	const { projects, imageItems } = params

	toast.info('正在准备文件...')

	const uploadedHashes = new Set<string>()
	let updatedProjects = [...projects]

	if (imageItems && imageItems.size > 0) {
		toast.info('正在上传图片...')
		for (const [url, imageItem] of imageItems.entries()) {
			if (imageItem.type === 'file') {
				const hash = imageItem.hash || (await hashFileSHA256(imageItem.file))
				const ext = getFileExt(imageItem.file.name)
				const filename = `${hash}${ext}`
				const publicPath = `/images/project/${filename}`

				if (!uploadedHashes.has(hash)) {
					const contentBase64 = await fileToBase64NoPrefix(imageItem.file)
					await writeBinaryFile(`public/images/project/${filename}`, contentBase64)
					uploadedHashes.add(hash)
				}

				updatedProjects = updatedProjects.map(p => (p.url === url ? { ...p, image: publicPath } : p))
			}
		}
	}

	// Strip any blob: URLs that weren't replaced (e.g. upload failed)
	updatedProjects = updatedProjects.map(p => ({
		...p,
		image: p.image?.startsWith('blob:') ? '' : p.image
	}))

	await writeTextFile('public/data/projects.json', JSON.stringify(updatedProjects, null, '\t'))
	toast.success('发布成功！')
	return updatedProjects
}
