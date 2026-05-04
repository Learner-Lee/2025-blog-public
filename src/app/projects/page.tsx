import { promises as fs } from 'fs'
import path from 'path'
import { ProjectsClient } from './projects-client'
import type { Project } from './components/project-card'

async function getProjects(): Promise<Project[]> {
	try {
		const raw = await fs.readFile(path.join(process.cwd(), 'public', 'data', 'projects.json'), 'utf-8')
		return JSON.parse(raw)
	} catch {
		return []
	}
}

export default async function Page() {
	const projects = await getProjects()
	return <ProjectsClient initialProjects={projects} />
}
