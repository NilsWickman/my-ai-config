export const meta = {
  name: 'workflow-guidance',
  description: 'Build one task through serial, resumable gates whose auditors are paid to disagree',
  whenToUse: 'One well-specified task in an adapted repo. Serial and resumable: every stage writes <workdir>/NN-stage.md and skips itself once that artifact is complete.',
  phases: [
    { title: 'Spec' },
    { title: 'Build' },
    { title: 'Gates' },
    { title: 'Verify' },
    { title: 'Wrap' },
  ],
}

// ===========================================================================
// ADAPT ZONE. Edit only above the FROZEN line. Everything here is pinned once
// per repo by the workflow-guidance skill's adapt branch, then left alone.
// ===========================================================================

const BASE_VERSION = 'workflow-guidance base 1'

// The repo's green bar, as shell. Several lines are fine: bring up whatever the
// gate needs, fail red with a plain instruction when a precondition is missing,
// and never hang waiting on a service. When the repo has no suite at all, pin
// the strongest static checks it does have and say so, so the gate reports
// UNVERIFIED instead of a green it has not earned.
const VERIFY = `make verify`

// Where a task's requirements live in this repo, named so the spec agent finds
// them without guessing. A backlog file, an issue tracker, a wayfinder ticket.
const SPEC_SOURCES = `docs/BACKLOG.md`

// How UAT observes running behaviour, and what it must never touch. The second
// half is the safety pin: name the live ports and services that are off limits.
const SANDBOX = `Boot a throwaway instance on a free port and tear it down afterwards. Never touch a live or shared service.`

// Extra blind auditors, zero or more. A lens needs its standard grounded in a
// document in THIS repo, or it invents one and reports noise. Empty is correct
// until the repo has a written standard worth auditing against.
const LENSES = [
  // { name: 'honesty', brief: 'find any place a number could mislead a reader', grounding: 'docs/DEFINITION-OF-DONE.md section 2' },
]

// Whether two runs in this repo can hold the gate at the same time. True only
// when the gate isolates its own database and binds no fixed port. The skill
// reads this before it lets a second workspace start.
const PARALLEL_SAFE = false

// Where a worktree run puts its branch, relative to the repo root.
const WORKTREE_DIR = `../worktrees`

// What wrap does with finished work: 'branch' commits on task/<id> for an
// integrator to merge, 'handback' leaves the tree dirty and returns a message.
const WRAP_POLICY = 'handback'

// ===========================================================================
// FROZEN. Below this line is the flow itself: the blindness rules, the resume
// contract, and the gate verdicts. Editing it changes what the gates are worth.
// ===========================================================================

// args: { task, workdir, brief?, worktree?, models? }
// workdir is absolute and machine-local; the skill computes it and owns its
// lock. Two workspaces on one repo may run at once only when PARALLEL_SAFE.
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const task = A.task
const dir = A.workdir
if (!task || !dir || !String(dir).startsWith('/')) {
  return { error: 'the workflow-guidance skill passes { task, workdir }, and workdir must be absolute' }
}

const brief = A.brief
  ? `\nBRIEF for ${task} (overrides the task's own source wherever they conflict):\n${A.brief}\n`
  : ''
const models = A.models && typeof A.models === 'object' ? A.models : {}
const m = (stage) => (models[stage] ? { model: models[stage] } : {})

const useWorktree = !!A.worktree
const wtPath = `${WORKTREE_DIR}/${task}`
const wtBranch = `task/${task}`
const ws = useWorktree
  ? `WORKSPACE (worktree mode): all code work and all commands happen in the worktree ${wtPath} ` +
    `(relative to the repo root, your starting cwd) on branch ${wtBranch}. ` +
    `Artifact paths in this prompt are absolute and machine-local, so they are the same from either tree. ` +
    `If the worktree is missing, create it from the repo root: \`git worktree add ${wtPath} -b ${wtBranch} HEAD\` ` +
    `(drop \`-b\` when branch ${wtBranch} already exists). ` +
    `The task's diff = commits on ${wtBranch} beyond its base PLUS uncommitted changes in the worktree. ` +
    `Never modify code in the main tree.\n\n`
  : ''

