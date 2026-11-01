import ProjectsView from '../components/ProjectsView';

export default function UpcomingProjects({ user }) {
  return <ProjectsView status="upcoming" title="Upcoming projects" empty="Nothing planned yet. Add the next project." user={user} />;
}
