'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { DialogModal } from '@/components/dialog-modal'
import { useWriteStore } from '../stores/write-store'
import { hashFileSHA256 } from '@/lib/file-utils'

type Props = {
	open: boolean
	onClose: () => void
}

function extractRelativeImagePaths(md: string): string[] {
	const regex = /!\[.*?\]\(([^)]+)\)/g
	const paths: string[] = []
	let match
	while ((match = regex.exec(md)) !== null) {
		const src = match[1].trim()
		if (!src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:')) {
			paths.push(src)
		}
	}
	return [...new Set(paths)]
}

export function ImportMdDialog({ open, onClose }: Props) {
	const { addFiles, updateForm } = useWriteStore()
	const mdInputRef = useRef<HTMLInputElement>(null)
	const imgInputRef = useRef<HTMLInputElement>(null)

	const [mdFile, setMdFile] = useState<File | null>(null)
	const [imageFiles, setImageFiles] = useState<File[]>([])
	const [loading, setLoading] = useState(false)

	const handleClose = () => {
		if (loading) return
		setMdFile(null)
		setImageFiles([])
		onClose()
	}

	const handleImgFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'))
		setImageFiles(files)
	}

	const handleConfirm = async () => {
		if (!mdFile) {
			toast.error('请先选择 MD 文件')
			return
		}
		setLoading(true)
		try {
			let md = await mdFile.text()

			if (imageFiles.length > 0) {
				const relativePaths = extractRelativeImagePaths(md)

				// Map each relative path to a file by matching filename
				const pathToFile = new Map<string, File>()
				for (const relPath of relativePaths) {
					const filename = relPath.split('/').pop()?.split('\\').pop()
					if (!filename) continue
					const file = imageFiles.find(f => f.name === filename)
					if (file) pathToFile.set(relPath, file)
				}

				if (pathToFile.size > 0) {
					const uniqueFiles = [...new Set(pathToFile.values())]

					// Compute hashes before adding so we can find the IDs afterward
					const fileToHash = new Map<File, string>()
					for (const file of uniqueFiles) {
						fileToHash.set(file, await hashFileSHA256(file))
					}

					await addFiles(uniqueFiles)

					// Read store state after addFiles
					const { images } = useWriteStore.getState()
					const hashToId = new Map<string, string>()
					for (const img of images) {
						if (img.type === 'file' && (img as any).hash) {
							hashToId.set((img as any).hash, img.id)
						}
					}

					// Replace relative paths with local-image placeholders
					for (const [relPath, file] of pathToFile.entries()) {
						const hash = fileToHash.get(file)
						if (!hash) continue
						const id = hashToId.get(hash)
						if (!id) continue
						md = md.split(`(${relPath})`).join(`(local-image:${id})`)
					}

					const matched = pathToFile.size
					const total = relativePaths.length
					if (matched < total) {
						toast.info(`已匹配 ${matched}/${total} 张图片，其余路径未找到对应文件`)
					}
				}
			}

			updateForm({ md })
			toast.success('导入成功')
			handleClose()
		} catch (err) {
			console.error(err)
			toast.error('导入失败，请重试')
		} finally {
			setLoading(false)
		}
	}

	return (
		<DialogModal open={open} onClose={handleClose} className='card w-96 p-6 space-y-5'>
			<h2 className='text-base font-semibold'>导入 Markdown</h2>

			{/* MD 文件 */}
			<div className='space-y-2'>
				<p className='text-sm font-medium'>MD 文件 <span className='text-red-500'>*</span></p>
				<div
					className='flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors hover:bg-neutral-50'
					onClick={() => mdInputRef.current?.click()}>
					<span className='text-lg'>📄</span>
					<span className={mdFile ? 'text-neutral-800' : 'text-neutral-400'}>
						{mdFile ? mdFile.name : '点击选择 .md 文件'}
					</span>
				</div>
				<input ref={mdInputRef} type='file' accept='.md' className='hidden' onChange={e => setMdFile(e.target.files?.[0] || null)} />
			</div>

			{/* 图片文件夹 */}
			<div className='space-y-2'>
				<p className='text-sm font-medium'>图片文件夹 <span className='text-neutral-400 text-xs font-normal'>（可选，用于匹配 MD 中的相对路径）</span></p>
				<div
					className='flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors hover:bg-neutral-50'
					onClick={() => imgInputRef.current?.click()}>
					<span className='text-lg'>🖼️</span>
					<span className={imageFiles.length > 0 ? 'text-neutral-800' : 'text-neutral-400'}>
						{imageFiles.length > 0 ? `已选择 ${imageFiles.length} 张图片` : '点击选择图片文件夹'}
					</span>
				</div>
				<input
					ref={imgInputRef}
					type='file'
					className='hidden'
					// @ts-ignore
					webkitdirectory=''
					multiple
					onChange={handleImgFilesChange}
				/>
				{imageFiles.length > 0 && (
					<p className='text-xs text-neutral-400'>
						将自动匹配 MD 中的相对路径（按文件名）
					</p>
				)}
			</div>

			<div className='flex justify-end gap-2 pt-1'>
				<button onClick={handleClose} disabled={loading} className='rounded-xl border px-4 py-2 text-sm'>
					取消
				</button>
				<button
					onClick={handleConfirm}
					disabled={loading || !mdFile}
					className='brand-btn px-5 disabled:opacity-50'>
					{loading ? '处理中...' : '导入'}
				</button>
			</div>
		</DialogModal>
	)
}
