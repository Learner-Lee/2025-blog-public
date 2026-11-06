'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const MSG_TYPE = 'html-note-height'
const MAX_HEIGHT = 40000

// 沙箱 iframe 是 opaque origin，父页面读不到它的高度，只能由内部脚本 postMessage 上报。
// 笔记若用 100vh 布局，高度会随 iframe 变高而变高：溢出量恒定而视口在变，连续 3 次即视为反馈循环，停止上报。
const RESIZE_SCRIPT = `<script>(function(){
var lastD=-1,lastV=-1,same=0;
function post(){
var h=document.documentElement.scrollHeight,v=innerHeight,d=h-v;
if(d>0&&d===lastD&&v!==lastV){if(++same>=3)return}else same=0;
lastD=d;lastV=v;
parent.postMessage({type:'${MSG_TYPE}',height:h},'*')}
addEventListener('load',post);
new ResizeObserver(post).observe(document.documentElement)})()</script>`

function buildSrcDoc(html: string): string {
	// 链接默认在新标签页打开，否则会在 iframe 内部跳转
	const base = /<base[\s>]/i.test(html) ? '' : '<base target="_blank">'
	return html + base + RESIZE_SCRIPT
}

export function HtmlNote({ html }: { html: string }) {
	const ref = useRef<HTMLIFrameElement>(null)
	const [height, setHeight] = useState(600)
	const srcDoc = useMemo(() => buildSrcDoc(html), [html])

	useEffect(() => {
		const onMessage = (e: MessageEvent) => {
			if (e.source !== ref.current?.contentWindow || e.data?.type !== MSG_TYPE) return
			const h = Number(e.data.height)
			if (h > 0) setHeight(Math.min(Math.ceil(h), MAX_HEIGHT))
		}
		window.addEventListener('message', onMessage)
		return () => window.removeEventListener('message', onMessage)
	}, [])

	return (
		<iframe
			ref={ref}
			title='HTML 笔记'
			srcDoc={srcDoc}
			// 不给 allow-same-origin：笔记里的脚本能运行，但碰不到本站的存储和接口
			sandbox='allow-scripts allow-popups allow-popups-to-escape-sandbox'
			className='w-full rounded-lg border-0'
			style={{ height }}
		/>
	)
}
