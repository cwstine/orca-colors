const UPSTREAM = { owner: 'stablyai', repo: 'orca', branch: 'main' }

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
  const head = `${UPSTREAM.owner}:${UPSTREAM.branch}`
  const comparison = await github.rest.repos.compareCommitsWithBasehead({
    ...repo,
    basehead: `staging...${head}`
  })
  if (comparison.data.ahead_by === 0) {
    core.info('The customized staging branch already contains all upstream commits.')
    return { changed: false }
  }
  const existing = await github.rest.pulls.list({ ...repo, state: 'open', base: 'staging', head })
  if (existing.data.length) {
    core.info(`Upstream updates are already tracked by ${existing.data[0].html_url}`)
    await configureUpdate(existing.data[0])
    return { changed: true, url: existing.data[0].html_url }
  }
  if (!createPullRequests) {
    const url = `https://github.com/${repo.owner}/${repo.repo}/compare/staging...stablyai:orca:main`
    core.info(`Upstream updates are available: ${url}. Automatic PR creation is not enabled.`)
    return { changed: true, url, reportOnly: true }
  }
  const result = await github.rest.pulls.create({
    ...repo,
    base: 'staging',
    head,
    title: 'Update Orca Colors with upstream Orca changes',
    body: [
      '## What changes',
      'Brings the latest stablyai/orca main commits into the customized staging branch.',
      'The source branch tracks upstream directly, so this proposal stays current without copying or force-pushing custom commits.',
      '',
      '## Review',
      'Passing updates merge automatically into staging. Merge conflicts or failed fork checks leave this PR open for review, preserving terminal colors and project defaults.',
      '',
      '## Testing',
      'The update job dispatches Fork checks for the combined upstream and customized code. GitHub requires the Orca Colors checks status before auto-merge. Rebuild Orca Colors after merging; this does not install app updates.'
    ].join('\n'),
    maintainer_can_modify: false
  })
  await configureUpdate(result.data)
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
    if (!pull.auto_merge) {
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
}

module.exports = { proposeUpstreamUpdate }
