# Command schema generated from the CLI source

Every command, option, config setting and feature the app offers is read from the C# source of the CLI in this repository, not typed in by hand.

## What it is

`scripts/gen-schema.mjs` reads the command classes under `src/chocolatey` and writes `shared/choco-schema.json`. At the time of writing it holds 23 commands, 190 command options, 24 global options, 11 config settings and 30 features. For each option it records the accepted spellings, whether it takes a value, its description, and whether it carries a secret.

The interface builds its forms from this file, and the hub and the agent validate every request against it.

## How to use it

```
node scripts/gen-schema.mjs           # rewrite the schema
node scripts/gen-schema.mjs --check   # fail if it no longer matches the source
```

Run the generator after any change to the CLI's options. Nothing else needs editing for a new option to appear in the Console.

## What was checked

Tests `schema matches the CLI source in this repository` and `schema covers every command file` in `test/core.test.js`. They fail when the committed file and the source disagree.

## Known limits

- The generator reads source text. An option that is added at run time by an extension is not seen.
- Descriptions are the ones in the source and are English only.

## Related

- [Console](console.md): the forms built from the schema
- [Every command and option](../articles/commands-and-options.md): the guide
- [Config and features](config-and-features.md): settings and features from the same file
