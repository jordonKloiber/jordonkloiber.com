---
title: "Reaching for the Playwright Pie in the Sky"
summary: "When a new microfrontend architecture created a blind spot in our end-to-end test coverage, I built a cost/risk model to compare three ways to close it, then picked the one that actually fit the team's real constraints."
role: "Senior Software Quality Engineer"
date: 2026-09-25
tags: ["testing", "playwright", "micro-frontends", "ci-cd"]
featured: false
draft: false
---

At a previous job my product team introduced a business-critical microfrontend with module federation to our already bloated tech stack. As a quality engineer, I both dread and look forward to such challenges. As soon as it was researched and the prototype was approved, development swiftly followed. In the first couple of implementation conversations with our tech lead, (the researcher and author of the project), they insisted that we move forward without E2E Playwright coverage in the remote repo. My QA alarm bells went off. I immediately took it upon myself to create a spike task to investigate this during the next sprint.

I was the owner of automation in our team's product area, and did not want to wait for something bad to happen to prompt us to retroactively re-evaluate how we implement tests to accommodate for this new pattern. In my day-to-day I very rarely make architectural decisions, but the opportunity had just knocked down my door.

## 1. Context

Microfrontends are basically an architectural pattern for splitting a frontend into smaller, independently developed and deployed pieces. <a href="https://webpack.js.org/concepts/module-federation/" target="_blank" rel="noopener">Module federation</a> is a webpack feature that lets a host app dynamically fetch and mount code from a separately built, separately deployed "remote" at runtime, while negotiating shared dependencies like React so both sides don't ship duplicate copies. We needed a pattern like this because it provides a shared, easily mutable, user experience between different frontend applications. This would allow multiple frontend "host" applications to consume the same "remote" UX, all housed and developed in the same repo.

The main issue automation-wise is that to capture a full E2E experience in our user flow, the test will have to traverse from the host app, through the remote app UX, and then back through to the host app once again. The unit, integration, and storybook tests being implemented were robust, but our existing E2E Playwright suite lived in the host. Simply installing Playwright in the remote wouldn't serve its purpose as the tests would not capture the full flow. They would be scoped to the remote and the remote build would need something to mount to. Adding E2E tests to the host app also presented challenges: we did not yet have the infrastructure to mount the remote app in the host's CI, and even if we did, the host's CI could not give feedback to the developer (because they were working in the separate microfrontend repo). I was stuck between anxiety coupled with constant regression testing if we left out the E2E tests, and a completely inefficient, impotent automation architecture if we added the tests to the host. Somewhere there is a clever metaphor for that.

At this point we were moving fast. We already had merged in multiple branches to production behind a feature flag, but only for one host to the single remote. We were on-track to add the next host in the near-future and possibly others beyond that. The project was looking great and the tests in the remote were doing their job. Bugs were being caught early in development and the deployed branches had very few issues.

What still nagged me was the scalability and the critical nature of this repo. Going forward, as this microfrontend becomes increasingly consumed by differently implemented host apps, I saw the potential risk profile balloon. The longer we kept this piecemeal test net in place without checking the bigger picture in CI, the more regression testing we would ultimately need. The more regression testing we need, the higher the possibility of bugs getting through. This microfrontend is business-critical beyond what capital letters can express. A serious bug crashing it, or even just causing malfunction, could have a cascading effect on all the hosts that consume the remote in the future. Despite the fact that the structure we had in place was working for now, I needed to find other options and do a risk/cost comparison.

## 2. The blind spots

In the test architecture, there were "blind spots" for CI in both the host and the remote. Tests within the remote are scoped to the remote and host tests only see what data goes in and out, never the remote's internal behavior. To the frontend host app CI, the remote app is a black box. There was also no <a href="https://docs.pact.io/" target="_blank" rel="noopener">consumer-driven contract testing</a> in place yet. Consumer-driven contract testing is when each side (host and remote) states what it expects from the other in a shared, versioned contract, and CI fails if either side breaks it. Without this in place, the blind spot darkens further.

<a href="/work/microfrontend-e2e-testing/blind-spots.svg" target="_blank" rel="noopener"><img src="/work/microfrontend-e2e-testing/blind-spots.svg" alt="Module Federation E2E Blind Spots" /></a>

While the tests were holding up well so far, I identified five major risk scenarios with this structure:

