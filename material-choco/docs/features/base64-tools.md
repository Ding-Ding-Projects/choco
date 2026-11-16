# Base64 tools

Turn text or a file into Base64 and back, entirely in the browser.

## What it is

A page with two fields, **Plain text** and **Base64**. Typing in either rewrites the other at once. Text is encoded as UTF-8, so accents, Chinese characters and symbols survive the round trip. A **URL-safe alphabet** switch uses `-` and `_` and leaves out the `=` padding.

Decoding is strict. Input that is not Base64 in the chosen alphabet is reported with the character and its position, and nothing is decoded. Decoded bytes that are not UTF-8 text are not shown as text; they can be saved as a file.

Nothing on this page is sent to the hub or anywhere else.

## How to use it

- Type or paste on either side. **Copy text** and **Copy Base64** copy the result.
- **Encode a file** reads one file of up to 5 MB from your device.
- **Save decoded bytes** writes the decoded bytes to a file. **Save Base64 as text** saves the Base64 itself.
- **Clear both** empties the page.

## What was checked

End to end checks `base64 encodes UTF-8 text` and `base64 reports invalid input instead of guessing` in `test/e2e/run.mjs`.

## Known limits

- One file at a time, up to 5 MB.
- Standard and URL-safe Base64 only. No other encodings.

## Related

- [Pattern builder](pattern-builder.md): another helper that runs only in the browser
- [Help page](help-page.md)
