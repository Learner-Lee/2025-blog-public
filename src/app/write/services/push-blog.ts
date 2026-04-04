import { toBase64Utf8, writeTextFile, writeBinaryFile } from '@/lib/local-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import { prepareBlogsIndex } from '@/lib/blog-index'
import type { ImageItem } from '../types'
import { getFileExt } from '@/lib/utils'
import { toast } from 'sonner'
import { formatDateTimeLocal } from '../stores/write-store'

export type PushBlogParams = {
	form: {
		slug: string
		title: string
		md: string
		tags: string[]
		date?: string
		summary?: string
		hidden?: boolean
		category?: string
	}
	cover?: ImageItem | null
	images?: ImageItem[]
	mode?: 'create' | 'edit'
	originalSlug?: string | null
}

export async function pushBlog(params: PushBlogParams): Promise<void> {
	const { form, cover, images, mode = 'create', originalSlug } = params

	if (!form?.slug) throw new Error('需要 slug')

	// Sanitize slug: remove leading slashes, strip /blog/ prefix, trim whitespace
	const cleanSlug = form.slug
		.trim()
		.replace(/^\/+/, '')
		.replace(/^blog\/+/i, '')
		.replace(/\/+$/, '')

	if (!cleanSlug) throw new Error('slug 无效，请填写文章的 URL 标识，如 my-first-post')

	if (mode === 'edit' && originalSlug && originalSlug !== cleanSlug) {
		throw new Error('编辑模式下不支持修改 slug，请保持原 slug 不变')
	}

	const basePath = `public/blogs/${cleanSlug}`
	// Update form.slug to the cleaned version
	form.slug = cleanSlug

	const allLocalImages: Array<{ img: Extract<ImageItem, { type: 'file' }>; id: string }> = []

	for (const img of images || []) {
		if (img.type === 'file') allLocalImages.push({ img, id: img.id })
	}
	if (cover?.type === 'file') allLocalImages.push({ img: cover, id: cover.id })

	toast.info('正在准备文件...')

	const uploadedHashes = new Set<string>()
	let mdToUpload = form.md
	let coverPath: string | undefined

	if (allLocalImages.length > 0) {
		toast.info('正在上传图片...')
		for (const { img, id } of allLocalImages) {
			const hash = img.hash || (await hashFileSHA256(img.file))
			const ext = getFileExt(img.file.name)
			const filename = `${hash}${ext}`
			const publicPath = `/blogs/${form.slug}/${filename}`

			if (!uploadedHashes.has(hash)) {
				const contentBase64 = await fileToBase64NoPrefix(img.file)
				await writeBinaryFile(`${basePath}/${filename}`, contentBase64)
				uploadedHashes.add(hash)
			}

			const placeholder = `local-image:${id}`
			mdToUpload = mdToUpload.split(`(${placeholder})`).join(`(${publicPath})`)

			if (cover?.type === 'file' && cover.id === id) {
				coverPath = publicPath
			}
		}
	}

	if (cover?.type === 'url') coverPath = cover.url

	toast.info('正在保存文章...')

	await writeTextFile(`${basePath}/index.md`, mdToUpload)

	const dateStr = form.date || formatDateTimeLocal()
	const config = {
		title: form.title,
		tags: form.tags,
		date: dateStr,
		summary: form.summary,
		cover: coverPath,
		hidden: form.hidden,
		category: form.category
	}
	await writeTextFile(`${basePath}/config.json`, JSON.stringify(config, null, 2))

	toast.info('正在更新索引...')
	const indexJson = await prepareBlogsIndex({
		slug: form.slug,
		title: form.title,
		tags: form.tags,
		date: dateStr,
		summary: form.summary,
		cover: coverPath,
		hidden: form.hidden,
		category: form.category
	})
	await writeTextFile('public/blogs/index.json', indexJson)

	toast.success('发布成功！')
}
