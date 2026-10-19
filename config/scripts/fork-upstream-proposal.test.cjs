const { test } = require('node:test')
const assert = require('node:assert/strict')
const { proposeUpstreamUpdate } = require('./fork-upstream-proposal.cjs')
const sha = 'a'.repeat(40)
const snapshot = {
  html_url: 'existing',
  number: 2,
  node_id: 'PR_2',
  head: { ref: `updates/orca-main-${sha}`, sha, repo: { full_name: 'cwstine/orca-colors' } }
}

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
        git: {
          getRef: async (args) => {
            calls.push(['getRef', args])
            return { data: { object: { sha } } }
          },
          createRef: async (args) => {
            calls.push(['createRef', args])
          }
        },
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
          update: async (args) => {
            calls.push(['update', args])
          },
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
  assert.ok(!f.calls.some(([name]) => name === 'createRef' || name === 'create'))
})
test('pins a snapshot of upstream main without changing staging or upstream branches', async () => {
  const f = fixture(2)
  await proposeUpstreamUpdate(f)
  const args = f.calls.find(([name]) => name === 'create')[1]
  assert.equal(args.base, 'staging')
  assert.equal(args.head, `cwstine:updates/orca-main-${sha}`)
  assert.deepEqual(f.calls.find(([name]) => name === 'createRef')[1], {
    owner: 'cwstine',
    repo: 'orca-colors',
    ref: `refs/heads/updates/orca-main-${sha}`,
    sha
  })
  assert.equal(args.maintainer_can_modify, false)
})
test('reuses an existing upstream PR instead of duplicating it', async () => {
  const f = fixture(3, [snapshot])
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

for (const existing of [[], [snapshot]]) {
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

test('leaves an in-flight snapshot fixed when newer upstream commits arrive', async () => {
  const f = fixture(20, [snapshot])
  await proposeUpstreamUpdate(f)
  assert.ok(!f.calls.some(([name]) => ['createRef', 'getRef', 'create'].includes(name)))
})
test('closes the old moving-head PR after its snapshot replacement is configured', async () => {
  const f = fixture(3, [{ number: 9, head: { ref: 'main', repo: { full_name: 'stablyai/orca' } } }])
  await proposeUpstreamUpdate(f)
  assert.equal(f.calls.find(([name]) => name === 'update')[1].state, 'closed')
  assert.equal(f.calls.find(([name]) => name === 'update')[1].pull_number, 9)
})
test('does not close the old PR when replacement creation fails', async () => {
  const f = fixture(3, [{ number: 9, head: { ref: 'main', repo: { full_name: 'stablyai/orca' } } }])
  f.github.rest.pulls.create = async () => {
    throw new Error('creation failed')
  }
  await assert.rejects(proposeUpstreamUpdate(f), /creation failed/)
  assert.ok(!f.calls.some(([name]) => name === 'update'))
})
test('reuses an existing snapshot ref only when it still points to the expected commit', async () => {
  const f = fixture(3)
  f.github.rest.git.createRef = async () => {
    throw Object.assign(new Error('exists'), { status: 422 })
  }
  await proposeUpstreamUpdate(f)
  assert.ok(f.calls.some(([name]) => name === 'create'))
})
test('refuses a snapshot branch that was moved to a different commit', async () => {
  const f = fixture(3)
  f.github.rest.git.createRef = async () => {
    throw Object.assign(new Error('exists'), { status: 422 })
  }
  f.github.rest.git.getRef = async (args) => ({
    data: { object: { sha: args.owner === 'stablyai' ? sha : 'b'.repeat(40) } }
  })
  await assert.rejects(proposeUpstreamUpdate(f), /snapshot.*changed/i)
  assert.ok(!f.calls.some(([name]) => name === 'create'))
})
