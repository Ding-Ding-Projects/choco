# Command preview and dry run

Every form shows the exact command before it runs, and the option dialogs can run it as a dry run first.

## What it is

Wherever a command is built, in the Console or in an option dialog, a box titled **Command that will run** shows the full command line and updates with each change. Secret values appear as `********` in it. Option dialogs also have **Dry run with --what-if**, which queues the same command with the CLI's `--what-if` option so that it reports what it would do without doing it.

A dry run counts as a read: it is allowed on read only machines, it skips the two key confirmation, and it does not trigger a full-screen install result.

## How to use it

- Read the preview before pressing **Run**.
- In an option dialog, for example **Upgrade with options** on a package, choose **Dry run with --what-if** and read the job output.
- In the Console, turn on `what-if` under **Global options** for the same effect.

## What was checked

- End to end check `console preview shows the exact command`.
- Test `classify marks changing and destructive commands` in `test/core.test.js` covers the rule that `--what-if` is not treated as a change.

## Known limits

- The preview shows what the hub sends. On the machine the agent also adds `--allow-unofficial-build`, which the preview does not show.
- What a dry run reports is up to the CLI. It has not been run against the real `choco.exe` through the app.

## Related

- [Console](console.md)
- [Secret masking](secret-masking.md)
- [Read only agents](read-only-agents.md)
