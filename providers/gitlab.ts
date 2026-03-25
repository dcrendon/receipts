import { GitlabIssue, GitlabNote } from "../shared/types.ts";
import { requestJsonWithRetry } from "./http_client.ts";

interface GitLabProject {
  id: number;
  [key: string]: unknown;
}

const getPaginatedResults = async <T>(
  gitlabURL: string,
  headers: Record<string, string>,
  params: Record<string, string | number> = {},
): Promise<T[]> => {
  const allResults: T[] = [];
  const perPage = 100;

  for (let page = 1;; page++) {
    const url = new URL(gitlabURL);
    const query = new URLSearchParams(
      Object.entries({ ...params, page, per_page: perPage }).map((
        [key, value],
      ) => [key, String(value)]),
    );
    url.search = query.toString();

    const data = await requestJsonWithRetry<T[]>(
      url.toString(),
      { headers },
      "GitLab",
    );

    if (!data.length) break;
    allResults.push(...data);
  }

  return allResults;
};

const getUserID = async (
  gitlabURL: string,
  headers: Record<string, string>,
): Promise<number> => {
  const data = await requestJsonWithRetry<{ id: number }>(
    `${gitlabURL}/api/v4/user`,
    { headers },
    "GitLab user",
  );

  return data.id;
};

const getProjects = async (
  gitlabURL: string,
  headers: Record<string, string>,
  userID: number,
): Promise<GitLabProject[]> => {
  const projectsURL =
    `${gitlabURL}/api/v4/users/${userID}/contributed_projects`;
  const projects = await getPaginatedResults<GitLabProject>(
    projectsURL,
    headers,
  );

  return projects;
};

const addUniqueIssues = (
  issueMap: Map<number, GitlabIssue>,
  issues: GitlabIssue[],
) => {
  for (const issue of issues) {
    issueMap.set(issue.id, issue);
  }
};

const fetchProjectIssues = async (
  projectID: number,
  gitlabURL: string,
  headers: Record<string, string>,
  startDate: string,
  endDate: string,
): Promise<GitlabIssue[]> => {
  const projectURL = `${gitlabURL}/api/v4/projects/${projectID}/issues`;

  return await getPaginatedResults<GitlabIssue>(projectURL, headers, {
    scope: "all",
    updated_after: startDate,
    updated_before: endDate,
  });
};

const getIssues = async (
  projects: GitLabProject[],
  gitlabURL: string,
  headers: Record<string, string>,
  userID: number,
  startDate: string,
  endDate: string,
) => {
  const issuesToProcess = new Map<number, GitlabIssue>();

  for (const project of projects) {
    const projectIssues = await fetchProjectIssues(
      project.id,
      gitlabURL,
      headers,
      startDate,
      endDate,
    );
    addUniqueIssues(issuesToProcess, projectIssues);
  }

  return issuesToProcess;
};

const isContributor = (
  issue: GitlabIssue,
  notes: GitlabNote[],
  userID: number,
): boolean => {
  if (issue.author?.id === userID) return true;
  if (issue.assignees?.some((assignee) => assignee.id === userID)) return true;
  return notes.some((note) => note.author?.id === userID);
};

const filterNotes = async (
  issues: Map<number, GitlabIssue>,
  gitlabURL: string,
  headers: Record<string, string>,
  userID: number,
) => {
  const finalIssues: GitlabIssue[] = [];

  for (const issue of issues.values()) {
    const notesURL =
      `${gitlabURL}/api/v4/projects/${issue.project_id}/issues/${issue.iid}/notes`;
    const notes = await getPaginatedResults<GitlabNote>(notesURL, headers, {
      sort: "asc",
      order_by: "created_at",
    });

    issue.notes = notes;
    if (isContributor(issue, notes, userID)) {
      finalIssues.push(issue);
    }
  }

  return finalIssues;
};

export const gitlabIssues = async (
  gitlabURL: string,
  headers: Record<string, string>,
  startDate: string,
  endDate: string,
) => {
  const userID = await getUserID(gitlabURL, headers);
  const projects = await getProjects(gitlabURL, headers, userID);

  const issuesToProcess = await getIssues(
    projects,
    gitlabURL,
    headers,
    userID,
    startDate,
    endDate,
  );

  if (!issuesToProcess.size) {
    return [];
  }

  return await filterNotes(
    issuesToProcess,
    gitlabURL,
    headers,
    userID,
  );
};
