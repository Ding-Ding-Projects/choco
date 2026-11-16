# Repository setup for the maintainer

Two entries in the feature inventory need repository settings that only a maintainer with admin rights can change: discussions as a running record (entry 111) and a project board (entry 112). Nothing in this file has been applied. Each section ends with a check that shows whether the step worked.

The commands use the GitHub CLI (`gh`), signed in as a user with admin rights on `Ding-Ding-Projects/choco`. Every step can also be done in the browser, and the browser path is given first.

## 1. Discussions as a running record

The aim is one place where each release and each larger decision gets a dated entry that people can reply to.

### 1.1 Turn discussions on

1. Open `https://github.com/Ding-Ding-Projects/choco/settings`.
2. Under **Features**, tick **Discussions**.

With the CLI:

```
gh repo edit Ding-Ding-Projects/choco --enable-discussions
```

Check:

```
gh repo view Ding-Ding-Projects/choco --json hasDiscussionsEnabled
```

It should print `{"hasDiscussionsEnabled":true}`.

### 1.2 Create the categories

Categories can only be created in the browser.

1. Open `https://github.com/Ding-Ding-Projects/choco/discussions/categories`.
2. Choose **New category** and create these three:

| Name | Format | Purpose |
| --- | --- | --- |
| Releases | Announcement | One entry per Material Choco release. Only maintainers can start an entry; anyone can reply. |
| Running record | Announcement | Dated notes on decisions, checks that were run and their real results. |
| Questions | Question / Answer | Questions from people who use the app. |

3. Delete or keep the default categories as you prefer. The record does not depend on them.

Check: `https://github.com/Ding-Ding-Projects/choco/discussions` lists the three categories in the left column.

### 1.3 Start the record

1. In **Running record**, start a discussion titled `Running record: how this works`.
2. In the body, say that each entry is dated, states what was done and which checks were run with their real results, and links to the commit, the workflow run and the release.
3. Pin it: open the discussion, then choose **Pin discussion** in the right column.

### 1.4 Optional: a release entry for every release

The release workflow does not create discussions today. Two ways to get one entry per release:

- By hand: on a release page choose **Edit**, tick **Create a discussion for this release**, pick the **Releases** category and save.
- From the workflow: add `--discussion-category "Releases"` to the `gh release create` command in `.github/workflows/material-choco-release.yml`. Do this only after step 1.2, because the command fails when the category does not exist. The workflow already has `contents: write`; add `discussions: write` to its `permissions` block as well.

Check: after the next release, `https://github.com/Ding-Ding-Projects/choco/discussions/categories/releases` shows an entry with the release title.

## 2. Project board

The aim is one board that shows what is planned, in progress and done for Material Choco, fed from issues and pull requests in this repository.

### 2.1 Create the board

Boards belong to the organisation, not to the repository.

1. Open `https://github.com/orgs/Ding-Ding-Projects/projects`.
2. Choose **New project**, then the **Board** layout, and name it `Material Choco`.

With the CLI (the token needs the `project` scope, which `gh auth refresh -s project` adds):

```
gh project create --owner Ding-Ding-Projects --title "Material Choco"
```

Check:

```
gh project list --owner Ding-Ding-Projects
```

The list should include `Material Choco` with a number. That number is `<number>` below.

### 2.2 Link the board to the repository

1. Open `https://github.com/Ding-Ding-Projects/choco/projects`.
2. Choose **Link a project** and pick `Material Choco`.

With the CLI:

```
gh project link <number> --owner Ding-Ding-Projects --repo Ding-Ding-Projects/choco
```

Check: the board appears under the **Projects** tab of the repository.

### 2.3 Set the columns

A new board has a `Status` field with `Todo`, `In Progress` and `Done`. To match `material-choco/ROADMAP.md`, open the board, choose the `Status` field settings and set the options to:

| Option | Meaning |
| --- | --- |
| Planned | Agreed, not started |
| In progress | Being worked on |
| Needs Windows | Written, and waiting for a run on Windows |
| Done | Finished, with a named check that exercised it |

### 2.4 Fill the board automatically

1. Open the board, then the **...** menu, then **Workflows**.
2. Turn on **Auto-add to project**, choose the repository `Ding-Ding-Projects/choco` and the filter `is:issue,pr is:open`.
3. Turn on **Item closed** and set it to move the item to `Done`.
4. Turn on **Pull request merged** and set it to move the item to `Done`.

Check: open a test issue in the repository. It should appear on the board within a minute. Close it and it should move to `Done`.

### 2.5 Make the board readable by visitors

The repository is public, and a new board is private.

1. Open the board, then the **...** menu, then **Settings**.
2. Under **Danger zone**, set **Visibility** to **Public**.

With the CLI:

```
gh project edit <number> --owner Ding-Ding-Projects --visibility PUBLIC
```

Check: open the board address in a private browser window. It should load without signing in.

## 3. After the steps are done

1. Change entries 111 and 112 in `material-choco/docs/FEATURE-INVENTORY.md` from "Not built" to the state that matches what was done, and name the check from this file that showed it.
2. Add the board address and the discussions address to `material-choco/README.md`.
3. Record the date and the result of each check in `material-choco/HANDOFF.md`.
