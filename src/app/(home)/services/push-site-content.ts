import { writeTextFile, writeBinaryFile, deleteFile } from '@/lib/local-client'
import { toast } from 'sonner'
import { fileToBase64NoPrefix } from '@/lib/file-utils'
import type { SiteContent, CardStyles } from '../stores/config-store'
import type { FileItem, ArtImageUploads, SocialButtonImageUploads, BackgroundImageUploads } from '../config-dialog/site-settings'

type ArtImageConfig = SiteContent['artImages'][number]
type BackgroundImageConfig = SiteContent['backgroundImages'][number]

export async function pushSiteContent(
	siteContent: SiteContent,
	cardStyles: CardStyles,
	faviconItem?: FileItem | null,
	avatarItem?: FileItem | null,
	artImageUploads?: ArtImageUploads,
	removedArtImages?: ArtImageConfig[],
	backgroundImageUploads?: BackgroundImageUploads,
	removedBackgroundImages?: BackgroundImageConfig[],
	socialButtonImageUploads?: SocialButtonImageUploads
): Promise<void> {
	toast.info('正在准备文件...')

	if (faviconItem?.type === 'file') {
		toast.info('正在上传 Favicon...')
		const contentBase64 = await fileToBase64NoPrefix(faviconItem.file)
		// Write to data volume so it persists across container restarts
		await writeBinaryFile('public/data/favicon.png', contentBase64)
	}

	if (avatarItem?.type === 'file') {
		toast.info('正在上传 Avatar...')
		const contentBase64 = await fileToBase64NoPrefix(avatarItem.file)
		// Write to data volume so it persists across container restarts
		await writeBinaryFile('public/data/avatar.png', contentBase64)
	}

	if (artImageUploads) {
		for (const [id, item] of Object.entries(artImageUploads)) {
			if (item.type !== 'file') continue
			const artConfig = siteContent.artImages?.find(art => art.id === id)
			if (!artConfig) continue
			const normalizedPath = artConfig.url.startsWith('/') ? artConfig.url : `/${artConfig.url}`
			toast.info(`正在上传 Art 图片 ${id}...`)
			const contentBase64 = await fileToBase64NoPrefix(item.file)
			await writeBinaryFile(`public${normalizedPath}`, contentBase64)
		}
	}

	if (removedArtImages?.length) {
		for (const art of removedArtImages) {
			const normalizedPath = art.url.startsWith('/') ? art.url : `/${art.url}`
			await deleteFile(`public${normalizedPath}`)
		}
	}

	if (backgroundImageUploads) {
		for (const [id, item] of Object.entries(backgroundImageUploads)) {
			if (item.type !== 'file') continue
			const bgConfig = siteContent.backgroundImages?.find(bg => bg.id === id)
			if (!bgConfig?.url.startsWith('/images/background/')) continue
			const normalizedPath = bgConfig.url.startsWith('/') ? bgConfig.url : `/${bgConfig.url}`
			toast.info(`正在上传背景图片 ${id}...`)
			const contentBase64 = await fileToBase64NoPrefix(item.file)
			await writeBinaryFile(`public${normalizedPath}`, contentBase64)
		}
	}

	if (removedBackgroundImages?.length) {
		for (const bg of removedBackgroundImages) {
			if (!bg.url.startsWith('/images/background/')) continue
			const normalizedPath = bg.url.startsWith('/') ? bg.url : `/${bg.url}`
			await deleteFile(`public${normalizedPath}`)
		}
	}

	if (socialButtonImageUploads) {
		for (const [buttonId, item] of Object.entries(socialButtonImageUploads)) {
			if (item.type !== 'file') continue
			const button = siteContent.socialButtons?.find(btn => btn.id === buttonId)
			if (!button?.value.startsWith('/images/social-buttons/')) continue
			const normalizedPath = button.value.startsWith('/') ? button.value : `/${button.value}`
			toast.info(`正在上传社交按钮图片 ${buttonId}...`)
			const contentBase64 = await fileToBase64NoPrefix(item.file)
			await writeBinaryFile(`public${normalizedPath}`, contentBase64)
		}
	}

	await writeTextFile('public/data/site-content.json', JSON.stringify(siteContent, null, '\t'))
	await writeTextFile('public/data/card-styles.json', JSON.stringify(cardStyles, null, '\t'))

	toast.success('保存成功！')
}
