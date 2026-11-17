import CatLoader from './components/cat-loader'

export default function Loading() {
	return <div className='mx-auto w-full max-w-[700px] px-6 pt-40'><div className='card p-8'><CatLoader /></div></div>
}
