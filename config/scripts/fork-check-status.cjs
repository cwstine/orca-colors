const STATUS = 'Orca Colors checks'

function checkPull(pull) {
  const legacyUpstream = pull.head.repo?.full_name === 'stablyai/orca' && pull.head.ref === 'main'
  const pinnedUpstream =
    pull.head.repo?.full_name === 'cwstine/orca-colors' &&
    /^[a-f0-9]{40}$/.test(pull.head.sha) &&
    pull.head.ref === `updates/orca-main-${pull.head.sha}`
  if (
    pull.state !== 'open' ||
    pull.base.ref !== 'staging' ||
    pull.base.repo.full_name !== 'cwstine/orca-colors' ||
    (!legacyUpstream && !pinnedUpstream)
  ) {
    throw new Error('Only open upstream Orca updates targeting this fork staging are supported.')
  }
}

async function prepare({ github, context, core, number }) {
  const repo = context.repo
  const pull = (await github.rest.pulls.get({ ...repo, pull_number: number })).data
  checkPull(pull)
  await github.rest.repos.createCommitStatus({
    ...repo,
    sha: pull.head.sha,
    state: 'pending',
    context: STATUS,
    description: 'Testing upstream together with the color feature'
  })
  const merge = (await github.rest.repos.getCommit({ ...repo, ref: `refs/pull/${number}/merge` }))
    .data
  const currentBase = (await github.rest.git.getRef({ ...repo, ref: 'heads/staging' })).data.object
    .sha
  if (merge.parents[0]?.sha !== currentBase || merge.parents[1]?.sha !== pull.head.sha) {
    throw new Error('Merge candidate is stale or has conflicts; retry after GitHub refreshes it.')
  }
  for (const [key, value] of Object.entries({
    merge: merge.sha,
    head: pull.head.sha,
    base: currentBase
  })) {
    core.setOutput(key, value)
  }
}

async function publish({
  github,
  context,
  number,
  head,
  base,
  result,
  autoMerge = false,
  retryCount = 0
}) {
  const repo = context.repo
  const pull = (await github.rest.pulls.get({ ...repo, pull_number: number })).data
  checkPull(pull)
  const currentBase = (await github.rest.git.getRef({ ...repo, ref: 'heads/staging' })).data.object
    .sha
  const current = pull.head.sha === head && currentBase === base
  const success = current && result === 'success'
  await github.rest.repos.createCommitStatus({
    ...repo,
    sha: head,
    state: success ? 'success' : 'failure',
    context: STATUS,
    description: !current
      ? 'Code changed during checks; rerun Fork upstream updates'
      : success
        ? 'Color tests, automation tests, types and lint passed'
        : 'Fork validation did not pass',
    target_url: `https://github.com/${repo.owner}/${repo.repo}/actions/runs/${context.runId}`
  })
  if (!autoMerge) {
    return
  }
  if (
    !current &&
    result !== 'cancelled' &&
    Number.isInteger(retryCount) &&
    retryCount >= 0 &&
    retryCount < 3
  ) {
    await github.rest.actions.createWorkflowDispatch({
      ...repo,
      workflow_id: 'fork-checks.yml',
      ref: 'staging',
      inputs: { pr_number: String(number), retry_count: String(retryCount + 1) }
    })
  } else if (success && !pull.auto_merge) {
    await github.graphql(
      `mutation($id: ID!) {
      enablePullRequestAutoMerge(input: {pullRequestId: $id, mergeMethod: MERGE}) {
        pullRequest { number }
      }
    }`,
      { id: pull.node_id }
    )
  }
}

module.exports = { prepare, publish }
