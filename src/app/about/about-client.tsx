'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { pushAbout, type AboutData, type Work } from './services/push-about'
import { WorkCard } from './components/work-card'
import type { ImageItem } from '@/app/projects/components/image-upload-dialog'
import { useAuthStore } from '@/hooks/use-auth'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import LikeButton from '@/components/like-button'
import GithubSVG from '@/svgs/github.svg'
import { PasswordDialog } from '@/components/password-dialog'

function createWork(): Work {
	return {
		id: `work-${Date.now()}`,
		name: '新作品',
		year: new Date().getFullYear(),
		tagline: '',
		image: '',
		tags: [],
		content: ''
	}
}

export default function AboutClient({ initialData }: { initialData: AboutData }) {
	const [data, setData] = useState<AboutData>(initialData)
	const [originalData, setOriginalData] = useState<AboutData>(initialData)
	const [imageItems, setImageItems] = useState<Map<string, ImageItem>>(new Map())
	const [showPasswordDialog, setShowPasswordDialog] = useState(false)
	const [isEditMode, setIsEditMode] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const { isAuth, setPrivateKey } = useAuthStore()
	const { siteContent } = useConfigStore()
	const hideEditButton = siteContent.hideEditButton ?? false

	const handleSaveClick = () => {
		if (!isAuth) {
			setShowPasswordDialog(true)
		} else {
			handleSave()
		}
	}

	const handleSave = async () => {
		setIsSaving(true)

		try {
			const saved = await pushAbout({ data, imageItems })

			setData(saved)
			setOriginalData(saved)
			setImageItems(new Map())
			setIsEditMode(false)
			toast.success('保存成功！')
		} catch (error: any) {
			console.error('Failed to save:', error)
			toast.error(`保存失败: ${error?.message || '未知错误'}`)
		} finally {
			setIsSaving(false)
		}
	}

	const handleCancel = () => {
		setData(originalData)
		setImageItems(new Map())
		setIsEditMode(false)
	}

	const handleUpdateWork = (updated: Work, imageItem?: ImageItem) => {
		setData(prev => ({ ...prev, works: prev.works.map(w => (w.id === updated.id ? updated : w)) }))
		if (imageItem) {
			setImageItems(prev => new Map(prev).set(updated.id, imageItem))
		}
	}

	const handleDeleteWork = (work: Work) => {
		if (!confirm(`确定要删除「${work.name}」吗？`)) return
		setData(prev => ({ ...prev, works: prev.works.filter(w => w.id !== work.id) }))
		setImageItems(prev => {
			const next = new Map(prev)
			next.delete(work.id)
			return next
		})
	}

	const handleAddWork = () => {
		setData(prev => ({ ...prev, works: [...prev.works, createWork()] }))
	}

	const buttonText = isAuth ? '保存' : '导入密钥'

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!isEditMode && (e.ctrlKey || e.metaKey) && e.key === ',') {
				e.preventDefault()
				setIsEditMode(true)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => {
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [isEditMode])

	return (
		<>
			<PasswordDialog
				open={showPasswordDialog}
				onClose={() => setShowPasswordDialog(false)}
				onConfirm={pwd => {
					setPrivateKey(pwd)
					handleSave()
				}}
			/>

			<div className='flex flex-col items-center justify-center px-6 pt-32 pb-12 max-sm:px-0'>
				<div className='w-full max-w-[800px]'>
					<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className='mb-12 text-center'>
						{isEditMode ? (
							<div className='space-y-4'>
								<input
									type='text'
									placeholder='标题'
									className='w-full px-4 py-3 text-center text-2xl font-bold'
									value={data.title}
									onChange={e => setData({ ...data, title: e.target.value })}
								/>
								<input
									type='text'
									placeholder='描述'
									className='w-full px-4 py-3 text-center text-lg'
									value={data.description}
									onChange={e => setData({ ...data, description: e.target.value })}
								/>
							</div>
						) : (
							<>
								<h1 className='mb-4 text-4xl font-bold'>{data.title}</h1>
								<p className='text-secondary text-lg'>{data.description}</p>
							</>
						)}
					</motion.div>

					<div className='flex flex-col gap-10'>
						{data.works.map(work => (
							<WorkCard key={work.id} work={work} isEditMode={isEditMode} onUpdate={handleUpdateWork} onDelete={() => handleDeleteWork(work)} />
						))}
					</div>

					{data.works.length === 0 && !isEditMode && <div className='text-secondary text-center'>还没有作品</div>}

					{isEditMode && (
						<button
							onClick={handleAddWork}
							className='border-secondary/30 text-secondary hover:border-brand hover:text-brand mt-10 w-full rounded-xl border border-dashed py-4 text-sm transition-colors'>
							+ 添加作品
						</button>
					)}

					<div className='mt-12 flex items-center justify-center gap-6'>
						<motion.a
							href='https://github.com/Learner-Lee'
							target='_blank'
							rel='noreferrer'
							initial={{ opacity: 0, scale: 0.6 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ delay: 0 }}
							className='bg-card flex h-[53px] w-[53px] items-center justify-center rounded-full border'>
							<GithubSVG />
						</motion.a>

						<LikeButton slug='open-source' delay={0} />
					</div>
				</div>
			</div>

			<motion.div
				initial={{ opacity: 0, scale: 0.6 }}
				animate={{ opacity: 1, scale: 1 }}
				className='fixed top-4 right-6 z-10 flex gap-3 max-sm:hidden'>
				{isEditMode ? (
					<>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleCancel}
							disabled={isSaving}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
							取消
						</motion.button>
						<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleSaveClick} disabled={isSaving} className='brand-btn px-6'>
							{isSaving ? '保存中...' : buttonText}
						</motion.button>
					</>
				) : (
					!hideEditButton && (
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => setIsEditMode(true)}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/80'>
							编辑
						</motion.button>
					)
				)}
			</motion.div>
		</>
	)
}
