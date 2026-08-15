import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * The shared ESLint config. One definition, consumed by every package.
 *
 * ## Why this file did not exist until now
 *
 * `packages/config/package.json` has advertised `"./eslint": "./eslint.config.js"`
 * since the repo was created and the file was never written, while three
 * packages declared `"lint": "eslint src --fix"` against a binary that appears
 * nowhere in `pnpm-lock.yaml`. So `pnpm lint` — a command CLAUDE.md lists as
 * standard — has never once run. Same shape as the P0 finding that `pnpm test`
 * ran `vitest run` with vitest in no package.json and zero test files: a script
 * that names a tool nobody installed reads as "we lint" right up until someone
 * types the command.
 *
 * ## What is enforced here, and why each one
 *
 * The generic recommended set is the floor. What is worth reading are the four
 * `no-restricted-syntax` rules at the bottom: each is a defect this codebase has
 * actually shipped, more than once, that the compiler cannot see. A linter that
 * only repeats what `tsc` already says is a slower `tsc`.
 *
 * ## No type-aware linting
 *
 * `projectService` would buy `no-floating-promises` and friends, and it would
 * also make lint depend on tsconfig resolution across seven packages — a second
 * way for the build to break that reports as a lint failure. Typecheck already
 * runs on every package and is green. If floating promises become the problem
 * worth solving, turn it on then, deliberately.
 */

