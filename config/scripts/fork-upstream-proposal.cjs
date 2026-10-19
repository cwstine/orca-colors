const UPSTREAM = { owner: 'stablyai', repo: 'orca', branch: 'main' }

async function proposeUpstreamUpdate({ github, context, core, createPullRequests = false }) {
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
      'Resolve any merge conflicts while preserving terminal colors and project defaults. Review the diff and run Fork checks before merging. This automation does not merge or install updates.',
      '',
      '## Testing',
      'GitHub may require approval before running checks on an automation-created pull request. Approve the workflow run or dispatch Fork checks for the PR merge ref. Rebuild Orca Colors after merging.'
    ].join('\n'),
    maintainer_can_modify: false
  })
  core.info(`Created ${result.data.html_url}`)
  return { changed: true, url: result.data.html_url }
}

module.exports = { proposeUpstreamUpdate }