/** Resume preamble every stage agent obeys. */
const idem = (file) =>
  `RESUME CHECK FIRST: if the file ${dir}/${file} exists AND its first line is exactly "STATUS: complete", ` +
  `print its full content as your final answer and STOP, doing no other work. ` +
  `Otherwise do the work below and FINISH by writing your full result to ${dir}/${file} ` +
  `with "STATUS: complete" as line 1 (create directories as needed), then return that same content.\n\n`

/** Gate preamble: a red verdict must never write a complete artifact, or the
 *  resume check replays the cached red forever and no rerun can reach green. */
const idemGate = (file) =>
  `RESUME CHECK FIRST: if the file ${dir}/${file} exists AND its first line is exactly "STATUS: complete", ` +
  `print its full content as your final answer and STOP, doing no other work. ` +
  `Otherwise do the work below and FINISH by writing your full result to ${dir}/${file} ` +
  `(create directories as needed) with line 1 exactly "STATUS: complete" when your verdict is green, ` +
  `or exactly "STATUS: red" when it is red, so the next attempt re-runs this gate instead of resuming it. ` +
  `Then return that same content.\n\n`

const died = (stage) => ({ task, stopped: `${stage} agent died (model or API failure), rerun to resume`, artifacts: dir })

phase('Spec')
const spec = await agent(
  idem('01-spec.md') +
  `You are the SPEC agent for task ${task}. Read the task's own source (${SPEC_SOURCES}) and the source files it touches. ` +
  `Write an implementation-ready spec: (1) numbered ACCEPTANCE CRITERIA, each independently checkable by someone who ` +
  `cannot see the implementation, (2) the files you expect to change, (3) what is explicitly out of scope for this task.` +
  brief,
  { label: `spec:${task}`, phase: 'Spec', ...m('spec') },
)
if (spec === null) return died('spec')

phase('Build')
const build = await agent(
  idem('02-build.md') + ws +
  `You are the BUILDER for ${task}. Read ${dir}/01-spec.md and implement it. INCENTIVE: meet every acceptance criterion ` +
  `with the smallest honest diff. Follow the repo's existing conventions rather than importing your own. ` +
  `Artifact: what you changed and why, per criterion, plus anything you could not do and the reason.`,
  { label: `build:${task}`, phase: 'Build', ...m('build') },
)
if (build === null) return died('build')

phase('Gates')
const gates = await agent(
  idemGate('03-gates.md') + ws +
  `You are the GATES runner for ${task}. Run this repo's gate exactly as pinned:\n\n${VERIFY}\n\n` +
  `Artifact: each step's pass or fail with failing output excerpts. Fix ONLY clear test or type breakage caused by this ` +
  `task's diff, no feature changes, rerun, and record what you fixed. ` +
  `End with VERDICT: green when the whole gate passes, VERDICT: red when anything fails, or ` +
  `VERDICT: unverified when the repo has no gate able to judge this diff. Never report green for a gate you did not run.`,
  { label: `gates:${task}`, phase: 'Gates', ...m('gates') },
)
if (gates === null) return died('gates')
if (String(gates).includes('VERDICT: red')) {
  return { task, stopped: 'gates red, fix and rerun this workflow (completed stages resume)', artifacts: dir }
}

phase('Verify')
// BLIND UAT: sees the spec and the raw diff only, never the builder's notes.
const uat = await agent(
  idem('04-uat.md') + ws +
  `You are the UAT GATE for ${task}. INCENTIVE: you are rewarded for finding an acceptance criterion that FAILS. ` +
  `A "pass" without documented probing counts against you, and your findings face a refutation pass, so report only what you verified. ` +
  `BLINDNESS RULE: read ONLY ${dir}/01-spec.md and the code itself (git diff plus files). Do NOT read ${dir}/02-build.md ` +
  `or any builder notes. ` +
  `Walk every acceptance criterion literally. ${SANDBOX} ` +
  `Artifact: per criterion, PASS or FAIL or UNTESTABLE with the exact evidence (command, output, file:line).`,
  { label: `uat:${task}`, phase: 'Verify', ...m('uat') },
)
if (uat === null) return died('uat')

