import { GitlabIssue } from "../shared/types.ts";
import { requestJsonWithRetry } from "./http_client.ts";

const getPaginatedResults = async (
  gitlabURL: string,
  headers: Record<string, string>,
  params: Record<string, string | number> = {},
): Promise<any[]> => {
  const allResults: any[] = [];
  const perPage = 100;

  for (let page = 1;; page++) {
    const url = new URL(gitlabURL);
    const query = new URLSearchParams(
      Object.entries({ ...params, page, per_page: perPage }).map((
        [key, value],
      ) => [key, String(value)]),
    );
    url.search = query.toString();

    const data = await requestJsonWithRetry<any[]>(
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
) => {
  const projectsURL =
    `${gitlabURL}/api/v4/users/${userID}/contributed_projects`;
  const projects = await getPaginatedResults(projectsURL, headers);

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
  userID: number,
  startDate: string,
  endDate: string,
  fetchMode: string,
): Promise<GitlabIssue[]> => {
  const projectURL = `${gitlabURL}/api/v4/projects/${projectID}/issues`;

  if (fetchMode === "my_issues") {
    const baseParams = {
      scope: "all",
      created_after: startDate,
      created_before: endDate,
    };

    const [assignedIssues, createdIssues] = await Promise.all([
      getPaginatedResults(projectURL, headers, {
        ...baseParams,
        assignee_id: userID,
      }),
      getPaginatedResults(projectURL, headers, {
        ...baseParams,
        author_id: userID,
      }),
    ]);

    return [...assignedIssues, ...createdIssues];
  }

  if (fetchMode === "all_contributions") {
    return await getPaginatedResults(projectURL, headers, {
      scope: "all",
      updated_after: startDate,
      updated_before: endDate,
    });
  }

  throw new Error(`Invalid fetch mode: ${fetchMode}`);
};

const getIssues = async (
  projects: any[],
  gitlabURL: string,
  headers: Record<string, string>,
  userID: number,
  startDate: string,
  endDate: string,
  fetchMode: string,
) => {
  const issuesToProcess = new Map<number, GitlabIssue>();

  for (const project of projects) {
    const projectIssues = await fetchProjectIssues(
      project.id,
      gitlabURL,
      headers,
      userID,
      startDate,
      endDate,
      fetchMode,
    );
    addUniqueIssues(issuesToProcess, projectIssues);
  }

  return issuesToProcess;
};

const isContributor = (
  issue: GitlabIssue,
  notes: any[],
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
  fetchMode: string,
) => {
  const includeAllFetchedIssues = fetchMode === "my_issues";
  if (!includeAllFetchedIssues && fetchMode !== "all_contributions") {
    throw new Error(`Invalid fetch mode: ${fetchMode}`);
  }

  const finalIssues: GitlabIssue[] = [];

  for (const issue of issues.values()) {
    const notesURL =
      `${gitlabURL}/api/v4/projects/${issue.project_id}/issues/${issue.iid}/notes`;
    const notes = await getPaginatedResults(notesURL, headers, {
      sort: "asc",
      order_by: "created_at",
    });

    issue.notes = notes;
    if (includeAllFetchedIssues || isContributor(issue, notes, userID)) {
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
  fetchMode: string,
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
    fetchMode,
  );

  if (!issuesToProcess.size) {
    return [];
  }

  return await filterNotes(
    issuesToProcess,
    gitlabURL,
    headers,
    userID,
    fetchMode,
  );
};
