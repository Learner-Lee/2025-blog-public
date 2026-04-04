'use client'

import { useState, useRef } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { DialogModal } from './dialog-modal'

interface PasswordDialogProps {
	open: boolean
	onClose: () => void
	onConfirm: (keyContent: string) => void
}

export function PasswordDialog({ open, onClose, onConfirm }: PasswordDialogProps) {
	const [loading, setLoading] = useState(false)
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const handleClose = () => {
		setSelectedFile(null)
		onClose()
	}

	const handleConfirm = async () => {
		if (!selectedFile) {
			toast.error('请先选择密钥文件')
			return
		}

		setLoading(true)
		try {
			const content = await selectedFile.text()

			const res = await fetch('/api/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password: content })
			})

			if (res.ok) {
				onConfirm(content)
				setSelectedFile(null)
				onClose()
			} else {
				toast.error('密钥验证失败，请确认文件正确')
			}
		} catch {
			toast.error('验证失败，请重试')
		} finally {
			setLoading(false)
		}
	}

	return (
		<DialogModal open={open} onClose={handleClose} className='card w-80 p-6'>
			<h3 className='mb-4 text-base font-medium'>导入密钥文件</h3>

			<input
				ref={fileInputRef}
				type='file'
				accept='.key,.pem'
				className='hidden'
				onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
			/>

			<div
				onClick={() => fileInputRef.current?.click()}
				className='mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D9D9D9] py-8 transition-colors hover:border-brand/40'>
				{selectedFile ? (
					<p className='text-sm font-medium text-brand'>{selectedFile.name}</p>
				) : (
					<>
						<p className='text-secondary text-sm'>点击选择密钥文件</p>
						<p className='text-secondary/60 mt-1 text-xs'>.key 格式</p>
					</>
				)}
			</div>

			<div className='flex justify-end gap-2'>
				<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleClose} className='bg-card rounded-xl border px-4 py-2 text-sm'>
					取消
				</motion.button>
				<motion.button
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					onClick={handleConfirm}
					disabled={loading || !selectedFile}
					className='brand-btn px-6'>
					{loading ? '验证中...' : '确认'}
				</motion.button>
			</div>
		</DialogModal>
	)
}
