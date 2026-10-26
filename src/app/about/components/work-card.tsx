'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useSize } from '@/hooks/use-size'
import { useMarkdownRender } from '@/hooks/use-markdown-render'
import ImageUploadDialog, { type ImageItem } from '@/app/projects/components/image-upload-dialog'
import type { Work } from '../services/push-about'

interface WorkCardProps {
	work: Work
	isEditMode?: boolean
	onUpdate?: (work: Work, imageItem?: ImageItem) => void
	onDelete?: () => void
}

export function WorkCard({ work, isEditMode = false, onUpdate, onDelete }: WorkCardProps) {
	const { maxSM } = useSize()
	const [showImageDialog, setShowImageDialog] = useState(false)
	const { content, loading } = useMarkdownRender(work.content)

	const handleFieldChange = (field: keyof Work, value: any) => {
		onUpdate?.({ ...work, [field]: value })
	}

	const handleImageSubmit = (image: ImageItem) => {
		const imageUrl = image.type === 'url' ? image.url : image.previewUrl
		onUpdate?.({ ...work, image: imageUrl }, image)
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 24 }}
			{...(maxSM ? { animate: { opacity: 1, y: 0 } } : { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-80px' } })}
			className='card relative flex flex-col gap-5 p-6 max-sm:p-4'>
			{isEditMode && (
				<button onClick={onDelete} className='absolute top-3 right-3 z-10 rounded-lg px-2 py-1.5 text-xs text-red-400 transition-colors hover:text-red-600'>
					删除
				</button>
			)}

			<div className='group relative overflow-hidden rounded-xl'>
				{work.image ? (
					<img
						src={work.image}
						alt={work.name}
						className={cn('aspect-video w-full object-cover', isEditMode && 'cursor-pointer')}
						onClick={() => isEditMode && setShowImageDialog(true)}
					/>
				) : (
					<div
						className={cn(
							'bg-secondary/10 text-secondary flex aspect-video w-full items-center justify-center border text-sm',
							isEditMode && 'cursor-pointer'
						)}
						onClick={() => isEditMode && setShowImageDialog(true)}>
						无封面图
					</div>
				)}
				{isEditMode && (
					<div className='pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100'>
						<span className='text-sm text-white'>更换封面</span>
					</div>
				)}
			</div>

			<div className='flex flex-col gap-3'>
				<div className='flex items-center gap-3'>
					{isEditMode ? (
						<>
							<input
								type='text'
								value={work.name}
								onChange={e => handleFieldChange('name', e.target.value)}
								placeholder='作品名称'
								className='border-secondary/20 flex-1 rounded-lg border px-3 py-1.5 text-xl font-bold focus:outline-none'
							/>
							<input
								type='number'
								value={work.year}
								onChange={e => handleFieldChange('year', parseInt(e.target.value) || 0)}
								className='text-secondary border-secondary/20 w-20 rounded-lg border px-2 py-1.5 text-sm focus:outline-none'
							/>
						</>
					) : (
						<>
							<h2 className='text-2xl font-bold'>{work.name}</h2>
							<span className='text-secondary text-sm'>{work.year}</span>
						</>
					)}
				</div>

				{isEditMode ? (
					<input
						type='text'
						value={work.tagline}
						onChange={e => handleFieldChange('tagline', e.target.value)}
						placeholder='一句话介绍'
						className='border-secondary/20 rounded-lg border px-3 py-1.5 text-base focus:outline-none'
					/>
				) : (
					work.tagline && <p className='text-secondary text-base'>{work.tagline}</p>
				)}

				<div className='flex flex-wrap gap-2'>
					{isEditMode ? (
						<input
							type='text'
							value={work.tags.join(', ')}
							onChange={e =>
								handleFieldChange(
									'tags',
									e.target.value
										.split(',')
										.map(t => t.trim())
										.filter(Boolean)
								)
							}
							placeholder='标签，用逗号分隔'
							className='bg-secondary/10 border-secondary/20 w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none'
						/>
					) : (
						work.tags.map(tag => (
							<span key={tag} className='text-secondary bg-bg rounded-lg px-2 py-1 text-xs'>
								{tag}
							</span>
						))
					)}
				</div>
			</div>

			<div className='flex flex-wrap gap-2'>
				{isEditMode ? (
					<>
						<input
							type='url'
							value={work.demo || ''}
							onChange={e => handleFieldChange('demo', e.target.value || undefined)}
							placeholder='在线体验 URL（可选）'
							className='bg-secondary/10 border-secondary/20 flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none'
						/>
						<input
							type='url'
							value={work.github || ''}
							onChange={e => handleFieldChange('github', e.target.value || undefined)}
							placeholder='GitHub URL（可选）'
							className='bg-secondary/10 border-secondary/20 flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none'
						/>
					</>
				) : (
					<>
						{work.demo && (
							<Link href={work.demo} target='_blank' rel='noopener noreferrer' className='brand-btn rounded-lg px-5 py-2 text-sm'>
								在线体验
							</Link>
						)}
						{work.github && (
							<Link
								href={work.github}
								target='_blank'
								rel='noopener noreferrer'
								className='bg-card hover:bg-bg rounded-lg border px-5 py-2 text-sm font-medium transition-colors'>
								GitHub
							</Link>
						)}
					</>
				)}
			</div>

			{isEditMode ? (
				<textarea
					value={work.content}
					onChange={e => handleFieldChange('content', e.target.value)}
					placeholder='详细介绍（Markdown）'
					className='border-secondary/20 min-h-[240px] w-full resize-none rounded-lg border p-3 text-sm focus:outline-none'
				/>
			) : (
				work.content &&
				(loading ? (
					<div className='text-secondary text-sm'>加载中...</div>
				) : (
					<div className='prose prose-sm border-secondary/10 max-w-none border-t pt-4'>{content}</div>
				))
			)}

			{isEditMode && showImageDialog && (
				<ImageUploadDialog currentImage={work.image} onClose={() => setShowImageDialog(false)} onSubmit={handleImageSubmit} />
			)}
		</motion.div>
	)
}
