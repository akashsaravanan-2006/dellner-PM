import ProjectsView from '../components/ProjectsView';

export default function CompletedProjects({ user }) {
  return <ProjectsView status="completed" title="Completed projects" empty="No completed projects yet." user={user} />;
}
