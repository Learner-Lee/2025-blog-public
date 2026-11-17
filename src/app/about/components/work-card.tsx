'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useSize } from '@/hooks/use-size'
import ImageUploadDialog, { type ImageItem } from '@/app/projects/components/image-upload-dialog'
import type { Work } from '../services/push-about'
import CatLoader from './cat-loader'

const WorkDescription = dynamic(() => import('./work-description'), { loading: () => null })

function ExpandedDescription({ markdown }: { markdown: string }) {
	const [mounted, setMounted] = useState(false)
	const [ready, setReady] = useState(false)
	const [revealed, setRevealed] = useState(false)
	const markReady = useCallback(() => setReady(true), [])
	useEffect(() => setMounted(true), [])
	const loader = <div className='bg-card/95 fixed bottom-6 left-1/2 z-[100] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border p-4 shadow-xl backdrop-blur-xl'><CatLoader ready={ready} onComplete={() => setRevealed(true)} /></div>
	return (
		<div className='border-secondary/10 border-t pt-5' aria-busy={!revealed}>
			{!revealed && (mounted ? createPortal(loader, document.body) : <CatLoader />)}
			<div hidden={!revealed}><WorkDescription markdown={markdown} onReady={markReady} /></div>
		</div>
	)
}

interface WorkCardProps {
	work: Work
	isEditMode?: boolean
	onUpdate?: (work: Work, imageItem?: ImageItem) => void
	onDelete?: () => void
	expanded?: boolean
	onToggle?: () => void
}

export function WorkCard({ work, isEditMode = false, onUpdate, onDelete, expanded = false, onToggle }: WorkCardProps) {
	const { maxSM } = useSize()
	const [showImageDialog, setShowImageDialog] = useState(false)
	const reduceMotion = useReducedMotion()

	const handleFieldChange = (field: keyof Work, value: any) => {
		onUpdate?.({ ...work, [field]: value })
	}

	const handleImageSubmit = (image: ImageItem) => {
		const imageUrl = image.type === 'url' ? image.url : image.previewUrl
		onUpdate?.({ ...work, image: imageUrl }, image)
	}

	if (!isEditMode) {
		return (
			<motion.article
				data-work-card={work.id}
				data-expanded={expanded}
				layout={reduceMotion ? false : true}
				initial={reduceMotion ? false : { opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				whileHover={reduceMotion || expanded ? undefined : { scale: 1.025, y: -4 }}
				transition={{ type: 'spring', stiffness: 350, damping: 28 }}
				className='card group relative flex h-full flex-col p-5 transition-shadow duration-300 hover:z-[1] hover:shadow-xl max-sm:p-4'>
				{expanded && <div className='mb-4 flex items-center justify-between gap-3'><span className='text-secondary text-xs'>作品详情</span><button type='button' onClick={onToggle} className='text-secondary hover:text-brand rounded-lg px-3 py-2 text-sm' aria-label={`收起「${work.name}」详情`}>收起详情 ↙</button></div>}
				<button
					type='button'
					onClick={expanded ? undefined : onToggle}
					aria-expanded={expanded}
					aria-controls={`description-${work.id}`}
					aria-label={`${expanded ? '已展开' : '展开'}「${work.name}」详情`}
					className={cn('flex w-full flex-1 flex-col rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand', expanded ? 'cursor-default' : 'cursor-pointer')}>
					<div className='bg-secondary/5 overflow-hidden rounded-xl'>
						{work.image ? (
							<img src={work.image} alt={work.name} className='aspect-video w-full object-cover' />
						) : (
							<div className='text-secondary flex aspect-video items-center justify-center text-sm'>暂无封面</div>
						)}
					</div>
					<div className='flex flex-1 flex-col gap-3 pt-5'>
						<div className='flex items-baseline justify-between gap-3'>
							<span role='heading' aria-level={2} className={cn('font-bold', expanded ? 'text-3xl max-sm:text-2xl' : 'text-xl')}>{work.name}</span>
							<span className='text-secondary shrink-0 text-xs'>{work.year}</span>
						</div>
						<span className={cn('text-secondary text-sm leading-6', !expanded && 'line-clamp-2 min-h-12')}>{work.tagline}</span>
						<div className='flex flex-wrap gap-2'>
							{work.tags.map(tag => <span key={tag} className='text-secondary bg-bg rounded-lg px-2 py-1 text-xs'>{tag}</span>)}
						</div>
					</div>
				</button>
				<div className='border-secondary/10 mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4'>
					<button type='button' onClick={onToggle} className='text-secondary hover:text-brand rounded-lg py-2 text-sm' aria-expanded={expanded} aria-controls={`description-${work.id}`}>{expanded ? '收起详情 ↙' : '展开详情 ↗'}</button>
					<div className='flex flex-wrap gap-2'>
						{work.github && <a href={work.github} target='_blank' rel='noopener noreferrer' className='text-secondary hover:text-brand rounded-lg border px-3 py-2 text-xs'>GitHub ↗</a>}
						{work.demo && <a href={work.demo} target='_blank' rel='noopener noreferrer' className='brand-btn rounded-lg px-4 py-2 text-xs' onClick={event => event.stopPropagation()}>在线体验 ↗</a>}
					</div>
				</div>
				{expanded && <div id={`description-${work.id}`} className='mt-5'><ExpandedDescription markdown={work.content} /></div>}
			</motion.article>
		)
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

			<textarea
				value={work.content}
				onChange={e => handleFieldChange('content', e.target.value)}
				placeholder='详细介绍（Markdown）'
				className='border-secondary/20 min-h-[240px] w-full resize-none rounded-lg border p-3 text-sm focus:outline-none'
			/>

			{isEditMode && showImageDialog && (
				<ImageUploadDialog currentImage={work.image} onClose={() => setShowImageDialog(false)} onSubmit={handleImageSubmit} />
			)}
		</motion.div>
	)
}
