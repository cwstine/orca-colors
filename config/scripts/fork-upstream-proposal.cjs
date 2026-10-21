const UPSTREAM = { owner: 'stablyai', repo: 'orca', branch: 'main' }
const SNAPSHOT_PREFIX = 'updates/orca-main-'

async function proposeUpstreamUpdate({
  github,
  context,
  core,
  createPullRequests = false,
  autoMerge = false
}) {
  const repo = context.repo
  if (repo.owner !== 'cwstine' || repo.repo !== 'orca-colors') {
    throw new Error('This automation is restricted to cwstine/orca-colors.')
  }
  const open = (
    await github.rest.pulls.list({ ...repo, state: 'open', base: 'staging', per_page: 100 })
  ).data
  const existing = open.find(
    (pull) =>
      pull.head.repo?.full_name === 'cwstine/orca-colors' &&
      pull.head.ref.startsWith(SNAPSHOT_PREFIX)
  )
  if (existing) {
    core.info(
      `Finishing the pinned upstream update ${existing.html_url} before taking another snapshot.`
    )
    await configureUpdate(existing)
    return { changed: true, url: existing.html_url }
  }
  const upstream = await github.rest.git.getRef({
    owner: UPSTREAM.owner,
    repo: UPSTREAM.repo,
    ref: `heads/${UPSTREAM.branch}`
  })
  const sha = upstream.data.object.sha
  const comparison = await github.rest.repos.compareCommitsWithBasehead({
    ...repo,
    basehead: `staging...${sha}`
  })
  if (comparison.data.ahead_by === 0) {
    core.info('The customized staging branch already contains all upstream commits.')
    return { changed: false }
  }
  if (!createPullRequests) {
    const url = `https://github.com/${repo.owner}/${repo.repo}/compare/staging...stablyai:orca:main`
    core.info(`Upstream updates are available: ${url}. Automatic PR creation is not enabled.`)
    return { changed: true, url, reportOnly: true }
  }
  const branch = `${SNAPSHOT_PREFIX}${sha}`
  try {
    await github.rest.git.createRef({ ...repo, ref: `refs/heads/${branch}`, sha })
  } catch (error) {
    if (error.status === 403) {
      throw new Error(
        'ORCA_COLORS_SYNC_TOKEN could not create the upstream snapshot. Check token expiry, repository access, and Contents and Workflows write permissions.',
        { cause: error }
      )
    }
    if (error.status !== 422) {
      throw error
    }
    const ref = await github.rest.git.getRef({ ...repo, ref: `heads/${branch}` })
    if (ref.data.object.sha !== sha) {
      throw new Error('The upstream snapshot branch changed; refusing to overwrite it.')
    }
  }
  const result = await github.rest.pulls.create({
    ...repo,
    base: 'staging',
    head: `${repo.owner}:${branch}`,
    title: `Update Orca Colors from upstream main (${sha.slice(0, 8)})`,
    body: [
      '## What changes',
      `Merges stablyai/orca main at ${sha} into the customized staging branch.`,
      'The source branch is fixed at that upstream commit so new upstream pushes cannot invalidate the checks. Later commits are picked up by the next hourly run.',
      '',
      '## Review',
      'Passing updates merge automatically into staging. Conflicts and failed checks leave this PR open for attention, preserving terminal colors and project defaults.',
      '',
      '## Testing',
      'Fork checks tests the combined upstream and customized code. GitHub requires the Orca Colors checks status before auto-merge. This updates repository source; rebuild the desktop app to use it.'
    ].join('\n'),
    maintainer_can_modify: false
  })
  await configureUpdate(result.data)
  for (const legacy of open.filter(
    (pull) => pull.head.repo?.full_name === 'stablyai/orca' && pull.head.ref === 'main'
  )) {
    await github.rest.pulls.update({ ...repo, pull_number: legacy.number, state: 'closed' })
  }
  core.info(`Created ${result.data.html_url}`)
  return { changed: true, url: result.data.html_url }

  async function configureUpdate(pull) {
    if (!autoMerge) {
      return
    }
    await github.rest.actions.createWorkflowDispatch({
      ...repo,
      workflow_id: 'fork-checks.yml',
      ref: 'staging',
      inputs: { pr_number: String(pull.number) }
    })
  }
}
module.exports = { proposeUpstreamUpdate }
