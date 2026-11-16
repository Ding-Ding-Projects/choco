# Notifications

Short messages that do not block your work, and a list of them behind the bell.

## What it is

A notification appears at the edge of the window when something happens: a job was queued, one of your jobs finished or failed, a file was refused, a copy succeeded. Some carry an action, such as **Open** to jump to the job. Ordinary ones leave after about 5 seconds, errors after 15, and each has a close button. They are announced politely to assistive technology.

The bell in the top bar, or `Ctrl+Shift+L`, opens the list of notifications since the page was opened, with their times.

## How to use it

Nothing to set up. Use **Open** on a job notification to see its output. Open the bell to re-read one you missed.

## What was checked

The end to end checks `read only machine refuses a change` and `uninstall runs only after both keys and the slider` read their outcome from notifications.

## Known limits

- The list holds the latest 100 and is cleared when the page is reloaded. The permanent record is the [History](history.md).
- These are in-app messages. For messages outside the app, an admin can set up [status webhooks](status-webhooks.md). The app does not send operating system notifications or email.

## Related

- [Jobs and live output](jobs-and-live-output.md)
- [Install result takeovers](install-result-takeovers.md)
- [Sound and narration](sound-and-narration.md)
