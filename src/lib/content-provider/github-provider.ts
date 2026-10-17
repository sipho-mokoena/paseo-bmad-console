import type { ContentProvider, ContentProviderTree } from "./types";
import type { GitHubOctokit } from "@/lib/github/client";
import {
  getCachedRepoTree,
  getCachedRawContent,
} from "@/lib/github/client";

export class GitHubProvider implements ContentProvider {
  constructor(
    private octokit: GitHubOctokit,
    private owner: string,
    private repo: string,
    private branch: string,
  ) {}

  async getTree(): Promise<ContentProviderTree> {
    const tree = await getCachedRepoTree(
      this.octokit,
      this.owner,
      this.repo,
      this.branch,
    );

    const paths: string[] = [];
    const rootDirectories: string[] = [];

    for (const item of tree.tree) {
      if (item.type === "blob") {
        paths.push(item.path);
      } else if (item.type === "tree" && !item.path.includes("/")) {
        rootDirectories.push(item.path);
      }
    }

    return { paths, rootDirectories };
  }

  async getFileContent(filePath: string): Promise<string> {
    return getCachedRawContent(
      this.octokit,
      this.owner,
      this.repo,
      this.branch,
      filePath,
    );
  }

  async validateRoot(): Promise<void> {
    // No-op: the repo exists if it's in the DB.
  }
}