1. A change on the frontend host breaks something in the remote flow. Because CI only runs against the frontend host, it passes anyway, and the bug reaches production undetected.

2. The remote mutates data in a way that's invalid on the frontend host but valid on the backend. Frontend CI has no way to catch this, so the bug ships silently.

3. A bug on the backend breaks both the frontend and the remote. The frontend's E2E tests pick it up in CI, but the remote has no E2E tests of its own, so the remote-side bug goes uncaught.

4. An external vendor dependency shared by the frontend host and the remote changes, and the remote isn't updated to match. CI on the frontend host doesn't account for this, so it passes and the bug slips through.

5. The contract between the remote and the host breaks, but nothing in frontend CI checks for that, so the bug reaches production without being flagged.

## 3. Weighing options

As I researched and weighed our options, it immediately became apparent that keeping the tests in the frontend host was not the path forward. Even if we were able to build and mount the current version of the remote to the host's CI, each breaking update to the remote would result in a companion PR to update the tests in the host, doubling the code review and deploy overhead. I don't want my devs at my throat when they have to juggle double the PRs, reviews, and deploys. Terrible idea, throw that one in the bin.

Still– I landed on three other viable options. Assume all three implement strict consumer-driven contract testing. That is a non-negotiable for this new architecture. They are listed below in order of least costly/most risky to most costly/least risky:

| Solution | Cost | Risk |
|---|---|---|
| 1. Trust internal tests, add guardrails | Lowest | Highest |
| 2. Mount remote to staging host | Medium | Medium |
| 3. Central Playwright CI repo | Enormous | Lowest |

### Solution 1 - Highest risk profile, lowest cost. Trust our internal tests, add some guardrails.

*This is the initial plan made by the tech lead, but with some extra defensive measures added*.

- Trust the robust unit, integration, and Storybook testing already in place in the remote repo, where we already have hundreds of tests and a component design library for standardization. They have done a good job at preventing bugs so far
- Keep the Playwright tests in the host, making sure to thoroughly test the boundaries of the remote
- For E2E tests that pass through the remote, mock data collection at those boundaries. Keep these to a minimum because they could require tedious upkeep as the data collection in the remote evolves.
- Tag a subset of these boundary Playwright tests to run in host CI on every remote repo merge, so if something breaks, we know in staging before it reaches production, giving us enough time to roll back and investigate. Only implement a small, but broad, subset of tests to do this so that we minimize overhead on future iterations.
- Rely on our integration tests that check the form of the API requests going to the backend. This will have to be thoroughly regression tested with every relevant update.

<a href="/work/microfrontend-e2e-testing/solution-1.svg" target="_blank" rel="noopener"><img src="/work/microfrontend-e2e-testing/solution-1.svg" alt="Solution 1 — Trust Internal Tests + Tagged Boundary Tests" /></a>

#### Risks

- The boundaries remain a black box to CI. This measure does not eliminate that issue. Unit/integration tests do not replicate full E2E experience.
- Data mutation test cases within the remote are not fully captured in CI.
- We would have to update the remote data mocking in the host CI Playwright tests if the data collection changed in the remote.
- We would have to watch and wait for host CI on every merge to be sure the boundary tests were green. No live feedback in CI upon creating branches in remote.
- There is a small chance the integration and unit tests are not capturing 1:1 the full experience within the remote app.

#### Cost

- Test structure within the remote has already been proved out and stable. The tests are already present and running in the repo. No additional work there.
- Some small cost to configuring the boundary tests to run in CI upon every remote merge. Additional time to develop those tests. Potential added time to maintain those tests in further updates.
- More manual regression testing for UX flows going through the remote.

### Solution 2 - Medium risk profile, medium cost. Mount remote to staging host.

*Much better feedback and coverage, but a heavier lift*

- Install and configure Playwright and E2E CI in the remote repo.
- Create a harness for CI to allow the remote build to mount to the stage host app.
- When CI runs in the remote repo, it mounts the remote app to the staging host site with a harness. The remote does not need to build the host app to run CI. This should mirror production from the remote's viewpoint.
- Playwright CI runs in the remote, in tandem with development, providing live feedback.
- Inter-boundary tests must be implemented on both the remote and host wherever the risk is high enough.

