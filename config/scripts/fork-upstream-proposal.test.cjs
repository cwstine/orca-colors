const { test } = require('node:test')
const assert = require('node:assert/strict')
const { proposeUpstreamUpdate } = require('./fork-upstream-proposal.cjs')

function fixture(ahead, existing = []) {
  const calls = []
  return {
    calls,
    createPullRequests: true,
    context: { repo: { owner: 'cwstine', repo: 'orca-colors' } },
    core: { info() {} },
    github: {
      rest: {
        repos: {
          compareCommitsWithBasehead: async (args) => {
            calls.push(['compare', args])
            return { data: { ahead_by: ahead } }
          }
        },
        pulls: {
          list: async (args) => {
            calls.push(['list', args])
            return { data: existing }
          },
          create: async (args) => {
            calls.push(['create', args])
            return { data: { html_url: 'https://github.com/cwstine/orca-colors/pull/1' } }
          }
        }
      }
    }
  }
}

test('does nothing when staging already contains upstream', async () => {
  const f = fixture(0)
  assert.deepEqual(await proposeUpstreamUpdate(f), { changed: false })
  assert.equal(f.calls.length, 1)
})
test('proposes upstream directly to staging without mutating any branches', async () => {
  const f = fixture(2)
  await proposeUpstreamUpdate(f)
  const args = f.calls.find(([name]) => name === 'create')[1]
  assert.equal(args.base, 'staging')
  assert.equal(args.head, 'stablyai:main')
  assert.equal(args.maintainer_can_modify, false)
})
test('reuses an existing upstream PR instead of duplicating it', async () => {
  const f = fixture(3, [{ html_url: 'existing' }])
  assert.equal((await proposeUpstreamUpdate(f)).url, 'existing')
  assert.ok(!f.calls.some(([name]) => name === 'create'))
})
test('refuses to operate in another repository', async () => {
  const f = fixture(2)
  f.context.repo.owner = 'stablyai'
  await assert.rejects(proposeUpstreamUpdate(f), /restricted/)
  assert.equal(f.calls.length, 0)
})
test('surfaces API failures so a failed update cannot appear successful', async () => {
  const f = fixture(1)
  f.github.rest.pulls.create = async () => {
    throw new Error('permission denied')
  }
  await assert.rejects(proposeUpstreamUpdate(f), /permission denied/)
})

test('report-only mode never attempts to create or approve a PR', async () => {
  const f = fixture(2)
  f.createPullRequests = false
  const result = await proposeUpstreamUpdate(f)
  assert.equal(result.reportOnly, true)
  assert.ok(result.url.includes('/compare/staging...'))
  assert.ok(!f.calls.some(([name]) => name === 'create'))
})
