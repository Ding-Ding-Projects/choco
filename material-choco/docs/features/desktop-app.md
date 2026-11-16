# Desktop app

A Windows app that manages Chocolatey on the PC it runs on, and can also connect that PC to a hub.

## What it is

The desktop app is a frameless window with its own title bar, which shows whether the app is running as administrator. Inside, it runs the same hub as the container, in-process, bound to `127.0.0.1` on a random port, with the local PC as a built-in machine named **This PC**. The window is signed in automatically with a one time launch token. Only one copy of the app runs at a time.

The window shows only the local interface: links to other sites open in your default browser, and navigation away from the local address is blocked.

## How to use it

- Install it with `Setup.exe` and start it. See [Getting started on one PC](../articles/getting-started.md).
- **Settings**, **Sign in and locks**, **Restart as administrator** relaunches with administrator rights after you approve the Windows prompt.
- **Machines**, **Connect this PC to a hub** pairs it with a hub. `MaterialChoco.exe --agent ...` runs the agent without a window.

## What was checked

[HANDOFF.md](../../HANDOFF.md) records that the app was launched on Linux under a virtual display, signed in automatically and passed the bundled CLI check with the test stand-in. One capture of that window is in the screenshots. The update notice is covered by the end to end checks `a downloaded update is announced as not code signed` and `Restart asks the desktop app to restart into the update`, which run against a stand-in for the desktop shell.

## Known limits

- **Not yet started on Windows.** The installer was built there and has not been installed or run.
- The desktop shell asks the newest release for updates, and the interface announces a downloaded update with a **Restart** button and the statement that the build is not code signed. This has only been exercised with a stand-in for the desktop shell, never on Windows. Until it has, treat updates as manual.
- The installer and the app are not code signed.

## Related

- [Windows installer](windows-installer.md)
- [Bundled CLI](bundled-cli.md)
- [Remote agent](remote-agent.md)