<a href="/work/microfrontend-e2e-testing/solution-2.svg" target="_blank" rel="noopener"><img src="/work/microfrontend-e2e-testing/solution-2.svg" alt="Solution 2 — Mount Remote to a Staging Harness" /></a>

#### Risks

- There is a possibility staging does not match production or dev, risking collisions of in-progress work.
- If stage is down or overly slow, no E2E CI can run.
- Possible harness issues and maintenance.
- The boundary expands— the remote is no longer fully a black box, but there is still an overlapping gray area at the seams. The Playwright CI in the remote is still isolated to its own internals and how it behaves once mounted to stage. The boundary has shifted from only what the remote and host see internally, to what the host can see and what the remote *tests via stage*.
- The boundary itself is accessible to both, but is representative of what is in stage, not the dev branch in the host. This is why we need cross-boundary tests implemented in both stage and host to catch any inconsistencies between the two isolated CI runs.

#### Cost

- Medium infra cost and buy-in to configure Playwright and CI in the remote.
- Additional infra cost and buy-in needed to create and set up the harness to mount to the host staging site.
- Creating a new Playwright suite and tests within remote repo

### Solution 3 - Lowest risk profile, enormous cost. Independent central Playwright CI repo. The Playwright pie in the sky.

*Maximum coverage and efficiency after implementation, but is a huge x-team endeavor requiring buy-in and large time commitments from many stakeholders. This option is functionally academic.*

- Rather than have distributed frontends/microfrontends, each with their own tests, send ALL E2E tests in CI into a central Playwright CI repo that serves tests to each frontend and microfrontend repo based on tags.
- This central repo would have a heavy load because it would be building and performing all of the frontend and microfrontend CI needs, but also that would be its only purpose.
- Tests for all repos would be updated in their respective repos and then served to the larger DB of tests in the overall Playwright repo.
- We use GitHub Actions' <a href="https://docs.github.com/actions/using-workflows/events-that-trigger-workflows#repository_dispatch" target="_blank" rel="noopener"><code>repository_dispatch</code></a> event to let one repo's workflow trigger a workflow in a different repo via the GitHub API. So when a PR merges in the host repo or the remote repo, that repo's CI can fire a `repository_dispatch` call to the central Playwright repo, which has a "receiver" workflow listening for it and kicks off the relevant tests.
- This Playwright repo is responsible for determining which tests should be ran for each repo and allows for inter boundary testing to be implemented separately, but the tests themselves are applied broadly.
- Possibly implement AI agents to aid in the test selection logic. In addition to the hand-maintained tags, an AI agent could look at a diff (which files/routes/components changed) and reason about which of the central repo's tagged E2E tests are actually relevant, catching cases a human tagging scheme would miss.
- Builds in CI would all happen in one single place using any tests necessary from the collective DB of all the frontend and microfrontend E2E tests.
- This is the best option if you have multiple remote microfrontends serving multiple host frontend applications.

<a href="/work/microfrontend-e2e-testing/solution-3.svg" target="_blank" rel="noopener"><img src="/work/microfrontend-e2e-testing/solution-3.svg" alt="Solution 3 — Central Playwright CI Repo" /></a>

#### Risks

- This repository will have a massive load considering the logic and data necessary to: orchestrate which tests go where, serve all the tests for each CI run, and create builds for the tests.
- A single point of failure for inter-repo Playwright tests. In a finished state, we could keep each host CI disabled and available in case the central Playwright service has issues.
- Keeping tests and builds 1:1 with dev in their parent repos. Versioning drift could be very dangerous here.

#### Cost

- This might require more than one repository to be fully operational
- Massive infrastructure and development cost for time spent research, planning, implementing, and testing.
- This will incur extra monetary cost for agent tokens used in development/research/final product, setting up the new repo(s), additional plumbing, and other associated costs.

#### Open questions regarding solution 3

This final solution is the trickiest one to implement, not only because of the associated costs and time, but also because there are many engineering questions left unanswered. The `repository_dispatch` GitHub Actions event gives us an initial trigger to communicate with the central Playwright repo, but it does not give us everything we need. It can only carry a small payload.

The research I did was to find more viable options to support the new patterns and I tried to scope the deliverables to that. I did not have the time, capacity, or technical depth of knowledge at that time to attempt fully fleshed out implementation. These questions are worth exploring though, so I will include them below:

