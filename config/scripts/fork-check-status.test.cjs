const { test } = require('node:test')
const assert = require('node:assert/strict')
const { prepare, publish } = require('./fork-check-status.cjs')

function fixture() {
  const statuses = []
  const outputs = {}
  const pull = {
    state: 'open',
    node_id: 'PR_1',
    base: { ref: 'staging', sha: 'base', repo: { full_name: 'cwstine/orca-colors' } },
    head: { ref: 'main', sha: 'head', repo: { full_name: 'stablyai/orca' } }
  }
  const merge = { sha: 'merge', parents: [{ sha: 'base' }, { sha: 'head' }] }
  return {
    statuses,
    outputs,
    pull,
    merge,
    context: { repo: { owner: 'cwstine', repo: 'orca-colors' }, runId: 42 },
    core: {
      setOutput(key, value) {
        outputs[key] = value
      }
    },
    number: 1,
    head: 'head',
    base: 'base',
    result: 'success',
    calls: [],
    github: {
      graphql: async () => {},
      rest: {
        actions: { createWorkflowDispatch: async () => {} },
        pulls: { get: async () => ({ data: pull }) },
        repos: {
          getCommit: async () => ({ data: merge }),
          createCommitStatus: async (args) => statuses.push(args)
        },
        git: { getRef: async () => ({ data: { object: { sha: pull.base.sha } } }) }
      }
    }
  }
}

test('tests a pinned merge of exactly the current fork and upstream commits', async () => {
  const f = fixture()
  await prepare(f)
  assert.deepEqual(f.outputs, { merge: 'merge', head: 'head', base: 'base' })
  assert.equal(f.statuses[0].state, 'pending')
})
test('rejects other source repositories before publishing a status', async () => {
  const f = fixture()
  f.pull.head.repo.full_name = 'someone/orca'
  await assert.rejects(prepare(f), /Only open upstream/)
  assert.equal(f.statuses.length, 0)
})
test('rejects stale merge refs without releasing the gate', async () => {
  const f = fixture()
  f.merge.parents[0].sha = 'old-base'
  await assert.rejects(prepare(f), /stale/)
  assert.deepEqual(f.outputs, {})
  assert.equal(f.statuses[0].state, 'pending')
})
test('reports success only for the tested head with the same current base', async () => {
  const f = fixture()
  await publish(f)
  assert.equal(f.statuses[0].state, 'success')
  assert.equal(f.statuses[0].sha, 'head')
  assert.equal(f.statuses[0].context, 'Orca Colors checks')
})
for (const result of ['failure', 'cancelled', 'skipped']) {
  test(`does not allow merging after ${result} validation`, async () => {
    const f = fixture()
    f.result = result
    await publish(f)
    assert.equal(f.statuses[0].state, 'failure')
  })
}
for (const part of ['head', 'base']) {
  test(`invalidates success if ${part} changes during testing`, async () => {
    const f = fixture()
    f.pull[part].sha = 'changed'
    await publish(f)
    assert.equal(f.statuses[0].state, 'failure')
    assert.equal(f.statuses[0].sha, 'head')
  })
}

test('accepts an immutable upstream snapshot in this fork', async () => {
  const f = fixture()
  f.pull.head = {
    ref: `updates/orca-main-${'a'.repeat(40)}`,
    sha: 'a'.repeat(40),
    repo: { full_name: 'cwstine/orca-colors' }
  }
  f.merge.parents[1].sha = f.pull.head.sha
  await prepare(f)
  assert.equal(f.outputs.head, f.pull.head.sha)
})
test('rejects a snapshot branch whose name no longer matches its commit', async () => {
  const f = fixture()
  f.pull.head = {
    ref: `updates/orca-main-${'a'.repeat(40)}`,
    sha: 'b'.repeat(40),
    repo: { full_name: 'cwstine/orca-colors' }
  }
  await assert.rejects(prepare(f), /Only open upstream/)
  assert.equal(f.statuses.length, 0)
})

test('retries current upstream revisions when a head changes during validation', async () => {
  const f = fixture()
  const dispatched = []
  f.github.rest.actions.createWorkflowDispatch = async (args) => dispatched.push(args)
  f.autoMerge = true
  f.pull.head.sha = 'new-head'
  await publish(f)
  assert.equal(f.statuses[0].state, 'failure')
  assert.equal(dispatched.length, 1)
  assert.deepEqual(dispatched[0].inputs, { pr_number: '1', retry_count: '1' })
  assert.equal(dispatched[0].ref, 'staging')
})
test('limits retries to avoid an unbounded CI loop', async () => {
  const f = fixture()
  f.autoMerge = true
  f.retryCount = 3
  f.pull.head.sha = 'new-head'
  f.github.rest.actions.createWorkflowDispatch = async () => {
    throw new Error('unexpected retry')
  }
  await publish(f)
})
test('re-enables auto-merge after current checks pass even if upstream disabled it', async () => {
  const f = fixture()
  f.autoMerge = true
  const requests = []
  f.github.graphql = async (query, args) => requests.push(args)
  await publish(f)
  assert.equal(f.statuses[0].state, 'success')
  assert.deepEqual(requests, [{ id: 'PR_1' }])
})
test('never enables auto-merge when validation failed', async () => {
  const f = fixture()
  f.autoMerge = true
  f.result = 'failure'
  f.github.graphql = async () => {
    throw new Error('unexpected merge')
  }
  f.github.rest.actions.createWorkflowDispatch = async () => {
    throw new Error('unexpected retry')
  }
  await publish(f)
  assert.equal(f.statuses[0].state, 'failure')
})
