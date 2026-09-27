# Repository mirror sync

`AwesomeZun/FDDD` (public) and `Team-FlyGate/FDDD` (private) share one history. `.github/workflows/mirror-sync.yml` runs in both: when a branch or tag is pushed to either repository, the run fast-forwards the same ref in the other one, usually within a minute. Web-editor commits and merged pull requests are pushes too, so they sync the same way.

**Visibility:** anything pushed to the private `Team-FlyGate/FDDD` becomes public in `AwesomeZun/FDDD` about a minute later. Keep secrets and unpublished material out of both repositories.

## What is not synced

- Deleting a branch or tag.
- Issues, pull requests, releases, wiki and repository settings.
- Diverged history. If the two repositories received different commits on the same branch before a run finished, or someone force-pushed, the run fails with a `diverged` error and changes nothing.

## Fixing a diverged branch

Merge one side into the other and push the result to either repository; the workflow then fast-forwards the other one.

```sh
git remote add awesome https://github.com/AwesomeZun/FDDD.git   # once
git remote add team https://github.com/Team-FlyGate/FDDD.git     # once
git fetch awesome && git fetch team
git switch --create sync-fix awesome/main
git merge team/main          # resolve conflicts if any
git push awesome sync-fix:main
```

## Credentials

Each repository holds a secret `MIRROR_DEPLOY_KEY`, the private half of an ed25519 deploy key with write access on the other repository (titled `mirror-sync from …`). The Team-FlyGate organization allows deploy keys for this (`deploy_keys_enabled_for_repositories`). To rotate a key, generate a new pair, replace the deploy key on the target repository and the secret on the source repository.

A run can also be started by hand: Actions → Mirror sync → Run workflow.
