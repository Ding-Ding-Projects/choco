# Pattern builder

Describe the text you are looking for, and the builder writes the regular expression.

## What it is

A dialog that opens from the button beside the **Regex** switch of a filter. You fill in any of five parts and it composes one pattern, anchored to the start of each row:

| Part | Meaning |
| --- | --- |
| Starts with | The row begins with this text |
| Contains | This text appears anywhere |
| Ends with | The row finishes with this text |
| Any of these | At least one of the choices appears. Separate them with commas |
| Does not contain | Rows with this text are left out |

The builder escapes special characters for you, explains the result in a sentence, shows the pattern and whether it compiles, and previews it live against rows of the page it was opened from and against lines you type. Upper and lower case are treated the same.

## How to use it

Open a filter bar, press the builder button, fill in the parts and apply. The filter switches to regex mode with the pattern filled in. The command palette and the changelog have the same builder.

## What was checked

End to end checks `pattern builder composes an anchored pattern and previews matches`, `pattern builder escapes special characters and compiles safely`, `a built pattern filters the list it was opened from` and `the palette has its own pattern builder`.

## Known limits

- It builds from the five parts above. Anything else, such as repetition counts or groups, you type as a pattern by hand.
- A pattern longer than 200 characters, or one that does not compile, filters nothing and says why.
- It writes patterns. It does not explain a pattern you paste in.

## Related

- [Filters and regex](filters-and-regex.md)
- [Command palette](command-palette.md)
- [Changelog viewer](changelog-viewer.md)