1. **What is transferring the code to the Playwright service?** The central repo's workflow still has to separately check out the right commit/branch from the triggering repo (and every other repo it needs to compose a build from). Some sort of mechanism will have to also transport tests from each frontend repo to the Playwright service for use.
2. **What is doing the test selection?** Playwright tags are the obvious choice but the logic to use them does not exist yet. As I suggested above, maybe an AI agent could help shore up loose ends in this area.
3. **What orchestrates and composes the builds?** Solution 3's core value is running the host and remote *and* backend together in one place. Spinning that up, probably docker-compose or similar, ephemerally, per test run is a major and complex part of the architecture that I could not even begin to explore.
4. **What reports back and how?** If a dev merges and wants to see pass/fail on their PR, something has to explicitly push a commit status back to the originating repo via the API.

## 4. What we picked and why

Unfortunately oftentimes in this industry, quality takes a backseat to speed. Especially when a project is already on its way and expectations are set. By the completion of my research, v1 was already in front of users in the form of an A/B test with a 90/10 split. Ten percent of users were already interacting with the microfrontend regularly and filling our Snowflake boards with data. This merged with very little issue and only one minor production bug escaped us and our tests within the microfrontend. All other real bugs had been caught by either the test or myself, and we made sure to cover those gaps whenever I caught a bug. No blind-spot issues had appeared in prod or been caught by my manual testing. So far, so good.

At the time there was only a 1:1 host/remote connection with concrete tickets in motion for one more host – while the intention was to scale in the future, we had no actual plans yet. I was aware of these constraints and priorities when deciding on my recommendation before presenting to both my team in an engineering meeting, and the director of engineering directly.

As a forward-thinking and risk-averse QA, it pained me slightly, but my ultimate decision was to go with solution one, trusting our internal testing and adding some defensive guardrails. This solution has the highest risk profile, but the trade-offs for solutions two and three were simply too great to manage in our current state and workload. Other teams had other priorities already set and did not have the time or resources to invest in planning these CI enhancements at that time. Furthermore, the extra dev work alone would put us at risk of not reaching our goals. The tests already in place were working. With the addition of extra defensive measures in place, the risk profile was small enough to accept at that moment.

## 5. Presenting my findings and aftermath

I presented all of this to my team and director with the caveat that if and when we expand this pattern to beyond two hosts for one remote, or even more concerning, many hosts to many remotes, we needed to consider the more complex and costly solutions if we wanted to preserve quality and efficiency. We collectively agreed the risk profile was small enough to accept, given the limited number of places where it appears - but that wouldn't last for long and the consequences could be great down the line.

Both my team and director greenlit my recommendation and we had lengthy and enjoyable conversations about the harmful implications of these patterns, what we have seen so far, and how to mitigate them in the future. I was then tasked to document my findings on Confluence, where a similar version of what you are reading here still lives. This documentation served as a guide should we run into the scenario where the more costly solutions seemed necessary.

Not too long after that, Quality Engineering as a position at the company was eliminated entirely, costing me my job. Quality was in the backseat before and now it might be in the trunk of the car. Hopefully not in the rear-view mirror.

I will unfortunately never get to see if my architectural propositions will ever be used or even considered in that tech stack again. After putting a large amount of time and effort into providing proactive solutions, I felt as if my favorite toy was taken away from me. I was proud of my work. I truly would have enjoyed helping design and implement any such improvements in that position, but at the very least, I hope I can help someone else work through a similar problem.

---

**To the reader:**

My recommendation is not "use solution one", but to approach your own challenges with nuance. Everyone's level of time, cost, support, and knowledge available is independent and variable. Choose the solution that works best for your stack, resources, and risk-tolerance. There is no "one-size-fits-all", and it is important to weigh the tradeoffs, while keeping in mind your current situation before making a decision.

You can never truly understand which option is the best until you jump headfirst into the rabbit hole to learn which of the Mad Hatter's teapots are cracked and which ones actually hold water. I learned it's better to scope out each approach, even if the immediate or obvious choice looks like it fits at a glance. That forethought and diligence might just come in handy sooner than you think.

I am eager for any comments or questions you might have about my strategies or approach. Keep in mind, I have no formal experience in designing architecture like this – I consider myself highly competent in my own field, but this was definitely out of my comfort zone. Be kind please :)

Thank you for reading!
