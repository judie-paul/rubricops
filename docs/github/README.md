# Incremental GitHub delivery queue

Publishing is deferred at the user's request until GitHub access is restored.
These are prepared local branches and drafts, not claims of remote issues or PRs.

| Order | Local branch            | Base                    | Change                                            |
| ----- | ----------------------- | ----------------------- | ------------------------------------------------- |
| 1     | `chore/repo-standards`  | `main`                  | Repository standards and templates                |
| 2     | `feat/evaluation-core`  | `chore/repo-standards`  | Data model, auth, queue, review service and tests |
| 3     | `feat/review-workspace` | `feat/evaluation-core`  | Responsive workspace and browser scenarios        |
| 4     | `build/local-delivery`  | `feat/review-workspace` | Containers, reproducibility, CI, docs and results |

The local `main` branch still contains the original starter. Each feature branch
contains its predecessor's commits. This preserves real development history and
allows one reviewable PR per step, instead of one combined project commit.

When access returns:

1. Confirm the GitHub account and create the `rubricops` repository. Push original
   `main`, then the prepared branches, without force-pushing.
2. Create the four issues from `01-issue.md` through `04-issue.md`.
3. Open the standards PR against `main` using `01-pr.md`; substitute its real issue
   number in the closing reference. Review and merge.
4. Open the core PR against the now-updated `main`, then workspace, then delivery.
   Use merge commits so the prepared stacked branches retain their shared ancestry.
   If repository policy requires squash, rebase the next branch carefully after
   each merge rather than reintroducing already-merged changes.
5. Run relevant checks on every PR. The full automated workflow arrives with the
   delivery PR; earlier PR validation commands are listed in their drafts. Require
   passing CI before merging the delivery PR.
6. Verify the final main branch, enable branch protection for the actual check
   names, close the completed issues, and prepare a release from the verified SHA.
   Record real PR, issue, CI and release links in PROGRESS.md.
7. Configure hosted services separately when credentials are available. Validate a
   real deployment before adding a public application URL to the README.

Do not create empty PRs, fake intermediate changes or retrospective test results.
The drafts describe existing committed implementation. Regenerate validation as
needed against each actual PR head and report its real result.
