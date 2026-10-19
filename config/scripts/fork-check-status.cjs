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
  if (merge.parents[0]?.sha !== pull.base.sha || merge.parents[1]?.sha !== pull.head.sha) {
    throw new Error('Merge candidate is stale or has conflicts; retry after GitHub refreshes it.')
  }
  for (const [key, value] of Object.entries({
    merge: merge.sha,
    head: pull.head.sha,
    base: pull.base.sha
  })) {
    core.setOutput(key, value)
  }
}

async function publish({ github, context, number, head, base, result }) {
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
}

module.exports = { prepare, publish }