const lensFiles = []
for (const lens of LENSES) {
  const file = `05-${lens.name}.md`
  lensFiles.push(file)
  const lensResult = await agent(
    idem(file) + ws +
    `You are the ${lens.name.toUpperCase()} AUDITOR for ${task}. INCENTIVE: ${lens.brief}. ` +
    `Judge against ${lens.grounding}, which is the standard you review to, not your own taste. Read it first. ` +
    `BLINDNESS RULE: read ONLY that standard, ${dir}/01-spec.md, and the code itself. Do NOT read ${dir}/02-build.md ` +
    `or ${dir}/04-uat.md. ` +
    `Artifact: numbered findings with file:line and which line of the standard each one breaks, or "no findings" ` +
    `with what you actually checked. Findings face a refutation pass, so report only what you verified.`,
    { label: `${lens.name}:${task}`, phase: 'Verify', ...m(lens.name) },
  )
  if (lensResult === null) return died(`lens:${lens.name}`)
}

const refuteInputs = [`${dir}/04-uat.md`, ...lensFiles.map((f) => `${dir}/${f}`)].join(', ')
const refute = await agent(
  idem('06-refute.md') + ws +
  `You are the REFUTER for ${task}. Read ${refuteInputs}. For every FAIL or finding, try to REFUTE it against the actual ` +
  `code and spec: is it real, reproducible, and in scope? ` +
  `Artifact: per finding, CONFIRMED with the reproduction, or REFUTED with the disproof. ` +
  `The findings you confirm are this workflow's true output, so be as hard on the auditors as they were on the builder.`,
  { label: `refute:${task}`, phase: 'Verify', ...m('refute') },
)
if (refute === null) return died('refute')

phase('Wrap')
const simplify = await agent(
  idem('07-simplify.md') + ws +
  `You are the SCOPE CUTTER for ${task}. Read the diff. INCENTIVE: the smallest honest diff. Flag over-engineering, dead ` +
  `code, needless abstraction, and anything not traceable to a spec criterion. ` +
  `APPLY only zero-risk removals (unused code, duplicate logic). If you change anything, rerun the FULL gate:\n\n${VERIFY}\n\n` +
  `and revert your removal unless it comes back green. A partial rerun does not clear this step. ` +
  `List riskier suggestions without applying them. Artifact: what you removed, what you suggest, the gate result.`,
  { label: `simplify:${task}`, phase: 'Wrap', ...m('simplify') },
)
if (simplify === null) return died('simplify')

const wrapCommit = WRAP_POLICY === 'branch'
  ? `Then COMMIT in the worktree on ${wtBranch}: \`git add -A && git commit\` with your commit message, following the ` +
    `repo's own trailer convention. If refute left CONFIRMED open findings, still commit, but state plainly in the ` +
    `artifact that the branch is NOT mergeable until they are fixed. Do not merge and do not push.`
  : `DO NOT COMMIT. The human integrates.`
const wrap = await agent(
  idem('08-wrap.md') + ws +
  `You are the WRAP assembler for ${task}. Read ALL artifacts in ${dir}/ and \`git status --short\`. ` +
  `Record the branch and the base commit this work sits on (\`git rev-parse --abbrev-ref HEAD\` and ` +
  `\`git rev-parse --short HEAD\`) as the first lines after the status line, so a later reader can tell whether these ` +
  `artifacts still describe the tree. ` +
  `Artifact: (1) a one-paragraph summary in plain words, (2) CONFIRMED findings still open from ${dir}/06-refute.md, ` +
  `which block integration, (3) files changed, (4) a ready-to-use commit message body. ${wrapCommit}`,
  { label: `wrap:${task}`, phase: 'Wrap', ...m('wrap') },
)
if (wrap === null) return died('wrap')

return { task, base: BASE_VERSION, parallelSafe: PARALLEL_SAFE, artifacts: dir, wrap }
