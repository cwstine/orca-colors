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
      graphql: async (query, args) => {
        calls.push(['autoMerge', args])
      },
      rest: {
        actions: {
          createWorkflowDispatch: async (args) => {
            calls.push(['dispatch', args])
          }
        },
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
            return {
              data: {
                html_url: 'https://github.com/cwstine/orca-colors/pull/1',
                number: 1,
                node_id: 'PR_1'
              }
            }
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

for (const existing of [[], [{ html_url: 'existing', number: 2, node_id: 'PR_2' }]]) {
  test(`enables gated auto-merge and dispatches checks for ${existing.length ? 'existing' : 'new'} PR`, async () => {
    const f = fixture(2, existing)
    f.autoMerge = true
    await proposeUpstreamUpdate(f)
    const dispatch = f.calls.find(([name]) => name === 'dispatch')[1]
    assert.equal(dispatch.ref, 'staging')
    assert.equal(dispatch.workflow_id, 'fork-checks.yml')
    assert.equal(dispatch.inputs.pr_number, String(existing.length ? 2 : 1))
    const merge = f.calls.find(([name]) => name === 'autoMerge')[1]
    assert.equal(merge.id, existing.length ? 'PR_2' : 'PR_1')
    assert.ok(
      f.calls.findIndex(([name]) => name === 'dispatch') <
        f.calls.findIndex(([name]) => name === 'autoMerge')
    )
  })
}
test('does not enable auto-merge unless explicitly configured', async () => {
  const f = fixture(2)
  await proposeUpstreamUpdate(f)
  assert.ok(!f.calls.some(([name]) => name === 'autoMerge' || name === 'dispatch'))
})
test('does not enable auto-merge when dispatch fails', async () => {
  const f = fixture(2)
  f.autoMerge = true
  f.github.rest.actions.createWorkflowDispatch = async () => {
    throw new Error('dispatch failed')
  }
  await assert.rejects(proposeUpstreamUpdate(f), /dispatch failed/)
  assert.ok(!f.calls.some(([name]) => name === 'autoMerge'))
})
