# PTE Academic Practice Trainer

Ten full practice tests — 590 items, all 22 task types — that run entirely in the
browser. Reading and Listening are scored and reviewed for free. Speaking and
Writing are marked by a model, which needs an API key.

---

## Putting it on GitHub Pages

1. Create a new repository on GitHub. It can be public — there are no secrets in
   these files, and Pages is free for public repos.
2. Upload everything in this folder to the root of the repository. Keep the
   structure: `index.html` at the top, with `css/`, `js/` and `tests/` beside it.
   The empty `.nojekyll` file matters, so upload that too.
   `GIT-COMMANDS.txt` lists the exact commands if you would rather use the
   terminal than the web uploader.
3. In the repository, go to **Settings → Pages**.
4. Under *Source* choose **Deploy from a branch**, pick `main` and `/ (root)`, and
   press Save.

That link is all anyone needs. It works on any desktop Chrome, on any machine.

- All ten tests, full length, with real exam timing
- Reading and Listening scored completely — every multiple choice, re-order,
  fill-in-the-blank, highlight and dictation item
- The full item review on every question: the original question, what they
  answered, the correct answer, and why the score came out as it did
- Progress tracking across attempts

None of that costs anything, needs an account, or touches an API.

## What needs a key

Speaking and Writing have to be marked by a model. So do the coaching report and
generating tests beyond the ten included.

Each person adds **their own** key in Settings. It is stored in their browser, on
their device, and is sent only to the model provider when they are being graded.
It is never uploaded to GitHub and nobody else who opens the link can see it or is
billed for it.

> **Never commit an API key to the repository.** A key in a public repo is public.
> There is nowhere in these files that one belongs.

## Choosing a provider

| | Anthropic | DeepSeek |
|---|---|---|
| Works on this hosted page | **yes** | sometimes — see below |
| Key from | console.anthropic.com | platform.deepseek.com |
| Generating & grading | `claude-sonnet-5` — $3 / $15 | `deepseek-v4-flash` — $0.14 / $0.28 |
| Coaching report | `claude-opus-5` — $5 / $25 | `deepseek-v4-pro` — $0.435 / $0.87 |
| Sees the Describe Image charts | yes | no |

Rates are USD per million tokens, input / output. Grading a full attempt costs
roughly $0.10 with Anthropic.

**DeepSeek on a hosted page.** With no server involved, the browser calls the
provider directly, and it will only do that if the provider sends CORS headers
permitting it. Anthropic supports this explicitly and is documented to. DeepSeek
does not document it either way, so it may or may not work depending on their
current policy — press **Test connection** and you will know in a second. If the
browser blocks it, the app says so plainly, and the downloadable version relays
through a small local Python server instead.

DeepSeek's newer models also reason by default, and reasoning mode rejects a forced
tool call. The app probes several request shapes on the first call, settles on
whichever the model accepts, and remembers it. Test connection reports which one it
landed on.

## Two other things that only the offline version can do

- **Speech-to-text.** Chrome's built-in recogniser mishears connected speech
  constantly, and better transcription services generally refuse direct browser
  calls for the same CORS reason. The setting is here and will work if your
  endpoint permits it; if not, the offline version relays around the problem.
- **Saving generated tests.** Tests generated in the browser live only in that
  browser. Export them from Settings and commit the files into `tests/`, adding
  them to `tests/manifest.json`, to make them permanent for everyone.

## Requirements

Desktop **Google Chrome**. The speaking tasks use Chrome's microphone recording and
speech recognition, and the listening audio uses its speech synthesis. Because
GitHub Pages is served over HTTPS, Chrome remembers the microphone permission
between visits — it will only ask once.

If the listening audio sounds robotic, that is Chrome using the oldest voice your
operating system has. The voice list in Settings is sorted best first; on Windows
add a *Natural* voice under Settings → Time & language → Speech, and on macOS
download an *Enhanced* voice under Accessibility → Spoken Content.

## Running it locally instead

```
python3 -m http.server 8000
```

then open `http://localhost:8000`. Opening `index.html` straight from the file
system will not work — the tests cannot load and Chrome re-asks for the microphone
on every item.

## What is here

```
index.html              the app
404.html                shown for any unknown address
css/app.css
js/                     util, store, state, api, speech, meta, charts,
                        grade, items, runner, results, generate, ui, main
tests/
  manifest.json         which test files to load
  test-01.json … test-10.json    hand-written, 59 items each
```

Built to the PTE Academic format as revised by Pearson in August 2025: 22 task
types, three parts, 52–64 scored items per form. Check Pearson's current
scored-item table before relying on any timing.