export default tseslint.config(
  {
    // Global ignores. Flat config applies an `ignores`-only block to every
    // subsequent block, which is the only way to exclude generated output.
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.d.ts",
    ],
  },

  ...tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      /**
       * strict-rules §4, mechanically.
       *
       * `no-explicit-any` covers `as any` as well as a bare `any` annotation —
       * it bans the type, not one syntax for reaching it. Raised from the
       * recommended `warn` because the rule this project wrote for itself is
       * "NEVER", and a warning is a thing you scroll past.
       */
      "@typescript-eslint/no-explicit-any": "error",

      /**
       * The other half of §4. All four directives, including the
       * description-carrying forms — `@ts-expect-error` with a good excuse is
       * still a suppressed error, and the excuse is where the next reader stops
       * looking.
       */
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": true,
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
        },
      ],

      /**
       * Unused code is how a refactor half-lands. P7a alone left 19 imports dead
       * across two commits, each one a claim about what the file needs that had
       * stopped being true.
       *
       * `_` opts out, for the destructure-to-drop-a-key idiom and for handlers
       * whose signature is fixed by a library.
       */
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],

      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-restricted-syntax": [
        "error",

        // ── strict-rules §4, the two escapes `no-explicit-any` does not cover ──
        //
        // `as unknown` and `as never` are how a cast gets past a ban on `any`,
        // and both have cost this repo real defects: `as never` in
        // `job-helpers.ts` was hiding a second untyped enum in
        // `lib/quote-to-job.ts`, and `as unknown as` in `schedule-calendar.tsx`
        // erased the generic it was supposedly working around, so all four
        // CalendarEvent handlers were being checked against `object`.
        //
        // In both cases deleting the cast is what surfaced the real error.
        {
          selector: "TSAsExpression > TSUnknownKeyword",
          message:
            "strict-rules §4: no `as unknown`. Assert to the specific type you mean, or fix the type. A cast through unknown erases whatever the compiler was about to tell you.",
        },
        {
          selector: "TSAsExpression > TSNeverKeyword",
          message:
            "strict-rules §4: no `as never`. This is the shape that hid an untyped enum in lib/quote-to-job.ts — delete it and read the error it was suppressing.",
        },

        // ── strict-rules §11 ──
        //
        // Passing a server action straight to `mutationFn` breaks React's
        // serialization: TanStack Query's internal state handling alters the
        // object prototype, and the call fails at runtime with "Only plain
        // objects can be passed to Server Actions". The fix is an arrow
        // wrapper, and the broken form is one token shorter, so it will keep
        // being written.
        {
          selector: "Property[key.name='mutationFn'][value.type='Identifier']",
          message:
            "strict-rules §11: wrap it — `mutationFn: (data) => createCustomer(data)`. A server action passed by reference loses its prototype inside TanStack Query and fails at runtime.",
        },

        // ── The one this repo has shipped three separate times ──
        //
        // `z.coerce.boolean()` is `Boolean(value)`, and every non-empty string
        // is truthy — so `?showArchived=false` parses to **true**. It shipped on
        // customers (CUST-29), then on `catalogListQuery`, then again on the
        // costing report, where it was caught before release only because
        // somebody happened to look. Three independent authors reached the same
        // wrong conclusion from the word "coerce".
        {
          selector:
            "CallExpression[callee.object.object.name='z'][callee.object.property.name='coerce'][callee.property.name='boolean']",
          message:
            "z.coerce.boolean() is Boolean(value), so the string \"false\" parses as true. Use `booleanFlag` from lib/schemas/common.ts.",
        },
      ],
    },
  },

  {
    /**
     * Tracked debt, kept at warn — hence its own block.
     *
     * `new Date(col).toLocaleDateString()` shifts a Postgres `date` column back
     * a day for anyone west of UTC. The cross-page sweep counts 20 sites left in
     * `components/dashboard/`, and three of them render a `timestamptz` and are
     * correct, so this cannot be an error without walling the build on known
     * work with known exceptions.
     *
     * It is a separate block because `no-restricted-syntax` takes one severity
     * for the whole list: redeclaring it in a later block **replaces** the
     * earlier list rather than merging with it. Two severities means two rule
     * names, and `no-restricted-properties` is the one that can express this.
     */
    files: ["**/*.{ts,tsx}"],
    /**
     * The two modules that *define* the canonical formatters are exempt.
     *
     * `formatDateOnly` has to call `toLocaleDateString` — it is the
     * implementation the rule points everybody else at. Flagging it told the
     * author of the correct helper to go use the correct helper. Scoped to the
     * file rather than silenced with an inline disable, because "this module owns
     * date rendering" is a fact about the module, not about one line.
     */
    ignores: ["**/lib/format.ts", "**/src/format/index.ts"],
    rules: {
      "no-restricted-properties": [
        "warn",
        {
          // Property only, with no `object`. Naming `Date` would match the bare
          // identifier — `Date.toLocaleDateString` — and never `new
          // Date(x).toLocaleDateString()`, which is the only form anybody
          // writes. A rule that cannot fire is worse than no rule, because it
          // reads as coverage.
          property: "toLocaleDateString",
          message:
            "A Postgres `date` column parsed as a Date is midnight UTC, so this prints the previous day west of UTC. Use formatDateOnly. Correct only for timestamptz.",
        },
      ],
    },
  },

  {
    files: ["**/*.tsx"],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      /**
       * Registered by hand rather than by spreading the plugin's own preset.
       *
       * The preset's export name moved between eslint-plugin-react-hooks 5.0 and
       * 5.2 (`configs.recommended` in eslintrc shape, then
       * `configs['recommended-latest']` for flat). Naming the two rules is
       * stable across both, and this is the same class of mistake as guessing an
       * enum's members instead of reading them.
       */
      "react-hooks/rules-of-hooks": "error",

      /**
       * Warn, not error. This repo's effect bugs have been ordering and
       * ownership problems — two effects racing on the view preference, a
       * load-once guard swallowing a restore — which a dependency array does not
       * describe. A missing dep is worth reading; it is not worth failing on.
       */
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  {
    files: ["**/scripts/**", "**/test/**", "**/__tests__/**", "**/*.test.{ts,tsx}"],
    rules: {
      // Scripts and tests bind values to document intent, and a seed script that
      // cannot print is not a seed script.
      "@typescript-eslint/no-unused-vars": "off",

      /**
       * `@ts-expect-error` is allowed **in tests only**, and only with a reason.
       *
       * Everywhere else strict-rules §4 bans it. A test asserting that a runtime
       * guard rejects input the type system forbids has to write input the type
       * system forbids — that is the assertion, not a workaround for one. And
       * `@ts-expect-error` is the correct tool for it precisely because it is
       * self-destructing: if the signature ever widens to accept the bad value,
       * the directive becomes unused and **fails the build**, which is a
       * stronger guarantee than any cast could give.
       *
       * `ts-ignore` stays banned here too. It is the one that rots silently —
       * it keeps suppressing after the error it was written for is gone.
       */
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
        },
      ],
    },
  },
);
