'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './cat-loader.module.css'

export default function CatLoader({ ready = false, onComplete }: { ready?: boolean; onComplete?: () => void }) {
	const [progress, setProgress] = useState(4)
	const started = useRef(0)
	const complete = useRef(onComplete)
	useEffect(() => { complete.current = onComplete }, [onComplete])
	useEffect(() => {
		started.current = Date.now()
		const timer = setInterval(() => {
			setProgress(value => value === 100 ? 100 : Math.min(99, 4 + Math.floor((Date.now() - started.current) / 65)))
		}, 80)
		return () => clearInterval(timer)
	}, [])
	useEffect(() => {
		if (!ready) return
		const delay = Math.max(0, 550 - (Date.now() - started.current))
		const finish = setTimeout(() => setProgress(100), delay)
		const hide = setTimeout(() => complete.current?.(), delay + 320)
		return () => { clearTimeout(finish); clearTimeout(hide) }
	}, [ready])

	return (
		<div className={styles.loading} data-testid='cat-loader'>
			<div className={styles.label}><span role='status'>{progress === 100 ? '准备好了，喵！' : progress === 99 ? '马上就好，再等小猫一下…' : '小猫正在搬运内容…'}</span><span className={styles.percent}>{progress}%</span></div>
			<div className={styles.track} role='progressbar' aria-label='内容加载进度' aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
				<div className={styles.fill} style={{ width: `${progress}%` }} />
				<div className={styles.runner} style={{ left: `${progress}%` }} aria-hidden='true'>
					<svg className={styles.cat} viewBox='0 0 64 54' fill='none'>
						<path d='M47 35c13 0 13-17 5-17' stroke='currentColor' strokeWidth='4' strokeLinecap='round' />
						<ellipse cx='32' cy='36' rx='15' ry='11' fill='currentColor' />
						<path d='M16 23 16 8 26 15Q32 12 38 15L48 8 47 25Q46 36 32 36 17 35 16 23Z' fill='currentColor' />
						<path d='m20 17 1-4 4 4m14 0 5-4-1 6' fill='#f5d8cc' />
						<path d='M24 24h1m14 0h1' stroke='white' strokeWidth='3' strokeLinecap='round' />
						<path d='m30 28 2 2 2-2m-2 2v3' stroke='white' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
						<path d='m19 28-8-1m8 4-8 2m34-5 8-1m-8 4 8 2' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
						<path d='m24 42-4 5m20-5 4 5' stroke='currentColor' strokeWidth='5' strokeLinecap='round' />
					</svg><span className={styles.shadow} />
				</div>
			</div>
		</div>
	)
}
